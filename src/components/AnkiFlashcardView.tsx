import React, { useState, useEffect, useMemo } from 'react';
import { 
  Eye, 
  EyeOff, 
  RotateCw
} from 'lucide-react';
import { Question, AnkiRating, PracticeMode } from '../types';
import { dailyActivityFacade } from '../services/dailyActivityFacade';

interface AnkiFlashcardViewProps {
  bankName: string;
  question: Question;
  practiceMode: PracticeMode;
  hasAnswered: boolean;
  onEvaluate: (rating: AnkiRating, isCorrect: boolean) => void;
}

export const AnkiFlashcardView: React.FC<AnkiFlashcardViewProps> = ({
  bankName,
  question,
  practiceMode,
  hasAnswered,
  onEvaluate
}) => {
  const [isFlipped, setIsFlipped] = useState(practiceMode === 'study');
  const [revealedClozeIndices, setRevealedClozeIndices] = useState<Set<number>>(new Set());

  // 每次切题重置卡片状态
  useEffect(() => {
    setIsFlipped(practiceMode === 'study');
    setRevealedClozeIndices(new Set());
  }, [question.id, practiceMode]);

  // 处理三级自评（🔴 生疏 / 🟡 模糊 / 🟢 熟练）
  const handleRatingClick = async (rating: AnkiRating) => {
    const isCorrect = rating === 'good' || rating === 'easy';
    await dailyActivityFacade.recordCardReview(bankName, question.id, rating);
    onEvaluate(rating, isCorrect);
  };

  // 填空题：解析挖空内容 (支持 {{...}} 或 ____ 占位)
  const clozeParts = useMemo(() => {
    if (question.clozeTemplate && question.clozeTemplate.includes('{{')) {
      const regex = /\{\{(.*?)\}\}/g;
      const parts: Array<{ isBlank: boolean; text: string; answerText?: string; index?: number }> = [];
      let lastIndex = 0;
      let blankCount = 0;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(question.clozeTemplate)) !== null) {
        if (match.index > lastIndex) {
          parts.push({
            isBlank: false,
            text: question.clozeTemplate.substring(lastIndex, match.index)
          });
        }
        parts.push({
          isBlank: true,
          text: '',
          answerText: match[1],
          index: blankCount++
        });
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < question.clozeTemplate.length) {
        parts.push({
          isBlank: false,
          text: question.clozeTemplate.substring(lastIndex)
        });
      }
      return { parts, totalBlanks: blankCount };
    }

    const rawAnswer = Array.isArray(question.answer) ? question.answer.join(' / ') : question.answer;
    const answerTokens = rawAnswer.split(/\s*\/\s*|\s*,\s*|\s*，\s*/).filter(Boolean);
    const textParts = question.question.split(/____+/);

    if (textParts.length > 1) {
      const parts: Array<{ isBlank: boolean; text: string; answerText?: string; index?: number }> = [];
      let blankCount = 0;
      for (let i = 0; i < textParts.length; i++) {
        parts.push({ isBlank: false, text: textParts[i] });
        if (i < textParts.length - 1) {
          parts.push({
            isBlank: true,
            text: '',
            answerText: answerTokens[blankCount] || '答案',
            index: blankCount++
          });
        }
      }
      return { parts, totalBlanks: blankCount };
    }

    return {
      parts: [{ isBlank: false, text: question.question }],
      totalBlanks: 0
    };
  }, [question.clozeTemplate, question.question, question.answer]);

  // 填空题：切换单空可见性
  const toggleCloze = (idx: number) => {
    setRevealedClozeIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // 填空题：一键全显 / 全隐
  const revealAllCloze = () => {
    const all = new Set<number>();
    for (let i = 0; i < clozeParts.totalBlanks; i++) all.add(i);
    setRevealedClozeIndices(all);
    setIsFlipped(true);
  };

  const hideAllCloze = () => {
    setRevealedClozeIndices(new Set());
    setIsFlipped(false);
  };

  // 填空题：判断当前是否所有空已显示
  const isAllClozeRevealed = (clozeParts.totalBlanks > 0 && revealedClozeIndices.size >= clozeParts.totalBlanks) || isFlipped;

  // 填空题：一键切换全部显示 / 全部隐藏
  const toggleAllCloze = () => {
    if (isAllClozeRevealed) {
      hideAllCloze();
    } else {
      revealAllCloze();
    }
  };

  // 键盘快捷键支持：Space 键翻转卡片 / 展开填空答案
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (question.type === 'blank') {
          toggleAllCloze();
        } else {
          setIsFlipped((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [question.type, isAllClozeRevealed, clozeParts.totalBlanks]);

  // 名词解释：核心关键词高亮
  const highlightedDefinitionHtml = useMemo(() => {
    const rawAnswer = Array.isArray(question.answer) ? question.answer.join(' / ') : question.answer;
    if (!rawAnswer) return '';
    if (!question.keyPoints || question.keyPoints.length === 0) {
      return rawAnswer;
    }

    let escapedPoints = question.keyPoints
      .map((k) => k.trim())
      .filter((k) => k.length > 0)
      .sort((a, b) => b.length - a.length);

    let html = rawAnswer;
    escapedPoints.forEach((keyword) => {
      const safeKey = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${safeKey})`, 'gi');
      html = html.replace(
        regex,
        `<span class="text-emerald-950 bg-emerald-100 font-bold px-1.5 py-0.5 rounded mx-0.5 border border-emerald-200/80">$1</span>`
      );
    });

    return html;
  }, [question.answer, question.keyPoints]);

  // 论述题：结构化关键词提取
  const essayPoints = useMemo(() => {
    if (question.keyPoints && question.keyPoints.length > 0) {
      return question.keyPoints.map((kp, idx) => ({
        index: idx + 1,
        text: kp
      }));
    }

    const rawAnswer = Array.isArray(question.answer) ? question.answer.join('\n') : question.answer;
    const lines = rawAnswer.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    if (lines.length >= 2) {
      return lines.map((l, idx) => ({
        index: idx + 1,
        text: l.replace(/^[0-9一二三四五六七八九十]+[、.：:]\s*/, '')
      }));
    }

    return [];
  }, [question.keyPoints, question.answer]);

  // 论述题：标准答案正文中的关键词高亮
  const highlightedEssayHtml = useMemo(() => {
    const raw = Array.isArray(question.answer) ? question.answer.join('\n\n') : (question.answer || '');
    if (!raw) return '';
    if (!question.keyPoints || question.keyPoints.length === 0) {
      return raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    let escapedPoints = question.keyPoints
      .map((k) => k.trim())
      .filter((k) => k.length > 0)
      .sort((a, b) => b.length - a.length);

    let html = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    escapedPoints.forEach((keyword) => {
      const safeKey = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${safeKey})`, 'gi');
      html = html.replace(
        regex,
        `<span class="text-emerald-950 bg-emerald-100 font-semibold px-1 py-0.5 rounded mx-0.5 border border-emerald-200/80">$1</span>`
      );
    });

    return html;
  }, [question.answer, question.keyPoints]);

  return (
    <div className="space-y-4">
      {/* ---------------- 1. 填空题：自然下划线隐形遮罩 (只保留纯眼睛图标) ---------------- */}
      {question.type === 'blank' && (
        <div className="bg-white border border-stone-200/90 rounded-2xl p-5 sm:p-7 shadow-xs">
          <div className="flex items-center justify-end pb-2 mb-3 border-b border-stone-100">
            <button
              type="button"
              onClick={toggleAllCloze}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isAllClozeRevealed
                  ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                  : 'text-stone-400 hover:text-stone-800 hover:bg-stone-100'
              }`}
              title={isAllClozeRevealed ? '点击全部遮盖' : '点击全部显示'}
            >
              {isAllClozeRevealed ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>

          <div className="text-base sm:text-lg text-stone-800 leading-relaxed sm:leading-loose select-text">
            {clozeParts.parts.map((part, pIdx) => {
              if (!part.isBlank) {
                return <span key={pIdx}>{part.text}</span>;
              }
              const isRevealed = revealedClozeIndices.has(part.index!) || practiceMode === 'study' || isFlipped;

              return (
                <button
                  key={pIdx}
                  type="button"
                  onClick={() => toggleCloze(part.index!)}
                  className={`inline-block mx-1 px-2.5 py-0.5 rounded transition-all cursor-pointer select-none align-baseline border-b-2 font-medium ${
                    isRevealed
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold'
                      : 'border-stone-400 bg-stone-100 hover:bg-stone-200 text-transparent border-dashed'
                  }`}
                  title={isRevealed ? '点击遮挡' : '点击显示'}
                >
                  {isRevealed ? part.answerText : (part.answerText || '____')}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------- 2. 名词解释：沉浸式双面切换 (无文字干扰，仅保留翻转箭头) ---------------- */}
      {question.type === 'definition' && (
        <div className="bg-white border border-stone-200/90 rounded-2xl shadow-xs overflow-hidden transition-all">
          {!isFlipped ? (
            /* 正面：纯粹大字词条 + 翻转箭头图标 */
            <div 
              onClick={() => setIsFlipped(true)}
              className="p-8 sm:p-12 text-center cursor-pointer hover:bg-stone-50/40 transition-colors flex flex-col items-center justify-center min-h-[200px]"
            >
              <h3 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight mb-5">
                {question.question.replace('【名词解释】', '').trim()}
              </h3>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFlipped(true);
                }}
                className="p-2.5 rounded-full text-stone-400 hover:text-stone-800 hover:bg-stone-100 active:scale-95 transition-all cursor-pointer"
                title="翻转卡片"
              >
                <RotateCw className="w-5 h-5" />
              </button>
            </div>
          ) : (
            /* 背面：直接展示释义，仅翻转箭头 */
            <div className="p-6 sm:p-7">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-100 text-xs">
                <span className="font-bold text-stone-900 text-sm sm:text-base">
                  {question.question.replace('【名词解释】', '').trim()}
                </span>
                <button
                  type="button"
                  onClick={() => setIsFlipped(false)}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                  title="翻转"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>

              <div 
                className="text-stone-800 text-base sm:text-lg leading-relaxed select-text"
                dangerouslySetInnerHTML={{ __html: highlightedDefinitionHtml }}
              />

              {question.keyPoints && question.keyPoints.length > 0 && (
                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center flex-wrap gap-1.5 text-xs">
                  <span className="text-[11px] font-semibold text-stone-400">关键词：</span>
                  {question.keyPoints.map((kp, idx) => (
                    <span 
                      key={idx}
                      className="bg-emerald-50 text-emerald-800 font-medium px-2 py-0.5 rounded-md border border-emerald-200/70"
                    >
                      {kp}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---------------- 3. 论述简答题：仅保留翻转箭头 + 答案高亮关键词 ---------------- */}
      {question.type === 'essay' && (
        <div className="bg-white border border-stone-200/90 rounded-2xl shadow-xs overflow-hidden transition-all">
          {!isFlipped ? (
            /* 正面：纯粹居中题干 + 翻转箭头图标 */
            <div 
              onClick={() => setIsFlipped(true)}
              className="p-8 sm:p-12 text-center cursor-pointer hover:bg-stone-50/40 transition-colors flex flex-col items-center justify-center min-h-[200px]"
            >
              <h3 className="text-xl sm:text-2xl font-bold text-stone-900 leading-relaxed max-w-2xl mx-auto mb-5">
                {question.question.replace('【论述题】', '').replace('【简答题】', '').trim()}
              </h3>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFlipped(true);
                }}
                className="p-2.5 rounded-full text-stone-400 hover:text-stone-800 hover:bg-stone-100 active:scale-95 transition-all cursor-pointer"
                title="翻转卡片"
              >
                <RotateCw className="w-5 h-5" />
              </button>
            </div>
          ) : (
            /* 背面：仅保留翻转箭头 + 关键词标签 + 高亮正文 */
            <div className="p-6 sm:p-7">
              <div className="flex items-center justify-end pb-3 mb-4 border-b border-stone-100 text-xs">
                <button
                  type="button"
                  onClick={() => setIsFlipped(false)}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                  title="翻转"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>

              {/* 关键词 (如有) */}
              {essayPoints.length > 0 && (
                <div className="mb-4 p-3.5 bg-stone-50 border border-stone-200/70 rounded-xl space-y-1.5">
                  <div className="text-[11px] font-bold text-stone-500">关键词</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {essayPoints.map((pt) => (
                      <div key={pt.index} className="flex items-start space-x-2 text-xs text-stone-800">
                        <span className="w-4 h-4 rounded-full bg-stone-200 text-stone-700 font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">
                          {pt.index}
                        </span>
                        <span className="leading-relaxed font-medium">{pt.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 答案正文 (高亮关键词) */}
              <div 
                className="text-sm sm:text-base text-stone-800 leading-relaxed whitespace-pre-wrap font-sans select-text"
                dangerouslySetInnerHTML={{ __html: highlightedEssayHtml }}
              />
            </div>
          )}
        </div>
      )}

      {/* ---------------- 4. 紧凑三态自评按钮（🔴 生疏 / 🟡 模糊 / 🟢 熟练） ---------------- */}
      {(!hasAnswered || practiceMode === 'study') && (
        <div className="pt-2">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => handleRatingClick('again')}
              className="py-2.5 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 flex items-center justify-center space-x-1.5 transition-all active:scale-98 shadow-2xs font-bold text-xs sm:text-sm cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
              <span>生疏</span>
            </button>

            <button
              type="button"
              onClick={() => handleRatingClick('hard')}
              className="py-2.5 px-3 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 flex items-center justify-center space-x-1.5 transition-all active:scale-98 shadow-2xs font-bold text-xs sm:text-sm cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
              <span>模糊</span>
            </button>

            <button
              type="button"
              onClick={() => handleRatingClick('good')}
              className="py-2.5 px-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 flex items-center justify-center space-x-1.5 transition-all active:scale-98 shadow-2xs font-bold text-xs sm:text-sm cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0"></span>
              <span>熟练</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
