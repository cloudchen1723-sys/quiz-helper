import React, { useState, useRef } from 'react';
import { 
  X, 
  Trash2, 
  RefreshCw, 
  Download, 
  Upload, 
  AlertTriangle, 
  Check, 
  Database,
  Calendar,
  BookOpen,
  RotateCcw,
  Sparkles,
  FileCode
} from 'lucide-react';
import { dbManager } from '../db/indexedDB';

interface DataManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => Promise<void> | void;
  storagePersisted?: boolean;
}

type ConfirmActionType = 'clearLogs' | 'clearProgress' | 'clearBanks' | 'clearAll' | null;

export const DataManagementModal: React.FC<DataManagementModalProps> = ({
  isOpen,
  onClose,
  onDataChanged
}) => {
  const [confirmAction, setConfirmAction] = useState<ConfirmActionType>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ type, text });
    setTimeout(() => {
      setFeedbackMsg(null);
    }, 3000);
  };

  const handleExecuteAction = async () => {
    if (!confirmAction) return;
    setIsProcessing(true);
    try {
      if (confirmAction === 'clearLogs') {
        await dbManager.clearDailyLogs();
        await onDataChanged();
        showFeedback('打卡记录与热力图已清空');
      } else if (confirmAction === 'clearProgress') {
        await dbManager.clearAllProgress();
        await onDataChanged();
        showFeedback('做题进度与错题已重置');
      } else if (confirmAction === 'clearBanks') {
        await dbManager.clearAllBanks();
        await onDataChanged();
        showFeedback('所有题库已清空');
      } else if (confirmAction === 'clearAll') {
        await dbManager.clearAllData();
        await onDataChanged();
        showFeedback('已恢复全新初始状态');
      }
      setConfirmAction(null);
    } catch (err: any) {
      showFeedback(`操作失败: ${err?.message || '未知错误'}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // 重新导入示例题库
  const handleRestorePreset = async () => {
    setIsProcessing(true);
    try {
      const restoredName = await dbManager.restorePresetBank();
      if (restoredName) {
        await onDataChanged();
        showFeedback(`已载入示例题库: ${restoredName}`);
      } else {
        showFeedback('未找到可载入的示例题库', 'error');
      }
    } catch (err: any) {
      showFeedback(`载入失败: ${err?.message || ''}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // 导出全部数据为 JSON
  const handleExportData = async () => {
    try {
      const backup = await dbManager.exportAllData();
      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `刷题小助手_完整备份_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showFeedback('备份文件已下载');
    } catch (err: any) {
      showFeedback(`导出失败: ${err?.message || ''}`, 'error');
    }
  };

  // 导入备份 JSON
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await dbManager.importBackupData(data);
      await onDataChanged();
      showFeedback('数据恢复成功！已还原全部记录');
    } catch (err: any) {
      showFeedback(`导入失败: ${err?.message || '格式不兼容'}`, 'error');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 载入内置测试做题记录备份
  const handleLoadSampleBackup = async () => {
    setIsProcessing(true);
    try {
      const resp = await fetch('/sample-activity-backup.json');
      if (!resp.ok) {
        throw new Error('未找到测试备份文件');
      }
      const data = await resp.json();
      await dbManager.importBackupData(data);
      await onDataChanged();
      showFeedback('测试记录恢复成功！已载入题库与15天打卡');
    } catch (err: any) {
      showFeedback(`载入测试备份失败: ${err?.message || ''}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmLabels = {
    clearLogs: {
      title: '确认清空打卡足迹？',
      desc: '连续打卡天数与热力图将归零，保留题库和错题记录。',
      btn: '确认清空打卡'
    },
    clearProgress: {
      title: '确认重置刷题进度？',
      desc: '将清空错题本与已掌握状态，题目保留，可重新刷题。',
      btn: '确认重置进度'
    },
    clearBanks: {
      title: '确认清空全部题库？',
      desc: '将删除本地所有题库及对应记录，此操作不可逆。',
      btn: '确认清空题库'
    },
    clearAll: {
      title: '确认恢复出厂设置？',
      desc: '彻底抹除本地所有题库、打卡、错题与设置，恢复空白状态。',
      btn: '彻底清空重置'
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) onClose();
      }}
    >
      <div className="things-card w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[18px] bg-white p-6 shadow-2xl border border-[#dfe3e8] relative my-auto">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[#dfe3e8]/70">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#303336] flex items-center justify-center text-white">
              <Database className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-[#303336] leading-tight">数据管理</h3>
              <p className="text-[12px] text-[#838b96]">本地存储 · 备份恢复 · 数据清理</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1 rounded-lg text-[#838b96] hover:text-[#303336] hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 提示条 */}
        {feedbackMsg && (
          <div className={`mt-3 p-2.5 rounded-xl text-xs flex items-center space-x-2 border transition-all ${
            feedbackMsg.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
            {feedbackMsg.type === 'success' ? (
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{feedbackMsg.text}</span>
          </div>
        )}

        {/* 确认提示框 */}
        {confirmAction && (
          <div className="mt-3 p-3.5 rounded-xl border border-rose-200 bg-rose-50/90 text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-1.5 font-bold text-rose-900 mb-1">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{confirmLabels[confirmAction].title}</span>
            </div>
            <p className="text-[11px] text-rose-700 mb-3 leading-relaxed">
              {confirmLabels[confirmAction].desc}
            </p>
            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={isProcessing}
                className="px-2.5 py-1 text-xs rounded-lg text-stone-600 bg-white border border-stone-200 hover:bg-stone-50 font-medium cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleExecuteAction}
                disabled={isProcessing}
                className="px-3 py-1 text-xs rounded-lg text-white bg-rose-600 hover:bg-rose-700 font-medium flex items-center space-x-1 cursor-pointer"
              >
                {isProcessing && <RefreshCw className="w-3 h-3 animate-spin" />}
                <span>{confirmLabels[confirmAction].btn}</span>
              </button>
            </div>
          </div>
        )}

        {/* 数据清理与重置 */}
        <div className="mt-4">
          <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">
            数据清理与重置
          </div>

          <div className="space-y-1.5">
            {/* 清空打卡 */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 border border-stone-200/60 hover:border-stone-300 transition-colors">
              <div className="flex items-center space-x-2.5">
                <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-stone-800">清空打卡与热力图</div>
                  <div className="text-[11px] text-stone-400">Streak归零，保留题库与做题进度</div>
                </div>
              </div>
              <button
                onClick={() => setConfirmAction('clearLogs')}
                disabled={isProcessing}
                className="px-2.5 py-1 text-xs font-medium text-amber-700 bg-amber-100/70 hover:bg-amber-100 rounded-lg shrink-0 transition-colors cursor-pointer"
              >
                清空打卡
              </button>
            </div>

            {/* 重置进度 */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 border border-stone-200/60 hover:border-stone-300 transition-colors">
              <div className="flex items-center space-x-2.5">
                <RotateCcw className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-stone-800">重置做题进度</div>
                  <div className="text-[11px] text-stone-400">清空错题本与掌握状态，保留题库</div>
                </div>
              </div>
              <button
                onClick={() => setConfirmAction('clearProgress')}
                disabled={isProcessing}
                className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-100/70 hover:bg-blue-100 rounded-lg shrink-0 transition-colors cursor-pointer"
              >
                重置进度
              </button>
            </div>

            {/* 清空题库 */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 border border-stone-200/60 hover:border-stone-300 transition-colors">
              <div className="flex items-center space-x-2.5">
                <BookOpen className="w-4 h-4 text-stone-600 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-stone-800">清空全部题库</div>
                  <div className="text-[11px] text-stone-400">删除本地全部已导入题库与题目</div>
                </div>
              </div>
              <button
                onClick={() => setConfirmAction('clearBanks')}
                disabled={isProcessing}
                className="px-2.5 py-1 text-xs font-medium text-stone-700 bg-stone-200/80 hover:bg-stone-200 rounded-lg shrink-0 transition-colors cursor-pointer"
              >
                清空题库
              </button>
            </div>

            {/* 出厂重置 */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/50 border border-rose-200/60 hover:border-rose-300 transition-colors">
              <div className="flex items-center space-x-2.5">
                <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-rose-900">恢复出厂设置</div>
                  <div className="text-[11px] text-rose-600/80">抹除全部本地数据，恢复全新空白</div>
                </div>
              </div>
              <button
                onClick={() => setConfirmAction('clearAll')}
                disabled={isProcessing}
                className="px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-100 hover:bg-rose-200 rounded-lg shrink-0 transition-colors cursor-pointer"
              >
                出厂重置
              </button>
            </div>
          </div>
        </div>

        {/* 备份与恢复 */}
        <div className="mt-4 pt-3 border-t border-stone-100">
          <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">
            备份与迁移
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs mb-2.5">
            <button
              type="button"
              onClick={handleExportData}
              disabled={isProcessing}
              className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 font-medium text-stone-800 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-stone-600" />
              <span>导出备份 (JSON)</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 font-medium text-stone-800 transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-stone-600" />
              <span>导入备份文件</span>
            </button>
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".json"
              className="hidden" 
              onChange={handleFileChange}
            />
          </div>

          {/* 快捷测试与模板 */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-stone-50 border border-stone-200/60 text-[11px]">
            <span className="text-stone-500 flex items-center space-x-1">
              <FileCode className="w-3 h-3 text-stone-400" />
              <span>测试与示例</span>
            </span>
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={handleRestorePreset}
                disabled={isProcessing}
                className="text-stone-700 hover:text-black hover:bg-stone-200/60 px-2 py-0.5 rounded transition-colors flex items-center space-x-1 cursor-pointer"
                title="载入内置的生化示例题库"
              >
                <Sparkles className="w-3 h-3 text-amber-600" />
                <span>内置生化题库</span>
              </button>
              <span className="text-stone-300">|</span>
              <button
                type="button"
                onClick={handleLoadSampleBackup}
                disabled={isProcessing}
                className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100/60 px-2 py-0.5 rounded transition-colors flex items-center space-x-1 font-medium cursor-pointer"
                title="载入含15天打卡与错题的测试记录"
              >
                <span>载入测试记录</span>
              </button>
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <button
          onClick={onClose}
          className="w-full mt-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 active:scale-98 text-white text-xs font-semibold transition-all cursor-pointer"
        >
          完成
        </button>
      </div>
    </div>
  );
};

