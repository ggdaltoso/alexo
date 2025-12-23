// API configuration for backend connection
export const API_CONFIG = {
  // Use environment variables or fallback to relative URLs in production
  BASE_URL: import.meta.env.VITE_API_URL || '',
  WS_URL: import.meta.env.VITE_WS_URL || `ws://${window.location.host}`,
};

export const API_ENDPOINTS = {
  STATE: '/api/state',
  WS: '/ws',
};
