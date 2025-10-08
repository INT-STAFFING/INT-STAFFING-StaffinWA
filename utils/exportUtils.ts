
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
        ...r,
        role: roles.find(role => role.id === r.roleId)?.name || r.roleId
    })).map(({ id, roleId, ...rest }) => rest);
    
    const projectsSheet = projects.map(p => ({
        ...p,
        client: clients.find(c => c.id === p.clientId)?.name || p.clientId
    })).map(({ id, clientId, ...rest }) => rest);

    const assignmentsSheet = assignments.map(a => ({
        assignmentId: a.id,
        resource: resources.find(r => r.id === a.resourceId)?.name || a.resourceId,
        project: projects.find(p => p.id === a.projectId)?.name || a.projectId,
    }));

    const allocationsSheet: { resource: string, project: string, date: string, percentage: number }[] = [];
    Object.entries(allocations).forEach(([assignmentId, dateAllocations]) => {
        const assignment = assignments.find(a => a.id === assignmentId);
        if (assignment) {
            const resource = resources.find(r => r.id === assignment.resourceId);
            const project = projects.find(p => p.id === assignment.projectId);
            Object.entries(dateAllocations as Record<string, number>).forEach(([date, percentage]) => {
                allocationsSheet.push({
                    resource: resource?.name || 'Unknown',
                    project: project?.name || 'Unknown',
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
