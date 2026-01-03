
import React, { useState, useRef, useEffect } from 'react';
import { 
  PlusIcon, 
  PlayIcon, 
  TrashIcon, 
  ArrowDownTrayIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  ArrowPathIcon, 
  SpeakerWaveIcon, 
  UserIcon, 
  InformationCircleIcon,
  KeyIcon, 
  ShieldCheckIcon,
  QuestionMarkCircleIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  CpuChipIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { AudioFile, EmotionStatus } from './types';
import { fileToBase64, formatFileSize } from './utils/audioUtils';
import { analyzeAudioEmotion } from './services/geminiService';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

// 解决 TS 找不到 process 的问题
declare const process: {
  env: {
    API_KEY: string;
  };
};

const App: React.FC = () => {
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [showTip, setShowTip] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 检查 API Key 状态
  const checkKeyStatus = async () => {
    // 优先检查 AI Studio 环境
    if (window.aistudio) {
      try {
        const status = await window.aistudio.hasSelectedApiKey();
        setHasKey(!!status);
      } catch (e) {
        setHasKey(false);
      }
    } else {
      // 在腾讯云部署环境下
      const isEnvKeyValid = typeof process !== 'undefined' && !!process.env.API_KEY;
      setHasKey(isEnvKeyValid);
    }
  };

  useEffect(() => {
    checkKeyStatus();
  }, []);

  const handleConnectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    } else {
      alert("当前为独立部署环境。请在腾讯云 EdgeOne 后台的环境变量中设置 API_KEY。");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles: AudioFile[] = Array.from(e.target.files).map((f: File) => ({
        id: Math.random().toString(36).substring(7),
        file: f,
        name: f.name,
        size: formatFileSize(f.size),
        status: EmotionStatus.IDLE
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearAll = () => {
    if (window.confirm("确定要清空所有记录吗？")) {
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const processBatch = async () => {
    if (isProcessing) return;
    if (!hasKey) {
      if (window.aistudio) {
        const confirmed = window.confirm("检测到未连接 API KEY。现在去连接吗？");
        if (confirmed) await handleConnectKey();
      } else {
        alert("未检测到有效的 API_KEY。请在部署环境配置环境变量。");
      }
      return;
    }

    setIsProcessing(true);
    const pendingFiles = files.filter(f => f.status === EmotionStatus.IDLE || f.status === EmotionStatus.FAILED);
    
    for (const audioFile of pendingFiles) {
      setFiles(prev => prev.map(f => f.id === audioFile.id ? { ...f, status: EmotionStatus.PROCESSING } : f));
      
      try {
        const base64 = await fileToBase64(audioFile.file);
        const result = await analyzeAudioEmotion(base64, audioFile.file.type);
        
        setFiles(prev => prev.map(f => f.id === audioFile.id ? { 
          ...f, 
          status: EmotionStatus.COMPLETED,
          emotionType: result.emotionType,
          emotionLevel: result.emotionLevel,
          voiceIdentity: result.voiceIdentity,
          reasoning: result.reasoning
        } : f));
      } catch (error: any) {
        console.error("Analysis Error:", error);
        setFiles(prev => prev.map(f => f.id === audioFile.id ? { 
          ...f, 
          status: EmotionStatus.FAILED,
          error: "分析中断"
        } : f));
      }
    }
    setIsProcessing(false);
  };

  const exportResults = () => {
    const header = "文件名,情绪,强度(1-10),角色标签,AI洞察\n";
    const rows = files.map(f => 
      `"${f.name}","${f.emotionType || ''}","${f.emotionLevel || ''}","${f.voiceIdentity || ''}","${f.reasoning?.replace(/"/g, '""') || ''}"`
    ).join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `分析结果_${new Date().getTime()}.csv`;
    link.click();
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getLevelColor = (level: number) => {
    const colors = [
      'bg-emerald-400', 'bg-emerald-500', 'bg-green-500', 'bg-lime-500', 'bg-yellow-400',
      'bg-amber-500', 'bg-orange-500', 'bg-orange-600', 'bg-red-500', 'bg-rose-600'
    ];
    return colors[Math.max(0, Math.min(level - 1, 9))];
  };

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-8 flex flex-col min-h-screen antialiased bg-slate-50/50">
      <header className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 rounded-xl shadow-lg shadow-blue-200">
            <SpeakerWaveIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
              SONIC LAB <span className="text-blue-600">实验室</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-bold mt-1.5 tracking-widest uppercase">High-Fidelity Audio Perception</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all border ${
            hasKey 
            ? 'bg-white text-emerald-600 border-emerald-100 shadow-sm' 
            : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            {hasKey ? <ShieldCheckIcon className="w-4 h-4" /> : <KeyIcon className="w-4 h-4" />}
            {hasKey ? 'API 连接正常' : '未连接 API'}
          </div>
          {window.aistudio && (
             <button onClick={handleConnectKey} className="text-xs text-blue-600 font-bold hover:underline">切换 Key</button>
          )}
          <button onClick={() => setShowTip(!showTip)} className="text-slate-400 hover:text-blue-600 p-2 hover:bg-white rounded-full transition-colors">
            <QuestionMarkCircleIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="bg-white border border-slate-200 rounded-3xl p-8 mb-8 shadow-sm relative overflow-hidden group">
        <div className="absolute -top-12 -right-12 p-12 opacity-[0.03] group-hover:scale-110 transition-transform duration-1000">
          <CpuChipIcon className="w-64 h-64 text-blue-600" />
        </div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-blue-600 text-[10px] font-black mb-3 uppercase tracking-[0.2em]">
              <SparklesIcon className="w-4 h-4" />
              Next-Gen Audio Intelligence
            </div>
            <p className="text-slate-600 text-base leading-relaxed font-medium">
              基于 <span className="text-blue-600 font-bold">Gemini 原生多模态音频理解能力</span>，Sonic Lab 绕过传统的语音转文字流程，直接通过声学物理特征——如音调、语流节奏、共鸣感及细微的情感波动，深度解析音频背后的真实情绪底色。我们致力于为创作者提供最精准、最具深度感的语音数据资产解析与标注能力。
            </p>
          </div>
          <div className="flex gap-8 border-l border-slate-100 pl-8 h-full items-center shrink-0">
            <div className="text-center">
              <div className="text-3xl font-black text-slate-900">{files.length}</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">任务队列</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-blue-600">{files.filter(f => f.status === EmotionStatus.COMPLETED).length}</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">已解析</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <input type="file" multiple accept="audio/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl transition-all flex items-center gap-2 text-sm font-bold border border-slate-200/60"
          >
            <PlusIcon className="w-4 h-4" />
            添加音频
          </button>
          <button 
            onClick={processBatch}
            disabled={isProcessing || files.length === 0}
            className={`px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 text-sm font-extrabold shadow-lg ${
              isProcessing || files.length === 0 
                ? 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none' 
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-100'
            }`}
          >
            {isProcessing ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <PlayIcon className="w-4 h-4 fill-current" />}
            {isProcessing ? '正在智能解析...' : '开始AI批量解析'}
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={exportResults}
            disabled={files.length === 0}
            className="px-4 py-2 text-slate-600 hover:text-blue-600 disabled:opacity-30 text-sm font-bold flex items-center gap-2 transition-colors"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            导出数据
          </button>
          <button 
            onClick={clearAll}
            disabled={files.length === 0 || isProcessing}
            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex-1 flex flex-col overflow-hidden min-h-[500px]">
        {files.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300 py-40">
            <SpeakerWaveIcon className="w-12 h-12 opacity-20 mb-4" />
            <p className="text-sm font-bold uppercase tracking-widest">请导入音频文件开始</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left table-fixed">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[25%]">文件名</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[120px]">状态</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[120px]">情绪标签</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">AI 分析</th>
                  <th className="px-6 py-4 w-[60px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {files.map((file, index) => (
                  <tr key={file.id} className="hover:bg-slate-50/30">
                    <td className="px-6 py-4">
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-slate-700 truncate">{file.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{file.size}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusChip status={file.status} />
                    </td>
                    <td className="px-6 py-4">
                      {file.emotionType && (
                        <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded border border-blue-100">
                          {file.emotionType} ({file.emotionLevel})
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[11px] text-slate-500 line-clamp-2">{file.reasoning || '--'}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => removeFile(file.id)} className="text-slate-300 hover:text-red-500">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const StatusChip: React.FC<{ status: EmotionStatus }> = ({ status }) => {
  const base = "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase border";
  switch (status) {
    case EmotionStatus.IDLE: return <span className={`${base} bg-slate-50 text-slate-400 border-slate-100`}>等待中</span>;
    case EmotionStatus.PROCESSING: return <span className={`${base} bg-blue-50 text-blue-600 border-blue-100 animate-pulse`}>分析中</span>;
    case EmotionStatus.COMPLETED: return <span className={`${base} bg-emerald-50 text-emerald-600 border-emerald-100`}>已完成</span>;
    case EmotionStatus.FAILED: return <span className={`${base} bg-rose-50 text-rose-600 border-rose-100`}>失败</span>;
    default: return null;
  }
};

export default App;
