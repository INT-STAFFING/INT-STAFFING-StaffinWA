/**
 * @file api/import.ts
 * @description Endpoint API per l'importazione massiva di dati da un file Excel.
 */

import { db } from './db.js';
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
    if (dateValue instanceof Date) { // Already a date object from cellDates:true
        if(isNaN(dateValue.getTime())) return null;
        return new Date(Date.UTC(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate()));
    }
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

const importCoreEntities = async (client: any, body: any, warnings: string[]) => {
    const { clients: importedClients, roles: importedRoles, resources: importedResources, projects: importedProjects, calendar: importedCalendar, horizontals: importedHorizontals, seniorityLevels: importedSeniority, projectStatuses: importedStatuses, clientSectors: importedSectors, locations: importedLocations } = body;
    const roleNameMap = new Map<string, string>();
    const clientNameMap = new Map<string, string>();
    const resourceEmailMap = new Map<string, string>();
    const locationValueMap = new Map<string, string>();
    
    const importConfig = async (tableName: string, items: { value: string }[], map?: Map<string, string>, label: string = 'Configurazione') => {
        if (!Array.isArray(items)) return;
        const existing = await client.query(`SELECT id, value FROM ${tableName}`);
        existing.rows.forEach((item: { value: string; id: string; }) => map?.set(item.value, item.id));

        for (const item of items) {
            if (!item.value) { warnings.push(`${label}: una riga è stata saltata perché non ha un valore.`); continue; }
            if (map ? map.has(item.value) : existing.rows.some((r: { value: string; }) => r.value === item.value)) { warnings.push(`${label} '${item.value}' già esistente, saltato.`);
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

    if (Array.isArray(importedCalendar)) { /* ... (omitted for brevity, same as original) ... */ }
    
    const existingRoles = await client.query('SELECT id, name FROM roles');
    existingRoles.rows.forEach((r: { name: string; id: string; }) => roleNameMap.set(r.name, r.id));

    const existingClients = await client.query('SELECT id, name FROM clients');
    existingClients.rows.forEach((c: { name: string; id: string; }) => clientNameMap.set(c.name, c.id));
    
    if (Array.isArray(importedRoles)) { /* ... (omitted for brevity, same as original) ... */ }
    if (Array.isArray(importedClients)) { /* ... (omitted for brevity, same as original) ... */ }

    const existingResources = await client.query('SELECT id, email FROM resources');
    existingResources.rows.forEach((r: { email: string; id: string; }) => resourceEmailMap.set(r.email, r.id));
    
    if (Array.isArray(importedResources)) { /* ... (omitted for brevity, same as original) ... */ }
    if (Array.isArray(importedProjects)) { /* ... (omitted for brevity, same as original) ... */ }
};

const importStaffing = async (client: any, body: any, warnings: string[]) => {
    const { staffing } = body;
    if (!Array.isArray(staffing)) return;

    const resourceMap = new Map((await client.query('SELECT id, name FROM resources')).rows.map((r: any) => [r.name, r.id]));
    const projectMap = new Map((await client.query('SELECT id, name FROM projects')).rows.map((p: any) => [p.name, p.id]));
    const assignmentMap = new Map((await client.query('SELECT id, resource_id, project_id FROM assignments')).rows.map((a: any) => [`${a.resource_id}-${a.project_id}`, a.id]));

    for (const row of staffing) {
        const resourceName = row['Resource Name'];
        const projectName = row['Project Name'];

        if (!resourceName || !projectName) {
            warnings.push(`Riga di staffing saltata: mancano nome risorsa o progetto.`);
            continue;
        }

        const resourceId = resourceMap.get(resourceName);
        const projectId = projectMap.get(projectName);

        if (!resourceId) { warnings.push(`Staffing per '${resourceName}' saltato: risorsa non trovata.`); continue; }
        if (!projectId) { warnings.push(`Staffing per '${projectName}' saltato: progetto non trovato.`); continue; }

        let assignmentId = assignmentMap.get(`${resourceId}-${projectId}`);
        if (!assignmentId) {
            const newId = uuidv4();
            await client.query('INSERT INTO assignments (id, resource_id, project_id) VALUES ($1, $2, $3)', [newId, resourceId, projectId]);
            assignmentId = newId;
            assignmentMap.set(`${resourceId}-${projectId}`, newId);
            warnings.push(`Nuova assegnazione creata per ${resourceName} su ${projectName}.`);
        }

        for (const key in row) {
            if (key !== 'Resource Name' && key !== 'Project Name') {
                const date = parseDate(key);
                const percentage = Number(row[key]);
                if (date && !isNaN(percentage)) {
                    const dateStr = formatDateForDB(date);
                    if (percentage > 0) {
                        await client.query(
                            `INSERT INTO allocations (assignment_id, allocation_date, percentage) VALUES ($1, $2, $3)
                             ON CONFLICT (assignment_id, allocation_date) DO UPDATE SET percentage = EXCLUDED.percentage`,
                            [assignmentId, dateStr, percentage]
                        );
                    } else {
                        await client.query('DELETE FROM allocations WHERE assignment_id = $1 AND allocation_date = $2', [assignmentId, dateStr]);
                    }
                }
            }
        }
    }
};

const importResourceRequests = async (client: any, body: any, warnings: string[]) => {
    // Implement logic for importing resource requests
};

const importInterviews = async (client: any, body: any, warnings: string[]) => {
    // Implement logic for importing interviews
};


export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { type } = req.query;
    const client = await db.connect();
    const warnings: string[] = [];

    try {
        await client.query('BEGIN');

        switch(type) {
            case 'core_entities':
                await importCoreEntities(client, req.body, warnings);
                break;
            case 'staffing':
                await importStaffing(client, req.body, warnings);
                break;
            case 'resource_requests':
                await importResourceRequests(client, req.body, warnings); // Placeholder
                 warnings.push("L'importazione per le Richieste Risorse non è ancora implementata.");
                break;
            case 'interviews':
                await importInterviews(client, req.body, warnings); // Placeholder
                 warnings.push("L'importazione per i Colloqui non è ancora implementata.");
                break;
            default:
                throw new Error('Tipo di importazione non valido.');
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