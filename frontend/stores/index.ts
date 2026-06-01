import { create } from 'zustand';

interface User {
  id: number;
  username: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  setAuth: (user, token) => {
    localStorage.setItem('token', token);
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },
  isAuthenticated: () => !!get().token,
}));

interface SubmissionResult {
  id: number;
  result: string;
  score: number;
  feedback: string;
}

interface EditorState {
  code: string;
  scratchProject: any;
  language: 'python' | 'cpp' | 'scratch';
  setCode: (code: string) => void;
  setScratchProject: (project: any) => void;
  setLanguage: (lang: 'python' | 'cpp' | 'scratch') => void;
  submitResult: SubmissionResult | null;
  setSubmitResult: (result: SubmissionResult | null) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  code: '',
  scratchProject: null,
  language: 'python',
  setCode: (code) => set({ code }),
  setScratchProject: (project) => set({ scratchProject: project }),
  setLanguage: (language) => set({ language }),
  submitResult: null,
  setSubmitResult: (result) => set({ submitResult: result }),
}));
