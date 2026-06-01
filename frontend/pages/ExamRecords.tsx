import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores';

export default function ExamRecords() {
  const { user } = useAuthStore();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetch('/api/exams/records', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(r => r.json())
      .then(data => { setRecords(data); setLoading(false); });
  }, [user]);

  const formatDate = (iso: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  if (!user) return <div className="p-6 text-gray-500">请先登录</div>;
  if (loading) return <div className="p-6 text-gray-500">加载中...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📋 考试记录</h1>
        <Link to="/exams" className="text-indigo-600 hover:underline text-sm">
          ← 返回考试列表
        </Link>
      </div>

      {records.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">📝</div>
          <p>暂无考试记录</p>
          <Link to="/exams" className="mt-4 inline-block text-indigo-600 hover:underline">
            去参加考试 →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((r, idx) => (
            <div key={r.id} className="border border-gray-200 rounded-xl p-5 bg-white hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-gray-800">{r.title}</h3>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                    <span>考试时间：{formatDate(r.started_at)}</span>
                    {r.submitted_at && <span>交卷时间：{formatDate(r.submitted_at)}</span>}
                    <span>📝 {r.question_count}题</span>
                    <span>⏱ {r.duration}分钟</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 ml-4">
                  {r.status === 'submitted' ? (
                    <>
                      <span className={`text-lg font-bold ${
                        r.score >= r.total_score * 0.8 ? 'text-green-600' :
                        r.score >= r.total_score * 0.6 ? 'text-yellow-600' : 'text-red-500'
                      }`}>
                        {r.score} / {r.total_score}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        r.score >= r.total_score * 0.8 ? 'bg-green-100 text-green-700' :
                        r.score >= r.total_score * 0.6 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'
                      }`}>
                        {r.score >= r.total_score * 0.8 ? '优秀' :
                         r.score >= r.total_score * 0.6 ? '良好' : '需努力'}
                      </span>
                      <Link
                        to={`/exams/${r.exam_id}?recordId=${r.id}`}
                        className="text-xs text-gray-400 hover:text-indigo-600"
                      >
                        查看详情
                      </Link>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-orange-500">进行中</span>
                      <Link
                        to={`/exams/${r.exam_id}?recordId=${r.id}`}
                        className="text-xs px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                      >
                        继续答题
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
