import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// 请求拦截器：添加Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：处理错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// 认证API
export const authApi = {
  register: (username: string, password: string) =>
    api.post('/auth/register', { username, password }),
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  getMe: () => api.get('/auth/me'),
  getUsers: () => api.get('/auth/users'),
  updateUserRole: (id: number, role: string) => api.put(`/auth/users/${id}/role`, { role }),
};

// 题目API
export const questionApi = {
  getList: (params?: { type?: string; language?: string; difficulty?: string; page?: number }) =>
    api.get('/questions', { params }),
  getById: (id: number) => api.get(`/questions/${id}`),
  create: (data: any) => api.post('/questions', data),
  update: (id: number, data: any) => api.put(`/questions/${id}`, data),
  delete: (id: number) => api.delete(`/questions/${id}`),
};

// 提交API
export const submissionApi = {
  submit: (data: { question_id: number; language?: string; code?: string; scratch_project?: any; answer?: string }) =>
    api.post('/submissions', data),
  getHistory: (params?: { question_id?: number; page?: number }) =>
    api.get('/submissions/history', { params }),
  getLeaderboard: () => api.get('/submissions/leaderboard'),
  getStats: () => api.get('/submissions/stats'),
  getAll: (params?: { question_id?: number; user_id?: number; page?: number }) =>
    api.get('/submissions/all', { params }),
  gradeSubmission: (id: number, data: { result: string; score: number; feedback?: string }) =>
    api.patch(`/submissions/${id}/grade`, data),
};

// 题单API
export const listApi = {
  getList: (params?: { page?: number; limit?: number }) => api.get('/lists', { params }),
  getById: (id: number) => api.get(`/lists/${id}`),
  getMy: () => api.get('/lists/my'),
  create: (data: { title: string; description?: string; question_ids?: number[] }) =>
    api.post('/lists', data),
  update: (id: number, data: any) => api.put(`/lists/${id}`, data),
  delete: (id: number) => api.delete(`/lists/${id}`),
};

// 比赛API
export const contestApi = {
  getList: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get('/contests', { params }),
  getById: (id: number) => api.get(`/contests/${id}`),
  join: (id: number) => api.post(`/contests/${id}/join`),
  getRanking: (id: number) => api.get(`/contests/${id}/ranking`),
  create: (data: any) => api.post('/contests', data),
  update: (id: number, data: any) => api.put(`/contests/${id}`, data),
  delete: (id: number) => api.delete(`/contests/${id}`),
};

export default api;
