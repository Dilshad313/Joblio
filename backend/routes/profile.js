const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Application = require('../models/Application');
const Job = require('../models/Job');
const bcrypt = require('bcryptjs');

// @route   GET /api/profile/me
// @desc    Get current user's profile
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user.getPublicProfile());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/profile/me
// @desc    Update current user's profile
// @access  Private
router.put('/me', auth, async (req, res) => {
  try {
    const allowedUpdates = ['name'];
    const updates = {};
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      { ...updates, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );
    
    res.json(user.getPublicProfile());
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   PUT /api/profile/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.userId).select('+password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    user.password = hashedPassword;
    await user.save();
    
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   GET /api/profile/dashboard-stats
// @desc    Get dashboard statistics based on user role
// @access  Private
router.get('/dashboard-stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (user.role === 'candidate') {
      // Candidate stats
      const totalApplications = await Application.countDocuments({ candidate: req.userId });
      const applicationsByStatus = await Application.aggregate([
        { $match: { candidate: user._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      
      const recentApplications = await Application.find({ candidate: req.userId })
        .populate('job', 'title location')
        .sort('-appliedAt')
        .limit(5);
      
      res.json({
        role: 'candidate',
        totalApplications,
        applicationsByStatus,
        recentApplications
      });
    } else {
      // Employer stats
      const totalJobs = await Job.countDocuments({ employer: req.userId });
      const openJobs = await Job.countDocuments({ employer: req.userId, isOpen: true });
      const closedJobs = totalJobs - openJobs;
      
      const jobs = await Job.find({ employer: req.userId }).select('_id');
      const jobIds = jobs.map(job => job._id);
      
      const totalApplications = await Application.countDocuments({ job: { $in: jobIds } });
      const applicationsByStatus = await Application.aggregate([
        { $match: { job: { $in: jobIds } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      
      const recentApplications = await Application.find({ job: { $in: jobIds } })
        .populate('candidate', 'name email')
        .populate('job', 'title')
        .sort('-appliedAt')
        .limit(10);
      
      res.json({
        role: 'employer',
        totalJobs,
        openJobs,
        closedJobs,
        totalApplications,
        applicationsByStatus,
        recentApplications
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/profile/activity
// @desc    Get user activity timeline
// @access  Private
router.get('/activity', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    let activities = [];
    
    if (user.role === 'candidate') {
      // Get candidate's applications
      const applications = await Application.find({ candidate: req.userId })
        .populate('job', 'title')
        .sort('-appliedAt')
        .limit(20);
      
      activities = applications.map(app => ({
        type: 'application',
        action: `Applied for ${app.job.title}`,
        date: app.appliedAt,
        status: app.status,
        jobId: app.job._id
      }));
    } else {
      // Get employer's job postings and status updates
      const jobs = await Job.find({ employer: req.userId })
        .sort('-createdAt')
        .limit(10);
      
      const jobActivities = jobs.map(job => ({
        type: 'job',
        action: `Posted "${job.title}"`,
        date: job.createdAt,
        isOpen: job.isOpen,
        jobId: job._id
      }));
      
      // Get recent status updates from applications
      const jobIds = jobs.map(job => job._id);
      const statusUpdates = await Application.find({ job: { $in: jobIds } })
        .populate('job', 'title')
        .sort('-updatedAt')
        .limit(20);
      
      const statusActivities = statusUpdates.map(update => ({
        type: 'status_update',
        action: `Updated application status to ${update.status} for ${update.job.title}`,
        date: update.updatedAt,
        status: update.status
      }));
      
      activities = [...jobActivities, ...statusActivities].sort((a, b) => b.date - a.date).slice(0, 30);
    }
    
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/profile/account
// @desc    Delete user account
// @access  Private
router.delete('/account', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (user.role === 'candidate') {
      // Delete all applications
      await Application.deleteMany({ candidate: req.userId });
    } else {
      // Delete all jobs and their applications
      const jobs = await Job.find({ employer: req.userId });
      const jobIds = jobs.map(job => job._id);
      
      await Application.deleteMany({ job: { $in: jobIds } });
      await Job.deleteMany({ employer: req.userId });
    }
    
    await User.findByIdAndDelete(req.userId);
    
    res.clearCookie('token');
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;