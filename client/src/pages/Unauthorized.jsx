import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Unauthorized = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Get role-specific dashboard link
  const getDashboardLink = () => {
    if (!user) return '/';
    return user.role === 'employer' ? '/dashboard/employer' : '/dashboard/candidate';
  };

  // Get role-specific message
  const getRoleMessage = () => {
    if (!user) return 'You need to login to access this page.';
    
    switch(user.role) {
      case 'employer':
        return 'This page is only available for candidates. As an employer, you can post jobs and review applications.';
      case 'candidate':
        return 'This page is only available for employers. As a candidate, you can browse and apply for jobs.';
      default:
        return 'You don\'t have permission to access this page.';
    }
  };

  // Get suggested actions
  const getSuggestedActions = () => {
    if (!user) {
      return [
        { label: 'Go to Login', link: '/login', primary: true },
        { label: 'Create an Account', link: '/register', primary: false }
      ];
    }
    
    if (user.role === 'employer') {
      return [
        { label: 'Go to Employer Dashboard', link: '/dashboard/employer', primary: true },
        { label: 'Post a New Job', link: '/dashboard/employer/jobs/new', primary: false }
      ];
    }
    
    return [
      { label: 'Go to Candidate Dashboard', link: '/dashboard/candidate', primary: true },
      { label: 'Browse Jobs', link: '/jobs', primary: false }
    ];
  };

  const suggestedActions = getSuggestedActions();

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-gray-100 flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Red Header Bar */}
          <div className="bg-red-600 px-6 py-4">
            <div className="flex items-center justify-center">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>

          {/* Content */}
          <div className="p-8 text-center">
            {/* Lock Icon */}
            <div className="mb-6">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              Access Denied
            </h1>
            
            {/* Subtitle */}
            <p className="text-gray-600 mb-4">
              403 - Unauthorized Access
            </p>

            {/* Message */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-gray-700">
                {getRoleMessage()}
              </p>
            </div>

            {/* User Info (if logged in) */}
            {user && (
              <div className="mb-6 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  Logged in as: <span className="font-semibold text-gray-800">{user.email}</span>
                </p>
                <p className="text-sm text-gray-600">
                  Account type: <span className="font-semibold capitalize text-blue-600">{user.role}</span>
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              {suggestedActions.map((action, index) => (
                <Link
                  key={index}
                  to={action.link}
                  className={`block w-full px-6 py-3 rounded-lg font-medium transition duration-200 ${
                    action.primary
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {action.label}
                </Link>
              ))}
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">or</span>
              </div>
            </div>

            {/* Additional Options */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => navigate(-1)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition text-sm"
              >
                ← Go Back
              </button>
              
              {user && (
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-red-600 hover:text-red-700 transition text-sm"
                >
                  Sign Out
                </button>
              )}
              
              <Link to="/" className="px-4 py-2 text-gray-600 hover:text-gray-800 transition text-sm">
                Home Page →
              </Link>
            </div>
          </div>
        </div>

        {/* Help Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-500">
            Need assistance? <Link to="/contact" className="text-blue-600 hover:underline">Contact Support</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;