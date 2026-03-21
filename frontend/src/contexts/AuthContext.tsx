'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authAPI, LoginCredentials } from '@/lib/api/auth';
import { apiClient } from '@/lib/api/client';
import toast from 'react-hot-toast';
import { portalAPI } from '@/lib/api/portal';

interface User {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  role: string;
  companyId?: string | { _id: string; name: string };
  departmentId?: string | { _id: string; name: string };
  isActive: boolean;
  enabledModules?: string[];
  customRoleId?: string;
  permissions?: { module: string; actions: string[] }[];
  notificationSettings?: {
    email: boolean;
    whatsapp: boolean;
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  ssoLogin: (token: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in on mount
    const currentUser = authAPI.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    }
    setLoading(false);
  }, []);

  const login = async (credentials: LoginCredentials) => {
    const startTime = Date.now();
    const minDelay = 800; // Minimum 800ms delay to prevent flash of errors
    
    try {
      const response = await authAPI.login(credentials);
      
      // Ensure minimum delay has passed
      const elapsed = Date.now() - startTime;
      if (elapsed < minDelay) {
        await new Promise(resolve => setTimeout(resolve, minDelay - elapsed));
      }
      
      if (response.success) {
        const { user, accessToken, refreshToken } = response.data;
        
        // Save tokens
        apiClient.setToken(accessToken);
        apiClient.setRefreshToken(refreshToken);
        
        // Save user with all properties
        const userWithActive = {
          ...user,
          isActive: user.isActive ?? true // Default to true if not provided
        };
        authAPI.saveUser(userWithActive);
        setUser(userWithActive);
        
        toast.success('Login successful!');
        
        portalAPI.clearBootstrapCache();
        router.push('/portal');
      } else {
        // Handle unsuccessful response
        toast.error(response.message || 'Login failed');
      }
    } catch (error: any) {
      // Ensure minimum delay has passed before showing error
      const elapsed = Date.now() - startTime;
      if (elapsed < minDelay) {
        await new Promise(resolve => setTimeout(resolve, minDelay - elapsed));
      }
      
      // Extract error message from response
      let errorMessage = 'Login failed. Please try again.';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      console.error('Login error:', error);
      // Don't show toast here - let the calling component handle it
      
      // Re-throw to let the calling component know there was an error
      throw error;
    }
  };

  const ssoLogin = async (token: string) => {
    setLoading(true);
    try {
      const response = await authAPI.verifySSOToken(token);
      
      if (response.success) {
        const { user, accessToken, refreshToken } = response.data;
        
        // Save tokens
        apiClient.setToken(accessToken);
        apiClient.setRefreshToken(refreshToken);
        
        // Save user with all properties
        const userWithActive = {
          ...user,
          isActive: user.isActive ?? true
        };
        authAPI.saveUser(userWithActive);
        setUser(userWithActive);
        
        toast.success('SSO Login successful!');
        
        portalAPI.clearBootstrapCache();
        router.push('/portal');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'SSO Login failed.';
      toast.error(message);
      router.push('/'); // Redirect to home if failed
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const response = await authAPI.getCurrentProfile();
      if (response.success && response.data.user) {
        const updatedUser = {
          ...response.data.user,
          isActive: response.data.user.isActive ?? true
        };
        authAPI.saveUser(updatedUser);
        setUser(updatedUser);
      }
    } catch (error) {
      console.error('Failed to refresh user profile:', error);
    }
  };

  const logout = () => {
    portalAPI.clearBootstrapCache();
    authAPI.logout();
    setUser(null);
    router.push('/');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        ssoLogin,
        logout,
        refreshUser,
        isAuthenticated: !!user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
