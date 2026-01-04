import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { Platform } from 'react-native';

const API_URL = Platform.OS === 'web' 
  ? (typeof window !== 'undefined' && window.location.origin.includes('boxbuddy.walther.haus') 
      ? 'https://boxbuddy.walther.haus/api' 
      : 'http://localhost:5000')
  : 'http://localhost:5000';

// Configure axios to send credentials (cookies)
axios.defaults.withCredentials = true;

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Setup axios interceptor to handle 401 errors
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      response => response,
      error => {
        if (error.response && error.response.status === 401) {
          // Session expired or user not authenticated
          console.log('401 Unauthorized - session expired');
          setUser(null);
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  // Check if user is logged in on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await axios.get(`${API_URL}/auth/me`);
      setUser(response.data);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email,
      password
    });
    setUser(response.data);
    return response.data;
  };

  const register = async (email, password, preferred_language = 'en') => {
    const response = await axios.post(`${API_URL}/auth/register`, {
      email,
      password,
      preferred_language
    });
    setUser(response.data);
    return response.data;
  };

  const logout = async () => {
    try {
      await axios.post(`${API_URL}/auth/logout`);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
    }
  };

  const updateUser = async (updates) => {
    const response = await axios.put(`${API_URL}/auth/me`, updates);
    setUser(response.data);
    return response.data;
  };

  const createEntity = async (name) => {
    const response = await axios.post(`${API_URL}/auth/entities`, { name });
    // Refresh user data to get updated entities
    await checkAuth();
    return response.data;
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    createEntity,
    checkAuth
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
