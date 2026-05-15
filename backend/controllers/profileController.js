const User = require('../models/User');
const Application = require('../models/Application');
const Job = require('../models/Job');
const bcrypt = require('bcryptjs');

// @desc    Get current user's profile
// @route   GET /api/profile/me
// @access  Private
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }
    
    res.json({
      success: true,
      profile: user.getPublicProfile()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/profile/me
// @access  Private
exports.updateProfile = async (req, res) => {
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
    
    res.json({
      success: true,
      profile: user.getPublicProfile()
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

// @desc    Change password
// @route   PUT /api/profile/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.userId).select('+password');
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }
    
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false,
        error: 'Current password is incorrect' 
      });
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    user.password = hashedPassword;
    await user.save();
    
    res.json({ 
      success: true, 
      message: 'Password updated successfully' 
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

// @desc    Get dashboard statistics
// @route   GET /api/profile/dashboard-stats
// @access  Private
exports.getDashboardStats = async (req, res) => {
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
      
      // Application timeline (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const timeline = await Application.aggregate([
        { 
          $match: { 
            candidate: user._id,
            appliedAt: { $gte: thirtyDaysAgo }
          } 
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$appliedAt" } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      
      res.json({
        success: true,
        role: 'candidate',
        stats: {
          totalApplications,
          applicationsByStatus: applicationsByStatus.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
          }, {}),
          recentApplications,
          timeline
        }
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
      
      // Jobs by month
      const jobsByMonth = await Job.aggregate([
        { $match: { employer: user._id } },
        {
          $group: {
            _id: { 
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { "_id.year": -1, "_id.month": -1 } },
        { $limit: 6 }
      ]);
      
      res.json({
        success: true,
        role: 'employer',
        stats: {
          totalJobs,
          openJobs,
          closedJobs,
          totalApplications,
          applicationsByStatus: applicationsByStatus.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
          }, {}),
          recentApplications,
          jobsByMonth
        }
      });
    }
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// @desc    Get user activity timeline
// @route   GET /api/profile/activity
// @access  Private
exports.getActivityTimeline = async (req, res) => {
  try {
    const { limit = 30 } = req.query;
    const user = await User.findById(req.userId);
    let activities = [];
    
    if (user.role === 'candidate') {
      // Get candidate's applications
      const applications = await Application.find({ candidate: req.userId })
        .populate('job', 'title')
        .sort('-appliedAt')
        .limit(parseInt(limit));
      
      activities = applications.map(app => ({
        type: 'application',
        action: `Applied for "${app.job.title}"`,
        date: app.appliedAt,
        status: app.status,
        jobId: app.job._id,
        applicationId: app._id
      }));
    } else {
      // Get employer's job postings
      const jobs = await Job.find({ employer: req.userId })
        .sort('-createdAt')
        .limit(10);
      
      const jobActivities = jobs.map(job => ({
        type: 'job_posted',
        action: `Posted "${job.title}"`,
        date: job.createdAt,
        isOpen: job.isOpen,
        jobId: job._id
      }));
      
      // Get recent status updates from applications
      const jobIds = jobs.map(job => job._id);
      const statusUpdates = await Application.find({ job: { $in: jobIds } })
        .populate('job', 'title')
        .populate('candidate', 'name')
        .sort('-updatedAt')
        .limit(parseInt(limit));
      
      const statusActivities = statusUpdates.map(update => ({
        type: 'status_update',
        action: `Updated ${update.candidate.name}'s application to ${update.status} for ${update.job.title}`,
        date: update.updatedAt,
        status: update.status,
        candidateName: update.candidate.name,
        jobTitle: update.job.title
      }));
      
      activities = [...jobActivities, ...statusActivities]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, parseInt(limit));
    }
    
    res.json({
      success: true,
      count: activities.length,
      activities
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// @desc    Upload/update resume
// @route   POST /api/profile/upload-resume
// @access  Private (Candidate only)
exports.uploadResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No file uploaded' 
      });
    }
    
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
      resumeUrl: user.resumeUrl
    });
  } catch (error) {
    console.error('Resume upload error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// @desc    Delete resume
// @route   DELETE /api/profile/resume
// @access  Private (Candidate only)
exports.deleteResume = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user.resumeUrl) {
      return res.status(404).json({ 
        success: false,
        error: 'No resume found' 
      });
    }
    
    user.resumeUrl = null;
    await user.save();
    
    res.json({ 
      success: true, 
      message: 'Resume deleted successfully' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// @desc    Get resume status
// @route   GET /api/profile/resume-status
// @access  Private (Candidate only)
exports.getResumeStatus = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    res.json({
      success: true,
      hasResume: !!user.resumeUrl,
      resumeUrl: user.resumeUrl || null
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// @desc    Delete user account
// @route   DELETE /api/profile/account
// @access  Private
exports.deleteAccount = async (req, res) => {
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
    res.json({ 
      success: true, 
      message: 'Account deleted successfully' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// @desc    Get candidate's application history with details
// @route   GET /api/profile/application-history
// @access  Private (Candidate only)
exports.getApplicationHistory = async (req, res) => {
  try {
    const applications = await Application.find({ candidate: req.userId })
      .populate('job', 'title location salary employer employmentType')
      .populate('job.employer', 'name email')
      .sort('-appliedAt');
    
    // Group by status
    const grouped = {
      applied: applications.filter(app => app.status === 'applied'),
      shortlisted: applications.filter(app => app.status === 'shortlisted'),
      interviewing: applications.filter(app => app.status === 'interviewing'),
      rejected: applications.filter(app => app.status === 'rejected'),
      hired: applications.filter(app => app.status === 'hired')
    };
    
    res.json({
      success: true,
      total: applications.length,
      grouped,
      all: applications
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};