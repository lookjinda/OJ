import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { contestApi } from '../utils/api';
import { Trophy, Clock, Users, Plus, Zap } from 'lucide-react';

interface Contest {
  id: number;
  title: string;
  description: string;
  status: string;
  start_time: string;
  end_time: string;
  participant_count: number;
  creator_name: string;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  upcoming: { label: '未开始', color: 'text-blue-600', bg: 'bg-blue-100' },
  ongoing: { label: '进行中', color: 'text-green-600', bg: 'bg-green-100' },
  ended: { label: '已结束', color: 'text-gray-600', bg: 'bg-gray-100' },
};

const Contests: React.FC = () => {
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    fetchContests();
  }, [filter]);

  const fetchContests = async () => {
    try {
      const params: any = {};
      if (filter) params.status = filter;
      const res = await contestApi.getList(params);
      setContests(res.data.contests);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">比赛</h1>
          <p className="text-gray-600 mt-1">限时竞技，挑战自我</p>
        </div>
      </div>

      {/* 筛选 */}
      <div className="flex gap-3 mb-6">
        {[
          { key: '', label: '全部' },
          { key: 'ongoing', label: '进行中' },
          { key: 'upcoming', label: '未开始' },
          { key: 'ended', label: '已结束' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setFilter(tab.key); setLoading(true); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === tab.key
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {contests.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Trophy className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500">暂无比赛</p>
        </div>
      ) : (
        <div className="space-y-4">
          {contests.map((contest) => {
            const sc = statusConfig[contest.status] || statusConfig.upcoming;
            return (
              <Link
                key={contest.id}
                to={`/contests/${contest.id}`}
                className="block bg-white rounded-lg shadow hover:shadow-lg transition p-6 border border-gray-100"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{contest.title}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${sc.bg} ${sc.color}`}>
                        {sc.label}
                      </span>
                      {contest.status === 'ongoing' && (
                        <Zap className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                    <p className="text-gray-600 text-sm mb-3 line-clamp-1">
                      {contest.description || '暂无描述'}
                    </p>
                    <div className="flex items-center gap-6 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock size={16} />
                        <span>{formatTime(contest.start_time)} - {formatTime(contest.end_time)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users size={16} />
                        <span>{contest.participant_count} 人参加</span>
                      </div>
                    </div>
                  </div>
                  <Trophy className="h-8 w-8 text-yellow-500 flex-shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Contests;