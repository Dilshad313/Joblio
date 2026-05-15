const express = require('express');
const router = express.Router();
const { auth, candidateOnly } = require('../middleware/auth');
const upload = require('../middleware/multer');
const User = require('../models/User');
const cloudinary = require('../utils/cloudinary');

// @route   POST /api/upload/resume
// @desc    Upload candidate's resume (PDF, DOC, DOCX)
// @access  Private (Candidate only)
router.post('/resume', auth, candidateOnly, upload.uploadResume, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Update user with resume URL
    const user = await User.findByIdAndUpdate(
      req.userId,
      { 
        resumeUrl: req.file.path,
        updatedAt: Date.now()
      },
      { new: true }
    );
    
    res.json({
      success: true,
      message: 'Resume uploaded successfully',
      resumeUrl: user.resumeUrl,
      fileInfo: {
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/upload/resume
// @desc    Delete candidate's resume
// @access  Private (Candidate only)
router.delete('/resume', auth, candidateOnly, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user.resumeUrl) {
      return res.status(404).json({ error: 'No resume found' });
    }
    
    // Extract public ID from Cloudinary URL
    const publicId = user.resumeUrl.split('/').slice(-2).join('/').split('.')[0];
    
    // Delete from Cloudinary
    if (publicId) {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
    }
    
    // Update user
    user.resumeUrl = null;
    await user.save();
    
    res.json({ success: true, message: 'Resume deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/upload/company-logo
// @desc    Upload company logo (Employer only)
// @access  Private (Employer only)
router.post('/company-logo', auth, async (req, res) => {
  try {
    // This would be implemented similarly to resume upload
    // For employer company profiles (extend User model with company fields)
    res.status(501).json({ error: 'Not implemented yet' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/upload/resume-status
// @desc    Check if candidate has uploaded resume
// @access  Private (Candidate only)
router.get('/resume-status', auth, candidateOnly, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    res.json({
      hasResume: !!user.resumeUrl,
      resumeUrl: user.resumeUrl || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;