import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { 
  Trophy, 
  RotateCcw, 
  Flame, 
  Clock, 
  CheckCircle2, 
  Home, 
  ArrowRight, 
  Award,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  Zap,
  Target,
  ChevronDown,
  ChevronUp,
  BookOpen
} from 'lucide-react';
import { SessionSummary, Question, WrongBook, MasteryStatus, QuestionCognitiveProfile } from '../types';

interface SummaryViewProps {
  summary: SessionSummary;
  questions: Question[];
  wrongBook: WrongBook;
  onRetryWrongOnly: (wrongIds: number[]) => void;
  onStartCustomPractice?: (questionIds: number[], mode: 'test' | 'study') => void;
  onRestartAll: () => void;
  onBackHome: () => void;
  onBrowseBank?: () => void;
}

export const SummaryView: React.FC<SummaryViewProps> = ({
  summary,
  questions,
  wrongBook,
  onRetryWrongOnly,
  onStartCustomPractice,
  onRestartAll,
  onBackHome,
  onBrowseBank
}) => {
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | MasteryStatus>('all');
  const [inspectedQuestionId, setInspectedQuestionId] = useState<number | null>(null);

  useEffect(() => {
    // 若正确率 >= 80%，触发全屏礼花
    const rate = parseFloat(summary.accuracyRate);
    if (rate >= 80) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [summary.accuracyRate]);

  // 计算每道题的认知三色状态 (已掌握 / 模糊 / 盲区)
  const cognitiveProfiles = useMemo(() => {
    const questionMap = new Map<number, Question>(questions.map(q => [q.id, q]));
    const results: QuestionCognitiveProfile[] = [];

    // 从 summary 中获取本次练习的题目列表
    // 如果有 questionResults，用它的 key；否则如果 wrongQuestionIds 存在，用练习过的题目
    const questionResults = summary.questionResults || {};
    const practicedIds = Object.keys(questionResults).length > 0 
      ? Object.keys(questionResults).map(Number)
      : questions.map(q => q.id);

    practicedIds.forEach((id) => {
      const q = questionMap.get(id);
      if (!q) return;

      const isWrongThisTime = summary.wrongQuestionIds.includes(id) || questionResults[id] === 'wrong';
      const historyRecord = wrongBook[id];
      const historyWrongCount = historyRecord?.count || 0;

      let status: MasteryStatus = 'mastered';

      if (isWrongThisTime || historyWrongCount >= 2) {
        status = 'blindspot'; // 盲区：本次答错 或 历史多次出错
      } else if (!isWrongThisTime && historyWrongCount > 0) {
        status = 'vague'; // 模糊/待巩固：本次答对但历史曾经答错遗留
      } else {
        status = 'mastered'; // 已掌握：本次答对且无历史错题累积
      }

      results.push({
        id,
        status,
        result: isWrongThisTime ? 'wrong' : 'correct',
        wrongHistoryCount: historyWrongCount
      });
    });

    return results;
  }, [questions, summary, wrongBook]);

  // 三色计数与百分比
  const stats = useMemo(() => {
    const total = cognitiveProfiles.length;
    const masteredList = cognitiveProfiles.filter(p => p.status === 'mastered');
    const vagueList = cognitiveProfiles.filter(p => p.status === 'vague');
    const blindspotList = cognitiveProfiles.filter(p => p.status === 'blindspot');

    const masteredPct = total > 0 ? ((masteredList.length / total) * 100).toFixed(1) : '0.0';
    const vaguePct = total > 0 ? ((vagueList.length / total) * 100).toFixed(1) : '0.0';
    const blindspotPct = total > 0 ? ((blindspotList.length / total) * 100).toFixed(1) : '0.0';

    return {
      total,
      mastered: { count: masteredList.length, pct: masteredPct, ids: masteredList.map(p => p.id) },
      vague: { count: vagueList.length, pct: vaguePct, ids: vagueList.map(p => p.id) },
      blindspot: { count: blindspotList.length, pct: blindspotPct, ids: blindspotList.map(p => p.id) }
    };
  }, [cognitiveProfiles]);

  const formattedTime = () => {
    const m = Math.floor(summary.elapsedSeconds / 60).toString().padStart(2, '0');
    const s = (summary.elapsedSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // 过滤后的热力图方块
  const filteredProfiles = useMemo(() => {
    if (selectedStatusFilter === 'all') return cognitiveProfiles;
    return cognitiveProfiles.filter(p => p.status === selectedStatusFilter);
  }, [cognitiveProfiles, selectedStatusFilter]);

  const inspectedQuestion = useMemo(() => {
    if (!inspectedQuestionId) return null;
    return questions.find(q => q.id === inspectedQuestionId) || null;
  }, [inspectedQuestionId, questions]);

  const inspectedProfile = useMemo(() => {
    if (!inspectedQuestionId) return null;
    return cognitiveProfiles.find(p => p.id === inspectedQuestionId) || null;
  }, [inspectedQuestionId, cognitiveProfiles]);

  return (
    <div className="space-y-6 max-w-3xl mx-auto w-full my-auto animate-in fade-in duration-200 pb-12">
      {/* 顶部总览卡片 */}
      <div className="bg-white border border-stone-200/90 rounded-2xl shadow-xs p-6 md:p-8 text-center">
        <div className="w-14 h-14 bg-stone-900 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
          <Trophy className="w-7 h-7" />
        </div>

        <h2 className="text-xl md:text-2xl font-bold text-stone-900 mb-1">
          本次复习与认知画像已生成
        </h2>
        <p className="text-xs text-stone-400 max-w-md mx-auto mb-6">
          已根据作答行为生成「已掌握 / 模糊待巩固 / 盲区」三色认知画像
        </p>

        {/* 4 维核心数据指标 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
          <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
            <div className="text-[11px] text-stone-400 mb-1 font-sans">完成题数</div>
            <div className="text-xl font-bold text-stone-800">{summary.totalQuestions}</div>
          </div>

          <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
            <div className="text-[11px] text-stone-400 mb-1 font-sans">正确率</div>
            <div className="text-xl font-bold text-emerald-600">{summary.accuracyRate}%</div>
          </div>

          <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
            <div className="text-[11px] text-stone-400 mb-1 font-sans">本次错题</div>
            <div className="text-xl font-bold text-rose-500">{summary.wrongCount}</div>
          </div>

          <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
            <div className="text-[11px] text-stone-400 mb-1 font-sans">总用时</div>
            <div className="text-xl font-bold text-indigo-600">{formattedTime()}</div>
          </div>
        </div>
      </div>

      {/* 认知画像三色分布卡片 */}
      <div className="bg-white border border-stone-200/90 rounded-2xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-stone-900 flex items-center space-x-2">
              <Target className="w-4 h-4 text-stone-800" />
              <span>知识点熟练度三色画像</span>
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              客观反映真实认知状态，点击标签可筛选热力方块
            </p>
          </div>

          <div className="flex items-center space-x-1.5 text-xs">
            <button
              onClick={() => setSelectedStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium border transition-colors ${
                selectedStatusFilter === 'all'
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
              }`}
            >
              全部 ({stats.total})
            </button>
          </div>
        </div>

        {/* 三色进度条 */}
        <div className="space-y-2">
          <div className="h-3.5 w-full bg-stone-100 rounded-full overflow-hidden flex p-0.5 gap-0.5 border border-stone-200/60">
            {stats.mastered.count > 0 && (
              <div 
                style={{ width: `${stats.mastered.pct}%` }} 
                className="bg-emerald-500 rounded-l-full transition-all"
                title={`已掌握: ${stats.mastered.count} 题 (${stats.mastered.pct}%)`}
              />
            )}
            {stats.vague.count > 0 && (
              <div 
                style={{ width: `${stats.vague.pct}%` }} 
                className="bg-amber-400 transition-all"
                title={`模糊/待巩固: ${stats.vague.count} 题 (${stats.vague.pct}%)`}
              />
            )}
            {stats.blindspot.count > 0 && (
              <div 
                style={{ width: `${stats.blindspot.pct}%` }} 
                className="bg-rose-500 rounded-r-full transition-all"
                title={`认知盲区: ${stats.blindspot.count} 题 (${stats.blindspot.pct}%)`}
              />
            )}
          </div>

          {/* 三色分类卡片触发器 */}
          <div className="grid grid-cols-3 gap-2 text-xs pt-1">
            <button
              onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'mastered' ? 'all' : 'mastered')}
              className={`p-3 rounded-xl border text-left transition-all ${
                selectedStatusFilter === 'mastered'
                  ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200'
                  : 'bg-emerald-50/40 border-emerald-100 hover:bg-emerald-50/80'
              }`}
            >
              <div className="flex items-center space-x-1.5 text-emerald-800 font-bold mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>已掌握</span>
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-lg font-bold font-mono text-emerald-700">{stats.mastered.count}</span>
                <span className="text-[11px] text-emerald-600/80">({stats.mastered.pct}%)</span>
              </div>
            </button>

            <button
              onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'vague' ? 'all' : 'vague')}
              className={`p-3 rounded-xl border text-left transition-all ${
                selectedStatusFilter === 'vague'
                  ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200'
                  : 'bg-amber-50/40 border-amber-100 hover:bg-amber-50/80'
              }`}
            >
              <div className="flex items-center space-x-1.5 text-amber-800 font-bold mb-1">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>模糊 / 待巩固</span>
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-lg font-bold font-mono text-amber-700">{stats.vague.count}</span>
                <span className="text-[11px] text-amber-600/80">({stats.vague.pct}%)</span>
              </div>
            </button>

            <button
              onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'blindspot' ? 'all' : 'blindspot')}
              className={`p-3 rounded-xl border text-left transition-all ${
                selectedStatusFilter === 'blindspot'
                  ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-200'
                  : 'bg-rose-50/40 border-rose-100 hover:bg-rose-50/80'
              }`}
            >
              <div className="flex items-center space-x-1.5 text-rose-800 font-bold mb-1">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <span>认知盲区</span>
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-lg font-bold font-mono text-rose-700">{stats.blindspot.count}</span>
                <span className="text-[11px] text-rose-600/80">({stats.blindspot.pct}%)</span>
              </div>
            </button>
          </div>
        </div>

        {/* 题号认知热力矩阵 */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-2 text-xs">
            <span className="font-semibold text-stone-700">题号认知热力矩阵 (点击方块快速查看题目)</span>
            <span className="text-stone-400">当前显示: {filteredProfiles.length} 题</span>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-2 bg-stone-50/70 border border-stone-200/70 rounded-xl">
            {filteredProfiles.map((p) => {
              const isInspected = inspectedQuestionId === p.id;
              let colorClass = 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200';
              if (p.status === 'blindspot') {
                colorClass = 'bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-200';
              } else if (p.status === 'vague') {
                colorClass = 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200';
              }

              return (
                <button
                  key={p.id}
                  onClick={() => setInspectedQuestionId(isInspected ? null : p.id)}
                  className={`w-8 h-8 rounded-lg font-mono text-xs font-bold border transition-all flex items-center justify-center ${colorClass} ${
                    isInspected ? 'ring-2 ring-stone-900 scale-110 z-10' : ''
                  }`}
                  title={`#${p.id} - ${p.status === 'mastered' ? '已掌握' : p.status === 'vague' ? '模糊' : '盲区'}`}
                >
                  {p.id}
                </button>
              );
            })}
          </div>
        </div>

        {/* 单题即时检视抽屉卡片 */}
        {inspectedQuestion && inspectedProfile && (
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-left text-xs space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="font-mono font-bold text-stone-900 bg-white px-2 py-0.5 rounded border border-stone-200">
                  #{inspectedQuestion.id}
                </span>
                <span className={`px-2 py-0.5 rounded font-bold ${
                  inspectedProfile.status === 'mastered' 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : inspectedProfile.status === 'vague'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  {inspectedProfile.status === 'mastered' ? '已掌握' : inspectedProfile.status === 'vague' ? '模糊待巩固' : '认知盲区'}
                </span>
              </div>
              <button
                onClick={() => setInspectedQuestionId(null)}
                className="text-stone-400 hover:text-stone-700 font-medium"
              >
                收起
              </button>
            </div>

            <p className="font-semibold text-stone-900 text-sm leading-relaxed">
              {inspectedQuestion.question}
            </p>

            <div className="space-y-1.5 pl-1">
              {Object.entries(inspectedQuestion.options).map(([k, v]) => {
                const isAns = inspectedQuestion.answer.toUpperCase().includes(k.toUpperCase());
                return (
                  <div 
                    key={k} 
                    className={`flex items-start space-x-2 p-1.5 rounded ${
                      isAns ? 'bg-emerald-100/70 text-emerald-950 font-bold' : 'text-stone-600'
                    }`}
                  >
                    <span className="font-mono">{k}.</span>
                    <span>{v}</span>
                    {isAns && <span className="text-[10px] text-emerald-700 ml-auto bg-emerald-200 px-1.5 py-0.2 rounded font-sans">正确答案</span>}
                  </div>
                );
              })}
            </div>

            {inspectedQuestion.analysis && (
              <div className="bg-white border border-stone-200 p-2.5 rounded-lg text-stone-600 text-[11px] leading-relaxed">
                <strong className="text-stone-800 block mb-0.5">解析考点：</strong>
                {inspectedQuestion.analysis}
              </div>
            )}
          </div>
        )}

        {/* 精准行动入口 */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-stone-100">
          {stats.blindspot.count > 0 && onStartCustomPractice && (
            <button
              onClick={() => onStartCustomPractice(stats.blindspot.ids, 'test')}
              className="w-full sm:flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-xs transition-all active:scale-95"
            >
              <Target className="w-3.5 h-3.5" />
              <span>专项消灭 {stats.blindspot.count} 道盲区题</span>
            </button>
          )}

          {stats.vague.count > 0 && onStartCustomPractice && (
            <button
              onClick={() => onStartCustomPractice(stats.vague.ids, 'study')}
              className="w-full sm:flex-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              <span>快速速记 {stats.vague.count} 道模糊题</span>
            </button>
          )}

          {onBrowseBank && (
            <button
              onClick={onBrowseBank}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50 text-xs font-medium flex items-center justify-center space-x-1.5 transition-all"
            >
              <BookOpen className="w-3.5 h-3.5 text-stone-500" />
              <span>浏览完整题库</span>
            </button>
          )}
        </div>
      </div>

      {/* 底部导航与重练按钮 */}
      <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
        <button
          onClick={onRestartAll}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50 font-semibold text-xs flex items-center justify-center space-x-2 transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>重新刷一遍</span>
        </button>

        <button
          onClick={onBackHome}
          className="w-full sm:w-auto bg-stone-900 hover:bg-stone-800 text-white px-7 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center space-x-2 transition-all shadow-xs"
        >
          <Home className="w-3.5 h-3.5" />
          <span>返回题库主页</span>
        </button>
      </div>
    </div>
  );
};
