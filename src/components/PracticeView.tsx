import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  ChevronLeft,
  CheckCircle2, 
  XCircle, 
  Flame, 
  Clock, 
  BookOpen, 
  Eye, 
  Keyboard, 
  Check,
  Target,
  FileText,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { Question, QuestionResult, PracticeMode, WrongBook, AnkiRating, TrackMode } from '../types';
import { AnkiFlashcardView } from './AnkiFlashcardView';
import { dailyActivityFacade } from '../services/dailyActivityFacade';

interface PracticeViewProps {
  bankName: string;
  questions: Question[];
  practiceMode: PracticeMode;
  trackMode?: TrackMode;
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
    questionRatings?: Record<number, AnkiRating>;
  }) => void;
  onQuit: () => void;
  onSaveWrongBook: (updated: WrongBook) => Promise<void>;
  onTogglePracticeMode: () => void;
}

export const PracticeView: React.FC<PracticeViewProps> = ({
  bankName,
  questions,
  practiceMode,
  trackMode,
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
  const [showSubjectiveAnswer, setShowSubjectiveAnswer] = useState(false);
  const [sessionResults, setSessionResults] = useState<QuestionResult[]>(
    new Array(questions.length).fill('unanswered')
  );
  // 记录闪卡三色熟练度自评结果 ('again' | 'hard' | 'good' | 'easy')
  const [sessionRatings, setSessionRatings] = useState<Record<number, AnkiRating>>({});
  const [sessionWrongCount, setSessionWrongCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showKeyboardGuide, setShowKeyboardGuide] = useState(false);
  const [isKilledCurrent, setIsKilledCurrent] = useState(false);

  // 使用 ref 避免闭包陷阱
  const sessionResultsRef = useRef<QuestionResult[]>(
    new Array(questions.length).fill('unanswered')
  );
  const sessionRatingsRef = useRef<Record<number, AnkiRating>>({});
  const sessionWrongCountRef = useRef(0);
  const elapsedSecondsRef = useRef(0);

  const autoNextTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;

  const hasOptions = currentQuestion?.options && Object.keys(currentQuestion.options).length > 0;
  const isFlashcardMode =
    trackMode === 'flashcard' ||
    !hasOptions ||
    currentQuestion?.type === 'blank' ||
    currentQuestion?.type === 'definition' ||
    currentQuestion?.type === 'essay';

  // 保持计时器秒数引用同步
  useEffect(() => {
    elapsedSecondsRef.current = elapsedSeconds;
  }, [elapsedSeconds]);

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
    setShowSubjectiveAnswer(false);
    setIsKilledCurrent(false);
  }, []);

  // 提交完成本次刷题
  const finishSessionWithResults = useCallback((finalResults: QuestionResult[]) => {
    const wrongIds: number[] = [];
    const questionResults: Record<number, 'correct' | 'wrong'> = {};

    finalResults.forEach((status, idx) => {
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

    const questionRatings: Record<number, AnkiRating> = {};
    Object.entries(sessionRatingsRef.current).forEach(([idxStr, rating]) => {
      const idx = Number(idxStr);
      if (questions[idx]) {
        questionRatings[questions[idx].id] = rating;
      }
    });

    onFinishSession({
      totalQuestions: questions.length,
      correctCount: finalResults.filter((s) => s === 'correct').length,
      wrongCount: sessionWrongCountRef.current,
      elapsedSeconds: elapsedSecondsRef.current,
      wrongIds,
      questionResults,
      questionRatings
    });
  }, [questions, onFinishSession]);

  const handleNextQuestion = useCallback((overrideResults?: QuestionResult[]) => {
    if (autoNextTimerRef.current) {
      clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
    }
    const activeResults = (Array.isArray(overrideResults) && overrideResults) || sessionResultsRef.current;
    if (isLastQuestion) {
      finishSessionWithResults(activeResults);
    } else {
      setCurrentIndex((prev) => prev + 1);
      clearAnswerState();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [isLastQuestion, finishSessionWithResults, clearAnswerState]);

  // 返回上一题 (用于手滑点错修正，如熟练误点成生疏)
  const handlePrevQuestion = useCallback(() => {
    if (autoNextTimerRef.current) {
      clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
    }
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      clearAnswerState();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentIndex, clearAnswerState]);

  const checkAnswer = useCallback(async (selectedSet: Set<string>, overrideCorrect?: boolean) => {
    if (!currentQuestion) return;
    let correct = false;

    if (typeof overrideCorrect === 'boolean') {
      correct = overrideCorrect;
    } else {
      const selected = Array.from(selectedSet).sort().join('');
      correct = selected === currentQuestion.answer;
    }

    const prevResult = sessionResultsRef.current[currentIndex];
    const isCorrection = prevResult !== undefined;

    const newResults = [...sessionResultsRef.current];
    if (correct) {
      newResults[currentIndex] = 'correct';
      sessionResultsRef.current = newResults;
      setSessionResults(newResults);

      // 如果是返回上一题修改误判 (此前误判为 wrong，现在修正为 correct)
      if (isCorrection && prevResult === 'wrong') {
        sessionWrongCountRef.current = Math.max(0, sessionWrongCountRef.current - 1);
        setSessionWrongCount(sessionWrongCountRef.current);
        if (wrongBook[currentQuestion.id]) {
          const updatedWb = { ...wrongBook };
          if (updatedWb[currentQuestion.id].count <= 1) {
            delete updatedWb[currentQuestion.id];
          } else {
            updatedWb[currentQuestion.id].count -= 1;
          }
          await onSaveWrongBook(updatedWb);
        }
      }

      // 错题消灭机制 (仅在初次作答时结算)
      if (wrongBook[currentQuestion.id] && !isCorrection) {
        const updatedWb = { ...wrongBook };
        updatedWb[currentQuestion.id].streakCorrect = (updatedWb[currentQuestion.id].streakCorrect || 0) + 1;
        setIsKilledCurrent(true);
        if (updatedWb[currentQuestion.id].streakCorrect >= 2) {
          delete updatedWb[currentQuestion.id];
        }
        await onSaveWrongBook(updatedWb);
        // 仅闪卡认知模式记录 SM-2 艾宾浩斯良好复习，客观题仅在错题本中记录与消灭
        const isFlashcard = currentQuestion.type === 'blank' || currentQuestion.type === 'definition' || currentQuestion.type === 'essay';
        if (isFlashcard) {
          await dailyActivityFacade.recordCardReview(bankName, currentQuestion.id, 'good');
        }
      }

      // 答对自动跳题 (仅客观选择/判断题，闪卡模式由自评单独触发即时跳题)
      if (autoNextOnCorrect && practiceMode === 'test' && hasOptions) {
        autoNextTimerRef.current = setTimeout(() => {
          handleNextQuestion(newResults);
        }, autoNextDelay || 700);
      }
    } else {
      newResults[currentIndex] = 'wrong';
      sessionResultsRef.current = newResults;
      setSessionResults(newResults);

      // 如果此前不是 wrong，增加错题计数并入库
      if (!isCorrection || prevResult === 'correct') {
        sessionWrongCountRef.current += 1;
        setSessionWrongCount((prev) => prev + 1);

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
        // 仅闪卡模式纳入 SM-2 艾宾浩斯记忆排程 (again 触发巩固)
        const isFlashcard = currentQuestion.type === 'blank' || currentQuestion.type === 'definition' || currentQuestion.type === 'essay';
        if (isFlashcard) {
          await dailyActivityFacade.recordCardReview(bankName, currentQuestion.id, 'again');
        }
      }
    }
  }, [currentQuestion, currentIndex, wrongBook, autoNextOnCorrect, practiceMode, hasOptions, autoNextDelay, handleNextQuestion, onSaveWrongBook, bankName]);

  // 主观题自评打分处理：记录评价与三色熟练度后平滑自动跳转下一题
  const handleSubjectiveEvaluation = async (isCorrect: boolean, rating?: AnkiRating) => {
    setHasAnswered(true);
    setShowSubjectiveAnswer(true);

    if (rating) {
      const updatedRatings = {
        ...sessionRatingsRef.current,
        [currentIndex]: rating
      };
      sessionRatingsRef.current = updatedRatings;
      setSessionRatings(updatedRatings);
    }

    await checkAnswer(new Set(), isCorrect);

    // 闪卡模式点击选择生疏/模糊/熟练后自动跳转下一题
    if (autoNextTimerRef.current) {
      clearTimeout(autoNextTimerRef.current);
    }
    autoNextTimerRef.current = setTimeout(() => {
      handleNextQuestion();
    }, 280);
  };

  const selectOption = useCallback((key: string) => {
    if (!currentQuestion) return;
    if (practiceMode === 'study') return;

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

  // 手动从错题本移除该题
  const handleManualKillWrong = async () => {
    if (!currentQuestion || !wrongBook[currentQuestion.id]) return;
    const updatedWb = { ...wrongBook };
    delete updatedWb[currentQuestion.id];
    await onSaveWrongBook(updatedWb);
    setIsKilledCurrent(true);
  };

  // 键盘快捷键驱动
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      const key = e.key.toUpperCase();
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

      if (hasOptions && keyMap[key] && !hasAnswered && practiceMode === 'test') {
        selectOption(keyMap[key]);
      } else if (isFlashcardMode && !hasAnswered && (e.key === '1' || e.key === '2' || e.key === '3')) {
        e.preventDefault();
        if (e.key === '1') {
          dailyActivityFacade.recordCardReview(bankName, currentQuestion.id, 'again');
          handleSubjectiveEvaluation(false, 'again');
        } else if (e.key === '2') {
          dailyActivityFacade.recordCardReview(bankName, currentQuestion.id, 'hard');
          handleSubjectiveEvaluation(false, 'hard');
        } else if (e.key === '3') {
          dailyActivityFacade.recordCardReview(bankName, currentQuestion.id, 'good');
          handleSubjectiveEvaluation(true, 'good');
        }
      } else if (e.key === ' ' || e.key === 'Enter') {
        if (isFlashcardMode) {
          // 闪卡模式：由卡片独立接管翻转，1/2/3 负责评级即时跳题，不额外响应 Space/Enter 跳转下一题
          return;
        }
        e.preventDefault();
        if (!hasOptions) {
          if (!showSubjectiveAnswer && practiceMode === 'test' && !hasAnswered) {
            setShowSubjectiveAnswer(true);
          } else if (hasAnswered || practiceMode === 'study') {
            handleNextQuestion();
          }
        } else if (currentQuestion?.type === 'multiple' && !hasAnswered && practiceMode === 'test') {
          if (selectedOptions.size > 0) {
            confirmMultipleAnswer();
          }
        } else if (hasAnswered || practiceMode === 'study') {
          handleNextQuestion();
        }
      } else if (e.key.toLowerCase() === 'm') {
        if (!isFlashcardMode) {
          onTogglePracticeMode();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQuestion, bankName, hasOptions, isFlashcardMode, hasAnswered, showSubjectiveAnswer, selectedOptions, practiceMode, selectOption, confirmMultipleAnswer, handleNextQuestion, handleSubjectiveEvaluation, onTogglePracticeMode]);

  if (!currentQuestion) return null;

  const typeBadge = () => {
    switch (currentQuestion.type) {
      case 'single':
        return <span className="bg-blue-100 text-blue-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold">单选题</span>;
      case 'multiple':
        return <span className="bg-purple-100 text-purple-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold">多选题</span>;
      case 'judge':
        return <span className="bg-amber-100 text-amber-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold">判断题</span>;
      case 'definition':
        return <span className="bg-emerald-100 text-emerald-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold">名词解释</span>;
      case 'blank':
        return <span className="bg-teal-100 text-teal-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold">填空题</span>;
      case 'essay':
        return <span className="bg-rose-100 text-rose-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold">简答论述</span>;
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
        {/* 顶部状态与控制栏 */}
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
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              {currentIndex > 0 && (
                <button
                  onClick={handlePrevQuestion}
                  className="text-stone-400 hover:text-stone-800 p-1 rounded-md hover:bg-stone-100 transition-colors cursor-pointer"
                  title="上一题 (修改手滑或重温)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <span className="font-mono text-xs sm:text-sm font-bold bg-stone-900 text-white px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg">
                {currentIndex + 1} / {questions.length}
              </span>
              <span className="text-xs text-stone-400 hidden md:inline">#题号{currentQuestion.id}</span>
              {typeBadge()}
            </div>
          </div>

          {/* 右侧：计时器 + 模式切换按钮 + 正确率 (闪卡模式不展示背题切换与客观正确率) */}
          <div className="flex items-center space-x-2 sm:space-x-3 text-xs sm:text-sm">
            {useTimer && (
              <div className="flex items-center space-x-1.5 text-stone-600 font-mono bg-stone-100 px-2.5 py-1 rounded-lg">
                <Clock className="w-3.5 h-3.5 text-stone-400" />
                <span className="text-xs sm:text-sm font-medium">{formattedTime()}</span>
              </div>
            )}

            {!isFlashcardMode && (
              <>
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
                      <span>背题</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5 text-stone-600" />
                      <span>做题</span>
                    </>
                  )}
                </button>

                {practiceMode === 'test' && (
                  <div className="hidden md:flex items-center space-x-2.5 bg-stone-50 px-2.5 py-1 rounded-lg border border-stone-200/60 font-medium text-xs">
                    <span className="text-emerald-700 flex items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                      正确率 {currentAccuracy}%
                    </span>
                    <span className="text-rose-600 flex items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>
                      错题 {sessionWrongCount}
                    </span>
                  </div>
                )}
              </>
            )}

            <button
              onClick={() => setShowKeyboardGuide(!showKeyboardGuide)}
              className="hidden sm:inline-flex text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-100"
              title="查看快捷键"
            >
              <Keyboard className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 快捷键浮层提示 */}
        {showKeyboardGuide && (
          <div className="bg-stone-900 text-stone-200 p-3 rounded-xl text-xs mb-3 shadow-lg border border-stone-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span>⌨️ 快捷键：</span>
              {!isFlashcardMode ? (
                <>
                  <span><kbd className="bg-stone-800 px-1.5 py-0.5 rounded text-amber-400 font-mono">1/2/3/4</kbd> 或 <kbd className="bg-stone-800 px-1.5 py-0.5 rounded text-amber-400 font-mono">A/B/C/D</kbd> 选选项</span>
                  <span><kbd className="bg-stone-800 px-1.5 py-0.5 rounded text-amber-400 font-mono">Space/Enter</kbd> 翻看答案/下一题</span>
                  <span><kbd className="bg-stone-800 px-1.5 py-0.5 rounded text-amber-400 font-mono">M</kbd> 切换模式</span>
                </>
              ) : (
                <>
                  <span><kbd className="bg-stone-800 px-1.5 py-0.5 rounded text-amber-400 font-mono">Space</kbd> 翻看背面答案</span>
                  <span><kbd className="bg-stone-800 px-1.5 py-0.5 rounded text-amber-400 font-mono">1/2/3</kbd> 评定记忆掌握度</span>
                </>
              )}
            </div>
            <button onClick={() => setShowKeyboardGuide(false)} className="text-stone-400 hover:text-white text-xs cursor-pointer">
              关闭
            </button>
          </div>
        )}

        {/* 分段彩色进度条 (闪卡模式颜色严格对应三色熟练度：生疏-玫瑰红 / 模糊-琥珀黄 / 熟练-翡翠绿) */}
        <div className="w-full h-1.5 sm:h-2 bg-stone-100 flex rounded-full mb-3 sm:mb-4 overflow-hidden gap-[1px]">
          {sessionResults.map((status, index) => {
            const rating = sessionRatings[index];
            let barColor = 'bg-stone-200';

            if (rating) {
              if (rating === 'again') {
                barColor = 'bg-rose-500';
              } else if (rating === 'hard') {
                barColor = 'bg-amber-500';
              } else if (rating === 'good' || rating === 'easy') {
                barColor = 'bg-emerald-500';
              }
            } else if (status === 'correct') {
              barColor = 'bg-emerald-500';
            } else if (status === 'wrong') {
              barColor = 'bg-rose-500';
            } else if (index === currentIndex) {
              barColor = 'bg-stone-600';
            }

            return (
              <div
                key={index}
                className={`h-full flex-1 transition-colors duration-200 ${barColor}`}
                title={`第 ${index + 1} 题${
                  rating === 'again'
                    ? '：生疏'
                    : rating === 'hard'
                    ? '：模糊'
                    : rating === 'good' || rating === 'easy'
                    ? '：熟练'
                    : status === 'correct'
                    ? '：正确'
                    : status === 'wrong'
                    ? '：错误'
                    : index === currentIndex
                    ? '：当前题目'
                    : '：未作答'
                }`}
              />
            );
          })}
        </div>

        {/* 主题目展示卡片 */}
        <div className="bg-white border border-stone-200/90 rounded-2xl shadow-xs p-4 sm:p-6 md:p-7">
          {/* 章节与知识点考点胶囊展示 */}
          {(currentQuestion.chapter || (Array.isArray(currentQuestion.tags) && currentQuestion.tags.length > 0)) && (
            <div className="flex flex-wrap items-center gap-1.5 mb-3 text-xs">
              {currentQuestion.chapter && (
                <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-0.5 rounded-lg font-semibold">
                  {currentQuestion.chapter}
                </span>
              )}
              {Array.isArray(currentQuestion.tags) && currentQuestion.tags.map((t) => (
                <span key={t} className="bg-stone-100 text-stone-600 px-2 py-0.5 rounded-lg font-medium text-[11px]">
                  #{t}
                </span>
              ))}
            </div>
          )}

          {/* 题干文本 (仅客观选择/判断题在此渲染，闪卡模式由 AnkiFlashcardView 自主排版) */}
          {hasOptions && (
            <div className="text-base sm:text-lg md:text-xl font-bold text-stone-900 leading-relaxed mb-4">
              {currentQuestion.question}
            </div>
          )}

          {/* 情况一：客观选择题与判断题 */}
          {hasOptions && (
            <div className="space-y-2 sm:space-y-3">
              {Object.entries(currentQuestion.options!).map(([key, text]) => {
                const ansStr = typeof currentQuestion.answer === 'string' ? currentQuestion.answer : '';
                const isCorrectOpt = ansStr.includes(key);
                const isSelected = selectedOptions.has(key);

                let optionClass = 'border-stone-200 bg-white hover:border-stone-400 hover:bg-stone-50/60 text-stone-800 cursor-pointer';
                let badgeClass = 'border-stone-300 bg-stone-50 text-stone-700';

                if (practiceMode === 'study') {
                  if (isCorrectOpt) {
                    optionClass = 'border-emerald-500 bg-emerald-50/80 text-emerald-950 font-medium ring-1.5 ring-emerald-500';
                    badgeClass = 'border-emerald-500 bg-emerald-600 text-white';
                  } else {
                    optionClass = 'border-stone-100 bg-white text-stone-400 opacity-60';
                    badgeClass = 'border-stone-200 bg-stone-50 text-stone-400';
                  }
                } else if (hasAnswered) {
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
                  optionClass = 'border-purple-500 bg-purple-50/80 ring-1.5 ring-purple-500 text-purple-950 font-semibold cursor-pointer';
                  badgeClass = 'border-purple-500 bg-purple-600 text-white';
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
          )}

          {/* 多选题提交按钮 */}
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
                <span>确认提交 ({selectedOptions.size})</span>
              </button>
            </div>
          )}

          {/* 情况二：主观题（填空/名词解释/论述）的 Anki 记忆闪卡交互范式 */}
          {!hasOptions && (
            <AnkiFlashcardView
              bankName={bankName}
              question={currentQuestion}
              practiceMode={practiceMode}
              hasAnswered={hasAnswered}
              onEvaluate={async (rating: AnkiRating, isCorrect: boolean) => {
                await handleSubjectiveEvaluation(isCorrect, rating);
              }}
            />
          )}

          {/* 客观题答案与解析面板（闪卡模式内含答案与采分点，不渲染重复底栏） */}
          {hasOptions && (hasAnswered || practiceMode === 'study') && (
            <div className="mt-4 sm:mt-5 border-t border-dashed border-stone-200 pt-3.5 sm:pt-4 bg-stone-50/90 -mx-4 sm:-mx-6 md:-mx-7 px-4 sm:px-6 md:px-7 -mb-4 sm:-mb-6 md:-mb-7 rounded-b-2xl">
              <div className="flex items-start space-x-3">
                <span className="bg-stone-900 text-white text-[11px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md mt-0.5 shrink-0">
                  解析
                </span>
                <div className="flex-1">
                  {currentQuestion.analysis ? (
                    <p className="text-sm sm:text-base text-stone-700 leading-relaxed font-sans">
                      {currentQuestion.analysis}
                    </p>
                  ) : null}
                  
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs sm:text-sm">
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
                    title="移出错题本"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isKilledCurrent ? '已移出' : '移出'}</span>
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
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            <button
              id="btn-quit-practice"
              onClick={onQuit}
              className="text-xs sm:text-sm text-stone-500 hover:text-stone-800 font-semibold flex items-center transition-colors px-2.5 sm:px-3 py-2 rounded-xl hover:bg-stone-100 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              退出
            </button>

            {currentIndex > 0 && (
              <button
                id="btn-prev-question"
                onClick={handlePrevQuestion}
                className="text-xs sm:text-sm text-stone-700 hover:text-stone-900 font-semibold flex items-center transition-colors px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 active:scale-95 border border-stone-200/80 shadow-2xs cursor-pointer"
                title="返回上一题 (修改手滑点错或重新自评)"
              >
                <ChevronLeft className="w-4 h-4 mr-0.5" />
                <span>上一题</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {!isFlashcardMode && (hasAnswered || practiceMode === 'study') && (
              <button
                id="btn-next-question"
                onClick={() => handleNextQuestion()}
                className="bg-stone-900 text-white text-sm sm:text-base font-bold px-5 sm:px-6 py-2 sm:py-2.5 rounded-xl hover:bg-stone-800 active:scale-95 transition-all flex items-center shadow-xs"
              >
                <span>{isLastQuestion ? '完成' : '下一题'}</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
