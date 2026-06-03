import { KeyboardEvent } from 'react';

interface Props {
  language: 'python' | 'cpp';
  code: string;
  onChange: (code: string) => void;
}

const placeholders = {
  python: '在这里输入 Python 代码...',
  cpp: '在这里输入 C++ 代码...',
};

export default function CodeEditor({ language, code, onChange }: Props) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Tab') return;
    event.preventDefault();

    const target = event.currentTarget;
    const indent = language === 'python' ? '    ' : '  ';
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const nextCode = `${code.slice(0, start)}${indent}${code.slice(end)}`;

    onChange(nextCode);
    window.requestAnimationFrame(() => {
      target.selectionStart = start + indent.length;
      target.selectionEnd = start + indent.length;
    });
  };

  return (
    <div className="code-editor border border-gray-200 rounded-lg overflow-hidden bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">
        <span>{language === 'python' ? 'Python' : 'C++'}</span>
        <span>{code.length} 字符</span>
      </div>
      <textarea
        value={code}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        placeholder={placeholders[language]}
        className="h-[460px] w-full resize-y bg-slate-950 px-4 py-3 font-mono text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500"
      />
    </div>
  );
}
