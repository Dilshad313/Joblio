const Job = require('../models/Job');
const Application = require('../models/Application');

// @desc    Get all jobs with filters
// @route   GET /api/jobs
// @access  Public
exports.getJobs = async (req, res) => {
  try {
    const { search, location, minSalary, employmentType, experienceLevel } = req.query;
    
    const jobs = await Job.searchJobs(search, {
      location,
      minSalary: minSalary ? parseInt(minSalary) : null,
      employmentType,
      experienceLevel
    });
    
    res.json({
      success: true,
      count: jobs.length,
      jobs
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// @desc    Get single job by ID
// @route   GET /api/jobs/:id
// @access  Public
exports.getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('employer', 'name email')
      .populate({
        path: 'applications',
        select: 'status appliedAt',
        options: { limit: 5 }
      });
    
    if (!job) {
      return res.status(404).json({ 
        success: false,
        error: 'Job not found' 
      });
    }
    
    // Get application count
    const applicationCount = await Application.countDocuments({ job: job._id });
    
    res.json({
      success: true,
      job: {
        ...job.toObject(),
        applicationCount
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// @desc    Create new job
// @route   POST /api/jobs
// @access  Private (Employer only)
exports.createJob = async (req, res) => {
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
    
    res.status(201).json({
      success: true,
      job
    });
  } catch (error) {
    console.error('Create job error:', error);
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

// @desc    Update job
// @route   PUT /api/jobs/:id
// @access  Private (Employer only)
exports.updateJob = async (req, res) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, employer: req.userId });
    
    if (!job) {
      return res.status(404).json({ 
        success: false,
        error: 'Job not found or unauthorized' 
      });
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
    
    res.json({
      success: true,
      job
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

// @desc    Close job (stop accepting applications)
// @route   PATCH /api/jobs/:id/close
// @access  Private (Employer only)
exports.closeJob = async (req, res) => {
  try {
    const job = await Job.findOneAndUpdate(
      { _id: req.params.id, employer: req.userId },
      { isOpen: false, updatedAt: Date.now() },
      { new: true }
    );
    
    if (!job) {
      return res.status(404).json({ 
        success: false,
        error: 'Job not found or unauthorized' 
      });
    }
    
    res.json({
      success: true,
      job
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

// @desc    Reopen job
// @route   PATCH /api/jobs/:id/open
// @access  Private (Employer only)
exports.openJob = async (req, res) => {
  try {
    const job = await Job.findOneAndUpdate(
      { _id: req.params.id, employer: req.userId },
      { isOpen: true, updatedAt: Date.now() },
      { new: true }
    );
    
    if (!job) {
      return res.status(404).json({ 
        success: false,
        error: 'Job not found or unauthorized' 
      });
    }
    
    res.json({
      success: true,
      job
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

// @desc    Delete job (only if no applications)
// @route   DELETE /api/jobs/:id
// @access  Private (Employer only)
exports.deleteJob = async (req, res) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, employer: req.userId });
    
    if (!job) {
      return res.status(404).json({ 
        success: false,
        error: 'Job not found or unauthorized' 
      });
    }
    
    const applicationCount = await Application.countDocuments({ job: job._id });
    if (applicationCount > 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Cannot delete job with existing applications' 
      });
    }
    
    await job.deleteOne();
    
    res.json({ 
      success: true, 
      message: 'Job deleted successfully' 
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

// @desc    Get employer's jobs
// @route   GET /api/jobs/employer/me
// @access  Private (Employer only)
exports.getEmployerJobs = async (req, res) => {
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
    
    res.json({
      success: true,
      count: jobs.length,
      jobs: jobsWithCount
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// @desc    Get job statistics (for employer)
// @route   GET /api/jobs/:id/statistics
// @access  Private (Employer only)
exports.getJobStatistics = async (req, res) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, employer: req.userId });
    
    if (!job) {
      return res.status(404).json({ 
        success: false,
        error: 'Job not found or unauthorized' 
      });
    }
    
    const stats = await Application.getJobStats(job._id);
    
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

// @desc    Search jobs with advanced filters
// @route   POST /api/jobs/search
// @access  Public
exports.advancedSearch = async (req, res) => {
  try {
    const {
      keyword,
      location,
      minSalary,
      maxSalary,
      employmentType,
      experienceLevel,
      skills,
      page = 1,
      limit = 20
    } = req.body;
    
    let query = { isOpen: true };
    
    if (keyword) {
      query.$text = { $search: keyword };
    }
    
    if (location) {
      query.location = location;
    }
    
    if (minSalary || maxSalary) {
      query.salary = {};
      if (minSalary) query.salary.$gte = minSalary;
      if (maxSalary) query.salary.$lte = maxSalary;
    }
    
    if (employmentType) {
      query.employmentType = employmentType;
    }
    
    if (experienceLevel) {
      query.experienceLevel = experienceLevel;
    }
    
    if (skills && skills.length > 0) {
      query.requiredSkills = { $in: skills };
    }
    
    const skip = (page - 1) * limit;
    
    const jobs = await Job.find(query)
      .populate('employer', 'name email')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);
    
    const total = await Job.countDocuments(query);
    
    res.json({
      success: true,
      jobs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};