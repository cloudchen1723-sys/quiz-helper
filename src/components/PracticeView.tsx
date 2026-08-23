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
    <div className="flex-1 flex flex-col justify-between max-w-3xl mx-auto w-full pb-20 sm:pb-24 pt-1 sm:pt-2 animate-in fade-in duration-150">
      <div>
        {/* Top Floating Dashboard Bar - 顶部控制栏 */}
        <div className="bg-white/95 backdrop-blur-md border border-stone-200 rounded-xl sm:rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 shadow-2xs mb-2.5 sm:mb-3.5 flex items-center justify-between gap-2">
          {/* 左侧：返回 + 题号进度 + 题型 */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            <button
              onClick={onQuit}
              className="text-stone-400 hover:text-stone-800 p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
              title="返回配置页"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs sm:text-sm font-bold bg-stone-900 text-white px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg">
                {currentIndex + 1} / {questions.length}
              </span>
              <span className="text-xs text-stone-400 hidden md:inline">#题号{currentQuestion.id}</span>
              {typeBadge()}
            </div>
          </div>

          {/* 右侧：计时器 + 模式切换按钮 + 正确率 */}
          <div className="flex items-center space-x-2 sm:space-x-3 text-xs sm:text-sm">
            {useTimer && (
              <div className="flex items-center space-x-1.5 text-stone-600 font-mono bg-stone-100 px-2.5 py-1 rounded-lg">
                <Clock className="w-3.5 h-3.5 text-stone-400" />
                <span className="text-xs sm:text-sm font-medium">{formattedTime()}</span>
              </div>
            )}

            {/* 模式切换按钮（精简文案：背题模式 / 测验模式） */}
            <button
              id="btn-toggle-practice-mode"
              onClick={onTogglePracticeMode}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold border flex items-center space-x-1.5 transition-all active:scale-95 shadow-2xs ${
                practiceMode === 'study'
                  ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300'
              }`}
              title="点击切换模式 (快捷键 M)"
            >
              {practiceMode === 'study' ? (
                <>
                  <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                  <span>背题模式</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-stone-600" />
                  <span>测验模式</span>
                </>
              )}
            </button>

            {/* 桌面端展示大块正确率/错题统计 */}
            {practiceMode === 'test' && (
              <div className="hidden md:flex items-center space-x-3 bg-stone-50 px-2.5 py-1 rounded-lg border border-stone-200/60 font-medium text-xs">
                <span className="text-emerald-700 flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                  正确率: {currentAccuracy}%
                </span>
                <span className="text-rose-600 flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>
                  错题: {sessionWrongCount}
                </span>
              </div>
            )}

            <button
              onClick={() => setShowKeyboardGuide(!showKeyboardGuide)}
              className="hidden sm:inline-flex text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-100"
              title="查看键盘快捷键"
            >
              <Keyboard className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 快捷键浮层提示 */}
        {showKeyboardGuide && (
          <div className="bg-stone-900 text-stone-200 p-3 rounded-xl text-xs mb-3 shadow-lg border border-stone-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span>⌨️ 快捷键盲打：</span>
              <span><kbd className="bg-stone-800 px-1.5 py-0.5 rounded text-amber-400 font-mono">1/2/3/4</kbd> 或 <kbd className="bg-stone-800 px-1.5 py-0.5 rounded text-amber-400 font-mono">A/B/C/D</kbd> 选选项</span>
              <span><kbd className="bg-stone-800 px-1.5 py-0.5 rounded text-amber-400 font-mono">Space/Enter</kbd> 确认/下一题</span>
              <span><kbd className="bg-stone-800 px-1.5 py-0.5 rounded text-amber-400 font-mono">M</kbd> 切换背题/做题</span>
            </div>
            <button onClick={() => setShowKeyboardGuide(false)} className="text-stone-400 hover:text-white text-xs">
              关闭提示
            </button>
          </div>
        )}

        {/* 分段迷你彩色进度条 */}
        <div className="w-full h-1.5 sm:h-2 bg-stone-100 flex rounded-full mb-3 sm:mb-4 overflow-hidden gap-[1px]">
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

        {/* 主题目展示卡片 - 移动端适度加大字号与行距，保证手机阅读舒适清晰 */}
        <div className="bg-white border border-stone-200/90 rounded-2xl shadow-xs p-4 sm:p-6 md:p-7">
          {/* 题干文本 */}
          <div className="text-base sm:text-lg md:text-xl font-bold text-stone-900 leading-relaxed mb-3.5 sm:mb-5">
            {currentQuestion.question}
          </div>

          {/* 选项列表 */}
          <div className="space-y-2 sm:space-y-3">
            {Object.entries(currentQuestion.options).map(([key, text]) => {
              const isCorrectOpt = currentQuestion.answer.includes(key);
              const isSelected = selectedOptions.has(key);

              let optionClass = 'border-stone-200 bg-white hover:border-stone-400 hover:bg-stone-50/60 text-stone-800 cursor-pointer';
              let badgeClass = 'border-stone-300 bg-stone-50 text-stone-700';

              if (practiceMode === 'study') {
                // 背题模式直接高亮正解
                if (isCorrectOpt) {
                  optionClass = 'border-emerald-500 bg-emerald-50/80 text-emerald-950 font-medium ring-1.5 ring-emerald-500';
                  badgeClass = 'border-emerald-500 bg-emerald-600 text-white';
                } else {
                  optionClass = 'border-stone-100 bg-white text-stone-400 opacity-60';
                  badgeClass = 'border-stone-200 bg-stone-50 text-stone-400';
                }
              } else if (hasAnswered) {
                // 已作答反馈
                if (isCorrectOpt && isSelected) {
                  optionClass = 'border-emerald-500 bg-emerald-50 text-emerald-950 font-semibold ring-1.5 ring-emerald-500';
                  badgeClass = 'border-emerald-500 bg-emerald-600 text-white';
                } else if (!isCorrectOpt && isSelected) {
                  optionClass = 'border-rose-500 bg-rose-50 text-rose-950 font-medium ring-1.5 ring-rose-500';
                  badgeClass = 'border-rose-500 bg-rose-600 text-white';
                } else if (isCorrectOpt && !isSelected) {
                  optionClass = 'border-emerald-300 bg-emerald-50/50 text-emerald-900 font-medium';
                  badgeClass = 'border-emerald-400 bg-emerald-100 text-emerald-700';
                } else {
                  optionClass = 'border-stone-100 bg-white opacity-50';
                  badgeClass = 'border-stone-200 bg-stone-50 text-stone-400';
                }
              } else if (isSelected && currentQuestion.type === 'multiple') {
                // 多选选中暂存态
                optionClass = 'border-purple-500 bg-purple-50/80 ring-1.5 ring-purple-500 text-purple-950 font-semibold cursor-pointer';
                badgeClass = 'border-purple-600 bg-purple-600 text-white';
              }

              return (
                <button
                  key={key}
                  onClick={() => selectOption(key)}
                  disabled={practiceMode === 'study' || (hasAnswered && currentQuestion.type !== 'multiple')}
                  className={`w-full text-left p-3 sm:p-3.5 md:p-4 rounded-xl sm:rounded-2xl border text-sm sm:text-base transition-all flex items-center justify-between group active:scale-[0.99] ${optionClass}`}
                >
                  <div className="flex items-center pr-2 flex-1">
                    <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-xs sm:text-sm border mr-3 transition-colors shrink-0 ${badgeClass}`}>
                      {!hasAnswered && isSelected && currentQuestion.type === 'multiple' ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        key
                      )}
                    </span>
                    <span className="leading-snug flex-1">{text}</span>
                  </div>

                  <div className="shrink-0 pl-2">
                    {practiceMode === 'study' && isCorrectOpt && (
                      <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-md flex items-center">
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
            <div className="mt-3.5 sm:mt-5">
              <button
                onClick={confirmMultipleAnswer}
                disabled={selectedOptions.size === 0}
                className={`w-full py-3 px-4 rounded-xl font-bold text-sm sm:text-base transition-all shadow-xs flex items-center justify-center space-x-2 ${
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
            <div className="mt-4 sm:mt-5 border-t border-dashed border-stone-200 pt-3.5 sm:pt-4 bg-stone-50/90 -mx-4 sm:-mx-6 md:-mx-7 px-4 sm:px-6 md:px-7 -mb-4 sm:-mb-6 md:-mb-7 rounded-b-2xl">
              <div className="flex items-start space-x-3">
                <span className="bg-stone-900 text-white text-[11px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md mt-0.5 shrink-0">
                  解析
                </span>
                <div className="flex-1">
                  <p className="text-sm sm:text-base text-stone-700 leading-relaxed font-sans">
                    {currentQuestion.analysis || '牢记该考点标准定义，在不同题型中举一反三。'}
                  </p>
                  
                  <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs sm:text-sm">
                    <span className="text-stone-600">
                      正确答案：<strong className="font-bold text-emerald-600 text-sm sm:text-base ml-0.5">{currentQuestion.answer}</strong>
                    </span>
                    {hasAnswered && practiceMode === 'test' && (
                      <span className="text-stone-600">
                        你的回答：
                        <strong className={`font-bold ml-0.5 text-sm sm:text-base ${
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

              {/* 错题状态与移出错题按钮 */}
              {wrongBook[currentQuestion.id] && (
                <div className="mt-3 pt-2.5 border-t border-stone-200/70 flex items-center justify-between text-xs pb-1 sm:pb-2">
                  <div className="flex items-center space-x-1.5 text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg font-medium text-xs">
                    <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                    <span>累计 {wrongBook[currentQuestion.id].count} 次</span>
                    {wrongBook[currentQuestion.id].streakCorrect > 0 && (
                      <span className="text-emerald-600 font-mono ml-1 font-semibold">
                        (连对 {wrongBook[currentQuestion.id].streakCorrect} 次)
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleManualKillWrong}
                    disabled={isKilledCurrent}
                    className={`px-3 py-1 rounded-lg font-semibold text-xs flex items-center space-x-1 border transition-colors ${
                      isKilledCurrent
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-medium cursor-default'
                        : 'bg-stone-50 hover:bg-emerald-50 text-stone-600 hover:text-emerald-700 border-stone-200 hover:border-emerald-300'
                    }`}
                    title="移出错题本并恢复为未训练状态"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isKilledCurrent ? '已移出' : '移出错题'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 底部悬浮固定操作条 */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 sm:bg-stone-50/95 backdrop-blur-md border-t border-stone-200 py-2.5 sm:py-3 px-4 sm:px-6 shadow-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button
            id="btn-quit-practice"
            onClick={onQuit}
            className="text-xs sm:text-sm text-stone-500 hover:text-stone-800 font-semibold flex items-center transition-colors px-3 py-2 rounded-xl hover:bg-stone-100"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            结束练习
          </button>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {(hasAnswered || practiceMode === 'study') && (
              <button
                id="btn-next-question"
                onClick={handleNextQuestion}
                className="bg-stone-900 text-white text-sm sm:text-base font-bold px-5 sm:px-6 py-2 sm:py-2.5 rounded-xl hover:bg-stone-800 active:scale-95 transition-all flex items-center shadow-xs"
              >
                <span>{isLastQuestion ? '查看总结' : '下一题'}</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
