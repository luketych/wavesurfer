// savesurfer.js - Audio clipping application using WaveSurfer.js

import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';

// Add API base URL
const API_BASE_URL = 'http://localhost:3000';

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
const playPauseButton = document.getElementById('playPause');
const clipButton = document.getElementById('clip');
const saveButton = document.getElementById('save');
const clipList = document.getElementById('clipList');

let currentRegion = null;
let isPlaying = false;
let timeUpdateHandler = null;
let clipCounter = 0;

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
    if (timeUpdateHandler) {
        wavesurfer.un('timeupdate', timeUpdateHandler);
        timeUpdateHandler = null;
    }
});

// Handle play/pause button click
playPauseButton.addEventListener('click', () => {
    if (wavesurfer.isPlaying()) {
        wavesurfer.pause();
        playPauseButton.textContent = 'Play';
    } else {
        wavesurfer.play();
        playPauseButton.textContent = 'Pause';
    }
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
    playPauseButton.textContent = 'Pause';
    
    // Handle playback reaching the end of the region
    if (timeUpdateHandler) {
        wavesurfer.un('timeupdate', timeUpdateHandler);
    }
    
    timeUpdateHandler = () => {
        if (wavesurfer.getCurrentTime() >= currentRegion.end) {
            wavesurfer.stop();
            wavesurfer.un('timeupdate', timeUpdateHandler);
            timeUpdateHandler = null;
            playPauseButton.textContent = 'Play';
        }
    };
    
    wavesurfer.on('timeupdate', timeUpdateHandler);
});

// Function to add a clip to the UI
function addClipToUI(clipPath) {
    const li = document.createElement('li');
    li.className = 'clip-item';
    
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = clipPath;
    
    const actions = document.createElement('div');
    actions.className = 'clip-actions';
    
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.onclick = async () => {
        try {
            const filename = clipPath.split('/').pop();
            console.log('Deleting file:', filename);
            
            const response = await fetch(`${API_BASE_URL}/api/clips/${filename}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete clip');
            }
            
            li.remove();
        } catch (error) {
            console.error('Error deleting clip:', error);
            alert('Error deleting clip. Please try again.');
        }
    };
    
    actions.appendChild(deleteButton);
    li.appendChild(audio);
    li.appendChild(actions);
    clipList.appendChild(li);
}

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
        
        // Create FormData and append the blob
        const formData = new FormData();
        formData.append('audio', blob, `clip_${clipCounter++}.mp3`);
        
        // Send the file to the server
        console.log('Sending file to server...');
        const response = await fetch(`${API_BASE_URL}/api/clips`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save clip');
        }
        
        const result = await response.json();
        console.log('Server response:', result);
        
        // Add the clip to the UI with the full URL
        addClipToUI(`${API_BASE_URL}${result.clipPath}`);
        
        alert('Clip saved successfully!');
    } catch (error) {
        console.error('Error saving audio:', error);
        alert(`Error saving audio: ${error.message}`);
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
