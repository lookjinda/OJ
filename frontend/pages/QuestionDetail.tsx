import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle, Clock, Cpu, Database, Send, XCircle } from 'lucide-react';
import { questionApi, submissionApi } from '../utils/api';
import { useAuthStore } from '../stores';
import CodeEditor from '../components/CodeEditor';
import ScratchEditor from '../components/ScratchEditor';

function fmt(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'object') return Object.entries(value).map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join('\n');
  return String(value);
}

function splitTags(tags?: string | null) {
  return String(tags || '').split(/[,，]/).map((tag) => tag.trim()).filter(Boolean);
}

function html(value: any) {
  return { __html: String(value || '') };
}

const statusText: Record<string, string> = {
  pending: '等待评测',
  judging: '正在评测',
  accepted: '答案正确',
  wrong_answer: '答案错误',
  time_limit_exceeded: '超出时间限制',
  runtime_error: '运行错误',
  compile_error: '编译错误',
  system_error: '系统错误',
  partial: '部分正确',
};

export default function QuestionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [question, setQuestion] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<'python' | 'cpp' | 'scratch'>('python');
  const [code, setCode] = useState('');
  const [answer, setAnswer] = useState('');
  const [scratchFile, setScratchFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<any>(null);

  useEffect(() => {
    questionApi.getById(Number(id))
      .then((res) => setQuestion(res.data))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (question?.language) setLanguage(question.language);
  }, [question]);

  useEffect(() => {
    if (!submission?.id || !['pending', 'judging'].includes(submission.status)) return;
    const timer = window.setInterval(async () => {
      try {
        const res = await submissionApi.getById(submission.id);
        setSubmission(res.data);
        if (!['pending', 'judging'].includes(res.data.status)) window.clearInterval(timer);
      } catch {
        window.clearInterval(timer);
      }
    }, 1800);
    return () => window.clearInterval(timer);
  }, [submission?.id, submission?.status]);

  const examples = useMemo(() => {
    if (!question?.test_cases) return [];
    return Array.isArray(question.test_cases) ? question.test_cases.slice(0, 3) : [];
  }, [question]);

  const submit = async () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    setSubmitting(true);
    setSubmission(null);
    try {
      const payload: any = { question_id: Number(id) };
      if (question.type === 'programming') {
        if (question.language === 'scratch') {
          if (!scratchFile) {
            setSubmission({ status: 'system_error', feedback: '请先上传 Scratch 项目文件' });
            return;
          }
          const buffer = await scratchFile.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i += 1) binary += String.fromCharCode(bytes[i]);
          payload.scratch_project = btoa(binary);
          payload.scratch_filename = scratchFile.name;
        } else {
          payload.language = language;
          payload.code = code;
        }
      } else {
        payload.answer = answer;
      }
      const res = await submissionApi.submit(payload);
      setSubmission(res.data);
    } catch (err: any) {
      setSubmission({ status: 'system_error', feedback: err.response?.data?.error || '提交失败' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="max-w-7xl mx-auto py-10 text-gray-400">加载中...</div>;
  if (!question) return <div className="max-w-7xl mx-auto py-10 text-gray-400">题目不存在</div>;

  const caseResults = submission?.case_results || [];
  const passed = submission?.status === 'accepted' || submission?.result === 'pass';
  const failed = submission && !['pending', 'judging', 'accepted', 'pass'].includes(submission.status || submission.result);

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5">
      <section className="space-y-4 min-w-0">
        <div className="bg-white border rounded-lg p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-sm text-gray-400 font-mono">P{question.id}</div>
              <h1 className="text-2xl font-semibold text-gray-900 mt-1">{question.title}</h1>
              <div className="flex flex-wrap gap-2 mt-3">
                {splitTags(question.tags).map((tag) => (
                  <Link key={tag} to={`/?tag=${encodeURIComponent(tag)}`} className="px-2 py-1 bg-slate-100 text-gray-600 rounded text-xs">
                    {tag}
                  </Link>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 min-w-[220px]">
              <div className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-sky-600" />{question.time_limit_ms || 1000} ms</div>
              <div className="flex items-center gap-1.5"><Database className="w-4 h-4 text-sky-600" />{question.memory_limit_mb || 128} MB</div>
              <div className="flex items-center gap-1.5"><Cpu className="w-4 h-4 text-sky-600" />{question.language?.toUpperCase() || '通用'}</div>
              <div>{question.accepted_count || 0}/{question.submission_count || 0} 通过</div>
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-lg p-5">
          <h2 className="text-lg font-semibold mb-3">题目描述</h2>
          <div className="prose max-w-none text-sm leading-7 text-gray-700" dangerouslySetInnerHTML={html(question.content)} />
        </div>

        {examples.length > 0 && (
          <div className="bg-white border rounded-lg p-5">
            <h2 className="text-lg font-semibold mb-3">样例</h2>
            <div className="space-y-4">
              {examples.map((tc: any, index: number) => (
                <div key={index} className="border rounded-md overflow-hidden">
                  <div className="bg-slate-50 px-3 py-2 text-sm font-medium">样例 {index + 1}</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
                    <div className="p-3">
                      <div className="text-xs text-gray-500 mb-2">输入</div>
                      <pre className="text-sm whitespace-pre-wrap font-mono">{fmt(tc.input)}</pre>
                    </div>
                    <div className="p-3">
                      <div className="text-xs text-gray-500 mb-2">输出</div>
                      <pre className="text-sm whitespace-pre-wrap font-mono">{fmt(tc.expected !== undefined ? tc.expected : tc.output)}</pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <aside className="space-y-4">
        <div className="bg-white border rounded-lg p-5">
          <h2 className="text-lg font-semibold mb-4">提交</h2>
          {question.type === 'programming' && question.language !== 'scratch' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                {(['python', 'cpp'] as const).map((lang) => (
                  <button key={lang} onClick={() => setLanguage(lang)} className={`px-3 py-1.5 rounded text-sm ${language === lang ? 'bg-sky-600 text-white' : 'bg-slate-100 text-gray-700'}`}>
                    {lang === 'python' ? 'Python' : 'C++'}
                  </button>
                ))}
              </div>
              <CodeEditor language={language} code={code} onChange={setCode} />
            </div>
          )}
          {question.type === 'programming' && question.language === 'scratch' && (
            <ScratchEditor scratchFile={scratchFile} onFileSelect={setScratchFile} />
          )}
          {question.type === 'choice' && question.options && (
            <div className="space-y-2">
              {question.options.map((option: string, index: number) => {
                const value = String.fromCharCode(65 + index);
                return (
                  <label key={value} className="flex gap-2 p-3 border rounded-md cursor-pointer hover:bg-slate-50">
                    <input type="radio" value={value} checked={answer === value} onChange={(e) => setAnswer(e.target.value)} />
                    <span>{option}</span>
                  </label>
                );
              })}
            </div>
          )}
          {question.type === 'fill' && (
            <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={5} className="w-full px-3 py-2 border rounded-md text-sm" placeholder="请输入答案" />
          )}
          <button onClick={submit} disabled={submitting} className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 disabled:opacity-50">
            <Send className="w-4 h-4" />
            {submitting ? '提交中...' : isAuthenticated() ? '提交答案' : '登录后提交'}
          </button>
        </div>

        {submission && (
          <div className={`bg-white border rounded-lg p-5 ${passed ? 'border-emerald-200' : failed ? 'border-rose-200' : 'border-amber-200'}`}>
            <div className="flex items-center gap-2 font-semibold">
              {passed ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : failed ? <XCircle className="w-5 h-5 text-rose-600" /> : <Clock className="w-5 h-5 text-amber-600" />}
              {statusText[submission.status] || statusText[submission.result] || submission.feedback}
            </div>
            <div className="text-sm text-gray-600 mt-2">得分：{submission.score || 0}/{question.points}</div>
            {submission.feedback && <p className="text-sm text-gray-700 whitespace-pre-wrap mt-2">{submission.feedback}</p>}
            {caseResults.length > 0 && (
              <div className="mt-4 space-y-3">
                {caseResults.map((item: any) => (
                  <div key={item.index} className="border rounded-md p-3 text-xs">
                    <div className="font-medium mb-2">测试点 {item.index}：{statusText[item.status] || item.status}</div>
                    <div className="grid grid-cols-1 gap-2">
                      <pre className="bg-slate-50 p-2 rounded overflow-auto">输入：{item.input}</pre>
                      <pre className="bg-slate-50 p-2 rounded overflow-auto">期望：{item.expected}</pre>
                      <pre className="bg-slate-50 p-2 rounded overflow-auto">实际：{item.actual || item.error}</pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
