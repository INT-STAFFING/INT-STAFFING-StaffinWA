/**
 * @file api/import.ts
 * @description Endpoint API per l'importazione massiva di dati da un file Excel.
 */

import { db } from './db';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';

/**
 * Esegue il parsing di un valore data proveniente da Excel, gestendo sia i numeri seriali
 * che i formati stringa comuni, e lo converte in un oggetto Date JavaScript.
 * La conversione viene fatta in UTC per evitare problemi di fuso orario.
 * @param {any} dateValue - Il valore della cella Excel da parsare (può essere numero o stringa).
 * @returns {Date | null} Un oggetto Date in UTC o null se il valore non è valido.
 */
const parseDate = (dateValue: any): Date | null => {
    if (!dateValue) return null;

    if (typeof dateValue === 'number') {
       const utc_days  = Math.floor(dateValue - 25569);
       const utc_value = utc_days * 86400;                                        
       const date_info = new Date(utc_value * 1000);
       return new Date(Date.UTC(date_info.getUTCFullYear(), date_info.getUTCMonth(), date_info.getUTCDate()));
    }

    if (typeof dateValue === 'string') {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
            return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
        }
    }
    
    return null;
}

/**
 * Formatta un oggetto Date nel formato stringa "YYYY-MM-DD" richiesto dal database.
 * @param {Date | null} date - L'oggetto Date da formattare.
 * @returns {string | null} La data formattata o null se l'input è nullo.
 */
const formatDateForDB = (date: Date | null): string | null => {
    if (!date || isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
};

/**
 * Gestore della richiesta API per l'endpoint /api/import.
 * Riceve i dati estratti da un file Excel e li inserisce nel database in modo massivo.
 * Utilizza una transazione per garantire l'integrità dei dati.
 * @param {VercelRequest} req - L'oggetto della richiesta Vercel.
 * @param {VercelResponse} res - L'oggetto della risposta Vercel.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { 
        clients: importedClients, roles: importedRoles, resources: importedResources, projects: importedProjects,
        calendar: importedCalendar, horizontals: importedHorizontals, seniorityLevels: importedSeniority,
        projectStatuses: importedStatuses, clientSectors: importedSectors, locations: importedLocations
    } = req.body;
    
    const client = await db.connect();
    const warnings: string[] = [];

    try {
        await client.query('BEGIN');

        // Mappe per tenere traccia degli ID e dei valori
        const roleNameMap = new Map<string, string>();
        const clientNameMap = new Map<string, string>();
        const resourceEmailMap = new Map<string, string>();
        const locationValueMap = new Map<string, string>();
        
        // --- 1. Importa tutte le tabelle di configurazione ---
        const importConfig = async (tableName: string, items: { value: string }[], map?: Map<string, string>, label: string = 'Configurazione') => {
            if (!Array.isArray(items)) return;
            const existing = await client.query(`SELECT id, value FROM ${tableName}`);
            existing.rows.forEach(item => map?.set(item.value, item.id));

            for (const item of items) {
                if (!item.value) {
                    warnings.push(`${label}: una riga è stata saltata perché non ha un valore.`);
                    continue;
                }
                if (map ? map.has(item.value) : existing.rows.some(r => r.value === item.value)) {
                    warnings.push(`${label} '${item.value}' già esistente, saltato.`);
                } else {
                    const newId = uuidv4();
                    await client.query(`INSERT INTO ${tableName} (id, value) VALUES ($1, $2)`, [newId, item.value]);
                    map?.set(item.value, newId);
                }
            }
        };

        await importConfig('horizontals', importedHorizontals, undefined, 'Horizontal');
        await importConfig('seniority_levels', importedSeniority, undefined, 'Seniority Level');
        await importConfig('project_statuses', importedStatuses, undefined, 'Stato Progetto');
        await importConfig('client_sectors', importedSectors, undefined, 'Settore Cliente');
        await importConfig('locations', importedLocations, locationValueMap, 'Sede');

        // --- 2. Importa Calendario ---
        if (Array.isArray(importedCalendar)) {
            const existingEvents = await client.query('SELECT date, location FROM company_calendar');
            const existingEventSet = new Set(existingEvents.rows.map(e => `${formatDateForDB(new Date(e.date))}:${e.location || 'null'}`));

            for (const event of importedCalendar) {
                if (!event.name || !event.date || !event.type) {
                    warnings.push(`Evento calendario '${event.name || 'Senza Nome'}' saltato per dati mancanti.`);
                    continue;
                }
                const parsedDate = parseDate(event.date);
                if (!parsedDate) {
                    warnings.push(`Evento '${event.name}' saltato: formato data non valido.`);
                    continue;
                }
                const dateStr = formatDateForDB(parsedDate);
                const eventKey = `${dateStr}:${event.location || 'null'}`;
                if (existingEventSet.has(eventKey)) {
                    warnings.push(`Evento '${event.name}' in data ${dateStr} già esistente, saltato.`);
                } else {
                    await client.query(
                        'INSERT INTO company_calendar (id, name, date, type, location) VALUES ($1, $2, $3, $4, $5)',
                        [uuidv4(), event.name, dateStr, event.type, event.type === 'LOCAL_HOLIDAY' ? event.location : null]
                    );
                    existingEventSet.add(eventKey);
                }
            }
        }
        
        // --- 3. Importa Entità Principali ---
        const existingRoles = await client.query('SELECT id, name FROM roles');
        existingRoles.rows.forEach(r => roleNameMap.set(r.name, r.id));

        const existingClients = await client.query('SELECT id, name FROM clients');
        existingClients.rows.forEach(c => clientNameMap.set(c.name, c.id));
        
        if (Array.isArray(importedRoles)) {
            for (const role of importedRoles) {
                if (!role.name) { warnings.push(`Un ruolo è stato saltato perché non ha un nome.`); continue; }
                if (!roleNameMap.has(role.name)) {
                    const newId = uuidv4();
                    const dailyCost = Number(role.dailyCost) || 0;
                    const standardCost = Number(role.standardCost) || dailyCost;
                    const dailyExpenses = dailyCost * 0.035;
                    await client.query(
                        'INSERT INTO roles (id, name, seniority_level, daily_cost, standard_cost, daily_expenses) VALUES ($1, $2, $3, $4, $5, $6)',
                        [newId, role.name, role.seniorityLevel, dailyCost, standardCost, dailyExpenses]
                    );
                    roleNameMap.set(role.name, newId);
                } else { warnings.push(`Ruolo '${role.name}' già esistente, saltato.`); }
            }
        }
        if (Array.isArray(importedClients)) {
            for (const c of importedClients) {
                if (!c.name) { warnings.push(`Un cliente è stato saltato perché non ha un nome.`); continue; }
                if (!clientNameMap.has(c.name)) {
                    const newId = uuidv4();
                    await client.query('INSERT INTO clients (id, name, sector, contact_email) VALUES ($1, $2, $3, $4)', [newId, c.name, c.sector, c.contactEmail]);
                    clientNameMap.set(c.name, newId);
                } else { warnings.push(`Cliente '${c.name}' già esistente, saltato.`); }
            }
        }

        const existingResources = await client.query('SELECT id, email FROM resources');
        existingResources.rows.forEach(r => resourceEmailMap.set(r.email, r.id));
        
        if (Array.isArray(importedResources)) {
            for (const resource of importedResources) {
                if (!resource.email) { warnings.push(`Risorsa '${resource.name || 'Senza nome'}' saltata perché non ha un'email.`); continue; }
                if (!resourceEmailMap.has(resource.email)) {
                    const roleId = roleNameMap.get(resource.roleName);
                    if (!roleId) { warnings.push(`Risorsa '${resource.name}' saltata: il ruolo '${resource.roleName}' non è stato trovato.`); continue; }
                    const newId = uuidv4();
                    await client.query(`INSERT INTO resources (id, name, email, role_id, horizontal, location, hire_date, work_seniority, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                        [newId, resource.name, resource.email, roleId, resource.horizontal, resource.location, formatDateForDB(parseDate(resource.hireDate)), Number(resource.workSeniority) || 0, resource.notes]);
                    resourceEmailMap.set(resource.email, newId);
                } else { warnings.push(`Risorsa con email '${resource.email}' già esistente, saltata.`); }
            }
        }

        if (Array.isArray(importedProjects)) {
            for (const project of importedProjects) {
                if (!project.name) { warnings.push(`Un progetto è stato saltato perché non ha un nome.`); continue; }
                const clientId = clientNameMap.get(project.clientName);
                if (project.clientName && !clientId) { warnings.push(`Progetto '${project.name}' saltato: il cliente '${project.clientName}' non è stato trovato.`); continue; }
                const existingCheck = await client.query('SELECT id FROM projects WHERE name = $1 AND (client_id = $2 OR (client_id IS NULL AND $2 IS NULL))', [project.name, clientId || null]);
                if (existingCheck.rows.length > 0) { warnings.push(`Progetto '${project.name}' per il cliente '${project.clientName || 'Nessuno'}' già esistente, saltato.`);
                } else {
                    await client.query(`INSERT INTO projects (id, name, client_id, start_date, end_date, budget, realization_percentage, project_manager, status, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                        [uuidv4(), project.name, clientId || null, formatDateForDB(parseDate(project.startDate)), formatDateForDB(parseDate(project.endDate)), Number(project.budget) || 0, Number(project.realizationPercentage) || 100, project.projectManager, project.status, project.notes]);
                }
            }
        }
        
        await client.query('COMMIT');
        res.status(200).json({ message: 'Importazione completata con successo.', warnings });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Import failed:', error);
        res.status(500).json({ error: (error as Error).message });
    } finally {
        client.release();
    }
}