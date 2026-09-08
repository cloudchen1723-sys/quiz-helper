import { Question, QuestionType, BankStats } from '../types';

export interface ParseResult {
  success: boolean;
  questions: Question[];
  format: 'json' | 'text' | 'unknown';
  error?: string;
  warning?: string;
}

/**
 * 智能计算题库的完整多维统计指标
 */
export function calculateQuestionBankStats(questions: Question[]): BankStats {
  const stats: BankStats = {
    total: questions.length,
    single: 0,
    multiple: 0,
    judge: 0,
    blank: 0,
    definition: 0,
    essay: 0,
    chaptersCount: 0,
    tagsCount: 0
  };

  const chaptersSet = new Set<string>();
  const tagsSet = new Set<string>();

  for (const q of questions) {
    if (q.type === 'single') stats.single++;
    else if (q.type === 'multiple') stats.multiple++;
    else if (q.type === 'judge') stats.judge++;
    else if (q.type === 'blank') stats.blank = (stats.blank || 0) + 1;
    else if (q.type === 'definition') stats.definition = (stats.definition || 0) + 1;
    else if (q.type === 'essay') stats.essay = (stats.essay || 0) + 1;
    else stats.single++; // 兜底

    if (q.chapter && q.chapter.trim()) {
      chaptersSet.add(q.chapter.trim());
    }
    if (Array.isArray(q.tags)) {
      q.tags.forEach((t) => {
        if (t && t.trim()) tagsSet.add(t.trim());
      });
    }
  }

  stats.chaptersCount = chaptersSet.size;
  stats.tagsCount = tagsSet.size;
  return stats;
}

/**
 * 智能规范化题型名称（支持中文别名与英文缩写）
 */
function normalizeQuestionType(rawType: unknown, item: Record<string, any>): QuestionType {
  const typeStr = String(rawType || '').trim().toLowerCase();

  if (['single', '单选', '单选题', 'radio'].includes(typeStr)) return 'single';
  if (['multiple', '多选', '多选题', 'checkbox'].includes(typeStr)) return 'multiple';
  if (['judge', '判断', '判断题', 'tf', 'truefalse', 'boolean'].includes(typeStr)) return 'judge';
  if (['blank', '填空', '填空题', 'fill', 'cloze'].includes(typeStr)) return 'blank';
  if (['definition', '名词解释', '名词', 'def', 'concept'].includes(typeStr)) return 'definition';
  if (['essay', '论述', '论述题', '简答', '简答题', 'qa', 'short'].includes(typeStr)) return 'essay';

  // 若无显式 type，根据 options、题干或答案特征智能推断
  const rawAnswer = String(item.answer || '').trim();
  const hasOptions = item.options && typeof item.options === 'object' && Object.keys(item.options).length > 0;

  if (hasOptions) {
    if (item.options['正确'] || item.options['A'] === '正确' || item.options['A'] === '对') {
      return 'judge';
    }
    const upperAns = rawAnswer.toUpperCase();
    if (upperAns.length > 1 && !['对', '错', '正确', '错误'].includes(upperAns) && /^[A-G]+$/.test(upperAns)) {
      return 'multiple';
    }
    return 'single';
  }

  // 没有 options 的情况
  if (Array.isArray(item.answer) || (item.question && item.question.includes('____')) || item.clozeTemplate) {
    return 'blank';
  }
  if (item.keyPoints && Array.isArray(item.keyPoints) && item.keyPoints.length > 0) {
    return (rawAnswer.length > 120 || (item.question && item.question.length > 40)) ? 'essay' : 'definition';
  }
  if (rawAnswer.length > 80 || (item.question && (item.question.includes('简述') || item.question.includes('论述')))) {
    return 'essay';
  }

  return 'definition';
}

/**
 * 智能清洗并解析 JSON 题库（全面支持章节、标签、采分点及多题型向下兼容）
 */
export function tryParseJSON(rawText: string): ParseResult {
  try {
    let clean = rawText.trim();
    // 移除 markdown 代码块包裹
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
    }

    const parsed = JSON.parse(clean);
    const list = Array.isArray(parsed) ? parsed : (parsed.questions || parsed.data || [parsed]);

    if (!Array.isArray(list) || list.length === 0) {
      return { success: false, questions: [], format: 'json', error: 'JSON 必须是包含题目对象的数组。' };
    }

    const validatedQuestions: Question[] = [];
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (!item || typeof item !== 'object') continue;

      const qText = String(item.question || item.title || item.prompt || '').trim();
      if (!qText) continue;

      // 智能推断题型
      const type: QuestionType = normalizeQuestionType(item.type, item);

      // 规范 options
      let options: Record<string, string> = {};
      if (Array.isArray(item.options)) {
        item.options.forEach((opt: any, idx: number) => {
          const optStr = String(opt !== undefined && opt !== null ? opt : '').trim();
          const match = optStr.match(/^([A-G])[\.、:：\s]+(.*)$/i);
          if (match) {
            options[match[1].toUpperCase()] = match[2].trim();
          } else {
            const letter = String.fromCharCode(65 + idx);
            options[letter] = optStr;
          }
        });
      } else if (item.options && typeof item.options === 'object') {
        options = { ...item.options };
      } else if (type === 'judge') {
        options = { A: '正确', B: '错误' };
      }

      // 规范答案
      let answer: string | string[] = '';
      if (type === 'blank' && Array.isArray(item.answer)) {
        answer = item.answer.map((a: any) => String(a).trim());
      } else {
        const rawAns = String(item.answer !== undefined ? item.answer : '').trim();
        if (type === 'judge') {
          const upper = rawAns.toUpperCase();
          if (['对', 'T', 'TRUE', '正确', '1', 'A'].includes(upper)) {
            answer = 'A';
          } else if (['错', 'F', 'FALSE', '错误', '0', 'B'].includes(upper)) {
            answer = 'B';
          } else {
            answer = upper || 'A';
          }
        } else if (type === 'single' || type === 'multiple') {
          answer = rawAns.toUpperCase();
        } else {
          // definition, essay, blank(单空)
          answer = rawAns;
        }
      }

      // 规范 tags
      let tags: string[] = [];
      if (Array.isArray(item.tags)) {
        tags = item.tags.map((t: any) => String(t).trim()).filter(Boolean);
      } else if (typeof item.tags === 'string' && item.tags.trim()) {
        tags = item.tags.split(/[,，、| ]+/).map((t: string) => t.trim()).filter(Boolean);
      }

      // 规范 keyPoints
      let keyPoints: string[] = [];
      if (Array.isArray(item.keyPoints)) {
        keyPoints = item.keyPoints.map((k: any) => String(k).trim()).filter(Boolean);
      } else if (typeof item.keyPoints === 'string' && item.keyPoints.trim()) {
        keyPoints = item.keyPoints.split(/[,，、;；|]+/).map((k: string) => k.trim()).filter(Boolean);
      }

      let chapter = item.chapter ? String(item.chapter).trim() : undefined;
      if (!chapter && tags.length > 0) {
        const found = tags.find((t) => /^第[0-9一二三四五六七八九十]+[章节篇]/.test(t));
        if (found) chapter = found;
      }

      validatedQuestions.push({
        id: typeof item.id === 'number' ? item.id : i + 1,
        type,
        question: qText,
        options,
        answer,
        analysis: item.analysis ? String(item.analysis).trim() : '',
        chapter,
        section: item.section ? String(item.section).trim() : undefined,
        tags,
        keyPoints: keyPoints.length > 0 ? keyPoints : undefined,
        clozeTemplate: item.clozeTemplate ? String(item.clozeTemplate).trim() : undefined
      });
    }

    if (validatedQuestions.length === 0) {
      return { success: false, questions: [], format: 'json', error: '未在 JSON 中找到合法的题目对象。' };
    }

    return {
      success: true,
      questions: validatedQuestions,
      format: 'json'
    };
  } catch (err: unknown) {
    return {
      success: false,
      questions: [],
      format: 'json',
      error: err instanceof Error ? err.message : 'JSON 格式解析错误'
    };
  }
}

/**
 * 智能解析纯文本 / Markdown 格式题库
 * 支持常见 AI 生成格式、考卷文档、章节标头及名词解释/填空等多种题型
 */
export function tryParsePlainText(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  const questions: Question[] = [];
  
  let currentChapter = '';
  let currentQ: Partial<Question> | null = null;
  let currentOptions: Record<string, string> = {};
  let currentAnalysis = '';
  let currentKeyPoints: string[] = [];
  let currentTags: string[] = [];
  let idCounter = 1;

  const flushQuestion = () => {
    if (currentQ && currentQ.question) {
      const qText = currentQ.question.trim();
      let type: QuestionType = currentQ.type || 'single';
      const ans = currentQ.answer;

      if (type === 'single' || type === 'multiple' || type === 'judge') {
        const rawAnsUpper = String(ans || '').trim().toUpperCase();
        if (Object.keys(currentOptions).length === 2 && (currentOptions['A'] === '正确' || currentOptions['A'] === '对')) {
          type = 'judge';
        } else if (rawAnsUpper.length > 1 && !['对', '错', '正确', '错误'].includes(rawAnsUpper) && /^[A-G]+$/.test(rawAnsUpper)) {
          type = 'multiple';
        }

        let finalAns = rawAnsUpper;
        if (type === 'judge') {
          if (['对', '正确', 'T', 'TRUE', '1'].includes(rawAnsUpper)) finalAns = 'A';
          if (['错', '错误', 'F', 'FALSE', '0'].includes(rawAnsUpper)) finalAns = 'B';
        }

        // 如果判断题没有选项，自动填充
        if (type === 'judge' && Object.keys(currentOptions).length === 0) {
          currentOptions = { A: '正确', B: '错误' };
        }

        questions.push({
          id: currentQ.id || idCounter++,
          type,
          question: qText,
          options: { ...currentOptions },
          answer: finalAns || 'A',
          analysis: currentAnalysis.trim(),
          chapter: currentChapter || undefined,
          tags: currentTags.length > 0 ? [...currentTags] : undefined,
          keyPoints: currentKeyPoints.length > 0 ? [...currentKeyPoints] : undefined
        });
      } else {
        // 主观题 (blank, definition, essay)
        questions.push({
          id: currentQ.id || idCounter++,
          type,
          question: qText,
          options: { ...currentOptions },
          answer: ans !== undefined && ans !== '' ? ans : '详见答案与解析',
          analysis: currentAnalysis.trim(),
          chapter: currentChapter || undefined,
          tags: currentTags.length > 0 ? [...currentTags] : undefined,
          keyPoints: currentKeyPoints.length > 0 ? [...currentKeyPoints] : undefined
        });
      }
    }
    currentQ = null;
    currentOptions = {};
    currentAnalysis = '';
    currentKeyPoints = [];
    currentTags = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) continue;

    // 匹配章节标题，如 "第1章 绪论" 或 "# 第一章 ..." 或 "【第一章 酶学】"
    const chapterMatch = line.match(/^(?:#+\s*|【)?(?:第[0-9一二三四五六七八九十]+[章节篇]|Chapter\s*[0-9]+)[：:\s]*(.*?)(?:】)?$/i);
    if (chapterMatch && !line.includes('题') && line.length < 50) {
      flushQuestion();
      currentChapter = line.replace(/^[#\s【]+/, '').replace(/[】]+$/, '').trim();
      continue;
    }

    // 匹配知识点标签，如 "【标签】：米氏常数，考点" 或 "标签: 概念"
    const tagMatch = line.match(/^(?:【?(?:标签|知识点|考点|Tags?)】?)[：:\s]*(.*)/i);
    if (tagMatch) {
      const parsedTags = tagMatch[1].split(/[,，、;；| ]+/).map(t => t.trim()).filter(Boolean);
      currentTags.push(...parsedTags);
      continue;
    }

    // 匹配采分点，如 "【采分点】：1. 自主复制 2. 双链环状" 或 "踩分点: ..."
    const keyPointMatch = line.match(/^(?:【?(?:采分点|踩分点|得分点|KeyPoints?)】?)[：:\s]*(.*)/i);
    if (keyPointMatch) {
      const pts = keyPointMatch[1].split(/[,，、;；|]+/).map(p => p.replace(/^[0-9]+[.\、\s]*/, '').trim()).filter(Boolean);
      currentKeyPoints.push(...pts);
      continue;
    }

    // 匹配答案行
    const answerMatch = line.match(/^(?:【?答案】?|参考答案|正确答案)[：:\s]*(.*)/i);
    if (answerMatch) {
      if (currentQ) {
        currentQ.answer = answerMatch[1].trim();
      }
      continue;
    }

    // 匹配解析行
    const analysisMatch = line.match(/^(?:【?解析】?|核心解析|答案解析)[：:\s]*(.*)/i);
    if (analysisMatch) {
      currentAnalysis += (currentAnalysis ? '\n' : '') + analysisMatch[1].trim();
      continue;
    }

    // 匹配选项，例如 "A. 内容", "A、内容", "(A) 内容"
    const optionMatch = line.match(/^[\(（]?([A-Fa-f])[\)）]?[.、\s\t]+(.*)/);
    if (optionMatch && currentQ && (currentQ.type === 'single' || currentQ.type === 'multiple' || currentQ.type === 'judge')) {
      const optKey = optionMatch[1].toUpperCase();
      const optVal = optionMatch[2].trim();
      currentOptions[optKey] = optVal;
      continue;
    }

    // 匹配题目开始，例如 "1. 题目", "【名词解释】1. 质粒", "【论述题】", "【填空题】"
    const qTypePrefixMatch = line.match(/^(?:【|\()(单选|多选|判断|填空|名词解释|名词|论述|简答)(?:】|\))\s*(.*)/i);
    const questionNumMatch = line.match(/^([0-9]+[.\、\s]|第[0-9]+题[：:\s])\s*(.*)/i);

    if (qTypePrefixMatch || questionNumMatch || (/^[0-9]+[.\、]/.test(line) && !line.startsWith('A.') && !line.startsWith('B.'))) {
      flushQuestion();

      let detectedType: QuestionType = 'single';
      let qBody = line;

      if (qTypePrefixMatch) {
        const typeStr = qTypePrefixMatch[1];
        if (typeStr.includes('单选')) detectedType = 'single';
        else if (typeStr.includes('多选')) detectedType = 'multiple';
        else if (typeStr.includes('判断')) detectedType = 'judge';
        else if (typeStr.includes('填空')) detectedType = 'blank';
        else if (typeStr.includes('名词')) detectedType = 'definition';
        else if (typeStr.includes('论述') || typeStr.includes('简答')) detectedType = 'essay';
        qBody = qTypePrefixMatch[2] || line;
      } else {
        if (line.includes('多选') || line.includes('多项选择')) detectedType = 'multiple';
        else if (line.includes('判断')) detectedType = 'judge';
        else if (line.includes('填空') || line.includes('____')) detectedType = 'blank';
        else if (line.includes('名词解释') || line.includes('什么是')) detectedType = 'definition';
        else if (line.includes('简述') || line.includes('论述')) detectedType = 'essay';
      }

      currentQ = {
        id: idCounter++,
        type: detectedType,
        question: qBody.replace(/^[0-9]+[.\、\s]*/, '').trim()
      };
      continue;
    }

    // 附随行（多行解析或多行题干/主观题答案续行）
    if (currentAnalysis) {
      currentAnalysis += '\n' + line;
    } else if (currentQ) {
      if (Object.keys(currentOptions).length === 0) {
        currentQ.question = (currentQ.question || '') + ' ' + line;
      }
    }
  }

  flushQuestion();

  if (questions.length > 0) {
    return {
      success: true,
      questions,
      format: 'text'
    };
  }

  return {
    success: false,
    questions: [],
    format: 'unknown',
    error: '无法识别文本中的题目结构。请确认是否包含形如 "1. 题目 A. 选项... 答案: A" 或 "【名词解释】1. 词条..." 格式。'
  };
}

/**
 * 综合智能识别器：优先尝试 JSON，其次纯文本
 */
export function autoParseAny(content: string): ParseResult {
  const trimmed = content.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{') || trimmed.startsWith('```json')) {
    const jsonRes = tryParseJSON(content);
    if (jsonRes.success) return jsonRes;
  }

  // 尝试纯文本识别
  const textRes = tryParsePlainText(content);
  if (textRes.success) return textRes;

  // 再次降级回 JSON 报错提示更精准的信息
  return tryParseJSON(content);
}
