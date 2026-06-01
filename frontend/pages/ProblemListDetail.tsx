import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { listApi } from '../utils/api';
import { BookOpen, User, CheckCircle, XCircle, MinusCircle, ArrowLeft } from 'lucide-react';

interface Question {
  id: number;
  title: string;
  type: string;
  language: string;
  difficulty: string;
  points: number;
  solved: number;
  status?: 'pass' | 'fail' | 'none';
}

interface ProblemListDetail {
  id: number;
  title: string;
  description: string;
  creator_name: string;
  questions: Question[];
}

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

const typeColors: Record<string, string> = {
  programming: 'bg-blue-50 text-blue-700',
  choice: 'bg-purple-50 text-purple-700',
  fill: 'bg-orange-50 text-orange-700',
};

const typeLabels: Record<string, string> = {
  programming: '编程题',
  choice: '选择题',
  fill: '填空题',
};

const StatusIcon = ({ solved }: { solved: number }) => {
  if (solved > 0) return <CheckCircle className="w-5 h-5 text-green-500" title="已通过" />;
  return <MinusCircle className="w-5 h-5 text-gray-300" title="未作答" />;
};

const ProblemListDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [list, setList] = useState<ProblemListDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchList();
  }, [id]);

  const fetchList = async () => {
    try {
      const res = await listApi.getById(Number(id));
      setList(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="text-center py-12 text-gray-500">
        题单不存在
      </div>
    );
  }

  const solvedCount = list.questions.filter(q => q.solved > 0).length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* 返回 */}
      <Link
        to="/lists"
        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4 text-sm"
      >
        <ArrowLeft size={16} />
        题单
      </Link>

      {/* 题单信息卡片 */}
      <div className="bg-white rounded-lg border p-5 mb-5">
        <div className="flex items-start gap-3">
          <BookOpen className="h-8 w-8 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">{list.title}</h1>
            {list.description && (
              <p className="text-gray-500 text-sm mt-1">{list.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <User size={14} />
                <span>{list.creator_name}</span>
              </div>
              <div>
                {solvedCount}/{list.questions.length} 已完成
              </div>
            </div>
            {/* 进度条 */}
            <div className="mt-3">
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${list.questions.length > 0 ? (solvedCount / list.questions.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 题目列表 - 与题库一致的表格样式 */}
      {list.questions.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-lg border">暂无题目</div>
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
          {list.questions.map((q, idx) => (
            <Link
              key={q.id}
              to={`/question/${q.id}`}
              className="grid grid-cols-[40px_1fr_80px_80px_60px_60px] gap-2 px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors items-center group"
            >
              <div>
                <StatusIcon solved={q.solved} />
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-gray-400 text-sm font-mono flex-shrink-0">
                  {String(idx + 1).padStart(2, '0')}
                </span>
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
    </div>
  );
};

export default ProblemListDetailPage;
