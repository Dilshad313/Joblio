const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import database configuration
const { connectDB, disconnectDB } = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth');
const jobRoutes = require('./routes/jobs');
const applicationRoutes = require('./routes/applications');
const profileRoutes = require('./routes/profile');
const uploadRoutes = require('./routes/upload');

// Import middleware
const { errorHandler, requestLogger } = require('./middleware/auth');
const { handleMulterError } = require('./middleware/multer');

// Initialize express app
const app = express();

// ========================
// Security Middleware
// ========================

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      connectSrc: ["'self'", "https://api.cloudinary.com"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all routes
app.use('/api', limiter);

// Stricter rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: 'Too many authentication attempts, please try again later.',
});

// ========================
// Standard Middleware
// ========================

// Compression for better performance
app.use(compression());

// Logging in development
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Custom request logger
app.use(requestLogger);

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
};

app.use(cors(corsOptions));

// Parse JSON and urlencoded bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// ========================
// Static Files (if any)
// ========================
app.use('/uploads', express.static('uploads'));

// ========================
// Health Check Endpoints
// ========================

// Basic health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// Detailed health check with database status
app.get('/api/health', async (req, res) => {
  try {
    const dbHealth = await checkHealth();
    const connectionStatus = getConnectionStatus();
    
    res.status(200).json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      database: dbHealth,
      connection: connectionStatus,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Database statistics endpoint (protected, admin only)
app.get('/api/db-stats', async (req, res) => {
  // In production, add authentication check here
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  try {
    const stats = await getDatabaseStats();
    res.json({
      success: true,
      statistics: stats,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================
// API Routes
// ========================

// Public routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/upload', uploadRoutes);

// ========================
// Root endpoint
// ========================
app.get('/', (req, res) => {
  res.json({
    name: 'JobBoard API',
    version: '1.0.0',
    description: 'Job Board and Application Tracking Platform API',
    endpoints: {
      auth: '/api/auth',
      jobs: '/api/jobs',
      applications: '/api/applications',
      profile: '/api/profile',
      upload: '/api/upload',
      health: '/api/health',
    },
    documentation: 'https://github.com/yourusername/jobboard-mern',
  });
});

// ========================
// 404 Handler
// ========================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// ========================
// Error Handling Middleware
// ========================
app.use(handleMulterError);
app.use(errorHandler);

// ========================
// Uncaught Exception Handler
// ========================
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// ========================
// Unhandled Rejection Handler
// ========================
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Application continues running, but log the error
});

// ========================
// Graceful Shutdown
// ========================
const gracefulShutdown = async (signal) => {
  console.log(`\n📴 Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Close database connection
    const { disconnectDB } = require('./config/db');
    await disconnectDB();
    
    console.log('✅ Database connections closed');
    
    // Close server
    if (server) {
      server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ========================
// Start Server
// ========================
const PORT = process.env.PORT || 5000;
let server = null;

const startServer = async () => {
  try {
    // Initialize database connection
    await initDB();
    
    // Start listening
    server = app.listen(PORT, () => {
      console.log('\n=================================');
      console.log('🚀 JobBoard API Server Started');
      console.log('=================================');
      console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Port: ${PORT}`);
      console.log(`🌐 API URL: http://localhost:${PORT}/api`);
      console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
      console.log('=================================\n');
    });
    
    // Set timeout for server
    server.timeout = 120000; // 2 minutes
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

// Export for testing
module.exports = { app, server };