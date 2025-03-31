// savesurfer.js - Audio clipping application using WaveSurfer.js

import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';

// Initialize WaveSurfer
const wavesurfer = WaveSurfer.create({
    container: '#waveform',
    waveColor: '#4F4A85',
    progressColor: '#383351',
    height: 200,
    barWidth: 2,
    barRadius: 3,
    cursorWidth: 1,
    cursorColor: '#333',
    barGap: 3
});

// Initialize the Regions plugin
const wsRegions = wavesurfer.registerPlugin(RegionsPlugin.create());

// Enable drag selection
wsRegions.enableDragSelection({
    color: 'rgba(255, 0, 0, 0.1)',
    drag: true,
    resize: true,
    handleStyle: {
        left: {
            backgroundColor: '#00ff00',
            width: '2px'
        },
        right: {
            backgroundColor: '#ff0000',
            width: '2px'
        }
    }
});

// Load demo audio file
wavesurfer.load('demo.mp3');

// Get DOM elements
const audioFileSelect = document.getElementById('audioFile');
const clipButton = document.getElementById('clip');
const saveButton = document.getElementById('save');

let currentRegion = null;

// Handle audio file selection
audioFileSelect.addEventListener('change', (e) => {
    const file = e.target.value;
    wavesurfer.load(file);
});

// Handle region creation
wsRegions.on('region-created', (region) => {
    // Remove any existing region
    if (currentRegion) {
        currentRegion.remove();
    }
    currentRegion = region;
});

// Handle region updates
wsRegions.on('region-updated', (region) => {
    currentRegion = region;
});

// Handle region removal
wsRegions.on('region-removed', () => {
    currentRegion = null;
});

// Handle clip button click
clipButton.addEventListener('click', () => {
    if (!currentRegion) {
        alert('Please select a region to clip first');
        return;
    }
    
    // Stop any current playback
    wavesurfer.stop();
    
    // Set the current time to the start of the region
    wavesurfer.setTime(currentRegion.start);
    
    // Play the selected region
    wavesurfer.play();
    
    // Handle playback reaching the end of the region
    const handleTimeUpdate = () => {
        if (wavesurfer.getCurrentTime() >= currentRegion.end) {
            wavesurfer.stop();
            wavesurfer.un('timeupdate', handleTimeUpdate);
        }
    };
    
    wavesurfer.on('timeupdate', handleTimeUpdate);
    
    // Stop playing when region is removed
    wavesurfer.on('region-removed', () => {
        wavesurfer.stop();
        wavesurfer.un('timeupdate', handleTimeUpdate);
    });
});

// Handle save button click
saveButton.addEventListener('click', async () => {
    if (!currentRegion) {
        alert('Please select a region to clip first');
        return;
    }

    try {
        const startTime = currentRegion.start;
        const endTime = currentRegion.end;
        
        // Get the audio data for the selected region
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const sampleRate = audioContext.sampleRate;
        
        // Create a buffer for the selected region
        const duration = endTime - startTime;
        const buffer = audioContext.createBuffer(1, duration * sampleRate, sampleRate);
        
        // Get the audio data from the current audio element
        const audioElement = wavesurfer.getMediaElement();
        const audioBuffer = await audioContext.decodeAudioData(await fetch(audioElement.src).then(r => r.arrayBuffer()));
        
        // Copy the selected region to the new buffer
        const channelData = audioBuffer.getChannelData(0);
        const startSample = Math.floor(startTime * sampleRate);
        const endSample = Math.floor(endTime * sampleRate);
        const newChannelData = channelData.slice(startSample, endSample);
        buffer.copyToChannel(newChannelData, 0);
        
        // Create a WAV file from the buffer
        const wav = audioBufferToWav(buffer);
        const blob = new Blob([wav], { type: 'audio/wav' });
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'clipped_audio.wav';
        a.click();
        
        // Cleanup
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error saving audio:', error);
        alert('Error saving audio. Please try again.');
    }
});

// Helper function to convert AudioBuffer to WAV format
function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    const wav = new ArrayBuffer(44 + buffer.length * blockAlign);
    const view = new DataView(wav);
    
    // Write WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + buffer.length * blockAlign, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, buffer.length * blockAlign, true);
    
    // Write audio data
    const channelData = buffer.getChannelData(0);
    let offset = 44;
    for (let i = 0; i < channelData.length; i++) {
        const sample = Math.max(-1, Math.min(1, channelData[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
    }
    
    return wav;
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}
