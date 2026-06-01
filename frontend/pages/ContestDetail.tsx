import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { contestApi } from '../utils/api';
import { useAuthStore } from '../stores';
import { Trophy, Clock, Users, CheckCircle, ArrowLeft, Zap, Play } from 'lucide-react';

interface ContestDetail {
  id: number;
  title: string;
  description: string;
  status: string;
  start_time: string;
  end_time: string;
  participant_count: number;
  joined: number;
  questions: Question[];
}

interface Question {
  id: number;
  title: string;
  type: string;
  difficulty: string;
  points: number;
  solved: number;
}

interface Ranking {
  id: number;
  username: string;
  solved_count: number;
  total_score: number;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  upcoming: { label: '未开始', color: 'text-blue-600', bg: 'bg-blue-100' },
  ongoing: { label: '进行中', color: 'text-green-600', bg: 'bg-green-100' },
  ended: { label: '已结束', color: 'text-gray-600', bg: 'bg-gray-100' },
};

const ContestDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const [contest, setContest] = useState<ContestDetail | null>(null);
  const [ranking, setRanking] = useState<Ranking[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    fetchContest();
  }, [id]);

  const fetchContest = async () => {
    try {
      const res = await contestApi.getById(Number(id));
      setContest(res.data);
      
      // 获取排名
      if (res.data.status !== 'upcoming') {
        const rankRes = await contestApi.getRanking(Number(id));
        setRanking(rankRes.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!user || !contest) return;
    setJoining(true);
    try {
      await contestApi.join(contest.id);
      fetchContest();
    } catch (err: any) {
      alert(err.response?.data?.error || '参加失败');
    } finally {
      setJoining(false);
    }
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleString('zh-CN');
  };

  const getCountdown = () => {
    if (!contest) return '';
    const end = new Date(contest.end_time);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    if (diff <= 0) return '已结束';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `剩余 ${hours}小时${mins}分钟`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!contest) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">比赛不存在</p>
        <Link to="/contests" className="text-indigo-600 hover:underline mt-4 inline-block">
          返回比赛列表
        </Link>
      </div>
    );
  }

  const sc = statusConfig[contest.status] || statusConfig.upcoming;

  return (
    <div className="max-w-6xl mx-auto">
      <Link
        to="/contests"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft size={20} />
        返回比赛
      </Link>

      {/* 比赛信息 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{contest.title}</h1>
              <span className={`px-2 py-0.5 rounded text-sm font-medium ${sc.bg} ${sc.color}`}>
                {sc.label}
              </span>
              {contest.status === 'ongoing' && (
                <Zap className="h-5 w-5 text-yellow-500" />
              )}
            </div>
            <p className="text-gray-600 mt-2">{contest.description || '暂无描述'}</p>
            <div className="flex items-center gap-6 mt-4 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Clock size={16} />
                <span>{formatTime(contest.start_time)} - {formatTime(contest.end_time)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Users size={16} />
                <span>{contest.participant_count} 人参加</span>
              </div>
            </div>
            {contest.status === 'ongoing' && (
              <p className="text-orange-600 font-medium mt-2">{getCountdown()}</p>
            )}
          </div>
          <Trophy className="h-12 w-12 text-yellow-500 flex-shrink-0" />
        </div>

        {/* 参加按钮 */}
        {user && contest.status !== 'ended' && contest.joined === 0 && (
          <button
            onClick={handleJoin}
            disabled={joining}
            className="mt-4 flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            <Play size={20} />
            {joining ? '参加中...' : '参加比赛'}
          </button>
        )}
        {contest.joined > 0 && (
          <div className="mt-4 flex items-center gap-2 text-green-600">
            <CheckCircle size={20} />
            <span>已参加</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 题目列表 */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">题目</h2>
          </div>
          {contest.status === 'upcoming' && contest.joined === 0 ? (
            <div className="p-8 text-center text-gray-500">
              比赛开始后才能查看题目
            </div>
          ) : contest.questions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">暂无题目</div>
          ) : (
            <div className="divide-y">
              {contest.questions.map((q, idx) => (
                <Link
                  key={q.id}
                  to={`/questions/${q.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-4">
                    <span className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 font-medium">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="font-medium text-gray-900">{q.title}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 text-sm">{q.points} 分</span>
                    {q.solved > 0 ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 排行榜 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">排行榜</h2>
          </div>
          {ranking.length === 0 ? (
            <div className="p-8 text-center text-gray-500">暂无排名</div>
          ) : (
            <div className="divide-y">
              {ranking.slice(0, 10).map((r, idx) => (
                <div key={r.id} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium ${
                      idx < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {idx + 1}
                    </span>
                    <span className="text-sm font-medium">{r.username}</span>
                  </div>
                  <span className="text-sm text-gray-600">{r.total_score} 分</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContestDetail;