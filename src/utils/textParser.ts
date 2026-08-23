import { Question, QuestionType } from '../types';

export interface ParseResult {
  success: boolean;
  questions: Question[];
  format: 'json' | 'text' | 'unknown';
  error?: string;
  warning?: string;
}

/**
 * 智能清洗并解析 JSON
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
      if (!item.question) {
        continue;
      }

      // 智能识别或校正 type
      let type: QuestionType = item.type;
      const rawAnswer = String(item.answer || '').trim().toUpperCase();

      if (!type) {
        if (item.options && (item.options['正确'] || item.options['A'] === '正确' || item.options['A'] === '对')) {
          type = 'judge';
        } else if (rawAnswer.length > 1 && !['对', '错', '正确', '错误'].includes(rawAnswer)) {
          type = 'multiple';
        } else {
          type = 'single';
        }
      }

      // 规范 options
      let options: Record<string, string> = {};
      if (item.options && typeof item.options === 'object') {
        options = { ...item.options };
      } else if (type === 'judge') {
        options = { A: '正确', B: '错误' };
      }

      // 规范答案
      let answer = rawAnswer;
      if (type === 'judge') {
        if (answer === '对' || answer === 'T' || answer === 'TRUE' || answer === '正确' || answer === '1') {
          answer = 'A';
        } else if (answer === '错' || answer === 'F' || answer === 'FALSE' || answer === '错误' || answer === '0') {
          answer = 'B';
        }
      }

      validatedQuestions.push({
        id: typeof item.id === 'number' ? item.id : i + 1,
        type: type || 'single',
        question: String(item.question).trim(),
        options,
        answer,
        analysis: item.analysis ? String(item.analysis).trim() : '',
        tags: Array.isArray(item.tags) ? item.tags : []
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
 * 支持常见 AI 生成格式及考卷文档
 */
export function tryParsePlainText(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  const questions: Question[] = [];
  
  let currentQ: Partial<Question> | null = null;
  let currentOptions: Record<string, string> = {};
  let currentAnalysis = '';
  let idCounter = 1;

  const flushQuestion = () => {
    if (currentQ && currentQ.question) {
      const qText = currentQ.question.trim();
      const ans = (currentQ.answer || '').trim().toUpperCase();
      
      let type: QuestionType = currentQ.type || 'single';
      if (Object.keys(currentOptions).length === 2 && (currentOptions['A'] === '正确' || currentOptions['A'] === '对')) {
        type = 'judge';
      } else if (ans.length > 1 && !['对', '错', '正确', '错误'].includes(ans)) {
        type = 'multiple';
      }

      let finalAns = ans;
      if (type === 'judge') {
        if (['对', '正确', 'T', 'TRUE'].includes(ans)) finalAns = 'A';
        if (['错', '错误', 'F', 'FALSE'].includes(ans)) finalAns = 'B';
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
        analysis: currentAnalysis.trim()
      });
    }
    currentQ = null;
    currentOptions = {};
    currentAnalysis = '';
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) continue;

    // 匹配题干开始，例如 "1. 题目", "第1题：", "1、", "[单选] 1."
    const questionMatch = line.match(/^([0-9]+[.\、\s]|第[0-9]+题[：:\s]|【(?:单选|多选|判断)】|\((?:单选|多选|判断)\))\s*(.*)/i);
    
    // 或者答案行
    const answerMatch = line.match(/^(?:【?答案】?|参考答案|正确答案)[：:\s]*([A-Za-z对错正确错误TF]+)/i);
    
    // 或者解析行
    const analysisMatch = line.match(/^(?:【?解析】?|核心解析|答案解析)[：:\s]*(.*)/i);

    // 匹配选项，例如 "A. 内容", "A、内容", "(A) 内容", "A) 内容"
    const optionMatch = line.match(/^[\(（]?([A-Fa-f])[\)）]?[.、\s\t]+(.*)/);

    if (answerMatch) {
      if (currentQ) {
        currentQ.answer = answerMatch[1].trim();
      }
    } else if (analysisMatch) {
      currentAnalysis += (currentAnalysis ? '\n' : '') + analysisMatch[1].trim();
    } else if (optionMatch) {
      const optKey = optionMatch[1].toUpperCase();
      const optVal = optionMatch[2].trim();
      currentOptions[optKey] = optVal;
    } else if (questionMatch || (/^[0-9]+[.\、]/.test(line) && !line.startsWith('A.') && !line.startsWith('B.'))) {
      // 遇到新题目，提交上一道题
      flushQuestion();
      
      const qBody = questionMatch ? questionMatch[2] || line : line;
      let detectedType: QuestionType = 'single';
      if (line.includes('多选') || line.includes('多项选择')) detectedType = 'multiple';
      if (line.includes('判断')) detectedType = 'judge';

      currentQ = {
        id: idCounter++,
        type: detectedType,
        question: qBody.replace(/^[0-9]+[.\、\s]*/, '').trim()
      };
    } else {
      // 可能是多行解析或多行题干
      if (currentAnalysis) {
        currentAnalysis += '\n' + line;
      } else if (currentQ && Object.keys(currentOptions).length === 0) {
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
    error: '无法识别文本中的题目结构。请确认是否包含形如 "1. 题目 A. 选项... 答案: A" 的格式。'
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
