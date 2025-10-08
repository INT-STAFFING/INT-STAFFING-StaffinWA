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
    dailyCost: number;
}

export interface Resource {
    id?: string;
    name: string;
    email: string;
    roleId: string;
    horizontal: string;
    hireDate: string; // YYYY-MM-DD
    workSeniority: number; // years
    notes?: string;
}

// COMMENTO: La definizione del tipo 'Project' è stata resa più flessibile per rispecchiare
// accuratamente lo schema del database, dove molte colonne possono essere NULL.
// Questo previene errori di tipo e bug nel frontend, specialmente nei form,
// garantendo che i campi opzionali siano gestiti correttamente come 'string | null'.
export interface Project {
    id?: string;
    name: string;
    clientId: string | null;
    startDate: string | null;
    endDate: string | null;
    budget: number;
    realizationPercentage: number;
    projectManager: string | null;
    status: string | null;
    notes?: string | null;
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