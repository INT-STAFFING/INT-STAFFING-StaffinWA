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

    // Caso 1: È un numero seriale di Excel (giorni dal 1900-01-01).
    if (typeof dateValue === 'number') {
       // 25569 è il numero di giorni di offset tra l'epoca di Excel (1900) e l'epoca Unix (1970).
       const utc_days  = Math.floor(dateValue - 25569);
       const utc_value = utc_days * 86400;                                        
       const date_info = new Date(utc_value * 1000);
       // Crea una nuova data usando i componenti UTC per evitare che il fuso orario del server la modifichi.
       return new Date(Date.UTC(date_info.getUTCFullYear(), date_info.getUTCMonth(), date_info.getUTCDate()));
    }

    // Caso 2: È una stringa (es. "YYYY-MM-DD", "MM/DD/YYYY").
    if (typeof dateValue === 'string') {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
            // Ricostruisce la data usando i componenti UTC per neutralizzare il fuso orario del server.
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

    const { clients: importedClients, roles: importedRoles, resources: importedResources, projects: importedProjects } = req.body;
    const client = await db.connect();
    const warnings: string[] = [];

    try {
        await client.query('BEGIN');

        // Mappe per tenere traccia degli ID (per collegare le entità)
        const roleNameMap = new Map<string, string>();
        const clientNameMap = new Map<string, string>();
        
        // Pre-carica ruoli e clienti esistenti per l'associazione
        const existingRoles = await client.query('SELECT id, name FROM roles');
        existingRoles.rows.forEach(r => roleNameMap.set(r.name, r.id));

        const existingClients = await client.query('SELECT id, name FROM clients');
        existingClients.rows.forEach(c => clientNameMap.set(c.name, c.id));


        // Importa Ruoli
        if (Array.isArray(importedRoles)) {
            for (const role of importedRoles) {
                if (!role.name) {
                    warnings.push(`Un ruolo è stato saltato perché non ha un nome.`);
                    continue;
                }
                if (roleNameMap.has(role.name)) {
                    warnings.push(`Ruolo '${role.name}' già esistente, saltato.`);
                } else {
                    const newId = uuidv4();
                    await client.query(
                        'INSERT INTO roles (id, name, seniority_level, daily_cost) VALUES ($1, $2, $3, $4)',
                        [newId, role.name, role.seniorityLevel, Number(role.dailyCost) || 0]
                    );
                    roleNameMap.set(role.name, newId);
                }
            }
        }

        // Importa Clienti
        if (Array.isArray(importedClients)) {
            for (const c of importedClients) {
                if (!c.name) {
                    warnings.push(`Un cliente è stato saltato perché non ha un nome.`);
                    continue;
                }
                if (clientNameMap.has(c.name)) {
                    warnings.push(`Cliente '${c.name}' già esistente, saltato.`);
                } else {
                    const newId = uuidv4();
                    await client.query(
                        'INSERT INTO clients (id, name, sector, contact_email) VALUES ($1, $2, $3, $4)',
                        [newId, c.name, c.sector, c.contactEmail]
                    );
                    clientNameMap.set(c.name, newId);
                }
            }
        }

        // Importa Risorse
        if (Array.isArray(importedResources)) {
            for (const resource of importedResources) {
                if (!resource.email) {
                    warnings.push(`Risorsa '${resource.name || 'Senza nome'}' saltata perché non ha un'email.`);
                    continue;
                }
                const existing = await client.query('SELECT id FROM resources WHERE email = $1', [resource.email]);
                if (existing.rows.length > 0) {
                    warnings.push(`Risorsa con email '${resource.email}' già esistente, saltata.`);
                } else {
                    const roleId = roleNameMap.get(resource.roleName);
                    if (!roleId) {
                        warnings.push(`Risorsa '${resource.name}' saltata: il ruolo '${resource.roleName}' non è stato trovato.`);
                        continue;
                    }
                    await client.query(
                        `INSERT INTO resources (id, name, email, role_id, horizontal, location, hire_date, work_seniority, notes)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                        [
                            uuidv4(),
                            resource.name,
                            resource.email,
                            roleId,
                            resource.horizontal,
                            resource.location,
                            formatDateForDB(parseDate(resource.hireDate)),
                            Number(resource.workSeniority) || 0,
                            resource.notes
                        ]
                    );
                }
            }
        }

        // Importa Progetti
        if (Array.isArray(importedProjects)) {
            for (const project of importedProjects) {
                if (!project.name) {
                    warnings.push(`Un progetto è stato saltato perché non ha un nome.`);
                    continue;
                }
                const clientId = clientNameMap.get(project.clientName);
                if (project.clientName && !clientId) {
                    warnings.push(`Progetto '${project.name}' saltato: il cliente '${project.clientName}' non è stato trovato.`);
                    continue;
                }
                
                const existingCheck = await client.query('SELECT id FROM projects WHERE name = $1 AND (client_id = $2 OR (client_id IS NULL AND $2 IS NULL))', [project.name, clientId]);
                if (existingCheck.rows.length > 0) {
                     warnings.push(`Progetto '${project.name}' per il cliente '${project.clientName || 'Nessuno'}' già esistente, saltato.`);
                } else {
                    await client.query(
                        `INSERT INTO projects (id, name, client_id, start_date, end_date, budget, realization_percentage, project_manager, status, notes)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                        [
                            uuidv4(),
                            project.name,
                            clientId,
                            formatDateForDB(parseDate(project.startDate)),
                            formatDateForDB(parseDate(project.endDate)),
                            Number(project.budget) || 0,
                            Number(project.realizationPercentage) || 100,
                            project.projectManager,
                            project.status,
                            project.notes
                        ]
                    );
                }
            }
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Importazione completata.', warnings });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Import failed:', error);
        res.status(500).json({ error: (error as Error).message });
    } finally {
        client.release();
    }
}