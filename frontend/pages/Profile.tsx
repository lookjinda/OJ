import { useState, useEffect } from 'react';
import { User, Award, Target, TrendingUp } from 'lucide-react';
import { submissionApi, authApi } from '../utils/api';
import { useAuthStore } from '../stores';

interface Stats {
  total_score: number;
  solved_count: number;
  total_submissions: number;
  accept_rate: number;
}

interface Submission {
  id: number;
  question_title: string;
  language?: string;
  score: number;
  feedback?: string;
  result: string;
  created_at: string;
}

export default function Profile() {
  const { user, logout } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, historyRes] = await Promise.all([
        submissionApi.getStats(),
        submissionApi.getHistory(),
      ]);
      setStats(statsRes.data);
      setSubmissions(historyRes.data.submissions || []);
    } catch (err) {
      console.error('加载数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const resultColors: Record<string, string> = {
    accepted: 'bg-green-100 text-green-800',
    wrong: 'bg-red-100 text-red-800',
    error: 'bg-yellow-100 text-yellow-800',
  };

  const resultLabels: Record<string, string> = {
    accepted: '通过',
    wrong: '错误',
    error: '异常',
  };

  if (loading) {
    return <div className="max-w-4xl mx-auto px-4 py-8">加载中...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 用户信息 */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{user?.username}</h1>
            <p className="text-gray-500">ID: {user?.id}</p>
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center space-x-2 text-gray-500 mb-1">
              <Award className="w-4 h-4" />
              <span className="text-sm">总分数</span>
            </div>
            <p className="text-2xl font-bold text-primary-600">{stats.total_score}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center space-x-2 text-gray-500 mb-1">
              <Target className="w-4 h-4" />
              <span className="text-sm">解题数</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.solved_count}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center space-x-2 text-gray-500 mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm">通过率</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.accept_rate}%</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center space-x-2 text-gray-500 mb-1">
              <Target className="w-4 h-4" />
              <span className="text-sm">提交次数</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.total_submissions}</p>
          </div>
        </div>
      )}

      {/* 提交历史 */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">提交历史</h2>
        </div>
        {submissions.length === 0 ? (
          <div className="p-6 text-center text-gray-500">暂无提交记录</div>
        ) : (
          <div className="divide-y">
            {submissions.map((sub) => (
              <div key={sub.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{sub.question_title}</p>
                    <div className="flex items-center space-x-3 mt-1">
                      {sub.language && (
                        <span className="text-xs text-gray-500">{sub.language.toUpperCase()}</span>
                      )}
                      <span className="text-xs text-gray-500">
                        {new Date(sub.created_at).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    {sub.feedback && (
                      <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded text-sm text-amber-800">
                        <span className="font-medium text-xs">老师评语：</span>{sub.feedback}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-3 ml-4">
                    <span className={`px-2 py-1 text-xs rounded ${resultColors[sub.result]}`}>
                      {resultLabels[sub.result]}
                    </span>
                    <span className="text-sm font-medium text-primary-600">{sub.score}分</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}