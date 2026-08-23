export type QuestionType = 'single' | 'multiple' | 'judge';

export interface Question {
  id: number;
  type: QuestionType;
  question: string;
  options: Record<string, string>;
  answer: string;
  analysis?: string;
  tags?: string[];
}

export interface BankStats {
  total: number;
  single: number;
  multiple: number;
  judge: number;
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

export type SessionFilterMode = 'all' | 'wrong' | 'range' | 'mock';

export interface SessionConfig {
  filterMode: SessionFilterMode;
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
  practiceMode: PracticeMode;
}
