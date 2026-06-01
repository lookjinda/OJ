import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Send, CheckCircle, XCircle, Clock } from 'lucide-react';
import { questionApi, submissionApi } from '../utils/api';
import CodeEditor from '../components/CodeEditor';
import ScratchEditor from '../components/ScratchEditor';

// 格式化示例输入：字符串去 \r 换行；对象 key=value 格式；数组紧凑 JSON
function fmtInput(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (Array.isArray(val)) return JSON.stringify(val);
  if (typeof val === 'object') {
    // 对象按 key = value 每行显示
    return Object.entries(val)
      .map(([k, v]) => `${k} = ${JSON.stringify(v)}`)
      .join('\n');
  }
  return String(val);
}

// 格式化示例输出：与 fmtInput 相同逻辑
function fmtOutput(val: any): string {
  return fmtInput(val);
}

interface Question {
  id: number;
  title: string;
  type: string;
  language: string | null;
  difficulty: string;
  points: number;
  content: string;
  test_cases?: any;
  options?: string[];
  answer?: string;
  solved?: number;
  tags?: string;
}

export default function QuestionDetail() {
  const { id } = useParams<{ id: string }>();
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<'python' | 'cpp' | 'scratch'>('python');
  const [code, setCode] = useState('');
  const [answer, setAnswer] = useState('');
  const [scratchFile, setScratchFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    loadQuestion();
  }, [id]);

  useEffect(() => {
    if (question?.starter_code) {
      setCode(question.starter_code);
    }
    if (question?.language) {
      setLanguage(question.language as any);
    }
  }, [question]);

  const loadQuestion = async () => {
    try {
      const res = await questionApi.getById(Number(id));
      setQuestion(res.data);
    } catch (err) {
      console.error('加载题目失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setResult(null);

    try {
      const payload: any = { question_id: Number(id) };

      if (question?.type === 'programming') {
        if (question.language === 'scratch') {
          if (scratchFile) {
            const arrayBuffer = await scratchFile.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            payload.scratch_project = btoa(binary);
            payload.scratch_filename = scratchFile.name;
          } else {
            setResult({ result: 'error', feedback: '请先上传Scratch项目文件(.sb3)' });
            setSubmitting(false);
            return;
          }
        } else {
          payload.language = language;
          payload.code = code;
        }
      } else if (question?.type === 'fill') {
        payload.answer = answer;
      } else if (question?.type === 'choice') {
        payload.answer = answer;
      }

      const res = await submissionApi.submit(payload);
      setResult(res.data);
    } catch (err: any) {
      console.error('提交失败:', err);
      setResult({ result: 'error', feedback: err.response?.data?.error || '提交失败' });
    } finally {
      setSubmitting(false);
    }
  };

  const difficultyColors: Record<string, string> = {
    easy: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    hard: 'bg-red-100 text-red-800',
  };

  const difficultyLabels: Record<string, string> = {
    easy: '简单',
    medium: '中等',
    hard: '困难',
  };

  if (loading) {
    return <div className="max-w-7xl mx-auto px-4 py-8">加载中...</div>;
  }

  if (!question) {
    return <div className="max-w-7xl mx-auto px-4 py-8">题目不存在</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 题目信息 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{question.title}</h1>
        <div className="flex items-center space-x-3">
          <span className={`px-2 py-1 text-xs rounded ${difficultyColors[question.difficulty]}`}>
            {difficultyLabels[question.difficulty]}
          </span>
          {question.language && (
            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
              {question.language.toUpperCase()}
            </span>
          )}
          <span className="text-sm text-gray-600">{question.points}分</span>
          {question.time_limit && (
            <span className="text-sm text-gray-500 flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              {question.time_limit}秒
            </span>
          )}
        </div>
      </div>

      {/* Scratch题全宽，其他左右分栏 */}
      {question.type === 'programming' && question.language === 'scratch' ? (
        <div className="space-y-6">
          {/* 题目描述 */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-4">题目描述</h2>
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-gray-700">{question.content}</pre>
            </div>
          </div>

          {/* Scratch作答区 */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">作答</h2>
              <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded text-sm font-medium">
                🐱 Scratch
              </span>
            </div>
            <ScratchEditor scratchFile={scratchFile} onFileSelect={setScratchFile} />

            {/* 提交按钮 */}
            <div className="mt-6 flex space-x-3">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? '提交中...' : '提交'}</span>
              </button>
            </div>

            {/* 结果展示 */}
            {result && (
              <div className={`mt-6 p-4 rounded-lg ${
                result.result === 'accepted' || result.result === 'pass' ? 'bg-green-50 border border-green-200' :
                result.result === 'wrong' || result.result === 'fail' ? 'bg-red-50 border border-red-200' :
                'bg-yellow-50 border border-yellow-200'
              }`}>
                <div className="flex items-center space-x-2 mb-2">
                  {result.result === 'accepted' || result.result === 'pass' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : result.result === 'wrong' || result.result === 'fail' ? (
                    <XCircle className="w-5 h-5 text-red-600" />
                  ) : (
                    <Clock className="w-5 h-5 text-yellow-600" />
                  )}
                  <span className={`font-semibold ${
                    result.result === 'accepted' || result.result === 'pass' ? 'text-green-800' :
                    result.result === 'wrong' || result.result === 'fail' ? 'text-red-800' :
                    'text-yellow-800'
                  }`}>
                    {result.result === 'accepted' || result.result === 'pass' ? '通过！' :
                     result.result === 'wrong' || result.result === 'fail' ? '答案错误' :
                     '部分正确'}
                  </span>
                  <span className="text-sm text-gray-600">
                    得分：{result.score}/{question.points}
                  </span>
                </div>
                {result.feedback && (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{result.feedback}</p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：题目描述 */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">题目描述</h2>
          <div className="prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap text-gray-700">{question.content}</pre>
          </div>

        </div>

        {/* 示例 */}
        {question.type === 'programming' && question.test_cases && question.language !== 'scratch' && (
          <div className="mt-6">
            <h3 className="text-md font-semibold mb-3">示例</h3>
            <div className="space-y-3">
              {question.test_cases.slice(0, 3).map((tc: any, idx: number) => (
                <div key={idx} className="bg-gray-50 rounded-md border border-gray-200 overflow-hidden">
                  <div className="bg-blue-50 px-3 py-1 border-b border-gray-200 text-xs font-medium text-blue-700">
                    样例 {idx + 1}
                  </div>
                  <div className="flex divide-x divide-gray-200">
                    <div className="flex-1 p-3">
                      <div className="text-xs font-medium text-gray-500 mb-1">输入</div>
                      <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                        {fmtInput(tc.input)}
                      </pre>
                    </div>
                    <div className="flex-1 p-3">
                      <div className="text-xs font-medium text-gray-500 mb-1">输出</div>
                      <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                        {fmtOutput(tc.expected !== undefined ? tc.expected : tc.output)}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 右侧：作答区 */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">作答</h2>

          {/* 编程题编辑器 */}
          {question.type === 'programming' && (
            <div>
              {/* 语言选择 - Python/C++ */}
              <div className="mb-4 flex space-x-2">
                <button
                  onClick={() => setLanguage('python')}
                  className={`px-3 py-1 rounded ${
                    language === 'python'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Python
                </button>
                <button
                  onClick={() => setLanguage('cpp')}
                  className={`px-3 py-1 rounded ${
                    language === 'cpp'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  C++
                </button>
              </div>

              <CodeEditor
                language={language}
                code={code}
                onChange={setCode}
              />
            </div>
          )}

          {/* 选择题 */}
          {question.type === 'choice' && question.options && (
            <div className="space-y-3">
              {(question.options || []).map((opt: string, idx: number) => (
                <label
                  key={idx}
                  className={`flex items-center p-3 border rounded-lg cursor-pointer ${
                    answer === String.fromCharCode(65 + idx)
                      ? 'border-primary-500 bg-primary-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="answer"
                    value={String.fromCharCode(65 + idx)}
                    checked={answer === String.fromCharCode(65 + idx)}
                    onChange={(e) => setAnswer(e.target.value)}
                    className="mr-3"
                  />
                  <span className="font-medium mr-2">{String.fromCharCode(65 + idx)}.</span>
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          )}

          {/* 填空题 */}
          {question.type === 'fill' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">答案</label>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                rows={5}
                placeholder="请输入答案..."
              />
            </div>
          )}

          {/* 提交按钮 */}
          <div className="mt-6 flex space-x-3">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? '提交中...' : '提交'}</span>
            </button>
          </div>

          {/* 结果展示 */}
          {result && (
            <div className={`mt-6 p-4 rounded-lg ${
              ['accepted', 'pass'].includes(result.result) ? 'bg-green-50 border border-green-200' :
              ['wrong', 'fail'].includes(result.result) ? 'bg-red-50 border border-red-200' :
              'bg-yellow-50 border border-yellow-200'
            }`}>
              <div className="flex items-center space-x-2 mb-2">
                {['accepted', 'pass'].includes(result.result) ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : ['wrong', 'fail'].includes(result.result) ? (
                  <XCircle className="w-5 h-5 text-red-600" />
                ) : (
                  <Clock className="w-5 h-5 text-yellow-600" />
                )}
                <span className={`font-semibold ${
                  ['accepted', 'pass'].includes(result.result) ? 'text-green-800' :
                  ['wrong', 'fail'].includes(result.result) ? 'text-red-800' :
                  'text-yellow-800'
                }`}>
                  {['accepted', 'pass'].includes(result.result) ? '通过！' :
                   ['wrong', 'fail'].includes(result.result) ? '答案错误' :
                   '运行错误'}
                </span>
                <span className="text-sm text-gray-600">
                  得分：{result.score}/{question.points}
                </span>
              </div>
              {result.feedback && (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{result.feedback}</p>
              )}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}