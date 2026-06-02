import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Check, Clock, Plus, Trash2, UserMinus, Users, X } from 'lucide-react';
import { groupApi, questionApi } from '../utils/api';

interface Member {
  id: number;
  username: string;
  role: string;
  joined_at: string;
  status: string;
}

interface GroupList {
  id: number;
  title: string;
  description?: string;
  question_count: number;
}

interface Question {
  id: number;
  title: string;
  type: string;
  language?: string;
  difficulty: string;
}

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const groupId = Number(id);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showListForm, setShowListForm] = useState(false);
  const [listForm, setListForm] = useState({ title: '', description: '', question_ids: [] as number[] });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedList, setSelectedList] = useState<any>(null);

  useEffect(() => {
    loadDetail();
  }, [groupId]);

  const loadDetail = async () => {
    setLoading(true);
    try {
      const res = await groupApi.getById(groupId);
      setDetail(res.data);
    } catch (err: any) {
      setDetail({ error: err.response?.data?.error || '加载失败' });
    } finally {
      setLoading(false);
    }
  };

  const loadQuestions = async () => {
    if (questions.length > 0) return;
    const res = await questionApi.getList({ limit: 300 });
    setQuestions(res.data.questions || []);
  };

  const isOwner = !!detail?.group?.is_owner;
  const members: Member[] = detail?.members || [];
  const pendingMembers: Member[] = detail?.pending_members || [];
  const problemLists: GroupList[] = detail?.problem_lists || [];

  const createList = async () => {
    if (!listForm.title.trim()) return;
    await groupApi.createList(groupId, {
      title: listForm.title.trim(),
      description: listForm.description.trim(),
      question_ids: listForm.question_ids,
    });
    setListForm({ title: '', description: '', question_ids: [] });
    setShowListForm(false);
    await loadDetail();
  };

  const reviewMember = async (memberId: number, action: 'approve' | 'reject') => {
    await groupApi.reviewMember(groupId, memberId, action);
    await loadDetail();
  };

  const removeMember = async (memberId: number) => {
    if (!confirm('确定移除该成员？')) return;
    await groupApi.removeMember(groupId, memberId);
    await loadDetail();
  };

  const deleteList = async (listId: number) => {
    if (!confirm('确定删除该题单？')) return;
    await groupApi.deleteList(groupId, listId);
    if (selectedList?.list?.id === listId) setSelectedList(null);
    await loadDetail();
  };

  const openList = async (listId: number) => {
    const res = await groupApi.getList(groupId, listId);
    setSelectedList(res.data);
  };

  const listProgress = useMemo(() => {
    if (!selectedList?.questions?.length) return 0;
    const solved = selectedList.questions.filter((q: any) => q.solved > 0).length;
    return Math.round((solved / selectedList.questions.length) * 100);
  }, [selectedList]);

  if (loading) return <div className="text-center py-12 text-gray-400">加载中...</div>;

  if (!detail || detail.error) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <Link to="/groups" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" />
          小组
        </Link>
        <div className="bg-white border rounded-lg p-8 text-center text-gray-500">{detail?.error || '小组不存在'}</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Link to="/groups" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" />
        小组
      </Link>

      <div className="bg-white rounded-lg border p-5 mb-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{detail.group.name}</h1>
            <p className="text-sm text-gray-500 mt-2 max-w-3xl">{detail.group.description || '暂无小组介绍'}</p>
            <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-500">
              <span className="inline-flex items-center gap-1"><Users className="w-4 h-4" />{members.length} 名成员</span>
              <span className="inline-flex items-center gap-1"><BookOpen className="w-4 h-4" />{problemLists.length} 个题单</span>
              <span>管理员：{detail.group.teacher_name}</span>
            </div>
          </div>
          {isOwner && (
            <button
              onClick={async () => { await loadQuestions(); setShowListForm(true); }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"
            >
              <Plus className="w-4 h-4" />
              发布题单
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        <div className="space-y-5 min-w-0">
          <section className="bg-white rounded-lg border overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">小组题单</h2>
              <span className="text-sm text-gray-500">{problemLists.length} 个</span>
            </div>
            {problemLists.length === 0 ? (
              <div className="py-12 text-center text-gray-400">暂无题单</div>
            ) : (
              <div className="divide-y">
                {problemLists.map((list) => (
                  <div key={list.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-3">
                      <button onClick={() => openList(list.id)} className="text-left min-w-0 flex-1">
                        <div className="font-medium text-gray-900 hover:text-primary-700 truncate">{list.title}</div>
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{list.description || '暂无描述'}</p>
                        <div className="text-xs text-gray-400 mt-2">{list.question_count} 道题</div>
                      </button>
                      {isOwner && (
                        <button onClick={() => deleteList(list.id)} className="p-2 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50" title="删除题单">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {selectedList && (
            <section className="bg-white rounded-lg border overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedList.list.title}</h2>
                  <p className="text-sm text-gray-500">{selectedList.list.description || '暂无描述'}</p>
                </div>
                <div className="text-sm text-gray-500">{listProgress}% 完成</div>
              </div>
              {selectedList.questions.length === 0 ? (
                <div className="py-10 text-center text-gray-400">暂无题目</div>
              ) : (
                <div className="divide-y">
                  {selectedList.questions.map((q: any, index: number) => (
                    <Link key={q.id} to={`/question/${q.id}`} className="grid grid-cols-[44px_1fr_80px_70px] gap-3 px-4 py-3 hover:bg-gray-50 items-center">
                      <div className="text-sm font-mono text-gray-400">{String(index + 1).padStart(2, '0')}</div>
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">{q.title}</div>
                        <div className="text-xs text-gray-400">{q.type}</div>
                      </div>
                      <div className="text-sm text-gray-600">{q.language ? q.language.toUpperCase() : '-'}</div>
                      <div className={q.solved > 0 ? 'text-sm text-green-600' : 'text-sm text-gray-400'}>
                        {q.solved > 0 ? '已完成' : '未完成'}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        <aside className="space-y-5">
          {isOwner && pendingMembers.length > 0 && (
            <section className="bg-white rounded-lg border overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-600" />
                <h2 className="font-semibold text-gray-900">待审核</h2>
              </div>
              <div className="divide-y">
                {pendingMembers.map((member) => (
                  <div key={member.id} className="p-4">
                    <div className="font-medium text-gray-900">{member.username}</div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => reviewMember(member.id, 'approve')} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-green-700 bg-green-50 rounded-md hover:bg-green-100">
                        <Check className="w-4 h-4" />
                        通过
                      </button>
                      <button onClick={() => reviewMember(member.id, 'reject')} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-red-700 bg-red-50 rounded-md hover:bg-red-100">
                        <X className="w-4 h-4" />
                        拒绝
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="bg-white rounded-lg border overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">成员</h2>
              <span className="text-sm text-gray-500">{members.length}</span>
            </div>
            {members.length === 0 ? (
              <div className="p-6 text-center text-gray-400">暂无成员</div>
            ) : (
              <div className="divide-y max-h-[520px] overflow-y-auto">
                {members.map((member) => (
                  <div key={member.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">{member.username}</div>
                      <div className="text-xs text-gray-400">{member.role}</div>
                    </div>
                    {isOwner && (
                      <button onClick={() => removeMember(member.id)} className="p-2 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50" title="移除成员">
                        <UserMinus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      {showListForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[88vh] overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">发布题单</h2>
              <button onClick={() => setShowListForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                value={listForm.title}
                onChange={(e) => setListForm({ ...listForm, title: e.target.value })}
                placeholder="题单标题"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
              <textarea
                value={listForm.description}
                onChange={(e) => setListForm({ ...listForm, description: e.target.value })}
                placeholder="题单说明"
                rows={3}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
              />
              <div className="border rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 border-b text-sm font-medium text-gray-700">选择题目</div>
                <div className="max-h-72 overflow-y-auto divide-y">
                  {questions.map((question) => {
                    const checked = listForm.question_ids.includes(question.id);
                    return (
                      <label key={question.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...listForm.question_ids, question.id]
                              : listForm.question_ids.filter((qid) => qid !== question.id);
                            setListForm({ ...listForm, question_ids: next });
                          }}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 truncate">{question.title}</div>
                          <div className="text-xs text-gray-400">{question.type} · {question.language || '-'}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowListForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                取消
              </button>
              <button onClick={createList} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">
                <Plus className="w-4 h-4" />
                发布
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
