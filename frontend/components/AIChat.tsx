import { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, Sparkles, Image, XCircle } from 'lucide-react';
import { useAuthStore } from '../stores';

// 简单的 markdown 渲染函数（避免额外依赖）
function renderMarkdown(text: string): string {
  if (!text) return '';
  let html = text
    // 代码块（先处理，防止干扰其他规则）
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre class="bg-gray-800 text-green-400 text-xs p-3 rounded-lg my-2 overflow-x-auto"><code>${escapeHtml(code.trim())}</code></pre>`)
    // 行内代码
    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 text-pink-600 px-1.5 py-0.5 rounded text-xs font-mono">$1</code>')
    // 粗体
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // 斜体
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // 标题 ### 
    .replace(/^### (.+)$/gm, '<h4 class="text-sm font-bold text-gray-700 mt-2 mb-1">$1</h4>')
    // 标题 ##
    .replace(/^## (.+)$/gm, '<h3 class="text-base font-bold text-gray-700 mt-3 mb-1">$1</h3>')
    // 标题 #
    .replace(/^# (.+)$/gm, '<h2 class="text-lg font-bold text-gray-800 mt-3 mb-2">$1</h2>')
    // 无序列表项
    .replace(/^[-*] (.+)$/gm, '<li class="ml-2 text-sm">$1</li>')
    // 有序列表项
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-2 text-sm">$1</li>')
    // 换行（双换行=段落）
    .replace(/\n\n/g, '</p><p class="text-sm leading-relaxed">')
    .replace(/\n/g, '<br/>');

  // 包裹段落
  if (html.includes('<h') || html.includes('<pre') || html.includes('<li')) {
    // 有结构标签时不包裹段落
    return html;
  }
  return `<p class="text-sm leading-relaxed">${html}</p>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  image?: string; // base64 without prefix
}

interface AIChatProps {
  onClose: () => void;
}

export default function AIChat({ onClose }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '你好呀！👋 我是小码老师，有任何编程问题都可以问我哦～无论是 Python、C++ 还是 Scratch，我都很乐意帮助你！',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null); // base64 without prefix
  const [pendingImageName, setPendingImageName] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { token } = useAuthStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 自动调整 textarea 高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const processImageFile = (file: File, filename?: string) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('图片大小不能超过 10MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      const base64 = result.replace(/^data:image\/\w+;base64,/, '');
      setPendingImage(base64);
      setPendingImageName(filename || file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(file);
    e.target.value = '';
  };

  // Ctrl+V / Cmd+V 粘贴图片
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find(item => item.kind === 'file' && item.type.startsWith('image/'));
    if (imageItem) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) {
        const filename = `截图_${new Date().toLocaleString('zh-CN').replace(/[\s:/]/g, '-')}.png`;
        processImageFile(file, filename);
      }
    }
  };

  const handleRemoveImage = () => {
    setPendingImage(null);
    setPendingImageName('');
  };

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && !pendingImage) || loading) return;

    const userMsg: Message = {
      role: 'user',
      content: text,
      image: pendingImage || undefined,
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setPendingImage(null);
    setPendingImageName('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: `出错啦：${data.error || '未知错误'}` },
        ]);
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '网络连接失败，请检查网络后重试～' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200"
         style={{ width: 380, height: 520 }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-white" />
          <span className="text-white font-bold text-base">小码老师</span>
          <span className="text-indigo-200 text-xs">编程助手</span>
        </div>
        <button onClick={onClose} className="text-white/80 hover:text-white transition">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs ${
              msg.role === 'user' ? 'bg-indigo-500 text-white' : 'bg-purple-500 text-white'
            }`}>
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-indigo-500 text-white rounded-tr-sm'
                : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
            }`}>
              {msg.image && (
                <img
                  src={`data:image/jpeg;base64,${msg.image}`}
                  alt="图片"
                  className="mb-2 rounded-lg max-w-full object-cover"
                  style={{ maxHeight: 200 }}
                />
              )}
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="shrink-0 w-7 h-7 rounded-full bg-purple-500 flex items-center justify-center text-xs text-white">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-gray-200 px-3 py-2 rounded-2xl rounded-tl-sm shadow-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <div className="border-t bg-white p-3 shrink-0">
        {/* Pending image preview */}
        {pendingImage && (
          <div className="mb-2 flex items-center gap-2">
            <div className="relative inline-block">
              <img
                src={`data:image/jpeg;base64,${pendingImage}`}
                alt="待发送"
                className="h-14 rounded-lg border border-gray-200 object-cover"
              />
              <button
                onClick={handleRemoveImage}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-gray-400 truncate max-w-[120px]">{pendingImageName}</p>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 w-9 h-9 border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 text-gray-400 hover:text-indigo-500 rounded-xl flex items-center justify-center transition"
          >
            <Image className="w-4 h-4" />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            placeholder="输入问题，可 Ctrl+V 粘贴截图..."
            rows={1}
            className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition"
            style={{ maxHeight: 120 }}
          />
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !pendingImage) || loading}
            className="shrink-0 w-9 h-9 bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-300 text-white rounded-xl flex items-center justify-center transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-1.5">小码老师 · 支持图片（粘贴/选择）· Enter 发送</p>
      </div>
    </div>
  );
}