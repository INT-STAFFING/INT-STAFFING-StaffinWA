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
        // Fix: Use req.method instead of undefined 'method' variable.
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { clients: importedClients, roles: importedRoles, resources: importedResources, projects: importedProjects, wbsTasks: importedWbsTasks } = req.body;
    const client = await db.connect();
    const warnings: string[] = [];

    try {
        await client.query('BEGIN');

        // Mappe per tenere traccia degli ID (per collegare le entità)
        const roleNameMap = new Map<string, string>();
        const clientNameMap = new Map<string, string>();
        const resourceEmailMap = new Map<string, string>();
        
        // Pre-carica entità esistenti per l'associazione
        const existingRoles = await client.query('SELECT id, name FROM roles');
        existingRoles.rows.forEach(r => roleNameMap.set(r.name, r.id));

        const existingClients = await client.query('SELECT id, name FROM clients');
        existingClients.rows.forEach(c => clientNameMap.set(c.name, c.id));

        const existingResources = await client.query('SELECT id, email FROM resources');
        existingResources.rows.forEach(r => resourceEmailMap.set(r.email, r.id));

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
                if (resourceEmailMap.has(resource.email)) {
                    warnings.push(`Risorsa con email '${resource.email}' già esistente, saltata.`);
                } else {
                    const roleId = roleNameMap.get(resource.roleName);
                    if (!roleId) {
                        warnings.push(`Risorsa '${resource.name}' saltata: il ruolo '${resource.roleName}' non è stato trovato.`);
                        continue;
                    }
                    const newId = uuidv4();
                    await client.query(
                        `INSERT INTO resources (id, name, email, role_id, horizontal, location, hire_date, work_seniority, notes)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                        [
                            newId,
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
                    resourceEmailMap.set(resource.email, newId);
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
        
        // Importa WBS Tasks
        if (Array.isArray(importedWbsTasks)) {
            for (const task of importedWbsTasks) {
                if (!task.elementoWbs) {
                    warnings.push(`Un incarico WBS è stato saltato perché non ha un Elemento WBS.`);
                    continue;
                }
                const existing = await client.query('SELECT id FROM wbs_tasks WHERE elemento_wbs = $1', [task.elementoWbs]);
                if (existing.rows.length > 0) {
                    warnings.push(`Incarico WBS '${task.elementoWbs}' già esistente, saltato.`);
                    continue;
                }

                const clientId = clientNameMap.get(task.clientName);
                if (task.clientName && !clientId) {
                    warnings.push(`Incarico WBS '${task.elementoWbs}' saltato: il cliente '${task.clientName}' non è stato trovato.`);
                    continue;
                }

                const primoResponsabileId = resourceEmailMap.get(task.primoResponsabileEmail);
                if (task.primoResponsabileEmail && !primoResponsabileId) {
                    warnings.push(`Incarico WBS '${task.elementoWbs}' saltato: primo responsabile con email '${task.primoResponsabileEmail}' non trovato.`);
                }
                
                const secondoResponsabileId = resourceEmailMap.get(task.secondoResponsabileEmail);
                 if (task.secondoResponsabileEmail && !secondoResponsabileId) {
                    warnings.push(`Incarico WBS '${task.elementoWbs}' saltato: secondo responsabile con email '${task.secondoResponsabileEmail}' non trovato.`);
                }

                 await client.query(
                    `INSERT INTO wbs_tasks (id, elemento_wbs, descrizione_wbe, client_id, periodo, ore, produzione_lorda, ore_network_italia, produzione_lorda_network_italia, perdite, realisation, spese_onorari_esterni, spese_altro, fatture_onorari, fatture_spese, iva, incassi, primo_responsabile_id, secondo_responsabile_id)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
                    [
                        uuidv4(),
                        task.elementoWbs, task.descrizioneWbe, clientId || null, task.periodo,
                        Number(task.ore) || 0, Number(task.produzioneLorda) || 0, Number(task.oreNetworkItalia) || 0, Number(task.produzioneLordaNetworkItalia) || 0,
                        Number(task.perdite) || 0, Number(task.realisation) || 100, Number(task.speseOnorariEsterni) || 0, Number(task.speseAltro) || 0,
                        Number(task.fattureOnorari) || 0, Number(task.fattureSpese) || 0, Number(task.iva) || 0, Number(task.incassi) || 0,
                        primoResponsabileId || null, secondoResponsabileId || null
                    ]
                );
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