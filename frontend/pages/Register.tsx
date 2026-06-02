import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Phone, RefreshCw, ShieldCheck, User, Lock } from 'lucide-react';
import { authApi } from '../utils/api';
import { useAuthStore } from '../stores';

type ContactType = 'phone' | 'email';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [contactType, setContactType] = useState<ContactType>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaSvg, setCaptchaSvg] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    loadCaptcha();
  }, []);

  const loadCaptcha = async () => {
    const res = await authApi.getCaptcha();
    setCaptchaId(res.data.captchaId);
    setCaptchaSvg(res.data.svg);
    setCaptchaCode('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('两次密码输入不一致');
      return;
    }

    if (contactType === 'phone' && !phone.trim()) {
      setError('请输入手机号');
      return;
    }

    if (contactType === 'email' && !email.trim()) {
      setError('请输入邮箱');
      return;
    }

    if (!captchaCode.trim()) {
      setError('请输入图形验证码');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.register({
        username: username.trim(),
        password,
        phone: contactType === 'phone' ? phone.trim() : undefined,
        email: contactType === 'email' ? email.trim() : undefined,
        captchaId,
        captchaCode: captchaCode.trim(),
      });
      setAuth(res.data.user, res.data.token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || '注册失败');
      await loadCaptcha().catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  const contactIcon = contactType === 'phone' ? Phone : Mail;
  const ContactIcon = contactIcon;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8">
      <div className="max-w-md w-full px-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">创建账户</h1>
          <p className="text-gray-600 mt-2">注册新用户</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white shadow-sm rounded-lg p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
              {error}
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

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">验证方式</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setContactType('phone')}
                className={`px-3 py-2 rounded-lg border text-sm ${contactType === 'phone' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'}`}
              >
                手机号
              </button>
              <button
                type="button"
                onClick={() => setContactType('email')}
                className={`px-3 py-2 rounded-lg border text-sm ${contactType === 'email' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'}`}
              >
                邮箱
              </button>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">{contactType === 'phone' ? '手机号' : '邮箱'}</label>
            <div className="relative">
              <ContactIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={contactType === 'phone' ? 'tel' : 'email'}
                value={contactType === 'phone' ? phone : email}
                onChange={(e) => contactType === 'phone' ? setPhone(e.target.value) : setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder={contactType === 'phone' ? '请输入 11 位手机号' : '请输入邮箱地址'}
                required
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="请输入密码（至少6位）"
                required
                minLength={6}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">确认密码</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="请再次输入密码"
                required
                minLength={6}
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">图形验证码</label>
            <div className="grid grid-cols-[1fr_128px_36px] gap-2">
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={captchaCode}
                  onChange={(e) => setCaptchaCode(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="验证码"
                  required
                />
              </div>
              <button
                type="button"
                onClick={loadCaptcha}
                className="h-10 border rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center"
                title="点击刷新验证码"
                dangerouslySetInnerHTML={{ __html: captchaSvg }}
              />
              <button type="button" onClick={loadCaptcha} className="h-10 border rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-50" title="刷新验证码">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '注册中...' : '注册'}
          </button>

          <div className="mt-4 text-center text-sm text-gray-600">
            已有账户？{' '}
            <Link to="/login" className="text-primary-600 hover:underline">
              立即登录
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
