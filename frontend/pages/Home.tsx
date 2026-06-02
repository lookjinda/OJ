import { Link } from 'react-router-dom';
import { CheckCircle, XCircle, MinusCircle, Search, ChevronLeft, ChevronRight, Megaphone, Tags, BarChart3 } from 'lucide-react';
import { questionApi, siteApi } from '../utils/api';
import { useEffect, useState } from 'react';

interface Question {
  id: number;
  title: string;
  type: string;
  language: string | null;
  difficulty: string;
  points: number;
  tags: string | null;
  source?: string;
  status: 'pass' | 'fail' | 'none';
  accepted_count: number;
  submission_count: number;
  ac_rate: number;
}

const difficultyLabels: Record<string, string> = { easy: '入门', medium: '普及-', hard: '提高+' };
const difficultyClasses: Record<string, string> = {
  easy: 'text-emerald-700 bg-emerald-50',
  medium: 'text-amber-700 bg-amber-50',
  hard: 'text-rose-700 bg-rose-50',
};

function StatusIcon({ status }: { status: string }) {
  if (status === 'pass') return <CheckCircle className="w-4 h-4 text-emerald-500" title="已通过" />;
  if (status === 'fail') return <XCircle className="w-4 h-4 text-rose-500" title="尝试过" />;
  return <MinusCircle className="w-4 h-4 text-gray-300" title="未提交" />;
}

function splitTags(tags?: string | null) {
  return String(tags || '').split(/[,，]/).map((tag) => tag.trim()).filter(Boolean);
}

export default function Home() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [meta, setMeta] = useState<any>({ announcements: [], tags: [], stats: {}, recommended_lists: [], settings: {} });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ qid: '', difficulty: '', tag: '' });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    siteApi.getHomeMeta().then((res) => setMeta(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filters, search]);

  useEffect(() => {
    loadQuestions();
  }, [filters, search, page]);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: pageSize };
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params[key] = value;
      });
      if (search) params.search = search;
      const res = await questionApi.getList(params);
      setQuestions(res.data.questions || []);
      setTotal(res.data.total || 0);
    } finally {
      setLoading(false);
    }
  };

  const selectTag = (tag: string) => {
    setFilters((current) => ({ ...current, tag }));
  };

  const runSearch = () => {
    const keyword = searchInput.trim();
    if (/^\d+$/.test(keyword)) {
      setFilters((current) => ({ ...current, qid: keyword }));
      setSearch('');
      return;
    }
    setFilters((current) => ({ ...current, qid: '' }));
    setSearch(keyword);
  };

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5">
      <section className="min-w-0">
        <div className="bg-white border rounded-lg">
          <div className="p-4 border-b">
            <div className="grid grid-cols-1 md:grid-cols-[120px_1fr_140px_110px] gap-3">
              <input
                value={filters.qid}
                onChange={(e) => setFilters({ ...filters, qid: e.target.value.replace(/\D/g, '') })}
                placeholder="题号"
                className="px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
                  placeholder="搜索题号或题目"
                  className="w-full pl-9 pr-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
              <select
                value={filters.difficulty}
                onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
                className="px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
              >
                <option value="">全部难度</option>
                <option value="easy">入门</option>
                <option value="medium">普及-</option>
                <option value="hard">提高+</option>
              </select>
              <button
                onClick={runSearch}
                className="px-4 py-2 bg-sky-600 text-white rounded-md text-sm hover:bg-sky-700"
              >
                查询
              </button>
            </div>
            {filters.tag && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className="text-gray-500">标签：</span>
                <button onClick={() => setFilters({ ...filters, tag: '' })} className="px-2 py-1 bg-sky-50 text-sky-700 rounded">
                  {filters.tag} ×
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-gray-500 border-b">
                <tr>
                  <th className="w-12 px-3 py-3 text-left font-medium">Y/N</th>
                  <th className="w-20 px-3 py-3 text-left font-medium">题号</th>
                  <th className="px-3 py-3 text-left font-medium">标题</th>
                  <th className="w-52 px-3 py-3 text-left font-medium">标签</th>
                  <th className="w-24 px-3 py-3 text-left font-medium">难度</th>
                  <th className="w-24 px-3 py-3 text-right font-medium">正确</th>
                  <th className="w-24 px-3 py-3 text-right font-medium">通过率</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="py-12 text-center text-gray-400">加载中...</td></tr>
                ) : questions.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-gray-400">暂无题目</td></tr>
                ) : questions.map((q) => (
                  <tr key={q.id} className="border-b last:border-b-0 hover:bg-sky-50/50">
                    <td className="px-3 py-3"><StatusIcon status={q.status} /></td>
                    <td className="px-3 py-3 font-mono text-gray-500">{q.id}</td>
                    <td className="px-3 py-3">
                      <Link to={`/question/${q.id}`} className="font-medium text-gray-900 hover:text-sky-700">
                        {q.title}
                      </Link>
                      {q.source && <div className="text-xs text-gray-400 mt-0.5">{q.source}</div>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {splitTags(q.tags).slice(0, 3).map((tag) => (
                          <button key={tag} onClick={() => selectTag(tag)} className="px-1.5 py-0.5 bg-slate-100 text-gray-600 rounded text-xs hover:bg-sky-100 hover:text-sky-700">
                            {tag}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${difficultyClasses[q.difficulty] || 'bg-gray-100 text-gray-600'}`}>
                        {difficultyLabels[q.difficulty] || q.difficulty}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-gray-600">{q.accepted_count || 0}/{q.submission_count || 0}</td>
                    <td className="px-3 py-3 text-right text-gray-600">{q.ac_rate || 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-500">
            <span>共 {total} 题，第 {page}/{totalPages} 页</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-2 border rounded-md disabled:opacity-40 hover:bg-gray-50">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 border rounded-md disabled:opacity-40 hover:bg-gray-50">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 font-semibold text-gray-800 mb-3">
            <Megaphone className="w-4 h-4 text-sky-600" />
            {meta.settings?.home_notice_title || '公告'}
          </div>
          <div className="space-y-3">
            {(meta.announcements || []).map((item: any) => (
              <div key={item.id} className="border-b last:border-b-0 pb-3 last:pb-0">
                <div className="font-medium text-sm text-gray-900">{item.title}</div>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.content}</p>
              </div>
            ))}
            {(!meta.announcements || meta.announcements.length === 0) && <div className="text-sm text-gray-400">暂无公告</div>}
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 font-semibold text-gray-800 mb-3">
            <BarChart3 className="w-4 h-4 text-sky-600" />
            {meta.settings?.home_stats_title || '站点统计'}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-lg font-semibold">{meta.stats?.questions || 0}</div><div className="text-gray-500">题目</div></div>
            <div><div className="text-lg font-semibold">{meta.stats?.users || 0}</div><div className="text-gray-500">用户</div></div>
            <div><div className="text-lg font-semibold">{meta.stats?.submissions || 0}</div><div className="text-gray-500">提交</div></div>
            <div><div className="text-lg font-semibold">{meta.stats?.accepted || 0}</div><div className="text-gray-500">通过</div></div>
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 font-semibold text-gray-800 mb-3">
            <Tags className="w-4 h-4 text-sky-600" />
            {meta.settings?.home_tags_title || '标签'}
          </div>
          <div className="flex flex-wrap gap-2">
            {(meta.tags || []).map((tag: any) => (
              <button key={tag.name} onClick={() => selectTag(tag.name)} className="px-2 py-1 bg-slate-100 text-gray-600 rounded text-xs hover:bg-sky-100 hover:text-sky-700">
                {tag.name} {tag.count}
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
