import { Link } from 'react-router-dom';
import { CheckCircle, XCircle, MinusCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { questionApi } from '../utils/api';
import { useEffect, useState } from 'react';

interface Question {
  id: number;
  title: string;
  type: string;
  language: string | null;
  difficulty: string;
  points: number;
  tags: string | null;
  status: 'pass' | 'fail' | 'none';
}

export default function Home() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ type: '', language: '', difficulty: '' });
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize);

  useEffect(() => {
    setPage(1);
  }, [filters, search]);

  useEffect(() => {
    loadQuestions();
  }, [filters, search, page]);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const params: any = { ...filters, page, limit: pageSize };
      if (search) params.search = search;
      const res = await questionApi.getList(params);
      setQuestions(res.data.questions);
      setTotal(res.data.total);
    } catch (err) {
      console.error('加载题目失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const typeLabels: Record<string, string> = {
    programming: '编程题',
    choice: '选择题',
    fill: '填空题',
  };

  const typeColors: Record<string, string> = {
    programming: 'bg-blue-50 text-blue-700',
    choice: 'bg-purple-50 text-purple-700',
    fill: 'bg-orange-50 text-orange-700',
  };

  const difficultyColors: Record<string, string> = {
    easy: 'text-green-600',
    medium: 'text-yellow-600',
    hard: 'text-red-600',
  };

  const difficultyLabels: Record<string, string> = {
    easy: '简单',
    medium: '中等',
    hard: '困难',
  };

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-green-500" title="已通过" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-500" title="未通过" />;
      default:
        return <MinusCircle className="w-5 h-5 text-gray-300" title="未作答" />;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* 搜索栏 */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') setSearch(searchInput); }}
          placeholder="搜索题目..."
          className="w-full pl-10 pr-10 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
        {searchInput && (
          <button
            onClick={() => { setSearchInput(''); setSearch(''); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >✕</button>
        )}
      </div>

      {/* 筛选器 */}
      <div className="mb-6 flex flex-wrap gap-3 items-center">
        <select
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
        >
          <option value="">全部题型</option>
          <option value="programming">编程题</option>
          <option value="choice">选择题</option>
          <option value="fill">填空题</option>
        </select>
        <select
          value={filters.language}
          onChange={(e) => setFilters({ ...filters, language: e.target.value })}
          className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
        >
          <option value="">全部语言</option>
          <option value="python">Python</option>
          <option value="cpp">C++</option>
          <option value="scratch">Scratch</option>
        </select>
        <select
          value={filters.difficulty}
          onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
          className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
        >
          <option value="">全部难度</option>
          <option value="easy">简单</option>
          <option value="medium">中等</option>
          <option value="hard">困难</option>
        </select>
        {/* 总数 */}
        <div className="ml-auto text-sm text-gray-500">
          共 {total} 题
        </div>
      </div>

      {/* 题目列表 - 表格样式 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">加载中...</div>
      ) : questions.length === 0 ? (
        <div className="text-center py-12 text-gray-400">暂无题目</div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          {/* 表头 */}
          <div className="grid grid-cols-[40px_1fr_80px_80px_60px_60px] gap-2 px-4 py-3 bg-gray-50 border-b text-xs font-medium text-gray-500 uppercase tracking-wider">
            <div>状态</div>
            <div>题目</div>
            <div>题型</div>
            <div>语言</div>
            <div>难度</div>
            <div className="text-right">分值</div>
          </div>
          {/* 题目行 */}
          {questions.map((q) => (
            <Link
              key={q.id}
              to={`/question/${q.id}`}
              className="grid grid-cols-[40px_1fr_80px_80px_60px_60px] gap-2 px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors items-center group"
            >
              <div>
                <StatusIcon status={q.status} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm font-mono">{String(q.id).padStart(3, '0')}</span>
                <span className="font-medium text-gray-900 group-hover:text-primary-600 truncate">{q.title}</span>
              </div>
              <div>
                <span className={`px-2 py-0.5 text-xs rounded ${typeColors[q.type] || 'bg-gray-100 text-gray-600'}`}>
                  {typeLabels[q.type] || q.type}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                {q.language ? q.language.toUpperCase() : '-'}
              </div>
              <div className={`text-sm font-medium ${difficultyColors[q.difficulty] || 'text-gray-400'}`}>
                {difficultyLabels[q.difficulty] || q.difficulty}
              </div>
              <div className="text-right text-sm text-gray-500">
                {q.points}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .reduce<(number | string)[]>((acc, p, i, arr) => {
              if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
              acc.push(p);
              return acc;
            }, [])
            .map((p, i) =>
              typeof p === 'string' ? (
                <span key={`ellipsis-${i}`} className="px-2 text-gray-400">...</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`min-w-[36px] h-9 rounded-lg text-sm font-medium ${
                    page === p
                      ? 'bg-primary-600 text-white'
                      : 'border hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              )
            )}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
