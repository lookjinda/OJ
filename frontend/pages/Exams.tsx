import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores';

export default function Exams() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'list' | 'records'>('list');
  const [exams, setExams] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/exams')
      .then(r => r.json())
      .then(data => { setExams(data); setLoading(false); });
  }, []);

  useEffect(() => {
    if (tab === 'records') {
      const token = localStorage.getItem('token');
      fetch('/api/exams/records', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(data => { setRecords(Array.isArray(data) ? data : []); });
    }
  }, [tab]);

  const getStatusBadge = (status: string) => {
    if (status === 'submitted') return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">已完成</span>;
    return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">进行中</span>;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📝 考试中心</h1>
        {user?.role === 'admin' && (
          <Link to="/admin?tab=exams" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
            管理考试
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setTab('list')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
            tab === 'list'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          考试列表
        </button>
        <button
          onClick={() => setTab('records')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
            tab === 'records'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          我的记录
        </button>
      </div>

      {/* 考试列表 */}
      {tab === 'list' && (
        <>
          {loading ? (
            <div className="p-6 text-gray-500">加载中...</div>
          ) : exams.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-5xl mb-4">📋</div>
              <p>暂无考试</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {exams.map(exam => (
                <div key={exam.id} className="border border-gray-200 rounded-xl p-5 bg-white hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">{exam.title}</h3>
                      {exam.description && <p className="text-gray-500 text-sm mt-1">{exam.description}</p>}
                      <div className="flex gap-3 mt-2 text-xs text-gray-400">
                        {exam.difficulty && <span className="px-2 py-0.5 bg-gray-100 rounded">难度: {exam.difficulty}</span>}
                        <span>⏱ {exam.duration}分钟</span>
                        <span>📝 {exam.question_count}题</span>
                        <span>💯 {exam.total_score}分</span>
                      </div>
                    </div>
                    <Link
                      to={`/exams/${exam.id}`}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 whitespace-nowrap"
                    >
                      进入考试
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 我的记录 */}
      {tab === 'records' && (
        <>
          {records.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-5xl mb-4">📭</div>
              <p>暂无考试记录</p>
              <p className="text-sm mt-1">去参加一场考试吧</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">考试名称</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">得分</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">状态</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">时长</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">交卷时间</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records.map(rec => (
                    <tr key={rec.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3.5 font-medium text-gray-800">{rec.title}</td>
                      <td className="px-4 py-3.5 text-center">
                        {rec.score !== null && rec.score !== undefined
                          ? <span className="font-semibold text-indigo-600">{rec.score} / {rec.total_score}</span>
                          : <span className="text-gray-400">—</span>
                        }
                      </td>
                      <td className="px-4 py-3.5 text-center">{getStatusBadge(rec.status)}</td>
                      <td className="px-4 py-3.5 text-center text-gray-400">{rec.duration}分钟</td>
                      <td className="px-5 py-3.5 text-gray-400">
                        {rec.submitted_at
                          ? new Date(rec.submitted_at).toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' })
                          : <span className="text-yellow-500">未交卷</span>
                        }
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Link
                          to={`/exams/${rec.exam_id}?recordId=${rec.id}`}
                          className="text-indigo-600 hover:text-indigo-800 text-xs"
                        >
                          查看详情
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
