const { app, BrowserWindow, ipcMain, dialog, net: electronNet } = require('electron');
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Innertube } = require('youtubei.js');
const DiscordRPC = require('discord-rpc');

// Discord RPC setup - using a generic open YouTube Music RPC Client ID
const clientId = '878345720797437992'; 
DiscordRPC.register(clientId);
const rpc = new DiscordRPC.Client({ transport: 'ipc' });

// Express and Socket.io server
const expressApp = express();
expressApp.use(cors());

// Serve the compiled mobile React app statically
const staticPath = path.join(__dirname, 'mobile-dist');
expressApp.use(express.static(staticPath));

const server = http.createServer(expressApp);
const io = new Server(server, {
    cors: { origin: '*' }
});

let mainWindow;
let yt; // YouTubei.js instance
let currentMediaState = {};
let lastVolume = 50; // Keep track of the last set volume (default to 50%)

// Retrieve local IP address on startup
const { networkInterfaces } = require('os');
function getLocalIP() {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return 'localhost';
}

let PORT = 8080;
let localIP = 'localhost';
let titleText = `YouTube Music Connect`;

// Helper to find a free port natively
const net = require('net');
function getFreePort(startPort) {
    return new Promise((resolve) => {
        const tempServer = net.createServer();
        tempServer.listen(startPort, '0.0.0.0', () => {
            const { port } = tempServer.address();
            tempServer.close(() => {
                resolve(port);
            });
        });
        tempServer.on('error', () => {
            resolve(getFreePort(startPort + 1));
        });
    });
}

app.whenReady().then(async () => {
    // Initialize YouTubei.js for searching
    yt = await Innertube.create();

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        icon: path.join(__dirname, 'build/icon.png'),
        autoHideMenuBar: true,
        title: titleText,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: false // for simpler setup with preload
        },
    });

    // Strip Content Security Policy headers enforcing Trusted Types to allow UI injection
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = details.responseHeaders;
        const cspKey = Object.keys(responseHeaders).find(key => key.toLowerCase() === 'content-security-policy');
        if (cspKey) {
            let csp = responseHeaders[cspKey][0];
            csp = csp
                .replace(/require-trusted-types-for\s+[^;]+;?/g, '')
                .replace(/trusted-types\s+[^;]+;?/g, '');
            responseHeaders[cspKey] = [csp];
        }
        callback({ responseHeaders });
    });

    // Find free port and start server
    getFreePort(8080).then((freePort) => {
        PORT = freePort;
        localIP = getLocalIP();
        titleText = `YouTube Music Connect (Phone URL: http://${localIP}:${PORT})`;
        if (mainWindow) {
            mainWindow.setTitle(titleText);
        }
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`Local Server listening on port ${PORT} (accessible from mobile over Wi-Fi)`);
        });
    });

    mainWindow.loadURL('https://music.youtube.com');

    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        console.log(`[RENDERER CONSOLE] ${message} (at ${sourceId}:${line})`);
    });

    // Prevent YouTube Music from overwriting Electron window title
    mainWindow.on('page-title-updated', (e) => {
        e.preventDefault();
        mainWindow.setTitle(titleText);
    });

    // Check for updates on startup
    checkForUpdates();

    // Connect Discord RPC
    rpc.login({ clientId }).catch(err => console.log('Discord RPC could not connect:', err.message));

    // Listen for cookie changes or navigation to capture user login
    const updateAuth = async () => {
        try {
            const cookies = await mainWindow.webContents.session.cookies.get({});
            if (cookies.length > 0) {
                console.log("Captured cookie names:", cookies.map(c => c.name));
                const cookieStr = cookies
                    .filter(c => c.domain.includes('youtube.com'))
                    .map(c => `${c.name}=${c.value}`)
                    .join('; ');
                yt = await Innertube.create({ cookie: cookieStr });
                console.log("YouTubei.js authenticated with user cookies!");
            }
        } catch(e) {
            console.error("updateAuth error during Innertube.create:", e.message);
        }
    };

    updateAuth(); // Run immediately on boot

    mainWindow.webContents.on('did-navigate-in-page', updateAuth);
    mainWindow.webContents.on('did-finish-load', updateAuth);
});

// Express server starts asynchronously once a free port is found

// IPC from Preload (YouTube Music web page)
ipcMain.on('media-info', (event, info) => {
    currentMediaState = info;
    // Only sync volume from PC if the song has been playing for more than 3 seconds.
    // This prevents YouTube Music's auto-reset volume during song loading from overwriting our lastVolume.
    if (info.volume !== undefined && info.volume !== null && info.currentTime > 3) {
        lastVolume = info.volume;
    }
    
    // Update Discord RPC
    if (rpc) {
        rpc.setActivity({
            details: info.title,
            state: info.artist,
            startTimestamp: info.isPlaying ? Math.floor((Date.now() - (info.currentTime * 1000))) : null,
            largeImageKey: 'logo', // these keys depend on the discord developer app assets
            largeImageText: 'YouTube Music',
            instance: false,
        }).catch(() => {});
    }

    // Broadcast to Mobile App via Socket.io
    io.emit('state-update', info);
});

ipcMain.handle('get-last-volume', () => {
    return lastVolume;
});

ipcMain.on('get-last-volume-sync', (event) => {
    event.returnValue = lastVolume;
});

ipcMain.on('get-connection-url-sync', (event) => {
    event.returnValue = `http://${localIP}:${PORT}`;
});

const { shell } = require('electron');
ipcMain.on('open-external-url', (event, url) => {
    shell.openExternal(url);
});

// Socket.io commands from Mobile App
io.on('connection', (socket) => {
    console.log('Mobile app connected!');
    socket.emit('state-update', currentMediaState);

    socket.on('command', (cmd) => {
        if (mainWindow) {
            if (cmd.startsWith('playVideo:')) {
                io.emit('state-update', { 
                    title: 'Loading...', 
                    artist: '', 
                    cover: '',
                    isPlaying: false
                });
            } else if (cmd.startsWith('volume:')) {
                lastVolume = parseInt(cmd.split(':')[1]);
            }
            mainWindow.webContents.send('command', cmd);
        }
    });

    socket.on('search', async (query, callback) => {
        if (yt) {
            try {
                const results = await yt.music.search(query, { type: 'song' });
                let songs = [];
                
                // Parse youtubei.js structure
                if (results.contents && results.contents[0] && results.contents[0].contents) {
                    songs = results.contents[0].contents.map(song => ({
                        id: song.id || (song.endpoint?.payload?.videoId),
                        title: song.title || (song.title?.text) || 'Unknown Title',
                        artist: song.flex_columns?.[1]?.title?.runs?.[0]?.text || song.authors?.map(a => a.name).join(', ') || 'Unknown Artist',
                        cover: song.thumbnails?.[0]?.url || (song.thumbnail?.contents?.[0]?.url)
                    })).filter(s => s.id);
                } else if (results.songs && results.songs.contents) {
                     songs = results.songs.contents.map(song => ({
                        id: song.id,
                        title: song.title,
                        artist: song.artists?.map(a => a.name).join(', '),
                        cover: song.thumbnails?.[0]?.url
                    }));
                }
                
                callback({ success: true, data: songs });
            } catch (err) {
                callback({ success: false, error: err.message });
            }
        }
    });

    socket.on('get-home', async (callback) => {
        if(yt) {
            try {
                const home = await yt.music.getHomeFeed();
                const sections = home.sections?.map(sec => ({
                    title: sec.title?.text || sec.title || 'Recommended',
                    items: sec.contents?.map(item => ({
                        id: item.id || item.endpoint?.payload?.videoId || item.endpoint?.payload?.browseId,
                        title: item.title?.text || item.title || 'Unknown',
                        subtitle: item.subtitle?.runs?.map(r => r.text).join('') || item.subtitle?.text || item.subtitle || '',
                        cover: item.thumbnails?.[0]?.url || item.thumbnail?.[0]?.url || item.thumbnail?.contents?.[0]?.url,
                        isArtist: item.endpoint?.payload?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType === 'MUSIC_PAGE_TYPE_ARTIST'
                    })) || []
                })) || [];
                callback({ success: true, data: sections });
            } catch (err) {
                callback({ success: false, error: err.message });
            }
        }
    });

    socket.on('get-library', async (callback) => {
        if(yt) {
            try {
                const library = await yt.music.getLibrary();
                let items = [];
                
                if (library.playlists) {
                    const playlists = library.playlists.contents || library.playlists;
                    if (Array.isArray(playlists)) {
                        items.push(...playlists.map(p => ({
                            id: p.id || p.endpoint?.payload?.browseId,
                            title: p.title?.text || p.title || 'Playlist',
                            subtitle: 'Playlist',
                            cover: p.thumbnails?.[0]?.url || p.thumbnail?.[0]?.url
                        })));
                    }
                }
                
                if (library.albums) {
                    const albums = library.albums.contents || library.albums;
                    if (Array.isArray(albums)) {
                        items.push(...albums.map(a => ({
                            id: a.id || a.endpoint?.payload?.browseId,
                            title: a.title?.text || a.title || 'Album',
                            subtitle: 'Album • ' + (a.artists?.map(art => art.name).join(', ') || ''),
                            cover: a.thumbnails?.[0]?.url || a.thumbnail?.[0]?.url
                        })));
                    }
                }

                if (library.artists) {
                    const artists = library.artists.contents || library.artists;
                    if (Array.isArray(artists)) {
                        items.push(...artists.map(art => ({
                            id: art.id || art.endpoint?.payload?.browseId,
                            title: art.name || art.title?.text || 'Artist',
                            subtitle: 'Artist',
                            cover: art.thumbnails?.[0]?.url || art.thumbnail?.[0]?.url
                        })));
                    }
                }
                
                if (items.length === 0 && library.contents) {
                    items = library.contents.map(item => ({
                        id: item.endpoint?.payload?.browseId || item.id,
                        title: item.title?.text || item.title || 'Playlist',
                        subtitle: item.subtitle?.runs?.map(r => r.text).join('') || '',
                        cover: item.thumbnails?.[0]?.url || item.thumbnail?.[0]?.url || item.thumbnail?.contents?.[0]?.url
                    }));
                }

                callback({ success: true, data: items });
            } catch (err) {
                console.error("get-library error:", err);
                callback({ success: false, error: err.message });
            }
        } else {
            console.error("get-library error: yt client not initialized");
            callback({ success: false, error: "Client is initializing. Please wait." });
        }
    });

    socket.on('get-explore', async (callback) => {
        if(yt) {
            try {
                const explore = await yt.music.getExplore();
                const sections = explore.sections?.map(sec => ({
                    title: sec.title?.text || sec.title || 'Trending',
                    items: sec.contents?.map(item => ({
                        id: item.id || item.endpoint?.payload?.videoId || item.endpoint?.payload?.browseId,
                        title: item.title?.text || item.title || 'Unknown',
                        subtitle: item.subtitle?.runs?.map(r => r.text).join('') || item.subtitle?.text || item.subtitle || '',
                        cover: item.thumbnails?.[0]?.url || item.thumbnail?.[0]?.url || item.thumbnail?.contents?.[0]?.url,
                        isArtist: item.endpoint?.payload?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType === 'MUSIC_PAGE_TYPE_ARTIST'
                    })) || []
                })) || [];
                callback({ success: true, data: sections });
            } catch (err) {
                callback({ success: false, error: err.message });
            }
        }
    });

    socket.on('get-collection', async (id, callback) => {
        if(yt) {
            try {
                let data = null;
                if (id.startsWith('VL') || id.startsWith('PL') || id.startsWith('RD') || id.startsWith('OL')) {
                    const cleanId = id.replace('VL', '');
                    const res = await yt.music.getPlaylist(cleanId);
                    data = {
                        playlistId: cleanId,
                        title: res.header?.title?.text || res.title,
                        cover: res.header?.thumbnails?.[0]?.url || res.thumbnails?.[0]?.url,
                        songs: res.items?.map(song => ({
                            id: song.endpoint?.payload?.videoId || song.id,
                            title: song.title?.text || song.title,
                            artist: song.authors?.map(a=>a.name).join(', ') || '',
                            cover: song.thumbnails?.[0]?.url || song.thumbnail?.[0]?.url || res.header?.thumbnails?.[0]?.url || res.thumbnails?.[0]?.url
                        })) || []
                    };
                } else if (id.startsWith('MPRE')) {
                    const res = await yt.music.getAlbum(id);
                    const match = res.url?.match(/list=([a-zA-Z0-9_-]+)/);
                    const listId = match ? match[1] : '';
                    const albumCover = res.header?.thumbnail?.contents?.[0]?.url || res.header?.thumbnails?.[0]?.url || res.thumbnails?.[0]?.url;

                    data = {
                        playlistId: listId,
                        title: res.header?.title?.text || res.title,
                        cover: albumCover,
                        songs: res.contents?.map(song => ({
                            id: song.endpoint?.payload?.videoId || song.id,
                            title: song.title?.text || song.title,
                            artist: song.authors?.map(a=>a.name).join(', ') || '',
                            cover: song.thumbnails?.[0]?.url || song.thumbnail?.[0]?.url || albumCover
                        })) || []
                    };
                } else if (id.startsWith('UC')) {
                    const res = await yt.music.getArtist(id);
                    const songsSection = res.sections?.find(s => s.title?.text === 'Songs' || s.title?.text === 'Şarkılar' || s.title === 'Top songs' || s.header?.title?.text === 'Songs' || s.header?.title?.text === 'Şarkılar') || res.sections?.[0];
                    
                    const otherSections = res.sections?.filter(s => s !== songsSection).map(sec => ({
                        title: sec.header?.title?.text || sec.title?.text || sec.title || 'Collection',
                        items: sec.contents?.map(item => ({
                            id: item.endpoint?.payload?.browseId || item.endpoint?.payload?.videoId || item.id,
                            title: item.title?.text || item.title || 'Unknown',
                            subtitle: item.subtitle?.text || item.subtitle?.runs?.map(r=>r.text).join('') || '',
                            cover: item.thumbnails?.[0]?.url || item.thumbnail?.contents?.[0]?.url || item.thumbnail?.[0]?.url,
                            isArtist: item.endpoint?.payload?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType === 'MUSIC_PAGE_TYPE_ARTIST'
                        })).filter(i => i.id) || []
                    })).filter(sec => sec.items.length > 0) || [];

                    data = {
                        isArtist: true,
                        title: res.header?.title?.text || res.title,
                        cover: res.header?.thumbnails?.[0]?.url || res.thumbnails?.[0]?.url,
                        songs: songsSection?.contents?.map(song => ({
                            id: song.endpoint?.payload?.videoId || song.id,
                            title: song.title?.text || song.title,
                            artist: song.authors?.map(a=>a.name).join(', ') || '',
                            cover: song.thumbnails?.[0]?.url || song.thumbnail?.[0]?.url || res.header?.thumbnails?.[0]?.url || res.thumbnails?.[0]?.url
                        })).filter(s=>s.id) || [],
                        sections: otherSections
                    };
                }
                callback({ success: true, data });
            } catch (err) {
                callback({ success: false, error: err.message });
            }
        }
    });
});

async function checkForUpdates() {
    try {
        const localVersion = require('./package.json').version;
        // Connects to a standard update URL (the user's future git repo)
        const request = electronNet.request('https://raw.githubusercontent.com/EddizEge/yt-music-connect/main/version.json');
        
        request.on('response', (response) => {
            let body = '';
            response.on('data', (chunk) => {
                body += chunk;
            });
            response.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    if (data.version && data.version !== localVersion) {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'Update Available',
                            message: `A new update (${data.version}) is available!`,
                            detail: `Notes: ${data.notes || 'Performance fixes'}\n\nTo update, run 'update.bat' (if you installed the full folder) or download the latest .exe from: https://github.com/EddizEge/yt-music-connect/releases`,
                            buttons: ['Close']
                        });
                    }
                } catch(e) {}
            });
        });
        request.on('error', () => {});
        request.end();
    } catch (e) {}
}
