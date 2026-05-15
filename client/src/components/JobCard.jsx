import React from 'react';
import { Link } from 'react-router-dom';

const JobCard = ({ job }) => {
  const formatSalary = (salary) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(salary);
  };

  const getExperienceBadgeColor = (level) => {
    const colors = {
      Entry: 'bg-green-100 text-green-800',
      Mid: 'bg-blue-100 text-blue-800',
      Senior: 'bg-purple-100 text-purple-800',
      Lead: 'bg-orange-100 text-orange-800',
      Executive: 'bg-red-100 text-red-800',
    };
    return colors[level] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden">
      <div className="p-6">
        {/* Job Title */}
        <Link to={`/jobs/${job._id}`}>
          <h3 className="text-xl font-semibold text-gray-800 hover:text-blue-600 transition mb-2">
            {job.title}
          </h3>
        </Link>

        {/* Company Name */}
        <p className="text-gray-600 mb-3">
          {job.employer?.name || 'Company'}
        </p>

        {/* Location and Salary */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center text-gray-600">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{job.location}</span>
          </div>
          
          <div className="flex items-center text-gray-600">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{formatSalary(job.salary)}/year</span>
          </div>
        </div>

        {/* Job Metadata */}
        <div className="flex flex-wrap gap-2 mb-4">
          {job.employmentType && (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
              {job.employmentType}
            </span>
          )}
          {job.experienceLevel && (
            <span className={`px-2 py-1 text-xs rounded-full ${getExperienceBadgeColor(job.experienceLevel)}`}>
              {job.experienceLevel}
            </span>
          )}
          {job.requiredSkills?.slice(0, 3).map((skill, index) => (
            <span key={index} className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded-full">
              {skill}
            </span>
          ))}
          {job.requiredSkills?.length > 3 && (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
              +{job.requiredSkills.length - 3} more
            </span>
          )}
        </div>

        {/* Posted Time */}
        <div className="flex justify-between items-center text-sm text-gray-500">
          <span>Posted {new Date(job.createdAt).toLocaleDateString()}</span>
          <Link 
            to={`/jobs/${job._id}`}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            View Details →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default JobCard;