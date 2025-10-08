// This assumes the xlsx library is loaded from a CDN in index.html
declare var XLSX: any;

interface StaffingData {
    clients: any[];
    roles: any[];
    resources: any[];
    projects: any[];
    assignments: any[];
    allocations: any;
}

export const exportDataToExcel = (data: StaffingData) => {
    const { clients, roles, resources, projects, assignments, allocations } = data;

    // 1. Prepare data for sheets
    const clientsSheet = clients.map(({ id, ...rest }) => rest);
    const rolesSheet = roles.map(({ id, ...rest }) => rest);
    
    const resourcesSheet = resources.map(r => ({
        name: r.name,
        email: r.email,
        roleName: roles.find(role => role.id === r.roleId)?.name || r.roleId,
        horizontal: r.horizontal,
        hireDate: r.hireDate,
        workSeniority: r.workSeniority,
        dailyCost: r.dailyCost,
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


    // 2. Create workbook and worksheets
    const wb = XLSX.utils.book_new();
    
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clientsSheet), 'Clienti');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rolesSheet), 'Ruoli');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resourcesSheet), 'Risorse');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(projectsSheet), 'Progetti');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(assignmentsSheet), 'Assegnazioni');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allocationsSheet), 'Allocazioni Giornaliere');
    
    // 3. Trigger download
    XLSX.writeFile(wb, 'Staffing_Export.xlsx');
};

export const exportTemplateToExcel = () => {
    const wb = XLSX.utils.book_new();

    // NOTE: The headers here MUST match the keys used in the API endpoint for import.
    // Making them camelCase aligns with the rest of the app and JSON standards.
    const clientsHeaders = [["name", "sector", "contactEmail"]];
    const rolesHeaders = [["name", "seniorityLevel"]];
    const resourcesHeaders = [["name", "email", "roleName", "horizontal", "hireDate", "workSeniority", "dailyCost", "notes"]];
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
