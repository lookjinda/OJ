import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Code2, BookOpen, Trophy, User, LogOut, Flag, List, Settings } from 'lucide-react';
import { useAuthStore } from '../stores';
import { authApi } from '../utils/api';
import { useEffect, useState } from 'react';
import AIChat from './AIChat';

export default function Layout() {
  const { user, logout, setAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user?.role === 'admin' || user?.role === 'teacher';
  const [aiOpen, setAiOpen] = useState(false);

  // 页面加载时获取用户信息
  useEffect(() => {
    if (!user) {
      authApi.getMe().then((res) => {
        const token = localStorage.getItem('token');
        if (token) setAuth(res.data, token);
      }).catch(() => {});
    }
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: Code2, label: '题库', exact: true },
    { to: '/lists', icon: BookOpen, label: '题单' },
    { to: '/contests', icon: Flag, label: '比赛' },
    { to: '/exams', icon: List, label: '考试' },
    { to: '/leaderboard', icon: Trophy, label: '排行榜' },
  ];

  const isActive = (to: string, exact?: boolean) => {
    if (exact) return location.pathname === to;
    return location.pathname.startsWith(to);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* 顶部导航 */}
      <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link to="/" className="flex items-center space-x-2 text-indigo-600">
                <Code2 className="w-8 h-8" />
                <span className="text-xl font-bold">CodeArena</span>
              </Link>
              <div className="hidden md:flex space-x-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                        isActive(item.to, item.exact)
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
                {isAdmin && (
                  <Link
                    to="/admin"
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                      isActive('/admin')
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    <span>管理</span>
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/profile" className="text-gray-600 hover:text-indigo-600 flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100">
                <User className="w-4 h-4" />
                <span className="text-sm font-medium">{user?.username || '用户'}</span>
              </Link>
              <button
                onClick={handleLogout}
                className="text-gray-400 hover:text-red-500 flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm">退出</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* AI 助手悬浮按钮 */}
      <button
        onClick={() => setAiOpen(v => !v)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white text-xl transition-all duration-300 ${
          aiOpen ? 'bg-gray-600 rotate-0' : 'bg-gradient-to-br from-indigo-500 to-purple-600 hover:scale-110'
        }`}
        style={{ boxShadow: '0 4px 20px rgba(99,102,241,0.4)' }}
        title="小码老师 - AI 编程助手"
      >
        {aiOpen ? '✕' : <>
          <span className="text-lg">🤖</span>
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse" />
        </>}
      </button>

      {/* AI 聊天窗口 */}
      {aiOpen && (
        <div className="fixed bottom-24 right-6 z-50" style={{ animation: 'slideUp 0.25s ease-out' }}>
          <AIChat onClose={() => setAiOpen(false)} />
        </div>
      )}

      {/* 主内容 */}
      <main className="flex-1 bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}