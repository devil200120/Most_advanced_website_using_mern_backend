// File: c:\Users\KIIT0001\Desktop\exam_site\backend\server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cron = require('node-cron');
const parentRoutes = require('./routes/parent');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const examRoutes = require('./routes/exams');
const questionRoutes = require('./routes/questions');
const submissionRoutes = require('./routes/submissions');
const paymentRoutes = require('./routes/payments');
const notificationRoutes = require('./routes/notifications');
const reportRoutes = require('./routes/reports');
const settingsRoutes = require('./routes/settings');
const dashboardRoutes = require('./routes/dashboard');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

// Initialize express app
const app = express();
const server = createServer(app);

// Define allowed origins for CORS
const allowedOrigins = [
  'http://localhost:3000',
  'https://aehtri.com',
  'https://www.aehtri.com'
];

// Add environment-specific origins
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

// Socket.io setup with proper CORS
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrc: ["'self'", "https:"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https:"],
      connectSrc: ["'self'", "https:"],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      childSrc: ["'self'"],
      frameSrc: ["'self'"],
      workerSrc: ["'self'"],
      manifestSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: []
    }
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// CORS configuration with multiple origins support
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}));

// Middleware
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS configuration for static files
app.use('/uploads', cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept']
}));

app.use('/api/uploads', cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept']
}));

// Static file serving
app.use('/uploads', express.static('uploads'));
app.use('/api/uploads', express.static('uploads'));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/exam_management', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  logger.info('Connected to MongoDB');
})
.catch((error) => {
  logger.error('MongoDB connection error:', error);
  process.exit(1);
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-exam', (examId) => {
    socket.join(`exam-${examId}`);
    console.log(`User joined exam room: exam-${examId}`);
  });
  
  socket.on('exam-started', (data) => {
    socket.to(`exam-${data.examId}`).emit('exam-started', data);
  });
  
  socket.on('time-warning', (data) => {
    socket.to(`exam-${data.examId}`).emit('time-warning', data);
  });
  
  socket.on('exam-submitted', (data) => {
    socket.to(`exam-${data.examId}`).emit('exam-submitted', data);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/parent', parentRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    allowedOrigins: allowedOrigins
  });
});

// Test endpoint to verify server is running
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running properly',
    timestamp: new Date().toISOString(),
    allowedOrigins: allowedOrigins,
    routes: [
      '/api/auth',
      '/api/users', 
      '/api/exams',
      '/api/questions',
      '/api/submissions',
      '/api/payments',
      '/api/notifications',
      '/api/reports',
      '/api/settings',
      '/api/dashboard',
      '/api/parent'
    ]
  });
});

// Cron jobs for automated tasks
const examReminderJob = cron.schedule('0 0 * * *', async () => {
  // Send exam reminders
  console.log('Running exam reminder job...');
  // Implementation for sending exam reminders
}, {
  scheduled: false
});

const cleanupJob = cron.schedule('0 2 * * *', async () => {
  // Cleanup old files and logs
  console.log('Running cleanup job...');
  // Implementation for cleanup tasks
}, {
  scheduled: false
});

// Start cron jobs
examReminderJob.start();
cleanupJob.start();

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    requestedUrl: req.originalUrl,
    method: req.method
  });
});

// Global error handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  console.log(`Server running on port ${PORT}`);
  console.log(`Dashboard routes available at: http://localhost:${PORT}/api/dashboard`);
  console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
});

module.exports = { app, io };
