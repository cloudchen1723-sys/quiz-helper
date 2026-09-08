import { Question } from '../types';

export interface PresetBankItem {
  name: string;
  description: string;
  tags: string[];
  questions: Question[];
}

// 自动扫描并加载 /src/data/banks/*.json 目录下的题库
const rawJsonModules = import.meta.glob<any>('./banks/*.json', { eager: true, import: 'default' });

export function getAutoLoadedJsonBanks(): PresetBankItem[] {
  const list: PresetBankItem[] = [];

  // 扫描 src/data/banks/*.json 文件夹下的题库
  for (const path in rawJsonModules) {
    const rawData = rawJsonModules[path];
    let questions: Question[] = [];
    let customName = '';
    let customDesc = '';

    if (Array.isArray(rawData)) {
      questions = rawData;
    } else if (rawData && Array.isArray(rawData.questions)) {
      questions = rawData.questions;
      customName = rawData.name || '';
      customDesc = rawData.description || '';
    } else if (rawData && Array.isArray(rawData.data)) {
      questions = rawData.data;
      customName = rawData.name || '';
      customDesc = rawData.description || '';
    }

    if (questions.length > 0) {
      const fileNameMatch = path.match(/\/([^/]+)\.json$/);
      const fallbackName = fileNameMatch ? fileNameMatch[1] : path.replace('./banks/', '').replace('.json', '');
      const bankName = customName || fallbackName;

      if (list.some(item => item.name === bankName)) continue;

      // 提取该题库包含的题型标签
      const types = new Set<string>();
      questions.forEach(q => {
        if (q.type === 'single') types.add('单选');
        else if (q.type === 'multiple') types.add('多选');
        else if (q.type === 'judge') types.add('判断');
        else if (q.type === 'definition') types.add('名词解释');
        else if (q.type === 'blank') types.add('填空速记');
        else if (q.type === 'essay') types.add('简答论述');
      });

      let description = customDesc;
      if (!description) {
        if (bankName.includes('生物化学核心考点双轨题库')) {
          description = '涵盖蛋白质、酶、糖代谢、脂质代谢、氨基酸代谢、核酸、生物氧化等章节，包含客观刷题与主观闪卡共30题';
        } else {
          description = `包含 ${questions.length} 道题目`;
        }
      }

      list.push({
        name: bankName,
        description,
        tags: [Array.from(types).join(' / ') || '基础题型', `${questions.length} 题`],
        questions
      });
    }
  }

  return list;
}
