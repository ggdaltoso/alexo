// API service for HTTP requests to backend
import { API_CONFIG, API_ENDPOINTS } from '../config/api';
import type { BackendState } from '../types';

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL;
  }

  async getState(): Promise<BackendState> {
    const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.STATE}`);
    if (!response.ok) {
      throw new Error('Failed to fetch state');
    }
    return response.json();
  }
}

export const apiService = new ApiService();
