import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export class APIClientError extends Error {
  status?: number;
  data?: any;
  response?: { status?: number; data?: any };

  constructor(message: string, status?: number, data?: any) {
    super(message);
    this.name = 'APIClientError';
    this.status = status;
    this.data = data;
    this.response = { status, data };
  }
}

class APIClient {
  private client: AxiosInstance;

  private listeners: ((event: any) => void)[] = [];

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        this.emitLog({
          type: 'info',
          source: 'API_REQ',
          message: `${config.method?.toUpperCase()} ${config.url}`,
          timestamp: new Date().toISOString()
        });

        return config;
      },
      (error) => {
        this.emitLog({
          type: 'error',
          source: 'API_ERR',
          message: `Request failed: ${error.message}`,
          timestamp: new Date().toISOString()
        });
        return Promise.reject(this.normalizeError(error));
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        this.emitLog({
          type: 'success',
          source: 'API_RES',
          message: `${response.config.method?.toUpperCase()} ${response.config.url} ${response.status} OK`,
          timestamp: new Date().toISOString()
        });
        return response;
      },
      (error) => {
        const normalizedError = this.normalizeError(error);
        const status = normalizedError.status || 'ERR';
        const method = error.config?.method?.toUpperCase() || '???';
        const url = error.config?.url || '???';

        this.emitLog({
          type: 'error',
          source: 'API_RES',
          message: `${method} ${url} ${status} - ${normalizedError.message}`,
          timestamp: new Date().toISOString()
        });

        if (normalizedError.status === 401) {
          const currentToken = this.getToken();
          const isLoginRequest = error.config?.url?.includes('/auth/login') ||
            error.config?.url?.includes('/auth/sso');

          if (currentToken && !isLoginRequest) {
            this.removeToken();
            if (typeof window !== 'undefined') {
              window.location.href = '/';
            }
          }
        }

        if (normalizedError.status === 403) {
          this.emitLog({
            type: 'warning',
            source: 'API_RES',
            message: `${method} ${url} 403 - Permission denied`,
            timestamp: new Date().toISOString()
          });
        }

        return Promise.reject(normalizedError);
      }
    );
  }

  private normalizeError(error: AxiosError | Error | any): APIClientError {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || error.message || 'Request failed';
      return new APIClientError(message, error.response?.status, error.response?.data);
    }

    if (error instanceof APIClientError) {
      return error;
    }

    return new APIClientError(error?.message || 'Request failed');
  }

  private emitLog(log: any) {
    this.listeners.forEach(cb => cb(log));
  }

  public subscribe(callback: (event: any) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
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
