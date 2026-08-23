import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Search, 
  CheckCircle2, 
  Flame, 
  BookOpen, 
  Filter, 
  Check, 
  X,
  Play, 
  Eye,
  SlidersHorizontal,
  ChevronDown,
  Trash2,
  CheckCheck,
  RotateCcw,
  Clock,
  HelpCircle
} from 'lucide-react';
import { Question, WrongBook, BankStats } from '../types';

interface BankBrowseViewProps {
  bankName: string;
  questions: Question[];
  wrongBook: WrongBook;
  masteredIds?: number[];
  stats: BankStats;
  onBack: () => void;
  onStartPractice: (mode: 'test' | 'study') => void;
  onRemoveFromWrongBook?: (questionId: number) => Promise<void> | void;
  onToggleMastered?: (questionId: number, isMastered: boolean) => Promise<void> | void;
  onDeleteQuestion?: (questionId: number) => Promise<void> | void;
}

export const BankBrowseView: React.FC<BankBrowseViewProps> = ({
  bankName,
  questions,
  wrongBook,
  masteredIds = [],
  stats,
  onBack,
  onStartPractice,
  onRemoveFromWrongBook,
  onToggleMastered,
  onDeleteQuestion
}) => {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'single' | 'multiple' | 'judge'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unpracticed' | 'mastered' | 'wrong'>('all');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [confirmDeleteQuestionId, setConfirmDeleteQuestionId] = useState<number | null>(null);

  const showFeedback = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => {
      setActionSuccessMsg(null);
    }, 2500);
  };

  const masteredSet = useMemo(() => new Set(masteredIds), [masteredIds]);

  // 判断单道题目的状态：仅错题(wrong) > 已掌握(mastered) > 未练习(unpracticed)
  const getQuestionStatus = (id: number): 'wrong' | 'mastered' | 'unpracticed' => {
    if (wrongBook[id]) return 'wrong';
    if (masteredSet.has(id)) return 'mastered';
    return 'unpracticed';
  };

  // 状态数量统计
  const wrongCount = useMemo(() => {
    return questions.filter((q) => !!wrongBook[q.id]).length;
  }, [questions, wrongBook]);

  const masteredCount = useMemo(() => {
    return questions.filter((q) => !wrongBook[q.id] && masteredSet.has(q.id)).length;
  }, [questions, wrongBook, masteredSet]);

  const unpracticedCount = Math.max(0, questions.length - wrongCount - masteredCount);

  // 过滤题目
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      // 搜索关键字（题干、选项、解析）
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        const inQ = q.question.toLowerCase().includes(kw);
        const inA = (q.analysis || '').toLowerCase().includes(kw);
        const inOpts = Object.values(q.options || {}).some(v => v.toLowerCase().includes(kw));
        if (!inQ && !inA && !inOpts && !q.id.toString().includes(kw)) {
          return false;
        }
      }

      // 题型过滤
      if (filterType !== 'all' && q.type !== filterType) {
        return false;
      }

      // 状态过滤 (未练习 / 已掌握 / 仅错题)
      const status = getQuestionStatus(q.id);
      if (filterStatus === 'wrong' && status !== 'wrong') return false;
      if (filterStatus === 'mastered' && status !== 'mastered') return false;
      if (filterStatus === 'unpracticed' && status !== 'unpracticed') return false;

      return true;
    });
  }, [questions, wrongBook, masteredSet, searchKeyword, filterType, filterStatus]);

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'single':
        return { label: '单选', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'multiple':
        return { label: '多选', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'judge':
        return { label: '判断', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      default:
        return { label: '题目', bg: 'bg-stone-100 text-stone-700 border-stone-200' };
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200 pb-16">
      {/* 搜索与过滤工具条 */}
      <div className="bg-white border border-stone-200/90 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* 搜索框 */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="搜索题号、题目文字、选项或解析关键字..."
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-stone-900 transition-colors"
            />
            {searchKeyword && (
              <button
                onClick={() => setSearchKeyword('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-700"
              >
                清空
              </button>
            )}
          </div>

          {/* 题型切换 */}
          <div className="flex items-center space-x-1 bg-stone-100 p-1 rounded-xl text-xs shrink-0 self-stretch sm:self-auto justify-center">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                filterType === 'all' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              全部 ({stats.total})
            </button>
            {stats.single > 0 && (
              <button
                onClick={() => setFilterType('single')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  filterType === 'single' ? 'bg-white text-blue-700 shadow-xs' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                单选 ({stats.single})
              </button>
            )}
            {stats.multiple > 0 && (
              <button
                onClick={() => setFilterType('multiple')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  filterType === 'multiple' ? 'bg-white text-purple-700 shadow-xs' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                多选 ({stats.multiple})
              </button>
            )}
            {stats.judge > 0 && (
              <button
                onClick={() => setFilterType('judge')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  filterType === 'judge' ? 'bg-white text-amber-700 shadow-xs' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                判断 ({stats.judge})
              </button>
            )}
          </div>
        </div>

        {/* 状态筛选工具栏 (未练习 / 已掌握 / 仅错题) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-stone-400 mr-1">状态筛选:</span>
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1 rounded-lg font-medium border transition-colors ${
                filterStatus === 'all' 
                  ? 'bg-stone-900 text-white border-stone-900' 
                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
              }`}
            >
              全部 ({questions.length})
            </button>
            <button
              onClick={() => setFilterStatus('unpracticed')}
              className={`px-2.5 py-1 rounded-lg font-medium border transition-colors flex items-center space-x-1 ${
                filterStatus === 'unpracticed' 
                  ? 'bg-stone-700 text-white border-stone-700' 
                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
              }`}
            >
              <Clock className="w-3 h-3 text-stone-400" />
              <span>未练习 ({unpracticedCount})</span>
            </button>
            <button
              onClick={() => setFilterStatus('mastered')}
              className={`px-2.5 py-1 rounded-lg font-medium border transition-colors flex items-center space-x-1 ${
                filterStatus === 'mastered' 
                  ? 'bg-emerald-600 text-white border-emerald-600' 
                  : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>已掌握 ({masteredCount})</span>
            </button>
            <button
              onClick={() => setFilterStatus('wrong')}
              className={`px-2.5 py-1 rounded-lg font-medium border transition-colors flex items-center space-x-1 ${
                filterStatus === 'wrong' 
                  ? 'bg-rose-600 text-white border-rose-600' 
                  : 'bg-white text-rose-600 border-rose-200 hover:bg-rose-50'
              }`}
            >
              <Flame className="w-3 h-3 fill-current text-rose-500" />
              <span>仅错题 ({wrongCount})</span>
            </button>
          </div>

          <span className="text-stone-400">
            已显示 <strong className="text-stone-800 font-mono">{filteredQuestions.length}</strong> / {questions.length} 题
          </span>
        </div>
      </div>

      {/* 操作提示 Toast */}
      {actionSuccessMsg && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg flex items-center space-x-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCheck className="w-4 h-4 text-emerald-400" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* 题目列表 (下滑式全景卡片) */}
      <div className="space-y-4">
        {filteredQuestions.length > 0 ? (
          filteredQuestions.map((q) => {
            const wrongRecord = wrongBook[q.id];
            const qStatus = getQuestionStatus(q.id);
            const typeBadge = getTypeLabel(q.type);
            const ansLetters = q.answer.split('').map(s => s.trim().toUpperCase());

            return (
              <div
                key={q.id}
                id={`q-item-${q.id}`}
                className={`bg-white border rounded-2xl p-5 md:p-6 shadow-xs transition-all ${
                  qStatus === 'wrong'
                    ? 'border-rose-200/90 ring-1 ring-rose-100/70' 
                    : qStatus === 'mastered'
                    ? 'border-stone-200/90 hover:border-emerald-200'
                    : 'border-stone-200/80 hover:border-stone-300'
                }`}
              >
                {/* 题目头部状态 */}
                <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-stone-900 text-sm bg-stone-100 px-2 py-0.5 rounded-md">
                      #{q.id}
                    </span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${typeBadge.bg}`}>
                      {typeBadge.label}
                    </span>
                  </div>

                  {/* 状态标识 (未练习 / 已掌握 / 仅错题) & 操作按钮组 */}
                  <div className="flex items-center space-x-2 text-xs flex-wrap gap-y-1">
                    {qStatus === 'wrong' ? (
                      /* 仅错题状态 */
                      <div className="flex items-center space-x-1.5">
                        <span className="text-rose-700 bg-rose-50 border border-rose-200/90 px-2.5 py-0.5 rounded-md font-medium text-[11px] flex items-center space-x-1">
                          <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                          <span>累计 {wrongRecord?.count || 1} 次</span>
                          {wrongRecord && wrongRecord.streakCorrect > 0 && (
                            <span className="text-emerald-600 font-mono ml-1 font-semibold">
                              (连对 {wrongRecord.streakCorrect} 次)
                            </span>
                          )}
                        </span>

                        {/* 移除错题标记 (恢复为未训练状态，作为误触补救) */}
                        {onRemoveFromWrongBook && (
                          <button
                            onClick={async () => {
                              await onRemoveFromWrongBook(q.id);
                              showFeedback(`已将 #${q.id} 移出错题本，恢复为未训练`);
                            }}
                            className="bg-stone-50 hover:bg-emerald-50 text-stone-600 hover:text-emerald-700 border border-stone-200 hover:border-emerald-300 px-2 py-0.5 rounded-md font-medium text-[10px] flex items-center space-x-1 transition-colors"
                            title="移出错题本并恢复为未训练状态"
                          >
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>移出错题</span>
                          </button>
                        )}
                      </div>
                    ) : qStatus === 'mastered' ? (
                      /* 已掌握状态 */
                      <div className="flex items-center space-x-1.5">
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-200/90 px-2.5 py-0.5 rounded-md font-medium text-[11px] flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>已掌握</span>
                        </span>

                        {onToggleMastered && (
                          <button
                            onClick={async () => {
                              await onToggleMastered(q.id, false);
                              showFeedback(`已将 #${q.id} 重置为未练习状态`);
                            }}
                            className="text-stone-400 hover:text-stone-700 hover:bg-stone-100 px-1.5 py-0.5 rounded text-[10px] transition-colors border border-transparent hover:border-stone-200"
                            title="重置为未练习状态"
                          >
                            重置
                          </button>
                        )}
                      </div>
                    ) : (
                      /* 未练习状态 */
                      <div className="flex items-center space-x-1.5">
                        <span className="text-stone-500 bg-stone-100 border border-stone-200/80 px-2.5 py-0.5 rounded-md font-medium text-[11px] flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-stone-400" />
                          <span>未练习</span>
                        </span>

                        {onToggleMastered && (
                          <button
                            onClick={async () => {
                              await onToggleMastered(q.id, true);
                              showFeedback(`已将 #${q.id} 标记为已掌握`);
                            }}
                            className="bg-stone-50 hover:bg-emerald-50 text-stone-600 hover:text-emerald-700 border border-stone-200 hover:border-emerald-300 px-2 py-0.5 rounded-md font-medium text-[10px] flex items-center space-x-1 transition-colors"
                            title="标记为已掌握"
                          >
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>已掌握</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* 从题库彻底删除该题 */}
                    {onDeleteQuestion && (
                      confirmDeleteQuestionId === q.id ? (
                        <div className="flex items-center space-x-1.5 ml-1 animate-in fade-in zoom-in-95 duration-150 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg shadow-2xs">
                          <span className="text-[11px] text-rose-700 font-medium mr-0.5">确认移除</span>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await onDeleteQuestion(q.id);
                              setConfirmDeleteQuestionId(null);
                              showFeedback(`已将题目 #${q.id} 从题库中移除`);
                            }}
                            className="bg-rose-600 hover:bg-rose-700 text-white p-1 rounded-md transition-colors shadow-xs flex items-center justify-center"
                            title="确认移除"
                          >
                            <Check className="w-3 h-3 stroke-[2.5]" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteQuestionId(null);
                            }}
                            className="bg-stone-200/80 hover:bg-stone-300 text-stone-600 hover:text-stone-900 p-1 rounded-md transition-colors flex items-center justify-center"
                            title="取消"
                          >
                            <X className="w-3 h-3 stroke-[2.5]" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteQuestionId(q.id);
                          }}
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-colors ml-1"
                          title="将此题从题库中删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* 题干文本 */}
                <p className="text-sm md:text-base font-semibold text-stone-900 leading-relaxed mb-4">
                  {q.question}
                </p>

                {/* 选项列表 (直接高亮正确选项) */}
                <div className="space-y-2 mb-4">
                  {Object.entries(q.options).map(([key, val]) => {
                    const isCorrect = ansLetters.includes(key.toUpperCase());
                    return (
                      <div
                        key={key}
                        className={`flex items-start space-x-3 p-3 rounded-xl border text-xs md:text-sm transition-all ${
                          isCorrect
                            ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-medium'
                            : 'bg-stone-50/40 border-stone-200/70 text-stone-600'
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                            isCorrect
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-stone-200/80 text-stone-700'
                          }`}
                        >
                          {key}
                        </span>
                        <div className="flex-1 pt-0.5 leading-normal">
                          {val}
                        </div>
                        {isCorrect && (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 flex items-center space-x-1 self-center">
                            <Check className="w-3 h-3" />
                            <span>正确答案</span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 解析与考点精粹 (如有) */}
                {q.analysis && (
                  <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3.5 text-xs text-stone-700 space-y-1">
                    <div className="font-bold text-stone-800 flex items-center space-x-1.5">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                      <span>考点解析</span>
                    </div>
                    <p className="leading-relaxed text-stone-600 pl-3">
                      {q.analysis}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center text-xs text-stone-400">
            没有匹配到符合条件的题目，请尝试修改搜索词或重置筛选条件。
          </div>
        )}
      </div>
    </div>
  );
};
