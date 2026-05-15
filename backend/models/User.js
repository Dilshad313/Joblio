const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please enter a valid email address'
    ]
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't return password by default in queries
  },
  role: {
    type: String,
    enum: {
      values: ['candidate', 'employer'],
      message: 'Role must be either candidate or employer'
    },
    default: 'candidate'
  },
  resumeUrl: {
    type: String,
    default: null,
    validate: {
      validator: function(v) {
        if (this.role === 'candidate' && v) {
          return /^(https?:\/\/.*\.(pdf|doc|docx))$/.test(v);
        }
        return true;
      },
      message: 'Resume must be a valid PDF or DOC file URL'
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

// Virtual field to get all jobs posted by employer
userSchema.virtual('postedJobs', {
  ref: 'Job',
  localField: '_id',
  foreignField: 'employer',
  justOne: false
});

// Virtual field to get all applications by candidate
userSchema.virtual('applications', {
  ref: 'Application',
  localField: '_id',
  foreignField: 'candidate',
  justOne: false
});

// Index for faster queries
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });

// Method to check if user is employer
userSchema.methods.isEmployer = function() {
  return this.role === 'employer';
};

// Method to check if user is candidate
userSchema.methods.isCandidate = function() {
  return this.role === 'candidate';
};

// Method to get public profile (hide sensitive info)
userSchema.methods.getPublicProfile = function() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    resumeUrl: this.resumeUrl,
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model('User', userSchema);