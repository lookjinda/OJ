import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Clock, FileText, ListChecks, Search, Settings, Trophy, X } from 'lucide-react';
import { useAuthStore } from '../stores';

export default function Exams() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'list' | 'records'>('list');
  const [exams, setExams] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [language, setLanguage] = useState('全部');
  const [contest, setContest] = useState('全部');

  const languageOptions = ['全部', '图形化', 'Scratch', 'Python', 'C++', '其他'];
  const contestOptions = ['全部', '电子学会', 'GESP', '数字守艺人', '信息素养大赛', '其他'];

  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (language !== '全部') params.set('language', language);
    if (contest !== '全部') params.set('contest', contest);

    setLoading(true);
    fetch(`/api/exams?${params.toString()}`)
      .then(r => r.json())
      .then(data => { setExams(Array.isArray(data) ? data : []); })
      .catch(() => setExams([]))
      .finally(() => setLoading(false));
  }, [search, language, contest]);

  useEffect(() => {
    if (tab === 'records') {
      if (!user) {
        setRecords([]);
        return;
      }
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

  const hasFilters = search.trim() || language !== '全部' || contest !== '全部';
  const clearFilters = () => {
    setSearch('');
    setLanguage('全部');
    setContest('全部');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">考试中心</h1>
          <p className="text-sm text-gray-500 mt-1">浏览试卷、进入考试、查看个人考试记录</p>
        </div>
        {(user?.role === 'admin' || user?.role === 'teacher') && (
          <Link to="/admin?tab=exams" className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm hover:bg-sky-700">
            <Settings className="w-4 h-4" />
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
              ? 'border-sky-600 text-sky-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          考试列表
        </button>
        <button
          onClick={() => setTab('records')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
            tab === 'records'
              ? 'border-sky-600 text-sky-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          我的记录
        </button>
      </div>

      {/* 考试列表 */}
      {tab === 'list' && (
        <>
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-5">
            <div className="grid gap-3 lg:grid-cols-[1fr_160px_180px_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  placeholder="搜索考试卷名称、描述、语言或来源"
                />
              </div>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                aria-label="按编程语言筛选"
              >
                {languageOptions.map((item) => (
                  <option key={item} value={item}>{item === '全部' ? '全部语言' : item}</option>
                ))}
              </select>
              <select
                value={contest}
                onChange={(e) => setContest(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                aria-label="按真题来源筛选"
              >
                {contestOptions.map((item) => (
                  <option key={item} value={item}>{item === '全部' ? '全部来源' : item}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasFilters}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                title="清空筛选"
              >
                <X className="w-4 h-4" />
                清空
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {languageOptions.filter(item => item !== '全部').map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setLanguage(item)}
                  className={`px-2.5 py-1 rounded border ${
                    language === item ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {item}
                </button>
              ))}
              {contestOptions.filter(item => item !== '全部').map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setContest(item)}
                  className={`px-2.5 py-1 rounded border ${
                    contest === item ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="p-6 text-gray-500">加载中...</div>
          ) : exams.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white border rounded-lg">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>{hasFilters ? '没有找到匹配的考试卷' : '暂无考试'}</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {exams.map(exam => (
                <div key={exam.id} className="border border-gray-200 rounded-lg p-5 bg-white hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">{exam.title}</h3>
                      {exam.description && <p className="text-gray-500 text-sm mt-1">{exam.description}</p>}
                      <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
                        {exam.difficulty && <span className="px-2 py-0.5 bg-gray-100 rounded">难度: {exam.difficulty}</span>}
                        {exam.language_category && <span className="px-2 py-0.5 bg-sky-50 text-sky-700 rounded">{exam.language_category}</span>}
                        {exam.contest_category && <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded">{exam.contest_category}</span>}
                        <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{exam.duration}分钟</span>
                        <span className="inline-flex items-center gap-1"><ListChecks className="w-3.5 h-3.5" />{exam.question_count}题</span>
                        <span className="inline-flex items-center gap-1"><Trophy className="w-3.5 h-3.5" />{exam.total_score}分</span>
                      </div>
                    </div>
                    <Link
                      to={`/exams/${exam.id}`}
                      className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm hover:bg-sky-700 whitespace-nowrap"
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
          {!user ? (
            <div className="text-center py-16 text-gray-500 bg-white border rounded-lg">
              <p>登录后可以查看你的考试记录</p>
              <Link to="/login" className="mt-4 inline-flex px-4 py-2 rounded-lg bg-sky-600 text-white text-sm hover:bg-sky-700">
                去登录
              </Link>
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white border rounded-lg">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
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
                          ? <span className="font-semibold text-sky-700">{rec.score} / {rec.total_score}</span>
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
                          className="text-sky-700 hover:text-sky-900 text-xs"
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
