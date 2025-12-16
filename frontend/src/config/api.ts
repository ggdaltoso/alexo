// API configuration for backend connection
const isDevelopment = import.meta.env.DEV;

export const API_CONFIG = {
  // In production, backend runs on same host (Raspberry Pi)
  // In development, backend runs on different port
  BASE_URL: isDevelopment ? 'http://localhost:3001' : '',
  WS_URL: isDevelopment
    ? 'ws://localhost:3001'
    : `ws://${window.location.host}`,
};

export const API_ENDPOINTS = {
  STATE: '/api/state',
  WS: '/ws',
};
