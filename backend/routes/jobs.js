const express = require('express');
const router = express.Router();
const { auth, employerOnly } = require('../middleware/auth');
const Job = require('../models/Job');
const Application = require('../models/Application');

// @route   GET /api/jobs
// @desc    Get all jobs with filters
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { search, location, minSalary, employmentType, experienceLevel } = req.query;
    
    const jobs = await Job.searchJobs(search, {
      location,
      minSalary: minSalary ? parseInt(minSalary) : null,
      employmentType,
      experienceLevel
    });
    
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/jobs/:id
// @desc    Get single job by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('employer', 'name email')
      .populate({
        path: 'applications',
        select: 'status appliedAt',
        options: { limit: 5 }
      });
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Get application count
    const applicationCount = await Application.countDocuments({ job: job._id });
    
    res.json({
      ...job.toObject(),
      applicationCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/jobs
// @desc    Create a new job listing
// @access  Private (Employer only)
router.post('/', auth, employerOnly, async (req, res) => {
  try {
    const {
      title,
      description,
      location,
      salary,
      requiredSkills,
      experienceLevel,
      employmentType,
      applicationDeadline
    } = req.body;
    
    const job = await Job.create({
      title,
      description,
      location,
      salary,
      employer: req.userId,
      requiredSkills: requiredSkills || [],
      experienceLevel: experienceLevel || 'Mid',
      employmentType: employmentType || 'Full-time',
      applicationDeadline: applicationDeadline || null
    });
    
    res.status(201).json(job);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   PUT /api/jobs/:id
// @desc    Update a job listing
// @access  Private (Employer only)
router.put('/:id', auth, employerOnly, async (req, res) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, employer: req.userId });
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found or unauthorized' });
    }
    
    const allowedUpdates = [
      'title', 'description', 'location', 'salary', 
      'requiredSkills', 'experienceLevel', 'employmentType',
      'applicationDeadline'
    ];
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        job[field] = req.body[field];
      }
    });
    
    await job.save();
    res.json(job);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   PATCH /api/jobs/:id/close
// @desc    Close a job listing (stop accepting applications)
// @access  Private (Employer only)
router.patch('/:id/close', auth, employerOnly, async (req, res) => {
  try {
    const job = await Job.findOneAndUpdate(
      { _id: req.params.id, employer: req.userId },
      { isOpen: false, updatedAt: Date.now() },
      { new: true }
    );
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found or unauthorized' });
    }
    
    res.json(job);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   PATCH /api/jobs/:id/open
// @desc    Reopen a closed job listing
// @access  Private (Employer only)
router.patch('/:id/open', auth, employerOnly, async (req, res) => {
  try {
    const job = await Job.findOneAndUpdate(
      { _id: req.params.id, employer: req.userId },
      { isOpen: true, updatedAt: Date.now() },
      { new: true }
    );
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found or unauthorized' });
    }
    
    res.json(job);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   DELETE /api/jobs/:id
// @desc    Delete a job listing (only if no applications)
// @access  Private (Employer only)
router.delete('/:id', auth, employerOnly, async (req, res) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, employer: req.userId });
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found or unauthorized' });
    }
    
    const applicationCount = await Application.countDocuments({ job: job._id });
    if (applicationCount > 0) {
      return res.status(400).json({ error: 'Cannot delete job with existing applications' });
    }
    
    await job.deleteOne();
    res.json({ success: true, message: 'Job deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   GET /api/jobs/employer/me
// @desc    Get all jobs posted by the logged-in employer
// @access  Private (Employer only)
router.get('/employer/me', auth, employerOnly, async (req, res) => {
  try {
    const jobs = await Job.find({ employer: req.userId })
      .sort('-createdAt')
      .populate({
        path: 'applications',
        select: 'status candidate'
      });
    
    // Add application count to each job
    const jobsWithCount = jobs.map(job => ({
      ...job.toObject(),
      totalApplications: job.applications ? job.applications.length : 0
    }));
    
    res.json(jobsWithCount);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/jobs/:id/statistics
// @desc    Get application statistics for a job
// @access  Private (Employer only)
router.get('/:id/statistics', auth, employerOnly, async (req, res) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, employer: req.userId });
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found or unauthorized' });
    }
    
    const stats = await Application.getJobStats(job._id);
    res.json(stats[0] || { total: 0, statuses: [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;