
/**
 * @file services/mockHandlers.ts
 * @description Mock Engine per la gestione dei dati in locale via LocalStorage.
 */

import { v4 as uuidv4 } from 'uuid';
import { INITIAL_MOCK_DATA } from './mockData';

const STORAGE_KEY = 'staffing_planner_local_db_v1';

const getDb = () => {
  if (typeof window === 'undefined') return INITIAL_MOCK_DATA;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_MOCK_DATA));
    return INITIAL_MOCK_DATA;
  }
  try {
      const parsed = JSON.parse(stored);
      return { ...INITIAL_MOCK_DATA, ...parsed };
  } catch (e) {
      return INITIAL_MOCK_DATA;
  }
};

const saveDb = (data: any) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
};

export const mockFetch = async (url: string, options: RequestInit = {}): Promise<any> => {
  const db = getDb();
  const { method = 'GET' } = options;
  const urlBase = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  const urlObj = new URL(url, urlBase);
  const path = urlObj.pathname;
  const params = Object.fromEntries(urlObj.searchParams.entries());

  if (path.endsWith('/api/data')) {
    const scope = params.scope || 'all';
    if (scope === 'metadata') {
        const { assignments, allocations, ...metadata } = db;
        return metadata;
    }
    return db;
  }

  if (path.endsWith('/api/resources')) {
    const entity = params.entity;
    let dbKey = entity;
    if (entity === 'leaves') dbKey = 'leaveRequests';
    if (entity === 'app-users') dbKey = 'users';
    
    const list = db[dbKey] || [];
    
    if (method === 'GET') return list;
    
    if (method === 'POST') {
      const body = JSON.parse(options.body as string);
      const newItem = { id: uuidv4(), ...body };
      if (!db[dbKey]) db[dbKey] = [];
      db[dbKey].push(newItem);
      saveDb(db);
      return newItem;
    }
    
    if (method === 'PUT') {
      const body = JSON.parse(options.body as string);
      db[dbKey] = list.map((i: any) => i.id === params.id ? { ...i, ...body } : i);
      saveDb(db);
      return { id: params.id, ...body };
    }
    
    if (method === 'DELETE') {
      db[dbKey] = list.filter((i: any) => i.id !== params.id);
      saveDb(db);
      return null;
    }
  }

  if (path.includes('/api/config')) {
      const type = params.type;
      const list = db[type] || [];
      if (method === 'POST') {
          const body = JSON.parse(options.body as string);
          const newItem = { id: uuidv4(), ...body };
          if (!db[type]) db[type] = [];
          db[type].push(newItem);
          saveDb(db);
          return newItem;
      }
      if (method === 'PUT') {
          const body = JSON.parse(options.body as string);
          db[type] = list.map((i: any) => i.id === params.id ? { ...i, ...body } : i);
          saveDb(db);
          return { id: params.id, ...body };
      }
      if (method === 'DELETE') {
          db[type] = list.filter((i: any) => i.id !== params.id);
          saveDb(db);
          return null;
      }
  }

  return [];
};
