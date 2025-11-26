

/**
 * @file exportUtils.ts
 * @description Funzioni di utilità per esportare dati in formato Excel.
 */

import { Client, Role, Resource, Project, Assignment, Allocation, ConfigOption, CalendarEvent, WbsTask, ResourceRequest, Interview, Contract, Skill, ResourceSkill, ProjectSkill, PageVisibility, LeaveRequest, LeaveType, AppUser, RolePermission } from '../types';
import { EntitiesContextType } from '../context/AppContext';
import * as XLSX from 'xlsx';

type ExportType = 'core_entities' | 'staffing' | 'resource_requests' | 'interviews' | 'skills' | 'leaves' | 'users_permissions';

const formatDateForExport = (date: Date | string | null | undefined): string => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
};

/**
 * Esporta le entità principali (Risorse, Progetti, Clienti, etc.) in un file Excel.
 */
export const exportCoreEntities = (data: EntitiesContextType) => {
    const { clients, roles, resources, projects, companyCalendar, horizontals, seniorityLevels, projectStatuses, clientSectors, locations, resourceSkills, skills } = data;
    const wb = XLSX.utils.book_new();

    const clientsSheetData = clients.map(c => ({ 'Nome Cliente': c.name, 'Settore': c.sector, 'Email Contatto': c.contactEmail }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clientsSheetData), 'Clienti');

    const rolesSheetData = roles.map(r => ({ 'Nome Ruolo': r.name, 'Livello Seniority': r.seniorityLevel, 'Costo Giornaliero (€)': r.dailyCost, 'Costo Standard (€)': r.standardCost, 'Spese Giornaliere Calcolate (€)': r.dailyExpenses }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rolesSheetData), 'Ruoli');

    const resourcesSheetData = resources.map(r => {
        // Recupera le competenze associate e le unisce in una stringa separata da virgole
        const associatedSkills = resourceSkills
            .filter(rs => rs.resourceId === r.id)
            .map(rs => skills.find(s => s.id === rs.skillId)?.name)
            .filter(Boolean)
            .join(', ');

        return { 
            'Nome': r.name, 
            'Email': r.email, 
            'Sede': r.location, 
            'Ruolo': roles.find(role => role.id === r.roleId)?.name || 'N/A', 
            'Horizontal': r.horizontal, 
            'Competenze': associatedSkills,
            'Data Assunzione': formatDateForExport(r.hireDate), 
            'Anzianità (anni)': r.workSeniority, 
            'Note': r.notes || '' 
        };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resourcesSheetData), 'Risorse');

    const projectsSheetData = projects.map(p => ({ 'Nome Progetto': p.name, 'Cliente': clients.find(c => c.id === p.clientId)?.name || 'N/A', 'Stato': p.status, 'Budget (€)': p.budget, 'Realizzazione (%)': p.realizationPercentage, 'Data Inizio': formatDateForExport(p.startDate), 'Data Fine': formatDateForExport(p.endDate), 'Project Manager': p.projectManager, 'Note': p.notes || '' }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(projectsSheetData), 'Progetti');

    const calendarSheetData = companyCalendar.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(e => ({ 'Nome Evento': e.name, 'Data': formatDateForExport(e.date), 'Tipo': e.type, 'Sede (se locale)': e.location || 'Tutte' }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(calendarSheetData), 'Calendario');
    
    const configToSheet = (configItems: { value: string }[], sheetName: string) => {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(configItems.map(item => ({ Valore: item.value }))), sheetName);
    };
    configToSheet(horizontals, 'Config_Horizontals');
    configToSheet(seniorityLevels, 'Config_Seniority');
    configToSheet(projectStatuses, 'Config_ProjectStatus');
    configToSheet(clientSectors, 'Config_ClientSectors');
    configToSheet(locations, 'Config_Locations');
    
    XLSX.writeFile(wb, `Staffing_Export_Entita_${formatDateForExport(new Date())}.xlsx`);
};

/**
 * Esporta la griglia di staffing in un formato ottimizzato per la re-importazione.
 */
export const exportStaffing = (data: EntitiesContextType & { allocations: Allocation }) => {
    const { resources, projects, assignments, allocations } = data;
    const wb = XLSX.utils.book_new();
    const staffingData: any[] = [];
    
    // Trova il range di date di tutte le allocazioni esistenti
    const allDates = new Set<string>();
    Object.values(allocations).forEach(assignmentAllocs => {
        Object.keys(assignmentAllocs).forEach(date => allDates.add(date));
    });

    if (allDates.size === 0) { // Se non ci sono allocazioni, crea un file vuoto
        const ws = XLSX.utils.json_to_sheet([{ "Resource Name": "", "Project Name": "" }]);
        XLSX.utils.book_append_sheet(wb, ws, 'Staffing');
        XLSX.writeFile(wb, `Staffing_Export_Staffing_${formatDateForExport(new Date())}.xlsx`);
        return;
    }
    
    const sortedDates = Array.from(allDates).sort();

    const sortedAssignments = [...assignments].sort((a, b) => {
        const resA = resources.find(r => r.id === a.resourceId)?.name || '';
        const resB = resources.find(r => r.id === b.resourceId)?.name || '';
        if (resA !== resB) return resA.localeCompare(resB);
        const projA = projects.find(p => p.id === a.projectId)?.name || '';
        const projB = projects.find(p => p.id === b.projectId)?.name || '';
        return projA.localeCompare(projB);
    });

    for (const assignment of sortedAssignments) {
        const resource = resources.find(r => r.id === assignment.resourceId);
        const project = projects.find(p => p.id === assignment.projectId);
        
        if (resource && project) {
            const row: { [key: string]: string | number } = {
                "Resource Name": resource.name,
                "Project Name": project.name,
            };
            
            const assignmentAllocs = allocations[assignment.id!] || {};
            for (const date of sortedDates) {
                row[date] = assignmentAllocs[date] || 0;
            }
            staffingData.push(row);
        }
    }
    
    const ws = XLSX.utils.json_to_sheet(staffingData);
    ws['!cols'] = [{ wch: 25 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Staffing');
    XLSX.writeFile(wb, `Staffing_Export_Staffing_${formatDateForExport(new Date())}.xlsx`);
};


/**
 * Esporta le richieste di risorse in un file Excel.
 */
export const exportResourceRequests = (data: EntitiesContextType) => {
    const { resourceRequests, projects, roles, resources } = data;
    const wb = XLSX.utils.book_new();

    const sheetData = resourceRequests.map(req => ({
        "Progetto": projects.find(p => p.id === req.projectId)?.name || 'N/A',
        "Ruolo Richiesto": roles.find(r => r.id === req.roleId)?.name || 'N/A',
        "Richiedente": resources.find(r => r.id === req.requestorId)?.name || 'N/A',
        "Data Inizio": formatDateForExport(req.startDate),
        "Data Fine": formatDateForExport(req.endDate),
        "Impegno %": req.commitmentPercentage,
        "Urgent": req.isUrgent ? 'SI' : 'NO',
        "Tech": req.isTechRequest ? 'SI' : 'NO',
        "Note": req.notes,
        "Stato": req.status,
    }));
    
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetData), 'Richieste_Risorse');
    XLSX.writeFile(wb, `Staffing_Export_Richieste_${formatDateForExport(new Date())}.xlsx`);
};

/**
 * Esporta i dati dei colloqui in un file Excel.
 */
export const exportInterviews = (data: EntitiesContextType) => {
    const { interviews, roles, resources } = data;
    const wb = XLSX.utils.book_new();

    const sheetData = interviews.map(i => ({
        "Nome Candidato": i.candidateName,
        "Cognome Candidato": i.candidateSurname,
        "Data di Nascita": formatDateForExport(i.birthDate),
        "Horizontal": i.horizontal,
        "Ruolo Proposto": roles.find(r => r.id === i.roleId)?.name,
        "Riassunto CV": i.cvSummary,
        "Colloquiato Da": i.interviewersIds?.map(id => resources.find(r => r.id === id)?.name).join(', '),
        "Data Colloquio": formatDateForExport(i.interviewDate),
        "Feedback": i.feedback,
        "Note": i.notes,
        "Stato Assunzione": i.hiringStatus,
        "Data Ingresso": formatDateForExport(i.entryDate),
        "Stato Processo": i.status,
    }));
    
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetData), 'Colloqui');
    XLSX.writeFile(wb, `Staffing_Export_Colloqui_${formatDateForExport(new Date())}.xlsx`);
};

/**
 * Esporta le competenze e le associazioni con le risorse.
 */
export const exportSkills = (data: EntitiesContextType) => {
    const { skills, resources, resourceSkills } = data;
    const wb = XLSX.utils.book_new();

    // Sheet 1: Competenze Definition
    const skillsData = skills.map(s => ({
        'Nome Competenza': s.name,
        'Ambito': s.category || '', // Ex Categoria
        'Macro Ambito': s.macroCategory || '', // Nuovo Campo
        'Certificazione': s.isCertification ? 'SI' : 'NO' // Nuovo Campo
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(skillsData), 'Competenze');

    // Sheet 2: Resource Associations
    const associationsData = resourceSkills.map(rs => {
        const res = resources.find(r => r.id === rs.resourceId);
        const skill = skills.find(s => s.id === rs.skillId);
        if (!res || !skill) return null;
        return {
            'Nome Risorsa': res.name,
            'Nome Competenza': skill.name,
            'Livello': rs.level || 1,
            'Data Conseguimento': formatDateForExport(rs.acquisitionDate),
            'Data Scadenza': formatDateForExport(rs.expirationDate)
        };
    }).filter(Boolean);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(associationsData), 'Associazioni_Risorse');

    XLSX.writeFile(wb, `Staffing_Export_Skills_${formatDateForExport(new Date())}.xlsx`);
};

/**
 * Esporta i dati delle assenze in un file Excel.
 */
export const exportLeaves = (data: EntitiesContextType) => {
    const { leaveRequests, resources, leaveTypes } = data;
    const wb = XLSX.utils.book_new();

    const sheetData = leaveRequests.map(req => {
        const resource = resources.find(r => r.id === req.resourceId);
        const type = leaveTypes.find(t => t.id === req.typeId);
        const approverNames = req.approverIds
            ? req.approverIds.map(id => resources.find(r => r.id === id)?.name).filter(Boolean).join(', ')
            : '';

        return {
            'Nome Risorsa': resource?.name || 'Sconosciuta',
            'Tipologia Assenza': type?.name || 'Sconosciuta',
            'Data Inizio': formatDateForExport(req.startDate),
            'Data Fine': formatDateForExport(req.endDate),
            'Approvatori': approverNames,
            'Stato': req.status,
            'Note': req.notes || ''
        };
    });

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetData), 'Assenze');
    XLSX.writeFile(wb, `Staffing_Export_Assenze_${formatDateForExport(new Date())}.xlsx`);
};

/**
 * Esporta gli utenti e la matrice dei permessi.
 * NOTA: Le password NON vengono esportate per sicurezza.
 */
export const exportUsersPermissions = (users: AppUser[], permissions: RolePermission[], resources: Resource[]) => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Utenti
    const usersData = users.map(u => {
        const resource = resources.find(r => r.id === u.resourceId);
        return {
            'Username': u.username,
            'Ruolo': u.role,
            'Email Risorsa': resource?.email || '', // Use email for linking on import
            'Stato Attivo': u.isActive ? 'SI' : 'NO'
        };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(usersData), 'Utenti');

    // Sheet 2: Permessi
    const permissionsData = permissions.map(p => ({
        'Ruolo': p.role,
        'Pagina': p.pagePath,
        'Accesso Consentito': p.allowed ? 'SI' : 'NO'
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(permissionsData), 'Permessi');

    XLSX.writeFile(wb, `Staffing_Export_Utenti_Permessi_${formatDateForExport(new Date())}.xlsx`);
};


/**
 * Genera e avvia il download di un template Excel vuoto basato sul tipo di importazione.
 */
export const exportTemplate = (type: ExportType) => {
    const wb = XLSX.utils.book_new();
    let fileName = `Staffing_Template_${type}.xlsx`;

    const instructions = [
        ["Istruzioni per l'Importazione"],
        [],
        ["- Non modificare i nomi dei fogli o i nomi delle colonne."],
        ["- Compila il foglio con i dati richiesti."],
        ["- I dati esistenti (con lo stesso nome/email/valore) verranno saltati o aggiornati."],
        ["- Per le date, usa il formato AAAA-MM-GG (es. 2024-12-31)."],
    ];
    const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
    wsInstructions['!cols'] = [{ wch: 100 }];
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Istruzioni');

    switch (type) {
        case 'core_entities':
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["name", "sector", "contactEmail"]]), 'Clienti');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["name", "seniorityLevel", "dailyCost", "standardCost"]]), 'Ruoli');
            // Added "Competenze" column to Resources template
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["name", "email", "roleName", "horizontal", "location", "Competenze", "hireDate", "workSeniority", "notes"]]), 'Risorse');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["name", "clientName", "status", "budget", "realizationPercentage", "startDate", "endDate", "projectManager", "notes"]]), 'Progetti');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["name", "date", "type", "location"]]), 'Calendario');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["value"]]), 'Config_Horizontals');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["value"]]), 'Config_Seniority');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["value"]]), 'Config_ProjectStatus');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["value"]]), 'Config_ClientSectors');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["value"]]), 'Config_Locations');
            break;
        case 'staffing':
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Resource Name", "Project Name", "YYYY-MM-DD"]]), 'Staffing');
            break;
        case 'resource_requests':
             XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["projectName", "roleName", "requestorName", "startDate", "endDate", "commitmentPercentage", "isUrgent", "isTechRequest", "notes", "status"]]), 'Richieste_Risorse');
            break;
        case 'interviews':
             XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["candidateName", "candidateSurname", "birthDate", "horizontal", "roleName", "cv_summary", "interviewersNames", "interviewDate", "feedback", "notes", "hiringStatus", "entryDate", "status"]]), 'Colloqui');
            break;
        case 'skills':
             XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Nome Competenza", "Ambito", "Macro Ambito", "Certificazione"]]), 'Competenze');
             XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Nome Risorsa", "Nome Competenza", "Livello", "Data Conseguimento", "Data Scadenza"]]), 'Associazioni_Risorse');
            break;
        case 'leaves':
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Nome Risorsa", "Tipologia Assenza", "Data Inizio", "Data Fine", "Approvatori", "Stato", "Note"]]), 'Assenze');
            break;
        case 'users_permissions':
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Username", "Ruolo", "Email Risorsa", "Stato Attivo"]]), 'Utenti');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Ruolo", "Pagina", "Accesso Consentito"]]), 'Permessi');
            break;
    }

    XLSX.writeFile(wb, fileName);
};
