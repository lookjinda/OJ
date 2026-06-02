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
    if (error.response?.status === 401 && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// 认证API
export const authApi = {
  getCaptcha: () => api.get('/auth/captcha'),
  register: (data: { username: string; password: string; email?: string; phone?: string; captchaId: string; captchaCode: string }) =>
    api.post('/auth/register', data),
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  resetPassword: (data: { username: string; password: string; email?: string; phone?: string }) =>
    api.post('/auth/reset-password', data),
  changePassword: (password: string) => api.put('/auth/password', { password }),
  getMe: () => api.get('/auth/me'),
  getUsers: () => api.get('/auth/users'),
  updateUserRole: (id: number, role: string) => api.put(`/auth/users/${id}/role`, { role }),
};

// 题目API
export const questionApi = {
  getList: (params?: { type?: string; language?: string; difficulty?: string; search?: string; qid?: string; tag?: string; source?: string; page?: number; limit?: number }) =>
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
  getPublic: (params?: { question_id?: number; username?: string; page?: number; limit?: number }) =>
    api.get('/submissions/public', { params }),
  getById: (id: number) => api.get(`/submissions/${id}`),
  getLeaderboard: () => api.get('/submissions/leaderboard'),
  getStats: () => api.get('/submissions/stats'),
  getAll: (params?: { question_id?: number; user_id?: number; page?: number }) =>
    api.get('/submissions/all', { params }),
  gradeSubmission: (id: number, data: { result: string; score: number; feedback?: string }) =>
    api.patch(`/submissions/${id}/grade`, data),
};

// 站点API
export const siteApi = {
  getHomeMeta: () => api.get('/site/home-meta'),
  getSettings: () => api.get('/site/settings'),
  updateSettings: (data: Record<string, string | number | boolean>) => api.put('/site/settings', data),
  getAnnouncements: () => api.get('/site/announcements'),
  createAnnouncement: (data: { title: string; content?: string; priority?: number; is_active?: number | boolean }) =>
    api.post('/site/announcements', data),
  updateAnnouncement: (id: number, data: { title?: string; content?: string; priority?: number; is_active?: number | boolean }) =>
    api.put(`/site/announcements/${id}`, data),
  deleteAnnouncement: (id: number) => api.delete(`/site/announcements/${id}`),
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

// 小组API
export const groupApi = {
  getManaged: () => api.get('/groups'),
  getMy: () => api.get('/groups/my'),
  getAll: () => api.get('/groups/all'),
  getById: (id: number) => api.get(`/groups/${id}`),
  create: (data: { name: string; description?: string }) => api.post('/groups', data),
  update: (id: number, data: { name?: string; description?: string }) => api.put(`/groups/${id}`, data),
  delete: (id: number) => api.delete(`/groups/${id}`),
  join: (id: number) => api.post(`/groups/${id}/join`),
  leave: (id: number) => api.delete(`/groups/${id}/membership`),
  reviewMember: (groupId: number, memberId: number, action: 'approve' | 'reject') =>
    api.post(`/groups/${groupId}/members/${memberId}/review`, { action }),
  removeMember: (groupId: number, memberId: number) =>
    api.delete(`/groups/${groupId}/members/${memberId}`),
  createList: (groupId: number, data: { title: string; description?: string; question_ids?: number[] }) =>
    api.post(`/groups/${groupId}/lists`, data),
  updateList: (groupId: number, listId: number, data: { title?: string; description?: string; question_ids?: number[] }) =>
    api.put(`/groups/${groupId}/lists/${listId}`, data),
  deleteList: (groupId: number, listId: number) => api.delete(`/groups/${groupId}/lists/${listId}`),
  getList: (groupId: number, listId: number) => api.get(`/groups/${groupId}/lists/${listId}`),
  addQuestions: (groupId: number, listId: number, question_ids: number[]) =>
    api.post(`/groups/${groupId}/lists/${listId}/questions`, { question_ids }),
  removeQuestion: (groupId: number, listId: number, questionId: number) =>
    api.delete(`/groups/${groupId}/lists/${listId}/questions/${questionId}`),
};

export default api;
