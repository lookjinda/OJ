import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Lock, Mail, Phone, KeyRound } from 'lucide-react';
import { authApi } from '../utils/api';
import { useAuthStore } from '../stores';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [contactType, setContactType] = useState<'phone' | 'email'>('phone');
  const [contactValue, setContactValue] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await authApi.login(username, password);
      setAuth(res.data.user, res.data.token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 6) {
      setError('新密码长度至少6个字符');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword({
        username: username.trim(),
        password,
        [contactType]: contactValue.trim(),
      });
      setSuccess('密码已修改，请使用新密码登录');
      setMode('login');
      setPassword('');
      setConfirmPassword('');
      setContactValue('');
    } catch (err: any) {
      setError(err.response?.data?.error || '修改密码失败');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextMode: 'login' | 'reset') => {
    setMode(nextMode);
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full px-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {mode === 'login' ? '欢迎回来' : '修改密码'}
          </h1>
          <p className="text-gray-600 mt-2">
            {mode === 'login' ? '登录你的账户' : '使用用户名和绑定联系方式验证身份'}
          </p>
        </div>

        <form onSubmit={mode === 'login' ? handleSubmit : handleResetPassword} className="bg-white shadow-sm rounded-lg p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md text-sm">
              {success}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="请输入用户名"
                required
              />
            </div>
          </div>

          {mode === 'reset' && (
            <div className="mb-4">
              <div className="flex rounded-lg border border-gray-200 p-1 mb-3">
                <button
                  type="button"
                  onClick={() => setContactType('phone')}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                    contactType === 'phone' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  手机号
                </button>
                <button
                  type="button"
                  onClick={() => setContactType('email')}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                    contactType === 'email' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  邮箱
                </button>
              </div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {contactType === 'phone' ? '绑定手机号' : '绑定邮箱'}
              </label>
              <div className="relative">
                {contactType === 'phone' ? (
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                ) : (
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                )}
                <input
                  type={contactType === 'phone' ? 'tel' : 'email'}
                  value={contactValue}
                  onChange={(e) => setContactValue(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder={contactType === 'phone' ? '请输入注册手机号' : '请输入注册邮箱'}
                  required
                />
              </div>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {mode === 'login' ? '密码' : '新密码'}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder={mode === 'login' ? '请输入密码' : '请输入新密码'}
                required
              />
            </div>
          </div>

          {mode === 'reset' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">确认新密码</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="请再次输入新密码"
                  required
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (mode === 'login' ? '登录中...' : '修改中...') : (mode === 'login' ? '登录' : '确认修改')}
          </button>

          <div className="mt-4 text-center text-sm">
            {mode === 'login' ? (
              <button
                type="button"
                onClick={() => switchMode('reset')}
                className="text-primary-600 hover:underline"
              >
                修改密码
              </button>
            ) : (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-primary-600 hover:underline"
              >
                返回登录
              </button>
            )}
          </div>

          <div className="mt-4 text-center text-sm text-gray-600">
            还没有账户？{' '}
            <Link to="/register" className="text-primary-600 hover:underline">
              立即注册
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
