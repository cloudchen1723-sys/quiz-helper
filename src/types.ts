export type QuestionType = 'single' | 'multiple' | 'judge' | 'blank' | 'definition' | 'essay';

export interface Question {
  id: number;
  type: QuestionType;
  question: string;
  options?: Record<string, string>; // 客观题为选项映射；填空/名词解释/论述题可为空
  answer: string | string[];        // 填空题为 string[]，其他题型为 string
  analysis?: string;
  
  // 章节与知识图谱维度（向下兼容，全部为可选）
  chapter?: string;      // 所属章节，例如："第三章 酶与辅酶"
  section?: string;      // 所属小节，例如："3.2 酶促反应动力学"
  tags?: string[];       // 细粒度标签，例如：["米氏常数", "核心公式", "高频真题"]
  keyPoints?: string[];  // 采分点关键词（专用于名词解释与简答论述题的踩分比对）
  clozeTemplate?: string;// 填空题挖空模板
}

export interface BankStats {
  total: number;
  single: number;
  multiple: number;
  judge: number;
  blank?: number;
  definition?: number;
  essay?: number;
  chaptersCount?: number;
  tagsCount?: number;
}

export interface BankMetadata {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  description?: string;
  tags?: string[];
  stats: BankStats;
}

export interface StoredBank {
  name: string;
  data: Question[];
  createdAt?: number;
  updatedAt?: number;
}

export interface WrongRecord {
  id: number;
  count: number;
  lastWrongAt: number;
  streakCorrect: number; // 连续答对次数，达到一定次数可移出
  type: QuestionType;
}

export type WrongBook = Record<number, WrongRecord>;

export type PracticeMode = 'test' | 'study'; // test: 测验自测; study: 速记背题

export type SessionFilterMode = 'all' | 'wrong' | 'range' | 'mock' | 'chapter' | 'due';

export type TrackMode = 'all' | 'objective' | 'flashcard';

export interface SessionConfig {
  filterMode: SessionFilterMode;
  trackMode?: TrackMode;
  practiceMode: PracticeMode;
  rangeStart: number;
  rangeEnd: number;
  mockConfig: {
    single: number;
    multiple: number;
    judge: number;
  };
  isShuffled: boolean;
  useTimer: boolean;
  autoNextOnCorrect: boolean; // 答对自动跳下一题
  autoNextDelay: number; // 自动跳延迟毫秒数 (e.g. 700ms)

  // 扩展过滤条件（可选）
  selectedChapter?: string; // 选定章节，'all' 表示全选
  selectedTag?: string;     // 选定标签，'all' 表示全选
  selectedType?: QuestionType | 'all'; // 选定题型，'all' 表示全部
}

export type QuestionResult = 'unanswered' | 'correct' | 'wrong';

export type MasteryStatus = 'mastered' | 'vague' | 'blindspot';

export interface QuestionCognitiveProfile {
  id: number;
  status: MasteryStatus;
  result: 'correct' | 'wrong';
  wrongHistoryCount: number;
}

export interface SessionSummary {
  bankName: string;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  accuracyRate: string;
  elapsedSeconds: number;
  wrongQuestionIds: number[];
  questionResults?: Record<number, 'correct' | 'wrong'>;
  questionRatings?: Record<number, AnkiRating>;
  practiceMode: PracticeMode;
  trackMode?: TrackMode;
}

export interface DailyActivityLog {
  date: string;             // "YYYY-MM-DD" 主键
  totalCount: number;       // 今日做题总数
  reviewCount: number;      // 今日复习卡片数
  correctCount: number;     // 答对数
  timeSpentSeconds: number; // 累计学习时长
}

export type AnkiRating = 'again' | 'hard' | 'good' | 'easy';

export interface AnkiCardState {
  cardId: string;           // `${bankName}_${questionId}`
  bankName: string;
  questionId: number;
  easeFactor: number;       // 默认 2.5
  interval: number;         // 复习间隔（天数）
  repetitions: number;      // 连续掌握次数
  dueDate: number;          // 下次复习时间戳
  lastReviewedAt: number;   // 上次复习时间戳
  status: 'new' | 'learning' | 'review' | 'mastered';
}

export interface DueCardSummary {
  bankName: string;
  totalDue: number;          // 今日待复习总数 (包含普通到期 + 超期)
  overdueCount: number;      // 超期未复习数量 (dueDate < 今天0点)
  dueTodayCount: number;     // 恰好今天到期的数量
  dueQuestionIds: number[];  // 推荐复习顺序排好的题目ID列表 (优先级：紧急超期 > 今日到期)

  // 客观题错题艾宾浩斯到期统计
  objectiveDueCount?: number;
  objectiveOverdueCount?: number;
  objectiveDueIds?: number[];

  // 闪卡今日艾宾浩斯到期统计
  flashcardDueCount?: number;
  flashcardOverdueCount?: number;
  flashcardDueIds?: number[];
}

