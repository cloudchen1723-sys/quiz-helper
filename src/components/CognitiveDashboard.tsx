import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Flame, 
  CheckCircle2, 
  Layers, 
  ChevronDown, 
  Brain,
  Calendar
} from 'lucide-react';
import { dailyActivityFacade, ActivityDashboardStats } from '../services/dailyActivityFacade';
import { DailyActivityLog } from '../types';

interface CognitiveDashboardProps {
  onStartAnkiQuickReview?: () => void;
  refreshTrigger?: number;
  onOpenDataManagement?: () => void;
}

export const CognitiveDashboard: React.FC<CognitiveDashboardProps> = ({ 
  refreshTrigger
}) => {
  // 看板折叠/展开状态，默认展开以便直观查看
  const [isExpanded, setIsExpanded] = useState(true);

  const [stats, setStats] = useState<ActivityDashboardStats>({
    currentStreak: 0,
    longestStreak: 0,
    totalQuestions: 0,
    totalReviews: 0,
    totalTimeSpentSeconds: 0,
    overallAccuracyRate: 0,
    retentionRate: 0,
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

  const yearScrollRef = useRef<HTMLDivElement>(null);

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

  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  // 年视图 (近 52 周) 热力图网格数据与月份标签段
  const { yearHeatmapData, yearMonthSegments } = useMemo(() => {
    const weeksCount = 52;
    const now = new Date();
    
    // 计算当前周的周日 (本周结束)
    const currentDayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday
    const daysToSunday = currentDayOfWeek === 0 ? 0 : 7 - currentDayOfWeek;
    const endSunday = new Date(now);
    endSunday.setDate(now.getDate() + daysToSunday);

    // 计算起始周一 (52 周前)
    const startMonday = new Date(endSunday);
    startMonday.setDate(endSunday.getDate() - (weeksCount * 7 - 1));

    const cur = new Date(startMonday);
    const rawWeeks: Array<{
      wIdx: number;
      primaryMonth: number;
      days: Array<{
        dateStr: string;
        dayOfWeek: number;
        dayNumber: number;
        month: number;
        year: number;
        isToday: boolean;
        isFuture: boolean;
        log?: DailyActivityLog;
      }>;
    }> = [];

    for (let w = 0; w < weeksCount; w++) {
      const weekDays = [];
      const monthCounts: Record<number, number> = {};

      for (let d = 0; d < 7; d++) {
        const y = cur.getFullYear();
        const m = cur.getMonth();
        const day = cur.getDate();
        const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;
        const isFuture = dateStr > todayStr;
        const log = logMap.get(dateStr);

        monthCounts[m + 1] = (monthCounts[m + 1] || 0) + 1;

        weekDays.push({
          dateStr,
          dayOfWeek: d, // 0: 周一, ... 6: 周日
          dayNumber: day,
          month: m,
          year: y,
          isToday,
          isFuture,
          log
        });

        cur.setDate(cur.getDate() + 1);
      }

      // 该周主要所属月份 (按该周内占多数的天数判定，遵循 ISO 8601 标准)
      let primaryMonth = weekDays[0].month + 1;
      let maxCount = 0;
      for (const [mStr, count] of Object.entries(monthCounts)) {
        if (count > maxCount) {
          maxCount = count;
          primaryMonth = Number(mStr);
        }
      }

      rawWeeks.push({
        wIdx: w,
        primaryMonth,
        days: weekDays
      });
    }

    // 计算月份区段 (与周列宽度严格 1:1 对齐)
    const segments: Array<{
      month: number;
      startWeek: number;
      endWeek: number;
      weekCount: number;
    }> = [];

    rawWeeks.forEach((rw) => {
      const lastSeg = segments[segments.length - 1];
      if (!lastSeg || lastSeg.month !== rw.primaryMonth) {
        segments.push({
          month: rw.primaryMonth,
          startWeek: rw.wIdx,
          endWeek: rw.wIdx,
          weekCount: 1
        });
      } else {
        lastSeg.endWeek = rw.wIdx;
        lastSeg.weekCount += 1;
      }
    });

    return {
      yearHeatmapData: rawWeeks,
      yearMonthSegments: segments
    };
  }, [logMap, todayStr]);

  // 近 52 周活跃天数统计
  const yearActiveDaysCount = useMemo(() => {
    let count = 0;
    yearHeatmapData.forEach(w => {
      w.days.forEach(d => {
        const total = (d.log?.totalCount || 0) + (d.log?.reviewCount || 0);
        if (total > 0) count++;
      });
    });
    return count;
  }, [yearHeatmapData]);

  // 本月学习与打卡数据统计
  const currentMonthStats = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed
    const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

    let activeDays = 0;
    let totalQuestions = 0;
    let reviewCount = 0;

    logs.forEach((log) => {
      if (log.date.startsWith(prefix)) {
        const total = (log.totalCount || 0) + (log.reviewCount || 0);
        if (total > 0) {
          activeDays++;
          totalQuestions += (log.totalCount || 0);
          reviewCount += (log.reviewCount || 0);
        }
      }
    });

    return {
      month: currentMonth + 1,
      activeDays,
      totalQuestions,
      reviewCount
    };
  }, [logs]);

  // 展开看板时自动平滑滚动到最右侧 (当周)
  useEffect(() => {
    if (isExpanded && yearScrollRef.current) {
      yearScrollRef.current.scrollLeft = yearScrollRef.current.scrollWidth;
    }
  }, [isExpanded]);

  // Things 3 Signal Blue 极简微阶梯色彩
  const getCellColor = (log?: DailyActivityLog, isFuture?: boolean) => {
    if (isFuture) return '#f2f5f7';
    if (!log) return '#ebf0f4';
    const total = (log.totalCount || 0) + (log.reviewCount || 0);
    if (total === 0) return '#ebf0f4';
    if (total < 10) return '#d0e1fd';
    if (total < 25) return '#9ec3fb';
    if (total < 45) return '#5b9cf9';
    return '#2576eb';
  };

  const handleCellHover = (e: React.MouseEvent<HTMLElement>, dateStr: string, log?: DailyActivityLog) => {
    const totalQ = log?.totalCount || 0;
    const revC = log?.reviewCount || 0;
    const corrC = log?.correctCount || 0;
    const acc = totalQ > 0 ? Math.round((corrC / totalQ) * 100) : 100;
    const mins = Math.round((log?.timeSpentSeconds || 0) / 60);
    const rect = e.currentTarget.getBoundingClientRect();

    setHoveredDay({
      date: dateStr,
      totalCount: totalQ,
      reviewCount: revC,
      correctCount: corrC,
      accuracy: acc,
      timeMinutes: mins,
      x: Math.max(105, Math.min(window.innerWidth - 105, rect.left + rect.width / 2)),
      y: rect.top
    });
  };

  return (
    <section className="things-card overflow-hidden transition-all">
      {/* 顶部单行微摘要行 (Things 3 签名样式，点击平滑折叠/展开，移动端紧凑高度保证首屏题库露出) */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-3.5 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between cursor-pointer hover:bg-stone-50/60 transition-colors select-none"
      >
        <div className="flex items-center flex-wrap sm:flex-nowrap gap-x-2 gap-y-0.5 text-[11px] sm:text-[13px] font-medium text-[#303336] min-w-0">
          <div className="flex items-center space-x-1 shrink-0">
            <span className="text-amber-500 text-[12px] sm:text-[13px]">🔥</span>
            <span>连续 <strong className="font-semibold text-black">{stats.currentStreak}</strong>天</span>
          </div>
          <span className="text-[#dfe3e8] shrink-0">·</span>
          <div className="flex items-center space-x-0.5 shrink-0 text-[#838b96]">
            <span>刷题 <strong className="font-medium text-[#303336]">{stats.totalQuestions}</strong>道</span>
          </div>
          <span className="text-[#dfe3e8] shrink-0">·</span>
          <div className="flex items-center space-x-0.5 shrink-0 text-[#838b96]">
            <span>闪卡 <strong className="font-medium text-[#303336]">{stats.totalReviews}</strong>次</span>
          </div>
          <span className="text-[#dfe3e8] shrink-0">·</span>
          <div className="flex items-center space-x-0.5 shrink-0 text-[#838b96]">
            <span>留存 <strong className="font-medium text-[#303336]">{stats.retentionRate}%</strong></span>
          </div>
        </div>

        <div className="flex items-center space-x-1 text-[11px] sm:text-[12px] text-[#838b96] shrink-0 ml-2">
          <span>{isExpanded ? '收起' : '展开'}</span>
          <ChevronDown 
            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
          />
        </div>
      </div>

      {/* 展开态：Things 3 规范 Bento 网格 (电脑端左侧指标、右侧热力日历，手机端上下紧凑排布) */}
      {isExpanded && (
        <div className="border-t border-[#dfe3e8] p-2.5 sm:p-4 bg-white animate-in fade-in duration-150">
          <div className="flex flex-col md:flex-row gap-2.5 sm:gap-3 items-stretch">
            
            {/* 左侧 4 项核心数据指标 (手机端 2x2 紧凑排布，桌面端作为左侧数据栏固定宽度) */}
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2 md:w-[260px] lg:w-[290px] shrink-0">
              {/* 1. 连续打卡 */}
              <div className="bg-[#f8fafc] border border-[#dfe3e8]/70 rounded-lg sm:rounded-xl p-2 sm:p-2.5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-[11px] text-[#838b96] font-normal">连续打卡</span>
                  <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" />
                </div>
                <div className="mt-0.5 sm:mt-1 flex items-baseline space-x-1">
                  <span className="text-[15px] sm:text-[18px] font-bold text-[#303336] leading-none tracking-tight">
                    {stats.currentStreak}
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-[#838b96]">天</span>
                </div>
                <span className="text-[9px] sm:text-[10px] text-[#838b96] mt-0.5 truncate">
                  历史最佳 {stats.longestStreak} 天
                </span>
              </div>

              {/* 2. 总做题量 */}
              <div className="bg-[#f8fafc] border border-[#dfe3e8]/70 rounded-lg sm:rounded-xl p-2 sm:p-2.5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-[11px] text-[#838b96] font-normal">总刷题量</span>
                  <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-500" />
                </div>
                <div className="mt-0.5 sm:mt-1 flex items-baseline space-x-1">
                  <span className="text-[15px] sm:text-[18px] font-bold text-[#303336] leading-none tracking-tight">
                    {stats.totalQuestions}
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-[#838b96]">道</span>
                </div>
                <span className="text-[9px] sm:text-[10px] text-[#838b96] mt-0.5 truncate">
                  综合正确率 {stats.overallAccuracyRate}%
                </span>
              </div>

              {/* 3. 闪卡复习 */}
              <div className="bg-[#f8fafc] border border-[#dfe3e8]/70 rounded-lg sm:rounded-xl p-2 sm:p-2.5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-[11px] text-[#838b96] font-normal">闪卡复习</span>
                  <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-500" />
                </div>
                <div className="mt-0.5 sm:mt-1 flex items-baseline space-x-1">
                  <span className="text-[15px] sm:text-[18px] font-bold text-[#303336] leading-none tracking-tight">
                    {stats.totalReviews}
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-[#838b96]">次</span>
                </div>
                <span className="text-[9px] sm:text-[10px] mt-0.5 truncate">
                  {stats.todayDueCardsCount && stats.todayDueCardsCount > 0 ? (
                    <span className="text-purple-600 font-medium">待复习 {stats.todayDueCardsCount} 张</span>
                  ) : (
                    <span className="text-emerald-600 font-medium">今日已复习完毕</span>
                  )}
                </span>
              </div>

              {/* 4. 留存率 */}
              <div className="bg-[#f8fafc] border border-[#dfe3e8]/70 rounded-lg sm:rounded-xl p-2 sm:p-2.5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-[11px] text-[#838b96] font-normal">预估留存率</span>
                  <Brain className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-500" />
                </div>
                <div className="mt-0.5 sm:mt-1 flex items-baseline space-x-1">
                  <span className="text-[15px] sm:text-[18px] font-bold text-[#303336] leading-none tracking-tight">
                    {stats.retentionRate}
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-[#838b96]">%</span>
                </div>
                <span className="text-[9px] sm:text-[10px] mt-0.5 truncate">
                  {stats.overdueCardsCount && stats.overdueCardsCount > 0 ? (
                    <span className="text-amber-600 font-medium">{stats.overdueCardsCount} 张待强化</span>
                  ) : (
                    <span className="text-emerald-600 font-medium">记忆稳固</span>
                  )}
                </span>
              </div>
            </div>

            {/* 右侧：精简热力日历打卡看板 (占据桌面端右侧所有自适应空间) */}
            <div className="flex-1 min-w-0 w-full bg-[#f8fafc] border border-[#dfe3e8]/70 rounded-lg sm:rounded-xl p-2.5 sm:p-3.5 flex flex-col justify-between">
              
              {/* 顶部栏：年度学习动态与统计 */}
              <div className="flex items-center justify-between pb-2 sm:pb-2.5 border-b border-[#dfe3e8]/70">
                <div className="flex items-center space-x-1.5 text-[11px] sm:text-[12px]">
                  <div className="flex items-center space-x-1 font-bold text-[#303336] text-[12px] sm:text-[13px] tracking-tight">
                    <Calendar className="w-3.5 h-3.5 text-[#2576eb]" />
                    <span>年度学习动态</span>
                  </div>
                  <span className="hidden sm:inline-block text-[#838b96] text-[10px] sm:text-[11px]">
                    · 近 52 周共活跃 <strong className="text-[#303336] font-semibold">{yearActiveDaysCount}</strong> 天
                  </span>
                </div>
                <div className="text-[10px] sm:text-[11px] font-medium text-[#838b96]">
                  全景热力图
                </div>
              </div>

              {/* 中间热力内容区域：GitHub 52 周经典全景热力图 */}
              <div className="py-2.5 flex justify-center w-full">
                <div 
                  ref={yearScrollRef}
                  className="overflow-x-auto slim-scrollbar max-w-full pb-2"
                >
                  <div className="flex items-start gap-1.5 w-max mx-auto">
                    {/* 星期标签列：与下方 7 行方格及顶层月份严格对齐 */}
                    <div className="flex flex-col gap-[3px] select-none shrink-0 text-[9px] text-[#838b96] leading-[11px] pt-5">
                      <span className="h-[11px] flex items-center justify-center">一</span>
                      <span className="h-[11px]" />
                      <span className="h-[11px] flex items-center justify-center">三</span>
                      <span className="h-[11px]" />
                      <span className="h-[11px] flex items-center justify-center">五</span>
                      <span className="h-[11px]" />
                      <span className="h-[11px] flex items-center justify-center">日</span>
                    </div>

                    {/* 右侧：月份顶标 + 52 列方格 */}
                    <div className="flex flex-col gap-1">
                      {/* 月份顶标行：每个月份区间根据其所属周数严格计算像素跨度，月份文字居中对齐 */}
                      <div className="flex gap-[3px] h-4 select-none text-[10px] text-[#838b96]">
                        {yearMonthSegments.map((seg, sIdx) => (
                          <div
                            key={sIdx}
                            style={{
                              width: `${seg.weekCount * 11 + (seg.weekCount - 1) * 3}px`
                            }}
                            className="shrink-0 flex items-center justify-center text-[10px] font-medium text-[#55606e] overflow-visible whitespace-nowrap"
                          >
                            {seg.weekCount >= 2 ? `${seg.month}月` : ''}
                          </div>
                        ))}
                      </div>

                      {/* 52 列周网格 */}
                      <div className="flex gap-[3px]">
                        {yearHeatmapData.map((week) => (
                          <div key={week.wIdx} className="flex flex-col gap-[3px] shrink-0 w-[11px]">
                            {week.days.map((day, dIdx) => {
                              const cellColor = getCellColor(day.log, day.isFuture);
                              const isCurrent = day.isToday;

                              return (
                                <div
                                  key={dIdx}
                                  onMouseEnter={(e) => handleCellHover(e, day.dateStr, day.log)}
                                  onMouseLeave={() => setHoveredDay(null)}
                                  style={{ backgroundColor: cellColor }}
                                  className={`heat-cell cursor-pointer ${
                                    isCurrent ? 'ring-1.5 ring-[#2576eb] ring-offset-1 z-10' : ''
                                  } ${day.isFuture ? 'opacity-30 cursor-default' : ''}`}
                                />
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 热力图底部信息栏：统计与图例指示 */}
              <div className="flex items-center justify-between pt-2 sm:pt-2.5 border-t border-[#dfe3e8]/60 text-[10px] sm:text-[11px] text-[#838b96]">
                <div className="flex items-center space-x-1 sm:space-x-1.5 truncate pr-1 sm:pr-2">
                  <span>本月打卡 <strong className="text-[#303336] font-medium">{currentMonthStats.activeDays}</strong> 天</span>
                  <span>·</span>
                  <span>做题 <strong className="text-[#303336] font-medium">{currentMonthStats.totalQuestions}</strong> 道</span>
                  {currentMonthStats.reviewCount > 0 && (
                    <>
                      <span>·</span>
                      <span>闪卡 <strong className="text-[#303336] font-medium">{currentMonthStats.reviewCount}</strong> 次</span>
                    </>
                  )}
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  <span>少</span>
                  <div className="w-2.5 h-2.5 rounded-[2px] bg-[#ebf0f4]"></div>
                  <div className="w-2.5 h-2.5 rounded-[2px] bg-[#d0e1fd]"></div>
                  <div className="w-2.5 h-2.5 rounded-[2px] bg-[#9ec3fb]"></div>
                  <div className="w-2.5 h-2.5 rounded-[2px] bg-[#5b9cf9]"></div>
                  <div className="w-2.5 h-2.5 rounded-[2px] bg-[#2576eb]"></div>
                  <span>多</span>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Things 3 悬浮 Tooltip */}
      {hoveredDay && (
        <div 
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full -mt-2 bg-[#303336] text-white text-[12px] px-3 py-2 rounded-xl shadow-xl border border-[#444a50] space-y-1 animate-in fade-in duration-100 min-w-[190px]"
          style={{ left: hoveredDay.x, top: hoveredDay.y }}
        >
          <div className="font-mono text-blue-300 font-bold text-[11px] border-b border-stone-600/60 pb-1 flex justify-between items-center">
            <span>📅 {hoveredDay.date}</span>
            {hoveredDay.timeMinutes > 0 && (
              <span className="text-stone-300 font-normal">{hoveredDay.timeMinutes} 分钟</span>
            )}
          </div>
          <div className="text-stone-200 text-[12px] leading-relaxed">
            {hoveredDay.totalCount === 0 && hoveredDay.reviewCount === 0 ? (
              <span className="text-stone-400">当天未打卡学习</span>
            ) : (
              <>
                <p>
                  完成 <strong className="text-emerald-400 font-semibold">{hoveredDay.totalCount}</strong> 道题目，
                  复习 <strong className="text-blue-300 font-semibold">{hoveredDay.reviewCount}</strong> 张闪卡
                </p>
                <div className="flex items-center justify-between text-[11px] text-stone-300 pt-0.5">
                  <span>正确率: <strong className="text-white">{hoveredDay.accuracy}%</strong></span>
                  <span>答对: <strong className="text-emerald-400">{hoveredDay.correctCount}</strong> 道</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
