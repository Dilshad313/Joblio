import React, { useState } from 'react';

const JobFilters = ({ filters, setFilters, onSearch }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const locations = ['Remote', 'Hybrid', 'On-site', 'New York', 'San Francisco', 'London', 'Bangalore'];
  const employmentTypes = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Freelance'];
  const experienceLevels = ['Entry', 'Mid', 'Senior', 'Lead', 'Executive'];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleRangeChange = (e) => {
    const { value } = e.target;
    setFilters(prev => ({ ...prev, minSalary: parseInt(value) }));
  };

  const handleLocationSelect = (location) => {
    setFilters(prev => ({ ...prev, location: prev.location === location ? '' : location }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      location: '',
      minSalary: 0,
      employmentType: '',
      experienceLevel: ''
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSearch) onSearch();
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <form onSubmit={handleSubmit}>
        {/* Search Input */}
        <div className="mb-4">
          <label className="block text-gray-700 font-medium mb-2">Search Jobs</label>
          <div className="relative">
            <input
              type="text"
              name="search"
              value={filters.search || ''}
              onChange={handleInputChange}
              placeholder="Job title, keywords, or company..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg className="absolute right-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Expand/Collapse Button */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-blue-600 text-sm font-medium mb-3 flex items-center"
        >
          {isExpanded ? '▲ Less Filters' : '▼ More Filters'}
        </button>

        {/* Advanced Filters */}
        {isExpanded && (
          <div className="space-y-4 border-t pt-4">
            {/* Location Filter */}
            <div>
              <label className="block text-gray-700 font-medium mb-2">Location</label>
              <div className="flex flex-wrap gap-2">
                {locations.map(location => (
                  <button
                    key={location}
                    type="button"
                    onClick={() => handleLocationSelect(location)}
                    className={`px-3 py-1 rounded-full text-sm transition ${
                      filters.location === location
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {location}
                  </button>
                ))}
              </div>
            </div>

            {/* Employment Type */}
            <div>
              <label className="block text-gray-700 font-medium mb-2">Employment Type</label>
              <select
                name="employmentType"
                value={filters.employmentType || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                {employmentTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Experience Level */}
            <div>
              <label className="block text-gray-700 font-medium mb-2">Experience Level</label>
              <select
                name="experienceLevel"
                value={filters.experienceLevel || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Levels</option>
                {experienceLevels.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>

            {/* Salary Range */}
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Minimum Salary: ${(filters.minSalary || 0).toLocaleString()}
              </label>
              <input
                type="range"
                name="minSalary"
                min="0"
                max="200000"
                step="10000"
                value={filters.minSalary || 0}
                onChange={handleRangeChange}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>$0</span>
                <span>$50k</span>
                <span>$100k</span>
                <span>$150k</span>
                <span>$200k+</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            type="submit"
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Search Jobs
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            Clear
          </button>
        </div>
      </form>

      {/* Active Filters Display */}
      {(filters.search || filters.location || filters.minSalary > 0 || filters.employmentType || filters.experienceLevel) && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm text-gray-600 mb-2">Active Filters:</p>
          <div className="flex flex-wrap gap-2">
            {filters.search && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                Search: {filters.search}
              </span>
            )}
            {filters.location && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                Location: {filters.location}
              </span>
            )}
            {filters.minSalary > 0 && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                Min Salary: ${filters.minSalary.toLocaleString()}
              </span>
            )}
            {filters.employmentType && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                Type: {filters.employmentType}
              </span>
            )}
            {filters.experienceLevel && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                Level: {filters.experienceLevel}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default JobFilters;