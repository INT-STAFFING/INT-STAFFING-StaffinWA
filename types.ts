export interface ConfigOption {
    id?: string;
    value: string;
}

export interface Client {
    id?: string;
    name: string;
    sector: string;
    contactEmail: string;
}

export interface Role {
    id?: string;
    name: string;
    seniorityLevel: string;
}

export interface Resource {
    id?: string;
    name: string;
    email: string;
    roleId: string;
    horizontal: string;
    hireDate: string; // YYYY-MM-DD
    workSeniority: number; // years
    dailyCost: number; // EUR
    notes?: string;
}

export interface Project {
    id?: string;
    name: string;
    clientId: string;
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    budget: number;
    realizationPercentage: number; // from 30 to 100
    projectManager: string;
    status: string;
    notes?: string;
}

export interface Assignment {
    id?: string;
    resourceId: string;
    projectId: string;
}

export interface Allocation {
    [assignmentId: string]: {
        [date: string]: number; // date is YYYY-MM-DD, value is percentage
    };
}