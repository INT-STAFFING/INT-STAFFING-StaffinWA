/**
 * @file exportUtils.ts
 * @description Funzioni di utilità per esportare dati in formato Excel.
 * Si assume che la libreria 'xlsx' sia caricata globalmente tramite CDN.
 */

import { getWorkingDaysBetween } from './dateUtils';

// Dichiarazione per informare TypeScript che la variabile XLSX esiste a livello globale.
declare var XLSX: any;

/**
 * @interface StaffingData
 * @description Definisce la struttura dei dati di staffing passati alla funzione di esportazione.
 */
interface StaffingData {
    clients: any[];
    roles: any[];
    resources: any[];
    projects: any[];
    assignments: any[];
    allocations: any;
}

/**
 * Esporta tutti i dati principali dell'applicazione in un singolo file Excel con fogli multipli.
 * I fogli sono formattati per assomigliare il più possibile alla visualizzazione nell'app.
 * @param {StaffingData} data - L'oggetto contenente tutti i dati dell'applicazione, solitamente dal contesto.
 */
export const exportDataToExcel = (data: StaffingData) => {
    const { clients, roles, resources, projects, assignments, allocations } = data;

    /**
     * Calcola l'allocazione media di una risorsa per un dato mese.
     * @param {string} resourceId - L'ID della risorsa.
     * @param {number} [monthOffset=0] - 0 per il mese corrente, 1 per il prossimo, etc.
     * @returns {number} La percentuale di allocazione media.
     */
    const calculateResourceAllocation = (resourceId: string, monthOffset: number = 0): number => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1 + monthOffset, 0);
        const workingDaysInMonth = getWorkingDaysBetween(firstDay, lastDay);

        if (workingDaysInMonth === 0) return 0;
        const resourceAssignments = assignments.filter(a => a.resourceId === resourceId);
        if (resourceAssignments.length === 0) return 0;

        let totalPersonDays = 0;
        resourceAssignments.forEach(assignment => {
            const assignmentAllocations = allocations[assignment.id];
            if (assignmentAllocations) {
                for (const dateStr in assignmentAllocations) {
                    const allocDate = new Date(dateStr);
                    if (allocDate >= firstDay && allocDate <= lastDay) {
                        totalPersonDays += (assignmentAllocations[dateStr] / 100);
                    }
                }
            }
        });
        return Math.round((totalPersonDays / workingDaysInMonth) * 100);
    };

    // 1. Prepara i dati per ciascun foglio, con intestazioni chiare e campi calcolati.
    
    const clientsSheetData = clients.map(c => ({
        'Nome Cliente': c.name,
        'Settore': c.sector,
        'Email Contatto': c.contactEmail,
    }));

    const rolesSheetData = roles.map(r => ({
        'Nome Ruolo': r.name,
        'Livello Seniority': r.seniorityLevel,
        'Costo Giornaliero (€)': r.dailyCost,
    }));
    
    const resourcesSheetData = resources.map(r => {
        const role = roles.find(role => role.id === r.roleId);
        return {
            'Nome': r.name,
            'Email': r.email,
            'Ruolo': role?.name || 'N/A',
            'Horizontal': r.horizontal,
            'Costo Giornaliero (€)': role?.dailyCost || 0,
            'Allocazione Media Mese Corrente (%)': calculateResourceAllocation(r.id!),
            'Data Assunzione': r.hireDate,
            'Anzianità Lavorativa (anni)': r.workSeniority,
            'Note': r.notes || '',
        };
    });
    
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

    // Crea un unico foglio "Dettaglio Staffing" che combina Assegnazioni e Allocazioni.
    const staffingSheetData: { 'Data': string, 'Risorsa': string, 'Ruolo': string, 'Progetto': string, 'Cliente': string, 'Allocazione (%)': number }[] = [];
    Object.entries(allocations).forEach(([assignmentId, dateAllocations]) => {
        const assignment = assignments.find(a => a.id === assignmentId);
        if (assignment) {
            const resource = resources.find(r => r.id === assignment.resourceId);
            const project = projects.find(p => p.id === assignment.projectId);
            if (resource && project) {
                const client = clients.find(c => c.id === project.clientId);
                const role = roles.find(ro => ro.id === resource.roleId);
                Object.entries(dateAllocations as Record<string, number>).forEach(([date, percentage]) => {
                    staffingSheetData.push({
                        'Data': date,
                        'Risorsa': resource.name,
                        'Ruolo': role?.name || 'N/A',
                        'Progetto': project.name,
                        'Cliente': client?.name || 'N/A',
                        'Allocazione (%)': percentage
                    });
                });
            }
        }
    });
    // Ordina i dati per data e poi per risorsa per una migliore leggibilità.
    staffingSheetData.sort((a, b) => {
        if (a.Data > b.Data) return 1;
        if (a.Data < b.Data) return -1;
        if (a.Risorsa > b.Risorsa) return 1;
        if (a.Risorsa < b.Risorsa) return -1;
        return 0;
    });

    // 2. Crea un nuovo workbook e aggiunge i fogli di lavoro.
    const wb = XLSX.utils.book_new();
    
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resourcesSheetData), 'Risorse');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(projectsSheetData), 'Progetti');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clientsSheetData), 'Clienti');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rolesSheetData), 'Ruoli');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(staffingSheetData), 'Dettaglio Staffing');
    
    // 3. Avvia il download del file Excel.
    XLSX.writeFile(wb, 'Staffing_Export.xlsx');
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
        [], // Riga vuota
        ["1. Non modificare i nomi dei fogli (in basso) o i nomi delle colonne (la prima riga di ogni foglio)."],
        ["2. Compila ogni foglio con i dati richiesti. L'ordine di importazione è: Ruoli, Clienti, Risorse, Progetti."],
        ["3. I dati esistenti (con lo stesso nome/email) verranno saltati per evitare duplicati."],
        [],
        ["Formato Colonne:"],
        ["- roleName (nel foglio 'Risorse'): Deve corrispondere esattamente a un 'name' nel foglio 'Ruoli'."],
        ["- clientName (nel foglio 'Progetti'): Deve corrispondere esattamente a un 'name' nel foglio 'Clienti'."],
        ["- Date (hireDate, startDate, endDate): Usa il formato AAAA-MM-GG (es. 2024-12-31)."],
        ["- Campi numerici (dailyCost, budget, ecc.): Inserire solo numeri, senza simboli di valuta."],
    ];
    const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
    // Imposta la larghezza delle colonne per una migliore leggibilità
    wsInstructions['!cols'] = [{ wch: 100 }];


    // NOTA: Gli header qui DEVONO corrispondere alle chiavi usate nell'endpoint API di importazione.
    const clientsHeaders = [["name", "sector", "contactEmail"]];
    const rolesHeaders = [["name", "seniorityLevel", "dailyCost"]];
    const resourcesHeaders = [["name", "email", "roleName", "horizontal", "hireDate", "workSeniority", "notes"]];
    // Colonne Progetti riordinate per coerenza con la UI
    const projectsHeaders = [["name", "clientName", "status", "budget", "realizationPercentage", "startDate", "endDate", "projectManager", "notes"]];

    const wsClients = XLSX.utils.aoa_to_sheet(clientsHeaders);
    const wsRoles = XLSX.utils.aoa_to_sheet(rolesHeaders);
    const wsResources = XLSX.utils.aoa_to_sheet(resourcesHeaders);
    const wsProjects = XLSX.utils.aoa_to_sheet(projectsHeaders);

    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Istruzioni');
    XLSX.utils.book_append_sheet(wb, wsClients, 'Clienti');
    XLSX.utils.book_append_sheet(wb, wsRoles, 'Ruoli');
    XLSX.utils.book_append_sheet(wb, wsResources, 'Risorse');
    XLSX.utils.book_append_sheet(wb, wsProjects, 'Progetti');

    XLSX.writeFile(wb, 'Staffing_Import_Template.xlsx');
};
