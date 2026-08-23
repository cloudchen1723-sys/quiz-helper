import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  Flame, 
  Clock, 
  BookOpen, 
  Eye, 
  EyeOff, 
  Keyboard, 
  Check
} from 'lucide-react';
import { Question, QuestionResult, PracticeMode, WrongBook } from '../types';

interface PracticeViewProps {
  bankName: string;
  questions: Question[];
  practiceMode: PracticeMode;
  autoNextOnCorrect: boolean;
  autoNextDelay: number;
  useTimer: boolean;
  wrongBook: WrongBook;
  onFinishSession: (results: {
    totalQuestions: number;
    correctCount: number;
    wrongCount: number;
    elapsedSeconds: number;
    wrongIds: number[];
    questionResults?: Record<number, 'correct' | 'wrong'>;
  }) => void;
  onQuit: () => void;
  onSaveWrongBook: (updated: WrongBook) => Promise<void>;
  onTogglePracticeMode: () => void;
}

export const PracticeView: React.FC<PracticeViewProps> = ({
  bankName,
  questions,
  practiceMode,
  autoNextOnCorrect,
  autoNextDelay,
  useTimer,
  wrongBook,
  onFinishSession,
  onQuit,
  onSaveWrongBook,
  onTogglePracticeMode
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
  const [hasAnswered, setHasAnswered] = useState(false);
  const [sessionResults, setSessionResults] = useState<QuestionResult[]>(
    new Array(questions.length).fill('unanswered')
  );
  const [sessionWrongCount, setSessionWrongCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showKeyboardGuide, setShowKeyboardGuide] = useState(false);
  const [isKilledCurrent, setIsKilledCurrent] = useState(false);
  const [showAnalysisInStudy, setShowAnalysisInStudy] = useState(true);

  const autoNextTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;

  // 计时器
  useEffect(() => {
    if (!useTimer) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [useTimer]);

  const formattedTime = () => {
    const m = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
    const s = (elapsedSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const clearAnswerState = useCallback(() => {
    if (autoNextTimerRef.current) {
      clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
    }
    setSelectedOptions(new Set());
    setHasAnswered(false);
    setIsKilledCurrent(false);
  }, []);

  const handleNextQuestion = useCallback(() => {
    if (isLastQuestion) {
      const wrongIds: number[] = [];
      const questionResults: Record<number, 'correct' | 'wrong'> = {};
      sessionResults.forEach((status, idx) => {
        if (questions[idx]) {
          const qId = questions[idx].id;
          if (status === 'wrong') {
            wrongIds.push(qId);
            questionResults[qId] = 'wrong';
          } else if (status === 'correct') {
            questionResults[qId] = 'correct';
          }
        }
      });
      const correctCount = sessionResults.filter(s => s === 'correct').length;
      onFinishSession({
        totalQuestions: questions.length,
        correctCount,
        wrongCount: sessionWrongCount,
        elapsedSeconds,
        wrongIds,
        questionResults
      });
    } else {
      setCurrentIndex((prev) => prev + 1);
      clearAnswerState();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [isLastQuestion, sessionResults, questions, sessionWrongCount, elapsedSeconds, onFinishSession, clearAnswerState]);

  const checkAnswer = useCallback(async (selectedSet: Set<string>) => {
    if (!currentQuestion) return;
    const selected = Array.from(selectedSet).sort().join('');
    const correct = selected === currentQuestion.answer;

    const newResults = [...sessionResults];
    if (correct) {
      newResults[currentIndex] = 'correct';
      setSessionResults(newResults);

      // 错题消灭机制 (Streak / Kill)
      if (wrongBook[currentQuestion.id]) {
        const updatedWb = { ...wrongBook };
        updatedWb[currentQuestion.id].streakCorrect = (updatedWb[currentQuestion.id].streakCorrect || 0) + 1;
        // 如果连续答对 1 次以上，提示斩杀
        setIsKilledCurrent(true);
        if (updatedWb[currentQuestion.id].streakCorrect >= 2) {
          delete updatedWb[currentQuestion.id];
        }
        await onSaveWrongBook(updatedWb);
      }

      // 答对自动跳题
      if (autoNextOnCorrect && practiceMode === 'test') {
        autoNextTimerRef.current = setTimeout(() => {
          handleNextQuestion();
        }, autoNextDelay || 700);
      }
    } else {
      newResults[currentIndex] = 'wrong';
      setSessionResults(newResults);
      setSessionWrongCount((prev) => prev + 1);

      // 记录到错题本
      const updatedWb = { ...wrongBook };
      if (!updatedWb[currentQuestion.id]) {
        updatedWb[currentQuestion.id] = {
          id: currentQuestion.id,
          count: 1,
          lastWrongAt: Date.now(),
          streakCorrect: 0,
          type: currentQuestion.type
        };
      } else {
        updatedWb[currentQuestion.id].count += 1;
        updatedWb[currentQuestion.id].streakCorrect = 0;
        updatedWb[currentQuestion.id].lastWrongAt = Date.now();
      }
      await onSaveWrongBook(updatedWb);
    }
  }, [currentQuestion, sessionResults, currentIndex, wrongBook, autoNextOnCorrect, practiceMode, autoNextDelay, handleNextQuestion, onSaveWrongBook]);

  const selectOption = useCallback((key: string) => {
    if (!currentQuestion) return;
    if (practiceMode === 'study') return; // 背题模式直接展示，无需点击选择

    if (hasAnswered && currentQuestion.type !== 'multiple') return;

    if (currentQuestion.type === 'single' || currentQuestion.type === 'judge') {
      const nextSet = new Set([key]);
      setSelectedOptions(nextSet);
      setHasAnswered(true);
      checkAnswer(nextSet);
    } else if (currentQuestion.type === 'multiple') {
      if (hasAnswered) return;
      const nextSet = new Set(selectedOptions);
      if (nextSet.has(key)) nextSet.delete(key);
      else nextSet.add(key);
      setSelectedOptions(nextSet);
    }
  }, [currentQuestion, practiceMode, hasAnswered, selectedOptions, checkAnswer]);

  const confirmMultipleAnswer = useCallback(() => {
    if (selectedOptions.size === 0) return;
    setHasAnswered(true);
    checkAnswer(selectedOptions);
  }, [selectedOptions, checkAnswer]);

  // 手动从错题本斩杀该题
  const handleManualKillWrong = async () => {
    if (!currentQuestion || !wrongBook[currentQuestion.id]) return;
    const updatedWb = { ...wrongBook };
    delete updatedWb[currentQuestion.id];
    await onSaveWrongBook(updatedWb);
    setIsKilledCurrent(true);
  };

  // 全键盘快捷键驱动
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      const key = e.key.toUpperCase();
      // 选项快捷键 (A, B, C, D, 1, 2, 3, 4)
      const keyMap: Record<string, string> = {
        '1': 'A',
        '2': 'B',
        '3': 'C',
        '4': 'D',
        'A': 'A',
        'B': 'B',
        'C': 'C',
        'D': 'D',
      };

      if (keyMap[key] && currentQuestion && currentQuestion.options[keyMap[key]]) {
        e.preventDefault();
        selectOption(keyMap[key]);
      } else if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (currentQuestion?.type === 'multiple' && !hasAnswered && selectedOptions.size > 0) {
          confirmMultipleAnswer();
        } else if (hasAnswered || practiceMode === 'study') {
          handleNextQuestion();
        }
      } else if (key === 'M') {
        e.preventDefault();
        onTogglePracticeMode();
      } else if (key === 'E') {
        e.preventDefault();
        setShowAnalysisInStudy((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQuestion, hasAnswered, selectedOptions, practiceMode, selectOption, confirmMultipleAnswer, handleNextQuestion, onTogglePracticeMode]);

  if (!currentQuestion) return null;

  const typeBadge = () => {
    switch (currentQuestion.type) {
      case 'single':
        return <span className="bg-blue-100 text-blue-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold">单选题</span>;
      case 'multiple':
        return <span className="bg-purple-100 text-purple-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold">多选题</span>;
      case 'judge':
        return <span className="bg-amber-100 text-amber-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold">判断题</span>;
      default:
        return null;
    }
  };

  const answeredCount = sessionResults.filter((s) => s !== 'unanswered').length;
  const correctCount = sessionResults.filter((s) => s === 'correct').length;
  const currentAccuracy = answeredCount > 0 ? ((correctCount / answeredCount) * 100).toFixed(1) : '0.0';

  return (
    <div className="flex-1 flex flex-col justify-between max-w-3xl mx-auto w-full pb-20 pt-2 animate-in fade-in duration-150">
      <div>
        {/* Top Floating Dashboard Bar - 移动端高度精简优化，仅保留返回、题号进度、类型与时间 */}
        <div className="bg-white/90 backdrop-blur-md border border-stone-200 rounded-xl sm:rounded-2xl px-3 py-2 sm:p-3.5 shadow-xs mb-2.5 sm:mb-4 flex items-center justify-between gap-2">
          {/* 左侧：返回 + 题号进度 + 题型 */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            <button
              onClick={onQuit}
              className="text-stone-400 hover:text-stone-800 p-1 rounded-lg hover:bg-stone-100 transition-colors"
              title="返回配置页"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <span className="font-mono text-xs font-bold bg-stone-900 text-white px-2 py-0.5 rounded-md">
                {currentIndex + 1} / {questions.length}
              </span>
              <span className="text-xs text-stone-400 hidden md:inline">#题号{currentQuestion.id}</span>
              {typeBadge()}
            </div>
          </div>

          {/* 右侧：计时器 + 大屏统计数据/模式标签 */}
          <div className="flex items-center space-x-2 sm:space-x-3 text-xs">
            {useTimer && (
              <div className="flex items-center space-x-1 text-stone-600 font-mono bg-stone-100 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg">
                <Clock className="w-3.5 h-3.5 text-stone-400" />
                <span className="text-xs">{formattedTime()}</span>
              </div>
            )}

            {/* 桌面端才展示的大块正确率/错题统计，移动端自动隐藏避免遮挡 */}
            {practiceMode === 'test' ? (
              <div className="hidden sm:flex items-center space-x-3 bg-stone-50 px-3 py-1 rounded-xl border border-stone-200/60 font-medium">
                <span className="text-emerald-700 flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                  正确率: {currentAccuracy}%
                </span>
                <span className="text-rose-600 flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>
                  错题: {sessionWrongCount}
                </span>
              </div>
            ) : (
              <div className="hidden sm:flex items-center space-x-1.5 bg-amber-50 text-amber-800 px-2.5 py-1 rounded-xl font-medium border border-amber-200/50">
                <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                <span>速记背题模式中</span>
              </div>
            )}

            <button
              onClick={() => setShowKeyboardGuide(!showKeyboardGuide)}
              className="hidden sm:inline-flex text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100"
              title="查看键盘快捷键"
            >
              <Keyboard className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 快捷键浮层提示 */}
        {showKeyboardGuide && (
          <div className="bg-stone-900 text-stone-200 p-3 rounded-xl text-xs mb-4 shadow-lg border border-stone-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <span>⌨️ 快捷键盲打：</span>
              <span><kbd className="bg-stone-800 px-1.5 py-0.5 rounded text-amber-400 font-mono">1/2/3/4</kbd> 或 <kbd className="bg-stone-800 px-1.5 py-0.5 rounded text-amber-400 font-mono">A/B/C/D</kbd> 选选项</span>
              <span><kbd className="bg-stone-800 px-1.5 py-0.5 rounded text-amber-400 font-mono">Space/Enter</kbd> 确认/下一题</span>
              <span><kbd className="bg-stone-800 px-1.5 py-0.5 rounded text-amber-400 font-mono">M</kbd> 切换背题/做题</span>
            </div>
            <button onClick={() => setShowKeyboardGuide(false)} className="text-stone-400 hover:text-white text-[11px]">
              关闭提示
            </button>
          </div>
        )}

        {/* 分段迷你彩色进度条 */}
        <div className="w-full h-1.5 bg-stone-100 flex rounded-full mb-5 overflow-hidden gap-[1px]">
          {sessionResults.map((status, index) => (
            <div
              key={index}
              className={`h-full flex-1 transition-colors duration-200 ${
                status === 'correct'
                  ? 'bg-emerald-500'
                  : status === 'wrong'
                  ? 'bg-rose-500'
                  : index === currentIndex
                  ? 'bg-stone-600'
                  : 'bg-stone-200'
              }`}
            />
          ))}
        </div>

        {/* 主题目展示卡片 */}
        <div className="bg-white border border-stone-200/90 rounded-xl sm:rounded-2xl shadow-xs p-4 sm:p-6 md:p-8">
          {/* 题干文本 */}
          <div className="text-base md:text-lg font-semibold text-stone-900 leading-relaxed mb-4 sm:mb-6">
            {currentQuestion.question}
          </div>

          {/* 选项列表 */}
          <div className="space-y-3">
            {Object.entries(currentQuestion.options).map(([key, text]) => {
              const isCorrectOpt = currentQuestion.answer.includes(key);
              const isSelected = selectedOptions.has(key);

              let optionClass = 'border-stone-200 bg-white hover:border-stone-400 hover:bg-stone-50/60 text-stone-700 cursor-pointer';
              let badgeClass = 'border-stone-300 bg-stone-50 text-stone-600';

              if (practiceMode === 'study') {
                // 背题模式直接高亮正解
                if (isCorrectOpt) {
                  optionClass = 'border-emerald-500 bg-emerald-50/70 text-emerald-950 font-medium ring-1 ring-emerald-500';
                  badgeClass = 'border-emerald-500 bg-emerald-600 text-white';
                } else {
                  optionClass = 'border-stone-100 bg-white text-stone-400 opacity-60';
                  badgeClass = 'border-stone-200 bg-stone-50 text-stone-400';
                }
              } else if (hasAnswered) {
                // 已作答反馈
                if (isCorrectOpt && isSelected) {
                  optionClass = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-medium ring-1 ring-emerald-500';
                  badgeClass = 'border-emerald-500 bg-emerald-600 text-white';
                } else if (!isCorrectOpt && isSelected) {
                  optionClass = 'border-rose-500 bg-rose-50 text-rose-900 font-medium ring-1 ring-rose-500';
                  badgeClass = 'border-rose-500 bg-rose-600 text-white';
                } else if (isCorrectOpt && !isSelected) {
                  optionClass = 'border-emerald-300 bg-emerald-50/40 text-emerald-900';
                  badgeClass = 'border-emerald-400 bg-emerald-100 text-emerald-700';
                } else {
                  optionClass = 'border-stone-100 bg-white opacity-50';
                  badgeClass = 'border-stone-200 bg-stone-50 text-stone-400';
                }
              } else if (isSelected && currentQuestion.type === 'multiple') {
                // 多选选中暂存态
                optionClass = 'border-purple-500 bg-purple-50/70 ring-1 ring-purple-500 text-purple-950 font-medium cursor-pointer';
                badgeClass = 'border-purple-600 bg-purple-600 text-white';
              }

              return (
                <button
                  key={key}
                  onClick={() => selectOption(key)}
                  disabled={practiceMode === 'study' || (hasAnswered && currentQuestion.type !== 'multiple')}
                  className={`w-full text-left p-3.5 md:p-4 rounded-xl border text-sm md:text-base transition-all flex items-center justify-between group active:scale-[0.99] ${optionClass}`}
                >
                  <div className="flex items-center pr-3">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs border mr-3 transition-colors shrink-0 ${badgeClass}`}>
                      {!hasAnswered && isSelected && currentQuestion.type === 'multiple' ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        key
                      )}
                    </span>
                    <span className="leading-snug">{text}</span>
                  </div>

                  <div className="shrink-0 pl-2">
                    {practiceMode === 'study' && isCorrectOpt && (
                      <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center">
                        <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                        正确选项
                      </span>
                    )}
                    {hasAnswered && isCorrectOpt && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    )}
                    {hasAnswered && !isCorrectOpt && isSelected && (
                      <XCircle className="w-5 h-5 text-rose-500" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 多选题确认按钮 */}
          {currentQuestion.type === 'multiple' && !hasAnswered && practiceMode === 'test' && (
            <div className="mt-5">
              <button
                onClick={confirmMultipleAnswer}
                disabled={selectedOptions.size === 0}
                className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all shadow-xs flex items-center justify-center space-x-2 ${
                  selectedOptions.size > 0
                    ? 'bg-purple-600 hover:bg-purple-700 text-white active:scale-[0.98]'
                    : 'bg-stone-100 text-stone-400 cursor-not-allowed'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>确认作答（已选 {selectedOptions.size} 项）</span>
              </button>
            </div>
          )}

          {/* 深度解析面板 (背题模式始终展示，测验模式作答后展示) */}
          {(hasAnswered || practiceMode === 'study') && (
            <div className="mt-6 border-t border-dashed border-stone-200 pt-5 bg-stone-50/70 -mx-5 md:-mx-8 px-5 md:px-8 -mb-5 md:-mb-8 rounded-b-2xl">
              <div className="flex items-start space-x-3">
                <span className="bg-stone-900 text-white text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md mt-0.5 shrink-0">
                  核心解析
                </span>
                <div className="flex-1">
                  <p className="text-xs md:text-sm text-stone-700 leading-relaxed font-sans">
                    {currentQuestion.analysis || '牢记该考点标准定义，在不同题型中举一反三。'}
                  </p>
                  
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                    <span className="text-stone-500">
                      正确答案：<strong className="font-bold text-emerald-600 text-sm ml-1">{currentQuestion.answer}</strong>
                    </span>
                    {hasAnswered && practiceMode === 'test' && (
                      <span className="text-stone-500">
                        你的回答：
                        <strong className={`font-bold ml-1 ${
                          Array.from(selectedOptions).sort().join('') === currentQuestion.answer
                            ? 'text-emerald-600'
                            : 'text-rose-500'
                        }`}>
                          {Array.from(selectedOptions).sort().join('') || '未作答'}
                        </strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 错题本状态与斩杀按钮 */}
              {wrongBook[currentQuestion.id] && (
                <div className="mt-4 pt-3 border-t border-stone-200/60 flex items-center justify-between text-xs pb-3">
                  <div className="flex items-center text-amber-700 font-medium">
                    <Flame className="w-3.5 h-3.5 mr-1 text-rose-500 fill-rose-500" />
                    <span>该题已入错题本，累计答错 <strong>{wrongBook[currentQuestion.id].count}</strong> 次</span>
                  </div>
                  <button
                    onClick={handleManualKillWrong}
                    disabled={isKilledCurrent}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                      isKilledCurrent
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold'
                        : 'bg-white text-stone-600 hover:text-stone-900 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {isKilledCurrent ? '✨ 已斩杀此错题！' : '我已完全掌握，移出错题本'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 底部悬浮固定操作条 */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-stone-50/90 backdrop-blur-md border-t border-stone-200 py-3.5 px-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button
            onClick={onQuit}
            className="text-xs md:text-sm text-stone-500 hover:text-stone-800 font-medium flex items-center transition-colors px-2 py-1.5 rounded-lg hover:bg-stone-200/50"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            结束练习
          </button>

          <div className="flex items-center space-x-3">
            <button
              onClick={onTogglePracticeMode}
              className="text-xs text-stone-600 hover:text-stone-900 border border-stone-300 hover:bg-white px-3 py-2 rounded-xl transition-all hidden sm:flex items-center space-x-1.5"
            >
              {practiceMode === 'study' ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>切换为{practiceMode === 'study' ? '做题模式' : '速记背题'}</span>
            </button>

            {(hasAnswered || practiceMode === 'study') && (
              <button
                onClick={handleNextQuestion}
                className="bg-stone-900 text-white text-xs md:text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-stone-800 active:scale-95 transition-all flex items-center shadow-xs"
              >
                <span>{isLastQuestion ? '查看练习总结' : '下一题'}</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
