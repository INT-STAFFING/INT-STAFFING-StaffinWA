/**
 * @file api/resources.ts
 * @description Endpoint API consolidato per la gestione delle operazioni CRUD su varie entità (Risorse, Clienti, Ruoli, etc.).
 * Questa centralizzazione è necessaria per rispettare i limiti sul numero di Serverless Functions del piano Hobby di Vercel.
 */

import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';

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

async function recalculateContractBacklog(contractId: string, client: any) { // 'any' to accept VercelPoolClient
    if (!contractId) return;

    const contractRes = await client.query('SELECT capienza FROM contracts WHERE id = $1', [contractId]);
    if (contractRes.rows.length === 0) {
        console.warn(`recalculateContractBacklog: Contract with id ${contractId} not found.`);
        return; 
    }
    const capienza = Number(contractRes.rows[0].capienza) || 0;

    const distinctProjectIdsRes = await client.query(`
        (SELECT project_id FROM contract_projects WHERE contract_id = $1)
        UNION
        (SELECT id AS project_id FROM projects WHERE contract_id = $1)
    `, [contractId]);
    
    const distinctProjectIds = distinctProjectIdsRes.rows.map((r: any) => r.project_id);

    let totalBudget = 0;
    if (distinctProjectIds.length > 0) {
        const budgetSumRes = await client.query(`SELECT SUM(budget) as total FROM projects WHERE id = ANY($1::uuid[])`, [distinctProjectIds]);
        if (budgetSumRes.rows.length > 0) {
            totalBudget = Number(budgetSumRes.rows[0].total) || 0;
        }
    }
    
    const newBacklog = capienza - totalBudget;

    await client.query('UPDATE contracts SET backlog = $1 WHERE id = $2', [newBacklog, contractId]);
}


export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { id, entity, action, table } = req.query;

    switch (entity) {
        // --- GESTORE ENTITÀ: RISORSE ---
        case 'resources':
            switch (method) {
                case 'POST':
                    try {
                        const { name, email, roleId, horizontal, location, hireDate, workSeniority, notes, maxStaffingPercentage } = req.body;
                        const newId = uuidv4();
                        await db.sql`
                            INSERT INTO resources (id, name, email, role_id, horizontal, location, hire_date, work_seniority, notes, max_staffing_percentage)
                            VALUES (${newId}, ${name}, ${email}, ${roleId}, ${horizontal}, ${location}, ${hireDate}, ${workSeniority}, ${notes}, ${maxStaffingPercentage || 100});
                        `;
                        return res.status(201).json({ id: newId, ...req.body });
                    } catch (error) {
                        if ((error as any).code === '23505') { return res.status(409).json({ error: `Una risorsa con email '${req.body.email}' esiste già.` }); }
                        return res.status(500).json({ error: (error as Error).message });
                    }

                case 'PUT':
                    try {
                        const { name, email, roleId, horizontal, location, hireDate, workSeniority, notes, maxStaffingPercentage } = req.body;
                        await db.sql`
                            UPDATE resources
                            SET name = ${name}, email = ${email}, role_id = ${roleId}, horizontal = ${horizontal}, location = ${location}, 
                                hire_date = ${hireDate}, work_seniority = ${workSeniority}, notes = ${notes}, max_staffing_percentage = ${maxStaffingPercentage || 100}
                            WHERE id = ${id as string};
                        `;
                        return res.status(200).json({ id, ...req.body });
                    } catch (error) {
                        if ((error as any).code === '23505') { return res.status(409).json({ error: `Una risorsa con email '${req.body.email}' esiste già.` });}
                        return res.status(500).json({ error: (error as Error).message });
                    }

                case 'DELETE':
                    const resourceClient = await db.connect();
                    try {
                        await resourceClient.query('BEGIN');
                        const assignmentsRes = await resourceClient.query('SELECT id FROM assignments WHERE resource_id = $1', [id]);
                        const assignmentIds = assignmentsRes.rows.map(r => r.id);
                        if (assignmentIds.length > 0) {
                            await resourceClient.query('DELETE FROM allocations WHERE assignment_id = ANY($1::uuid[])', [assignmentIds]);
                        }
                        await resourceClient.query('DELETE FROM assignments WHERE resource_id = $1', [id]);
                        await resourceClient.query('DELETE FROM resources WHERE id = $1', [id]);
                        await resourceClient.query('COMMIT');
                        return res.status(204).end();
                    } catch (error) {
                        await resourceClient.query('ROLLBACK');
                        return res.status(500).json({ error: (error as Error).message });
                    } finally {
                        resourceClient.release();
                    }
                default:
                    res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
                    return res.status(405).end(`Method ${method} Not Allowed`);
            }
        
        // --- GESTORE ENTITÀ: CLIENTI ---
        case 'clients':
             switch (method) {
                case 'POST':
                    try {
                        const { name, sector, contactEmail } = req.body;
                        const newId = uuidv4();
                        await db.sql`INSERT INTO clients (id, name, sector, contact_email) VALUES (${newId}, ${name}, ${sector}, ${contactEmail});`;
                        return res.status(201).json({ id: newId, ...req.body });
                    } catch (error) {
                        if ((error as any).code === '23505') { return res.status(409).json({ error: `Un cliente con nome '${req.body.name}' esiste già.` }); }
                        return res.status(500).json({ error: (error as Error).message });
                    }
                case 'PUT':
                    try {
                        const { name, sector, contactEmail } = req.body;
                        await db.sql`UPDATE clients SET name = ${name}, sector = ${sector}, contact_email = ${contactEmail} WHERE id = ${id as string};`;
                        return res.status(200).json({ id, ...req.body });
                    } catch (error) {
                        if ((error as any).code === '23505') { return res.status(409).json({ error: `Un cliente con nome '${req.body.name}' esiste già.` });}
                        return res.status(500).json({ error: (error as Error).message });
                    }
                case 'DELETE':
                    try {
                        const { rows } = await db.sql`SELECT COUNT(*) FROM projects WHERE client_id = ${id as string};`;
                        if (rows[0].count > 0) { return res.status(409).json({ error: `Impossibile eliminare il cliente. È ancora associato a ${rows[0].count} progetto/i.` }); }
                        await db.sql`DELETE FROM clients WHERE id = ${id as string};`;
                        return res.status(204).end();
                    } catch (error) { return res.status(500).json({ error: (error as Error).message }); }
                default:
                    res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
                    return res.status(405).end(`Method ${method} Not Allowed`);
            }

        // --- GESTORE ENTITÀ: RUOLI ---
        case 'roles':
            switch (method) {
                case 'POST':
                    try {
                        const { name, seniorityLevel, dailyCost, standardCost } = req.body;
                        const dailyExpenses = (Number(dailyCost) || 0) * 0.035;
                        const newId = uuidv4();
                        await db.sql`INSERT INTO roles (id, name, seniority_level, daily_cost, standard_cost, daily_expenses) VALUES (${newId}, ${name}, ${seniorityLevel}, ${dailyCost}, ${standardCost}, ${dailyExpenses});`;
                        return res.status(201).json({ id: newId, ...req.body, dailyExpenses });
                    } catch (error) {
                        if ((error as any).code === '23505') { return res.status(409).json({ error: `Un ruolo con nome '${req.body.name}' esiste già.` }); }
                        return res.status(500).json({ error: (error as Error).message });
                    }
                case 'PUT':
                    try {
                        const { name, seniorityLevel, dailyCost, standardCost } = req.body;
                        const dailyExpenses = (Number(dailyCost) || 0) * 0.035;
                        await db.sql`UPDATE roles SET name = ${name}, seniority_level = ${seniorityLevel}, daily_cost = ${dailyCost}, standard_cost = ${standardCost}, daily_expenses = ${dailyExpenses} WHERE id = ${id as string};`;
                        return res.status(200).json({ id, ...req.body, dailyExpenses });
                    } catch (error) {
                        if ((error as any).code === '23505') { return res.status(409).json({ error: `Un ruolo con nome '${req.body.name}' esiste già.` }); }
                        return res.status(500).json({ error: (error as Error).message });
                    }
                case 'DELETE':
                    try {
                        const { rows } = await db.sql`SELECT COUNT(*) FROM resources WHERE role_id = ${id as string};`;
                        if (rows[0].count > 0) { return res.status(409).json({ error: `Impossibile eliminare il ruolo. È ancora assegnato a ${rows[0].count} risorsa/e.` });}
                        await db.sql`DELETE FROM roles WHERE id = ${id as string};`;
                        return res.status(204).end();
                    } catch (error) { return res.status(500).json({ error: (error as Error).message });}
                default:
                    res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
                    return res.status(405).end(`Method ${method} Not Allowed`);
            }

        // --- GESTORE ENTITÀ: PROGETTI ---
        case 'projects':
            const projectClient = await db.connect();
            try {
                await projectClient.query('BEGIN');
                switch (method) {
                    case 'POST':
                        const { name, clientId, startDate, endDate, budget, realizationPercentage, projectManager, status, notes, contractId } = req.body;
                        const newId = uuidv4();
                        await projectClient.query(
                            `INSERT INTO projects (id, name, client_id, start_date, end_date, budget, realization_percentage, project_manager, status, notes, contract_id)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);`,
                            [newId, name, clientId || null, startDate || null, endDate || null, budget || 0, realizationPercentage || 100, projectManager || null, status || null, notes || null, contractId || null]
                        );
                        if (contractId) {
                            await recalculateContractBacklog(contractId, projectClient);
                        }
                        await projectClient.query('COMMIT');
                        return res.status(201).json({ id: newId, ...req.body });

                    case 'PUT':
                        const { rows } = await projectClient.query('SELECT contract_id FROM projects WHERE id = $1', [id]);
                        const oldContractId = rows.length > 0 ? rows[0].contract_id : null;
                        
                        const { name: uName, clientId: uClientId, startDate: uStartDate, endDate: uEndDate, budget: uBudget, realizationPercentage: uRealizationPercentage, projectManager: uProjectManager, status: uStatus, notes: uNotes, contractId: uContractId } = req.body;
                        await projectClient.query(
                            `UPDATE projects SET name = $1, client_id = $2, start_date = $3, end_date = $4, budget = $5, 
                             realization_percentage = $6, project_manager = $7, status = $8, notes = $9, contract_id = $10
                             WHERE id = $11;`,
                            [uName, uClientId || null, uStartDate || null, uEndDate || null, uBudget || 0, uRealizationPercentage || 100, uProjectManager || null, uStatus || null, uNotes || null, uContractId || null, id]
                        );

                        if (oldContractId) {
                            await recalculateContractBacklog(oldContractId, projectClient);
                        }
                        const newContractId = uContractId || null;
                        if (newContractId && newContractId !== oldContractId) {
                            await recalculateContractBacklog(newContractId, projectClient);
                        }

                        await projectClient.query('COMMIT');
                        return res.status(200).json({ id, ...req.body });

                    case 'DELETE':
                        const { rows: delRows } = await projectClient.query('SELECT contract_id FROM projects WHERE id = $1', [id]);
                        const delContractId = delRows.length > 0 ? delRows[0].contract_id : null;
                        
                        const assignmentsRes = await projectClient.query('SELECT id FROM assignments WHERE project_id = $1', [id]);
                        const assignmentIds = assignmentsRes.rows.map(r => r.id);
                        if (assignmentIds.length > 0) {
                            await projectClient.query('DELETE FROM allocations WHERE assignment_id = ANY($1::uuid[])', [assignmentIds]);
                        }
                        await projectClient.query('DELETE FROM assignments WHERE project_id = $1', [id]);
                        await projectClient.query('DELETE FROM projects WHERE id = $1', [id]);
                        
                        if (delContractId) {
                            await recalculateContractBacklog(delContractId, projectClient);
                        }

                        await projectClient.query('COMMIT');
                        return res.status(204).end();
                    default:
                        res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
                        return res.status(405).end(`Method ${method} Not Allowed`);
                }
            } catch (error) {
                await projectClient.query('ROLLBACK');
                if ((error as any).code === '23505') { return res.status(409).json({ error: `Un progetto con nome '${req.body.name}' esiste già.` }); }
                return res.status(500).json({ error: (error as Error).message });
            } finally {
                projectClient.release();
            }

        // --- GESTORE ENTITÀ: CONTRATTI ---
        case 'contracts':
            const contractClient = await db.connect();
            try {
                switch (method) {
                    case 'POST':
                        await contractClient.query('BEGIN');
                        const { name, startDate, endDate, cig, cigDerivato, capienza, projectIds = [], managerIds = [] } = req.body;
                        const newId = uuidv4();
                        
                        await contractClient.query(
                            `INSERT INTO contracts (id, name, start_date, end_date, cig, cig_derivato, capienza)
                            VALUES ($1, $2, $3, $4, $5, $6, $7);`,
                            [newId, name, startDate || null, endDate || null, cig, cigDerivato || null, capienza || 0]
                        );

                        for (const projectId of projectIds) {
                            await contractClient.query('INSERT INTO contract_projects (contract_id, project_id) VALUES ($1, $2)', [newId, projectId]);
                        }
                        for (const resourceId of managerIds) {
                            await contractClient.query('INSERT INTO contract_managers (contract_id, resource_id) VALUES ($1, $2)', [newId, resourceId]);
                        }

                        await recalculateContractBacklog(newId, contractClient);
                        await contractClient.query('COMMIT');
                        
                        const newContractRes = await db.sql`SELECT * FROM contracts WHERE id = ${newId}`;
                        return res.status(201).json(toCamelCase(newContractRes.rows[0]));

                    case 'PUT':
                        await contractClient.query('BEGIN');
                        const contractId = id as string;
                        const { name: uName, startDate: uStartDate, endDate: uEndDate, cig: uCig, cigDerivato: uCigDerivato, capienza: uCapienza, projectIds: uProjectIds = [], managerIds: uManagerIds = [] } = req.body;

                        await contractClient.query(
                            `UPDATE contracts SET name = $1, start_date = $2, end_date = $3, cig = $4, cig_derivato = $5, capienza = $6
                             WHERE id = $7;`,
                            [uName, uStartDate || null, uEndDate || null, uCig, uCigDerivato || null, uCapienza || 0, contractId]
                        );

                        await contractClient.query('DELETE FROM contract_projects WHERE contract_id = $1', [contractId]);
                        for (const projectId of uProjectIds) {
                            await contractClient.query('INSERT INTO contract_projects (contract_id, project_id) VALUES ($1, $2)', [contractId, projectId]);
                        }

                        await contractClient.query('DELETE FROM contract_managers WHERE contract_id = $1', [contractId]);
                        for (const resourceId of uManagerIds) {
                            await contractClient.query('INSERT INTO contract_managers (contract_id, resource_id) VALUES ($1, $2)', [contractId, resourceId]);
                        }

                        await recalculateContractBacklog(contractId, contractClient);
                        await contractClient.query('COMMIT');
                        
                        const updatedContractRes = await db.sql`SELECT * FROM contracts WHERE id = ${contractId}`;
                        return res.status(200).json(toCamelCase(updatedContractRes.rows[0]));

                    case 'DELETE':
                        await contractClient.query('BEGIN');
                        await contractClient.query('DELETE FROM contract_projects WHERE contract_id = $1', [id]);
                        await contractClient.query('DELETE FROM contract_managers WHERE contract_id = $1', [id]);
                        await contractClient.query('DELETE FROM contracts WHERE id = $1', [id]);
                        await contractClient.query('COMMIT');
                        return res.status(204).end();
                        
                    default:
                        res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
                        return res.status(405).end(`Method ${method} Not Allowed`);
                }
            } catch (error) {
                await contractClient.query('ROLLBACK');
                if ((error as any).code === '23505') { 
                    return res.status(409).json({ error: `Un contratto con questo nome o CIG esiste già.` }); 
                }
                return res.status(500).json({ error: (error as Error).message });
            } finally {
                contractClient.release();
            }

        // --- GESTORE ENTITÀ: CALENDARIO ---
        case 'calendar':
             switch (method) {
                case 'POST':
                    try {
                        let { name, date, type, location } = req.body;
                        const newId = uuidv4();
                        await db.sql`INSERT INTO company_calendar (id, name, date, type, location) VALUES (${newId}, ${name}, ${date}, ${type}, ${type !== 'LOCAL_HOLIDAY' ? null : location});`;
                        return res.status(201).json({ id: newId, ...req.body });
                    } catch (error) {
                        if ((error as any).code === '23505') { return res.status(409).json({ error: `Un evento per questa data e sede esiste già.` }); }
                        return res.status(500).json({ error: (error as Error).message });
                    }
                case 'PUT':
                    try {
                        let { name, date, type, location } = req.body;
                        await db.sql`UPDATE company_calendar SET name = ${name}, date = ${date}, type = ${type}, location = ${type !== 'LOCAL_HOLIDAY' ? null : location} WHERE id = ${id as string};`;
                        return res.status(200).json({ id, ...req.body });
                    } catch (error) {
                        if ((error as any).code === '23505') { return res.status(409).json({ error: `Un evento per questa data e sede esiste già.` }); }
                        return res.status(500).json({ error: (error as Error).message });
                    }
                case 'DELETE':
                    try {
                        await db.sql`DELETE FROM company_calendar WHERE id = ${id as string};`;
                        return res.status(204).end();
                    } catch (error) { return res.status(500).json({ error: (error as Error).message }); }
                default:
                    res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
                    return res.status(405).end(`Method ${method} Not Allowed`);
            }
        
        // Fix: Add handler for wbsTasks entity
        case 'wbsTasks':
            switch(method) {
                case 'POST':
                    try {
                        const { elementoWbs, descrizioneWbe, clientId, periodo, ore, produzioneLorda, oreNetworkItalia, produzioneLordaNetworkItalia, perdite, realisation, speseOnorariEsterni, speseAltro, fattureOnorari, fattureSpese, iva, incassi, primoResponsabileId, secondoResponsabileId } = req.body;
                        const newId = uuidv4();
                        await db.sql`
                            INSERT INTO wbs_tasks (id, elemento_wbs, descrizione_wbe, client_id, periodo, ore, produzione_lorda, ore_network_italia, produzione_lorda_network_italia, perdite, realisation, spese_onorari_esterni, spese_altro, fatture_onorari, fatture_spese, iva, incassi, primo_responsabile_id, secondo_responsabile_id)
                            VALUES (${newId}, ${elementoWbs}, ${descrizioneWbe}, ${clientId || null}, ${periodo}, ${ore}, ${produzioneLorda}, ${oreNetworkItalia}, ${produzioneLordaNetworkItalia}, ${perdite}, ${realisation}, ${speseOnorariEsterni}, ${speseAltro}, ${fattureOnorari}, ${fattureSpese}, ${iva}, ${incassi}, ${primoResponsabileId || null}, ${secondoResponsabileId || null});
                        `;
                        return res.status(201).json({ id: newId, ...req.body });
                    } catch (error) {
                         if ((error as any).code === '23505') { return res.status(409).json({ error: `Un incarico con elemento WBS '${req.body.elementoWbs}' esiste già.` }); }
                        return res.status(500).json({ error: (error as Error).message });
                    }
                case 'PUT':
                    try {
                        const { elementoWbs, descrizioneWbe, clientId, periodo, ore, produzioneLorda, oreNetworkItalia, produzioneLordaNetworkItalia, perdite, realisation, speseOnorariEsterni, speseAltro, fattureOnorari, fattureSpese, iva, incassi, primoResponsabileId, secondoResponsabileId } = req.body;
                        await db.sql`
                            UPDATE wbs_tasks
                            SET elemento_wbs = ${elementoWbs}, descrizione_wbe = ${descrizioneWbe}, client_id = ${clientId || null}, periodo = ${periodo}, ore = ${ore}, produzione_lorda = ${produzioneLorda}, ore_network_italia = ${oreNetworkItalia}, produzione_lorda_network_italia = ${produzioneLordaNetworkItalia}, perdite = ${perdite}, realisation = ${realisation}, spese_onorari_esterni = ${speseOnorariEsterni}, spese_altro = ${speseAltro}, fatture_onorari = ${fattureOnorari}, fatture_spese = ${fattureSpese}, iva = ${iva}, incassi = ${incassi}, primo_responsabile_id = ${primoResponsabileId || null}, secondo_responsabile_id = ${secondoResponsabileId || null}
                            WHERE id = ${id as string};
                        `;
                        return res.status(200).json({ id, ...req.body });
                    } catch (error) {
                        if ((error as any).code === '23505') { return res.status(409).json({ error: `Un incarico con elemento WBS '${req.body.elementoWbs}' esiste già.` }); }
                        return res.status(500).json({ error: (error as Error).message });
                    }
                case 'DELETE':
                    try {
                        await db.sql`DELETE FROM wbs_tasks WHERE id = ${id as string};`;
                        return res.status(204).end();
                    } catch (error) {
                        return res.status(500).json({ error: (error as Error).message });
                    }
                default:
                    res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
                    return res.status(405).end(`Method ${method} Not Allowed`);
            }

        // --- GESTORE ENTITÀ: RICHIESTE RISORSE ---
        case 'resource-requests':
            switch (method) {
                case 'POST':
                    try {
                        const { projectId, roleId, requestorId, startDate, endDate, commitmentPercentage, isUrgent, isLongTerm, isTechRequest, notes, status } = req.body;
                        const newId = uuidv4();
                        await db.sql`
                            INSERT INTO resource_requests (id, project_id, role_id, requestor_id, start_date, end_date, commitment_percentage, is_urgent, is_long_term, is_tech_request, notes, status)
                            VALUES (${newId}, ${projectId}, ${roleId}, ${requestorId || null}, ${startDate}, ${endDate}, ${commitmentPercentage}, ${isUrgent}, ${isLongTerm}, ${isTechRequest}, ${notes}, ${status});
                        `;
                        return res.status(201).json({ id: newId, ...req.body });
                    } catch (error) {
                        return res.status(500).json({ error: (error as Error).message });
                    }

                case 'PUT':
                    try {
                        const { projectId, roleId, requestorId, startDate, endDate, commitmentPercentage, isUrgent, isLongTerm, isTechRequest, notes, status } = req.body;
                        await db.sql`
                            UPDATE resource_requests
                            SET project_id = ${projectId}, role_id = ${roleId}, requestor_id = ${requestorId || null}, start_date = ${startDate}, end_date = ${endDate}, commitment_percentage = ${commitmentPercentage},
                                is_urgent = ${isUrgent}, is_long_term = ${isLongTerm}, is_tech_request = ${isTechRequest}, notes = ${notes}, status = ${status}
                            WHERE id = ${id as string};
                        `;
                        return res.status(200).json({ id, ...req.body });
                    } catch (error) {
                        return res.status(500).json({ error: (error as Error).message });
                    }

                case 'DELETE':
                    try {
                        await db.sql`DELETE FROM resource_requests WHERE id = ${id as string};`;
                        return res.status(204).end();
                    } catch (error) {
                        return res.status(500).json({ error: (error as Error).message });
                    }
                
                default:
                    res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
                    return res.status(405).end(`Method ${method} Not Allowed`);
            }
        
        // --- GESTORE ENTITÀ: COLLOQUI ---
        case 'interviews':
             switch (method) {
                case 'POST':
                    try {
                        const { resourceRequestId, candidateName, candidateSurname, birthDate, horizontal, roleId, cvSummary, interviewersIds, interviewDate, feedback, notes, hiringStatus, entryDate, status } = req.body;
                        const newId = uuidv4();
                        await db.sql`
                            INSERT INTO interviews (id, resource_request_id, candidate_name, candidate_surname, birth_date, horizontal, role_id, cv_summary, interviewers_ids, interview_date, feedback, notes, hiring_status, entry_date, status)
                            VALUES (${newId}, ${resourceRequestId || null}, ${candidateName}, ${candidateSurname}, ${birthDate || null}, ${horizontal || null}, ${roleId || null}, ${cvSummary || null}, ${interviewersIds && interviewersIds.length > 0 ? `{${interviewersIds.join(',')}}` : null}, ${interviewDate || null}, ${feedback || null}, ${notes || null}, ${hiringStatus || null}, ${entryDate || null}, ${status});
                        `;
                        return res.status(201).json({ id: newId, ...req.body });
                    } catch (error) {
                        return res.status(500).json({ error: (error as Error).message });
                    }

                case 'PUT':
                    try {
                        const { resourceRequestId, candidateName, candidateSurname, birthDate, horizontal, roleId, cvSummary, interviewersIds, interviewDate, feedback, notes, hiringStatus, entryDate, status } = req.body;
                        await db.sql`
                            UPDATE interviews
                            SET resource_request_id = ${resourceRequestId || null}, candidate_name = ${candidateName}, candidate_surname = ${candidateSurname}, birth_date = ${birthDate || null}, horizontal = ${horizontal || null}, role_id = ${roleId || null}, cv_summary = ${cvSummary || null}, interviewers_ids = ${interviewersIds && interviewersIds.length > 0 ? `{${interviewersIds.join(',')}}` : null}, interview_date = ${interviewDate || null}, feedback = ${feedback || null}, notes = ${notes || null}, hiring_status = ${hiringStatus || null}, entry_date = ${entryDate || null}, status = ${status}
                            WHERE id = ${id as string};
                        `;
                        return res.status(200).json({ id, ...req.body });
                    } catch (error) {
                        return res.status(500).json({ error: (error as Error).message });
                    }

                case 'DELETE':
                    try {
                        await db.sql`DELETE FROM interviews WHERE id = ${id as string};`;
                        return res.status(204).end();
                    } catch (error) {
                        return res.status(500).json({ error: (error as Error).message });
                    }
                
                default:
                    res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
                    return res.status(405).end(`Method ${method} Not Allowed`);
            }
        
        // --- NUOVO GESTORE: DB INSPECTOR ---
        case 'db_inspector':
            const TABLE_WHITELIST = [
                'clients', 'roles', 'resources', 'projects', 'assignments', 'allocations',
                'company_calendar', 'wbs_tasks', 'resource_requests', 'interviews', 'horizontals',
                'seniority_levels', 'project_statuses', 'client_sectors', 'locations', 'app_config',
                'contracts', 'contract_projects', 'contract_managers'
            ];
            
            if (typeof table === 'string' && !TABLE_WHITELIST.includes(table)) {
                return res.status(403).json({ error: `Access to table '${table}' is forbidden.` });
            }

            switch(action) {
                case 'list_tables':
                    return res.status(200).json(TABLE_WHITELIST);
                
                case 'get_table_data':
                     if (typeof table !== 'string') return res.status(400).json({ error: 'Table name is required.' });
                    try {
                        const [columnsRes, dataRes] = await Promise.all([
                            db.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1;`, [table]),
                            db.query(`SELECT * FROM ${table};`) // Sicuro perché `table` è validato dalla whitelist
                        ]);
                        return res.status(200).json({ columns: columnsRes.rows, rows: dataRes.rows });
                    } catch (error) {
                        return res.status(500).json({ error: (error as Error).message });
                    }

                case 'update_row':
                    if (method !== 'PUT') return res.status(405).end();
                    if (typeof table !== 'string' || !id) return res.status(400).json({ error: 'Table name and row ID are required.' });
                    
                    try {
                        const updates = req.body;
                        const columns = Object.keys(updates);
                        if (columns.length === 0) return res.status(400).json({ error: 'No fields to update provided.' });

                        const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
                        const values = Object.values(updates);
                        
                        await db.query(
                            `UPDATE ${table} SET ${setClause} WHERE id = $${columns.length + 1}`,
                            [...values, id]
                        );
                        return res.status(200).json({ success: true, message: `Row ${id} in ${table} updated.` });
                    } catch (error) {
                        return res.status(500).json({ error: (error as Error).message });
                    }

                case 'delete_all_rows':
                    if (method !== 'DELETE') return res.status(405).end();
                    if (typeof table !== 'string') return res.status(400).json({ error: 'Table name is required.' });
                    
                    try {
                        if (!TABLE_WHITELIST.includes(table)) {
                            return res.status(403).json({ error: `Access to table '${table}' is forbidden.` });
                        }
                        await db.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE;`);
                        return res.status(200).json({ success: true, message: `All rows from table ${table} have been deleted.` });
                    } catch (error) {
                        return res.status(500).json({ error: (error as Error).message });
                    }

                default:
                    return res.status(400).json({ error: 'Invalid or missing action for db_inspector.' });
            }

        default:
            return res.status(400).json({ error: 'Invalid or missing entity type specified' });
    }
}