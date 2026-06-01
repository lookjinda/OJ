import { useState, useEffect } from 'react';
import { questionApi, listApi, contestApi, authApi, submissionApi } from '../utils/api';
import { Plus, Pencil, Trash2, Users, BookOpen, ListOrdered, Trophy, X, Save, Download, Check, GripVertical, ArrowUp, ArrowDown, FileText, Upload } from 'lucide-react';
import { useAuthStore } from '../stores';

type Tab = 'questions' | 'lists' | 'contests' | 'exams' | 'users' | 'submissions';

export default function Admin() {
  const [activeTab, setActiveTab] = useState<Tab>('questions');

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'questions', label: '题目管理', icon: <BookOpen className="w-4 h-4" /> },
    { key: 'lists', label: '题单管理', icon: <ListOrdered className="w-4 h-4" /> },
    { key: 'contests', label: '比赛管理', icon: <Trophy className="w-4 h-4" /> },
    { key: 'exams', label: '考试管理', icon: <FileText className="w-4 h-4" /> },
    { key: 'users', label: '用户管理', icon: <Users className="w-4 h-4" /> },
    { key: 'submissions', label: '提交记录', icon: <Download className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">管理后台</h1>
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'questions' && <QuestionsManager />}
      {activeTab === 'lists' && <ListsManager />}
      {activeTab === 'contests' && <ContestsManager />}
      {activeTab === 'exams' && <ExamsManager />}
      {activeTab === 'users' && <UsersManager />}
      {activeTab === 'submissions' && <SubmissionsTab />}
    </div>
  );
}

/* ============ 选项编辑器（选择题） ============ */
function OptionsEditor({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const parseOptions = (v: any) => {
    if (!v) return [{label:'A',display:''},{label:'B',display:''},{label:'C',display:''},{label:'D',display:''}];
    if (typeof v === 'string') {
      try {
        const parsed = JSON.parse(v);
        if (Array.isArray(parsed)) return parsed.map((o: any, i: number) => typeof o === 'string' ? { label: String.fromCharCode(65+i), display: o } : { label: o.label || String.fromCharCode(65+i), display: o.display || '' });
      } catch {}
    }
    if (Array.isArray(v)) return v.map((o: any, i: number) => typeof o === 'string' ? { label: String.fromCharCode(65+i), display: o } : { label: o.label || String.fromCharCode(65+i), display: o.display || '' });
    return [{label:'A',display:''},{label:'B',display:''},{label:'C',display:''},{label:'D',display:''}];
  };
  const opts = parseOptions(value);
  const labels = ['A','B','C','D','E','F'];
  const update = (idx: number, field: 'label'|'display', val: string) => onChange(opts.map((o, i) => i === idx ? { ...o, [field]: val } : o));
  return (
    <div className="space-y-2">
      {opts.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-6 text-sm font-semibold text-gray-500">{labels[i]}.</span>
          <input type="text" value={o.display} onChange={(e) => update(i, 'display', e.target.value)} placeholder={`选项${labels[i]}`} className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm focus:border-primary-500 focus:outline-none" />
        </div>
      ))}
    </div>
  );
}

/* ============ 题目管理 ============ */
function QuestionsManager() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await questionApi.getList({ limit: 100 });
      setQuestions(res.data.questions);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该题目？')) return;
    try {
      await questionApi.delete(id);
      load();
    } catch (err) { console.error(err); }
  };

  const handleEdit = (q: any) => {
    setEditing({ ...q, options: q.options ? (typeof q.options === 'string' ? q.options : JSON.stringify(q.options, null, 2)) : '', test_cases: q.test_cases ? (typeof q.test_cases === 'string' ? q.test_cases : JSON.stringify(q.test_cases, null, 2)) : '' });
    setShowForm(true);
  };

  const handleCreate = () => {
    setEditing({ title: '', type: 'programming', language: 'python', difficulty: 'easy', content: '', answer: '', options: '', test_cases: '', points: 10, tags: '' });
    setShowForm(true);
  };

  const handleSave = async () => {
    try {
      const data: any = { ...editing };
      // Parse JSON fields - if already object/array, keep as is; if string, try to parse
      if (data.options) {
        try { data.options = JSON.parse(data.options); } catch { /* already object/array, keep it */ }
        // OptionsEditor sends object array; API expects JSON string → stringify
        if (Array.isArray(data.options)) data.options = JSON.stringify(data.options);
      }
      if (data.test_cases) {
        try { data.test_cases = JSON.parse(data.test_cases); } catch { /* already object/array, keep it */ }
        if (Array.isArray(data.test_cases)) data.test_cases = JSON.stringify(data.test_cases);
      }

      if (editing.id) {
        await questionApi.update(editing.id, data);
      } else {
        await questionApi.create(data);
      }
      setShowForm(false);
      setEditing(null);
      load();
    } catch (err: any) {
      alert('保存失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const typeLabels: Record<string, string> = { programming: '编程题', choice: '选择题', fill: '填空题' };
  const diffLabels: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难' };
  const diffColors: Record<string, string> = { easy: 'text-green-700 bg-green-100', medium: 'text-yellow-700 bg-yellow-100', hard: 'text-red-700 bg-red-100' };

  if (loading) return <div className="text-center py-12">加载中...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-gray-500">共 {questions.length} 道题目</span>
        <button onClick={handleCreate} className="flex items-center gap-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
          <Plus className="w-4 h-4" /> 添加题目
        </button>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">ID</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">标题</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">题型</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">语言</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">难度</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">分值</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => (
              <tr key={q.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">{q.id}</td>
                <td className="px-4 py-3 font-medium">{q.title}</td>
                <td className="px-4 py-3"><span className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded text-xs">{typeLabels[q.type]}</span></td>
                <td className="px-4 py-3 text-gray-600">{q.language ? q.language.toUpperCase() : '-'}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs ${diffColors[q.difficulty]}`}>{diffLabels[q.difficulty]}</span></td>
                <td className="px-4 py-3">{q.points}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleEdit(q)} className="text-blue-600 hover:text-blue-800 mr-3"><Pencil className="w-4 h-4 inline" /></button>
                  <button onClick={() => handleDelete(q.id)} className="text-red-600 hover:text-red-800"><Trash2 className="w-4 h-4 inline" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && editing && (
        <QuestionForm data={editing} onChange={setEditing} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} isEdit={!!editing.id} />
      )}
    </div>
  );
}

function QuestionForm({ data, onChange, onSave, onClose, isEdit }: any) {
  const fields = [
    { key: 'title', label: '标题', type: 'text', required: true },
    { key: 'type', label: '题型', type: 'select', options: [{ value: 'programming', label: '编程题' }, { value: 'choice', label: '选择题' }, { value: 'fill', label: '填空题' }] },
    { key: 'language', label: '语言', type: 'select', options: [{ value: '', label: '无' }, { value: 'python', label: 'Python' }, { value: 'cpp', label: 'C++' }, { value: 'scratch', label: 'Scratch' }] },
    { key: 'difficulty', label: '难度', type: 'select', options: [{ value: 'easy', label: '简单' }, { value: 'medium', label: '中等' }, { value: 'hard', label: '困难' }] },
    { key: 'points', label: '分值', type: 'number' },
    { key: 'tags', label: '标签(逗号分隔)', type: 'text' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">{isEdit ? '编辑题目' : '添加题目'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
              {f.type === 'select' ? (
                <select value={data[f.key] || ''} onChange={(e) => onChange({ ...data, [f.key]: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                  {f.options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input type={f.type} value={data[f.key] || ''} onChange={(e) => onChange({ ...data, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              )}
            </div>
          ))}
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">题目描述</label>
          <textarea value={data.content || ''} onChange={(e) => onChange({ ...data, content: e.target.value })} rows={5} className="w-full px-3 py-2 border rounded-lg text-sm" />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">答案</label>
          <textarea value={data.answer || ''} onChange={(e) => onChange({ ...data, answer: e.target.value })} rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">选项 (选择题用)</label>
          <OptionsEditor value={data.options} onChange={(v) => onChange({ ...data, options: v })} />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">测试用例 (JSON，编程题用)</label>
          <textarea value={data.test_cases || ''} onChange={(e) => onChange({ ...data, test_cases: e.target.value })} rows={4} className="w-full px-3 py-2 border rounded-lg text-sm font-mono" placeholder='[{"input":"1 2","output":"3"}]' />
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">取消</button>
          <button onClick={onSave} className="flex items-center gap-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"><Save className="w-4 h-4" /> 保存</button>
        </div>
      </div>
    </div>
  );
}

/* ============ 题单管理 ============ */
function ListsManager() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [lists, setLists] = useState<any[]>([]);
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const handleMove = async (idx: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= lists.length) return;
    const newLists = [...lists];
    [newLists[idx], newLists[newIdx]] = [newLists[newIdx], newLists[idx]];
    const order = newLists.map((l, i) => ({ id: l.id, sort_order: i + 1 }));
    setLists(newLists);
    try {
      await fetch('/api/lists/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ order })
      });
    } catch (err) { console.error('保存排序失败', err); }
  };

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [listsRes, qRes] = await Promise.all([
        listApi.getList({ limit: 100 }),
        questionApi.getList({ limit: 200 }),
      ]);
      setLists(listsRes.data.lists || listsRes.data);
      setAllQuestions(qRes.data.questions || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该题单？')) return;
    try { await listApi.delete(id); load(); } catch (err) { console.error(err); }
  };

  const openCreate = () => {
    setEditing({ title: '', description: '', question_ids: [] });
    setShowForm(true);
  };

  const openEdit = async (l: any) => {
    // 获取题单详情以得到已关联题目
    try {
      const res = await listApi.getById(l.id);
      const detail = res.data;
      const qids = (detail.questions || []).map((q: any) => q.id);
      setEditing({ ...l, question_ids: qids });
    } catch {
      setEditing({ ...l, question_ids: [] });
    }
    setShowForm(true);
  };

  const handleSave = async () => {
    try {
      const data = { ...editing };
      // question_ids 已经是数组
      if (typeof data.question_ids === 'string') {
        data.question_ids = data.question_ids.split(',').map((s: string) => Number(s.trim())).filter((n: number) => !isNaN(n));
      }
      if (editing.id) {
        await listApi.update(editing.id, data);
      } else {
        await listApi.create(data);
      }
      setShowForm(false); setEditing(null); load();
    } catch (err: any) {
      alert('保存失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const toggleQuestion = (qid: number) => {
    const ids: number[] = editing.question_ids || [];
    if (ids.includes(qid)) {
      setEditing({ ...editing, question_ids: ids.filter((id: number) => id !== qid) });
    } else {
      setEditing({ ...editing, question_ids: [...ids, qid] });
    }
  };

  const diffColors: Record<string, string> = { easy: 'text-green-600', medium: 'text-yellow-600', hard: 'text-red-600' };
  const diffLabels: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难' };

  if (loading) return <div className="text-center py-12">加载中...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-gray-500">共 {lists.length} 个题单</span>
        <button onClick={openCreate} className="flex items-center gap-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
          <Plus className="w-4 h-4" /> 创建题单
        </button>
      </div>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 w-8 text-gray-500 font-medium">#</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">题单名称</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">描述</th>
              <th className="text-center px-4 py-3 text-gray-500 font-medium">题目数</th>
              {isAdmin && <th className="text-center px-4 py-3 text-gray-500 font-medium">排序</th>}
              <th className="text-right px-4 py-3 text-gray-500 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {lists.map((l: any, idx: number) => (
              <tr key={l.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{l.title}</td>
                <td className="px-4 py-3 text-gray-500">{l.description || '-'}</td>
                <td className="px-4 py-3 text-center text-gray-500">{l.question_count ?? 0}</td>
                {isAdmin ? (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleMove(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="上移"
                      >
                        <ArrowUp className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleMove(idx, 'down')}
                        disabled={idx === lists.length - 1}
                        className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="下移"
                      >
                        <ArrowDown className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  </td>
                ) : (
                  <td className="px-4 py-3 text-center text-gray-300 text-xs">—</td>
                )}
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(l)} className="text-blue-600 hover:text-blue-800 mr-3 text-sm">编辑</button>
                  <button onClick={() => handleDelete(l.id)} className="text-red-600 hover:text-red-800 text-sm">删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-lg font-semibold">{editing.id ? '编辑题单' : '创建题单'}</h2>
              <button onClick={() => { setShowForm(false); setEditing(null); }}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="overflow-y-auto p-6 space-y-4 flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
                <input type="text" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                <textarea value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  选择题目
                  <span className="ml-2 text-xs text-primary-600 font-normal">已选 {(editing.question_ids || []).length} 道</span>
                </label>
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-64 overflow-y-auto">
                    {allQuestions.map((q: any) => {
                      const selected = (editing.question_ids || []).includes(q.id);
                      return (
                        <label key={q.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 border-b last:border-b-0 ${selected ? 'bg-primary-50' : ''}`}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleQuestion(q.id)}
                            className="w-4 h-4 text-primary-600 rounded"
                          />
                          <span className="text-xs text-gray-400 w-6">{q.id}</span>
                          <span className="flex-1 text-sm">{q.title}</span>
                          <span className={`text-xs ${diffColors[q.difficulty] || 'text-gray-500'}`}>{diffLabels[q.difficulty] || q.difficulty}</span>
                          <span className="text-xs text-gray-400">{q.language?.toUpperCase() || q.type}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="px-4 py-2 border rounded-lg text-sm">取消</button>
              <button onClick={handleSave} className="flex items-center gap-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"><Save className="w-4 h-4" /> 保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ 比赛管理 ============ */
function ContestsManager() {
  const [contests, setContests] = useState<any[]>([]);
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [contestsRes, qRes] = await Promise.all([
        contestApi.getList({ limit: 100 }),
        questionApi.getList({ limit: 200 }),
      ]);
      setContests(contestsRes.data.contests || contestsRes.data);
      setAllQuestions(qRes.data.questions || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该比赛？')) return;
    try { await contestApi.delete(id); load(); } catch (err) { console.error(err); }
  };

  const openCreate = () => {
    setEditing({ title: '', description: '', start_time: '', end_time: '', question_ids: [], rules: 'acm' });
    setShowForm(true);
  };

  const openEdit = async (c: any) => {
    try {
      const res = await contestApi.getById(c.id);
      const detail = res.data;
      const qids = (detail.questions || []).map((q: any) => q.id);
      setEditing({ ...c, question_ids: qids });
    } catch {
      setEditing({ ...c, question_ids: [] });
    }
    setShowForm(true);
  };

  const handleSave = async () => {
    try {
      const data = { ...editing };
      if (editing.id) {
        await contestApi.update(editing.id, data);
      } else {
        await contestApi.create(data);
      }
      setShowForm(false); setEditing(null); load();
    } catch (err: any) {
      alert('保存失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const toggleQuestion = (qid: number) => {
    const ids: number[] = editing.question_ids || [];
    if (ids.includes(qid)) {
      setEditing({ ...editing, question_ids: ids.filter((id: number) => id !== qid) });
    } else {
      setEditing({ ...editing, question_ids: [...ids, qid] });
    }
  };

  const statusLabels: Record<string, string> = { upcoming: '未开始', ongoing: '进行中', ended: '已结束' };
  const statusColors: Record<string, string> = { upcoming: 'text-blue-700 bg-blue-100', ongoing: 'text-green-700 bg-green-100', ended: 'text-gray-700 bg-gray-100' };

  if (loading) return <div className="text-center py-12">加载中...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-gray-500">共 {contests.length} 场比赛</span>
        <button onClick={openCreate} className="flex items-center gap-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
          <Plus className="w-4 h-4" /> 创建比赛
        </button>
      </div>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">ID</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">标题</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">状态</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">开始时间</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">结束时间</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody>
            {contests.map((c: any) => (
              <tr key={c.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">{c.id}</td>
                <td className="px-4 py-3 font-medium">{c.title}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs ${statusColors[c.status] || 'bg-gray-100'}`}>{statusLabels[c.status] || c.status}</span></td>
                <td className="px-4 py-3 text-gray-600">{c.start_time || '-'}</td>
                <td className="px-4 py-3 text-gray-600">{c.end_time || '-'}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(c)} className="text-blue-600 hover:text-blue-800 mr-3"><Pencil className="w-4 h-4 inline" /></button>
                  <button onClick={() => handleDelete(c.id)} className="text-red-600 hover:text-red-800"><Trash2 className="w-4 h-4 inline" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">{editing.id ? '编辑比赛' : '创建比赛'}</h2>
              <button onClick={() => { setShowForm(false); setEditing(null); }}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
                <input type="text" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                <textarea value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">开始时间</label>
                  <input type="datetime-local" value={editing.start_time || ''} onChange={(e) => setEditing({ ...editing, start_time: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
                  <input type="datetime-local" value={editing.end_time || ''} onChange={(e) => setEditing({ ...editing, end_time: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  选择题目
                  <span className="ml-2 text-xs text-primary-600 font-normal">已选 {(editing.question_ids || []).length} 道</span>
                </label>
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-48 overflow-y-auto">
                    {allQuestions.map((q: any) => {
                      const selected = (editing.question_ids || []).includes(q.id);
                      return (
                        <label key={q.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 border-b last:border-b-0 ${selected ? 'bg-primary-50' : ''}`}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleQuestion(q.id)}
                            className="w-4 h-4 text-primary-600 rounded"
                          />
                          <span className="text-xs text-gray-400 w-6">{q.id}</span>
                          <span className="flex-1 text-sm">{q.title}</span>
                          <span className="text-xs text-gray-400">{q.language?.toUpperCase() || q.type}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">赛制</label>
                <select value={editing.rules || 'acm'} onChange={(e) => setEditing({ ...editing, rules: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="acm">ACM</option>
                  <option value="oi">OI</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="px-4 py-2 border rounded-lg text-sm">取消</button>
              <button onClick={handleSave} className="flex items-center gap-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"><Save className="w-4 h-4" /> 保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ 用户管理 ============ */
function UsersManager() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await authApi.getUsers();
      setUsers(res.data.users);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleRoleChange = async (id: number, role: string) => {
    try {
      await authApi.updateUserRole(id, role);
      load();
    } catch (err: any) {
      alert('更新失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const roleLabels: Record<string, string> = { admin: '管理员', teacher: '教师', student: '学生' };
  const roleColors: Record<string, string> = { admin: 'text-red-700 bg-red-100', teacher: 'text-blue-700 bg-blue-100', student: 'text-green-700 bg-green-100' };

  if (loading) return <div className="text-center py-12">加载中...</div>;

  return (
    <div>
      <div className="mb-4">
        <span className="text-sm text-gray-500">共 {users.length} 名用户</span>
      </div>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">ID</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">用户名</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">角色</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">注册时间</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">最后登录</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">{u.id}</td>
                <td className="px-4 py-3 font-medium">{u.username}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs ${roleColors[u.role]}`}>{roleLabels[u.role]}</span></td>
                <td className="px-4 py-3 text-gray-600">{u.created_at || '-'}</td>
                <td className="px-4 py-3 text-gray-600">{u.last_login || '-'}</td>
                <td className="px-4 py-3 text-right">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    className="px-2 py-1 border rounded text-xs"
                  >
                    <option value="student">学生</option>
                    <option value="teacher">教师</option>
                    <option value="admin">管理员</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==================== 提交记录 Tab ====================
function SubmissionsTab() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterQuestionId, setFilterQuestionId] = useState('');
  const [filterUserId, setFilterUserId] = useState('');
  const [gradingId, setGradingId] = useState<number | null>(null);
  const [gradeResult, setGradeResult] = useState<'pass' | 'fail' | 'pending'>('pass');
  const [gradeScore, setGradeScore] = useState('');
  const [gradeFeedback, setGradeFeedback] = useState('');
  const [gradingLoading, setGradingLoading] = useState(false);

  const loadSubmissions = () => {
    setLoading(true);
    submissionApi.getAll({
      question_id: filterQuestionId ? Number(filterQuestionId) : undefined,
      user_id: filterUserId ? Number(filterUserId) : undefined,
    }).then((res) => setSubmissions(res.data.submissions || []))
      .catch(() => setSubmissions([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadSubmissions(); }, []);

  const handleDownloadScratch = async (id: number) => {
    const token = localStorage.getItem('token');
    if (!token) return alert('请先登录');
    try {
      const res = await fetch(`/api/submissions/${id}/scratch-file`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || '下载失败');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `submission_${id}.sb3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('下载失败');
    }
  };

  const openGrading = (s: any) => {
    setGradingId(s.id);
    setGradeResult(s.result === 'pass' || s.result === 'accepted' ? 'pass' : s.result === 'fail' || s.result === 'wrong' ? 'fail' : 'pending');
    setGradeScore(String(s.score ?? ''));
    setGradeFeedback(s.feedback || '');
  };

  const handleGrade = async () => {
    if (!gradingId) return;
    if (gradeScore === '' || isNaN(Number(gradeScore))) return alert('请输入有效分数');
    setGradingLoading(true);
    try {
      await submissionApi.gradeSubmission(gradingId, {
        result: gradeResult,
        score: Number(gradeScore),
        feedback: gradeFeedback,
      });
      setGradingId(null);
      loadSubmissions();
    } catch (e: any) {
      alert(e.response?.data?.error || '评分失败');
    } finally {
      setGradingLoading(false);
    }
  };

  const resultColor = (r: string) => {
    if (r === 'pass') return 'text-green-600 bg-green-50';
    if (r === 'fail') return 'text-red-600 bg-red-50';
    if (r === 'pending') return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  };

  return (
    <div>
      {/* 筛选 */}
      <div className="flex gap-3 mb-4">
        <input
          type="number"
          placeholder="题目ID"
          value={filterQuestionId}
          onChange={(e) => setFilterQuestionId(e.target.value)}
          className="px-3 py-1.5 border rounded text-sm w-28"
        />
        <input
          type="number"
          placeholder="用户ID"
          value={filterUserId}
          onChange={(e) => setFilterUserId(e.target.value)}
          className="px-3 py-1.5 border rounded text-sm w-28"
        />
        <button onClick={loadSubmissions} className="px-4 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">
          筛选
        </button>
        <span className="text-xs text-gray-500 self-center ml-2">共 {submissions.length} 条</span>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">加载中...</div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-8 text-gray-400">暂无提交记录</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">ID</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">用户</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">题目</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">语言</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">分数</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">评语</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">状态</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">时间</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {submissions.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-500">{s.id}</td>
                  <td className="px-3 py-2 font-medium">{s.username}</td>
                  <td className="px-3 py-2">
                    <div className="text-xs text-gray-500">#{s.question_id}</div>
                    <div className="truncate max-w-32">{s.question_title}</div>
                  </td>
                  <td className="px-3 py-2">{s.language || s.question_type}</td>
                  <td className="px-3 py-2 text-xs">{s.score ?? '-'}</td>
                  <td className="px-3 py-2 text-xs text-gray-500 max-w-32 truncate" title={s.feedback || ''}>{s.feedback || '-'}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${resultColor(s.result)}`}>
                      {s.result === 'pass' ? '通过' : s.result === 'fail' ? '失败' : s.result === 'pending' ? '待判' : s.result}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-400 text-xs">{new Date(s.submitted_at).toLocaleString('zh-CN')}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {s.scratch_project && (
                        <button
                          onClick={() => handleDownloadScratch(s.id)}
                          className="text-indigo-600 hover:text-indigo-800 text-xs flex items-center gap-1"
                          title="下载 Scratch 项目 (.sb3)"
                        >
                          <Download className="w-3 h-3" />
                          sb3
                        </button>
                      )}
                      <button
                        onClick={() => openGrading(s)}
                        className="text-amber-600 hover:text-amber-800 text-xs flex items-center gap-1"
                        title="评分"
                      >
                        <Check className="w-3 h-3" />
                        评分
                      </button>
                    </div>
                    {s.code && (
                      <details className="mt-1">
                        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">查看代码</summary>
                        <pre className="mt-1 p-2 bg-gray-900 text-green-400 rounded text-xs overflow-x-auto max-w-xl whitespace-pre-wrap">
                          {s.code}
                        </pre>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 评分弹窗 */}
      {gradingId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-80 shadow-xl">
            <h3 className="font-bold text-lg mb-4">手动评分</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">结果</label>
                <select
                  value={gradeResult}
                  onChange={(e) => setGradeResult(e.target.value as 'pass' | 'fail' | 'pending')}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="pass">通过</option>
                  <option value="fail">失败</option>
                  <option value="pending">待判</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分数</label>
                <input
                  type="number"
                  value={gradeScore}
                  onChange={(e) => setGradeScore(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="如: 10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">评语（可选）</label>
                <textarea
                  value={gradeFeedback}
                  onChange={(e) => setGradeFeedback(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  rows={2}
                  placeholder="评语"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={handleGrade}
                disabled={gradingLoading}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm disabled:opacity-50"
              >
                {gradingLoading ? '保存中...' : '保存'}
              </button>
              <button
                onClick={() => setGradingId(null)}
                className="flex-1 px-4 py-2 border rounded hover:bg-gray-50 text-sm"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ============ 题目编辑卡片 ============ */
function QuestionEditCard({q,idx,onSave,onDelete,onChange}:{q:any;idx:number;onSave:()=>void;onDelete:()=>void;onChange:(updated:any)=>void;}){
  const[expanded,setExpanded]=useState(false);
  const isJudge=q.subtype==="judge"||(q.type==="choice"&&q.options&&q.options.length===2&&q.options[0]&&q.options[0].display==="正确");
  const typeLabel=isJudge?"判断题":q.type==="choice"?"选择题":q.type==="fill"?"填空题":"编程题";
  const getOpts=()=>{if(!q.options)return"";if(typeof q.options==="string")return q.options;return JSON.stringify(q.options,null,2);};
  return(
    <div className="border border-gray-200 rounded-lg bg-white">
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"onClick={()=>setExpanded(!expanded)}>
        <span className="text-xs font-bold text-gray-400 bg-gray-100 rounded px-2 py-0.5 min-w-[28px] text-center">{idx+1}</span>
        <span className="text-xs font-medium text-gray-500 bg-gray-50 rounded px-2 py-0.5">{typeLabel}</span>
        <span className="flex-1 text-sm font-medium text-gray-800 truncate">{q.title||(q.content?q.content.substring(0,60):`题目${q.id}`)}</span>
        {q.answer&&<span className="text-xs text-green-600 font-mono bg-green-50 rounded px-2 py-0.5">答案:{q.answer}</span>}
        <span className={"text-xs "+(expanded?"text-indigo-600":"text-gray-400")}>{expanded?"收起 ▲":"展开 ▼"}</span>
      </div>
      {expanded&&(
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3">
          <div><label className="block text-xs font-medium text-gray-600 mb-1">题目内容</label>
            <textarea value={q.content||""}onChange={(e)=>onChange({content:e.target.value})}rows={3}className="w-full px-3 py-2 border border-gray-200 rounded text-sm"placeholder="题目内容..."/></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">题型</label>
            <select value={q.subtype==="judge"?"judge":q.type}onChange={(e)=>{const v=e.target.value;if(v==="judge"){onChange({type:"choice",subtype:"judge",options:[{label:"A",display:"正确"},{label:"B",display:"错误"}]});}else{onChange({type:v,subtype:""});}}}className="w-full px-3 py-2 border border-gray-200 rounded text-sm">
              <option value="choice">选择题</option><option value="judge">判断题</option><option value="fill">填空题</option><option value="programming">编程题</option>
            </select></div>
          {(q.type==="choice"||q.subtype==="judge")&&(
            <div><label className="block text-xs font-medium text-gray-600 mb-1">
              选项 (JSON){isJudge&&<span className="ml-1 text-gray-400 font-normal">（判断题：自动生成）</span>}
            </label>
              {isJudge?(
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 p-2 border rounded bg-gray-50"><span className="text-xs font-bold text-gray-500">A</span><span className="text-sm flex-1">正确</span><span className={"text-xs font-mono px-2 py-0.5 rounded "+(q.answer==="A"?"bg-green-500 text-white":"bg-gray-200 text-gray-400")}>{q.answer==="A"?"✓":""}</span></div>
                  <div className="flex items-center gap-2 p-2 border rounded bg-gray-50"><span className="text-xs font-bold text-gray-500">B</span><span className="text-sm flex-1">错误</span><span className={"text-xs font-mono px-2 py-0.5 rounded "+(q.answer==="B"?"bg-red-500 text-white":"bg-gray-200 text-gray-400")}>{q.answer==="B"?"✓":""}</span></div>
                </div>
              ):(
                <OptionsEditor value={q.options} onChange={(v: any) => onChange({ options: v })} />
              )}
            </div>)}
          <div><label className="block text-xs font-medium text-gray-600 mb-1">正确答案</label>
            <div className="flex gap-2">
              {isJudge?(
                <><button type="button"onClick={()=>onChange({answer:"A"})}className={"flex-1 py-2 rounded border text-sm font-medium transition-colors "+(q.answer==="A"?"bg-green-500 text-white border-green-500":"border-gray-200 hover:bg-green-50")}>A — 正确</button>
                <button type="button"onClick={()=>onChange({answer:"B"})}className={"flex-1 py-2 rounded border text-sm font-medium transition-colors "+(q.answer==="B"?"bg-red-500 text-white border-red-500":"border-gray-200 hover:bg-red-50")}>B — 错误</button></>
              ):q.type==="choice"?(
                <div className="flex gap-2">{["A","B","C","D"].map((opt)=>(<button key={opt}type="button"onClick={()=>onChange({answer:opt})}className={"w-10 py-2 rounded border text-sm font-bold transition-colors "+(q.answer===opt?"bg-indigo-600 text-white border-indigo-600":"border-gray-200 hover:bg-indigo-50")}>{opt}</button>))}</div>
              ):(
                <input type="text"value={q.answer||""}onChange={(e)=>onChange({answer:e.target.value})}className="flex-1 px-3 py-2 border border-gray-200 rounded text-sm"placeholder="输入正确答案"/>
              )}
            </div></div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onDelete}className="flex items-center gap-1 px-3 py-1.5 text-red-600 border border-red-200 rounded text-xs hover:bg-red-50"><Trash2 className="w-3.5 h-3.5"/>从考试移除</button>
            <button onClick={onSave}className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700"><Save className="w-3.5 h-3.5"/>保存</button>
          </div>
        </div>)}
    </div>);
}


/* ============ 考试管理 ============ */
function ExamsManager() {
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const { user } = useAuthStore();
  const [editingExam, setEditingExam] = useState<any>(null); // 要编辑的考试
  const [examQuestions, setExamQuestions] = useState<any[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [showAddQ, setShowAddQ] = useState(false);
  const [addingQ, setAddingQ] = useState({ title: '', type: 'choice', content: '', options: '', answer: '', subtype: '' });

  useEffect(() => { loadExams(); }, []);

  const loadExams = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/exams', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setExams(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openEdit = async (exam: any) => {
    setEditingExam({ ...exam });
    setLoadingQuestions(true);
    try {
      const res = await fetch(`http://localhost:3001/api/exams/${exam.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setExamQuestions(data.questions || []);
    } catch (err) {
      console.error(err);
      setExamQuestions([]);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleSaveExamInfo = async () => {
    try {
      const res = await fetch(`http://localhost:3001/api/exams/${editingExam.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({
          title: editingExam.title,
          description: editingExam.description,
          difficulty: editingExam.difficulty,
          duration: editingExam.duration,
        })
      });
      if (!res.ok) throw new Error('保存失败');
      loadExams();
      alert('考试信息已保存');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSaveQuestion = async (q: any) => {
    try {
      const res = await fetch(`http://localhost:3001/api/exams/${editingExam.id}/questions/${q.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(q)
      });
      if (!res.ok) throw new Error('保存失败');
      // 刷新题目列表
      const qRes = await fetch(`http://localhost:3001/api/exams/${editingExam.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const qData = await qRes.json();
      setExamQuestions(qData.questions || []);
      alert('题目已保存');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteQuestion = async (qid: number) => {
    if (!confirm('确定从考试中移除该题？')) return;
    try {
      await fetch(`http://localhost:3001/api/exams/${editingExam.id}/questions/${qid}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setExamQuestions(prev => prev.filter(q => q.id !== qid));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddQuestion = async () => {
    if (!addingQ.title) return alert('请输入题目标题');
    try {
      const qData: any = { ...addingQ };
      if (addingQ.options) { qData.options = addingQ.options; }
      const res = await fetch(`http://localhost:3001/api/exams/${editingExam.id}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(qData)
      });
      if (!res.ok) throw new Error('添加失败');
      setShowAddQ(false);
      setAddingQ({ title: '', type: 'choice', content: '', options: '', answer: '', subtype: '' });
      // 刷新
      const qRes = await fetch(`http://localhost:3001/api/exams/${editingExam.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const qData2 = await qRes.json();
      setExamQuestions(qData2.questions || []);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['.pdf', '.docx'];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!allowed.includes(ext)) {
      alert('仅支持 PDF 或 DOCX 格式');
      return;
    }

    setUploading(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name.replace(ext, ''));
      formData.append('difficulty', 'medium');
      formData.append('duration', '60');

      const res = await fetch('http://localhost:3001/api/exams/import', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '导入失败');

      setImportResult(data);
      loadExams();
    } catch (err: any) {
      alert('导入失败: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该考试？')) return;
    try {
      await fetch(`http://localhost:3001/api/exams/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      loadExams();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="text-center py-10">加载中...</div>;

  return (
    <div className="space-y-6">
      {/* 导入区域 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5" />
          导入试卷
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          上传 PDF 或 DOCX 格式的试卷文件，系统将自动识别题目并创建考试。
        </p>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded cursor-pointer hover:bg-indigo-700">
            <Upload className="w-4 h-4" />
            {uploading ? '导入中...' : '选择文件'}
            <input
              type="file"
              accept=".pdf,.docx"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
          <span className="text-sm text-gray-500">支持 PDF、DOCX 格式</span>
        </div>

        {importResult && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
            <p className="font-medium text-green-800">导入成功！</p>
            <p className="text-sm text-green-700 mt-1">
              创建考试：{importResult.examId}，共 {importResult.questionCount} 道题目
            </p>
          </div>
        )}
      </div>

      {/* 考试列表 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <h3 className="text-lg font-semibold p-4 border-b">考试列表</h3>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">考试名称</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">题目数</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">时长</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">创建时间</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {exams.map((exam) => (
              <tr key={exam.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">{exam.id}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{exam.title}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{exam.question_count}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{exam.duration} 分钟</td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(exam.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openEdit(exam)}
                      className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
                    >
                      <Pencil className="w-4 h-4" /> 编辑卷面
                    </button>
                    <button
                      onClick={() => handleDelete(exam.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {exams.length === 0 && (
          <p className="text-center py-10 text-gray-500">暂无考试</p>
        )}
      </div>

      {/* ============ 编辑弹窗 ============ */}
      {editingExam && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-5xl max-h-[95vh] flex flex-col my-4">
            <div className="flex justify-between items-center p-5 border-b flex-shrink-0">
              <h2 className="text-lg font-semibold">编辑考试：{editingExam.title}</h2>
              <button onClick={() => setEditingExam(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="bg-gray-50 rounded-lg p-4 mb-5">
                <h3 className="font-medium text-sm text-gray-700 mb-3">考试信息</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">考试名称</label>
                    <input type="text" value={editingExam.title || ''} onChange={(e) => setEditingExam({ ...editingExam, title: e.target.value })} className="w-full px-3 py-2 border rounded text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">时长（分钟）</label>
                    <input type="number" value={editingExam.duration || ''} onChange={(e) => setEditingExam({ ...editingExam, duration: Number(e.target.value) })} className="w-full px-3 py-2 border rounded text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">难度</label>
                    <select value={editingExam.difficulty || 'medium'} onChange={(e) => setEditingExam({ ...editingExam, difficulty: e.target.value })} className="w-full px-3 py-2 border rounded text-sm">
                      <option value="easy">简单</option><option value="medium">中等</option><option value="hard">困难</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">描述</label>
                    <input type="text" value={editingExam.description || ''} onChange={(e) => setEditingExam({ ...editingExam, description: e.target.value })} className="w-full px-3 py-2 border rounded text-sm" />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <button onClick={handleSaveExamInfo} className="flex items-center gap-1 px-4 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">
                    <Save className="w-3.5 h-3.5" /> 保存考试信息
                  </button>
                </div>
              </div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-medium text-sm text-gray-700">
                  题目列表 {loadingQuestions ? <span className="ml-2 text-xs text-gray-400">加载中...</span> : <span className="ml-2 text-xs text-gray-400">共 {examQuestions.length} 道</span>}
                </h3>
                <button onClick={() => { setAddingQ({ title: '', type: 'choice', content: '', options: '', answer: '', subtype: '' }); setShowAddQ(true); }} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                  <Plus className="w-3.5 h-3.5" /> 新增题目
                </button>
              </div>
              {loadingQuestions ? (
                <div className="text-center py-10 text-gray-400 text-sm">加载题目中...</div>
              ) : examQuestions.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">暂无题目</div>
              ) : (
                <div className="space-y-4">
                  {examQuestions.map((q, idx) => (
                    <QuestionEditCard key={q.id} q={q} idx={idx} onSave={() => handleSaveQuestion(q)} onDelete={() => handleDeleteQuestion(q.id)} onChange={(updated) => { setExamQuestions(prev => prev.map(item => item.id === q.id ? { ...item, ...updated } : item)); }} />
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end p-4 border-t flex-shrink-0">
              <button onClick={() => setEditingExam(null)} className="px-5 py-2 border rounded-lg text-sm hover:bg-gray-50">关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* 新增题目弹窗 */}
      {showAddQ && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">新增题目</h3>
              <button onClick={() => setShowAddQ(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="block text-xs text-gray-500 mb-1">题目标题</label><input type="text" value={addingQ.title} onChange={(e) => setAddingQ({ ...addingQ, title: e.target.value })} className="w-full px-3 py-2 border rounded text-sm" placeholder="如：第1题" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 mb-1">题型</label><select value={addingQ.type} onChange={(e) => setAddingQ({ ...addingQ, type: e.target.value })} className="w-full px-3 py-2 border rounded text-sm"><option value="choice">选择题</option><option value="fill">填空题</option><option value="programming">编程题</option></select></div>
                <div><label className="block text-xs text-gray-500 mb-1">子类型</label><select value={addingQ.subtype || ''} onChange={(e) => setAddingQ({ ...addingQ, subtype: e.target.value })} className="w-full px-3 py-2 border rounded text-sm"><option value="">普通选择题</option><option value="judge">判断题</option></select></div>
              </div>
              <div><label className="block text-xs text-gray-500 mb-1">题目内容</label><textarea value={addingQ.content} onChange={(e) => setAddingQ({ ...addingQ, content: e.target.value })} rows={3} className="w-full px-3 py-2 border rounded text-sm" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">选项</label><OptionsEditor value={addingQ.options} onChange={(v: any) => setAddingQ({ ...addingQ, options: v })} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">正确答案</label><input type="text" value={addingQ.answer} onChange={(e) => setAddingQ({ ...addingQ, answer: e.target.value })} className="w-full px-3 py-2 border rounded text-sm" placeholder="如：A 或 正确" /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowAddQ(false)} className="px-4 py-2 border rounded text-sm">取消</button>
              <button onClick={handleAddQuestion} className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"><Plus className="w-3.5 h-3.5" /> 添加</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

