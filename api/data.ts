
/**
 * @file api/data.ts
 * @description Endpoint API Dispatcher per recuperare i dati.
 */

import { db } from './_lib/db.js';
import { ensureDbTablesExist } from './_lib/schema.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { CalendarEvent, Allocation } from '../types';

let isSchemaInitialized = false;

const toCamelCase = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(toCamelCase);
    }
    const newObj: any = {};
    for (const key in obj) {
        const newKey = key.replace(/(_\w)/g, k => k[1].toUpperCase());
        let value = obj[key];

        // FIX DATE: Normalizzazione sicura Date -> Stringa YYYY-MM-DD
        if (value instanceof Date && 
           (newKey.endsWith('Date') || newKey === 'date' || newKey === 'lastDayOfWork')) {
            const y = value.getFullYear();
            const m = String(value.getMonth() + 1).padStart(2, '0');
            const d = String(value.getDate()).padStart(2, '0');
            value = `${y}-${m}-${d}`;
        }
        
        newObj[newKey] = value;
    }
    return newObj;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const scope = (req.query.scope as string) || 'all';
    const start = req.query.start as string;
    const end = req.query.end as string;

    try {
        if (!isSchemaInitialized) {
            await ensureDbTablesExist(db);
            isSchemaInitialized = true;
        }

        const data: any = {};

        // --- METADATA SCOPE ---
        if (scope === 'metadata' || scope === 'all') {
             const [
                clientsRes, rolesRes, roleCostHistoryRes, resourcesRes, functionsRes,
                industriesRes, seniorityLevelsRes, projectStatusesRes, clientSectorsRes, locationsRes,
                calendarRes, skillsRes, resourceSkillsRes, pageVisibilityRes,
                skillThresholdsRes, projectsRes, leaveTypesRes, managersRes,
                sidebarConfigRes, quickActionsRes, sidebarSectionsRes, sidebarSectionColorsRes,
                sidebarFooterActionsRes, dashboardLayoutRes, roleHomePagesRes,
                bottomNavPathsRes, analyticsRes, skillCatsRes, skillMacrosRes,
                skillMapRes, catMacroMapRes, planningConfigRes,
                rateCardsRes, rateCardEntriesRes, projectExpensesRes, notificationConfigsRes
            ] = await Promise.all([
                db.sql`SELECT * FROM clients;`,
                db.sql`SELECT * FROM roles;`,
                db.sql`SELECT * FROM role_cost_history;`,
                db.sql`SELECT * FROM resources;`,
                db.sql`SELECT * FROM functions;`, // Ridenominato
                db.sql`SELECT * FROM industries;`, // Aggiunto
                db.sql`SELECT * FROM seniority_levels;`,
                db.sql`SELECT * FROM project_statuses;`,
                db.sql`SELECT * FROM client_sectors;`,
                db.sql`SELECT * FROM locations;`,
                db.sql`SELECT * FROM company_calendar;`,
                db.sql`SELECT * FROM skills;`,
                db.sql`SELECT * FROM resource_skills;`,
                db.sql`SELECT key, value FROM app_config WHERE key LIKE 'page_vis.%';`,
                db.sql`SELECT key, value FROM app_config WHERE key LIKE 'skill_threshold.%';`,
                db.sql`SELECT * FROM projects;`,
                db.sql`SELECT * FROM leave_types;`,
                db.sql`SELECT DISTINCT resource_id FROM app_users WHERE role IN ('MANAGER', 'ADMIN') AND resource_id IS NOT NULL;`,
                db.sql`SELECT value FROM app_config WHERE key = 'sidebar_layout_v1';`,
                db.sql`SELECT value FROM app_config WHERE key = 'quick_actions_v1';`,
                db.sql`SELECT value FROM app_config WHERE key = 'sidebar_sections_v1';`,
                db.sql`SELECT value FROM app_config WHERE key = 'sidebar_section_colors';`,
                db.sql`SELECT value FROM app_config WHERE key = 'sidebar_footer_actions_v1';`,
                db.sql`SELECT value FROM app_config WHERE key = 'dashboard_layout_v2';`,
                db.sql`SELECT value FROM app_config WHERE key = 'role_home_pages_v1';`,
                db.sql`SELECT value FROM app_config WHERE key = 'bottom_nav_paths_v1';`,
                db.sql`SELECT * FROM analytics_cache WHERE key = 'dashboard_kpi_current';`,
                db.sql`SELECT * FROM skill_categories;`,
                db.sql`SELECT * FROM skill_macro_categories;`,
                db.sql`SELECT * FROM skill_skill_category_map;`,
                db.sql`SELECT * FROM skill_category_macro_map;`,
                db.sql`SELECT key, value FROM app_config WHERE key LIKE 'planning_range_%';`,
                db.sql`SELECT * FROM rate_cards;`,
                db.sql`SELECT * FROM rate_card_entries;`,
                db.sql`SELECT * FROM project_expenses;`,
                db.sql`SELECT * FROM notification_configs;`
            ]);

            const companyCalendar = calendarRes.rows.map(toCamelCase) as CalendarEvent[];

            const pageVisibility: any = {};
            pageVisibilityRes.rows.forEach(row => pageVisibility[row.key.replace('page_vis.', '')] = row.value === 'true');

            const skillThresholds: any = {};
            skillThresholdsRes.rows.forEach(row => skillThresholds[row.key.replace('skill_threshold.', '')] = parseFloat(row.value));

            const planningSettings: any = { monthsBefore: 6, monthsAfter: 18 };
            planningConfigRes.rows.forEach(row => {
                if (row.key === 'planning_range_months_before') planningSettings.monthsBefore = parseInt(row.value, 10);
                if (row.key === 'planning_range_months_after') planningSettings.monthsAfter = parseInt(row.value, 10);
            });

            const parseJsonConfig = (res: any, fallback: any) => {
                if (res.rows.length === 0) return fallback;
                try { return JSON.parse(res.rows[0].value); } catch { return fallback; }
            };

            const analyticsCache = analyticsRes.rows.length > 0 ? analyticsRes.rows[0].data : {};

            const categories = skillCatsRes.rows.map(toCamelCase);
            const macros = skillMacrosRes.rows.map(toCamelCase);
            const catMap = new Map(categories.map((c: any) => [c.id, c]));
            const macroMap = new Map(macros.map((m: any) => [m.id, m]));
            const catMacroMap = new Map<string, Set<string>>();
            catMacroMapRes.rows.forEach(r => {
                if (!catMacroMap.has(r.category_id)) catMacroMap.set(r.category_id, new Set());
                catMacroMap.get(r.category_id)?.add(r.macro_category_id);
            });
            const skillCatMap = new Map<string, Set<string>>();
            skillMapRes.rows.forEach(r => {
                if (!skillCatMap.has(r.skill_id)) skillCatMap.set(r.skill_id, new Set());
                skillCatMap.get(r.skill_id)?.add(r.category_id);
            });
            
            const skills = skillsRes.rows.map(row => {
                const skill = toCamelCase(row);
                const catIds = Array.from(skillCatMap.get(skill.id) || []);
                const skillCategories = catIds.map(id => catMap.get(id)).filter(Boolean);
                const macroIds = new Set<string>();
                catIds.forEach(catId => {
                    const mIds = catMacroMap.get(catId);
                    if (mIds) mIds.forEach(mId => macroIds.add(mId));
                });
                const skillMacros = Array.from(macroIds).map(id => macroMap.get(id)).filter(Boolean);
                return {
                    ...skill,
                    categoryIds: catIds,
                    category: skillCategories.map((c: any) => c.name).join(', '),
                    macroCategory: skillMacros.map((m: any) => m.name).join(', ')
                };
            });
            const hydratedCategories = categories.map((cat: any) => ({
                ...cat,
                macroCategoryIds: Array.from(catMacroMap.get(cat.id) || [])
            }));

            Object.assign(data, {
                clients: clientsRes.rows.map(toCamelCase),
                roles: rolesRes.rows.map(toCamelCase),
                roleCostHistory: roleCostHistoryRes.rows.map(toCamelCase),
                resources: resourcesRes.rows.map(toCamelCase),
                projects: projectsRes.rows.map(toCamelCase),
                functions: functionsRes.rows, // Ridenominato
                industries: industriesRes.rows, // Aggiunto
                seniorityLevels: seniorityLevelsRes.rows,
                projectStatuses: projectStatusesRes.rows,
                clientSectors: clientSectorsRes.rows,
                locations: locationsRes.rows,
                companyCalendar,
                skills,
                skillCategories: hydratedCategories,
                skillMacroCategories: macros,
                resourceSkills: resourceSkillsRes.rows.map(toCamelCase),
                pageVisibility,
                skillThresholds,
                planningSettings,
                leaveTypes: leaveTypesRes.rows.map(toCamelCase),
                managerResourceIds: managersRes.rows.map(r => r.resource_id),
                sidebarConfig: parseJsonConfig(sidebarConfigRes, null),
                quickActions: parseJsonConfig(quickActionsRes, null),
                sidebarSections: parseJsonConfig(sidebarSectionsRes, null),
                sidebarSectionColors: parseJsonConfig(sidebarSectionColorsRes, {}),
                sidebarFooterActions: parseJsonConfig(sidebarFooterActionsRes, null),
                dashboardLayout: parseJsonConfig(dashboardLayoutRes, null),
                roleHomePages: parseJsonConfig(roleHomePagesRes, null),
                bottomNavPaths: parseJsonConfig(bottomNavPathsRes, []),
                analyticsCache,
                rateCards: rateCardsRes.rows.map(toCamelCase),
                rateCardEntries: rateCardEntriesRes.rows.map(toCamelCase),
                projectExpenses: projectExpensesRes.rows.map(toCamelCase),
                notificationConfigs: notificationConfigsRes.rows.map(toCamelCase),
            });
        }

        // --- PLANNING SCOPE ---
        if (scope === 'planning' || scope === 'all') {
            let allocationsQueryPromise;
            let leaveRequestsQueryPromise;
            
            if (start && end) {
                allocationsQueryPromise = db.query(`SELECT * FROM allocations WHERE allocation_date >= $1 AND allocation_date <= $2`, [start, end]);
            } else {
                allocationsQueryPromise = db.sql`SELECT * FROM allocations;`;
            }
            
            leaveRequestsQueryPromise = db.sql`SELECT * FROM leave_requests ORDER BY start_date DESC;`;

            const [
                assignmentsRes,
                allocationsRes,
                wbsTasksRes,
                resourceRequestsRes,
                interviewsRes,
                contractsRes,
                contractProjectsRes,
                contractManagersRes,
                projectSkillsRes,
                leaveRequestsRes,
                billingMilestonesRes
            ] = await Promise.all([
                db.sql`SELECT * FROM assignments;`,
                allocationsQueryPromise,
                db.sql`SELECT * FROM wbs_tasks;`,
                db.sql`SELECT * FROM resource_requests;`,
                db.sql`SELECT * FROM interviews;`,
                db.sql`SELECT * FROM contracts;`,
                db.sql`SELECT * FROM contract_projects;`,
                db.sql`SELECT * FROM contract_managers;`,
                db.sql`SELECT * FROM project_skills;`,
                leaveRequestsQueryPromise,
                db.sql`SELECT * FROM billing_milestones;`
            ]);

            const allocations: Allocation = {};
            allocationsRes.rows.forEach(row => {
                const { assignment_id, allocation_date, percentage } = row;
                const y = allocation_date.getFullYear();
                const m = String(allocation_date.getMonth() + 1).padStart(2, '0');
                const d = String(allocation_date.getDate()).padStart(2, '0');
                const dateStr = `${y}-${m}-${d}`;

                if (!allocations[assignment_id]) {
                    allocations[assignment_id] = {};
                }
                allocations[assignment_id][dateStr] = percentage;
            });

            Object.assign(data, {
                assignments: assignmentsRes.rows.map(toCamelCase),
                allocations,
                wbsTasks: wbsTasksRes.rows.map(toCamelCase),
                resourceRequests: resourceRequestsRes.rows.map(toCamelCase),
                interviews: interviewsRes.rows.map(toCamelCase),
                contracts: contractsRes.rows.map(toCamelCase),
                contractProjects: contractProjectsRes.rows.map(toCamelCase),
                contractManagers: contractManagersRes.rows.map(toCamelCase),
                projectSkills: projectSkillsRes.rows.map(toCamelCase),
                leaveRequests: leaveRequestsRes.rows.map(toCamelCase),
                billingMilestones: billingMilestonesRes.rows.map(toCamelCase)
            });
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error('Failed to fetch data:', error);
        return res.status(500).json({ error: 'Failed to fetch data' });
    }
}
