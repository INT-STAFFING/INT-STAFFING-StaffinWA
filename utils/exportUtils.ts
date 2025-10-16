/**
 * @file exportUtils.ts
 * @description Funzioni di utilità per esportare dati in formato Excel.
 * Si assume che la libreria 'xlsx' sia caricata globalmente tramite CDN.
 */

import { getWorkingDaysBetween, isHoliday, formatDate, addDays } from './dateUtils';
import { Client, Role, Resource, Project, Assignment, Allocation, ConfigOption, CalendarEvent } from '../types';

// Dichiarazione per informare TypeScript che la variabile XLSX esiste a livello globale.
declare var XLSX: any;

/**
 * @type ExportData
 * @description Definisce la struttura dei dati di staffing passati alla funzione di esportazione.
 * Corrisponde ai dati contenuti nei contesti dell'applicazione.
 */
type ExportData = {
    clients: Client[];
    roles: Role[];
    resources: Resource[];
    projects: Project[];
    assignments: Assignment[];
    allocations: Allocation;
    companyCalendar: CalendarEvent[];
    horizontals: ConfigOption[];
    seniorityLevels: ConfigOption[];
    projectStatuses: ConfigOption[];
    clientSectors: ConfigOption[];
    locations: ConfigOption[];
};


/**
 * Esporta tutti i dati principali dell'applicazione in un singolo file Excel con fogli multipli.
 * I fogli sono formattati per assomigliare il più possibile alla visualizzazione nell'app.
 * @param {ExportData} data - L'oggetto contenente tutti i dati dell'applicazione da esportare.
 */
export const exportDataToExcel = (data: ExportData) => {
    if (!data) return;
    const { clients, roles, resources, projects, assignments, allocations, companyCalendar, horizontals, seniorityLevels, projectStatuses, clientSectors, locations } = data;

    const wb = XLSX.utils.book_new();

    // --- Foglio: Clienti ---
    const clientsSheetData = clients.map(c => ({
        'Nome Cliente': c.name,
        'Settore': c.sector,
        'Email Contatto': c.contactEmail,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clientsSheetData), 'Clienti');

    // --- Foglio: Ruoli ---
    const rolesSheetData = roles.map(r => ({
        'Nome Ruolo': r.name,
        'Livello Seniority': r.seniorityLevel,
        'Costo Giornaliero (€)': r.dailyCost,
        'Costo Standard (€)': r.standardCost,
        'Spese Giornaliere Calcolate (€)': r.dailyExpenses,
    }));
     XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rolesSheetData), 'Ruoli');

    // --- Foglio: Risorse ---
    const resourcesSheetData = resources.map(r => {
        const role = roles.find(role => role.id === r.roleId);
        return {
            'Nome': r.name,
            'Email': r.email,
            'Sede': r.location,
            'Ruolo': role?.name || 'N/A',
            'Horizontal': r.horizontal,
            'Data Assunzione': r.hireDate,
            'Anzianità Lavorativa (anni)': r.workSeniority,
            'Note': r.notes || '',
        };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resourcesSheetData), 'Risorse');
    
    // --- Foglio: Progetti ---
    const projectsSheetData = projects.map(p => ({
        'Nome Progetto': p.name,
        'Cliente': clients.find(c => c.id === p.clientId)?.name || 'N/A',
        'Stato': p.status,
        'Budget (€)': p.budget,
        'Realizzazione (%)': p.realizationPercentage,
        'Data Inizio': p.startDate,
        'Data Fine': p.endDate,
        'Project Manager': p.projectManager,
        'Note': p.notes || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(projectsSheetData), 'Progetti');

    // --- Foglio: Calendario ---
    const calendarSheetData = companyCalendar
        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(e => ({
            'Nome Evento': e.name,
            'Data': e.date,
            'Tipo': e.type,
            'Sede (se locale)': e.location || 'Tutte',
        }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(calendarSheetData), 'Calendario');

    // --- Fogli di Configurazione ---
    const configToSheet = (configItems: { value: string }[], sheetName: string) => {
        const sheetData = configItems.map(item => ({ Valore: item.value }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetData), sheetName);
    };
    configToSheet(horizontals, 'Config_Horizontals');
    configToSheet(seniorityLevels, 'Config_Seniority');
    configToSheet(projectStatuses, 'Config_ProjectStatus');
    configToSheet(clientSectors, 'Config_ClientSectors');
    configToSheet(locations, 'Config_Locations');


    // --- Foglio: Staffing (vista a griglia) ---
    const staffingSheetData: any[] = [];
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30); // 30 giorni nel passato
    const numDays = 90; // Orizzonte di 90 giorni

    const dateColumns = Array.from({ length: numDays }).map((_, i) => {
        const date = addDays(startDate, i);
        return formatDate(date, 'iso');
    });

    const sortedResources = [...resources].sort((a,b) => a.name.localeCompare(b.name));

    sortedResources.forEach(resource => {
        const resourceAssignments = assignments.filter(a => a.resourceId === resource.id);
        const role = roles.find(r => r.id === resource.roleId);
        
        const totalLoadRow: { [key: string]: string | number } = {
            'Risorsa': '', 'Ruolo': '', 'Cliente': '', 'Project Manager': '', 'Progetto': `Carico Totale ${resource.name}`
        };
        dateColumns.forEach(d => totalLoadRow[d] = 0);

        if (resourceAssignments.length === 0) {
            // Aggiunge la risorsa anche se non ha assegnazioni
             const emptyRow: { [key: string]: string | number } = {
                'Risorsa': resource.name, 'Ruolo': role?.name || 'N/A', 'Cliente': '-', 'Project Manager': '-', 'Progetto': 'Non Assegnata'
            };
            dateColumns.forEach(d => emptyRow[d] = 0);
            staffingSheetData.push(emptyRow);
        } else {
            resourceAssignments.forEach((assignment, index) => {
                const project = projects.find(p => p.id === assignment.projectId);
                const client = clients.find(c => c.id === project?.clientId);

                const assignmentRow: { [key: string]: string | number } = {
                    'Risorsa': index === 0 ? resource.name : '',
                    'Ruolo': index === 0 ? (role?.name || 'N/A') : '',
                    'Cliente': client?.name || 'N/A',
                    'Project Manager': project?.projectManager || 'N/A',
                    'Progetto': project?.name || 'N/A',
                };

                dateColumns.forEach(d => {
                    const percentage = allocations[assignment.id]?.[d] || 0;
                    assignmentRow[d] = percentage;
                    (totalLoadRow[d] as number) += percentage;
                });
                staffingSheetData.push(assignmentRow);
            });
        }
        
        staffingSheetData.push(totalLoadRow);
        // Aggiunge una riga vuota per separazione visiva
        staffingSheetData.push({});
    });
    
    const wsStaffing = XLSX.utils.json_to_sheet(staffingSheetData);
    // Imposta la larghezza delle prime colonne per una migliore leggibilità
    wsStaffing['!cols'] = [ { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 30 } ];
    XLSX.utils.book_append_sheet(wb, wsStaffing, 'Staffing');
    
    // --- Download del file ---
    XLSX.writeFile(wb, `Staffing_Export_${formatDate(new Date(), 'iso')}.xlsx`);
};

/**
 * Genera e avvia il download di un file Excel vuoto che funge da template per l'importazione massiva.
 * Include un foglio di istruzioni per guidare l'utente.
 */
export const exportTemplateToExcel = () => {
    const wb = XLSX.utils.book_new();

    // Foglio di istruzioni
    const instructions = [
        ["Istruzioni per l'Importazione Massiva"],
        [],
        ["GENERALE"],
        ["- Non modificare i nomi dei fogli o i nomi delle colonne (la prima riga di ogni foglio)."],
        ["- Compila ogni foglio con i dati richiesti. L'ordine di importazione logico è: Configurazioni, Calendario, Ruoli, Clienti, Risorse, Progetti."],
        ["- I dati esistenti (con lo stesso nome/email/valore) verranno saltati per evitare duplicati."],
        [],
        ["FOGLI CONFIGURAZIONE (Config_*)"],
        ["- Questi fogli servono a pre-popolare le opzioni per i menu a tendina dell'applicazione."],
        ["- Inserire un valore per riga nella colonna 'value'."],
        [],
        ["FORMATO COLONNE SPECIFICHE"],
        ["- Date (hireDate, startDate, endDate, date): Usa il formato AAAA-MM-GG (es. 2024-12-31)."],
        ["- Campi numerici (dailyCost, budget, etc.): Inserire solo numeri, senza simboli di valuta o separatori delle migliaia."],
        ["- 'roleName' (foglio 'Risorse'): Deve corrispondere esattamente a un 'name' nel foglio 'Ruoli'."],
        ["- 'clientName' (foglio 'Progetti'): Deve corrispondere a un 'name' nel foglio 'Clienti'."],
        ["- 'type' (foglio 'Calendario'): Valori ammessi sono NATIONAL_HOLIDAY, COMPANY_CLOSURE, LOCAL_HOLIDAY."],
        ["- 'location' (foglio 'Calendario'): Compilare solo se 'type' è LOCAL_HOLIDAY. Deve corrispondere a un valore in 'Config_Locations'."],
    ];
    const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
    wsInstructions['!cols'] = [{ wch: 120 }];
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Istruzioni');

    // Headers per ogni foglio
    // NOTA: Gli header qui DEVONO corrispondere alle chiavi usate nell'endpoint API di importazione.
    const configHeaders = [["value"]];
    const calendarHeaders = [["name", "date", "type", "location"]];
    const clientsHeaders = [["name", "sector", "contactEmail"]];
    const rolesHeaders = [["name", "seniorityLevel", "dailyCost", "standardCost"]];
    const resourcesHeaders = [["name", "email", "roleName", "horizontal", "location", "hireDate", "workSeniority", "notes"]];
    const projectsHeaders = [["name", "clientName", "status", "budget", "realizationPercentage", "startDate", "endDate", "projectManager", "notes"]];

    // Creazione fogli
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(clientsHeaders), 'Clienti');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rolesHeaders), 'Ruoli');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resourcesHeaders), 'Risorse');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(projectsHeaders), 'Progetti');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(calendarHeaders), 'Calendario');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(configHeaders), 'Config_Horizontals');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(configHeaders), 'Config_Seniority');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(configHeaders), 'Config_ProjectStatus');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(configHeaders), 'Config_ClientSectors');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(configHeaders), 'Config_Locations');

    XLSX.writeFile(wb, 'Staffing_Import_Template.xlsx');
};