const { contextBridge, ipcRenderer } = require('electron');

let volumeRestored = false;
let lastVideoSrc = '';

// Setup observer to extract song information and send it to main process
window.addEventListener('load', () => {
    setInterval(() => {
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
            
            const queueItems = Array.from(document.querySelectorAll('ytmusic-player-queue-item')).slice(0, 20).map(item => ({
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
        }
    });
});
