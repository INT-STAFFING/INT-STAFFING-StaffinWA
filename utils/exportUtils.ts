/**
 * @file exportUtils.ts
 * @description Funzioni di utilità per esportare dati in formato Excel.
 * Si assume che la libreria 'xlsx' sia caricata globalmente tramite CDN.
 */

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
 * @param {StaffingData} data - L'oggetto contenente tutti i dati dell'applicazione, solitamente dal contesto.
 */
export const exportDataToExcel = (data: StaffingData) => {
    const { clients, roles, resources, projects, assignments, allocations } = data;

    // 1. Prepara i dati per ciascun foglio, mappando gli ID a valori leggibili.
    const clientsSheet = clients.map(({ id, ...rest }) => rest);
    const rolesSheet = roles.map(({ id, ...rest }) => rest);
    
    const resourcesSheet = resources.map(r => ({
        name: r.name,
        email: r.email,
        roleName: roles.find(role => role.id === r.roleId)?.name || r.roleId,
        horizontal: r.horizontal,
        hireDate: r.hireDate,
        workSeniority: r.workSeniority,
        notes: r.notes || '',
    }));
    
    const projectsSheet = projects.map(p => ({
        name: p.name,
        clientName: clients.find(c => c.id === p.clientId)?.name || p.clientId,
        startDate: p.startDate,
        endDate: p.endDate,
        budget: p.budget,
        realizationPercentage: p.realizationPercentage,
        projectManager: p.projectManager,
        status: p.status,
        notes: p.notes || '',
    }));

    const assignmentsSheet = assignments.map(a => ({
        assignmentId: a.id,
        resourceName: resources.find(r => r.id === a.resourceId)?.name || a.resourceId,
        projectName: projects.find(p => p.id === a.projectId)?.name || a.projectId,
    }));

    // Trasforma l'oggetto delle allocazioni in un array piatto per l'esportazione.
    const allocationsSheet: { resourceName: string, projectName: string, date: string, percentage: number }[] = [];
    Object.entries(allocations).forEach(([assignmentId, dateAllocations]) => {
        const assignment = assignments.find(a => a.id === assignmentId);
        if (assignment) {
            const resource = resources.find(r => r.id === assignment.resourceId);
            const project = projects.find(p => p.id === assignment.projectId);
            Object.entries(dateAllocations as Record<string, number>).forEach(([date, percentage]) => {
                allocationsSheet.push({
                    resourceName: resource?.name || 'Unknown',
                    projectName: project?.name || 'Unknown',
                    date: date,
                    percentage: percentage
                });
            });
        }
    });

    // 2. Crea un nuovo workbook e aggiunge i fogli di lavoro.
    const wb = XLSX.utils.book_new();
    
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clientsSheet), 'Clienti');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rolesSheet), 'Ruoli');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resourcesSheet), 'Risorse');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(projectsSheet), 'Progetti');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(assignmentsSheet), 'Assegnazioni');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allocationsSheet), 'Allocazioni Giornaliere');
    
    // 3. Avvia il download del file Excel.
    XLSX.writeFile(wb, 'Staffing_Export.xlsx');
};

/**
 * Genera e avvia il download di un file Excel vuoto che funge da template per l'importazione massiva.
 * I nomi delle colonne corrispondono a quelli attesi dall'API di importazione.
 */
export const exportTemplateToExcel = () => {
    const wb = XLSX.utils.book_new();

    // NOTA: Gli header qui DEVONO corrispondere alle chiavi usate nell'endpoint API di importazione.
    const clientsHeaders = [["name", "sector", "contactEmail"]];
    const rolesHeaders = [["name", "seniorityLevel", "dailyCost"]];
    const resourcesHeaders = [["name", "email", "roleName", "horizontal", "hireDate", "workSeniority", "notes"]];
    const projectsHeaders = [["name", "clientName", "startDate", "endDate", "budget", "realizationPercentage", "projectManager", "status", "notes"]];

    const wsClients = XLSX.utils.aoa_to_sheet(clientsHeaders);
    const wsRoles = XLSX.utils.aoa_to_sheet(rolesHeaders);
    const wsResources = XLSX.utils.aoa_to_sheet(resourcesHeaders);
    const wsProjects = XLSX.utils.aoa_to_sheet(projectsHeaders);

    XLSX.utils.book_append_sheet(wb, wsClients, 'Clienti');
    XLSX.utils.book_append_sheet(wb, wsRoles, 'Ruoli');
    XLSX.utils.book_append_sheet(wb, wsResources, 'Risorse');
    XLSX.utils.book_append_sheet(wb, wsProjects, 'Progetti');

    XLSX.writeFile(wb, 'Staffing_Import_Template.xlsx');
};