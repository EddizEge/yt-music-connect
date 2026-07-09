const { contextBridge, ipcRenderer, webFrame } = require('electron');

let volumeRestored = false;
let lastVideoSrc = '';

// Setup observer to extract song information and send it to main process
// Start interval immediately to avoid race conditions with window load event
setInterval(() => {
    // Enforce connection overlay presence (YT Music's SPA framework can occasionally wipe the body)
    if (document.body && !document.getElementById('ytm-connect-float-btn')) {
        try {
            injectConnectionOverlay();
        } catch (e) {}
    }
        const titleElement = document.querySelector('.title.ytmusic-player-bar');
        const artistElement = document.querySelector('.byline.style-scope.ytmusic-player-bar');
        const imgElement = document.querySelector('#layout > ytmusic-player-bar img');
        const videoElement = document.querySelector('video');

        if (videoElement) {
            const currentSrc = videoElement.currentSrc || videoElement.src;
            if (currentSrc && currentSrc !== lastVideoSrc) {
                lastVideoSrc = currentSrc;
                volumeRestored = false; // Trigger restoration for the new song!
                
                // Force volume repeatedly during the first 2 seconds of the track
                // to override YouTube Music's asynchronous player engine auto-resets.
                for (let delay of [0, 200, 500, 1000, 2000]) {
                    setTimeout(() => {
                        const lastVol = ipcRenderer.sendSync('get-last-volume-sync');
                        if (lastVol !== undefined && lastVol !== null && videoElement) {
                            videoElement.volume = lastVol / 100;
                        }
                    }, delay);
                }
            }
        }

        if (videoElement && !volumeRestored) {
            const lastVol = ipcRenderer.sendSync('get-last-volume-sync');
            if (lastVol !== undefined && lastVol !== null) {
                videoElement.volume = lastVol / 100;
            }
            volumeRestored = true;
        }

        if (titleElement && videoElement) {
            const title = titleElement.textContent;
            const artist = artistElement ? artistElement.textContent : '';
            const isPlaying = !videoElement.paused;
            const currentTime = videoElement.currentTime;
            const duration = videoElement.duration;
            const cover = imgElement ? imgElement.src : '';
            
            const panel = document.querySelector('ytmusic-playlist-panel-renderer');
            const queueElements = panel ? panel.querySelectorAll('ytmusic-player-queue-item') : [];
            const queueItems = Array.from(queueElements).slice(0, 20).map(item => ({
                title: item.querySelector('.song-title')?.textContent || '',
                artist: item.querySelector('.byline')?.textContent || '',
                isPlaying: item.hasAttribute('play-indicator') || item.getAttribute('play-button-state') === 'playing'
            })).filter(i => i.title);

            ipcRenderer.send('media-info', {
                title,
                artist,
                isPlaying,
                currentTime,
                duration,
                cover,
                volume: videoElement.volume * 100,
                queue: queueItems
            });
        }
    }, 1000);

    // Listen for commands from main process to control the web page
    ipcRenderer.on('command', (event, command) => {
        if (command === 'playPause') {
            const playButton = document.querySelector('#play-pause-button');
            if (playButton) playButton.click();
        } else if (command === 'next') {
            const nextButton = document.querySelector('.next-button');
            if (nextButton) nextButton.click();
        } else if (command === 'previous') {
            const prevButton = document.querySelector('.previous-button');
            if (prevButton) prevButton.click();
        } else if (command.startsWith('volume:')) {
            const vol = command.split(':')[1];
            const videoElement = document.querySelector('video');
            if(videoElement) videoElement.volume = parseInt(vol) / 100;
        } else if (command.startsWith('playVideo:')) {
            const parts = command.split(':');
            const videoId = parts[1];
            const listId = parts[2];
            
            if (listId && (listId.startsWith('VL') || listId.startsWith('PL') || listId.startsWith('RD') || listId.startsWith('OL'))) {
                window.location.href = `https://music.youtube.com/watch?v=${videoId}&list=${listId.replace('VL', '')}`;
            } else {
                window.location.href = `https://music.youtube.com/watch?v=${videoId}`;
            }
        } else if (command.startsWith('playNext:')) {
                const videoId = command.split(':')[1];
                addVideoToQueue(videoId, true);
            } else if (command.startsWith('addToQueue:')) {
                const videoId = command.split(':')[1];
                addVideoToQueue(videoId, false);
            } else if (command === 'openProfile') {
                window.location.href = 'https://music.youtube.com/library';
            }
    });

function addVideoToQueue(videoId, playNext = false) {
    console.log(`addVideoToQueue: executing main world queue injection for videoId=${videoId}, playNext=${playNext}`);
    const insertPosition = playNext ? 'INSERT_AFTER_CURRENT_VIDEO' : 'INSERT_AT_END';
    
    const code = `
        (function() {
            const app = document.querySelector('ytmusic-app');
            if (!app) {
                console.error('Main world: ytmusic-app element not found');
                return;
            }
            
            const videoId = "${videoId}";
            const insertPosition = "${insertPosition}";
            const isPlaylist = videoId.startsWith('PL') || videoId.startsWith('VL') || videoId.startsWith('MPREb_') || videoId.length > 15;
            const cleanId = videoId.startsWith('VL') ? videoId.slice(2) : videoId;
            
            console.log('Main world queue command videoId:', videoId, 'isPlaylist:', isPlaylist, 'position:', insertPosition);
            
            // Method 1: Redux Action ADD_ITEMS_TO_QUEUE
            try {
                if (app.store && app.store.dispatch) {
                    const payload = isPlaylist ? {
                        playlistId: cleanId,
                        queueInsertPosition: insertPosition
                    } : {
                        videoIds: [videoId],
                        queueInsertPosition: insertPosition
                    };
                    app.store.dispatch({
                        type: 'ADD_ITEMS_TO_QUEUE',
                        payload: payload
                    });
                    console.log('Main world: Queued via ADD_ITEMS_TO_QUEUE');
                    return;
                }
            } catch(e) {
                console.error('Main world ADD_ITEMS_TO_QUEUE error:', e.message);
            }
            
            // Method 2: Redux Action QUEUE_ADD_ITEMS
            try {
                if (app.store && app.store.dispatch) {
                    const payload = isPlaylist ? {
                        playlistId: cleanId,
                        queueInsertPosition: insertPosition
                    } : {
                        items: [{ videoId }],
                        queueInsertPosition: insertPosition
                    };
                    app.store.dispatch({
                        type: 'QUEUE_ADD_ITEMS',
                        payload: payload
                    });
                    console.log('Main world: Queued via QUEUE_ADD_ITEMS');
                    return;
                }
            } catch(e) {
                console.error('Main world QUEUE_ADD_ITEMS error:', e.message);
            }

            // Method 3: Redux Action ADD_PLAYBACK_ITEMS
            try {
                if (app.store && app.store.dispatch) {
                    const payload = isPlaylist ? {
                        playlistId: cleanId,
                        queueInsertPosition: insertPosition
                    } : {
                        videoIds: [videoId],
                        queueInsertPosition: insertPosition
                    };
                    app.store.dispatch({
                        type: 'ADD_PLAYBACK_ITEMS',
                        payload: payload
                    });
                    console.log('Main world: Queued via ADD_PLAYBACK_ITEMS');
                    return;
                }
            } catch(e) {
                console.error('Main world ADD_PLAYBACK_ITEMS error:', e.message);
            }
            
            // Method 4: app.queue.add
            try {
                if (app.queue && typeof app.queue.add === 'function') {
                    app.queue.add({ videoId, insertPosition });
                    console.log('Main world: Queued via app.queue.add');
                    return;
                }
            } catch(e) {
                console.error('Main world app.queue.add error:', e.message);
            }
            
            // Method 5: playerApi_ of ytmusic-player-bar
            try {
                const playerBar = document.querySelector('ytmusic-player-bar');
                const playerApi = playerBar ? playerBar.playerApi_ : null;
                if (playerApi) {
                    if (typeof playerApi.addToPlaylist === 'function') {
                        playerApi.addToPlaylist(videoId);
                        console.log('Main world: Queued via playerApi.addToPlaylist');
                        return;
                    } else if (typeof playerApi.enqueueVideo === 'function') {
                        playerApi.enqueueVideo(videoId);
                        console.log('Main world: Queued via playerApi.enqueueVideo');
                        return;
                    } else if (typeof playerApi.cueVideoById === 'function' && ${playNext}) {
                        playerApi.cueVideoById(videoId);
                        console.log('Main world: Cued via playerApi.cueVideoById');
                        return;
                    }
                }
            } catch(e) {
                console.error('Main world playerApi error:', e.message);
            }

            // Method 6: HTML5 player API addToPlaylist
            try {
                const player = document.getElementById('movie_player');
                if (player) {
                    if (typeof player.addToPlaylist === 'function') {
                        player.addToPlaylist(videoId);
                        console.log('Main world: Queued via player.addToPlaylist');
                        return;
                    } else if (typeof player.enqueueVideo === 'function') {
                        player.enqueueVideo(videoId);
                        console.log('Main world: Queued via player.enqueueVideo');
                        return;
                    }
                }
            } catch(e) {
                console.error('Main world movie_player error:', e.message);
            }
            
            console.error('Main world: All queueing methods failed.');
        })()
    `;
    webFrame.executeJavaScript(code);
}

function injectConnectionOverlay() {
    if (document.getElementById('ytm-connect-float-btn')) return;
    
    const connectionUrl = ipcRenderer.sendSync('get-connection-url-sync');
    
    // Create the floating button
    const floatBtn = document.createElement('div');
    floatBtn.id = 'ytm-connect-float-btn';
    floatBtn.title = 'Show Connection Info & QR Code';
    floatBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="5" height="5" x="3" y="3" rx="1"/>
            <rect width="5" height="5" x="16" y="3" rx="1"/>
            <rect width="5" height="5" x="3" y="16" rx="1"/>
            <path d="M21 16h-3a2 2 0 0 0-2 2v3"/>
            <path d="M21 21v.01"/>
            <path d="M12 7v3a2 2 0 0 1-2 2H7"/>
            <path d="M3 12h.01"/>
            <path d="M12 3h.01"/>
            <path d="M12 16v.01"/>
            <path d="M16 12h1"/>
            <path d="M21 12v.01"/>
            <path d="M12 21v-1"/>
        </svg>
    `;
    
    // Create the modal container
    const modal = document.createElement('div');
    modal.id = 'ytm-connect-modal';
    modal.innerHTML = `
        <div class="ytm-modal-content">
            <span class="ytm-close-btn">&times;</span>
            <h2>YouTube Music Connect</h2>
            <p>Scan this QR code with your mobile phone to connect instantly:</p>
            <div class="ytm-qr-container">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=030303&data=${encodeURIComponent(connectionUrl)}" alt="QR Code" />
            </div>
            <div style="font-size: 13px; color: #aaa; margin-bottom: 12px;">Or open this URL on your phone:</div>
            <div class="ytm-url-container">
                <input type="text" value="${connectionUrl}" readonly id="ytm-url-input" />
                <button id="ytm-copy-btn">Copy</button>
            </div>
            <p style="font-size: 11px; color: #888; margin-top: 12px; margin-bottom: 0;">Make sure both devices are on the SAME network (Wi-Fi).</p>
            
            <div style="margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
                <button id="ytm-check-update-btn">Check for Updates</button>
                <div id="ytm-update-status" style="font-size: 12px; color: #aaa; margin-top: 6px;"></div>
            </div>
            
            <div style="font-size: 11px; color: #777; margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px;">
                Developed by Ediz Ege Mercan
            </div>
        </div>
    `;
    
    // Inject styles
    const styles = document.createElement('style');
    styles.innerHTML = `
        #ytm-connect-float-btn {
            position: fixed;
            bottom: 105px;
            left: 25px;
            width: 45px;
            height: 45px;
            background-color: #ff0000;
            color: #ffffff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            cursor: pointer;
            z-index: 99999;
            transition: all 0.3s ease;
        }
        #ytm-connect-float-btn:hover {
            transform: scale(1.1);
            background-color: #cc0000;
        }
        #ytm-connect-modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(5px);
            z-index: 999999;
            justify-content: center;
            align-items: center;
            font-family: 'Roboto', sans-serif;
        }
        .ytm-modal-content {
            background-color: #1f1f1f;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px;
            padding: 25px;
            width: 350px;
            text-align: center;
            color: #ffffff;
            position: relative;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .ytm-close-btn {
            position: absolute;
            top: 15px;
            right: 20px;
            font-size: 28px;
            font-weight: bold;
            color: #aaa;
            cursor: pointer;
            transition: color 0.2s;
        }
        .ytm-close-btn:hover {
            color: #ffffff;
        }
        .ytm-modal-content h2 {
            margin-bottom: 10px;
            font-size: 20px;
            font-weight: bold;
            color: #ff0000;
        }
        .ytm-modal-content p {
            font-size: 13px;
            color: #ccc;
            margin-bottom: 20px;
        }
        .ytm-qr-container {
            background-color: #ffffff;
            padding: 10px;
            border-radius: 8px;
            display: inline-block;
            margin-bottom: 20px;
        }
        .ytm-qr-container img {
            display: block;
        }
        .ytm-url-container {
            display: flex;
            background-color: #2b2b2b;
            border-radius: 6px;
            padding: 4px;
            border: 1px solid rgba(255,255,255,0.1);
            align-items: center;
        }
        #ytm-url-input {
            flex: 1;
            background: transparent;
            border: none;
            color: #fff;
            padding: 8px;
            font-size: 13px;
            outline: none;
            text-align: left;
        }
        #ytm-copy-btn {
            background-color: #ff0000;
            color: #fff;
            border: none;
            border-radius: 4px;
            padding: 8px 16px;
            font-size: 12px;
            cursor: pointer;
            transition: background 0.2s;
        }
        #ytm-copy-btn:hover {
            background-color: #cc0000;
        }
        #ytm-check-update-btn {
            background-color: #333;
            color: #fff;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 4px;
            padding: 8px 16px;
            font-size: 12px;
            cursor: pointer;
            width: 100%;
            transition: background 0.2s;
        }
        #ytm-check-update-btn:hover {
            background-color: #444;
        }
    `;
    
    document.head.appendChild(styles);
    document.body.appendChild(floatBtn);
    document.body.appendChild(modal);
    
    // Event listeners
    floatBtn.addEventListener('click', () => {
        modal.style.display = 'flex';
    });
    
    const closeBtn = modal.querySelector('.ytm-close-btn');
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    const copyBtn = modal.querySelector('#ytm-copy-btn');
    const urlInput = modal.querySelector('#ytm-url-input');
    copyBtn.addEventListener('click', () => {
        urlInput.select();
        document.execCommand('copy');
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyBtn.textContent = 'Copy';
        }, 2000);
    });

    // Check for updates
    const checkUpdateBtn = modal.querySelector('#ytm-check-update-btn');
    const updateStatus = modal.querySelector('#ytm-update-status');
    
    checkUpdateBtn.addEventListener('click', () => {
        updateStatus.textContent = 'Checking for updates...';
        fetch('https://raw.githubusercontent.com/EddizEge/yt-music-connect/main/version.json')
            .then(res => res.json())
            .then(data => {
                const localVer = '1.0.1'; // local version
                if (data.version && data.version !== localVer) {
                    updateStatus.innerHTML = `
                        <span style="color: #ff3333; font-weight: bold;">New version (${data.version}) available!</span><br/>
                        <button id="ytm-go-release-btn" style="margin-top: 8px; background-color: #ff0000; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Download Update</button>
                    `;
                    modal.querySelector('#ytm-go-release-btn').addEventListener('click', () => {
                        ipcRenderer.send('open-external-url', 'https://github.com/EddizEge/yt-music-connect/releases');
                    });
                } else {
                    updateStatus.innerHTML = `<span style="color: #4cd964;">App is up to date (v${localVer})</span>`;
                }
            })
            .catch(() => {
                updateStatus.textContent = 'Failed to check for updates.';
            });
    });
}
