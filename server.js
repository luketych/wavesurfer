const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// Enable CORS for all routes
app.use(cors({
    origin: 'http://localhost:5175', // Vite's default port
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));

// Ensure the clips directory exists
const clipsDir = path.join(__dirname, 'public', 'clips');
if (!fs.existsSync(clipsDir)) {
    fs.mkdirSync(clipsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, clipsDir);
    },
    filename: function (req, file, cb) {
        // Generate a unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Handle file upload
app.post('/api/clips', upload.single('audio'), (req, res) => {
    console.log('Received file upload request');
    
    if (!req.file) {
        console.error('No file uploaded');
        return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('File uploaded successfully:', req.file);
    res.json({ 
        message: 'File uploaded successfully',
        clipPath: `/clips/${req.file.filename}`
    });
});

// Handle file deletion
app.delete('/api/clips/:filename', (req, res) => {
    console.log('Received delete request for:', req.params.filename);
    
    const filepath = path.join(clipsDir, req.params.filename);
    
    if (!fs.existsSync(filepath)) {
        console.error('File not found:', filepath);
        return res.status(404).json({ error: 'File not found' });
    }

    fs.unlink(filepath, (err) => {
        if (err) {
            console.error('Error deleting file:', err);
            return res.status(500).json({ error: 'Error deleting file' });
        }
        console.log('File deleted successfully:', filepath);
        res.json({ message: 'File deleted successfully' });
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`CORS enabled for http://localhost:5175`);
}); 