const https = require('https');
const fs = require('fs');
const path = require('path');

const iconUrl = 'https://raw.githubusercontent.com/th-ch/youtube-music/master/assets/icon.png';
const buildDir = path.join(__dirname, 'desktop-app', 'build');
const dest = path.join(buildDir, 'icon.png');

if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
}

console.log('Downloading icon from:', iconUrl);
const file = fs.createWriteStream(dest);

https.get(iconUrl, (response) => {
    if (response.statusCode !== 200) {
        console.error(`Failed to download icon: ${response.statusCode}`);
        return;
    }
    response.pipe(file);
    file.on('finish', () => {
        file.close();
        console.log('Icon downloaded successfully to:', dest);
    });
}).on('error', (err) => {
    fs.unlink(dest, () => {});
    console.error('Error downloading icon:', err.message);
});
