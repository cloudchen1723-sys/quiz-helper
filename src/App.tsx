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
import { Question, StoredBank, WrongBook, SessionConfig, SessionSummary, BankStats } from './types';
import { getAutoLoadedJsonBanks } from './data/jsonBankLoader';
import { BankCard } from './components/BankCard';
import { ConfigView } from './components/ConfigView';
import { PracticeView } from './components/PracticeView';
import { SummaryView } from './components/SummaryView';
import { BankBrowseView } from './components/BankBrowseView';
import { ImportModal } from './components/ImportModal';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [bankNames, setBankNames] = useState<string[]>([]);
  const [bankStatsMap, setBankStatsMap] = useState<Record<string, BankStats>>({});
  const [bankDataMap, setBankDataMap] = useState<Record<string, Question[]>>({});
  const [wrongBooksMap, setWrongBooksMap] = useState<Record<string, WrongBook>>({});
  const [masteredBooksMap, setMasteredBooksMap] = useState<Record<string, number[]>>({});
  
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

  // 初始化加载 IndexedDB
  const refreshAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      await dbManager.initDefaultsIfEmpty();
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
    } catch (e) {
      console.error('加载本地题库失败:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  // 处理选择题库
  const handleSelectBank = (name: string, defaultPracticeMode: 'test' | 'study' = 'test') => {
    setSelectedBankName(name);
    const questions = bankDataMap[name] || [];
    const maxId = Math.max(...questions.map((q) => q.id), 1);
    
    setSessionConfig((prev) => ({
      ...prev,
      practiceMode: defaultPracticeMode,
      rangeStart: 1,
      rangeEnd: maxId,
      mockConfig: {
        single: Math.min(10, bankStatsMap[name]?.single || 0),
        multiple: Math.min(5, bankStatsMap[name]?.multiple || 0),
        judge: Math.min(5, bankStatsMap[name]?.judge || 0)
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

    await dbManager.saveBank(selectedBankName, updatedQuestions);
    await refreshAllData();
  };

  // 开始练习会话
  const handleStartSession = () => {
    const allQuestions = bankDataMap[selectedBankName] || [];
    const wrongBook = wrongBooksMap[selectedBankName] || {};
    let chosen: Question[] = [];

    if (sessionConfig.filterMode === 'all') {
      chosen = [...allQuestions];
    } else if (sessionConfig.filterMode === 'wrong') {
      const wrongIds = Object.keys(wrongBook).map(Number);
      chosen = allQuestions.filter((q) => wrongIds.includes(q.id));
      if (chosen.length === 0) {
        setConfigValidationError('当前错题本为空，请先在其他模式下做题。');
        return;
      }
    } else if (sessionConfig.filterMode === 'range') {
      const start = Math.max(1, sessionConfig.rangeStart);
      const end = sessionConfig.rangeEnd;
      if (start > end) {
        setConfigValidationError('起始题号不能大于终止题号。');
        return;
      }
      chosen = allQuestions.filter((q) => q.id >= start && q.id <= end);
      if (chosen.length === 0) {
        setConfigValidationError('所选范围内没有找到题目。');
        return;
      }
    } else if (sessionConfig.filterMode === 'mock') {
      const sList = allQuestions.filter((q) => q.type === 'single').sort(() => Math.random() - 0.5);
      const mList = allQuestions.filter((q) => q.type === 'multiple').sort(() => Math.random() - 0.5);
      const jList = allQuestions.filter((q) => q.type === 'judge').sort(() => Math.random() - 0.5);

      chosen = [
        ...sList.slice(0, sessionConfig.mockConfig.single),
        ...mList.slice(0, sessionConfig.mockConfig.multiple),
        ...jList.slice(0, sessionConfig.mockConfig.judge)
      ];

      if (chosen.length === 0) {
        setConfigValidationError('抽题数量不能全部为0。');
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

    setLastSummary({
      bankName: selectedBankName,
      totalQuestions: results.totalQuestions,
      correctCount: results.correctCount,
      wrongCount: results.wrongCount,
      accuracyRate,
      elapsedSeconds: results.elapsedSeconds,
      wrongQuestionIds: results.wrongIds,
      questionResults: results.questionResults,
      practiceMode: sessionConfig.practiceMode
    });
    setCurrentView('summary');
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

  const totalWrongCount = Object.values(wrongBooksMap).reduce((acc, wb) => acc + Object.keys(wb).length, 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#faf9f6] text-stone-800 antialiased selection:bg-stone-900 selection:text-white">
      {/* 顶部全局导航栏 (练习模式中精简展示) */}
      {currentView !== 'practice' && (
        <header className="border-b border-stone-200 bg-white/80 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-4xl w-full mx-auto px-4 py-3 flex items-center justify-between gap-3">
            {currentView === 'browse' ? (
              <>
                {/* 全览模式下的顶部导航条：直接代替题库工作台 */}
                <div className="flex items-center space-x-2.5 min-w-0">
                  <button
                    onClick={() => setCurrentView('home')}
                    className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors shrink-0"
                    title="返回题库列表"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="flex items-center space-x-2 min-w-0">
                    <h2 className="text-base font-bold text-stone-900 tracking-tight truncate max-w-[170px] sm:max-w-xs md:max-w-md">
                      {selectedBankName}
                    </h2>
                    <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-md font-medium shrink-0">
                      共 {bankDataMap[selectedBankName]?.length || 0} 题
                    </span>
                    {Object.keys(wrongBooksMap[selectedBankName] || {}).length > 0 && (
                      <span className="text-xs bg-rose-50 border border-rose-100 text-rose-600 px-2 py-0.5 rounded-md font-medium items-center space-x-1 shrink-0 hidden sm:inline-flex">
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
                    className="bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1.5 border border-stone-200 active:scale-95"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">速记背题</span>
                    <span className="sm:hidden">背题</span>
                  </button>
                  <button
                    onClick={() => {
                      setSessionConfig((prev) => ({ ...prev, practiceMode: 'test', filterMode: 'all' }));
                      const questions = bankDataMap[selectedBankName] || [];
                      setActiveQuestions(questions);
                      setCurrentView('practice');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold px-3.5 py-1.5 rounded-xl transition-all flex items-center space-x-1.5 shadow-xs active:scale-95"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span className="hidden sm:inline">开始刷题</span>
                    <span className="sm:hidden">刷题</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div 
                  className="flex items-center space-x-2.5 cursor-pointer group"
                  onClick={() => setCurrentView('home')}
                >
                  <div className="bg-stone-900 text-white p-2 rounded-xl shadow-xs group-hover:scale-105 transition-transform">
                    <BookOpen className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <h1 className="text-base font-bold text-stone-900 tracking-tight">
                      刷题小助手
                    </h1>
                    <p className="text-[11px] text-stone-400">
                      极简自建题库 · 刷题与速记
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2.5 text-xs">
                  {totalWrongCount > 0 && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-600 px-2.5 py-1.5 rounded-xl flex items-center space-x-1.5 font-medium">
                      <Flame className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                      <span>错题: <strong className="font-bold">{totalWrongCount}</strong></span>
                    </div>
                  )}

                  <button
                    onClick={() => setIsImportModalOpen(true)}
                    className="bg-stone-900 hover:bg-stone-800 text-white px-3.5 py-1.5 rounded-xl font-medium flex items-center space-x-1.5 transition-all active:scale-95 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>导入题库</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </header>
      )}

      {/* 主体工作区 */}
      <main className={`flex-1 flex flex-col max-w-4xl w-full mx-auto ${currentView === 'practice' ? 'px-2 sm:px-4 py-1.5 sm:py-4' : 'px-4 py-6'}`}>
        {isLoading ? (
          <div className="my-auto flex flex-col items-center justify-center space-y-3 py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-900"></div>
            <p className="text-xs text-stone-400">正在加载本地题库...</p>
          </div>
        ) : currentView === 'home' ? (
          /* 题库列表首页 */
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* 顶层状态横幅 */}
            <div className="flex items-center justify-between py-1">
              <div>
                <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                  <span>我的题库</span>
                  <span className="bg-stone-100 text-stone-600 text-xs px-2 py-0.5 rounded-full font-medium">
                    {bankNames.length}
                  </span>
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  数据保存在本地浏览器
                </p>
              </div>
            </div>

            {/* 题库卡片网格 */}
            {bankNames.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bankNames.map((name) => (
                  <BankCard
                    key={name}
                    name={name}
                    stats={bankStatsMap[name] || { total: 0, single: 0, multiple: 0, judge: 0 }}
                    wrongCount={Object.keys(wrongBooksMap[name] || {}).length}
                    questions={bankDataMap[name] || []}
                    wrongBook={wrongBooksMap[name] || {}}
                    onSelect={(n, mode) => handleSelectBank(n, mode)}
                    onBrowse={(n) => handleBrowseBank(n)}
                    onDelete={handleDeleteBank}
                    onRename={handleRenameBank}
                  />
                ))}
              </div>
            ) : (
              /* 空状态：未加载题库 */
              <div className="space-y-6">
                <div className="bg-white border border-stone-200/80 rounded-2xl p-10 text-center flex flex-col items-center justify-center shadow-xs">
                  <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mb-3 text-stone-400">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-stone-800 mb-1">未加载题库</h3>
                  <p className="text-xs text-stone-400 max-w-sm mx-auto mb-6">
                    当前尚未加载任何题库。您可以直接导入自定义文本/JSON，也可以选择载入内置题库。
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={() => {
                        setImportModalTab('paste');
                        setIsImportModalOpen(true);
                      }}
                      className="bg-stone-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-stone-800 shadow-xs transition-all flex items-center space-x-1.5 active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>导入题库 (文本/JSON)</span>
                    </button>
                    <button
                      onClick={() => {
                        setImportModalTab('presets');
                        setIsImportModalOpen(true);
                      }}
                      className="bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold px-4 py-2.5 rounded-xl border border-stone-200 transition-all flex items-center space-x-1.5 active:scale-95"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>选择导入内置题库</span>
                    </button>
                  </div>
                </div>

                {/* 快捷内置题库预览与一键载入列表 */}
                <div className="bg-white border border-stone-200/80 rounded-2xl p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center space-x-2">
                      <BookOpen className="w-4 h-4 text-stone-700" />
                      <h4 className="text-sm font-bold text-stone-800">可载入的内置题库</h4>
                    </div>
                    <span className="text-[11px] text-stone-400">点击「载入」即可开始练习</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {getAutoLoadedJsonBanks().map((b) => (
                      <div 
                        key={b.name}
                        className="border border-stone-200 rounded-xl p-3.5 hover:border-stone-300 transition-all flex flex-col justify-between bg-stone-50/40"
                      >
                        <div>
                          <h5 className="text-xs font-bold text-stone-800 mb-1">{b.name}</h5>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {b.tags.map((t, idx) => (
                              <span key={idx} className="text-[10px] bg-stone-200/70 text-stone-600 px-1.5 py-0.5 rounded font-medium">
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => handleImportSuccess(b.name, b.questions)}
                          className="w-full mt-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium py-1.5 rounded-lg shadow-xs transition-all active:scale-95"
                        >
                          一键载入
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
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
            onBackHome={() => setCurrentView('home')}
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
    </div>
  );
}
