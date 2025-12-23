// API configuration for backend connection
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  WS_URL: import.meta.env.VITE_WS_URL || 'ws://localhost:3001',
};

export const API_ENDPOINTS = {
  STATE: '/api/state',
  WS: '/ws',
};
