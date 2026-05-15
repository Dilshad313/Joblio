import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Navbar';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import JobDetails from './pages/JobDetails';
import Profile from './pages/Profile';

// Dashboard Pages
import CandidateDashboard from './pages/Dashboard/CandidateDashboard';
import EmployerDashboard from './pages/Dashboard/EmployerDashboard';
import PostJob from './pages/Dashboard/PostJob';
import EditJob from './pages/Dashboard/EditJob';
import ApplicantsList from './pages/Dashboard/ApplicantsList';

// Error Pages
import NotFound from './pages/NotFound';
import Unauthorized from './pages/Unauthorized';

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/jobs/:id" element={<JobDetails />} />
            
            
            {/* Protected Routes - All authenticated users */}
            <Route path="/profile" element={
              <PrivateRoute>
                <Profile />
              </PrivateRoute>
            } />
            
            {/* Candidate Only Routes */}
            <Route path="/dashboard/candidate" element={
              <PrivateRoute allowedRoles={['candidate']}>
                <CandidateDashboard />
              </PrivateRoute>
            } />
            
            {/* Employer Only Routes */}
            <Route path="/dashboard/employer" element={
              <PrivateRoute allowedRoles={['employer']}>
                <EmployerDashboard />
              </PrivateRoute>
            } />
            
            <Route path="/dashboard/employer/jobs/new" element={
              <PrivateRoute allowedRoles={['employer']}>
                <PostJob />
              </PrivateRoute>
            } />
            
            <Route path="/dashboard/employer/jobs/:id/edit" element={
              <PrivateRoute allowedRoles={['employer']}>
                <EditJob />
              </PrivateRoute>
            } />
            
            <Route path="/dashboard/employer/jobs/:jobId/applicants" element={
              <PrivateRoute allowedRoles={['employer']}>
                <ApplicantsList />
              </PrivateRoute>
            } />
            
            {/* Catch all - 404 Not Found */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;