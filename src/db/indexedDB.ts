import { Question, StoredBank, WrongBook, BankStats, DailyActivityLog, AnkiCardState } from '../types';
import { getAutoLoadedJsonBanks } from '../data/jsonBankLoader';
import { calculateQuestionBankStats } from '../utils/textParser';

const DB_NAME = 'QuestionBankCognitionDB_v3';
const DB_VERSION = 3;

export class DBManager {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('banks')) {
          db.createObjectStore('banks', { keyPath: 'name' });
        }
        if (!db.objectStoreNames.contains('wrongBooks')) {
          db.createObjectStore('wrongBooks', { keyPath: 'bankName' });
        }
        if (!db.objectStoreNames.contains('masteredBooks')) {
          db.createObjectStore('masteredBooks', { keyPath: 'bankName' });
        }
        if (!db.objectStoreNames.contains('history')) {
          db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('daily_logs')) {
          db.createObjectStore('daily_logs', { keyPath: 'date' });
        }
        if (!db.objectStoreNames.contains('anki_cards')) {
          db.createObjectStore('anki_cards', { keyPath: 'cardId' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  async initDefaultsIfEmpty(): Promise<void> {
    try {
      // 标记是否已执行过首次默认题库初始化，避免用户删除后被重新注入
      const INITIALIZED_FLAG = 'exam_app_default_preset_initialized_v3';
      const hasInitialized = localStorage.getItem(INITIALIZED_FLAG);

      // 清除旧版本中残留的非核心示例题库
      const allNames = await this.getAllBankNames();
      const legacyExampleNames = [
        '计算机科学与组成原理 (199题)',
        '计算机科学导论',
        '近代史题库',
        '中国近现代史纲要',
        '生物化学',
        '生物化学核心闪卡'
      ];
      for (const legacy of legacyExampleNames) {
        if (allNames.includes(legacy)) {
          await this.deleteBank(legacy);
        }
      }

      // 仅在首次打开且当前没有任何题库且未选择跳过预设时才注入默认题库
      const skipPresets = localStorage.getItem('exam_app_skip_presets') === 'true';
      if (!hasInitialized) {
        localStorage.setItem(INITIALIZED_FLAG, 'true');
        if (!skipPresets) {
          const currentNames = await this.getAllBankNames();
          if (currentNames.length === 0) {
            const presets = getAutoLoadedJsonBanks();
            const targetPreset = presets.find(p => p.name.includes('生物化学核心考点双轨题库'));
            if (targetPreset && targetPreset.questions.length > 0) {
              await this.saveBank(targetPreset.name, targetPreset.questions);
            }
          }
        }
      }
    } catch (err) {
      console.warn('初始化内置测试题库异常:', err);
    }
  }

  async getAllBankNames(): Promise<string[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('banks', 'readonly');
      const req = tx.objectStore('banks').getAllKeys();
      req.onsuccess = () => resolve(req.result as string[]);
      req.onerror = () => reject(req.error);
    });
  }

  async getBank(name: string): Promise<StoredBank | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('banks', 'readonly');
      const req = tx.objectStore('banks').get(name);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async saveBank(name: string, questions: Question[]): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('banks', 'readwrite');
      const item: StoredBank = {
        name,
        data: questions,
        updatedAt: Date.now(),
        createdAt: Date.now()
      };
      const req = tx.objectStore('banks').put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deleteBank(name: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['banks', 'wrongBooks', 'masteredBooks', 'anki_cards'], 'readwrite');
      tx.objectStore('banks').delete(name);
      tx.objectStore('wrongBooks').delete(name);
      tx.objectStore('masteredBooks').delete(name);

      // 同步彻底清理该题库下的所有 SM-2 闪卡排程记录，绝不残留孤立卡片
      const ankiStore = tx.objectStore('anki_cards');
      const req = ankiStore.openCursor();
      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const card = cursor.value as AnkiCardState;
          if (card.bankName === name || card.cardId.startsWith(`${name}_`)) {
            cursor.delete();
          }
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async renameBank(oldName: string, newName: string): Promise<void> {
    if (oldName === newName) return;
    const oldBank = await this.getBank(oldName);
    if (!oldBank) return;
    const oldWb = await this.getWrongBook(oldName);
    const oldMb = await this.getMasteredBook(oldName);

    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['banks', 'wrongBooks', 'masteredBooks', 'anki_cards'], 'readwrite');
      tx.objectStore('banks').delete(oldName);
      tx.objectStore('banks').put({ ...oldBank, name: newName });
      
      if (oldWb) {
        tx.objectStore('wrongBooks').delete(oldName);
        tx.objectStore('wrongBooks').put({ bankName: newName, data: oldWb });
      }
      if (oldMb && oldMb.length > 0) {
        tx.objectStore('masteredBooks').delete(oldName);
        tx.objectStore('masteredBooks').put({ bankName: newName, data: oldMb });
      }

      // 同步更新闪卡所属题库与卡片主键
      const ankiStore = tx.objectStore('anki_cards');
      const req = ankiStore.openCursor();
      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const card = cursor.value as AnkiCardState;
          if (card.bankName === oldName || card.cardId.startsWith(`${oldName}_`)) {
            cursor.delete();
            const newCardId = `${newName}_${card.questionId}`;
            ankiStore.put({
              ...card,
              cardId: newCardId,
              bankName: newName
            });
          }
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getWrongBook(bankName: string): Promise<WrongBook> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('wrongBooks', 'readonly');
      const req = tx.objectStore('wrongBooks').get(bankName);
      req.onsuccess = () => resolve(req.result ? req.result.data : {});
      req.onerror = () => reject(req.error);
    });
  }

  async saveWrongBook(bankName: string, data: WrongBook): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('wrongBooks', 'readwrite');
      const req = tx.objectStore('wrongBooks').put({ bankName, data });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getMasteredBook(bankName: string): Promise<number[]> {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('masteredBooks', 'readonly');
        const req = tx.objectStore('masteredBooks').get(bankName);
        req.onsuccess = () => resolve(req.result ? req.result.data : []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  async saveMasteredBook(bankName: string, data: number[]): Promise<void> {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('masteredBooks', 'readwrite');
        const req = tx.objectStore('masteredBooks').put({ bankName, data });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('saveMasteredBook failed:', e);
    }
  }

  async calculateStats(questions: Question[]): Promise<BankStats> {
    return calculateQuestionBankStats(questions);
  }

  // --- 模块三：每日活动快照 (DailyActivityLog) ---
  async getDailyLog(date: string): Promise<DailyActivityLog | null> {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('daily_logs', 'readonly');
        const req = tx.objectStore('daily_logs').get(date);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  async getAllDailyLogs(): Promise<DailyActivityLog[]> {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('daily_logs', 'readonly');
        const req = tx.objectStore('daily_logs').getAll();
        req.onsuccess = () => resolve((req.result as DailyActivityLog[]) || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  async upsertDailyLog(log: DailyActivityLog): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('daily_logs', 'readwrite');
      const req = tx.objectStore('daily_logs').put(log);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- 模块四：Anki 卡片 SM-2 调度状态 ---
  async getAnkiCard(cardId: string): Promise<AnkiCardState | null> {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('anki_cards', 'readonly');
        const req = tx.objectStore('anki_cards').get(cardId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  async saveAnkiCard(card: AnkiCardState): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('anki_cards', 'readwrite');
      const req = tx.objectStore('anki_cards').put(card);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getAllAnkiCards(bankName?: string): Promise<AnkiCardState[]> {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('anki_cards', 'readonly');
        const req = tx.objectStore('anki_cards').getAll();
        req.onsuccess = () => {
          let list = (req.result as AnkiCardState[]) || [];
          if (bankName) {
            list = list.filter(c => c.bankName === bankName);
          }
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  async deleteAnkiCard(cardId: string): Promise<void> {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('anki_cards', 'readwrite');
        tx.objectStore('anki_cards').delete(cardId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('deleteAnkiCard error:', e);
    }
  }

  /**
   * 清理已删除题库残留的孤立闪卡，确保看板统计与题库列表 100% 严密对齐
   */
  async cleanupOrphanAnkiCards(): Promise<void> {
    try {
      const allBankNames = await this.getAllBankNames();
      const bankNamesSet = new Set(allBankNames);
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('anki_cards', 'readwrite');
        const store = tx.objectStore('anki_cards');
        const req = store.openCursor();
        req.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            const card = cursor.value as AnkiCardState;
            // 若卡片所属的题库已被用户删除，则立即销毁该卡片
            if (!card.bankName || !bankNamesSet.has(card.bankName)) {
              cursor.delete();
            }
            cursor.continue();
          }
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('清理孤立闪卡记录异常:', e);
    }
  }

  /**
   * 清空所有每日刷题打卡与活动日志 (重置热力图与 Streak)
   */
  async clearDailyLogs(): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const stores = ['daily_logs'];
      if (db.objectStoreNames.contains('history')) stores.push('history');
      const tx = db.transaction(stores, 'readwrite');
      stores.forEach(s => tx.objectStore(s).clear());
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * 清空所有错题本、已掌握记录和闪卡排程 (保留题库本身)
   */
  async clearAllProgress(): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['wrongBooks', 'masteredBooks', 'anki_cards'], 'readwrite');
      tx.objectStore('wrongBooks').clear();
      tx.objectStore('masteredBooks').clear();
      tx.objectStore('anki_cards').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * 清空全部题库及所有关联的答题进度
   */
  async clearAllBanks(): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['banks', 'wrongBooks', 'masteredBooks', 'anki_cards'], 'readwrite');
      tx.objectStore('banks').clear();
      tx.objectStore('wrongBooks').clear();
      tx.objectStore('masteredBooks').clear();
      tx.objectStore('anki_cards').clear();
      tx.oncomplete = () => {
        localStorage.setItem('exam_app_skip_presets', 'true');
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * 彻底清空所有本地数据并重置为全新初始状态
   */
  async clearAllData(): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const allStores = Array.from(db.objectStoreNames);
      const tx = db.transaction(allStores, 'readwrite');
      allStores.forEach((s) => tx.objectStore(s).clear());
      tx.oncomplete = () => {
        localStorage.setItem('exam_app_default_preset_initialized_v3', 'true');
        localStorage.setItem('exam_app_skip_presets', 'true');
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * 重新载入内置示例题库 (生化核心考点双轨题库)
   */
  async restorePresetBank(): Promise<string | null> {
    const presets = getAutoLoadedJsonBanks();
    const targetPreset = presets.find(p => p.name.includes('生物化学核心考点双轨题库'));
    if (targetPreset && targetPreset.questions.length > 0) {
      await this.saveBank(targetPreset.name, targetPreset.questions);
      localStorage.removeItem('exam_app_skip_presets');
      return targetPreset.name;
    }
    return null;
  }

  /**
   * 导出全部数据备份为 JSON 对象
   */
  async exportAllData(): Promise<{
    version: number;
    exportedAt: string;
    banks: StoredBank[];
    wrongBooks: { bankName: string; data: WrongBook }[];
    masteredBooks: { bankName: string; data: number[] }[];
    dailyLogs: DailyActivityLog[];
    ankiCards: AnkiCardState[];
  }> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        ['banks', 'wrongBooks', 'masteredBooks', 'daily_logs', 'anki_cards'],
        'readonly'
      );

      let banks: StoredBank[] = [];
      let wrongBooks: { bankName: string; data: WrongBook }[] = [];
      let masteredBooks: { bankName: string; data: number[] }[] = [];
      let dailyLogs: DailyActivityLog[] = [];
      let ankiCards: AnkiCardState[] = [];

      tx.objectStore('banks').getAll().onsuccess = (e) => {
        banks = ((e.target as IDBRequest).result as StoredBank[]) || [];
      };
      tx.objectStore('wrongBooks').getAll().onsuccess = (e) => {
        wrongBooks = ((e.target as IDBRequest).result as { bankName: string; data: WrongBook }[]) || [];
      };
      tx.objectStore('masteredBooks').getAll().onsuccess = (e) => {
        masteredBooks = ((e.target as IDBRequest).result as { bankName: string; data: number[] }[]) || [];
      };
      tx.objectStore('daily_logs').getAll().onsuccess = (e) => {
        dailyLogs = ((e.target as IDBRequest).result as DailyActivityLog[]) || [];
      };
      tx.objectStore('anki_cards').getAll().onsuccess = (e) => {
        ankiCards = ((e.target as IDBRequest).result as AnkiCardState[]) || [];
      };

      tx.oncomplete = () => {
        resolve({
          version: 1,
          exportedAt: new Date().toISOString(),
          banks,
          wrongBooks,
          masteredBooks,
          dailyLogs,
          ankiCards
        });
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * 从备份 JSON 恢复全部数据
   */
  async importBackupData(backup: any): Promise<void> {
    if (!backup || typeof backup !== 'object') {
      throw new Error('无效的备份文件数据');
    }
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        ['banks', 'wrongBooks', 'masteredBooks', 'daily_logs', 'anki_cards'],
        'readwrite'
      );

      if (Array.isArray(backup.banks)) {
        const store = tx.objectStore('banks');
        backup.banks.forEach((b: StoredBank) => store.put(b));
      }
      if (Array.isArray(backup.wrongBooks)) {
        const store = tx.objectStore('wrongBooks');
        backup.wrongBooks.forEach((wb: any) => store.put(wb));
      }
      if (Array.isArray(backup.masteredBooks)) {
        const store = tx.objectStore('masteredBooks');
        backup.masteredBooks.forEach((mb: any) => store.put(mb));
      }
      if (Array.isArray(backup.dailyLogs)) {
        const store = tx.objectStore('daily_logs');
        backup.dailyLogs.forEach((dl: DailyActivityLog) => store.put(dl));
      }
      if (Array.isArray(backup.ankiCards)) {
        const store = tx.objectStore('anki_cards');
        backup.ankiCards.forEach((ac: AnkiCardState) => store.put(ac));
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * 检查并向浏览器主动申请永久持久化存储 (Persistent Storage)
   * 成功获得永久授权后，手机/浏览器在存储紧张时也绝不清理此 IndexedDB 数据库
   */
  async checkAndRequestPersistence(): Promise<{
    persisted: boolean;
    usage?: number;
    quota?: number;
  }> {
    let persisted = false;
    let usage = 0;
    let quota = 0;

    if (typeof navigator !== 'undefined' && navigator.storage) {
      if (navigator.storage.persisted) {
        persisted = await navigator.storage.persisted();
      }

      if (!persisted && navigator.storage.persist) {
        try {
          persisted = await navigator.storage.persist();
        } catch {
          persisted = false;
        }
      }

      if (navigator.storage.estimate) {
        try {
          const estimate = await navigator.storage.estimate();
          usage = estimate.usage || 0;
          quota = estimate.quota || 0;
        } catch {
          // ignore
        }
      }
    }

    return { persisted, usage, quota };
  }
}

export const dbManager = new DBManager();

