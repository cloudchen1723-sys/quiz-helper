import { Question } from '../types';
import { PRESET_COMPUTER_SCIENCE_199 } from './presetBanks';

export interface PresetBankItem {
  name: string;
  description: string;
  tags: string[];
  questions: Question[];
}

// 自动扫描并加载 /src/data/banks/*.json 目录下的所有自选题库
const rawJsonModules = import.meta.glob<Question[]>('./banks/*.json', { eager: true, import: 'default' });

export function getAutoLoadedJsonBanks(): PresetBankItem[] {
  const list: PresetBankItem[] = [];

  // 1. 先加入内置的 199 题大题库
  list.push({
    name: '计算机科学与组成原理精选 (199题)',
    description: '涵盖计算机体系结构、冯诺依曼原理、逻辑运算、操作系统基础与外设接口综合真题',
    tags: ['计算机基础', '专升本/考研', '单选题', '官方精选题库'],
    questions: PRESET_COMPUTER_SCIENCE_199
  });

  // 2. 动态扫描 src/data/banks/*.json 文件夹下的所有题库
  for (const path in rawJsonModules) {
    const rawData = rawJsonModules[path];
    if (Array.isArray(rawData) && rawData.length > 0) {
      // 提取文件名作为题库名，例如 "./banks/计算机网络与核心协议速记.json" -> "计算机网络与核心协议速记"
      const fileNameMatch = path.match(/\/([^/]+)\.json$/);
      const bankName = fileNameMatch ? fileNameMatch[1] : path.replace('./banks/', '').replace('.json', '');

      // 避免与上面重复
      if (list.some(item => item.name === bankName)) continue;

      // 提取该题库包含的题型标签
      const types = new Set<string>();
      rawData.forEach(q => {
        if (q.type === 'single') types.add('单选题');
        else if (q.type === 'multiple') types.add('多选题');
        else if (q.type === 'judge') types.add('判断题');
      });

      list.push({
        name: bankName,
        description: `包含 ${rawData.length} 道题目，支持随时在 GitHub 仓库中编辑更新`,
        tags: [Array.from(types).join(' / ') || '综合题型', `${rawData.length} 题`, 'JSON 自定义库'],
        questions: rawData
      });
    }
  }

  return list;
}
