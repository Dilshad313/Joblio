import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 30000, // 30 seconds timeout
  withCredentials: true, // Send cookies with requests
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request queue for handling token refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor - Add auth token to headers
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    
    // If token exists, add to headers
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // For FormData, remove Content-Type to let browser set it with boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    
    // Add request timestamp for debugging
    config.metadata = { startTime: new Date() };
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle responses and errors
api.interceptors.response.use(
  (response) => {
    // Calculate request duration for debugging
    if (response.config.metadata) {
      const duration = new Date() - response.config.metadata.startTime;
      console.debug(`API Request: ${response.config.method?.toUpperCase()} ${response.config.url} - ${duration}ms`);
    }
    
    // Return response data directly for success cases
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Handle 401 Unauthorized errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't retry login/register requests
      if (originalRequest.url?.includes('/auth/login') || 
          originalRequest.url?.includes('/auth/register')) {
        return Promise.reject(error);
      }
      
      // If already refreshing, queue the request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }).catch(err => Promise.reject(err));
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      try {
        // Attempt to refresh token
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }
        
        const response = await axios.post(
          `${api.defaults.baseURL}/auth/refresh-token`,
          { refreshToken },
          { withCredentials: true }
        );
        
        if (response.data.success && response.data.token) {
          // Store new token
          localStorage.setItem('token', response.data.token);
          
          // Update authorization header
          api.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
          originalRequest.headers.Authorization = `Bearer ${response.data.token}`;
          
          // Process queued requests
          processQueue(null, response.data.token);
          
          // Retry original request
          return api(originalRequest);
        } else {
          throw new Error('Token refresh failed');
        }
      } catch (refreshError) {
        // Refresh failed - clear tokens and redirect to login
        processQueue(refreshError, null);
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        delete api.defaults.headers.common['Authorization'];
        
        // Redirect to login if not already there
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
        
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    
    // Handle 403 Forbidden errors
    if (error.response?.status === 403) {
      console.error('Access forbidden:', error.response?.data?.error);
      // Optionally redirect to unauthorized page
      // window.location.href = '/unauthorized';
    }
    
    // Handle 404 Not Found
    if (error.response?.status === 404) {
      console.error('Resource not found:', error.config.url);
    }
    
    // Handle 500 Server errors
    if (error.response?.status >= 500) {
      console.error('Server error:', error.response?.data?.error);
      // Show user-friendly message
      error.userMessage = 'Server error. Please try again later.';
    }
    
    // Handle network errors
    if (error.code === 'ECONNABORTED') {
      error.userMessage = 'Request timeout. Please check your connection.';
    } else if (error.message === 'Network Error') {
      error.userMessage = 'Network error. Please check your internet connection.';
    } else if (error.response?.data?.error) {
      error.userMessage = error.response.data.error;
    } else {
      error.userMessage = 'An unexpected error occurred. Please try again.';
    }
    
    return Promise.reject(error);
  }
);

// Helper function to handle file uploads with progress
export const uploadFile = async (url, file, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);
  
  return api.post(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percentCompleted);
      }
    },
  });
};

// Helper function to download file
export const downloadFile = async (url, filename) => {
  try {
    const response = await api.get(url, {
      responseType: 'blob',
    });
    
    // Create blob link to download
    const blob = new Blob([response.data]);
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
    
    return { success: true };
  } catch (error) {
    console.error('Download failed:', error);
    return { success: false, error: error.userMessage };
  }
};

// Helper function to get paginated data
export const getPaginatedData = async (url, page = 1, limit = 10, filters = {}) => {
  const params = new URLSearchParams({
    page,
    limit,
    ...filters,
  });
  
  const response = await api.get(`${url}?${params.toString()}`);
  return response.data;
};

// Helper function to handle API errors in components
export const handleApiError = (error, defaultMessage = 'Operation failed') => {
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  if (error.userMessage) {
    return error.userMessage;
  }
  if (error.message) {
    return error.message;
  }
  return defaultMessage;
};

// API endpoints organized by resource
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (userData) => api.post('/auth/register', userData),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) => api.post('/auth/reset-password', { token, newPassword }),
  refreshToken: () => api.post('/auth/refresh-token'),
};

export const jobsAPI = {
  getAll: (params) => api.get('/jobs', { params }),
  getById: (id) => api.get(`/jobs/${id}`),
  create: (data) => api.post('/jobs', data),
  update: (id, data) => api.put(`/jobs/${id}`, data),
  delete: (id) => api.delete(`/jobs/${id}`),
  close: (id) => api.patch(`/jobs/${id}/close`),
  open: (id) => api.patch(`/jobs/${id}/open`),
  getEmployerJobs: () => api.get('/jobs/employer/me'),
  getStatistics: (id) => api.get(`/jobs/${id}/statistics`),
  search: (searchParams) => api.post('/jobs/search', searchParams),
};

export const applicationsAPI = {
  apply: (jobId, data) => api.post(`/applications/apply/${jobId}`, data),
  getMyApplications: () => api.get('/applications/me'),
  getEmployerApplications: () => api.get('/applications/employer'),
  getPending: () => api.get('/applications/employer/pending'),
  getById: (id) => api.get(`/applications/${id}`),
  updateStatus: (applicationId, status, notes) => 
    api.patch('/applications/status', { applicationId, status, notes }),
  withdraw: (id) => api.delete(`/applications/${id}`),
  checkStatus: (jobId) => api.get(`/applications/check/${jobId}`),
  bulkUpdate: (applicationIds, status, notes) => 
    api.patch('/applications/bulk-status', { applicationIds, status, notes }),
  getJobStats: (jobId) => api.get(`/applications/job/${jobId}/stats`),
};

export const profileAPI = {
  getProfile: () => api.get('/profile/me'),
  updateProfile: (data) => api.put('/profile/me', data),
  changePassword: (currentPassword, newPassword) => 
    api.put('/profile/change-password', { currentPassword, newPassword }),
  getDashboardStats: () => api.get('/profile/dashboard-stats'),
  getActivity: (limit = 30) => api.get(`/profile/activity?limit=${limit}`),
  getResumeStatus: () => api.get('/profile/resume-status'),
  uploadResume: (file, onProgress) => uploadFile('/upload/resume', file, onProgress),
  deleteResume: () => api.delete('/upload/resume'),
  deleteAccount: (password) => api.delete('/profile/account', { data: { password } }),
  getApplicationHistory: () => api.get('/profile/application-history'),
};

export const uploadAPI = {
  uploadResume: (file, onProgress) => uploadFile('/upload/resume', file, onProgress),
  uploadLogo: (file, onProgress) => uploadFile('/upload/company-logo', file, onProgress),
  uploadPhoto: (file, onProgress) => uploadFile('/upload/photo', file, onProgress),
  deleteResume: () => api.delete('/upload/resume'),
  getResumeStatus: () => api.get('/upload/resume-status'),
};

// Default export with all APIs
export default api;