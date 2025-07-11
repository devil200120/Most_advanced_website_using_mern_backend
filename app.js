const path = require('path');
const express = require('express');

const app = express();

// ...existing middleware and route setups...

// CRITICAL: Add static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Enable detailed logging for static files in development
if (process.env.NODE_ENV === 'development') {
  app.use('/uploads', (req, res, next) => {
    console.log('Static file request:', req.path);
    next();
  });
}

// Add this before your routes
app.use('/uploads/avatars', express.static(path.join(__dirname, 'uploads', 'avatars')));

// ...existing code for starting the server, etc...

module.exports = app;