import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Flame, 
  CheckCircle2, 
  Layers, 
  Calendar,
  ChevronDown,
  ChevronUp,
  Brain
} from 'lucide-react';
import { dailyActivityFacade, ActivityDashboardStats } from '../services/dailyActivityFacade';
import { DailyActivityLog } from '../types';

interface CognitiveDashboardProps {
  onStartAnkiQuickReview?: () => void;
  refreshTrigger?: number;
}

export const CognitiveDashboard: React.FC<CognitiveDashboardProps> = ({ refreshTrigger }) => {
  // 按照要求：看板默认折叠
  const [isExpanded, setIsExpanded] = useState(false);
  const [stats, setStats] = useState<ActivityDashboardStats>({
    currentStreak: 0,
    longestStreak: 0,
    totalQuestions: 0,
    totalReviews: 0,
    totalTimeSpentSeconds: 0,
    overallAccuracyRate: 0,
    retentionRate: 85,
    masteredCardsCount: 0,
    todayDueCardsCount: 0,
    overdueCardsCount: 0
  });
  const [logs, setLogs] = useState<DailyActivityLog[]>([]);
  const [hoveredDay, setHoveredDay] = useState<{
    date: string;
    totalCount: number;
    reviewCount: number;
    correctCount: number;
    accuracy: number;
    timeMinutes: number;
    x: number;
    y: number;
  } | null>(null);

  const [viewWeeks, setViewWeeks] = useState<16 | 52>(16);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadData() {
      const s = await dailyActivityFacade.getDashboardStats();
      const l = await dailyActivityFacade.getAllLogs();
      setStats(s);
      setLogs(l);
    }
    loadData();
  }, [refreshTrigger]);

  // 将 logs 转为 Map 快速索引
  const logMap = useMemo(() => {
    const map = new Map<string, DailyActivityLog>();
    logs.forEach((log) => map.set(log.date, log));
    return map;
  }, [logs]);

  // 生成近 N 周的日历格子数据（7 行，N 列）
  const { weeks, monthLabels } = useMemo(() => {
    const numWeeks = viewWeeks;
    const totalDays = numWeeks * 7;
    const today = new Date();
    
    // 找到今天所在星期的周六
    const endOfWeek = new Date(today);
    const dayOfWeek = endOfWeek.getDay();
    endOfWeek.setDate(today.getDate() + (6 - dayOfWeek));

    const startDate = new Date(endOfWeek);
    startDate.setDate(endOfWeek.getDate() - totalDays + 1);

    const generatedWeeks: Array<Array<{
      dateStr: string;
      month: number;
      day: number;
      isToday: boolean;
      isFuture: boolean;
      log?: DailyActivityLog;
    }>> = [];

    const mLabels: Array<{ label: string; weekIndex: number }> = [];
    let lastMonth = -1;

    let cur = new Date(startDate);
    for (let w = 0; w < numWeeks; w++) {
      const weekDays: Array<{
        dateStr: string;
        month: number;
        day: number;
        isToday: boolean;
        isFuture: boolean;
        log?: DailyActivityLog;
      }> = [];

      for (let d = 0; d < 7; d++) {
        const y = cur.getFullYear();
        const m = cur.getMonth() + 1;
        const day = cur.getDate();
        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = cur.toDateString() === today.toDateString();
        const isFuture = cur.getTime() > today.getTime();

        const log = logMap.get(dateStr);

        if (d === 0 && m !== lastMonth) {
          mLabels.push({ label: `${m}月`, weekIndex: w });
          lastMonth = m;
        }

        weekDays.push({
          dateStr,
          month: m,
          day,
          isToday,
          isFuture,
          log
        });

        cur.setDate(cur.getDate() + 1);
      }
      generatedWeeks.push(weekDays);
    }

    return { weeks: generatedWeeks, monthLabels: mLabels };
  }, [logMap, viewWeeks]);

  const getColorLevel = (log?: DailyActivityLog, isFuture?: boolean) => {
    if (isFuture) return 'bg-transparent border-dashed border-black/[0.06] opacity-20 pointer-events-none';
    if (!log) return 'bg-black/[0.04] border border-black/[0.04] hover:bg-black/[0.08]';
    const activity = (log.totalCount || 0) + (log.reviewCount || 0);
    if (activity === 0) return 'bg-black/[0.04] border border-black/[0.04] hover:bg-black/[0.08]';
    if (activity < 10) return 'bg-emerald-200/90 border-emerald-300/80 hover:bg-emerald-300';
    if (activity < 25) return 'bg-emerald-400/90 border-emerald-500/80 hover:bg-emerald-500';
    if (activity < 45) return 'bg-emerald-600/90 border-emerald-700/80 hover:bg-emerald-700';
    return 'bg-[#0f766e] border-[#0d665f] hover:bg-[#115e59]';
  };

  return (
    <div className="bg-white border border-black/[0.08] rounded-xl shadow-none mb-5 overflow-hidden transition-all">
      {/* 默认折叠摘要行 */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-3.5 sm:px-4 sm:py-3 flex items-center justify-between cursor-pointer hover:bg-black/[0.02] transition-colors select-none"
      >
        <div className="flex items-center space-x-2.5 overflow-hidden">
          <div className="flex items-center space-x-1.5 shrink-0">
            <Flame className={`w-4 h-4 ${stats.currentStreak > 0 ? 'text-amber-600 fill-amber-600' : 'text-black/30'}`} />
            <span className="text-xs sm:text-sm font-semibold text-black/90">学习活跃度</span>
          </div>

          <div className="flex items-center space-x-2 text-xs text-black/60 truncate">
            <span className="hidden sm:inline text-black/20">|</span>
            <span className="bg-black/[0.04] px-2.5 py-0.5 rounded-full font-medium text-black/70">
              连续 <strong className="text-black/90 font-mono font-bold">{stats.currentStreak}</strong> 天
            </span>
            <span className="bg-black/[0.04] px-2.5 py-0.5 rounded-full font-medium text-black/70">
              累计刷题 <strong className="text-black/90 font-mono font-bold">{stats.totalQuestions}</strong> 道
            </span>
            <span className="bg-black/[0.04] px-2.5 py-0.5 rounded-full font-medium text-black/70 hidden sm:inline">
              闪卡复习 <strong className="text-black/90 font-mono font-bold">{stats.totalReviews}</strong> 次
            </span>
            {stats.todayDueCardsCount && stats.todayDueCardsCount > 0 ? (
              <span className="bg-purple-50 text-purple-700 border border-purple-200/60 px-2.5 py-0.5 rounded-full font-medium text-[11px]">
                待复习 <strong className="font-mono font-bold">{stats.todayDueCardsCount}</strong>
              </span>
            ) : (
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2.5 py-0.5 rounded-full font-medium text-[11px] hidden sm:inline-flex items-center">
                <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600 shrink-0" />
                <span>今日已完成</span>
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          className="flex items-center space-x-1 text-xs text-black/50 hover:text-black/80 font-medium shrink-0 ml-2"
        >
          <span>{isExpanded ? '收起' : '展开日历'}</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* 展开后的详细指标与日历热力图 */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 border-t border-black/[0.06] animate-in fade-in duration-150">
          {/* 4 个核心指标卡片：纯白极简发丝边框，去除彩色底衬，大号等宽数字 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3">
            {/* 连续打卡 */}
            <div className="bg-white border border-black/[0.08] rounded-xl p-3.5 flex flex-col justify-between">
              <div className="text-xs font-medium text-black/50">连续打卡</div>
              <div className="flex items-baseline space-x-1 mt-1.5">
                <span className="text-2xl font-bold tracking-tight text-black/90 font-mono">{stats.currentStreak}</span>
                <span className="text-xs font-normal text-black/50">天</span>
              </div>
              <div className="text-xs text-black/40 mt-1">最高 {stats.longestStreak} 天</div>
            </div>

            {/* 累计刷题 */}
            <div className="bg-white border border-black/[0.08] rounded-xl p-3.5 flex flex-col justify-between">
              <div className="text-xs font-medium text-black/50">总刷题量</div>
              <div className="flex items-baseline space-x-1 mt-1.5">
                <span className="text-2xl font-bold tracking-tight text-black/90 font-mono">{stats.totalQuestions}</span>
                <span className="text-xs font-normal text-black/50">道</span>
              </div>
              <div className="text-xs text-black/40 mt-1">正确率 {stats.overallAccuracyRate}%</div>
            </div>

            {/* 闪卡复习 */}
            <div className="bg-white border border-black/[0.08] rounded-xl p-3.5 flex flex-col justify-between">
              <div className="text-xs font-medium text-black/50">闪卡复习</div>
              <div className="flex items-baseline space-x-1 mt-1.5">
                <span className="text-2xl font-bold tracking-tight text-black/90 font-mono">{stats.totalReviews}</span>
                <span className="text-xs font-normal text-black/50">次</span>
              </div>
              <div className="text-xs text-black/40 mt-1 truncate">
                {stats.todayDueCardsCount && stats.todayDueCardsCount > 0 ? (
                  <span className="text-purple-700 font-medium">待复习 {stats.todayDueCardsCount} 张</span>
                ) : (
                  <span className="text-emerald-700 font-medium flex items-center">
                    <CheckCircle2 className="w-3 h-3 mr-0.5 inline shrink-0 text-emerald-600" />
                    <span>今日已全部完成</span>
                  </span>
                )}
              </div>
            </div>

            {/* 记忆留存 */}
            <div className="bg-white border border-black/[0.08] rounded-xl p-3.5 flex flex-col justify-between">
              <div className="text-xs font-medium text-black/50">预估留存率</div>
              <div className="flex items-baseline space-x-1 mt-1.5">
                <span className="text-2xl font-bold tracking-tight text-black/90 font-mono">{stats.retentionRate}</span>
                <span className="text-xs font-normal text-black/50">%</span>
              </div>
              <div className="text-xs text-black/40 mt-1 truncate">
                {stats.overdueCardsCount && stats.overdueCardsCount > 0 ? (
                  <span className="text-amber-700 font-medium">{stats.overdueCardsCount} 张待唤醒</span>
                ) : (
                  <span className="text-emerald-700 font-medium">记忆状态良好</span>
                )}
              </div>
            </div>
          </div>

          {/* 热力图控制与图表 */}
          <div className="mt-3.5 pt-3 border-t border-black/[0.06]">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center space-x-1.5 text-xs text-black/80 font-medium">
                <Calendar className="w-3.5 h-3.5 text-black/50" />
                <span>每日刷题活跃记录</span>
              </div>

              {/* 药丸分段控制器 (Segmented Control) */}
              <div className="flex items-center p-0.5 rounded-full bg-black/[0.04] border border-black/[0.06] text-xs">
                <button
                  type="button"
                  onClick={() => setViewWeeks(16)}
                  className={`px-2.5 py-0.5 rounded-full font-medium text-[11px] transition-all cursor-pointer ${
                    viewWeeks === 16 ? 'bg-white text-black/90 shadow-2xs' : 'text-black/50 hover:text-black/80'
                  }`}
                >
                  近16周
                </button>
                <button
                  type="button"
                  onClick={() => setViewWeeks(52)}
                  className={`px-2.5 py-0.5 rounded-full font-medium text-[11px] transition-all cursor-pointer ${
                    viewWeeks === 52 ? 'bg-white text-black/90 shadow-2xs' : 'text-black/50 hover:text-black/80'
                  }`}
                >
                  近52周
                </button>
              </div>
            </div>

            <div 
              ref={scrollRef}
              className="overflow-x-auto pb-2 pt-1 select-none"
            >
              <div className="flex flex-col w-full min-w-full">
                {/* 月份指示 */}
                <div className="flex text-[10px] text-black/40 font-mono mb-1.5 pl-6">
                  {monthLabels.map((m, idx) => (
                    <span
                      key={idx}
                      className="inline-block truncate"
                      style={{
                        width: `${(weeks.length / (monthLabels.length || 1)) * (viewWeeks === 16 ? 42 : 15)}px`,
                        minWidth: '28px'
                      }}
                    >
                      {m.label}
                    </span>
                  ))}
                </div>

                {/* 网格主体：拉伸撑满容器消除右倾空旷感 */}
                <div className="flex items-start w-full">
                  <div className="flex flex-col justify-between text-[9px] text-black/40 font-mono pr-2 h-[88px] py-[1px] shrink-0 select-none">
                    <span>日</span>
                    <span>二</span>
                    <span>四</span>
                    <span>六</span>
                  </div>

                  <div className={`flex w-full ${viewWeeks === 16 ? 'justify-between' : 'gap-1'}`}>
                    {weeks.map((week, wIdx) => (
                      <div key={wIdx} className="flex flex-col gap-1">
                        {week.map((day, dIdx) => {
                          const levelClass = getColorLevel(day.log, day.isFuture);
                          const totalQ = day.log?.totalCount || 0;
                          const revC = day.log?.reviewCount || 0;
                          const corrC = day.log?.correctCount || 0;
                          const acc = totalQ > 0 ? Math.round((corrC / totalQ) * 100) : 100;
                          const mins = Math.round((day.log?.timeSpentSeconds || 0) / 60);

                          return (
                            <div
                              key={dIdx}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoveredDay({
                                  date: day.dateStr,
                                  totalCount: totalQ,
                                  reviewCount: revC,
                                  correctCount: corrC,
                                  accuracy: acc,
                                  timeMinutes: mins,
                                  x: rect.left + rect.width / 2,
                                  y: rect.top
                                });
                              }}
                              onMouseLeave={() => setHoveredDay(null)}
                              className={`w-3 h-3 rounded-[2px] transition-all cursor-pointer ${levelClass} ${
                                day.isToday ? 'ring-1.5 ring-black ring-offset-1' : ''
                              }`}
                              title={`${day.dateStr}: 做题 ${totalQ} 道，复习 ${revC} 张卡片`}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 图例 */}
            <div className="flex items-center justify-between pt-2 border-t border-black/[0.06] text-[11px] text-black/40 mt-1">
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px]">少</span>
                <span className="w-2.5 h-2.5 rounded-[2px] bg-black/[0.04] border border-black/[0.06]"></span>
                <span className="w-2.5 h-2.5 rounded-[2px] bg-emerald-200/90 border border-emerald-300/80"></span>
                <span className="w-2.5 h-2.5 rounded-[2px] bg-emerald-400/90 border border-emerald-500/80"></span>
                <span className="w-2.5 h-2.5 rounded-[2px] bg-emerald-600/90 border border-emerald-700/80"></span>
                <span className="w-2.5 h-2.5 rounded-[2px] bg-[#0f766e] border border-[#0d665f]"></span>
                <span className="text-[10px]">多</span>
              </div>
              <div>悬停格子查看当日做题明细</div>
            </div>
          </div>
        </div>
      )}

      {/* Tooltip 浮层 */}
      {hoveredDay && (
        <div 
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full -mt-2 bg-stone-900 text-white text-xs px-3 py-2 rounded-xl shadow-xl border border-stone-800 space-y-1 animate-in fade-in duration-100 min-w-[200px]"
          style={{ left: hoveredDay.x, top: hoveredDay.y }}
        >
          <div className="font-mono text-amber-400 font-bold text-[11px] border-b border-stone-800 pb-0.5 flex justify-between items-center">
            <span>📅 {hoveredDay.date}</span>
            {hoveredDay.timeMinutes > 0 && (
              <span className="text-stone-400 font-normal">{hoveredDay.timeMinutes} 分钟</span>
            )}
          </div>
          <div className="text-stone-200 text-xs">
            {hoveredDay.totalCount === 0 && hoveredDay.reviewCount === 0 ? (
              <span className="text-stone-400">当天未打卡学习</span>
            ) : (
              <>
                <p>
                  完成 <strong className="text-emerald-400 font-bold">{hoveredDay.totalCount}</strong> 道题目，
                  复习 <strong className="text-purple-300 font-bold">{hoveredDay.reviewCount}</strong> 张闪卡
                </p>
                <div className="flex items-center justify-between text-[11px] text-stone-400 pt-0.5">
                  <span>正确率: <strong className="text-white">{hoveredDay.accuracy}%</strong></span>
                  <span>答对: <strong className="text-emerald-400">{hoveredDay.correctCount}</strong> 道</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
