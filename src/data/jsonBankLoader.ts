import { Question } from '../types';

export interface PresetBankItem {
  name: string;
  description: string;
  tags: string[];
  questions: Question[];
}

// 自动扫描并加载 /src/data/banks/*.json 目录下的所有内置题库
const rawJsonModules = import.meta.glob<Question[]>('./banks/*.json', { eager: true, import: 'default' });

export function getAutoLoadedJsonBanks(): PresetBankItem[] {
  const list: PresetBankItem[] = [];

  // 扫描 src/data/banks/*.json 文件夹下的所有自定义题库
  for (const path in rawJsonModules) {
    const rawData = rawJsonModules[path];
    if (Array.isArray(rawData) && rawData.length > 0) {
      // 提取文件名作为题库名称，例如 ./banks/软件工程导论.json -> 软件工程导论
      const fileNameMatch = path.match(/\/([^/]+)\.json$/);
      const bankName = fileNameMatch ? fileNameMatch[1] : path.replace('./banks/', '').replace('.json', '');

      if (list.some(item => item.name === bankName)) continue;

      const types = new Set<string>();
      rawData.forEach(q => {
        if (q.type === 'single') types.add('单选');
        else if (q.type === 'multiple') types.add('多选');
        else if (q.type === 'judge') types.add('判断');
      });

      list.push({
        name: bankName,
        description: `包含 ${rawData.length} 道题目`,
        tags: [Array.from(types).join(' / ') || '基础题型', `${rawData.length} 题`],
        questions: rawData
      });
    }
  }

  return list;
}
