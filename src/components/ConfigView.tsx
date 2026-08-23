import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Play, 
  Layers, 
  Flame, 
  Shuffle, 
  Clock, 
  Zap, 
  BookOpen, 
  GraduationCap,
  ChevronDown,
  ChevronUp,
  Settings2
} from 'lucide-react';
import { SessionConfig, Question, WrongBook, BankStats } from '../types';

interface ConfigViewProps {
  bankName: string;
  questions: Question[];
  wrongBook: WrongBook;
  stats: BankStats;
  config: SessionConfig;
  onChangeConfig: (newConfig: Partial<SessionConfig>) => void;
  onStart: () => void;
  onBrowse?: () => void;
  onBack: () => void;
  validationError?: string;
}

export const ConfigView: React.FC<ConfigViewProps> = ({
  bankName,
  questions,
  wrongBook,
  stats,
  config,
  onChangeConfig,
  onStart,
  onBrowse,
  onBack,
  validationError
}) => {
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const maxQuestionId = Math.max(...questions.map((q) => q.id), 1);
  const wrongCount = Object.keys(wrongBook).length;

  return (
    <div className="bg-white border border-stone-200 rounded-2xl shadow-xs p-5 md:p-8 max-w-3xl mx-auto w-full my-auto animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5 pb-3.5 border-b border-stone-100">
        <div className="flex items-center space-x-2.5">
          <button
            onClick={onBack}
            className="text-stone-400 hover:text-stone-800 p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
            title="返回"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg md:text-xl font-bold text-stone-900">{bankName}</h2>
        </div>
        
        <div className="text-xs text-stone-500 bg-stone-100 px-3 py-1.5 rounded-xl font-medium shrink-0">
          共 <strong className="text-stone-800 font-bold">{questions.length}</strong> 题
        </div>
      </div>

      {/* 题型分布统计 */}
      <div className="grid grid-cols-3 gap-2.5 mb-6">
        <div className="bg-blue-50/70 border border-blue-100/80 rounded-xl p-3 text-center">
          <div className="text-xl md:text-2xl font-bold text-blue-600">{stats.single}</div>
          <div className="text-xs text-blue-500 mt-0.5 font-medium">单选题</div>
        </div>
        <div className="bg-purple-50/70 border border-purple-100/80 rounded-xl p-3 text-center">
          <div className="text-xl md:text-2xl font-bold text-purple-600">{stats.multiple}</div>
          <div className="text-xs text-purple-500 mt-0.5 font-medium">多选题</div>
        </div>
        <div className="bg-amber-50/70 border border-amber-100/80 rounded-xl p-3 text-center">
          <div className="text-xl md:text-2xl font-bold text-amber-600">{stats.judge}</div>
          <div className="text-xs text-amber-500 mt-0.5 font-medium">判断题</div>
        </div>
      </div>

      {/* 认知学习模式 (测验做题 vs 背题速记) */}
      <div className="mb-5">
        <label className="block text-xs font-semibold text-stone-700 mb-2">学习模式</label>
        <div className="grid grid-cols-2 gap-2.5">
          <label
            className={`p-3 border rounded-xl cursor-pointer flex items-center space-x-2.5 transition-all ${
              config.practiceMode === 'test'
                ? 'border-stone-900 bg-stone-50/70 ring-1 ring-stone-900 font-semibold text-stone-900'
                : 'border-stone-200 hover:border-stone-300 text-stone-700'
            }`}
          >
            <input
              type="radio"
              name="practiceMode"
              checked={config.practiceMode === 'test'}
              onChange={() => onChangeConfig({ practiceMode: 'test' })}
              className="text-stone-900 focus:ring-stone-900"
            />
            <span className="text-xs sm:text-sm flex items-center">
              <GraduationCap className="w-4 h-4 mr-1.5 text-stone-700 shrink-0" />
              常规做题自测
            </span>
          </label>

          <label
            className={`p-3 border rounded-xl cursor-pointer flex items-center space-x-2.5 transition-all ${
              config.practiceMode === 'study'
                ? 'border-stone-900 bg-stone-50/70 ring-1 ring-stone-900 font-semibold text-stone-900'
                : 'border-stone-200 hover:border-stone-300 text-stone-700'
            }`}
          >
            <input
              type="radio"
              name="practiceMode"
              checked={config.practiceMode === 'study'}
              onChange={() => onChangeConfig({ practiceMode: 'study' })}
              className="text-stone-900 focus:ring-stone-900"
            />
            <span className="text-xs sm:text-sm flex items-center">
              <BookOpen className="w-4 h-4 mr-1.5 text-amber-600 shrink-0" />
              速记背题模式
            </span>
          </label>
        </div>
      </div>

      {/* 刷题范围选择 */}
      <div className="space-y-2 mb-5">
        <label className="block text-xs font-semibold text-stone-700 mb-1.5">出题范围</label>
        
        {/* 全部题目 */}
        <label
          className={`flex items-center p-2.5 sm:p-3 border rounded-xl cursor-pointer transition-all ${
            config.filterMode === 'all'
              ? 'border-stone-900 bg-stone-50/60 ring-1 ring-stone-900'
              : 'border-stone-200 hover:bg-stone-50/50'
          }`}
        >
          <input
            type="radio"
            name="filterMode"
            checked={config.filterMode === 'all'}
            onChange={() => onChangeConfig({ filterMode: 'all' })}
            className="text-stone-900 focus:ring-stone-900"
          />
          <div className="ml-2.5 flex items-center justify-between w-full">
            <span className="font-medium text-stone-800 text-xs sm:text-sm">全量刷题</span>
            <span className="text-xs text-stone-400 font-mono">共 {questions.length} 题</span>
          </div>
        </label>

        {/* 仅错题本 */}
        <label
          className={`flex items-center p-2.5 sm:p-3 border rounded-xl cursor-pointer transition-all ${
            config.filterMode === 'wrong'
              ? 'border-stone-900 bg-stone-50/60 ring-1 ring-stone-900'
              : 'border-stone-200 hover:bg-stone-50/50'
          } ${wrongCount === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input
            type="radio"
            name="filterMode"
            disabled={wrongCount === 0}
            checked={config.filterMode === 'wrong'}
            onChange={() => onChangeConfig({ filterMode: 'wrong' })}
            className="text-stone-900 focus:ring-stone-900"
          />
          <div className="ml-2.5 flex items-center justify-between w-full">
            <span className="font-medium text-stone-800 text-xs sm:text-sm">专属错题攻克</span>
            {wrongCount > 0 ? (
              <span className="bg-rose-100 text-rose-600 text-[11px] px-2 py-0.5 rounded-full font-semibold">
                {wrongCount} 道待消灭
              </span>
            ) : (
              <span className="text-xs text-stone-400">暂无错题</span>
            )}
          </div>
        </label>

        {/* 自定义范围 */}
        <label
          className={`flex flex-col p-2.5 sm:p-3 border rounded-xl cursor-pointer transition-all ${
            config.filterMode === 'range'
              ? 'border-stone-900 bg-stone-50/60 ring-1 ring-stone-900'
              : 'border-stone-200 hover:bg-stone-50/50'
          }`}
        >
          <div className="flex items-center">
            <input
              type="radio"
              name="filterMode"
              checked={config.filterMode === 'range'}
              onChange={() => onChangeConfig({ filterMode: 'range' })}
              className="text-stone-900 focus:ring-stone-900"
            />
            <div className="ml-2.5 flex items-center justify-between w-full">
              <span className="font-medium text-stone-800 text-xs sm:text-sm">自定义题号范围</span>
              <span className="text-xs text-stone-400 font-mono">1 - {maxQuestionId}</span>
            </div>
          </div>
          {config.filterMode === 'range' && (
            <div className="flex items-center space-x-2 mt-2.5 ml-6" onClick={(e) => e.stopPropagation()}>
              <input
                type="number"
                min={1}
                max={maxQuestionId}
                value={config.rangeStart}
                onChange={(e) => onChangeConfig({ rangeStart: parseInt(e.target.value) || 1 })}
                className="w-20 px-2.5 py-1 text-xs border border-stone-300 rounded-lg text-center focus:outline-none focus:border-stone-900"
              />
              <span className="text-stone-400 text-xs">至</span>
              <input
                type="number"
                min={config.rangeStart}
                max={maxQuestionId}
                value={config.rangeEnd}
                onChange={(e) => onChangeConfig({ rangeEnd: parseInt(e.target.value) || maxQuestionId })}
                className="w-20 px-2.5 py-1 text-xs border border-stone-300 rounded-lg text-center focus:outline-none focus:border-stone-900"
              />
              <span className="text-xs text-stone-400">题</span>
            </div>
          )}
        </label>

        {/* 随机套卷模式 */}
        <label
          className={`flex flex-col p-2.5 sm:p-3 border rounded-xl cursor-pointer transition-all ${
            config.filterMode === 'mock'
              ? 'border-stone-900 bg-stone-50/60 ring-1 ring-stone-900'
              : 'border-stone-200 hover:bg-stone-50/50'
          }`}
        >
          <div className="flex items-center">
            <input
              type="radio"
              name="filterMode"
              checked={config.filterMode === 'mock'}
              onChange={() => onChangeConfig({ filterMode: 'mock' })}
              className="text-stone-900 focus:ring-stone-900"
            />
            <div className="ml-2.5 flex items-center justify-between w-full">
              <span className="font-medium text-stone-800 text-xs sm:text-sm">随机抽题组卷</span>
              <span className="text-xs text-stone-400">
                已选 {config.mockConfig.single + config.mockConfig.multiple + config.mockConfig.judge} 题
              </span>
            </div>
          </div>
          {config.filterMode === 'mock' && (
            <div className="flex flex-wrap items-center gap-3 mt-2.5 ml-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center space-x-1">
                <span className="text-xs text-stone-500">单选:</span>
                <input
                  type="number"
                  min={0}
                  max={stats.single}
                  value={config.mockConfig.single}
                  onChange={(e) => onChangeConfig({
                    mockConfig: { ...config.mockConfig, single: Math.max(0, parseInt(e.target.value) || 0) }
                  })}
                  className="w-14 px-2 py-1 text-xs border border-stone-300 rounded-lg text-center"
                />
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-xs text-stone-500">多选:</span>
                <input
                  type="number"
                  min={0}
                  max={stats.multiple}
                  value={config.mockConfig.multiple}
                  onChange={(e) => onChangeConfig({
                    mockConfig: { ...config.mockConfig, multiple: Math.max(0, parseInt(e.target.value) || 0) }
                  })}
                  className="w-14 px-2 py-1 text-xs border border-stone-300 rounded-lg text-center"
                />
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-xs text-stone-500">判断:</span>
                <input
                  type="number"
                  min={0}
                  max={stats.judge}
                  value={config.mockConfig.judge}
                  onChange={(e) => onChangeConfig({
                    mockConfig: { ...config.mockConfig, judge: Math.max(0, parseInt(e.target.value) || 0) }
                  })}
                  className="w-14 px-2 py-1 text-xs border border-stone-300 rounded-lg text-center"
                />
              </div>
            </div>
          )}
        </label>
      </div>

      {/* 提效辅助选项 (默认折叠，一行三个紧凑勾选框) */}
      <div className="mb-6 pt-3 border-t border-stone-100">
        <button
          type="button"
          onClick={() => setIsOptionsOpen(!isOptionsOpen)}
          className="w-full flex items-center justify-between text-xs text-stone-500 hover:text-stone-800 py-1.5 px-1 rounded-lg transition-colors font-medium"
        >
          <div className="flex items-center space-x-1.5">
            <Settings2 className="w-3.5 h-3.5 text-stone-400" />
            <span>辅助设置（乱序 / 计时 / 自动切题）</span>
            {/* 状态指示点 */}
            {(config.isShuffled || config.useTimer || config.autoNextOnCorrect) && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-stone-700 ml-1"></span>
            )}
          </div>
          <div className="flex items-center space-x-1 text-[11px] text-stone-400">
            <span>{isOptionsOpen ? '收起' : '展开'}</span>
            {isOptionsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </div>
        </button>

        {isOptionsOpen && (
          <div className="grid grid-cols-3 gap-2 mt-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
            <label className="flex items-center justify-center space-x-1.5 cursor-pointer bg-stone-50 hover:bg-stone-100/80 px-2 py-2 rounded-lg border border-stone-200 transition-colors">
              <input
                type="checkbox"
                checked={config.isShuffled}
                onChange={(e) => onChangeConfig({ isShuffled: e.target.checked })}
                className="w-3.5 h-3.5 rounded text-stone-900 focus:ring-stone-900"
              />
              <span className="text-xs font-medium text-stone-800 flex items-center whitespace-nowrap">
                <Shuffle className="w-3 h-3 mr-1 text-stone-500 shrink-0" />
                乱序抽题
              </span>
            </label>

            <label className="flex items-center justify-center space-x-1.5 cursor-pointer bg-stone-50 hover:bg-stone-100/80 px-2 py-2 rounded-lg border border-stone-200 transition-colors">
              <input
                type="checkbox"
                checked={config.useTimer}
                onChange={(e) => onChangeConfig({ useTimer: e.target.checked })}
                className="w-3.5 h-3.5 rounded text-stone-900 focus:ring-stone-900"
              />
              <span className="text-xs font-medium text-stone-800 flex items-center whitespace-nowrap">
                <Clock className="w-3 h-3 mr-1 text-stone-500 shrink-0" />
                计时器
              </span>
            </label>

            <label className="flex items-center justify-center space-x-1.5 cursor-pointer bg-stone-50 hover:bg-stone-100/80 px-2 py-2 rounded-lg border border-stone-200 transition-colors">
              <input
                type="checkbox"
                checked={config.autoNextOnCorrect}
                onChange={(e) => onChangeConfig({ autoNextOnCorrect: e.target.checked })}
                className="w-3.5 h-3.5 rounded text-stone-900 focus:ring-stone-900"
              />
              <span className="text-xs font-medium text-stone-800 flex items-center whitespace-nowrap">
                <Zap className="w-3 h-3 mr-1 text-amber-500 shrink-0" />
                答对自动跳题
              </span>
            </label>
          </div>
        )}
      </div>

      {/* 验证错误提示 */}
      {validationError && (
        <div className="mb-4 text-xs text-rose-600 bg-rose-50 border border-rose-100 p-2.5 rounded-xl">
          {validationError}
        </div>
      )}

      {/* 开始按钮 */}
      <button
        onClick={onStart}
        className="w-full bg-stone-900 hover:bg-stone-800 active:scale-[0.99] text-white font-semibold py-3 px-4 rounded-xl text-sm transition-all flex items-center justify-center space-x-2 shadow-xs"
      >
        <Play className="w-4 h-4 fill-current" />
        <span>进入 {config.practiceMode === 'study' ? '速记背题' : '刷题练习'}</span>
      </button>
    </div>
  );
};
