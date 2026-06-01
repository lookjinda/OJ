import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listApi } from "../utils/api";
import { useAuthStore } from "../stores";
import { Plus } from "lucide-react";

interface ProblemList {
  id: number;
  title: string;
  description: string;
  question_count: number;
  creator_name: string;
  created_at: string;
}

const ProblemLists: React.FC = () => {
  const [lists, setLists] = useState<ProblemList[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchLists();
  }, []);

  const fetchLists = async () => {
    try {
      const res = await listApi.getList({ limit: 100 });
      setLists(res.data.lists);
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

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">题单</h1>
          <p className="text-gray-600 mt-1">精选题目合集，系统性学习</p>
        </div>
        {user && (
          <Link
            to="/lists/create"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            <Plus size={20} />
            创建题单
          </Link>
        )}
      </div>

      {lists.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">暂无题单</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">序号</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">题单名称</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">描述</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">题目数</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">创建者</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lists.map((list, index) => (
                <tr key={list.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                  <td className="px-4 py-3">
                    <Link to={`/lists/${list.id}`} className="text-indigo-600 hover:text-indigo-800 font-medium">
                      {list.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                    {list.description || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-center">{list.question_count}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{list.creator_name}</td>
                  <td className="px-4 py-3 text-center">
                    <Link
                      to={`/lists/${list.id}`}
                      className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                    >
                      查看
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ProblemLists;
