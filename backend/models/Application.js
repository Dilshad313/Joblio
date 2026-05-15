const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Candidate reference is required']
  },
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: [true, 'Job reference is required']
  },
  status: {
    type: String,
    enum: {
      values: ['applied', 'shortlisted', 'rejected', 'hired', 'interviewing'],
      message: 'Status must be: applied, shortlisted, rejected, hired, or interviewing'
    },
    default: 'applied'
  },
  coverLetter: {
    type: String,
    trim: true,
    maxlength: [2000, 'Cover letter cannot exceed 2000 characters']
  },
  expectedSalary: {
    type: Number,
    min: [0, 'Expected salary cannot be negative']
  },
  noticePeriod: {
    type: Number,
    min: [0, 'Notice period cannot be negative'],
    max: [90, 'Notice period cannot exceed 90 days'],
    default: 0,
    comment: 'Notice period in days'
  },
  source: {
    type: String,
    enum: ['portal', 'referral', 'linkedin', 'other'],
    default: 'portal'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  reviewerNotes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Reviewer notes cannot exceed 1000 characters']
  },
  appliedAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: {
    createdAt: 'appliedAt',
    updatedAt: 'updatedAt'
  },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Ensure a candidate can only apply once per job
applicationSchema.index({ candidate: 1, job: 1 }, { unique: true });

// Indexes for faster queries
applicationSchema.index({ status: 1 });
applicationSchema.index({ job: 1, status: 1 });
applicationSchema.index({ candidate: 1, status: 1 });
applicationSchema.index({ appliedAt: -1 });
applicationSchema.index({ reviewedAt: -1 });
applicationSchema.index({ 'reviewerNotes': 'text' });

// Compound indexes for dashboard queries
applicationSchema.index({ job: 1, status: 1, appliedAt: -1 });
applicationSchema.index({ candidate: 1, appliedAt: -1 });

// Middleware to update updatedAt on save
applicationSchema.pre('save', function(next) {
  if (this.isModified('status') && !this.reviewedAt) {
    this.reviewedAt = Date.now();
  }
  next();
});

// Middleware to populate fields
applicationSchema.pre(/^find/, function(next) {
  this.populate('candidate', 'name email resumeUrl')
      .populate('job', 'title location salary employer')
      .populate('reviewedBy', 'name email');
  next();
});

// Virtual to calculate time since application
applicationSchema.virtual('daysSinceApplied').get(function() {
  const days = Math.floor((Date.now() - this.appliedAt) / (1000 * 60 * 60 * 24));
  return days;
});

// Virtual for status color (for frontend)
applicationSchema.virtual('statusColor').get(function() {
  const colors = {
    'applied': '#3b82f6',      // blue
    'shortlisted': '#10b981',   // green
    'interviewing': '#8b5cf6',  // purple
    'rejected': '#ef4444',      // red
    'hired': '#059669'          // dark green
  };
  return colors[this.status] || '#6b7280';
});

// Method to check if application is active
applicationSchema.methods.isActive = function() {
  return ['applied', 'shortlisted', 'interviewing'].includes(this.status);
};

// Method to update status with validation
applicationSchema.methods.updateStatus = async function(newStatus, reviewerId, notes = '') {
  const validTransitions = {
    'applied': ['shortlisted', 'rejected'],
    'shortlisted': ['interviewing', 'rejected'],
    'interviewing': ['hired', 'rejected'],
    'rejected': [],
    'hired': []
  };
  
  if (!validTransitions[this.status].includes(newStatus)) {
    throw new Error(`Cannot transition from ${this.status} to ${newStatus}`);
  }
  
  this.status = newStatus;
  this.reviewedBy = reviewerId;
  this.reviewedAt = Date.now();
  
  if (notes) {
    this.reviewerNotes = notes;
  }
  
  await this.save();
  return this;
};

// Static method to get application statistics for a job
applicationSchema.statics.getJobStats = async function(jobId) {
  return this.aggregate([
    { $match: { job: mongoose.Types.ObjectId(jobId) } },
    { $group: {
      _id: '$status',
      count: { $sum: 1 }
    }},
    { $group: {
      _id: null,
      total: { $sum: '$count' },
      statuses: {
        $push: { status: '$_id', count: '$count' }
      }
    }}
  ]);
};

// Static method to get candidate's application history
applicationSchema.statics.getCandidateHistory = async function(candidateId) {
  return this.find({ candidate: candidateId })
    .sort('-appliedAt')
    .populate('job', 'title location employer');
};

// Static method to get applications pending review for employer
applicationSchema.statics.getPendingReviewForEmployer = async function(employerId) {
  const Job = require('./Job');
  const jobs = await Job.find({ employer: employerId }).select('_id');
  const jobIds = jobs.map(job => job._id);
  
  return this.find({ 
    job: { $in: jobIds },
    status: 'applied',
    reviewedAt: null
  })
  .populate('candidate', 'name email')
  .populate('job', 'title')
  .sort('appliedAt');
};

module.exports = mongoose.model('Application', applicationSchema);