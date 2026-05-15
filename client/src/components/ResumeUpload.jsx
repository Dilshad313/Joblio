import React, { useState, useEffect } from 'react';
import api from '../services/api';

const ResumeUpload = ({ onUploadSuccess, onUploadError }) => {
  const [resumeUrl, setResumeUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchResumeStatus();
  }, []);

  const fetchResumeStatus = async () => {
    try {
      const response = await api.get('/profile/resume-status');
      if (response.data.hasResume) {
        setResumeUrl(response.data.resumeUrl);
      }
    } catch (err) {
      console.error('Failed to fetch resume status:', err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload PDF, DOC, or DOCX files only');
      if (onUploadError) onUploadError('Invalid file type');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      if (onUploadError) onUploadError('File too large');
      return;
    }

    const formData = new FormData();
    formData.append('resume', file);

    setLoading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const response = await api.post('/upload/resume', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        },
      });

      if (response.data.success) {
        setResumeUrl(response.data.resumeUrl);
        if (onUploadSuccess) onUploadSuccess(response.data.resumeUrl);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Upload failed. Please try again.';
      setError(errorMessage);
      if (onUploadError) onUploadError(errorMessage);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteResume = async () => {
    if (!window.confirm('Are you sure you want to delete your resume?')) return;

    setLoading(true);
    try {
      await api.delete('/upload/resume');
      setResumeUrl(null);
      if (onUploadSuccess) onUploadSuccess(null);
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Delete failed. Please try again.';
      setError(errorMessage);
      if (onUploadError) onUploadError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleViewResume = () => {
    if (resumeUrl) {
      window.open(resumeUrl, '_blank');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">Resume / CV</h3>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {resumeUrl ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-3">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div>
                <p className="font-medium text-green-800">Resume Uploaded</p>
                <p className="text-sm text-green-600">Your resume is ready for applications</p>
              </div>
            </div>
            <span className="px-2 py-1 bg-green-200 text-green-800 text-xs rounded-full">Active</span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleViewResume}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              View Resume
            </button>
            <button
              onClick={handleDeleteResume}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
            >
              {loading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-gray-600 mb-2">No resume uploaded yet</p>
            <p className="text-sm text-gray-500 mb-4">Upload your resume to start applying for jobs</p>
            
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileUpload}
                disabled={loading}
                className="hidden"
              />
              <span className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                {loading ? 'Uploading...' : 'Upload Resume'}
              </span>
            </label>
          </div>

          {loading && (
            <div className="space-y-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 text-center">
                Uploading... {uploadProgress}%
              </p>
            </div>
          )}

          <div className="text-xs text-gray-500 text-center">
            Supported formats: PDF, DOC, DOCX (Max 5MB)
          </div>
        </div>
      )}

      {/* Upload Tips */}
      <div className="mt-6 pt-4 border-t">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Tips for a better resume:</h4>
        <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
          <li>Use a clear, professional format</li>
          <li>Highlight relevant skills and experience</li>
          <li>Keep it to 1-2 pages</li>
          <li>Save as PDF for best results</li>
        </ul>
      </div>
    </div>
  );
};

export default ResumeUpload;