
import { Client, Role, Resource, Project, Assignment, Allocation, ConfigOption } from '../types';

export const generateSampleData = () => {
    // Configuration Data
    const horizontals: ConfigOption[] = [
        { id: 'h1', value: 'Web Development' },
        { id: 'h2', value: 'Data Science' },
        { id: 'h3', value: 'DevOps' },
        { id: 'h4', value: 'Design' },
        { id: 'h5', value: 'Management' },
    ];
    const seniorityLevels: ConfigOption[] = [
        { id: 's1', value: 'Junior' },
        { id: 's2', value: 'Mid' },
        { id: 's3', value: 'Senior' },
        { id: 's4', value: 'Lead' },
        { id: 's5', value: 'Manager' },
    ];
    const projectStatuses: ConfigOption[] = [
        { id: 'ps1', value: 'In corso' },
        { id: 'ps2', value: 'Completato' },
        { id: 'ps3', value: 'In pausa' },
    ];
     const clientSectors: ConfigOption[] = [
        { id: 'cs1', value: 'Tecnologia' },
        { id: 'cs2', value: 'Finanza' },
        { id: 'cs3', value: 'Retail' },
        { id: 'cs4', value: 'Sanità' },
    ];

    // Core Data
    const clients: Client[] = [
        { id: 'c1', name: 'Acme Corp', sector: 'Tecnologia', contactEmail: 'contact@acme.com' },
        { id: 'c2', name: 'Innovate LLC', sector: 'Finanza', contactEmail: 'finance@innovate.com' },
    ];

    const roles: Role[] = [
        { id: 'r1', name: 'Junior Developer', seniorityLevel: 'Junior' },
        { id: 'r2', name: 'Senior Developer', seniorityLevel: 'Senior' },
        { id: 'r3', name: 'Tech Lead', seniorityLevel: 'Lead' },
        { id: 'r4', name: 'Project Manager', seniorityLevel: 'Senior' },
    ];

    const resources: Resource[] = [
        { id: 'res1', name: 'Mario Rossi', email: 'm.rossi@example.com', roleId: 'r2', horizontal: 'Web Development', hireDate: '2022-01-15', workSeniority: 5, dailyCost: 500 },
        { id: 'res2', name: 'Laura Bianchi', email: 'l.bianchi@example.com', roleId: 'r1', horizontal: 'Web Development', hireDate: '2023-06-01', workSeniority: 1, dailyCost: 300 },
        { id: 'res3', name: 'Paolo Verdi', email: 'p.verdi@example.com', roleId: 'r3', horizontal: 'DevOps', hireDate: '2020-03-10', workSeniority: 8, dailyCost: 650 },
        { id: 'res4', name: 'Giulia Neri', email: 'g.neri@example.com', roleId: 'r4', horizontal: 'Management', hireDate: '2019-09-20', workSeniority: 10, dailyCost: 700 },
    ];

    const projects: Project[] = [
        { id: 'p1', name: 'E-commerce Platform', clientId: 'c1', startDate: '2024-10-01', endDate: '2024-12-31', budget: 150000, realizationPercentage: 100, projectManager: 'Giulia Neri', status: 'In corso' },
        { id: 'p2', name: 'Mobile Banking App', clientId: 'c2', startDate: '2024-11-01', endDate: '2025-03-31', budget: 250000, realizationPercentage: 90, projectManager: 'Giulia Neri', status: 'In corso' },
        { id: 'p3', name: 'Infrastruttura Cloud', clientId: 'c1', startDate: '2024-09-15', endDate: '2024-11-30', budget: 80000, realizationPercentage: 100, projectManager: 'Paolo Verdi', status: 'Completato' },
    ];

    const assignments: Assignment[] = [
        { id: 'as1', resourceId: 'res1', projectId: 'p1' },
        { id: 'as2', resourceId: 'res2', projectId: 'p1' },
        { id: 'as3', resourceId: 'res1', projectId: 'p2' },
        { id: 'as4', resourceId: 'res3', projectId: 'p3' },
        { id: 'as5', resourceId: 'res3', projectId: 'p2' },
    ];

    const allocations: Allocation = {};
    const today = new Date();
    for (let i = 0; i < 15; i++) {
        const date = new Date();
        date.setDate(today.getDate() + i);
        const day = date.getDay();
        if (day !== 0 && day !== 6) {
            const dateStr = date.toISOString().split('T')[0];
            if (!allocations['as1']) allocations['as1'] = {};
            allocations['as1'][dateStr] = 50;
        }
    }
     for (let i = 0; i < 10; i++) {
        const date = new Date();
        date.setDate(today.getDate() + i);
        const day = date.getDay();
        if (day !== 0 && day !== 6) {
            const dateStr = date.toISOString().split('T')[0];
            if (!allocations['as2']) allocations['as2'] = {};
            allocations['as2'][dateStr] = 100;
        }
    }
     for (let i = 0; i < 5; i++) {
        const date = new Date();
        date.setDate(today.getDate() + i);
        const day = date.getDay();
        if (day !== 0 && day !== 6) {
            const dateStr = date.toISOString().split('T')[0];
            if (!allocations['as3']) allocations['as3'] = {};
            allocations['as3'][dateStr] = 60;
        }
    }

    return { clients, roles, resources, projects, assignments, allocations, horizontals, seniorityLevels, projectStatuses, clientSectors };
};
