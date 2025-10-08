import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';

// Helper to convert excel serial date to JS date
const excelDateToJSDate = (serial: number) => {
   if (typeof serial !== 'number') return null;
   // Excel's epoch starts on 1900-01-01, but incorrectly thinks 1900 is a leap year.
   // We adjust for this by checking if the date is after Feb 1900.
   // The number 25569 is the number of days from 1970-01-01 to 1900-01-01.
   const utc_days  = Math.floor(serial - 25569);
   const utc_value = utc_days * 86400;                                        
   const date_info = new Date(utc_value * 1000);
   // Create a new Date object to get the correct date regardless of timezone
   return new Date(date_info.getUTCFullYear(), date_info.getUTCMonth(), date_info.getUTCDate());
}

const formatDateForDB = (date: Date | null) => {
    return date ? date.toISOString().split('T')[0] : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { clients: newClients, roles: newRoles, resources: newResources, projects: newProjects } = req.body;
    const warnings: string[] = [];
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        // 1. Import Clients
        if (newClients && newClients.length > 0) {
            for (const [index, c] of newClients.entries()) {
                if (!c.name || !c.contactEmail) {
                    warnings.push(`Clienti (riga ${index + 2}) saltato: nome o email mancanti.`);
                    continue;
                }
                await client.query(
                    `INSERT INTO clients (id, name, sector, contact_email) VALUES ($1, $2, $3, $4) ON CONFLICT (name) DO NOTHING`,
                    [uuidv4(), c.name, c.sector || null, c.contactEmail]
                );
            }
        }

        // 2. Import Roles
        if (newRoles && newRoles.length > 0) {
            for (const [index, r] of newRoles.entries()) {
                 if (!r.name) {
                    warnings.push(`Ruoli (riga ${index + 2}) saltato: nome mancante.`);
                    continue;
                }
                await client.query(
                    `INSERT INTO roles (id, name, seniority_level) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING`,
                    [uuidv4(), r.name, r.seniorityLevel || null]
                );
            }
        }

        // Fetch existing roles and clients to get their IDs for mapping
        const existingRolesRes = await client.query('SELECT id, name FROM roles');
        const rolesMap = new Map(existingRolesRes.rows.map(r => [r.name.toLowerCase(), r.id]));

        const existingClientsRes = await client.query('SELECT id, name FROM clients');
        const clientsMap = new Map(existingClientsRes.rows.map(c => [c.name.toLowerCase(), c.id]));

        // 3. Import Resources
        if (newResources && newResources.length > 0) {
            for (const [index, r] of newResources.entries()) {
                if (!r.name || !r.email || !r.roleName) {
                    warnings.push(`Risorse (riga ${index + 2}) saltata: nome, email o roleName mancanti.`);
                    continue;
                }
                const roleId = rolesMap.get((r.roleName as string).toLowerCase());
                if (!roleId) {
                    warnings.push(`Risorsa '${r.name}' (riga ${index + 2}) saltata: ruolo '${r.roleName}' non trovato.`);
                    continue;
                }
                 const hireDate = r.hireDate ? formatDateForDB(excelDateToJSDate(r.hireDate)) : null;

                await client.query(
                    `INSERT INTO resources (id, name, email, role_id, horizontal, hire_date, work_seniority, daily_cost, notes) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
                     ON CONFLICT (email) DO NOTHING`,
                    [uuidv4(), r.name, r.email, roleId, r.horizontal || null, hireDate, r.workSeniority || 0, r.dailyCost || 0, r.notes || null]
                );
            }
        }
        
        // 4. Import Projects
        if (newProjects && newProjects.length > 0) {
            for (const [index, p] of newProjects.entries()) {
                 if (!p.name || !p.clientName) {
                    warnings.push(`Progetti (riga ${index + 2}) saltato: nome o clientName mancanti.`);
                    continue;
                }
                const clientId = clientsMap.get((p.clientName as string).toLowerCase());
                if (!clientId) {
                    warnings.push(`Progetto '${p.name}' (riga ${index + 2}) saltato: cliente '${p.clientName}' non trovato.`);
                    continue;
                }
                const startDate = p.startDate ? formatDateForDB(excelDateToJSDate(p.startDate)) : null;
                const endDate = p.endDate ? formatDateForDB(excelDateToJSDate(p.endDate)) : null;

                await client.query(
                    `INSERT INTO projects (id, name, client_id, start_date, end_date, budget, realization_percentage, project_manager, status, notes) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
                     ON CONFLICT (name, client_id) DO NOTHING`,
                    [uuidv4(), p.name, clientId, startDate, endDate, p.budget || 0, p.realizationPercentage || 100, p.projectManager || null, p.status || 'In corso', p.notes || null]
                );
            }
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Importazione completata.', warnings });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Import error:', error);
        res.status(500).json({ error: (error as Error).message });
    } finally {
        client.release();
    }
}
