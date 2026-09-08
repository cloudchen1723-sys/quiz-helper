import React, { useState, useRef } from 'react';
import { 
  X, 
  Clipboard, 
  Upload, 
  Sparkles, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  BookOpen, 
  Copy, 
  Check,
  Layers,
  Flame,
  Target
} from 'lucide-react';
import { autoParseAny, ParseResult, calculateQuestionBankStats } from '../utils/textParser';
import { getAutoLoadedJsonBanks } from '../data/jsonBankLoader';
import { Question } from '../types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (bankName: string, questions: Question[]) => Promise<void>;
  initialTab?: 'paste' | 'file' | 'presets' | 'prompt';
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  initialTab = 'paste'
}) => {
  const [tab, setTab] = useState<'paste' | 'file' | 'presets' | 'prompt'>(initialTab);
  const [promptSubTab, setPromptSubTab] = useState<'universal' | 'bank' | 'card'>('universal');
  const [bankName, setBankName] = useState('');
  const [rawText, setRawText] = useState('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen && initialTab) {
      setTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleTextChange = (text: string) => {
    setRawText(text);
    if (!text.trim()) {
      setParseResult(null);
      return;
    }
    const res = autoParseAny(text);
    setParseResult(res);

    if (res.success && !bankName) {
      setBankName(`题库_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '')}_${res.questions.length}题`);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        handleTextChange(text);
      }
    } catch {
      // 若浏览器权限限制，用户直接在文本框按 Ctrl+V
    }
  };

  const handleFile = (file: File) => {
    const defaultName = file.name.replace(/\.[^/.]+$/, '');
    setBankName(defaultName);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setRawText(content);
        const res = autoParseAny(content);
        setParseResult(res);
        setTab('paste'); // 切到粘贴页查看预览
      }
    };
    reader.readAsText(file);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = async () => {
    if (!parseResult || !parseResult.success || parseResult.questions.length === 0) return;
    const finalName = bankName.trim() || `新题库_${Date.now().toString().slice(-4)}`;
    setIsSubmitting(true);
    try {
      await onImportSuccess(finalName, parseResult.questions);
      onClose();
      // 重置状态
      setRawText('');
      setBankName('');
      setParseResult(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoadPreset = async (name: string, data: Question[]) => {
    setIsSubmitting(true);
    try {
      await onImportSuccess(name, data);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  // 0. 万能总 Prompt（支持任意混合型资料：无序讲义、混乱试卷、笔记大纲、多题型杂糅一网打尽）
  const promptUniversalText = `你是一个顶级考试命题与认知题库研发专家。无论我提供给你的是杂乱的复习讲义、教材划线、历年真题试卷、知识点大纲，还是单选/多选/判断/填空/名词解释/论述混合杂糅的无序资料，请一律将其深度清洗并重构为可直接导入本系统的【标准 JSON 题库】。

【全能处理原则】：
1. 既有题目处理：忠实保留原题考点，自动补齐缺失的标准选项、答案字母、核心关键词与深度考点解析。
2. 散点资料/笔记转化：智能转化为最符合认知与考察规律的标准题型：
   - 专业概念/专有名词/定义 -> "definition"（名词解释）
   - 核心机制/机理/比较/复杂过程 -> "essay"（简答/论述题）
   - 关键数据/节点/固定搭配/条件 -> "blank"（填空题，生成挖空模板）或 "single"（单选题）
   - 易混淆对比/关键是非断言 -> "judge"（判断题）
   - 综合多维要点/多项分类 -> "multiple"（多选题）
3. 章节自动归纳：若资料无章节，请结合该学科认知框架，自动提炼并归纳到所属章节（如"第一章 蛋白质化学"），便于系统构建章节树与按章刷题。

【系统数据契约（严禁破坏）】：
1. 格式硬性约束：必须输出且仅输出一个合法的 JSON 数组（直接以 [ 开头，以 ] 结尾，切勿包含 Markdown 代码块之外的任何说明废话）。
2. 每道题目必须包含以下标准字段：
   - "id": 递增正整数，从 1 开始。
   - "type": 仅限 6 种标准题型字符串：
     * "single"（单选）: options 包含 4 项，answer 为单个大写字母如 "A"。
     * "multiple"（多选）: options 包含 4~5 项，answer 为升序大写组合无空格如 "ABC"。
     * "judge"（判断）: options 固定为 {"A": "正确", "B": "错误"}，answer 为 "A" 或 "B"。
     * "blank"（填空）: 题干空缺用 "____"；必须附带 "clozeTemplate"，挖空内容用 {{答案}} 标记；options 为 {}；answer 为数组如 ["词1", "词2"]。
     * "definition"（名词解释）: question 为词条名；options 为 {}；answer 为标准定义；提取 keyPoints。
     * "essay"（简答/论述）: question 为设问；options 为 {}；answer 为详尽解答；提取 keyPoints。
   - "chapter": 所属章节全名（如 "第一章 绪论"）。
   - "tags": 字符串数组，提取 1~3 个关键标签，如 ["高频考点", "真题必背"]。
   - "question": 完整清晰的题干。
   - "options": 选项字典，主观题（填空/名词解释/论述）固定填空对象 {}。
   - "answer": 标准答案。
   - "clozeTemplate": （填空题专用）原句挖空模板，挖空处用 {{答案词}} 包裹（系统用于渲染交互下划线遮罩）。
   - "keyPoints": （名词解释与论述题必填）2~5 个核心得分关键词。
     ⚠️【前端高亮核心契约】：keyPoints 里的每一个词语，必须 100% 一字不差地包含在 "answer" 正文中（前端渲染引擎会自动将 answer 中的 keyPoints 渲染为荧光高亮）。
   - "analysis": 考点深度精解、记忆口诀或易混点提示。

---------------------------------------------------------
【万能输出 JSON 完整示例】：
[
  {
    "id": 1,
    "type": "single",
    "chapter": "第一章 绪论与生物大分子",
    "tags": ["氨基酸性质", "高频单选"],
    "question": "在近中性生理 pH 条件下，下列哪种氨基酸侧链可以解离并充当质子供体？",
    "options": {
      "A": "组氨酸",
      "B": "亮氨酸",
      "C": "丙氨酸",
      "D": "甘氨酸"
    },
    "answer": "A",
    "analysis": "组氨酸的咪唑基 pKa 约为 6.0，在生理 pH 环境下具有活跃的质子解离与缓冲功能。"
  },
  {
    "id": 2,
    "type": "multiple",
    "chapter": "第一章 绪论与生物大分子",
    "tags": ["蛋白质构象", "多选核心"],
    "question": "维持蛋白质三级结构空间构象稳定的主要作用力与化学键包括：",
    "options": {
      "A": "疏水相互作用",
      "B": "氢键",
      "C": "离子键（盐键）",
      "D": "二硫键"
    },
    "answer": "ABCD",
    "analysis": "疏水相互作用是主要的稳定驱动力，氢键、离子键以及二硫键等次级键与共价键共同维系其三维立体空间构象。"
  },
  {
    "id": 3,
    "type": "judge",
    "chapter": "第二章 核酸化学",
    "tags": ["DNA结构", "正误辨析"],
    "question": "DNA 双螺旋结构中，A 与 T 之间通过 3 个氢键配对，G 与 C 之间通过 2 个氢键配对。",
    "options": {
      "A": "正确",
      "B": "错误"
    },
    "answer": "B",
    "analysis": "A 与 T 之间形成 2 个氢键，G 与 C 之间形成 3 个氢键。因此 GC 含量越高，DNA 的热变性温度 Tm 越高。"
  },
  {
    "id": 4,
    "type": "blank",
    "chapter": "第二章 核酸化学",
    "tags": ["挖空速记", "结构要点"],
    "question": "DNA 双螺旋中，碱基处于分子内部并通过____互补配对，脱氧核糖和磷酸骨架位于____侧。",
    "clozeTemplate": "DNA 双螺旋中，碱基处于分子内部并通过{{氢键}}互补配对，脱氧核糖和磷酸骨架位于{{外}}侧。",
    "options": {},
    "answer": ["氢键", "外"],
    "keyPoints": ["氢键", "外侧骨架"],
    "analysis": "外侧是亲水的核糖磷酸主链骨架，内侧是疏水配对的碱基平面。"
  },
  {
    "id": 5,
    "type": "definition",
    "chapter": "第三章 酶学",
    "tags": ["名词解释", "真题必考"],
    "question": "同工酶 (Isozyme)",
    "options": {},
    "answer": "指催化相同的化学反应，但酶蛋白的分子结构、理化性质以及免疫学特性不同的一组酶。",
    "keyPoints": ["催化相同的化学反应", "分子结构不同", "理化性质与免疫特性不同"],
    "analysis": "临床上乳酸脱氢酶同工酶 (LDH1~LDH5) 常用于心肌梗死与肝脏病变的诊断。"
  },
  {
    "id": 6,
    "type": "essay",
    "chapter": "第四章 生物氧化",
    "tags": ["论述大题", "核心机制"],
    "question": "简述化学渗透假说的核心内容及其在氧化磷酸化偶联机制中的作用。",
    "options": {},
    "answer": "化学渗透假说认为：电子在线粒体呼吸链传递释放的自由能驱动质子跨内膜泵至膜间隙，在线粒体内膜两侧建立了质子电化学梯度。当质子顺梯度经 ATP 合酶流回线粒体基质时，其势能驱动 ADP 和无机磷酸缩合生成 ATP。",
    "keyPoints": ["自由能驱动质子跨内膜泵至膜间隙", "质子电化学梯度", "ATP 合酶", "合成 ATP"],
    "analysis": "大题四大得分要点：质子泵出建立跨膜电化学梯度、质子顺浓度动力势回流、驱动ATP合酶合成ATP。"
  }
]
---------------------------------------------------------
【请将以下任意杂糅资料转换为标准 JSON 题库】：
（在此粘贴你的任何杂乱资料、教材重点、混合试卷、课堂笔记等）`;

  // 1. 全科目多题型杂糅题库 Prompt（涵盖单选/多选/判断/填空/名词解释/论述，适配章节目录与关键词高亮引擎）
  const promptQuestionBankText = `你是一个专业的考试命题与认知题库研发专家。请将我提供的资料（通常混合了单选题、多选题、判断题、填空题、名词解释、论述题等），清洗并重构为标准 JSON 题库格式。

【输出硬性要求】：
1. 必须输出且仅输出一个合法的 JSON 数组（直接以 [ 开头，以 ] 结尾，切勿包含 Markdown 代码块外的任何寒暄或说明文字）。
2. 每道题目必须严格遵循以下字段规范，深度适配系统的自动化解析与交互引擎：
   - "id": 递增正整数，从 1 开始。
   - "type": 题目类型，根据题目原貌智能归类为以下 6 种之一：
     * "single"（单选题）
     * "multiple"（多选题）
     * "judge"（判断题）
     * "blank"（填空题）
     * "definition"（名词解释）
     * "essay"（简答/论述题）
   - "chapter": 所属章节全名（如"第一章 绪论"）。若资料未分章，请结合学科知识体系提炼最合理的章名，以便系统构建章节目录与分类刷题。
   - "tags": 字符串数组，提取 1~3 个关键知识点或考频标签，如 ["核心考点", "真题必背"]。
   - "question": 题干内容。
     * 选择题/判断题/论述题：清晰完整的题干描述（无需人工添加【单选】等题型前缀）。
     * 填空题：空缺处用四个连续下划线 "____" 占位。
     * 名词解释：直接填写待解释的名词词条名称。
   - "clozeTemplate": （填空题专用，其他题型可省略）挖空模板，使用双大括号 {{答案}} 包裹挖空内容，例如："光合作用的场所是{{叶绿体}}，主要吸收{{红橙光}}和蓝紫光。"
   - "options": 选项键值对。
     * 单选/多选：必须为标准键值对象，如 {"A": "...", "B": "...", "C": "...", "D": "..."}。
     * 判断题：统一固定为 {"A": "正确", "B": "错误"}。
     * 填空/名词解释/论述题：必须填空对象 {}。
   - "answer": 标准答案。
     * 单选题：单个大写字母，如 "A"。
     * 多选题：多个大写字母组合且按字母升序排列，无空格逗号，如 "ABC" 或 "BCD"。
     * 判断题：统一为 "A"（代表正确）或 "B"（代表错误）。
     * 填空题：字符串数组如 ["叶绿体", "红橙光"]，或斜杠分隔字符串 "叶绿体 / 红橙光"。
     * 名词解释/论述题：完整详尽的标准解答文本。
   - "keyPoints": （名词解释与论述题必填）字符串数组，提取 2~5 个核心得分关键词。
     ⚠️【极其重要】：keyPoints 里的每一个词语，必须 100% 一字不差地原样包含在 "answer" 正文中（前端渲染引擎会自动依据 keyPoints 对答案正文中的关键词进行高亮标出）。
   - "analysis": 考点精粹解析、记忆口诀或易错点提示。

---------------------------------------------------------
【输出 JSON 示例格式】：
[
  {
    "id": 1,
    "type": "single",
    "chapter": "第一章 蛋白质化学",
    "tags": ["氨基酸性质", "高频考点"],
    "question": "在近中性 pH 条件下，下列哪种氨基酸侧链可解离并提供质子？",
    "options": {
      "A": "组氨酸",
      "B": "亮氨酸",
      "C": "丙氨酸",
      "D": "甘氨酸"
    },
    "answer": "A",
    "analysis": "组氨酸的咪唑基 pKa 约为 6.0，在生理 pH 环境下具有缓冲与质子传递功能。"
  },
  {
    "id": 2,
    "type": "multiple",
    "chapter": "第一章 蛋白质化学",
    "tags": ["蛋白质结构", "多选难点"],
    "question": "维持蛋白质三级结构稳定的化学键与次级键包括哪些？",
    "options": {
      "A": "疏水作用",
      "B": "氢键",
      "C": "盐键（离子键）",
      "D": "二硫键"
    },
    "answer": "ABCD",
    "analysis": "疏水相互作用是维持三级结构的主要驱动力，氢键、离子键、范德华力以及二硫键均参与维持稳定。"
  },
  {
    "id": 3,
    "type": "judge",
    "chapter": "第二章 核酸化学",
    "tags": ["DNA结构", "概念辨析"],
    "question": "DNA 双螺旋结构中，A 与 T 之间通过 3 个氢键配对，G 与 C 之间通过 2 个氢键配对。",
    "options": {
      "A": "正确",
      "B": "错误"
    },
    "answer": "B",
    "analysis": "A 与 T 之间形成 2 个氢键，G 与 C 之间形成 3 个氢键。GC 含量越高，DNA 结构越稳定。"
  },
  {
    "id": 4,
    "type": "blank",
    "chapter": "第二章 核酸化学",
    "tags": ["挖空速记", "基础考点"],
    "question": "DNA 双螺旋中，碱基处于分子内部并通过____互补配对，脱氧核糖和磷酸骨架位于____侧。",
    "clozeTemplate": "DNA 双螺旋中，碱基处于分子内部并通过{{氢键}}互补配对，脱氧核糖和磷酸骨架位于{{外}}侧。",
    "options": {},
    "answer": ["氢键", "外"],
    "keyPoints": ["氢键", "外侧骨架"],
    "analysis": "双螺旋外侧为亲水的磷酸与脱氧核糖骨架，内部为疏水的碱基对。"
  },
  {
    "id": 5,
    "type": "definition",
    "chapter": "第三章 酶学",
    "tags": ["名词解释", "真题高频"],
    "question": "同工酶 (Isozyme)",
    "options": {},
    "answer": "指催化相同的化学反应，但酶蛋白的分子结构、理化性质以及免疫学特性不同的一组酶。",
    "keyPoints": ["催化相同的化学反应", "分子结构不同", "理化性质与免疫特性不同"],
    "analysis": "最典型例子为乳酸脱氢酶 (LDH1~LDH5)，常用于心肌梗死与肝病临床诊断。"
  },
  {
    "id": 6,
    "type": "essay",
    "chapter": "第四章 生物氧化",
    "tags": ["论述题", "核心机制"],
    "question": "简述化学渗透假说的核心内容及其在氧化磷酸化偶联机制中的作用。",
    "options": {},
    "answer": "化学渗透假说认为：电子在线粒体呼吸链传递释放的自由能驱动质子跨内膜泵至膜间隙，在线粒体内膜两侧建立了质子电化学梯度。当质子顺梯度经 ATP 合酶流回线粒体基质时，其势能驱动 ADP 和无机磷酸缩合生成 ATP。",
    "keyPoints": ["自由能驱动质子跨内膜泵至膜间隙", "质子电化学梯度", "ATP 合酶", "合成 ATP"],
    "analysis": "答题四大核心要素：质子泵出、电化学梯度建立、质子动力势经ATP合酶回流、偶联生成ATP。"
  }
]
---------------------------------------------------------
【请将以下杂糅题库/讲义资料转换生成标准 JSON 题库】：
（在此粘贴你的试卷、题库、教材重点、整理笔记）`;

  // 2. Anki 记忆卡片专属 Prompt（专攻名词解释、挖空记忆、论述关键词）
  const promptAnkiCardText = `你是一个基于艾宾浩斯记忆遗忘曲线与认知主动回忆理论的 Anki 闪卡专家。
请将我提供的复习资料，提炼转换为专门用于【高强度交互背诵闪卡】的纯 JSON 格式数据。

【闪卡提炼核心规则】：
1. 专注主动回忆题型：聚焦提炼名词解释 ("definition")、挖空填空 ("blank") 与论述简答 ("essay")。
2. 最小知识单元原则：每张卡片只考查一个清晰独立的概念或机制，拒绝臃肿冗长的多题堆叠。
3. 填空精准挖空 (clozeTemplate)：必须提供 clozeTemplate 字段，并将核心答案或采分词使用双大括号 {{答案}} 包裹，系统将自动渲染交互遮罩。
4. 关键词精确匹配 (keyPoints)：主观题和名词解释必须提取 2~5 个关键核心词放到 "keyPoints" 数组中，且这些词语必须一字不差地原样包含在 "answer" 正文中（系统会在答案正文中自动进行荧光高亮显示）。
5. 必须输出且仅输出以 [ 开头、以 ] 结尾的合法 JSON 数组。

【JSON 格式示例】：
[
  {
    "id": 1,
    "type": "definition",
    "chapter": "第二章 酶学",
    "tags": ["名词解释", "必背核心"],
    "question": "米氏常数 (Km)",
    "options": {},
    "answer": "酶促反应速度达到最大反应速度一半时的底物浓度，是酶的特征性物理常数之一。",
    "keyPoints": ["最大反应速度一半时的底物浓度", "特征性物理常数"],
    "analysis": "Km 仅与酶的性质有关，与酶浓度无关；Km 越小，酶与底物的亲和力越大。"
  },
  {
    "id": 2,
    "type": "blank",
    "chapter": "第三章 糖代谢",
    "tags": ["挖空填空", "限速酶"],
    "question": "糖酵解途径中有三个不可逆反应步骤，其关键限速酶分别是____、____和丙酮酸激酶。",
    "clozeTemplate": "糖酵解途径中有三个不可逆反应步骤，其关键限速酶分别是{{己糖激酶}}、{{6-磷酸果糖激酶-1}}和丙酮酸激酶。",
    "options": {},
    "answer": ["己糖激酶", "6-磷酸果糖激酶-1"],
    "keyPoints": ["己糖激酶", "6-磷酸果糖激酶-1"],
    "analysis": "其中 6-磷酸果糖激酶-1 是糖酵解最关键也是最主要的限速酶。"
  },
  {
    "id": 3,
    "type": "essay",
    "chapter": "第四章 脂质代谢",
    "tags": ["论述要点", "高频大题"],
    "question": "简述脂酸 β-氧化的基本反应过程及其发生部位。",
    "options": {},
    "answer": "脂酸 β-氧化主要在线粒体基质中进行。活化的脂酰CoA进入线粒体后，经过脱氢、加水、再脱氢和硫解四步连续反应，每循环一次生成一分子乙酰CoA和缩短两个碳原子的脂酰CoA。",
    "keyPoints": ["线粒体基质", "脱氢", "加水", "再脱氢", "硫解", "乙酰CoA"],
    "analysis": "注意转运限速酶为肉碱脂酰转移酶Ⅰ，四步循环名称不可漏掉。"
  }
]

---------------------------------------------------------
【请根据以下资料提炼制作高强度背诵卡片】：
（在此粘贴你的重点概念、考纲要点、简答题库）`;

  const copyPromptToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  // 统计解析出的各类题型全景
  const stats = parseResult?.success ? calculateQuestionBankStats(parseResult.questions) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white border border-stone-200 w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-stone-900 text-white flex items-center justify-center shadow-xs">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-stone-800 text-base">导入题库与生成卡片</h3>
              <p className="text-xs text-stone-400">支持智能文本识别、JSON拖拽、按章节打标及 AI Prompt 模板</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="px-6 pt-3 border-b border-stone-100 flex space-x-2 text-xs font-medium">
          <button
            onClick={() => setTab('paste')}
            className={`pb-2.5 px-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
              tab === 'paste' 
                ? 'border-stone-900 text-stone-900 font-semibold' 
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Clipboard className="w-3.5 h-3.5" />
            <span>粘贴导入</span>
          </button>
          <button
            onClick={() => setTab('file')}
            className={`pb-2.5 px-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
              tab === 'file' 
                ? 'border-stone-900 text-stone-900 font-semibold' 
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>文件上传</span>
          </button>
          <button
            onClick={() => setTab('presets')}
            className={`pb-2.5 px-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
              tab === 'presets' 
                ? 'border-stone-900 text-stone-900 font-semibold' 
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>示例题库</span>
          </button>
          <button
            onClick={() => setTab('prompt')}
            className={`pb-2.5 px-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
              tab === 'prompt' 
                ? 'border-stone-900 text-stone-900 font-semibold' 
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>AI 生成提示词</span>
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {tab === 'paste' && (
            <div className="space-y-4">
              {/* 题库命名输入 */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">题库名称</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="例如：2026考研生物化学、计算机体系结构..."
                  className="w-full px-3.5 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:border-stone-900 transition-colors"
                />
              </div>

              {/* 文本输入框 */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-stone-700">粘贴题库文本或 JSON 格式</label>
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="text-xs text-stone-500 hover:text-stone-900 flex items-center space-x-1 transition-colors"
                  >
                    <Clipboard className="w-3 h-3" />
                    <span>从剪贴板读取</span>
                  </button>
                </div>
                <textarea
                  rows={8}
                  value={rawText}
                  onChange={(e) => handleTextChange(e.target.value)}
                  placeholder="可直接粘贴标准 JSON 数组，或纯文本题目（支持章节、#知识点、客观选择题及名词解释/填空/论述）..."
                  className="w-full p-3 font-mono text-xs border border-stone-200 rounded-xl focus:outline-none focus:border-stone-900 transition-colors"
                />
              </div>

              {/* 实时解析结果反馈 */}
              {parseResult && (
                <div className={`p-3.5 rounded-xl border text-xs ${
                  parseResult.success 
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800' 
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  {parseResult.success ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-1.5 font-semibold text-emerald-900">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>已成功识别 {parseResult.questions.length} 道题目（模式: {parseResult.format === 'json' ? '标准 JSON' : '智能语义提取'}）</span>
                      </div>
                      {stats && (
                        <div className="flex flex-wrap gap-1.5 pt-1 text-[11px]">
                          {stats.single > 0 && <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md">单选: {stats.single}</span>}
                          {stats.multiple > 0 && <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md">多选: {stats.multiple}</span>}
                          {stats.judge > 0 && <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">判断: {stats.judge}</span>}
                          {(stats.definition || 0) > 0 && <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">名词解释: {stats.definition}</span>}
                          {(stats.blank || 0) > 0 && <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded-md">填空: {stats.blank}</span>}
                          {(stats.essay || 0) > 0 && <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md">简答论述: {stats.essay}</span>}
                          {(stats.chaptersCount || 0) > 0 && <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md font-medium">包含 {stats.chaptersCount} 个章节</span>}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">解析失败：</span>
                        <span className="ml-1">{parseResult.error}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'file' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  dragOver 
                    ? 'border-stone-900 bg-stone-100/80 scale-[0.99]' 
                    : 'border-stone-300 hover:border-stone-400 bg-stone-50/40 hover:bg-stone-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.txt,.md"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <div className="w-12 h-12 bg-white rounded-full shadow-xs border border-stone-200 flex items-center justify-center mx-auto mb-3 text-stone-600">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-stone-800 mb-1">
                  点击选择文件或直接将文件拖拽到此处
                </p>
                <p className="text-[11px] text-stone-400">
                  支持 .json、.txt、.md 格式
                </p>
              </div>
            </div>
          )}

          {tab === 'presets' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-stone-500">选择需要载入的内置示例题库：</p>
              </div>
              
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {getAutoLoadedJsonBanks().map((preset) => (
                  <div 
                    key={preset.name}
                    className="border border-stone-200 rounded-xl p-3.5 hover:border-stone-400 transition-all bg-white flex items-center justify-between group"
                  >
                    <div className="flex-1 pr-3">
                      <div className="flex items-center space-x-2 mb-1 flex-wrap gap-y-1">
                        <span className="font-semibold text-stone-800 text-sm">{preset.name}</span>
                        {preset.tags.map((tag, idx) => (
                          <span 
                            key={idx} 
                            className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-stone-100 text-stone-600"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-stone-400 leading-relaxed line-clamp-2">
                        {preset.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleLoadPreset(preset.name, preset.questions)}
                      className="bg-stone-900 text-white text-xs font-medium px-3.5 py-2 rounded-xl hover:bg-stone-800 active:scale-95 transition-all shrink-0 shadow-xs"
                    >
                      一键载入
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI 提示词专区：万能混合型资料、全科刷题与闪卡速记 */}
          {tab === 'prompt' && (
            <div className="space-y-4">
              {/* 三级切换：万能总 Prompt vs 刷题题库 vs 闪卡记忆 */}
              <div className="flex items-center p-1 bg-stone-100 rounded-xl text-xs space-x-1">
                <button
                  type="button"
                  onClick={() => setPromptSubTab('universal')}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                    promptSubTab === 'universal' ? 'bg-white text-stone-900 shadow-2xs font-semibold' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>万能混合 Prompt（推荐）</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPromptSubTab('bank')}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                    promptSubTab === 'bank' ? 'bg-white text-stone-900 shadow-2xs font-semibold' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>标准题库（全题型）</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPromptSubTab('card')}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                    promptSubTab === 'card' ? 'bg-white text-stone-900 shadow-2xs font-semibold' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <Target className="w-3.5 h-3.5 text-amber-600" />
                  <span>闪卡速记（关键词/挖空）</span>
                </button>
              </div>

              <div className="flex justify-between items-center">
                <p className="text-xs text-stone-600 leading-relaxed">
                  {promptSubTab === 'universal'
                    ? '全能总 Prompt：无论资料多么杂乱（讲义划线、散点笔记、混合试卷），智能清洗并重构为六大标准题型与章节：'
                    : promptSubTab === 'bank' 
                    ? '适用于已有客观与主观题的完整试卷或标准题库，按章节精确归类并规范选项与答案：'
                    : '专为名词解释、填空、论述题设计，提炼核心关键词并精准挖空：'}
                </p>
                <button
                  type="button"
                  onClick={() => copyPromptToClipboard(
                    promptSubTab === 'universal' 
                      ? promptUniversalText 
                      : promptSubTab === 'bank' 
                      ? promptQuestionBankText 
                      : promptAnkiCardText
                  )}
                  className="text-xs bg-stone-900 text-white hover:bg-stone-800 px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all shadow-xs shrink-0 ml-3 cursor-pointer"
                >
                  {copiedPrompt ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>已复制提示词</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>复制此提示词</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-3.5 bg-stone-900 text-stone-200 rounded-xl font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed border border-stone-800 max-h-80">
                {promptSubTab === 'universal' 
                  ? promptUniversalText 
                  : promptSubTab === 'bank' 
                  ? promptQuestionBankText 
                  : promptAnkiCardText}
              </div>

              <div className="p-3 bg-stone-50 border border-stone-200/80 rounded-xl text-[11px] text-stone-600 space-y-1">
                <div className="font-semibold text-stone-800 flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span>实操技巧：</span>
                </div>
                <p>1. 点击上方「复制此提示词」发给 ChatGPT / Claude / Gemini / DeepSeek，将资料贴在最下方。</p>
                <p>2. 将大模型输出的 JSON 复制后，切到「粘贴导入」标签页直接粘贴即可完成加载！</p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-stone-100 bg-stone-50/50 flex justify-between items-center">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100 text-xs font-medium transition-colors"
          >
            取消
          </button>

          {tab === 'paste' && (
            <button
              type="button"
              disabled={!parseResult?.success || isSubmitting}
              onClick={handleConfirmImport}
              className={`px-5 py-2.5 rounded-xl text-xs font-medium flex items-center space-x-1.5 transition-all shadow-xs ${
                parseResult?.success && !isSubmitting
                  ? 'bg-stone-900 text-white hover:bg-stone-800 active:scale-95'
                  : 'bg-stone-200 text-stone-400 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>确认导入</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
