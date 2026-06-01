import { useState, useEffect } from 'react';
import { Trophy, Medal } from 'lucide-react';
import { submissionApi } from '../utils/api';

interface LeaderboardEntry {
  user_id: number;
  username: string;
  total_score: number;
  solved_count: number;
}

export default function Leaderboard() {
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    try {
      const res = await submissionApi.getLeaderboard();
      setData(res.data);
    } catch (err) {
      console.error('加载排行榜失败:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center space-x-2 mb-6">
        <Trophy className="w-6 h-6 text-yellow-500" />
        <h1 className="text-2xl font-bold text-gray-900">排行榜</h1>
      </div>

      {loading ? (
        <div className="text-center py-12">加载中...</div>
      ) : (
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  排名
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  用户
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  分数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  解题数
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.map((item, idx) => (
                <tr key={item.user_id} className={idx < 3 ? 'bg-yellow-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {idx === 0 && <Medal className="w-5 h-5 text-yellow-500 mr-1" />}
                      {idx === 1 && <Medal className="w-5 h-5 text-gray-400 mr-1" />}
                      {idx === 2 && <Medal className="w-5 h-5 text-orange-600 mr-1" />}
                      <span className="font-medium">{idx + 1}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-gray-900">{item.username}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-primary-600 font-semibold">{item.total_score}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {item.solved_count} 题
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}