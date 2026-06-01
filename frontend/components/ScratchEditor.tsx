import { Upload } from 'lucide-react';

interface Props {
  onFileSelect: (file: File | null) => void;
  scratchFile: File | null;
}

export default function ScratchEditor({ onFileSelect, scratchFile }: Props) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-orange-400 transition-colors cursor-pointer">
        <input
          type="file"
          accept=".sb3,.sb2"
          onChange={handleFileChange}
          className="hidden"
          id="scratch-upload"
        />
        <label htmlFor="scratch-upload" className="cursor-pointer">
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-base text-gray-600 mb-1">
            {scratchFile ? scratchFile.name : '点击上传 Scratch 项目文件'}
          </p>
          <p className="text-xs text-gray-400">支持 .sb3 格式</p>
        </label>
      </div>
      {scratchFile && (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-2">
          <span className="text-sm text-green-700">✓ 已选择: {scratchFile.name} ({(scratchFile.size / 1024).toFixed(1)} KB)</span>
          <button
            onClick={() => onFileSelect(null)}
            className="text-xs text-red-500 hover:text-red-700"
          >
            移除
          </button>
        </div>
      )}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800 font-medium mb-2">📝 操作步骤</p>
        <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
          <li>打开 Scratch 本地编辑器完成作品</li>
          <li>在编辑器中点击「文件 → 保存到计算机」下载 .sb3 文件</li>
          <li>在此上传 .sb3 文件并提交</li>
        </ol>
      </div>
    </div>
  );
}
