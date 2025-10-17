/**
 * @file api/data.ts
 * @description Endpoint API per recuperare tutti i dati iniziali. Utilizza una strategia di "lazy initialization":
 * tenta di recuperare i dati e, solo se le tabelle non esistono, procede a crearle e ritenta.
 * Questo ottimizza le performance per tutte le richieste successive alla prima, risolvendo i problemi di timeout.
 */

import { db } from './db';
import { ensureDbTablesExist } from './schema';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Client, Role, Resource, Project, Assignment, Allocation, ConfigOption, CalendarEvent } from '../types';

/**
 * Converte un oggetto con chiavi in snake_case (dal DB) in un oggetto con chiavi in camelCase (per il frontend).
 * @param {any} obj - L'oggetto da convertire.
 * @returns {any} Il nuovo oggetto con chiavi in camelCase.
 */
const toCamelCase = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (obj instanceof Date) {
        return obj;
    }
    const newObj: any = {};
    for (const key in obj) {
        const newKey = key.replace(/(_\w)/g, k => k[1].toUpperCase());
        newObj[newKey] = obj[key];
    }
    return newObj;
}

/**
 * Recupera ed elabora tutti i dati dell'applicazione dal database.
 */
const fetchAndProcessData = async () => {
    const [
        clientsRes,
        rolesRes,
        resourcesRes,
        projectsRes,
        assignmentsRes,
        allocationsRes,
        horizontalsRes,
        seniorityLevelsRes,
        projectStatusesRes,
        clientSectorsRes,
        locationsRes,
        calendarRes,
    ] = await Promise.all([
        db.query('SELECT * FROM clients;'),
        db.query('SELECT * FROM roles;'),
        db.query('SELECT * FROM resources;'),
        db.query('SELECT * FROM projects;'),
        db.query('SELECT * FROM assignments;'),
        db.query('SELECT * FROM allocations;'),
        db.query('SELECT * FROM horizontals;'),
        db.query('SELECT * FROM seniority_levels;'),
        db.query('SELECT * FROM project_statuses;'),
        db.query('SELECT * FROM client_sectors;'),
        db.query('SELECT * FROM locations;'),
        db.query('SELECT * FROM company_calendar;'),
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

    const companyCalendar = calendarRes.rows.map(row => {
        const event = toCamelCase(row);
        if (event.date) {
            event.date = new Date(event.date).toISOString().split('T')[0];
        }
        return event;
    }) as CalendarEvent[];

    return {
        clients: clientsRes.rows.map(toCamelCase) as Client[],
        roles: rolesRes.rows.map(toCamelCase) as Role[],
        resources: resourcesRes.rows.map(row => {
            const resource = toCamelCase(row);
            if (resource.hireDate) {
                resource.hireDate = new Date(resource.hireDate).toISOString().split('T')[0];
            }
            return resource;
        }) as Resource[],
        projects: projectsRes.rows.map(row => {
            const project = toCamelCase(row);
            if (project.startDate) {
                project.startDate = new Date(project.startDate).toISOString().split('T')[0];
            }
            if (project.endDate) {
                project.endDate = new Date(project.endDate).toISOString().split('T')[0];
            }
            return project;
        }) as Project[],
        assignments: assignmentsRes.rows.map(toCamelCase) as Assignment[],
        allocations,
        horizontals: horizontalsRes.rows as ConfigOption[],
        seniorityLevels: seniorityLevelsRes.rows as ConfigOption[],
        projectStatuses: projectStatusesRes.rows as ConfigOption[],
        clientSectors: clientSectorsRes.rows as ConfigOption[],
        locations: locationsRes.rows as ConfigOption[],
        companyCalendar,
    };
};

/**
 * Gestore della richiesta API per l'endpoint /api/data.
 * Risponde solo a richieste GET.
 * Utilizza una strategia di "lazy initialization": tenta di recuperare i dati. Se fallisce perché
 * le tabelle non esistono, le crea e ritenta il recupero. Questo ottimizza le performance per
 * tutte le richieste successive alla prima.
 * @param {VercelRequest} req - L'oggetto della richiesta Vercel.
 * @param {VercelResponse} res - L'oggetto della risposta Vercel.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        const data = await fetchAndProcessData();
        return res.status(200).json(data);
    } catch (error) {
        // Se l'errore è "relation does not exist", le tabelle non sono ancora state create.
        // Inizializziamo lo schema e poi ritentiamo il fetch dei dati.
        if (error instanceof Error && error.message.includes('relation') && error.message.includes('does not exist')) {
            console.log('Database tables not found. Initializing schema for the first time...');
            try {
                await ensureDbTablesExist(db);
                console.log('Schema initialized successfully. Retrying data fetch...');
                // Ritenta il fetch. Al primo avvio, questo restituirà array vuoti, il che è corretto.
                const data = await fetchAndProcessData();
                return res.status(200).json(data);
            } catch (retryError) {
                console.error('Failed to fetch data after schema initialization:', retryError);
                return res.status(500).json({ error: 'Failed to fetch data after attempting to initialize database' });
            }
        }
        
        // Per tutti gli altri tipi di errore, restituisce un errore generico.
        console.error('Failed to fetch all data:', error);
        return res.status(500).json({ error: 'Failed to fetch data' });
    }
}