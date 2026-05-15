const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../utils/cloudinary');

// Configure Cloudinary storage for resumes
const resumeStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Allowed file types
    const allowedFormats = ['pdf', 'doc', 'docx'];
    const fileExtension = file.originalname.split('.').pop().toLowerCase();
    
    if (!allowedFormats.includes(fileExtension)) {
      throw new Error('Invalid file format. Only PDF, DOC, and DOCX are allowed.');
    }
    
    return {
      folder: 'resumes',
      allowed_formats: allowedFormats,
      resource_type: 'raw',
      public_id: `${Date.now()}_${req.userId}_${file.originalname.split('.')[0]}`,
      use_filename: false,
      unique_filename: true
    };
  }
});

// Configure Cloudinary storage for company logos
const logoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const allowedFormats = ['jpg', 'jpeg', 'png', 'svg', 'webp'];
    const fileExtension = file.originalname.split('.').pop().toLowerCase();
    
    if (!allowedFormats.includes(fileExtension)) {
      throw new Error('Invalid file format. Only JPG, PNG, SVG, and WEBP are allowed.');
    }
    
    return {
      folder: 'company-logos',
      allowed_formats: allowedFormats,
      resource_type: 'image',
      public_id: `${Date.now()}_${req.userId}_logo`,
      transformation: [{ width: 200, height: 200, crop: 'limit' }]
    };
  }
});

// Configure Cloudinary storage for candidate photos
const photoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const allowedFormats = ['jpg', 'jpeg', 'png'];
    const fileExtension = file.originalname.split('.').pop().toLowerCase();
    
    if (!allowedFormats.includes(fileExtension)) {
      throw new Error('Invalid file format. Only JPG and PNG are allowed.');
    }
    
    return {
      folder: 'candidate-photos',
      allowed_formats: allowedFormats,
      resource_type: 'image',
      public_id: `${Date.now()}_${req.userId}_photo`,
      transformation: [{ width: 400, height: 400, crop: 'thumb', gravity: 'face' }]
    };
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  const allowedMimes = {
    'resume': ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    'image': ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']
  };
  
  const type = req.uploadType || 'resume';
  const allowed = allowedMimes[type] || allowedMimes.resume;
  
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed: ${allowed.join(', ')}`), false);
  }
};

// Create multer instances with different configurations
const uploadResume = multer({
  storage: resumeStorage,
  fileFilter: (req, file, cb) => {
    req.uploadType = 'resume';
    return fileFilter(req, file, cb);
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  }
});

const uploadLogo = multer({
  storage: logoStorage,
  fileFilter: (req, file, cb) => {
    req.uploadType = 'image';
    return fileFilter(req, file, cb);
  },
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
    files: 1
  }
});

const uploadPhoto = multer({
  storage: photoStorage,
  fileFilter: (req, file, cb) => {
    req.uploadType = 'image';
    return fileFilter(req, file, cb);
  },
  limits: {
    fileSize: 1 * 1024 * 1024, // 1MB limit
    files: 1
  }
});

// Memory storage for temporary processing (before cloud upload)
const memoryStorage = multer.memoryStorage();

const uploadToMemory = multer({
  storage: memoryStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

// Error handler for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'FILE_TOO_LARGE') {
      return res.status(400).json({ error: 'File too large. Max size 5MB.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Only one file allowed.' });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Unexpected field name.' });
    }
    return res.status(400).json({ error: err.message });
  }
  
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  
  next();
};

// Middleware to validate file presence
const validateFile = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }
  next();
};

// Middleware to scan for viruses (placeholder - integrate with ClamAV or similar)
const scanForViruses = async (req, res, next) => {
  // In production, integrate with virus scanning service
  // For now, just pass through
  next();
};

// Configure multer for multiple file uploads (if needed)
const uploadMultipleResumes = multer({
  storage: resumeStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5
  }
}).array('resumes', 5);

// Export all configurations
module.exports = {
  uploadResume: uploadResume.single('resume'),
  uploadLogo: uploadLogo.single('logo'),
  uploadPhoto: uploadPhoto.single('photo'),
  uploadToMemory: uploadToMemory.single('file'),
  uploadMultipleResumes,
  handleMulterError,
  validateFile,
  scanForViruses
};