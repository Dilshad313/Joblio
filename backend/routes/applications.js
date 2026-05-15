const express = require('express');
const router = express.Router();
const { auth, candidateOnly, employerOnly } = require('../middleware/auth');
const Application = require('../models/Application');
const Job = require('../models/Job');
const User = require('../models/User');
const { sendStatusEmail } = require('../utils/emailService');

// @route   POST /api/applications/apply/:jobId
// @desc    Apply for a job
// @access  Private (Candidate only)
router.post('/apply/:jobId', auth, candidateOnly, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { coverLetter, expectedSalary, noticePeriod } = req.body;
    
    // Check if job exists and is open
    const job = await Job.findOne({ _id: jobId, isOpen: true });
    if (!job) {
      return res.status(404).json({ error: 'Job not found or no longer accepting applications' });
    }
    
    // Check if job deadline has passed
    if (!job.isAcceptingApplications()) {
      return res.status(400).json({ error: 'Application deadline has passed' });
    }
    
    // Check if user has uploaded resume
    const user = await User.findById(req.userId);
    if (!user.resumeUrl) {
      return res.status(400).json({ error: 'Please upload your resume before applying' });
    }
    
    // Check if already applied
    const existingApplication = await Application.findOne({
      candidate: req.userId,
      job: jobId
    });
    
    if (existingApplication) {
      return res.status(400).json({ error: 'You have already applied for this job' });
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
    
    res.status(201).json(application);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   GET /api/applications/me
// @desc    Get all applications by the logged-in candidate
// @access  Private (Candidate only)
router.get('/me', auth, candidateOnly, async (req, res) => {
  try {
    const applications = await Application.find({ candidate: req.userId })
      .populate('job', 'title location salary employer employmentType')
      .populate('job.employer', 'name email')
      .sort('-appliedAt');
    
    res.json(applications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/applications/employer
// @desc    Get all applications for jobs posted by employer
// @access  Private (Employer only)
router.get('/employer', auth, employerOnly, async (req, res) => {
  try {
    // Get all jobs by this employer
    const jobs = await Job.find({ employer: req.userId }).select('_id');
    const jobIds = jobs.map(job => job._id);
    
    // Get all applications for those jobs
    const applications = await Application.find({ job: { $in: jobIds } })
      .populate('candidate', 'name email resumeUrl')
      .populate('job', 'title location salary')
      .sort('-appliedAt');
    
    res.json(applications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/applications/employer/pending
// @desc    Get applications pending review
// @access  Private (Employer only)
router.get('/employer/pending', auth, employerOnly, async (req, res) => {
  try {
    const pendingApplications = await Application.getPendingReviewForEmployer(req.userId);
    res.json(pendingApplications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/applications/:id
// @desc    Get single application by ID
// @access  Private (Candidate or Employer who owns the job)
router.get('/:id', auth, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate('candidate', 'name email resumeUrl')
      .populate('job', 'title description location salary employer')
      .populate('reviewedBy', 'name email');
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    // Check authorization
    const job = await Job.findById(application.job._id);
    const isOwner = job && job.employer.toString() === req.userId;
    const isCandidate = application.candidate._id.toString() === req.userId;
    
    if (!isOwner && !isCandidate) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    res.json(application);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PATCH /api/applications/status
// @desc    Update application status
// @access  Private (Employer only)
router.patch('/status', auth, employerOnly, async (req, res) => {
  try {
    const { applicationId, status, notes } = req.body;
    
    const application = await Application.findById(applicationId)
      .populate('candidate', 'name email')
      .populate('job', 'title');
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    // Verify employer owns the job
    const job = await Job.findById(application.job._id);
    if (job.employer.toString() !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Update status with validation
    const oldStatus = application.status;
    const updatedApplication = await application.updateStatus(status, req.userId, notes);
    
    // Send email notification
    await sendStatusEmail(
      application.candidate.email,
      application.candidate.name,
      application.job.title,
      status
    );
    
    res.json({
      success: true,
      application: updatedApplication,
      oldStatus,
      newStatus: status
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   DELETE /api/applications/:id
// @desc    Withdraw application (candidate only)
// @access  Private (Candidate only)
router.delete('/:id', auth, candidateOnly, async (req, res) => {
  try {
    const application = await Application.findOne({
      _id: req.params.id,
      candidate: req.userId
    });
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    // Only allow withdrawal if status is 'applied'
    if (application.status !== 'applied') {
      return res.status(400).json({ error: 'Cannot withdraw application after it has been reviewed' });
    }
    
    await application.deleteOne();
    res.json({ success: true, message: 'Application withdrawn successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/applications/job/:jobId/stats
// @desc    Get statistics for a specific job
// @access  Private (Employer only)
router.get('/job/:jobId/stats', auth, employerOnly, async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Verify job ownership
    const job = await Job.findOne({ _id: jobId, employer: req.userId });
    if (!job) {
      return res.status(404).json({ error: 'Job not found or unauthorized' });
    }
    
    const stats = await Application.getJobStats(jobId);
    res.json(stats[0] || { total: 0, statuses: [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/applications/check/:jobId
// @desc    Check if candidate has already applied to a job
// @access  Private (Candidate only)
router.get('/check/:jobId', auth, candidateOnly, async (req, res) => {
  try {
    const { jobId } = req.params;
    const application = await Application.findOne({
      candidate: req.userId,
      job: jobId
    });
    
    res.json({ hasApplied: !!application, application });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;