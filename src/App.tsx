import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  BookOpen, 
  Upload, 
  Flame,
  ArrowLeft,
  Eye,
  Play
} from 'lucide-react';
import { dbManager } from './db/indexedDB';
import { Question, StoredBank, WrongBook, SessionConfig, SessionFilterMode, SessionSummary, BankStats, TrackMode, AnkiRating, DueCardSummary } from './types';
import { getAutoLoadedJsonBanks } from './data/jsonBankLoader';
import { BankCard } from './components/BankCard';
import { ConfigView } from './components/ConfigView';
import { PracticeView } from './components/PracticeView';
import { SummaryView } from './components/SummaryView';
import { BankBrowseView } from './components/BankBrowseView';
import { ImportModal } from './components/ImportModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { CognitiveDashboard } from './components/CognitiveDashboard';
import { dailyActivityFacade } from './services/dailyActivityFacade';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [bankNames, setBankNames] = useState<string[]>([]);
  const [bankStatsMap, setBankStatsMap] = useState<Record<string, BankStats>>({});
  const [bankDataMap, setBankDataMap] = useState<Record<string, Question[]>>({});
  const [wrongBooksMap, setWrongBooksMap] = useState<Record<string, WrongBook>>({});
  const [masteredBooksMap, setMasteredBooksMap] = useState<Record<string, number[]>>({});
  const [dueSummariesMap, setDueSummariesMap] = useState<Record<string, DueCardSummary>>({});
  const [dataVersion, setDataVersion] = useState(0);
  
  // 视图模式: 'home' | 'config' | 'practice' | 'summary' | 'browse'
  const [currentView, setCurrentView] = useState<'home' | 'config' | 'practice' | 'summary' | 'browse'>('home');
  const [selectedBankName, setSelectedBankName] = useState<string>('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importModalTab, setImportModalTab] = useState<'paste' | 'file' | 'presets' | 'prompt'>('paste');
  const [configValidationError, setConfigValidationError] = useState('');

  // 练习配置
  const [sessionConfig, setSessionConfig] = useState<SessionConfig>({
    filterMode: 'all',
    practiceMode: 'test',
    rangeStart: 1,
    rangeEnd: 100,
    mockConfig: { single: 10, multiple: 5, judge: 5 },
    isShuffled: false,
    useTimer: true,
    autoNextOnCorrect: true,
    autoNextDelay: 700
  });

  // 练习题目与总结
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  const [lastSummary, setLastSummary] = useState<SessionSummary | null>(null);

  // 本地存储永久持久化状态 (Persistent Storage)
  const [storageStatus, setStorageStatus] = useState<{
    persisted: boolean;
    usage?: number;
    quota?: number;
  }>({ persisted: false });

  // 刷新所有题库与统计数据
  const refreshAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 启动与每次刷新时，清理任何已删除题库残留的孤立闪卡排程记录
      await dbManager.cleanupOrphanAnkiCards();

      const names = await dbManager.getAllBankNames();
      setBankNames(names);

      const statsMap: Record<string, BankStats> = {};
      const dataMap: Record<string, Question[]> = {};
      const wbMap: Record<string, WrongBook> = {};
      const mbMap: Record<string, number[]> = {};

      for (const name of names) {
        const bank = await dbManager.getBank(name);
        if (bank) {
          dataMap[name] = bank.data;
          statsMap[name] = await dbManager.calculateStats(bank.data);
        }
        const wb = await dbManager.getWrongBook(name);
        wbMap[name] = wb || {};
        const mb = await dbManager.getMasteredBook(name);
        mbMap[name] = mb || [];
      }

      setBankStatsMap(statsMap);
      setBankDataMap(dataMap);
      setWrongBooksMap(wbMap);
      setMasteredBooksMap(mbMap);

      const dueSummaries = await dailyActivityFacade.getAllBanksDueSummaries(names);
      setDueSummariesMap(dueSummaries);
      setDataVersion((v) => v + 1);
    } catch (e) {
      console.error('加载本地题库失败:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      // 启动并申请持久化存储
      dbManager.checkAndRequestPersistence().then(status => {
        setStorageStatus(status);
      });

      await dbManager.initDefaultsIfEmpty();
      await refreshAllData();
    };
    init();
  }, [refreshAllData]);

  // 处理选择题库
  const handleSelectBank = (
    name: string, 
    trackMode: TrackMode = 'all', 
    defaultPracticeMode: 'test' | 'study' = 'test'
  ) => {
    setSelectedBankName(name);
    const questions = bankDataMap[name] || [];
    const maxId = Math.max(...questions.map((q) => q.id), 1);
    const stats = bankStatsMap[name] || { total: 0, single: 0, multiple: 0, judge: 0 };
    const objCount = stats.single + stats.multiple + stats.judge;
    const fcCount = (stats.blank || 0) + (stats.definition || 0) + (stats.essay || 0);

    let effectiveTrack: TrackMode = trackMode;
    if (trackMode === 'all') {
      if (objCount > 0 && fcCount === 0) effectiveTrack = 'objective';
      else if (objCount === 0 && fcCount > 0) effectiveTrack = 'flashcard';
    }

    const dueSummary = dueSummariesMap[name];
    const defaultFilterMode: SessionFilterMode = 
      (effectiveTrack === 'flashcard' && (dueSummary?.flashcardDueCount || 0) > 0)
        ? 'due'
        : 'all';
    
    setSessionConfig((prev) => ({
      ...prev,
      trackMode: effectiveTrack,
      filterMode: defaultFilterMode,
      wrongReviewMode: (dueSummary?.objectiveDueCount || 0) > 0 ? 'due' : 'all',
      practiceMode: defaultPracticeMode,
      rangeStart: 1,
      rangeEnd: maxId,
      mockConfig: {
        single: Math.min(10, stats.single || 0),
        multiple: Math.min(5, stats.multiple || 0),
        judge: Math.min(5, stats.judge || 0)
      }
    }));
    setConfigValidationError('');
    setCurrentView('config');
  };

  // 保存/导入新题库
  const handleImportSuccess = async (name: string, questions: Question[]) => {
    await dbManager.saveBank(name, questions);
    await refreshAllData();
    // 自动定位到该题库并打开配置
    handleSelectBank(name);
  };

  // 删除题库
  const handleDeleteBank = async (name: string) => {
    await dbManager.deleteBank(name);
    if (selectedBankName === name) {
      setSelectedBankName('');
      setCurrentView('home');
    }
    await refreshAllData();
  };

  // 重命名题库
  const handleRenameBank = async (oldName: string, newName: string) => {
    await dbManager.renameBank(oldName, newName);
    if (selectedBankName === oldName) {
      setSelectedBankName(newName);
    }
    await refreshAllData();
  };

  // 更新错题本
  const handleSaveWrongBook = async (updatedWb: WrongBook) => {
    if (!selectedBankName) return;
    setWrongBooksMap((prev) => ({ ...prev, [selectedBankName]: updatedWb }));
    await dbManager.saveWrongBook(selectedBankName, updatedWb);
  };

  // 切换题目已掌握/未练习状态
  const handleToggleMastered = async (questionId: number, isMastered: boolean) => {
    if (!selectedBankName) return;
    const currentMb = masteredBooksMap[selectedBankName] || [];
    const currentWb = wrongBooksMap[selectedBankName] || {};
    
    let nextMb: number[];
    if (isMastered) {
      nextMb = Array.from(new Set([...currentMb, questionId]));
      // 如果原本在错题本中，同时移出错题本
      if (currentWb[questionId]) {
        const nextWb = { ...currentWb };
        delete nextWb[questionId];
        setWrongBooksMap((prev) => ({ ...prev, [selectedBankName]: nextWb }));
        await dbManager.saveWrongBook(selectedBankName, nextWb);
      }
    } else {
      nextMb = currentMb.filter((id) => id !== questionId);
    }

    setMasteredBooksMap((prev) => ({ ...prev, [selectedBankName]: nextMb }));
    await dbManager.saveMasteredBook(selectedBankName, nextMb);
  };

  // 从错题本移除单题并恢复为未训练/未练习状态（作为误触补救）
  const handleRemoveFromWrongBook = async (questionId: number) => {
    if (!selectedBankName) return;
    const currentWb = wrongBooksMap[selectedBankName] || {};
    const nextWb = { ...currentWb };
    delete nextWb[questionId];
    setWrongBooksMap((prev) => ({ ...prev, [selectedBankName]: nextWb }));
    await dbManager.saveWrongBook(selectedBankName, nextWb);

    // 确保也不在已掌握中，彻底回到未训练/未练习状态
    const currentMb = masteredBooksMap[selectedBankName] || [];
    if (currentMb.includes(questionId)) {
      const nextMb = currentMb.filter((id) => id !== questionId);
      setMasteredBooksMap((prev) => ({ ...prev, [selectedBankName]: nextMb }));
      await dbManager.saveMasteredBook(selectedBankName, nextMb);
    }
  };

  // 从题库中彻底删除单题
  const handleDeleteSingleQuestion = async (questionId: number) => {
    if (!selectedBankName) return;
    const currentQuestions = bankDataMap[selectedBankName] || [];
    const updatedQuestions = currentQuestions.filter((q) => q.id !== questionId);
    
    // 如果该题在错题本或已掌握中，也一并清理
    const currentWb = wrongBooksMap[selectedBankName] || {};
    if (currentWb[questionId]) {
      const nextWb = { ...currentWb };
      delete nextWb[questionId];
      setWrongBooksMap((prev) => ({ ...prev, [selectedBankName]: nextWb }));
      await dbManager.saveWrongBook(selectedBankName, nextWb);
    }

    const currentMb = masteredBooksMap[selectedBankName] || [];
    if (currentMb.includes(questionId)) {
      const nextMb = currentMb.filter((id) => id !== questionId);
      setMasteredBooksMap((prev) => ({ ...prev, [selectedBankName]: nextMb }));
      await dbManager.saveMasteredBook(selectedBankName, nextMb);
    }

    // 清理该题的 SM-2 闪卡记录
    await dbManager.deleteAnkiCard(`${selectedBankName}_${questionId}`);

    await dbManager.saveBank(selectedBankName, updatedQuestions);
    await refreshAllData();
  };

  // 开始练习会话
  const handleStartSession = () => {
    const allQuestions = bankDataMap[selectedBankName] || [];
    const wrongBook = wrongBooksMap[selectedBankName] || {};
    
    // 彻底解耦独立轨道：客观题（单选/多选/判断） vs 闪卡记忆（填空/名词解释/论述）
    let pool = [...allQuestions];
    if (sessionConfig.trackMode === 'objective') {
      pool = pool.filter(q => q.type === 'single' || q.type === 'multiple' || q.type === 'judge');
    } else if (sessionConfig.trackMode === 'flashcard') {
      pool = pool.filter(q => q.type === 'blank' || q.type === 'definition' || q.type === 'essay');
    }

    if (pool.length === 0) {
      setConfigValidationError('所选学习轨道下暂无题目。');
      return;
    }

    let chosen: Question[] = [];

    if (sessionConfig.filterMode === 'all') {
      chosen = [...pool];
    } else if (sessionConfig.filterMode === 'chapter') {
      const targetChapter = sessionConfig.selectedChapter;
      if (!targetChapter || targetChapter === 'all') {
        chosen = [...pool];
      } else {
        chosen = pool.filter((q) => (q.chapter || '未分类章节') === targetChapter);
      }
      if (chosen.length === 0) {
        setConfigValidationError('所选章节内没有找到题目。');
        return;
      }
    } else if (sessionConfig.filterMode === 'wrong') {
      const wrongIds = Object.keys(wrongBook).map(Number);
      chosen = pool.filter((q) => wrongIds.includes(q.id));
      if (chosen.length === 0) {
        setConfigValidationError('当前轨道错题本为空。');
        return;
      }
    } else if (sessionConfig.filterMode === 'range') {
      const start = Math.max(1, sessionConfig.rangeStart);
      const end = sessionConfig.rangeEnd;
      if (start > end) {
        setConfigValidationError('起始题号不能大于终止题号。');
        return;
      }
      chosen = pool.filter((q) => q.id >= start && q.id <= end);
      if (chosen.length === 0) {
        setConfigValidationError('所选范围内没有找到题目。');
        return;
      }
    } else if (sessionConfig.filterMode === 'mock') {
      const sList = pool.filter((q) => q.type === 'single').sort(() => Math.random() - 0.5);
      const mList = pool.filter((q) => q.type === 'multiple').sort(() => Math.random() - 0.5);
      const jList = pool.filter((q) => q.type === 'judge').sort(() => Math.random() - 0.5);

      chosen = [
        ...sList.slice(0, sessionConfig.mockConfig.single),
        ...mList.slice(0, sessionConfig.mockConfig.multiple),
        ...jList.slice(0, sessionConfig.mockConfig.judge)
      ];

      if (chosen.length === 0) {
        setConfigValidationError('抽题数量不能全部为0。');
        return;
      }
    } else if (sessionConfig.filterMode === 'due') {
      const summary = dueSummariesMap[selectedBankName];
      const dueIds = summary?.flashcardDueIds || summary?.dueQuestionIds || [];
      const questionMap = new Map(pool.map((q) => [q.id, q]));
      chosen = dueIds.map((id) => questionMap.get(id)).filter(Boolean) as Question[];

      // 如果今日暂无到期闪卡，智能推荐前 20 张或全库闪卡开始今日学习，绝不报错阻断用户！
      if (chosen.length === 0) {
        if (pool.length > 0) {
          chosen = pool.slice(0, 20);
        } else {
          setConfigValidationError('当前题库暂无可供背诵的闪卡。');
          return;
        }
      }
    }

    // 叠加标签过滤
    if (sessionConfig.selectedTag && sessionConfig.selectedTag !== 'all') {
      chosen = chosen.filter(q => Array.isArray(q.tags) && q.tags.includes(sessionConfig.selectedTag!));
      if (chosen.length === 0) {
        setConfigValidationError(`标签 #${sessionConfig.selectedTag} 下暂无匹配题目。`);
        return;
      }
    }

    // 叠加题型过滤
    if (sessionConfig.selectedType && sessionConfig.selectedType !== 'all') {
      chosen = chosen.filter(q => q.type === sessionConfig.selectedType);
      if (chosen.length === 0) {
        setConfigValidationError('所选题型下暂无匹配题目。');
        return;
      }
    }

    if (sessionConfig.isShuffled) {
      chosen.sort(() => Math.random() - 0.5);
    }

    setActiveQuestions(chosen);
    setCurrentView('practice');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 浏览题库完整列表
  const handleBrowseBank = (name: string) => {
    setSelectedBankName(name);
    setCurrentView('browse');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 启动艾宾浩斯智能到期复习（仅推送处于遗忘临界点的卡片，超期自适应排序）
  const handleStartDueReview = (bankName: string, dueQuestionIds: number[]) => {
    if (!dueQuestionIds || dueQuestionIds.length === 0) return;
    setSelectedBankName(bankName);
    const allQuestions = bankDataMap[bankName] || [];
    const questionMap = new Map(allQuestions.map((q) => [q.id, q]));
    const chosen: Question[] = [];
    for (const qId of dueQuestionIds) {
      const q = questionMap.get(qId);
      if (q) chosen.push(q);
    }
    if (chosen.length === 0) return;

    setSessionConfig((prev) => ({
      ...prev,
      trackMode: 'flashcard',
      practiceMode: 'test',
      filterMode: 'due'
    }));
    setActiveQuestions(chosen);
    setCurrentView('practice');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 定制化练习（攻克盲区、模糊题速记）
  const handleStartCustomPractice = (questionIds: number[], mode: 'test' | 'study') => {
    const allQuestions = bankDataMap[selectedBankName] || [];
    const chosen = allQuestions.filter(q => questionIds.includes(q.id));
    if (chosen.length === 0) return;
    
    setSessionConfig(prev => ({
      ...prev,
      practiceMode: mode
    }));
    setActiveQuestions(chosen);
    setCurrentView('practice');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 完成练习
  const handleFinishSession = async (results: {
    totalQuestions: number;
    correctCount: number;
    wrongCount: number;
    elapsedSeconds: number;
    wrongIds: number[];
    questionResults?: Record<number, 'correct' | 'wrong'>;
    questionRatings?: Record<number, AnkiRating>;
  }) => {
    const accuracyRate = results.totalQuestions > 0
      ? ((results.correctCount / results.totalQuestions) * 100).toFixed(1)
      : '0.0';

    // 同步掌握记录：答对且不在错题中的标记为已掌握
    if (selectedBankName && results.questionResults) {
      const currentMb = masteredBooksMap[selectedBankName] || [];
      const currentWb = wrongBooksMap[selectedBankName] || {};
      const newMbSet = new Set(currentMb);

      Object.entries(results.questionResults).forEach(([qIdStr, res]) => {
        const qId = Number(qIdStr);
        if (res === 'correct' && !currentWb[qId]) {
          newMbSet.add(qId);
        } else if (res === 'wrong') {
          newMbSet.delete(qId);
        }
      });

      const updatedMb = Array.from(newMbSet);
      setMasteredBooksMap((prev) => ({ ...prev, [selectedBankName]: updatedMb }));
      await dbManager.saveMasteredBook(selectedBankName, updatedMb);
    }

    // 模块三：门面模式同步写入每日做题与时长记录
    await dailyActivityFacade.recordActivity({
      questionsCount: results.totalQuestions,
      correctCount: results.correctCount,
      timeSpentSeconds: results.elapsedSeconds
    });

    setLastSummary({
      bankName: selectedBankName,
      totalQuestions: results.totalQuestions,
      correctCount: results.correctCount,
      wrongCount: results.wrongCount,
      accuracyRate,
      elapsedSeconds: results.elapsedSeconds,
      wrongQuestionIds: results.wrongIds,
      questionResults: results.questionResults,
      questionRatings: results.questionRatings,
      practiceMode: sessionConfig.practiceMode,
      trackMode: sessionConfig.trackMode
    });
    setCurrentView('summary');
    refreshAllData();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 错题单练
  const handleRetryWrongOnly = (wrongIds: number[]) => {
    const allQuestions = bankDataMap[selectedBankName] || [];
    const wrongQs = allQuestions.filter((q) => wrongIds.includes(q.id));
    setActiveQuestions(wrongQs);
    setCurrentView('practice');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 全量重练
  const handleRestartAll = () => {
    handleStartSession();
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f5f4] text-black/90 antialiased selection:bg-black selection:text-white">
      {/* 顶部全局导航栏 (固定60px，Notion-like 发丝边框与幽灵按钮) */}
      {currentView !== 'practice' && (
        <header className="h-[60px] border-b border-black/[0.08] bg-white/90 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-4xl w-full mx-auto px-4 h-full flex items-center justify-between gap-3">
            {currentView === 'browse' ? (
              <>
                {/* 全览模式下的顶部导航条：直接代替题库工作台 */}
                <div className="flex items-center space-x-2.5 min-w-0">
                  <button
                    onClick={() => setCurrentView('home')}
                    className="p-1.5 text-black/50 hover:text-black hover:bg-black/[0.04] rounded-lg transition-colors shrink-0 cursor-pointer"
                    title="返回题库列表"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="flex items-center space-x-2 min-w-0">
                    <h2 className="text-sm sm:text-base font-semibold text-black tracking-tight truncate max-w-[170px] sm:max-w-xs md:max-w-md">
                      {selectedBankName}
                    </h2>
                    <span className="text-xs bg-black/5 text-black/60 px-2 py-0.5 rounded-full font-medium shrink-0">
                      {bankDataMap[selectedBankName]?.length || 0} 题
                    </span>
                    {Object.keys(wrongBooksMap[selectedBankName] || {}).length > 0 && (
                      <span className="text-xs bg-rose-50 border border-rose-200/60 text-rose-700 px-2 py-0.5 rounded-full font-medium items-center space-x-1 shrink-0 hidden sm:inline-flex">
                        <Flame className="w-3 h-3 text-rose-500 fill-rose-500" />
                        <span>错题 {Object.keys(wrongBooksMap[selectedBankName] || {}).length}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => {
                      setSessionConfig((prev) => ({ ...prev, practiceMode: 'study', filterMode: 'all' }));
                      const questions = bankDataMap[selectedBankName] || [];
                      setActiveQuestions(questions);
                      setCurrentView('practice');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="bg-transparent hover:bg-black/[0.04] text-black/80 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 border border-black/[0.08] cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>速记</span>
                  </button>
                  <button
                    onClick={() => {
                      setSessionConfig((prev) => ({ ...prev, practiceMode: 'test', filterMode: 'all' }));
                      const questions = bankDataMap[selectedBankName] || [];
                      setActiveQuestions(questions);
                      setCurrentView('practice');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="bg-[#0f766e] hover:bg-[#0d665f] text-white text-xs font-bold px-3.5 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>刷题</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div 
                  className="flex items-center space-x-2.5 cursor-pointer group select-none"
                  onClick={() => setCurrentView('home')}
                >
                  <div className="bg-black text-white p-1.5 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105">
                    <BookOpen className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h1 className="text-sm sm:text-base font-semibold text-black tracking-tight leading-tight">
                      刷题小助手
                    </h1>
                    <p className="text-[11px] text-black/50 leading-tight">
                      自建题库 · 刷题 · 速记
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-xs">
                  <PWAInstallButton storagePersisted={storageStatus.persisted} />

                  <button
                    onClick={() => setIsImportModalOpen(true)}
                    className="bg-transparent hover:bg-black/[0.04] active:bg-black/[0.08] text-black/80 border border-black/[0.08] px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>导入</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </header>
      )}

      {/* 主体工作区 */}
      <main className={`flex-1 flex flex-col max-w-4xl w-full mx-auto ${currentView === 'practice' ? 'px-3 sm:px-4 py-2 sm:py-4' : 'px-4 py-5'}`}>
        {isLoading ? (
          <div className="my-auto flex flex-col items-center justify-center space-y-3 py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black/80"></div>
            <p className="text-xs text-black/40">正在加载本地题库...</p>
          </div>
        ) : currentView === 'home' ? (
          /* 题库列表首页 */
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* 模块三：学习热力图与认知看板（数据沉淀与激励） */}
            <CognitiveDashboard refreshTrigger={dataVersion} />

            {/* 顶层状态横幅 */}
            <div className="flex items-center justify-between py-1">
              <div>
                <h2 className="text-base font-semibold text-black/90 flex items-center gap-2">
                  <span>我的题库</span>
                  <span className="bg-black/5 text-black/60 text-xs px-2.5 py-0.5 rounded-full font-medium">
                    {bankNames.length}
                  </span>
                </h2>
                <div className="flex items-center space-x-2 text-xs text-black/50 mt-0.5">
                  <span>本地 IndexedDB 存储</span>
                </div>
              </div>
            </div>

            {/* 题库卡片网格 */}
            {bankNames.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {bankNames.map((name) => (
                  <BankCard
                    key={name}
                    name={name}
                    stats={bankStatsMap[name] || { total: 0, single: 0, multiple: 0, judge: 0 }}
                    wrongCount={Object.keys(wrongBooksMap[name] || {}).length}
                    questions={bankDataMap[name] || []}
                    wrongBook={wrongBooksMap[name] || {}}
                    dueSummary={dueSummariesMap[name]}
                    onSelect={(n, track, mode) => handleSelectBank(n, track, mode)}
                    onBrowse={(n) => handleBrowseBank(n)}
                    onDelete={handleDeleteBank}
                    onRename={handleRenameBank}
                  />
                ))}
              </div>
            ) : (
              /* 空状态：未加载题库 */
              <div className="bg-white border border-black/[0.08] rounded-xl p-10 md:p-14 text-center flex flex-col items-center justify-center">
                <div className="w-10 h-10 bg-black/[0.04] rounded-full flex items-center justify-center mb-3 text-black/40">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-black/90 mb-1">未加载题库</h3>
                <p className="text-xs text-black/50 max-w-sm mx-auto">
                  当前尚未加载任何题库，请点击右上角「导入」开始学习。
                </p>
              </div>
            )}
          </div>
        ) : currentView === 'browse' ? (
          /* 题库完整下滑全览界面 */
          <BankBrowseView
            bankName={selectedBankName}
            questions={bankDataMap[selectedBankName] || []}
            wrongBook={wrongBooksMap[selectedBankName] || {}}
            masteredIds={masteredBooksMap[selectedBankName] || []}
            stats={bankStatsMap[selectedBankName] || { total: 0, single: 0, multiple: 0, judge: 0 }}
            onBack={() => setCurrentView('home')}
            onStartPractice={(mode) => {
              setSessionConfig((prev) => ({ ...prev, practiceMode: mode, filterMode: 'all' }));
              const questions = bankDataMap[selectedBankName] || [];
              setActiveQuestions(questions);
              setCurrentView('practice');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onRemoveFromWrongBook={handleRemoveFromWrongBook}
            onToggleMastered={handleToggleMastered}
            onDeleteQuestion={handleDeleteSingleQuestion}
          />
        ) : currentView === 'config' ? (
          /* 练习配置界面 */
          <ConfigView
            bankName={selectedBankName}
            questions={bankDataMap[selectedBankName] || []}
            wrongBook={wrongBooksMap[selectedBankName] || {}}
            stats={bankStatsMap[selectedBankName] || { total: 0, single: 0, multiple: 0, judge: 0 }}
            config={sessionConfig}
            dueSummary={dueSummariesMap[selectedBankName]}
            onChangeConfig={(patch) => setSessionConfig((prev) => ({ ...prev, ...patch }))}
            onStart={handleStartSession}
            onBrowse={() => handleBrowseBank(selectedBankName)}
            onBack={() => setCurrentView('home')}
            validationError={configValidationError}
          />
        ) : currentView === 'practice' ? (
          /* 核心刷题与速记界面 */
          <PracticeView
            bankName={selectedBankName}
            questions={activeQuestions}
            practiceMode={sessionConfig.practiceMode}
            trackMode={sessionConfig.trackMode}
            autoNextOnCorrect={sessionConfig.autoNextOnCorrect}
            autoNextDelay={sessionConfig.autoNextDelay}
            useTimer={sessionConfig.useTimer}
            wrongBook={wrongBooksMap[selectedBankName] || {}}
            onFinishSession={handleFinishSession}
            onQuit={() => setCurrentView('config')}
            onSaveWrongBook={handleSaveWrongBook}
            onTogglePracticeMode={() =>
              setSessionConfig((prev) => ({
                ...prev,
                practiceMode: prev.practiceMode === 'study' ? 'test' : 'study'
              }))
            }
          />
        ) : currentView === 'summary' && lastSummary ? (
          /* 总结报告界面 */
          <SummaryView
            summary={lastSummary}
            questions={bankDataMap[selectedBankName] || []}
            wrongBook={wrongBooksMap[selectedBankName] || {}}
            onRetryWrongOnly={handleRetryWrongOnly}
            onStartCustomPractice={handleStartCustomPractice}
            onRestartAll={handleRestartAll}
            onBackHome={() => {
              setCurrentView('home');
              refreshAllData();
            }}
            onBrowseBank={() => handleBrowseBank(selectedBankName)}
          />
        ) : null}
      </main>

      {/* 导入模态弹窗 */}
      <ImportModal
        isOpen={isImportModalOpen}
        initialTab={importModalTab}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
      />

      {/* 离线状态提示徽章 */}
      <OfflineIndicator />
    </div>
  );
}
