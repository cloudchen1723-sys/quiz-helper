import { Question, StoredBank, WrongBook, BankStats } from '../types';
import { getAutoLoadedJsonBanks } from '../data/jsonBankLoader';

const DB_NAME = 'QuestionBankCognitionDB_v2';
const DB_VERSION = 1;

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
        if (!db.objectStoreNames.contains('history')) {
          db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  async initDefaultsIfEmpty(): Promise<void> {
    const names = await this.getAllBankNames();
    if (names.length === 0) {
      const defaultBanks = getAutoLoadedJsonBanks();
      for (const b of defaultBanks) {
        await this.saveBank(b.name, b.questions);
      }
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
      const tx = db.transaction(['banks', 'wrongBooks'], 'readwrite');
      tx.objectStore('banks').delete(name);
      tx.objectStore('wrongBooks').delete(name);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async renameBank(oldName: string, newName: string): Promise<void> {
    if (oldName === newName) return;
    const oldBank = await this.getBank(oldName);
    if (!oldBank) return;
    const oldWb = await this.getWrongBook(oldName);

    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['banks', 'wrongBooks'], 'readwrite');
      tx.objectStore('banks').delete(oldName);
      tx.objectStore('banks').put({ ...oldBank, name: newName });
      
      if (oldWb) {
        tx.objectStore('wrongBooks').delete(oldName);
        tx.objectStore('wrongBooks').put({ bankName: newName, data: oldWb });
      }
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

  async calculateStats(questions: Question[]): Promise<BankStats> {
    const stats: BankStats = { total: questions.length, single: 0, multiple: 0, judge: 0 };
    questions.forEach((q) => {
      if (q.type === 'single') stats.single++;
      else if (q.type === 'multiple') stats.multiple++;
      else if (q.type === 'judge') stats.judge++;
    });
    return stats;
  }
}

export const dbManager = new DBManager();
