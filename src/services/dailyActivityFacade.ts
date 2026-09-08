import { dbManager } from '../db/indexedDB';
import { DailyActivityLog, AnkiCardState, AnkiRating, DueCardSummary } from '../types';

export interface ActivityDashboardStats {
  currentStreak: number;
  longestStreak: number;
  totalQuestions: number;
  totalReviews: number;
  totalTimeSpentSeconds: number;
  overallAccuracyRate: number;
  retentionRate: number; // 长时记忆转化率 (0~100)
  masteredCardsCount: number;
  todayDueCardsCount?: number;
  overdueCardsCount?: number;
}

export class DailyActivityFacade {
  private static instance: DailyActivityFacade;

  static getInstance(): DailyActivityFacade {
    if (!this.instance) {
      this.instance = new DailyActivityFacade();
    }
    return this.instance;
  }

  /**
   * 获取当地时区今天的 "YYYY-MM-DD"
   */
  getTodayString(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 门面模式：做题或复习卡片完成后，仅向 daily_logs 表 upsert 当天一条极简快照
   */
  async recordActivity(params: {
    questionsCount?: number;
    correctCount?: number;
    reviewCount?: number;
    timeSpentSeconds?: number;
  }): Promise<DailyActivityLog> {
    const today = this.getTodayString();
    let log = await dbManager.getDailyLog(today);

    const questionsDelta = params.questionsCount || 0;
    const correctDelta = params.correctCount || 0;
    const reviewDelta = params.reviewCount || 0;
    const timeDelta = Math.max(0, Math.round(params.timeSpentSeconds || 0));

    if (!log) {
      log = {
        date: today,
        totalCount: questionsDelta,
        correctCount: correctDelta,
        reviewCount: reviewDelta,
        timeSpentSeconds: timeDelta
      };
    } else {
      log.totalCount = (log.totalCount || 0) + questionsDelta;
      log.correctCount = (log.correctCount || 0) + correctDelta;
      log.reviewCount = (log.reviewCount || 0) + reviewDelta;
      log.timeSpentSeconds = (log.timeSpentSeconds || 0) + timeDelta;
    }

    await dbManager.upsertDailyLog(log);
    return log;
  }

  /**
   * 获取所有每日记录
   */
  async getAllLogs(): Promise<DailyActivityLog[]> {
    return await dbManager.getAllDailyLogs();
  }

  /**
   * 聚合计算连续打卡（Streak）、总量、长时记忆转化率等核心指标
   */
  async getDashboardStats(): Promise<ActivityDashboardStats> {
    const logs = await this.getAllLogs();
    const ankiCards = await dbManager.getAllAnkiCards();

    // 按日期降序排列
    const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
    const logMap = new Map<string, DailyActivityLog>();
    logs.forEach((l) => logMap.set(l.date, l));

    let totalQuestions = 0;
    let totalCorrect = 0;
    let totalReviews = 0;
    let totalTime = 0;

    logs.forEach((l) => {
      totalQuestions += l.totalCount || 0;
      totalCorrect += l.correctCount || 0;
      totalReviews += l.reviewCount || 0;
      totalTime += l.timeSpentSeconds || 0;
    });

    // 计算连续打卡天数 (Streak)
    const today = this.getTodayString();
    let currentStreak = 0;
    let checkDate = new Date();

    // 如果今天没打卡，从昨天开始算；如果今天已打卡，从今天开始算
    const todayLog = logMap.get(today);
    const todayActive = todayLog && (todayLog.totalCount > 0 || todayLog.reviewCount > 0);

    if (!todayActive) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const y = checkDate.getFullYear();
      const m = String(checkDate.getMonth() + 1).padStart(2, '0');
      const d = String(checkDate.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;

      const dayLog = logMap.get(dateStr);
      if (dayLog && (dayLog.totalCount > 0 || dayLog.reviewCount > 0)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // 计算历史最长连续天数
    let longestStreak = 0;
    let tempStreak = 0;
    const dateList = Array.from(logMap.keys()).sort();
    let lastDate: Date | null = null;

    for (const dStr of dateList) {
      const l = logMap.get(dStr);
      if (l && (l.totalCount > 0 || l.reviewCount > 0)) {
        const curD = new Date(dStr);
        if (lastDate) {
          const diffDays = Math.round((curD.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));
          if (diffDays === 1) {
            tempStreak++;
          } else {
            tempStreak = 1;
          }
        } else {
          tempStreak = 1;
        }
        lastDate = curD;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      }
    }
    if (currentStreak > longestStreak) longestStreak = currentStreak;

    // 正确率
    const overallAccuracyRate = totalQuestions > 0
      ? Math.round((totalCorrect / totalQuestions) * 100)
      : 0;

    // 聚合当前所有存续题库的实际闪卡与到期/超期状态，坚决排除已删除题库残留或客观题遗留
    const allBankNames = await dbManager.getAllBankNames();
    const bankNamesSet = new Set(allBankNames);
    const dueSummaries = await this.getAllBanksDueSummaries(allBankNames);

    let todayDueCardsCount = 0;
    let overdueCardsCount = 0;
    let totalFlashcardsCount = 0;
    let masteredCardsCount = 0;

    for (const bName of allBankNames) {
      const summary = dueSummaries[bName];
      if (summary) {
        todayDueCardsCount += summary.flashcardDueCount || 0;
        overdueCardsCount += summary.flashcardOverdueCount || 0;
      }

      const bank = await dbManager.getBank(bName);
      const questions = bank ? bank.data : [];
      const flashcards = questions.filter(
        (q) => q.type === 'blank' || q.type === 'definition' || q.type === 'essay'
      );
      totalFlashcardsCount += flashcards.length;

      const bankCards = await dbManager.getAllAnkiCards(bName);
      const cardMap = new Map(bankCards.map((c) => [c.questionId, c]));
      for (const fc of flashcards) {
        const c = cardMap.get(fc.id);
        if (c && (c.status === 'mastered' || c.repetitions >= 3)) {
          masteredCardsCount++;
        }
      }
    }

    // 过滤出有效存续题库的已复习卡片
    const activeAnkiCards = ankiCards.filter((c) => c.bankName && bankNamesSet.has(c.bankName));

    // 长时记忆转化率
    let retentionRate = 0;
    if (totalFlashcardsCount > 0) {
      retentionRate = Math.min(100, Math.round((masteredCardsCount / totalFlashcardsCount) * 100));
    } else if (activeAnkiCards.length > 0) {
      const mastered = activeAnkiCards.filter((c) => c.status === 'mastered' || c.repetitions >= 3);
      retentionRate = Math.round((mastered.length / activeAnkiCards.length) * 100);
    } else if (totalQuestions > 0) {
      retentionRate = overallAccuracyRate;
    }

    return {
      currentStreak,
      longestStreak: Math.max(longestStreak, currentStreak),
      totalQuestions,
      totalReviews,
      totalTimeSpentSeconds: totalTime,
      overallAccuracyRate,
      retentionRate,
      masteredCardsCount,
      todayDueCardsCount,
      overdueCardsCount
    };
  }

  /**
   * SM-2 间隔重复算法调度计算（融入艾宾浩斯临界与超期自适应机制）
   */
  processAnkiRating(card: AnkiCardState, rating: AnkiRating): AnkiCardState {
    let { easeFactor, interval, repetitions, dueDate, lastReviewedAt } = card;
    easeFactor = easeFactor || 2.5;
    interval = interval || 0;
    repetitions = repetitions || 0;

    const now = Date.now();
    const oneDayMs = 24 * 3600 * 1000;

    // 超期时间分析
    const isOverdue = dueDate > 0 && now > dueDate;
    const overdueDays = isOverdue ? Math.floor((now - dueDate) / oneDayMs) : 0;
    const actualElapsedDays = lastReviewedAt > 0
      ? Math.max(1, Math.floor((now - lastReviewedAt) / oneDayMs))
      : interval;

    let nextInterval = 1;
    let nextStatus: 'learning' | 'review' | 'mastered' = 'learning';

    switch (rating) {
      case 'again': // 生疏 / 遗忘：
        // 无论此前掌握度多高或超期了多久，既然已发生遗忘，彻底重置连续掌握次数，立即于 1 天内重新巩固
        repetitions = 0;
        nextInterval = 1;
        easeFactor = Math.max(1.3, easeFactor - 0.2);
        nextStatus = 'learning';
        break;

      case 'hard': // 困难 / 模糊：
        // 提取费力。若严重超期（超过2天），不盲目拉长间隔，给予极度谨慎的 1~2 天快速再强化
        repetitions += 1;
        if (overdueDays >= 2) {
          nextInterval = Math.max(1, Math.min(Math.round(interval * 1.1) || 1, 2));
        } else {
          nextInterval = Math.max(1, Math.round(interval * 1.2) || 1);
        }
        easeFactor = Math.max(1.3, easeFactor - 0.15);
        nextStatus = 'review';
        break;

      case 'good': // 掌握 / 熟练：
        if (repetitions === 0) {
          nextInterval = 1;
        } else if (repetitions === 1) {
          nextInterval = 3;
        } else {
          // 超期奖励机制：若严重超期（超过2天），但用户依然能自评熟练，
          // 说明真实记忆强度超过原先预估，以实际流逝天数的一定比例作为加成基数，防止反复在短间隔打转
          if (isOverdue && overdueDays >= 2 && actualElapsedDays > interval) {
            const effectiveBase = Math.min(actualElapsedDays, Math.round(interval * 1.5));
            nextInterval = Math.round(effectiveBase * easeFactor);
          } else {
            nextInterval = Math.round(interval * easeFactor);
          }
        }
        repetitions += 1;
        nextStatus = repetitions >= 3 && nextInterval >= 7 ? 'mastered' : 'review';
        break;

      case 'easy': // 秒杀：
        if (repetitions === 0) {
          nextInterval = 4;
        } else if (repetitions === 1) {
          nextInterval = 7;
        } else {
          const effectiveBase = (isOverdue && overdueDays >= 2 && actualElapsedDays > interval)
            ? Math.min(actualElapsedDays, Math.round(interval * 1.8))
            : interval;
          nextInterval = Math.round(effectiveBase * easeFactor * 1.3);
        }
        repetitions += 1;
        easeFactor = Math.min(3.0, easeFactor + 0.15);
        nextStatus = 'mastered';
        break;
    }

    return {
      ...card,
      easeFactor,
      interval: nextInterval,
      repetitions,
      dueDate: now + nextInterval * oneDayMs,
      lastReviewedAt: now,
      status: nextStatus
    };
  }

  /**
   * 记录单张卡片的 Anki 复习结果并同步写入每日快照
   */
  async recordCardReview(bankName: string, questionId: number, rating: AnkiRating): Promise<AnkiCardState> {
    const cardId = `${bankName}_${questionId}`;
    let card = await dbManager.getAnkiCard(cardId);
    if (!card) {
      card = {
        cardId,
        bankName,
        questionId,
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        dueDate: Date.now(),
        lastReviewedAt: Date.now(),
        status: 'new'
      };
    }

    const updatedCard = this.processAnkiRating(card, rating);
    await dbManager.saveAnkiCard(updatedCard);

    // 同步写入今日日志
    const isCorrect = rating === 'good' || rating === 'easy';
    await this.recordActivity({
      reviewCount: 1,
      correctCount: isCorrect ? 1 : 0,
      timeSpentSeconds: 15
    });

    return updatedCard;
  }

  /**
   * 计算指定题库的 SM-2 到期与超期复习摘要（分别统计客观题错题到期与闪卡今日到期）
   */
  async getBankDueSummary(bankName: string): Promise<DueCardSummary> {
    const cards = await dbManager.getAllAnkiCards(bankName);
    const bank = await dbManager.getBank(bankName);
    const wrongBook = (await dbManager.getWrongBook(bankName)) || {};
    const questions = bank ? bank.data : [];

    const cardMap = new Map<number, AnkiCardState>();
    cards.forEach(c => cardMap.set(c.questionId, c));

    const now = Date.now();
    const oneDayMs = 24 * 3600 * 1000;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodayMs = startOfToday.getTime();

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const endOfTodayMs = endOfToday.getTime();

    // 闪卡专属容器：将生疏巩固与今日到期融合为单一认知复习流
    const flashcardUnfamiliar: Array<{ qId: number; dueDate: number }> = [];
    const flashcardOverdue: Array<{ qId: number; urgency: number; dueDate: number }> = [];
    const flashcardToday: Array<{ qId: number; dueDate: number }> = [];

    for (const q of questions) {
      const isFlashcard = q.type === 'blank' || q.type === 'definition' || q.type === 'essay';
      if (!isFlashcard) continue;

      const card = cardMap.get(q.id);
      const wrongRec = wrongBook[q.id];
      const isUnfamiliar = !!wrongRec;

      if (card) {
        if (card.dueDate && card.dueDate <= endOfTodayMs) {
          if (card.dueDate < startOfTodayMs) {
            const aElapsed = card.lastReviewedAt ? now - card.lastReviewedAt : now - card.dueDate;
            const urgency = aElapsed / Math.max(1, (card.interval || 1) * oneDayMs);
            flashcardOverdue.push({ qId: q.id, urgency, dueDate: card.dueDate });
          } else {
            flashcardToday.push({ qId: q.id, dueDate: card.dueDate });
          }
        } else if (isUnfamiliar) {
          // 在错题/生疏本中，优先纳入今日生疏巩固队列
          flashcardUnfamiliar.push({ qId: q.id, dueDate: card.dueDate });
        }
      } else if (isUnfamiliar) {
        // 未建卡但记录为生疏的闪卡，优先纳入巩固
        flashcardUnfamiliar.push({ qId: q.id, dueDate: now });
      }
    }

    // 智能排序：生疏待巩固优先 > 严重超期按遗忘紧急度降序 > 今日到期按时间升序
    flashcardOverdue.sort((a, b) => b.urgency - a.urgency);
    flashcardToday.sort((a, b) => a.dueDate - b.dueDate);

    const orderedIds = Array.from(new Set([
      ...flashcardUnfamiliar.map(u => u.qId),
      ...flashcardOverdue.map(f => f.qId),
      ...flashcardToday.map(t => t.qId)
    ]));

    const totalDue = orderedIds.length;
    const overdueCount = flashcardOverdue.length;
    const dueTodayCount = flashcardToday.length + flashcardUnfamiliar.length;

    return {
      bankName,
      totalDue,
      overdueCount,
      dueTodayCount,
      dueQuestionIds: orderedIds,
      objectiveDueCount: 0,
      objectiveOverdueCount: 0,
      objectiveDueIds: [],
      flashcardDueCount: totalDue,
      flashcardOverdueCount: overdueCount,
      flashcardDueIds: orderedIds
    };
  }

  /**
   * 批量获取所有题库的 SM-2 到期与超期复习摘要
   */
  async getAllBanksDueSummaries(bankNames: string[]): Promise<Record<string, DueCardSummary>> {
    const result: Record<string, DueCardSummary> = {};
    for (const bName of bankNames) {
      result[bName] = await this.getBankDueSummary(bName);
    }
    return result;
  }
}

export const dailyActivityFacade = DailyActivityFacade.getInstance();
