
/**
 * @file api/data.ts
 * @description Endpoint API Dispatcher per recuperare i dati in base allo scope (metadata, planning, all).
 * Ottimizzato per evitare ricalcoli inutili dello schema DB.
 */

import { db } from './db.js';
import { ensureDbTablesExist } from './schema.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Client, Role, Resource, Project, Assignment, Allocation, ConfigOption, CalendarEvent, WbsTask, ResourceRequest, Interview, Contract, Skill, ResourceSkill, ProjectSkill, PageVisibility, RoleCostHistory, LeaveType, LeaveRequest, SkillCategory, SkillMacroCategory, BillingMilestone } from '../types';

// Flag globale per tracciare l'inizializzazione dello schema nel ciclo di vita della funzione serverless
let isSchemaInitialized = false;

/**
 * Converte un oggetto con chiavi in snake_case (dal DB) in un oggetto con chiavi in camelCase (per il frontend).
 */
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
        newObj[newKey] = obj[key];
    }
    return newObj;
}

/**
 * Gestore della richiesta API per l'endpoint /api/data.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const scope = (req.query.scope as string) || 'all';
    const start = req.query.start as string;
    const end = req.query.end as string;

    try {
        // Esegue il controllo delle tabelle solo una volta per istanza della serverless function
        if (!isSchemaInitialized) {
            await ensureDbTablesExist(db);
            isSchemaInitialized = true;
        }

        const data: any = {};

        // --- METADATA SCOPE (Lightweight) ---
        if (scope === 'metadata' || scope === 'all') {
             const [
                clientsRes,
                rolesRes,
                roleCostHistoryRes,
                resourcesRes,
                horizontalsRes,
                seniorityLevelsRes,
                projectStatusesRes,
                clientSectorsRes,
                locationsRes,
                calendarRes,
                skillsRes,
                resourceSkillsRes,
                pageVisibilityRes,
                skillThresholdsRes,
                projectsRes,
                leaveTypesRes,
                managersRes,
                sidebarConfigRes,
                sidebarSectionsRes,
                sidebarSectionColorsRes,
                sidebarFooterActionsRes,
                dashboardLayoutRes,
                roleHomePagesRes,
                bottomNavPathsRes,
                analyticsRes,
                skillCatsRes,
                skillMacrosRes,
                skillMapRes,
                catMacroMapRes,
                planningConfigRes
            ] = await Promise.all([
                db.sql`SELECT * FROM clients;`,
                db.sql`SELECT * FROM roles;`,
                db.sql`SELECT * FROM role_cost_history;`,
                db.sql`SELECT * FROM resources;`,
                db.sql`SELECT * FROM horizontals;`,
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
                db.sql`SELECT key, value FROM app_config WHERE key LIKE 'planning_range_%';`
            ]);

            const companyCalendar = calendarRes.rows.map(row => {
                const event = toCamelCase(row);
                if (event.date) {
                    event.date = new Date(event.date).toISOString().split('T')[0];
                }
                return event;
            }) as CalendarEvent[];

            const pageVisibility: PageVisibility = {};
            pageVisibilityRes.rows.forEach(row => {
                const path = row.key.replace('page_vis.', '');
                pageVisibility[path] = row.value === 'true';
            });

            const skillThresholds: any = {};
            skillThresholdsRes.rows.forEach(row => {
                const key = row.key.replace('skill_threshold.', '');
                skillThresholds[key] = parseFloat(row.value);
            });

            const planningSettings: any = { monthsBefore: 6, monthsAfter: 18 };
            planningConfigRes.rows.forEach(row => {
                if (row.key === 'planning_range_months_before') planningSettings.monthsBefore = parseInt(row.value, 10);
                if (row.key === 'planning_range_months_after') planningSettings.monthsAfter = parseInt(row.value, 10);
            });

            const parseJsonConfig = (res: any, fallback: any) => {
                if (res.rows.length === 0) return fallback;
                try { return JSON.parse(res.rows[0].value); } catch { return fallback; }
            };

            const sidebarConfig = parseJsonConfig(sidebarConfigRes, null);
            const sidebarSections = parseJsonConfig(sidebarSectionsRes, null);
            const sidebarSectionColors = parseJsonConfig(sidebarSectionColorsRes, {});
            const sidebarFooterActions = parseJsonConfig(sidebarFooterActionsRes, null);
            const dashboardLayout = parseJsonConfig(dashboardLayoutRes, null);
            const roleHomePages = parseJsonConfig(roleHomePagesRes, null);
            const bottomNavPaths = parseJsonConfig(bottomNavPathsRes, []);

            let analyticsCache = {};
            if (analyticsRes.rows.length > 0) analyticsCache = analyticsRes.rows[0].data;

            const managerResourceIds = managersRes.rows.map(r => r.resource_id);

            // --- SKILL HYDRATION ---
            const categories = skillCatsRes.rows.map(toCamelCase) as SkillCategory[];
            const macros = skillMacrosRes.rows.map(toCamelCase) as SkillMacroCategory[];
            const catMap = new Map(categories.map(c => [c.id, c]));
            const macroMap = new Map(macros.map(m => [m.id, m]));

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
                const skillCategories = catIds.map(id => catMap.get(id)).filter(Boolean) as SkillCategory[];
                const macroIds = new Set<string>();
                catIds.forEach(catId => {
                    const mIds = catMacroMap.get(catId);
                    if (mIds) mIds.forEach(mId => macroIds.add(mId));
                });
                const skillMacros = Array.from(macroIds).map(id => macroMap.get(id)).filter(Boolean) as SkillMacroCategory[];

                return {
                    ...skill,
                    categoryIds: catIds,
                    category: skillCategories.map(c => c.name).join(', '),
                    macroCategory: skillMacros.map(m => m.name).join(', ')
                };
            }) as Skill[];

            const hydratedCategories = categories.map(cat => ({
                ...cat,
                macroCategoryIds: Array.from(catMacroMap.get(cat.id) || [])
            }));

            Object.assign(data, {
                clients: clientsRes.rows.map(toCamelCase) as Client[],
                roles: rolesRes.rows.map(toCamelCase) as Role[],
                roleCostHistory: roleCostHistoryRes.rows.map(row => {
                    const h = toCamelCase(row);
                    if (h.startDate) h.startDate = new Date(h.startDate).toISOString().split('T')[0];
                    if (h.endDate) h.endDate = new Date(h.endDate).toISOString().split('T')[0];
                    return h;
                }) as RoleCostHistory[],
                resources: resourcesRes.rows.map(toCamelCase) as Resource[],
                projects: projectsRes.rows.map(row => {
                    const project = toCamelCase(row);
                    if (project.startDate) project.startDate = new Date(project.startDate).toISOString().split('T')[0];
                    if (project.endDate) project.endDate = new Date(project.endDate).toISOString().split('T')[0];
                    return project;
                }) as Project[],
                horizontals: horizontalsRes.rows as ConfigOption[],
                seniorityLevels: seniorityLevelsRes.rows as ConfigOption[],
                projectStatuses: projectStatusesRes.rows as ConfigOption[],
                clientSectors: clientSectorsRes.rows as ConfigOption[],
                locations: locationsRes.rows as ConfigOption[],
                companyCalendar,
                skills,
                skillCategories: hydratedCategories,
                skillMacroCategories: macros,
                resourceSkills: resourceSkillsRes.rows.map(toCamelCase) as ResourceSkill[],
                pageVisibility,
                skillThresholds,
                planningSettings,
                leaveTypes: leaveTypesRes.rows.map(toCamelCase) as LeaveType[],
                managerResourceIds,
                sidebarConfig,
                sidebarSections,
                sidebarSectionColors,
                sidebarFooterActions,
                dashboardLayout,
                roleHomePages,
                bottomNavPaths,
                analyticsCache
            });
        }

        // --- PLANNING SCOPE (Heavy) ---
        if (scope === 'planning' || scope === 'all') {
            let allocationsQueryPromise;
            let leaveRequestsQueryPromise;
            if (start && end) {
                allocationsQueryPromise = db.query(`SELECT * FROM allocations WHERE allocation_date >= $1 AND allocation_date <= $2`, [start, end]);
                leaveRequestsQueryPromise = db.query(`SELECT * FROM leave_requests WHERE end_date >= $1 AND start_date <= $2`, [start, end]);
            } else {
                allocationsQueryPromise = db.sql`SELECT * FROM allocations;`;
                leaveRequestsQueryPromise = db.sql`SELECT * FROM leave_requests;`;
            }

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
                const dateStr = new Date(allocation_date).toISOString().split('T')[0];
                if (!allocations[assignment_id]) {
                    allocations[assignment_id] = {};
                }
                allocations[assignment_id][dateStr] = percentage;
            });

            Object.assign(data, {
                assignments: assignmentsRes.rows.map(toCamelCase) as Assignment[],
                allocations,
                wbsTasks: wbsTasksRes.rows.map(toCamelCase) as WbsTask[],
                resourceRequests: resourceRequestsRes.rows.map(toCamelCase) as ResourceRequest[],
                interviews: interviewsRes.rows.map(toCamelCase) as Interview[],
                contracts: contractsRes.rows.map(row => {
                    const contract = toCamelCase(row);
                    if (contract.startDate) contract.startDate = new Date(contract.startDate).toISOString().split('T')[0];
                    if (contract.endDate) contract.endDate = new Date(contract.endDate).toISOString().split('T')[0];
                    return contract;
                }) as Contract[],
                contractProjects: contractProjectsRes.rows.map(toCamelCase),
                contractManagers: contractManagersRes.rows.map(toCamelCase),
                projectSkills: projectSkillsRes.rows.map(toCamelCase) as ProjectSkill[],
                leaveRequests: leaveRequestsRes.rows.map(row => {
                    const req = toCamelCase(row);
                    if (req.startDate) req.startDate = new Date(req.startDate).toISOString().split('T')[0];
                    if (req.endDate) req.endDate = new Date(req.endDate).toISOString().split('T')[0];
                    return req;
                }) as LeaveRequest[],
                billingMilestones: billingMilestonesRes.rows.map(row => {
                    const bm = toCamelCase(row);
                    if(bm.date) bm.date = new Date(bm.date).toISOString().split('T')[0];
                    return bm;
                }) as BillingMilestone[]
            });
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error('Failed to fetch data:', error);
        return res.status(500).json({ error: 'Failed to fetch data' });
    }
}
