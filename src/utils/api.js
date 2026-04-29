import axios from 'axios';

const api = axios.create();

let getRefreshToken;

export const setRefreshTokenGetter = (getter) => {
  getRefreshToken = getter;
};

api.interceptors.request.use(
  (config) => {
    const apiUrl = process.env.REACT_APP_API_URL;
    if (apiUrl && config.url && config.url.startsWith(apiUrl)) {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const apiUrl = process.env.REACT_APP_API_URL;

    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = typeof getRefreshToken === 'function' ? getRefreshToken() : null;
        if (refreshToken && apiUrl) {
          const response = await axios.post(`${apiUrl}/base/api/token/refresh/`, { refresh: refreshToken });

          if (response.status === 200) {
            const newAccessToken = response.data.access;
            localStorage.setItem('accessToken', newAccessToken);
            api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
            originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
            return api(originalRequest);
          }
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Token refresh failed', err);
        }
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.error(error);
    }

    return Promise.reject(error);
  }
);

export default api;
