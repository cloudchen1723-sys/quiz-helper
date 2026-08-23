import React, { useState, useRef } from 'react';
import { 
  X, 
  Clipboard, 
  Upload, 
  Sparkles, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  BookOpen, 
  Copy, 
  Check 
} from 'lucide-react';
import { autoParseAny, ParseResult } from '../utils/textParser';
import { getAutoLoadedJsonBanks } from '../data/jsonBankLoader';
import { Question } from '../types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (bankName: string, questions: Question[]) => Promise<void>;
  initialTab?: 'paste' | 'file' | 'presets' | 'prompt';
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  initialTab = 'paste'
}) => {
  const [tab, setTab] = useState<'paste' | 'file' | 'presets' | 'prompt'>(initialTab);
  const [bankName, setBankName] = useState('');
  const [rawText, setRawText] = useState('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen && initialTab) {
      setTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleTextChange = (text: string) => {
    setRawText(text);
    if (!text.trim()) {
      setParseResult(null);
      return;
    }
    const res = autoParseAny(text);
    setParseResult(res);

    if (res.success && !bankName) {
      setBankName(`题库_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '')}_${res.questions.length}题`);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        handleTextChange(text);
      }
    } catch {
      // 若浏览器权限限制，提示用户直接在文本框按 Ctrl+V
    }
  };

  const handleFile = (file: File) => {
    const defaultName = file.name.replace(/\.[^/.]+$/, '');
    setBankName(defaultName);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setRawText(content);
        const res = autoParseAny(content);
        setParseResult(res);
        setTab('paste'); // 切到粘贴页查看预览
      }
    };
    reader.readAsText(file);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = async () => {
    if (!parseResult || !parseResult.success || parseResult.questions.length === 0) return;
    const finalName = bankName.trim() || `新题库_${Date.now().toString().slice(-4)}`;
    setIsSubmitting(true);
    try {
      await onImportSuccess(finalName, parseResult.questions);
      onClose();
      // reset
      setRawText('');
      setBankName('');
      setParseResult(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoadPreset = async (name: string, data: Question[]) => {
    setIsSubmitting(true);
    try {
      await onImportSuccess(name, data);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const aiPromptText = `请帮我针对【某学科或章节主题，如：计算机原理-存储器与CPU】生成 10 道认知题目，直接返回标准的 JSON 数组格式（不要包含其它多余废话），格式规范如下：
[
  {
    "id": 1,
    "type": "single",
    "question": "题目具体内容（ ）",
    "options": {
      "A": "选项A内容",
      "B": "选项B内容",
      "C": "选项C内容",
      "D": "选项D内容"
    },
    "answer": "A",
    "analysis": "核心考点解释，指出为什么选A以及易混淆概念的区别"
  }
]
注意：
- 单选题 type 为 "single"，answer 为单个字母如 "A"
- 多选题 type 为 "multiple"，answer 为连续大写字母如 "ABCD"
- 判断题 type 为 "judge"，options 为 {"A": "正确", "B": "错误"}，answer 为 "A" 或 "B"`;

  const copyPromptToClipboard = () => {
    navigator.clipboard.writeText(aiPromptText);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  // 统计解析出的各类题型
  const stats = parseResult?.success ? {
    single: parseResult.questions.filter(q => q.type === 'single').length,
    multiple: parseResult.questions.filter(q => q.type === 'multiple').length,
    judge: parseResult.questions.filter(q => q.type === 'judge').length,
  } : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white border border-stone-200 w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-stone-900 text-white flex items-center justify-center shadow-xs">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-stone-800 text-base">导入题库</h3>
              <p className="text-xs text-stone-400">支持直接粘贴、JSON拖拽、Markdown文本智能识别与AI提示词</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="px-6 pt-3 border-b border-stone-100 flex space-x-2 text-xs font-medium">
          <button
            onClick={() => setTab('paste')}
            className={`pb-2.5 px-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
              tab === 'paste' 
                ? 'border-stone-900 text-stone-900 font-semibold' 
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Clipboard className="w-3.5 h-3.5" />
            <span>文本 / JSON 直接粘贴</span>
          </button>
          <button
            onClick={() => setTab('file')}
            className={`pb-2.5 px-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
              tab === 'file' 
                ? 'border-stone-900 text-stone-900 font-semibold' 
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>文件拖拽上传</span>
          </button>
          <button
            onClick={() => setTab('presets')}
            className={`pb-2.5 px-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
              tab === 'presets' 
                ? 'border-stone-900 text-stone-900 font-semibold' 
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>内置题库</span>
          </button>
          <button
            onClick={() => setTab('prompt')}
            className={`pb-2.5 px-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
              tab === 'prompt' 
                ? 'border-stone-900 text-stone-900 font-semibold' 
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>AI 生成模板</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {tab === 'paste' && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-stone-700">题库名称</label>
                  <span className="text-[11px] text-stone-400">给你的题库起个名字</span>
                </div>
                <input
                  type="text"
                  placeholder="例如：计算机组成原理精选 199 题"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 transition-all placeholder:text-stone-300"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-stone-700">题库内容（JSON 或 纯文本题目）</label>
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center space-x-1 font-medium bg-blue-50 hover:bg-blue-100/70 px-2 py-0.5 rounded-md transition-colors"
                  >
                    <Clipboard className="w-3 h-3" />
                    <span>从剪贴板一键读取</span>
                  </button>
                </div>
                <textarea
                  rows={8}
                  placeholder={`在此直接粘贴内容，支持两种方式：\n1. 标准 JSON 数组：[ { "id": 1, "type": "single", "question": "...", "options": { "A": "..." }, "answer": "A", "analysis": "..." } ]\n2. 纯文本/Markdown 考卷：\n1. 计算机能直接执行的是？\nA. 汇编语言  B. 高级语言  C. 自然语言  D. 机器语言\n答案：D\n解析：CPU只能执行由0和1构成的机器指令。`}
                  value={rawText}
                  onChange={(e) => handleTextChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-mono border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 transition-all placeholder:text-stone-300 bg-stone-50/30"
                />
              </div>

              {/* 实时解析结果反馈 */}
              {parseResult && (
                <div className={`p-3.5 rounded-xl border text-xs ${
                  parseResult.success 
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800' 
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  {parseResult.success ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-1.5 font-semibold text-emerald-900">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>解析成功！已识别到 {parseResult.questions.length} 道题目（格式: {parseResult.format === 'json' ? 'JSON 数组' : '纯文本智能提取'}）</span>
                      </div>
                      {stats && (
                        <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
                          <span className="bg-emerald-100/70 text-emerald-800 px-2 py-0.5 rounded-md">单选: {stats.single}</span>
                          <span className="bg-purple-100/70 text-purple-800 px-2 py-0.5 rounded-md">多选: {stats.multiple}</span>
                          <span className="bg-amber-100/70 text-amber-800 px-2 py-0.5 rounded-md">判断: {stats.judge}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">解析失败：</span>
                        <span className="ml-1">{parseResult.error}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'file' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  dragOver 
                    ? 'border-stone-900 bg-stone-100/80 scale-[0.99]' 
                    : 'border-stone-300 hover:border-stone-400 bg-stone-50/40 hover:bg-stone-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.txt,.md"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <div className="w-12 h-12 bg-white rounded-full shadow-xs border border-stone-200 flex items-center justify-center mx-auto mb-3 text-stone-600">
                  <Upload className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-stone-800 mb-1">将 .json 或 .txt 题库文件拖到此处</h4>
                <p className="text-xs text-stone-400 max-w-sm mx-auto mb-4">或者点击此区域从电脑中选择文件，系统将秒级读取并解析</p>
                <span className="inline-block bg-stone-900 text-white text-xs font-medium px-4 py-2 rounded-xl shadow-xs">
                  选择本地文件
                </span>
              </div>
            </div>
          )}

          {tab === 'presets' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-stone-500">选择需要载入的内置题库：</p>
              </div>
              
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {getAutoLoadedJsonBanks().map((preset) => (
                  <div 
                    key={preset.name}
                    className="border border-stone-200 rounded-xl p-3.5 hover:border-stone-400 transition-all bg-white flex items-center justify-between group"
                  >
                    <div className="flex-1 pr-3">
                      <div className="flex items-center space-x-2 mb-1 flex-wrap gap-y-1">
                        <span className="font-semibold text-stone-800 text-sm">{preset.name}</span>
                        {preset.tags.map((tag, idx) => (
                          <span 
                            key={idx} 
                            className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-stone-100 text-stone-600"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-stone-400 leading-relaxed line-clamp-2">
                        {preset.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleLoadPreset(preset.name, preset.questions)}
                      className="bg-stone-900 text-white text-xs font-medium px-3.5 py-2 rounded-xl hover:bg-stone-800 active:scale-95 transition-all shrink-0 shadow-xs"
                    >
                      一键载入
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'prompt' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-xs text-stone-600">把这段提示词发给 ChatGPT / Claude / Gemini，能直接生成可无缝导入的 JSON 题库：</p>
                <button
                  type="button"
                  onClick={copyPromptToClipboard}
                  className="text-xs bg-stone-900 text-white hover:bg-stone-800 px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all shadow-xs shrink-0"
                >
                  {copiedPrompt ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>已复制提示词</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>复制生成 Prompt</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-3.5 bg-stone-900 text-stone-200 rounded-xl font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed border border-stone-800">
                {aiPromptText}
              </div>

              <p className="text-[11px] text-stone-400">
                💡 复制大模型返回的 JSON 结果后，切到「文本 / JSON 直接粘贴」标签页贴入即可！
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-stone-100 bg-stone-50/50 flex justify-between items-center">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100 text-xs font-medium transition-colors"
          >
            取消
          </button>

          {tab === 'paste' && (
            <button
              type="button"
              disabled={!parseResult?.success || isSubmitting}
              onClick={handleConfirmImport}
              className={`px-5 py-2.5 rounded-xl text-xs font-medium flex items-center space-x-1.5 transition-all shadow-xs ${
                parseResult?.success && !isSubmitting
                  ? 'bg-stone-900 text-white hover:bg-stone-800 active:scale-95'
                  : 'bg-stone-200 text-stone-400 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>确认保存到本地题库</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
