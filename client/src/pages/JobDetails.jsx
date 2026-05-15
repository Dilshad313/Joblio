import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const JobDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasApplied, setHasApplied] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applicationData, setApplicationData] = useState({
    coverLetter: '',
    expectedSalary: '',
    noticePeriod: ''
  });
  const [showApplicationForm, setShowApplicationForm] = useState(false);

  useEffect(() => {
    fetchJobDetails();
    if (user?.role === 'candidate') {
      checkApplicationStatus();
    }
  }, [id, user]);

  const fetchJobDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/jobs/${id}`);
      setJob(response.data.job || response.data);
    } catch (err) {
      console.error('Failed to fetch job:', err);
      setError(err.response?.data?.error || 'Failed to load job details');
    } finally {
      setLoading(false);
    }
  };

  const checkApplicationStatus = async () => {
    try {
      const response = await api.get(`/applications/check/${id}`);
      setHasApplied(response.data.hasApplied);
    } catch (err) {
      console.error('Failed to check application status:', err);
    }
  };

  const handleApply = async (e) => {
    e.preventDefault();
    
    if (!user) {
      navigate('/login', { state: { from: `/jobs/${id}` } });
      return;
    }

    if (user.role !== 'candidate') {
      alert('Only candidates can apply for jobs');
      return;
    }

    setApplying(true);
    try {
      const response = await api.post(`/applications/apply/${id}`, {
        coverLetter: applicationData.coverLetter,
        expectedSalary: applicationData.expectedSalary ? parseInt(applicationData.expectedSalary) : null,
        noticePeriod: applicationData.noticePeriod ? parseInt(applicationData.noticePeriod) : 0
      });

      if (response.data.success) {
        setHasApplied(true);
        setShowApplicationForm(false);
        alert('Application submitted successfully!');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to apply. Please try again.';
      alert(errorMsg);
    } finally {
      setApplying(false);
    }
  };

  const formatSalary = (salary) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(salary);
  };

  const getStatusBadge = (isOpen) => {
    return isOpen ? (
      <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
        Active
      </span>
    ) : (
      <span className="px-3 py-1 bg-red-100 text-red-800 text-sm rounded-full">
        Closed
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">Job Not Found</h2>
          <p className="text-gray-500 mb-4">{error || 'The job you\'re looking for doesn\'t exist'}</p>
          <button
            onClick={() => navigate('/jobs')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Browse Jobs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => navigate(-1)}
            className="mb-4 text-blue-600 hover:text-blue-700 flex items-center"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </button>

          {/* Job Header */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
                  {job.title}
                </h1>
                <p className="text-lg text-gray-600 mb-4">
                  {job.employer?.name || 'Company'}
                </p>
                <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {job.location}
                  </span>
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formatSalary(job.salary)}/year
                  </span>
                  {job.employmentType && (
                    <span className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {job.employmentType}
                    </span>
                  )}
                </div>
              </div>
              <div>{getStatusBadge(job.isOpen)}</div>
            </div>
          </div>

          {/* Job Details Grid */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="md:col-span-2 space-y-6">
              {/* Description */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Job Description</h2>
                <div className="prose max-w-none">
                  <p className="text-gray-700 whitespace-pre-wrap">{job.description}</p>
                </div>
              </div>

              {/* Requirements */}
              {job.requiredSkills && job.requiredSkills.length > 0 && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-semibold mb-4">Required Skills</h2>
                  <div className="flex flex-wrap gap-2">
                    {job.requiredSkills.map((skill, index) => (
                      <span key={index} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Info */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Additional Information</h2>
                <div className="space-y-3">
                  {job.experienceLevel && (
                    <div>
                      <span className="font-medium text-gray-700">Experience Level:</span>
                      <span className="ml-2 text-gray-600">{job.experienceLevel}</span>
                    </div>
                  )}
                  {job.applicationDeadline && (
                    <div>
                      <span className="font-medium text-gray-700">Application Deadline:</span>
                      <span className="ml-2 text-gray-600">
                        {new Date(job.applicationDeadline).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-gray-700">Posted Date:</span>
                    <span className="ml-2 text-gray-600">
                      {new Date(job.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar - Apply Section */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-md p-6 sticky top-20">
                <h3 className="text-lg font-semibold mb-4">Apply for this position</h3>
                
                {!job.isOpen ? (
                  <div className="text-center py-4">
                    <p className="text-red-600">This position is no longer accepting applications</p>
                  </div>
                ) : hasApplied ? (
                  <div className="text-center py-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <svg className="w-12 h-12 text-green-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-green-800 font-medium">Application Submitted!</p>
                      <p className="text-sm text-green-600 mt-1">You have already applied for this position</p>
                      <button
                        onClick={() => navigate('/dashboard/candidate/applications')}
                        className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        View My Applications →
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {!user && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                        <p className="text-yellow-800 text-sm">
                          Please login to apply for this position
                        </p>
                        <button
                          onClick={() => navigate('/login', { state: { from: `/jobs/${id}` } })}
                          className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          Login to Apply →
                        </button>
                      </div>
                    )}

                    {user && user.role === 'candidate' && (
                      <>
                        {!showApplicationForm ? (
                          <button
                            onClick={() => setShowApplicationForm(true)}
                            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
                          >
                            Apply Now
                          </button>
                        ) : (
                          <form onSubmit={handleApply} className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Cover Letter (Optional)
                              </label>
                              <textarea
                                rows="4"
                                value={applicationData.coverLetter}
                                onChange={(e) => setApplicationData(prev => ({ ...prev, coverLetter: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Tell us why you're a good fit for this position..."
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Expected Salary (Optional)
                              </label>
                              <input
                                type="number"
                                value={applicationData.expectedSalary}
                                onChange={(e) => setApplicationData(prev => ({ ...prev, expectedSalary: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="USD per year"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Notice Period (Days)
                              </label>
                              <input
                                type="number"
                                value={applicationData.noticePeriod}
                                onChange={(e) => setApplicationData(prev => ({ ...prev, noticePeriod: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="0"
                              />
                            </div>

                            <div className="flex gap-3">
                              <button
                                type="submit"
                                disabled={applying}
                                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                              >
                                {applying ? 'Submitting...' : 'Submit Application'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowApplicationForm(false)}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        )}
                      </>
                    )}

                    {user && user.role === 'employer' && job.employer?._id === user.id && (
                      <div className="text-center py-4">
                        <button
                          onClick={() => navigate(`/dashboard/employer/jobs/${id}/edit`)}
                          className="w-full bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition"
                        >
                          Edit Job Posting
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Company Info */}
              {job.employer && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold mb-3">About the Employer</h3>
                  <p className="font-medium text-gray-800">{job.employer.name}</p>
                  <p className="text-sm text-gray-500">{job.employer.email}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobDetails;