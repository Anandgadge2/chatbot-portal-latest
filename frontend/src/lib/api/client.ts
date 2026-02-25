import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

class APIClient {
  private client: AxiosInstance;

  private listeners: ((event: any) => void)[] = [];
  private isRefreshing = false;
  private pendingRefresh: Promise<string | null> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 20000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        // Emit request log
        this.emitLog({
          type: 'info',
          source: 'API_REQ',
          message: `${config.method?.toUpperCase()} ${config.url}`,
          timestamp: new Date().toISOString()
        });

        return config;
      },
      async (error) => {
        this.emitLog({
          type: 'error',
          source: 'API_ERR',
          message: `Request failed: ${error.message}`,
          timestamp: new Date().toISOString()
        });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        // Emit success log
        this.emitLog({
          type: 'success',
          source: 'API_RES',
          message: `${response.config.method?.toUpperCase()} ${response.config.url} ${response.status} OK`,
          timestamp: new Date().toISOString()
        });
        return response;
      },
      async (error) => {
        const status = error.response?.status || 'ERR';
        const method = error.config?.method?.toUpperCase() || '???';
        const url = error.config?.url || '???';

        this.emitLog({
          type: 'error',
          source: 'API_RES',
          message: `${method} ${url} ${status} - ${this.getFriendlyErrorMessage(error)}`,
          timestamp: new Date().toISOString()
        });

        if (error.response?.status === 401) {
          const originalConfig: any = error.config || {};
          const isAuthRoute = originalConfig?.url?.includes('/auth/login') ||
                              originalConfig?.url?.includes('/auth/sso') ||
                              originalConfig?.url?.includes('/auth/refresh');

          if (!isAuthRoute && !originalConfig._retry) {
            originalConfig._retry = true;
            const refreshed = await this.refreshAccessToken();
            if (refreshed) {
              originalConfig.headers = originalConfig.headers || {};
              originalConfig.headers.Authorization = `Bearer ${refreshed}`;
              return this.client(originalConfig);
            }
          }

          this.removeToken();
          if (typeof window !== 'undefined') {
            window.location.href = '/';
          }
        }
        return Promise.reject(error);
      }
    );
  }


  private getFriendlyErrorMessage(error: any): string {
    if (!error) return 'Unexpected error occurred. Please try again.';

    if (error.code === 'ECONNABORTED') {
      return 'The request timed out. Please check your connection and retry.';
    }

    const status = error?.response?.status;
    if (status === 400) return error?.response?.data?.message || 'Invalid request. Please verify your inputs.';
    if (status === 401) return 'Your session has expired. Please login again.';
    if (status === 403) return error?.response?.data?.message || 'You do not have permission to perform this action.';
    if (status === 404) return error?.response?.data?.message || 'Requested resource was not found.';
    if (status === 429) return 'Too many requests. Please wait a moment and try again.';
    if (status && status >= 500) return 'Server is currently unavailable. Please try again shortly.';

    return error?.response?.data?.message || error?.message || 'Something went wrong. Please try again.';
  }

  // Log Subscription System
  private emitLog(log: any) {
    this.listeners.forEach(cb => cb(log));
  }

  public subscribe(callback: (event: any) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }


  private getRefreshToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('refreshToken');
    }
    return null;
  }

  private async refreshAccessToken(): Promise<string | null> {
    if (this.pendingRefresh) return this.pendingRefresh;

    this.pendingRefresh = (async () => {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) return null;
      try {
        const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const nextAccess = response.data?.data?.accessToken;
        const nextRefresh = response.data?.data?.refreshToken;
        if (nextAccess) this.setToken(nextAccess);
        if (nextRefresh) this.setRefreshToken(nextRefresh);
        return nextAccess || null;
      } catch {
        return null;
      } finally {
        this.pendingRefresh = null;
      }
    })();

    return this.pendingRefresh;
  }

  private getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('accessToken');
    }
    return null;
  }

  private removeToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }
  }

  public setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', token);
    }
  }

  public setRefreshToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('refreshToken', token);
    }
  }

  public async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.get(url, config);
    return response.data;
  }

  public async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.post(url, data, config);
    return response.data;
  }

  public async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.put(url, data, config);
    return response.data;
  }

  public async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.patch(url, data, config);
    return response.data;
  }

  public async delete<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.delete(url, { ...config, data });
    return response.data;
  }
}

export const apiClient = new APIClient();
