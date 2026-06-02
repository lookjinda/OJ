import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CheckCircle, Clock, Plus, Search, Users, XCircle } from 'lucide-react';
import { groupApi } from '../utils/api';
import { useAuthStore } from '../stores';

interface Group {
  id: number;
  name: string;
  description?: string;
  teacher_name: string;
  member_count: number;
  pending_count: number;
  list_count: number;
  my_status?: 'pending' | 'approved' | 'rejected' | null;
  created_at: string;
}

type TabKey = 'my' | 'all' | 'managed';

const statusText: Record<string, string> = {
  pending: '待审核',
  approved: '已加入',
  rejected: '已拒绝',
};

export default function Groups() {
  const { user } = useAuthStore();
  const isAuthed = !!localStorage.getItem('token');
  const isAdmin = user?.role === 'admin' || user?.role === 'teacher';
  const [activeTab, setActiveTab] = useState<TabKey>(isAuthed ? (isAdmin ? 'managed' : 'my') : 'all');
  const [managedGroups, setManagedGroups] = useState<Group[]>([]);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const all = await groupApi.getAll();
      setAllGroups(all.data.groups || []);
      if (isAuthed) {
        const mine = await groupApi.getMy();
        setMyGroups(mine.data.groups || []);
        if (isAdmin) {
          const managed = await groupApi.getManaged();
          setManagedGroups(managed.data.groups || []);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const currentGroups = useMemo(() => {
    const groups = activeTab === 'managed' ? managedGroups : activeTab === 'my' ? myGroups : allGroups;
    const text = keyword.trim().toLowerCase();
    if (!text) return groups;
    return groups.filter((group) =>
      [group.name, group.description, group.teacher_name].some((value) => (value || '').toLowerCase().includes(text))
    );
  }, [activeTab, allGroups, keyword, managedGroups, myGroups]);

  const createGroup = async () => {
    if (!form.name.trim()) return;
    await groupApi.create({ name: form.name.trim(), description: form.description.trim() });
    setForm({ name: '', description: '' });
    setShowCreate(false);
    await loadGroups();
  };

  const joinGroup = async (id: number) => {
    try {
      if (!isAuthed) {
        window.location.href = '/login';
        return;
      }
      await groupApi.join(id);
      await loadGroups();
    } catch (err: any) {
      alert(err.response?.data?.error || '申请失败');
    }
  };

  const leaveGroup = async (id: number) => {
    if (!confirm('确定退出小组或撤销申请？')) return;
    await groupApi.leave(id);
    await loadGroups();
  };

  const deleteGroup = async (id: number) => {
    if (!confirm('删除小组会同时删除小组题单，确定继续？')) return;
    await groupApi.delete(id);
    await loadGroups();
  };

  const tabs = [
    { key: 'all' as const, label: '全部小组', count: allGroups.length },
    ...(isAuthed ? [{ key: 'my' as const, label: '我的小组', count: myGroups.length }] : []),
    ...(isAdmin ? [{ key: 'managed' as const, label: '我管理的', count: managedGroups.length }] : []),
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">小组</h1>
          <p className="text-sm text-gray-500 mt-1">加入学习小组，查看老师发布的题单和成员进度</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            创建小组
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-full sm:w-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition ${
                activeTab === tab.key ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label} <span className="text-xs text-gray-400">{tab.count}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索小组"
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">加载中...</div>
      ) : currentGroups.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border text-gray-400">没有找到数据</div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_100px_100px_130px] gap-3 px-4 py-3 bg-gray-50 border-b text-xs font-medium text-gray-500">
            <div>小组</div>
            <div>管理员</div>
            <div className="text-center">成员</div>
            <div className="text-center">题单</div>
            <div className="text-right">操作</div>
          </div>
          {currentGroups.map((group) => (
            <div key={group.id} className="grid grid-cols-[1fr_120px_100px_100px_130px] gap-3 px-4 py-4 border-b last:border-b-0 items-center hover:bg-gray-50">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link to={`/groups/${group.id}`} className="font-medium text-gray-900 hover:text-primary-700 truncate">
                    {group.name}
                  </Link>
                  {group.my_status && (
                    <span className={`px-2 py-0.5 text-xs rounded ${
                      group.my_status === 'approved' ? 'bg-green-50 text-green-700' :
                      group.my_status === 'pending' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {statusText[group.my_status]}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 truncate mt-1">{group.description || '暂无介绍'}</p>
                {isAdmin && group.pending_count > 0 && (
                  <div className="inline-flex items-center gap-1 text-xs text-yellow-700 mt-2">
                    <Clock className="w-3 h-3" />
                    {group.pending_count} 个申请待处理
                  </div>
                )}
              </div>
              <div className="text-sm text-gray-600">{group.teacher_name}</div>
              <div className="flex justify-center items-center gap-1 text-sm text-gray-600">
                <Users className="w-4 h-4 text-gray-400" />
                {group.member_count}
              </div>
              <div className="flex justify-center items-center gap-1 text-sm text-gray-600">
                <BookOpen className="w-4 h-4 text-gray-400" />
                {group.list_count}
              </div>
              <div className="flex justify-end gap-2">
                <Link to={`/groups/${group.id}`} className="px-3 py-1.5 text-sm text-primary-700 hover:bg-primary-50 rounded-md">
                  查看
                </Link>
                {activeTab === 'all' && !group.my_status && !isAdmin && (
                  <button onClick={() => joinGroup(group.id)} className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700">
                    申请
                  </button>
                )}
                {activeTab !== 'managed' && group.my_status && !isAdmin && (
                  <button onClick={() => leaveGroup(group.id)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md">
                    {group.my_status === 'pending' ? '撤销' : '退出'}
                  </button>
                )}
                {activeTab === 'managed' && (
                  <button onClick={() => deleteGroup(group.id)} className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md">
                    删除
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">创建小组</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="小组名称"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="小组介绍"
                rows={4}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                取消
              </button>
              <button onClick={createGroup} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">
                <CheckCircle className="w-4 h-4" />
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
