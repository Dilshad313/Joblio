import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import JobCard from '../components/JobCard';
import JobFilters from '../components/JobFilters';
import api from '../services/api';

const Home = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    location: '',
    minSalary: 0,
    employmentType: '',
    experienceLevel: ''
  });

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, jobs]);

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/jobs');
      setJobs(response.data.jobs || response.data);
      setFilteredJobs(response.data.jobs || response.data);
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
      setError(err.response?.data?.error || 'Failed to load jobs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...jobs];

    // Search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(job =>
        job.title.toLowerCase().includes(searchTerm) ||
        job.description?.toLowerCase().includes(searchTerm) ||
        job.employer?.name?.toLowerCase().includes(searchTerm)
      );
    }

    // Location filter
    if (filters.location) {
      filtered = filtered.filter(job =>
        job.location.toLowerCase().includes(filters.location.toLowerCase())
      );
    }

    // Salary filter
    if (filters.minSalary > 0) {
      filtered = filtered.filter(job => job.salary >= filters.minSalary);
    }

    // Employment type filter
    if (filters.employmentType) {
      filtered = filtered.filter(job => job.employmentType === filters.employmentType);
    }

    // Experience level filter
    if (filters.experienceLevel) {
      filtered = filtered.filter(job => job.experienceLevel === filters.experienceLevel);
    }

    setFilteredJobs(filtered);
  };

  const handleSearch = () => {
    applyFilters();
  };

  const handleViewJob = (jobId) => {
    navigate(`/jobs/${jobId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Find Your Dream Job Today
          </h1>
          <p className="text-xl mb-8 text-blue-100">
            Thousands of jobs waiting for you. Start your career journey now.
          </p>
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg p-1 flex">
              <input
                type="text"
                placeholder="Search by job title, company, or keyword..."
                className="flex-1 px-4 py-3 text-gray-800 rounded-l-lg focus:outline-none"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button
                onClick={handleSearch}
                className="bg-blue-600 text-white px-6 py-3 rounded-r-lg hover:bg-blue-700 transition"
              >
                Search
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar */}
          <div className="lg:w-1/4">
            <JobFilters
              filters={filters}
              setFilters={setFilters}
              onSearch={handleSearch}
            />
          </div>

          {/* Jobs List */}
          <div className="lg:w-3/4">
            {/* Results Header */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  {filteredJobs.length} Job{filteredJobs.length !== 1 ? 's' : ''} Found
                </h2>
                {filters.search && (
                  <p className="text-sm text-gray-600">
                    Searching for: "{filters.search}"
                  </p>
                )}
              </div>
              <select
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                onChange={(e) => {
                  const sortBy = e.target.value;
                  const sorted = [...filteredJobs];
                  if (sortBy === 'newest') {
                    sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                  } else if (sortBy === 'oldest') {
                    sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                  } else if (sortBy === 'salary-high') {
                    sorted.sort((a, b) => b.salary - a.salary);
                  } else if (sortBy === 'salary-low') {
                    sorted.sort((a, b) => a.salary - b.salary);
                  }
                  setFilteredJobs(sorted);
                }}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="salary-high">Highest Salary</option>
                <option value="salary-low">Lowest Salary</option>
              </select>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-600">Loading jobs...</p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
                <p>{error}</p>
                <button
                  onClick={fetchJobs}
                  className="mt-2 text-sm font-semibold hover:underline"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* No Results */}
            {!loading && !error && filteredJobs.length === 0 && (
              <div className="text-center py-12 bg-white rounded-lg">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No jobs found</h3>
                <p className="text-gray-500">
                  Try adjusting your filters or search terms
                </p>
                <button
                  onClick={() => {
                    setFilters({
                      search: '',
                      location: '',
                      minSalary: 0,
                      employmentType: '',
                      experienceLevel: ''
                    });
                  }}
                  className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                >
                  Clear all filters
                </button>
              </div>
            )}

            {/* Jobs Grid */}
            {!loading && !error && filteredJobs.length > 0 && (
              <div className="space-y-4">
                {filteredJobs.map(job => (
                  <div key={job._id} onClick={() => handleViewJob(job._id)} className="cursor-pointer">
                    <JobCard job={job} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;