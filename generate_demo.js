const fs = require('fs');
const { exec } = require('child_process');

// Generate a 10-second test audio file using ffmpeg
const command = 'ffmpeg -f lavfi -i "sine=frequency=440:duration=10" -acodec libmp3lame demo.mp3';

exec(command, (error, stdout, stderr) => {
    if (error) {
        console.error(`Error: ${error}`);
        return;
    }
    console.log('Demo audio file generated successfully!');
}); 