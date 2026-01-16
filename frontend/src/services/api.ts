import axios from 'axios';

// Backend API endpoints
export const API_ENDPOINTS = {
  SAM_REMOVER: 'http://localhost:5001',
  INTERACTIVE_OVERLAY: 'http://localhost:5002',
  LINE_SELECTOR: 'http://localhost:5003',
};

// Create axios instances for each backend service
export const samAPI = axios.create({
  baseURL: API_ENDPOINTS.SAM_REMOVER,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const overlayAPI = axios.create({
  baseURL: API_ENDPOINTS.INTERACTIVE_OVERLAY,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const lineSelectorAPI = axios.create({
  baseURL: API_ENDPOINTS.LINE_SELECTOR,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add response interceptors for error handling
const handleApiError = (error: any) => {
  if (error.response) {
    // Server responded with error status
    console.error('API Error:', error.response.data);
    return Promise.reject({
      status: error.response.status,
      message: error.response.data.error || 'An error occurred',
      data: error.response.data,
    });
  } else if (error.request) {
    // Request made but no response
    console.error('Network Error:', error.request);
    return Promise.reject({
      status: 0,
      message: 'Network error - backend server may be offline',
    });
  } else {
    // Something else happened
    console.error('Error:', error.message);
    return Promise.reject({
      status: -1,
      message: error.message,
    });
  }
};

samAPI.interceptors.response.use((response) => response, handleApiError);
overlayAPI.interceptors.response.use((response) => response, handleApiError);
lineSelectorAPI.interceptors.response.use((response) => response, handleApiError);
