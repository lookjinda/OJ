import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores';

function html(value: any) {
  return { __html: String(value || '') };
}

export default function ExamDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const recordIdParam = searchParams.get('recordId');

  const [exam, setExam] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [record, setRecord] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    fetch(`/api/exams/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(r => r.json())
      .then(data => {
        setExam(data.exam);
        setQuestions(data.questions);
        setLoading(false);

        // 如果有 recordId 参数，拉取指定的历史记录
        if (recordIdParam) {
          const rec = data.existingRecords?.find((r: any) => String(r.id) === recordIdParam);
          if (rec) {
            setRecord(rec);
            if (rec.answers) setAnswers(rec.answers);
            if (rec.status === 'submitted') {
              setSubmitted(true);
              setScore(rec.score);
            }
          }
          return;
        }

        // 默认：取进行中的记录
        if (data.inProgressRecord) {
          setRecord(data.inProgressRecord);
          if (data.inProgressRecord.answers) setAnswers(data.inProgressRecord.answers);
          if (data.inProgressRecord.status === 'submitted') {
            setSubmitted(true);
            setScore(data.inProgressRecord.score);
          }
          const duration = data.exam.duration * 60;
          const elapsed = data.inProgressRecord.started_at
            ? Math.floor((Date.now() - new Date(data.inProgressRecord.started_at).getTime()) / 1000)
            : 0;
          setTimeLeft(Math.max(0, duration - elapsed));
        }
      });
  }, [id, user, navigate, recordIdParam]);

  // 计时器
  useEffect(() => {
    if (!timeLeft || submitted) return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { autoSubmit(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, submitted]);

  const autoSubmit = () => {
    if (!submitted) handleSubmit(true);
  };

  const handleStart = async () => {
    const res = await fetch(`/api/exams/${id}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || '开始考试失败，请重试');
      return;
    }
    setRecord(data.record);
    if (data.record?.answers) setAnswers(data.record.answers);
    setTimeLeft(exam.duration * 60);
  };

  const handleSubmit = async (isAuto = false) => {
    if (submitting) return;
    setSubmitting(true);
    const res = await fetch(`/api/exams/${id}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ answers })
    });
    const data = await res.json();
    setSubmitted(true);
    setScore(data.score);
    setRecord(data.record);
    setSubmitting(false);
    if (!isAuto) alert(`提交成功！得分：${data.score}/${data.total}`);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const getAnswerKey = (q: any) => {
    const ans = record?.answers?.[q.id];
    if (!submitted) return null;
    return ans;
  };

  const isPracticalOnlyExam = exam && questions.length > 0 && questions.every((q) => {
    const text = `${exam.title || ''} ${exam.description || ''} ${exam.difficulty || ''} ${q.title || ''} ${q.subtype || ''}`;
    return q.type === 'programming' && (text.includes('机器人') || text.includes('实操') || text.includes('实际操作'));
  });

  if (loading) return <div className="p-6 text-gray-500">加载中...</div>;
  if (!exam) return <div className="p-6 text-red-500">考试不存在</div>;

  if (isPracticalOnlyExam) {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <h1 className="text-2xl font-bold text-gray-900">{exam.title}</h1>
          {exam.description && <p className="mt-2 text-sm text-gray-500">{exam.description}</p>}
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-gray-600 md:grid-cols-4">
            <div>题目数量：{exam.question_count}</div>
            <div>考试时长：{exam.duration} 分钟</div>
            <div>总分：{exam.total_score}</div>
            {exam.difficulty && <div>等级：{exam.difficulty}</div>}
          </div>
        </div>

        <div className="space-y-6">
          {questions.map((q, idx) => (
            <div key={q.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="font-bold text-indigo-600">Q{idx + 1}.</span>
                <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">实操题</span>
              </div>
              <h2 className="mb-4 text-lg font-semibold text-gray-900">{q.title}</h2>
              <div className="prose max-w-none text-sm leading-7 text-gray-800" dangerouslySetInnerHTML={html(q.content || q.title)} />
              {q.answer && (
                <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="mb-2 text-sm font-semibold text-amber-800">答案解析</div>
                  <div className="prose max-w-none text-sm leading-7 text-gray-700" dangerouslySetInnerHTML={html(q.answer)} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 未开始：显示开始按钮
  if (!record) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <h1 className="text-2xl font-bold mb-4">{exam.title}</h1>
        <p className="text-gray-600 mb-6">{exam.description || '无描述'}</p>
        <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left text-sm text-gray-600 space-y-1">
          <p>📝 题目数量：{exam.question_count}</p>
          <p>⏱ 考试时长：{exam.duration} 分钟</p>
          <p>💯 总分：{exam.total_score}</p>
          {exam.difficulty && <p>🎯 难度：{exam.difficulty}</p>}
        </div>
        <button
          onClick={handleStart}
          className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-lg font-medium hover:bg-indigo-700"
        >
          开始考试
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* 顶部信息栏 */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10 pb-3 mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-800">{exam.title}</h1>
          <div className="flex items-center gap-4">
            {!submitted && (
              <span className={`font-mono font-bold ${timeLeft < 300 ? 'text-red-500' : 'text-gray-600'}`}>
                ⏱ {formatTime(timeLeft)}
              </span>
            )}
            {submitted && score !== null && (
              <span className="font-bold text-indigo-600">得分：{score}/{exam.total_score}</span>
            )}
            {!submitted && (
              <button
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? '提交中...' : '交卷'}
              </button>
            )}
          </div>
        </div>
        {/* 进度条 */}
        <div className="flex gap-1 mt-2">
          {questions.map((q, i) => (
            <div
              key={q.id}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                !submitted
                  ? (answers[q.id] ? 'bg-indigo-400' : 'bg-gray-200')
                  : (getAnswerKey(q) ? 'bg-indigo-400' : 'bg-gray-200')
              }`}
            />
          ))}
        </div>
      </div>

      {/* 题目列表 */}
      <div className="space-y-6">
        {questions.map((q, idx) => {
          const userAns = answers[q.id];
          const isCorrect = submitted && record?.answers?.[q.id] !== undefined;

          return (
            <div key={q.id} className="bg-white border border-gray-200 rounded-xl p-5">
              {/* 题号 + 类型标签 */}
              <div className="flex items-center gap-2 mb-3">
                <span className="font-bold text-indigo-600">Q{idx + 1}.</span>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  (q.type === 'judge' || q.subtype === 'judge') ? 'bg-orange-100 text-orange-700' :
                  q.type === 'choice' ? 'bg-blue-100 text-blue-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {(q.type === 'judge' || q.subtype === 'judge') ? '判断题' : q.type === 'choice' ? '单选题' : '编程题'}
                </span>
                {submitted && (
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    record?.answers?.[q.id] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {record?.answers?.[q.id] ? '✓ 已答' : '✗ 未答'}
                  </span>
                )}
              </div>

              {/* 题目内容 */}
              <div className="text-gray-800 mb-4 prose max-w-none" dangerouslySetInnerHTML={html(q.content || q.title)} />

              {/* 题目描述图片 */}
              {q.descImages && q.descImages.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-3">
                  {q.descImages.map((img: string, idx: number) => (
                    <img
                      key={idx}
                      src={img}
                      alt={`题目配图${idx + 1}`}
                      className="max-w-full rounded-lg border border-gray-200"
                      style={{ maxHeight: '280px' }}
                    />
                  ))}
                </div>
              )}

              {/* 判断题选项 (subtype=judge 存为choice类型但只有2个选项) */}
              {(q.type === 'judge' || (q.type === 'choice' && q.subtype === 'judge')) && (
                <div className="flex gap-3 mb-4">
                  {['A', 'B'].map(optLabel => {
                    const optText = optLabel === 'A' ? '正确' : '错误';
                    const isSelected = userAns === optLabel;
                    return (
                      <label
                        key={optLabel}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer ${
                          isSelected ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200'
                        } ${submitted ? 'pointer-events-none' : ''}`}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={optLabel}
                          checked={isSelected}
                          onChange={() => !submitted && setAnswers(a => ({ ...a, [q.id]: optLabel }))}
                          className="accent-indigo-600"
                        />
                        <span>{optText}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* 选择题选项 (非判断题) */}
              {q.type === 'choice' && q.subtype !== 'judge' && q.options && (
                <div className="space-y-2 mb-4">
                  {q.options.map((opt: any, oi: number) => {
                    const optLabel = typeof opt === 'string' ? String.fromCharCode(65 + oi) : (opt.label || String.fromCharCode(65 + oi));
                    const rawDisplay = typeof opt === 'string' ? opt : (opt.display ?? opt);
                    // display字段可能存的是纯base64字符串或完整的<img>标签
                    let optDisplay: string;
                    if (typeof rawDisplay === 'string' && rawDisplay.startsWith('data:image')) {
                      optDisplay = `<img src="${rawDisplay}" alt="选项${optLabel}" style="max-width:200px;max-height:120px;border-radius:6px;" />`;
                    } else {
                      optDisplay = String(rawDisplay);
                    }
                    const isSelected = userAns === optLabel;
                    return (
                      <label
                        key={oi}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200'
                        } ${submitted ? 'pointer-events-none' : ''}`}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={optLabel}
                          checked={isSelected}
                          onChange={() => !submitted && setAnswers(a => ({ ...a, [q.id]: optLabel }))}
                          className="accent-indigo-600"
                        />
                        <span className="font-semibold text-indigo-600">{optLabel}. </span>
                        <span dangerouslySetInnerHTML={{ __html: optDisplay }} />
                      </label>
                    );
                  })}
                </div>
              )}

              {/* 判断题选项 (原生judge类型，兼容旧数据) */}
              {q.type === 'judge' && q.subtype !== 'judge' && (
                <div className="flex gap-3 mb-4">
                  {['正确', '错误'].map(opt => (
                    <label
                      key={opt}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer ${
                        userAns === opt ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200'
                      } ${submitted ? 'pointer-events-none' : ''}`}
                    >
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        value={opt}
                        checked={userAns === opt}
                        onChange={() => !submitted && setAnswers(a => ({ ...a, [q.id]: opt }))}
                        className="accent-indigo-600"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* 编程题（只显示，不评分） */}
              {q.type === 'programming' && (
                <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-500 mb-4">
                  <p>📌 编程题需要去题目详情页作答完成后，再回到本考试提交。</p>
                  <Link to={`/question/${q.id}`} className="text-indigo-600 hover:underline mt-1 inline-block">
                    前往作答 →
                  </Link>
                </div>
              )}

              {/* 提交后：显示答案 */}
              {submitted && q.answer && q.type !== 'programming' && (
                <div className={`mt-3 p-3 rounded-lg text-sm ${
                  record?.answers?.[q.id] === q.answer ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="text-gray-500">
                    正确答案：<span className="font-bold text-green-700">
                      {(q.subtype === 'judge' && q.answer === 'A') ? '正确' : (q.subtype === 'judge' && q.answer === 'B') ? '错误' : q.answer}
                    </span>
                  </div>
                  {record?.answers?.[q.id] && record.answers[q.id] !== q.answer && (
                    <div className="text-gray-500 mt-1">
                      你的答案：<span className="font-bold text-red-700">
                        {(q.subtype === 'judge' && record.answers[q.id] === 'A') ? '正确' : (q.subtype === 'judge' && record.answers[q.id] === 'B') ? '错误' : record.answers[q.id]}
                      </span>
                    </div>
                  )}
                  {q.type === 'choice' && (
                    <div className="text-gray-500 mt-1">
                      得分：<span className="font-bold text-green-700">2分</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 底部交卷按钮 */}
      {!submitted && (
        <div className="mt-6 text-center">
          <button
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="px-8 py-3 bg-green-600 text-white rounded-xl text-lg font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? '提交中...' : '交卷'}
          </button>
        </div>
      )}
    </div>
  );
}
