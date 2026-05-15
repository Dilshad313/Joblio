const jwt = require('jsonwebtoken');

// Main authentication middleware
const auth = async (req, res, next) => {
  try {
    // Get token from cookie or Authorization header
    let token = req.cookies.token;
    
    if (!token && req.header('Authorization')) {
      token = req.header('Authorization').replace('Bearer ', '');
    }
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user info to request
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    res.status(401).json({ 
      error: 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }
};

// Middleware to check if user is an employer
const employerOnly = (req, res, next) => {
  if (!req.userRole || req.userRole !== 'employer') {
    return res.status(403).json({ 
      error: 'Access denied. Employer privileges required.',
      code: 'EMPLOYER_ONLY'
    });
  }
  next();
};

// Middleware to check if user is a candidate
const candidateOnly = (req, res, next) => {
  if (!req.userRole || req.userRole !== 'candidate') {
    return res.status(403).json({ 
      error: 'Access denied. Candidate privileges required.',
      code: 'CANDIDATE_ONLY'
    });
  }
  next();
};

// Optional auth (doesn't fail if no token, just sets user to null)
const optionalAuth = async (req, res, next) => {
  try {
    let token = req.cookies.token;
    
    if (!token && req.header('Authorization')) {
      token = req.header('Authorization').replace('Bearer ', '');
    }
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = decoded.userId;
      req.userRole = decoded.role;
    }
    
    next();
  } catch (error) {
    // Continue without user info
    req.userId = null;
    req.userRole = null;
    next();
  }
};

// Middleware to check resource ownership
const checkOwnership = (resourceType) => {
  return async (req, res, next) => {
    try {
      const { id } = req.params;
      let isOwner = false;
      
      if (resourceType === 'job') {
        const Job = require('../models/Job');
        const job = await Job.findById(id);
        if (job && job.employer.toString() === req.userId) {
          isOwner = true;
        }
      }
      
      if (resourceType === 'application') {
        const Application = require('../models/Application');
        const application = await Application.findById(id);
        if (application && application.candidate.toString() === req.userId) {
          isOwner = true;
        }
      }
      
      if (!isOwner) {
        return res.status(403).json({ 
          error: 'Access denied. Resource ownership required.',
          code: 'NOT_OWNER'
        });
      }
      
      next();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
};

// Rate limiting middleware (simple implementation)
const rateLimit = (maxRequests, windowMs) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const key = req.userId || req.ip;
    const now = Date.now();
    
    if (!requests.has(key)) {
      requests.set(key, []);
    }
    
    const timestamps = requests.get(key).filter(t => now - t < windowMs);
    
    if (timestamps.length >= maxRequests) {
      return res.status(429).json({ 
        error: 'Too many requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    timestamps.push(now);
    requests.set(key, timestamps);
    next();
  };
};

// Validation middleware for common patterns
const validate = {
  email: (req, res, next) => {
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    const { email } = req.body;
    
    if (email && !emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    next();
  },
  
  password: (req, res, next) => {
    const { password } = req.body;
    
    if (password && password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    next();
  },
  
  jobFields: (req, res, next) => {
    const { title, description, location, salary } = req.body;
    const errors = [];
    
    if (title && title.length < 3) {
      errors.push('Title must be at least 3 characters');
    }
    
    if (description && description.length < 20) {
      errors.push('Description must be at least 20 characters');
    }
    
    if (salary && salary < 0) {
      errors.push('Salary cannot be negative');
    }
    
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }
    next();
  },
  
  applicationStatus: (req, res, next) => {
    const { status } = req.body;
    const validStatuses = ['applied', 'shortlisted', 'rejected', 'hired', 'interviewing'];
    
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status',
        validStatuses
      });
    }
    next();
  }
};

// Logging middleware for debugging
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
};

// Error handling middleware (to be used as last middleware)
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  
  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(400).json({ error: `${field} already exists` });
  }
  
  // JWT errors handled in auth middleware
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  // Default error
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};

module.exports = {
  auth,
  employerOnly,
  candidateOnly,
  optionalAuth,
  checkOwnership,
  rateLimit,
  validate,
  requestLogger,
  errorHandler
};