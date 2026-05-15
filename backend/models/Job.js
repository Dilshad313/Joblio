const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true,
    minlength: [3, 'Job title must be at least 3 characters'],
    maxlength: [100, 'Job title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Job description is required'],
    trim: true,
    minlength: [20, 'Description must be at least 20 characters'],
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  location: {
    type: String,
    required: [true, 'Job location is required'],
    trim: true,
    enum: {
      values: ['Remote', 'Hybrid', 'On-site', 'New York', 'San Francisco', 'London', 'Berlin', 'Singapore', 'Dubai', 'Bangalore', 'Other'],
      message: 'Please select a valid location'
    }
  },
  salary: {
    type: Number,
    required: [true, 'Salary is required'],
    min: [0, 'Salary cannot be negative'],
    max: [1000000, 'Salary cannot exceed $1,000,000']
  },
  isOpen: {
    type: Boolean,
    default: true
  },
  employer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Employer reference is required']
  },
  requiredSkills: [{
    type: String,
    trim: true
  }],
  experienceLevel: {
    type: String,
    enum: ['Entry', 'Mid', 'Senior', 'Lead', 'Executive'],
    default: 'Mid'
  },
  employmentType: {
    type: String,
    enum: ['Full-time', 'Part-time', 'Contract', 'Internship', 'Freelance'],
    default: 'Full-time'
  },
  applicationDeadline: {
    type: Date,
    default: function() {
      const date = new Date();
      date.setDate(date.getDate() + 30); // Default 30 days from posting
      return date;
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual field to get all applications for this job
jobSchema.virtual('applications', {
  ref: 'Application',
  localField: '_id',
  foreignField: 'job',
  justOne: false
});

// Virtual field to get application count
jobSchema.virtual('applicationCount', {
  ref: 'Application',
  localField: '_id',
  foreignField: 'job',
  count: true
});

// Indexes for search and filtering
jobSchema.index({ title: 'text', description: 'text' });
jobSchema.index({ location: 1 });
jobSchema.index({ salary: 1 });
jobSchema.index({ isOpen: 1 });
jobSchema.index({ employer: 1 });
jobSchema.index({ createdAt: -1 });
jobSchema.index({ employmentType: 1 });
jobSchema.index({ experienceLevel: 1 });
jobSchema.index({ applicationDeadline: 1 });

// Compound indexes for common queries
jobSchema.index({ isOpen: 1, createdAt: -1 });
jobSchema.index({ location: 1, isOpen: 1 });
jobSchema.index({ salary: 1, isOpen: 1 });

// Middleware to update updatedAt on save
jobSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to check if job is still accepting applications
jobSchema.methods.isAcceptingApplications = function() {
  return this.isOpen && new Date() <= this.applicationDeadline;
};

// Method to get job summary
jobSchema.methods.getSummary = function() {
  return {
    id: this._id,
    title: this.title,
    location: this.location,
    salary: this.salary,
    employmentType: this.employmentType,
    experienceLevel: this.experienceLevel,
    isOpen: this.isOpen,
    employerId: this.employer
  };
};

// Static method to search jobs
jobSchema.statics.searchJobs = function(searchTerm, filters = {}) {
  const query = { isOpen: true };
  
  if (searchTerm) {
    query.$text = { $search: searchTerm };
  }
  
  if (filters.location) {
    query.location = filters.location;
  }
  
  if (filters.minSalary) {
    query.salary = { $gte: filters.minSalary };
  }
  
  if (filters.employmentType) {
    query.employmentType = filters.employmentType;
  }
  
  if (filters.experienceLevel) {
    query.experienceLevel = filters.experienceLevel;
  }
  
  return this.find(query)
    .populate('employer', 'name email')
    .sort('-createdAt');
};

module.exports = mongoose.model('Job', jobSchema);