
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
      // Merge profondo per assicurare che nuove chiavi aggiunte a INITIAL_MOCK_DATA siano presenti
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

/**
 * Mock Fetch Interceptor
 */
export const mockFetch = async (url: string, options: RequestInit = {}): Promise<any> => {
  const db = getDb();
  const { method = 'GET' } = options;
  
  // Normalizzazione path
  const urlBase = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  const urlObj = new URL(url, urlBase);
  const path = urlObj.pathname;
  const params = Object.fromEntries(urlObj.searchParams.entries());

  // Gestione /api/data (Caricamento iniziale)
  if (path.endsWith('/api/data')) {
    const scope = params.scope || 'all';
    
    // Se lo scope è metadata, restituiamo solo la parte strutturale (più veloce)
    if (scope === 'metadata') {
        const { assignments, allocations, ...metadata } = db;
        return metadata;
    }
    
    // Altrimenti restituiamo tutto
    return db;
  }

  // Gestione /api/auth-config
  if (path.endsWith('/api/auth-config')) {
    return { isEnabled: db.authConfig?.isEnabled ?? false };
  }

  // Gestione /api/login
  if (path.endsWith('/api/login')) {
    return {
      success: true,
      token: 'mock-session-token',
      user: { 
        id: 'admin-id', 
        username: 'admin', 
        role: 'ADMIN', 
        permissions: [
            '/dashboard', '/notifications', '/staffing', '/workload', '/gantt', '/projects', 
            '/contracts', '/clients', '/forecasting', '/resources', '/skills', '/certifications', 
            '/skill-analysis', '/roles', '/leaves', '/resource-requests', '/interviews', 
            '/skills-map', '/staffing-visualization', '/manuale-utente', '/simple-user-manual', 
            '/reports', '/calendar', '/config', '/import', '/export', '/test-staffing',
            '/admin-settings', '/db-inspector'
        ], 
        mustChangePassword: false 
      }
    };
  }

  // Gestione Generica Risorse /api/resources
  if (path.endsWith('/api/resources')) {
    const entity = params.entity;
    
    // Fallback per notifications se non è una risorsa standard
    if (entity === 'notifications') {
        return db.notifications || [];
    }

    // Mapping chiavi DB
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

  // Altri endpoint
  if (path.includes('/api/assignments')) {
      if (method === 'GET') return db.assignments || [];
      if (method === 'POST') {
          const body = JSON.parse(options.body as string);
          const newItem = { id: uuidv4(), ...body };
          db.assignments.push(newItem);
          saveDb(db);
          return newItem;
      }
  }

  if (path.includes('/api/allocations')) {
      if (method === 'POST') {
          const { updates } = JSON.parse(options.body as string);
          updates.forEach((u: any) => {
              if (!db.allocations[u.assignmentId]) db.allocations[u.assignmentId] = {};
              if (u.percentage === 0) delete db.allocations[u.assignmentId][u.date];
              else db.allocations[u.assignmentId][u.date] = u.percentage;
          });
          saveDb(db);
          return { success: true };
      }
  }

  // Fallback finale per endpoint non mappati
  console.warn(`[Mock API] Endpoint non gestito esplicitamente: ${path}`);
  return [];
};
