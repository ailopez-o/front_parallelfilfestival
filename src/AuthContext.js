import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { setRefreshTokenGetter } from './utils/api'; // Import the custom Axios instance and the setter function

const AuthContext = createContext();
const STORAGE_KEYS = ['accessToken', 'refreshToken', 'username', 'email', 'is_superuser'];

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(localStorage.getItem('accessToken'));
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem('refreshToken'));
  const apiUrl = process.env.REACT_APP_API_URL;

  const refreshAccessToken = useCallback(async () => {
    if (!refreshToken || !apiUrl) {
      return null;
    }

    try {
      const response = await api.post(`${apiUrl}/base/api/token/refresh/`, { refresh: refreshToken });

      if (response.status === 200) {
        const data = response.data;
        localStorage.setItem('accessToken', data.access);
        setAccessToken(data.access);
        return data.access;
      } else {
        console.error('Token refresh failed.');
        logout();
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      logout();
    }
  }, [refreshToken, apiUrl]);

  useEffect(() => {
    setRefreshTokenGetter(() => refreshToken); // Provide the function to get the latest refresh token

    const initializeAuth = async () => {
      if (accessToken && apiUrl) {
        const validateToken = async (token) => {
          try {
            const response = await api.get(`${apiUrl}/base/api/validate_token/`, {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });
            return response.status === 200 ? response.data : null;
          } catch (error) {
            return null;
          }
        };

        let data = await validateToken(accessToken);

        if (!data && refreshToken) {
          const newAccessToken = await refreshAccessToken();
          if (newAccessToken) {
            data = await validateToken(newAccessToken);
          }
        }

        if (data) {
          setIsLoggedIn(true);
          setUser({ username: data.user.username, email: data.user.email, is_superuser: data.user.is_superuser });
        } else {
          console.log('Token validation failed');
          logout();
        }
      }
    };

    initializeAuth();
  }, [accessToken, refreshToken, apiUrl, refreshAccessToken]);

  const login = async (username, password) => {
    if (!apiUrl) {
      return 'API URL is not configured';
    }

    try {
      const response = await api.post(`${apiUrl}/base/api/token/`, { username, password });

      if (response.status === 200) {
        const data = response.data;
        localStorage.setItem('accessToken', data.access);
        localStorage.setItem('refreshToken', data.refresh);
        localStorage.setItem('username', data.username);
        localStorage.setItem('email', data.email);
        localStorage.setItem('is_superuser', data.is_superuser);
        setAccessToken(data.access);
        setRefreshToken(data.refresh);
        setIsLoggedIn(true);
        setUser({ username: data.username });
        return null; // No error
      } else {
        console.error('Login failed.');
        return 'Login failed'; // Return error message
      }
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage =
        typeof error.response?.data === 'object'
          ? error.response?.data?.detail || 'Login error'
          : error.response?.data || 'Login error';
      return errorMessage; // Return error details as a string
    }
  };

  const register = async (username, email, password) => {
    if (!apiUrl) {
      return 'API URL is not configured';
    }

    try {
      const response = await api.post(`${apiUrl}/base/api/register/`, { username, email, password });

      if (response.status === 201) { // Assuming 201 Created is returned on successful registration
        console.log('Registration successful.');
        return null; // No error
      } else {
        console.error('Registration failed.');
        return 'Registration failed'; // Return error message
      }
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage =
        typeof error.response?.data === 'object'
          ? error.response?.data?.detail || 'Registration error'
          : error.response?.data || 'Registration error';
      return errorMessage; // Return error details as a string
    }
  };

  const logout = () => {
    STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    setIsLoggedIn(false);
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, user, login, logout, register, accessToken, refreshAccessToken }}>
      {children}
    </AuthContext.Provider>
  );
};
