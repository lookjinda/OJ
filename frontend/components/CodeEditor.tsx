import Editor from '@monaco-editor/react';

interface Props {
  language: 'python' | 'cpp';
  code: string;
  onChange: (code: string) => void;
}

export default function CodeEditor({ language, code, onChange }: Props) {
  const handleEditorChange = (value: string | undefined) => {
    onChange(value || '');
  };

  return (
    <div className="code-editor border border-gray-200 rounded-lg overflow-hidden" style={{ height: '560px' }}>
      <Editor
        height="100%"
        language={language}
        value={code}
        onChange={handleEditorChange}
        theme="vs-light"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          wordWrap: 'on',
          automaticLayout: true,
          scrollBeyondLastLine: false,
          tabSize: language === 'python' ? 4 : 2,
        }}
      />
    </div>
  );
}