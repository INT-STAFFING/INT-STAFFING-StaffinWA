
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

  // ─── Auth: login + config protezione ────────────────────────────────────────
  if (path.endsWith('/api/auth')) {
    if (params.action === 'config') {
      if (method === 'GET') return { isEnabled: false };
      if (method === 'POST') {
        const { isEnabled } = JSON.parse(options.body as string);
        return { success: true, isEnabled };
      }
    }
    // Login
    if (method === 'POST') {
      const { username } = JSON.parse(options.body as string);
      const mockUser = (db as any).users?.find((u: any) => u.username === username);
      return {
        success: true,
        token: 'mock-jwt-token',
        user: {
          id: mockUser?.id || 'mock-admin-id',
          username: mockUser?.username || username || 'admin',
          role: mockUser?.role || 'ADMIN',
          resourceId: mockUser?.resourceId || null,
          permissions: [],
          mustChangePassword: false,
        },
        isAdmin: true,
      };
    }
  }

  if (path.endsWith('/api/resources')) {
    const entity = params.entity;
    let dbKey = entity;
    if (entity === 'leaves') dbKey = 'leaveRequests';
    if (entity === 'app-users') dbKey = 'users';
    if (entity === 'notification_rules') dbKey = 'notificationRules';
    if (entity === 'notification_configs') dbKey = 'notificationConfigs';
    if (entity === 'resource_requests') dbKey = 'resourceRequests';
    if (entity === 'contract_projects') dbKey = 'contractProjects';
    if (entity === 'contract_managers') dbKey = 'contractManagers';
    if (entity === 'project_skills') dbKey = 'projectSkills';
    if (entity === 'resource_skills') dbKey = 'resourceSkills';
    if (entity === 'role_cost_history') dbKey = 'roleCostHistory';
    if (entity === 'skill_categories') dbKey = 'skillCategories';
    if (entity === 'skill_macro_categories') dbKey = 'skillMacroCategories';
    if (entity === 'rate_cards') dbKey = 'rateCards';
    if (entity === 'rate_card_entries') dbKey = 'rateCardEntries';
    if (entity === 'billing_milestones') dbKey = 'billingMilestones';
    if (entity === 'wbs_tasks') dbKey = 'wbsTasks';
    if (entity === 'project_expenses') dbKey = 'projectExpenses';
    if (entity === 'leave_types') dbKey = 'leaveTypes';

    // ── db_inspector: mock risposte per SQL editor, update/delete ────────────
    if (entity === 'db_inspector') {
      const action = params.action;
      // Converte snake_case (nome tabella DB) in camelCase (chiave nel mock db)
      const snakeToCamel = (s: string) => s.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase());

      if (action === 'list_tables') {
        // Restituisce i nomi delle "tabelle" disponibili nel mock (in camelCase come chiavi del db)
        return Object.keys(db);
      }
      if (action === 'get_table_data') {
        const tableParam = params.table as string;
        // Prova prima la chiave diretta, poi la conversione snake→camel
        const rows: any[] = (db as any)[tableParam] ?? (db as any)[snakeToCamel(tableParam)] ?? [];
        // Rimuovi password_hash per sicurezza
        const safeRows = rows.map((r: any) => { const row = { ...r }; delete row.password_hash; return row; });
        const columns = safeRows.length > 0
          ? Object.keys(safeRows[0]).map(k => ({ column_name: k, data_type: 'character varying' }))
          : [];
        return { columns, rows: safeRows.slice(0, 100) };
      }
      if (action === 'run_raw_query' && method === 'POST') {
        return { rows: [], fields: [], rowCount: 0, command: 'OK (mock - SQL non eseguito in locale)' };
      }
      if (action === 'update_row' && method === 'PUT') {
        const tableParam = params.table as string;
        const rowId = params.id as string;
        const updates = JSON.parse(options.body as string) as Record<string, any>;
        const dbKey2 = (db as any)[tableParam] !== undefined ? tableParam : snakeToCamel(tableParam);
        const list: any[] = (db as any)[dbKey2] ?? [];
        const idx = list.findIndex((r: any) => r.id === rowId);
        if (idx !== -1) {
          const { password_hash: _ph, id: _id, ...safeUpdates } = updates;
          list[idx] = { ...list[idx], ...safeUpdates };
          (db as any)[dbKey2] = list;
          saveDb(db);
          return { success: true, rowCount: 1 };
        }
        return { success: false, rowCount: 0 };
      }
      if (action === 'delete_all_rows' && method === 'DELETE') {
        const tableParam = params.table as string;
        const dbKey2 = (db as any)[tableParam] !== undefined ? tableParam : snakeToCamel(tableParam);
        const prevLen = ((db as any)[dbKey2] ?? []).length;
        if ((db as any)[dbKey2]) { (db as any)[dbKey2] = []; saveDb(db); }
        return { success: true, rowCount: prevLen };
      }
      return { error: 'Azione db_inspector non supportata in mock' };
    }

    // ── app-users: bulk password reset ───────────────────────────────────────
    if (entity === 'app-users' && params.action === 'bulk_password_reset' && method === 'POST') {
      const { users: usersToUpdate } = JSON.parse(options.body as string);
      let successCount = 0; let failCount = 0;
      const usersList: any[] = (db as any).users || [];
      for (const { username, password } of (usersToUpdate || [])) {
        const idx = usersList.findIndex((u: any) => u.username === username);
        if (idx !== -1 && password && password.length >= 8) {
          usersList[idx] = { ...usersList[idx], mustChangePassword: true };
          successCount++;
        } else { failCount++; }
      }
      (db as any).users = usersList;
      saveDb(db);
      return { successCount, failCount };
    }

    const list = (db as any)[dbKey] || [];

    if (method === 'GET') return list;

    if (method === 'POST') {
      const body = JSON.parse(options.body as string);
      // Auto-codice HCR per resource_requests
      if (entity === 'resource_requests') {
        const existing: any[] = (db as any).resourceRequests || [];
        const maxNum = existing.reduce((max: number, r: any) => {
          const match = r.requestCode?.match(/\d+/);
          return match ? Math.max(max, parseInt(match[0])) : max;
        }, 0);
        const requestCode = `HCR${String(maxNum + 1).padStart(5, '0')}`;
        const newItem = { id: uuidv4(), version: 1, requestCode, ...body };
        if (!(db as any).resourceRequests) (db as any).resourceRequests = [];
        (db as any).resourceRequests.push(newItem);
        saveDb(db);
        return newItem;
      }
      const newItem = { id: uuidv4(), version: 1, ...body };
      if (!(db as any)[dbKey]) (db as any)[dbKey] = [];
      (db as any)[dbKey].push(newItem);
      saveDb(db);
      return newItem;
    }

    if (method === 'PUT') {
      const body = JSON.parse(options.body as string);
      const existing = list.find((i: any) => i.id === params.id);
      const nextVersion = (existing?.version ?? 0) + 1;
      const updated = { ...existing, ...body, id: params.id, version: nextVersion };
      (db as any)[dbKey] = list.map((i: any) => i.id === params.id ? updated : i);
      saveDb(db);
      return updated;
    }

    if (method === 'DELETE') {
      // Composite-key delete for contract_projects and contract_managers
      if (entity === 'contract_projects' && params.contractId && params.projectId) {
        (db as any).contractProjects = ((db as any).contractProjects || []).filter(
          (cp: any) => !(cp.contractId === params.contractId && cp.projectId === params.projectId)
        );
        saveDb(db);
        return null;
      }
      if (entity === 'contract_managers' && params.contractId && params.resourceId) {
        (db as any).contractManagers = ((db as any).contractManagers || []).filter(
          (cm: any) => !(cm.contractId === params.contractId && cm.resourceId === params.resourceId)
        );
        saveDb(db);
        return null;
      }
      if (entity === 'project_skills' && params.projectId && params.skillId) {
        (db as any).projectSkills = ((db as any).projectSkills || []).filter(
          (ps: any) => !(ps.projectId === params.projectId && ps.skillId === params.skillId)
        );
        saveDb(db);
        return null;
      }
      if (entity === 'resource_skills' && params.resourceId && params.skillId) {
        (db as any).resourceSkills = ((db as any).resourceSkills || []).filter(
          (rs: any) => !(rs.resourceId === params.resourceId && rs.skillId === params.skillId)
        );
        saveDb(db);
        return null;
      }
      (db as any)[dbKey] = list.filter((i: any) => i.id !== params.id);
      saveDb(db);
      return null;
    }
  }

  // ─── Staffing: allocazioni + assegnazioni ────────────────────────────────────
  if (path.endsWith('/api/staffing')) {
    if (params.action === 'allocation' && method === 'POST') {
      const { updates } = JSON.parse(options.body as string);
      if (Array.isArray(updates)) {
        if (!(db as any).allocations) (db as any).allocations = {};
        for (const { assignmentId, date, percentage } of updates) {
          if (!(db as any).allocations[assignmentId]) (db as any).allocations[assignmentId] = {};
          if (percentage === 0) {
            delete (db as any).allocations[assignmentId][date];
          } else {
            (db as any).allocations[assignmentId][date] = percentage;
          }
        }
        saveDb(db);
      }
      return { success: true };
    }
    if (params.action === 'assignment') {
      if (method === 'POST') {
        const body = JSON.parse(options.body as string);
        const { resourceId, projectId } = body;
        const existing = ((db as any).assignments || []).find((a: any) => a.resourceId === resourceId && a.projectId === projectId);
        if (existing) return { message: 'Exists', assignment: existing };
        const newItem = { id: uuidv4(), resourceId, projectId };
        if (!(db as any).assignments) (db as any).assignments = [];
        (db as any).assignments.push(newItem);
        saveDb(db);
        return newItem;
      }
      if (method === 'DELETE') {
        (db as any).assignments = ((db as any).assignments || []).filter((a: any) => a.id !== params.id);
        if ((db as any).allocations) delete (db as any).allocations[params.id];
        saveDb(db);
        return null;
      }
    }
  }

  // ─── Admin: test webhook ─────────────────────────────────────────────────────
  if (path.endsWith('/api/admin') && params.action === 'webhook-test' && method === 'POST') {
    return { success: true, statusCode: 200, responseBody: '(Simulato in modalità locale — nessuna richiesta reale inviata a Teams)' };
  }

  if (path.includes('/api/config')) {
      const type = params.type;
      const list = (db as any)[type] || [];
      if (method === 'POST') {
          const body = JSON.parse(options.body as string);
          const newItem = { id: uuidv4(), ...body };
          if (!(db as any)[type]) (db as any)[type] = [];
          (db as any)[type].push(newItem);
          saveDb(db);
          return newItem;
      }
      if (method === 'PUT') {
          const body = JSON.parse(options.body as string);
          (db as any)[type] = list.map((i: any) => i.id === params.id ? { ...i, ...body } : i);
          saveDb(db);
          return { id: params.id, ...body };
      }
      if (method === 'DELETE') {
          (db as any)[type] = list.filter((i: any) => i.id !== params.id);
          saveDb(db);
          return null;
      }
  }

  return [];
};
