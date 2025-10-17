/**
 * @file api/data.ts
 * @description Endpoint API per recuperare tutti i dati iniziali necessari all'applicazione con una singola richiesta.
 */

import { db } from './db';
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
 * Gestore della richiesta API per l'endpoint /api/data.
 * Risponde solo a richieste GET.
 * Recupera e restituisce tutti i dati necessari eseguendo le query in parallelo per ottimizzare le performance.
 * @param {VercelRequest} req - L'oggetto della richiesta Vercel.
 * @param {VercelResponse} res - L'oggetto della risposta Vercel.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const client = await db.connect();
    try {
        // Esegue le query in parallelo per maggiore efficienza
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
            client.query('SELECT * FROM clients;'),
            client.query('SELECT * FROM roles;'),
            client.query('SELECT * FROM resources;'),
            client.query('SELECT * FROM projects;'),
            client.query('SELECT * FROM assignments;'),
            client.query('SELECT * FROM allocations;'),
            client.query('SELECT * FROM horizontals;'),
            client.query('SELECT * FROM seniority_levels;'),
            client.query('SELECT * FROM project_statuses;'),
            client.query('SELECT * FROM client_sectors;'),
            client.query('SELECT * FROM locations;'),
            client.query('SELECT * FROM company_calendar;'),
        ]);


        // Trasforma la lista di allocazioni dal formato tabellare del DB
        // al formato annidato { assignmentId: { date: percentage } } usato dal frontend.
        const allocations: Allocation = {};
        allocationsRes.rows.forEach(row => {
            const { assignment_id, allocation_date, percentage } = row;
            const dateStr = new Date(allocation_date).toISOString().split('T')[0];
            if (!allocations[assignment_id]) {
                allocations[assignment_id] = {};
            }
            allocations[assignment_id][dateStr] = percentage;
        });

        // Formatta le date del calendario
        const companyCalendar = calendarRes.rows.map(row => {
            const event = toCamelCase(row);
            if (event.date) {
                event.date = new Date(event.date).toISOString().split('T')[0];
            }
            return event;
        }) as CalendarEvent[];


        // Assembla l'oggetto dati finale, convertendo i nomi delle colonne in camelCase.
        const data = {
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

        return res.status(200).json(data);
    } catch (error) {
        console.error('Failed to fetch all data:', error);
        return res.status(500).json({ error: 'Failed to fetch data' });
    } finally {
        client.release();
    }
}