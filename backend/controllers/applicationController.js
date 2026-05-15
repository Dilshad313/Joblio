const Application = require('../models/Application');
const Job = require('../models/Job');
const User = require('../models/User');
const { sendStatusEmail } = require('../utils/emailService');

// @desc    Apply for a job
// @route   POST /api/applications/apply/:jobId
// @access  Private (Candidate only)
exports.applyToJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { coverLetter, expectedSalary, noticePeriod } = req.body;
    
    // Check if job exists and is open
    const job = await Job.findOne({ _id: jobId, isOpen: true });
    if (!job) {
      return res.status(404).json({ 
        success: false,
        error: 'Job not found or no longer accepting applications' 
      });
    }
    
    // Check if job deadline has passed
    if (!job.isAcceptingApplications()) {
      return res.status(400).json({ 
        success: false,
        error: 'Application deadline has passed' 
      });
    }
    
    // Check if user has uploaded resume
    const user = await User.findById(req.userId);
    if (!user.resumeUrl) {
      return res.status(400).json({ 
        success: false,
        error: 'Please upload your resume before applying' 
      });
    }
    
    // Check if already applied
    const existingApplication = await Application.findOne({
      candidate: req.userId,
      job: jobId
    });
    
    if (existingApplication) {
      return res.status(400).json({ 
        success: false,
        error: 'You have already applied for this job' 
      });
    }
    
    // Create application
    const application = await Application.create({
      candidate: req.userId,
      job: jobId,
      coverLetter: coverLetter || '',
      expectedSalary: expectedSalary || null,
      noticePeriod: noticePeriod || 0,
      status: 'applied'
    });
    
    // Populate for response
    await application.populate('candidate', 'name email resumeUrl');
    await application.populate('job', 'title location salary');
    
    res.status(201).json({
      success: true,
      application
    });
  } catch (error) {
    console.error('Apply error:', error);
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

// @desc    Get candidate's applications
// @route   GET /api/applications/me
// @access  Private (Candidate only)
exports.getMyApplications = async (req, res) => {
  try {
    const applications = await Application.find({ candidate: req.userId })
      .populate('job', 'title location salary employer employmentType')
      .populate('job.employer', 'name email')
      .sort('-appliedAt');
    
    res.json({
      success: true,
      count: applications.length,
      applications
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// @desc    Get applications for employer's jobs
// @route   GET /api/applications/employer
// @access  Private (Employer only)
exports.getEmployerApplications = async (req, res) => {
  try {
    // Get all jobs by this employer
    const jobs = await Job.find({ employer: req.userId }).select('_id');
    const jobIds = jobs.map(job => job._id);
    
    // Get all applications for those jobs
    const applications = await Application.find({ job: { $in: jobIds } })
      .populate('candidate', 'name email resumeUrl')
      .populate('job', 'title location salary')
      .sort('-appliedAt');
    
    res.json({
      success: true,
      count: applications.length,
      applications
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// @desc    Get pending applications (not reviewed yet)
// @route   GET /api/applications/employer/pending
// @access  Private (Employer only)
exports.getPendingApplications = async (req, res) => {
  try {
    const pendingApplications = await Application.getPendingReviewForEmployer(req.userId);
    
    res.json({
      success: true,
      count: pendingApplications.length,
      applications: pendingApplications
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// @desc    Get single application by ID
// @route   GET /api/applications/:id
// @access  Private (Candidate or Employer who owns the job)
exports.getApplicationById = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate('candidate', 'name email resumeUrl')
      .populate('job', 'title description location salary employer')
      .populate('reviewedBy', 'name email');
    
    if (!application) {
      return res.status(404).json({ 
        success: false,
        error: 'Application not found' 
      });
    }
    
    // Check authorization
    const job = await Job.findById(application.job._id);
    const isOwner = job && job.employer.toString() === req.userId;
    const isCandidate = application.candidate._id.toString() === req.userId;
    
    if (!isOwner && !isCandidate) {
      return res.status(403).json({ 
        success: false,
        error: 'Unauthorized access to this application' 
      });
    }
    
    res.json({
      success: true,
      application
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// @desc    Update application status
// @route   PATCH /api/applications/status
// @access  Private (Employer only)
exports.updateApplicationStatus = async (req, res) => {
  try {
    const { applicationId, status, notes } = req.body;
    
    const application = await Application.findById(applicationId)
      .populate('candidate', 'name email')
      .populate('job', 'title');
    
    if (!application) {
      return res.status(404).json({ 
        success: false,
        error: 'Application not found' 
      });
    }
    
    // Verify employer owns the job
    const job = await Job.findById(application.job._id);
    if (job.employer.toString() !== req.userId) {
      return res.status(403).json({ 
        success: false,
        error: 'Unauthorized to update this application' 
      });
    }
    
    // Update status with validation
    const oldStatus = application.status;
    const updatedApplication = await application.updateStatus(status, req.userId, notes);
    
    // Send email notification
    try {
      await sendStatusEmail(
        application.candidate.email,
        application.candidate.name,
        application.job.title,
        status
      );
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Don't fail the request if email fails
    }
    
    res.json({
      success: true,
      application: updatedApplication,
      oldStatus,
      newStatus: status,
      emailSent: true
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

// @desc    Withdraw application (candidate only)
// @route   DELETE /api/applications/:id
// @access  Private (Candidate only)
exports.withdrawApplication = async (req, res) => {
  try {
    const application = await Application.findOne({
      _id: req.params.id,
      candidate: req.userId
    });
    
    if (!application) {
      return res.status(404).json({ 
        success: false,
        error: 'Application not found' 
      });
    }
    
    // Only allow withdrawal if status is 'applied'
    if (application.status !== 'applied') {
      return res.status(400).json({ 
        success: false,
        error: 'Cannot withdraw application after it has been reviewed' 
      });
    }
    
    await application.deleteOne();
    
    res.json({ 
      success: true, 
      message: 'Application withdrawn successfully' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// @desc    Check if candidate has applied to a job
// @route   GET /api/applications/check/:jobId
// @access  Private (Candidate only)
exports.checkApplication = async (req, res) => {
  try {
    const { jobId } = req.params;
    const application = await Application.findOne({
      candidate: req.userId,
      job: jobId
    });
    
    res.json({ 
      success: true,
      hasApplied: !!application, 
      application: application || null 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// @desc    Get application statistics for a job
// @route   GET /api/applications/job/:jobId/stats
// @access  Private (Employer only)
exports.getJobApplicationStats = async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Verify job ownership
    const job = await Job.findOne({ _id: jobId, employer: req.userId });
    if (!job) {
      return res.status(404).json({ 
        success: false,
        error: 'Job not found or unauthorized' 
      });
    }
    
    const stats = await Application.getJobStats(jobId);
    
    res.json({
      success: true,
      statistics: stats[0] || { total: 0, statuses: [] }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// @desc    Bulk update application statuses
// @route   PATCH /api/applications/bulk-status
// @access  Private (Employer only)
exports.bulkUpdateStatus = async (req, res) => {
  try {
    const { applicationIds, status, notes } = req.body;
    
    if (!applicationIds || !Array.isArray(applicationIds) || applicationIds.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Application IDs array is required' 
      });
    }
    
    const results = [];
    const errors = [];
    
    for (const applicationId of applicationIds) {
      try {
        const application = await Application.findById(applicationId)
          .populate('candidate', 'name email')
          .populate('job', 'title');
        
        if (!application) {
          errors.push({ applicationId, error: 'Application not found' });
          continue;
        }
        
        // Verify employer owns the job
        const job = await Job.findById(application.job._id);
        if (job.employer.toString() !== req.userId) {
          errors.push({ applicationId, error: 'Unauthorized' });
          continue;
        }
        
        const updated = await application.updateStatus(status, req.userId, notes);
        results.push(updated);
        
        // Send email notifications
        await sendStatusEmail(
          application.candidate.email,
          application.candidate.name,
          application.job.title,
          status
        );
      } catch (error) {
        errors.push({ applicationId, error: error.message });
      }
    }
    
    res.json({
      success: true,
      updated: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};