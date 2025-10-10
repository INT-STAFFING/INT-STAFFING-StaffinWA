/**
 * @file types.ts
 * @description Definizioni dei tipi e delle interfacce TypeScript utilizzate in tutta l'applicazione.
 */

/**
 * @interface ConfigOption
 * @description Rappresenta una singola opzione di configurazione (es. Horizontal, Seniority Level).
 */
export interface ConfigOption {
    /** @property {string} [id] - L'identificatore univoco, generato dal database. */
    id?: string;
    /** @property {string} value - Il valore visualizzato dell'opzione. */
    value: string;
}

/**
 * @interface Client
 * @description Rappresenta un cliente dell'azienda.
 */
export interface Client {
    /** @property {string} [id] - L'identificatore univoco, generato dal database. */
    id?: string;
    /** @property {string} name - Il nome del cliente. */
    name: string;
    /** @property {string} sector - Il settore di mercato del cliente. */
    sector: string;
    /** @property {string} contactEmail - L'email di contatto principale del cliente. */
    contactEmail: string;
}

/**
 * @interface Role
 * @description Rappresenta un ruolo professionale all'interno dell'azienda.
 */
export interface Role {
    /** @property {string} [id] - L'identificatore univoco, generato dal database. */
    id?: string;
    /** @property {string} name - Il nome del ruolo (es. "Senior Developer"). */
    name: string;
    /** @property {string} seniorityLevel - Il livello di anzianità associato al ruolo (es. "Senior"). */
    seniorityLevel: string;
    /** @property {number} dailyCost - Il costo giornaliero standard per questo ruolo. */
    dailyCost: number;
}

/**
 * @interface Resource
 * @description Rappresenta una risorsa umana (un dipendente).
 */
export interface Resource {
    /** @property {string} [id] - L'identificatore univoco, generato dal database. */
    id?: string;
    /** @property {string} name - Il nome e cognome della risorsa. */
    name: string;
    /** @property {string} email - L'indirizzo email della risorsa. */
    email: string;
    /** @property {string} roleId - L'ID del ruolo associato alla risorsa. */
    roleId: string;
    /** @property {string} horizontal - L'area di competenza principale (es. "Web Development"). */
    horizontal: string;
    /** @property {string} location - La sede di lavoro della risorsa (es. "Milano"). */
    location: string;
    /** @property {string} hireDate - La data di assunzione in formato YYYY-MM-DD. */
    hireDate: string; 
    /** @property {number} workSeniority - Gli anni di anzianità lavorativa. */
    workSeniority: number;
    /** @property {string} [notes] - Note aggiuntive sulla risorsa. */
    notes?: string;
}

/**
 * @interface Project
 * @description Rappresenta un progetto aziendale. La definizione è flessibile per rispecchiare
 * lo schema del database, dove molte colonne possono essere NULL. Questo previene errori di tipo
 * e bug nel frontend, specialmente nei form, garantendo che i campi opzionali siano gestiti
 * correttamente come 'string | null'.
 */
export interface Project {
    /** @property {string} [id] - L'identificatore univoco, generato dal database. */
    id?: string;
    /** @property {string} name - Il nome del progetto. */
    name: string;
    /** @property {string | null} clientId - L'ID del cliente associato al progetto. Può essere nullo. */
    clientId: string | null;
    /** @property {string | null} startDate - La data di inizio del progetto in formato YYYY-MM-DD. */
    startDate: string | null;
    /** @property {string | null} endDate - La data di fine del progetto in formato YYYY-MM-DD. */
    endDate: string | null;
    /** @property {number} budget - Il budget totale del progetto. */
    budget: number;
    /** @property {number} realizationPercentage - Una percentuale che può influenzare il calcolo dei costi. */
    realizationPercentage: number;
    /** @property {string | null} projectManager - Il nome del project manager. */
    projectManager: string | null;
    /** @property {string | null} status - Lo stato attuale del progetto (es. "In corso"). */
    status: string | null;
    /** @property {string | null} [notes] - Note aggiuntive sul progetto. */
    notes?: string | null;
}


/**
 * @interface Assignment
 * @description Rappresenta l'assegnazione di una risorsa a un progetto.
 */
export interface Assignment {
    /** @property {string} [id] - L'identificatore univoco, generato dal database. */
    id?: string;
    /** @property {string} resourceId - L'ID della risorsa assegnata. */
    resourceId: string;
    /** @property {string} projectId - L'ID del progetto a cui la risorsa è assegnata. */
    projectId: string;
}

/**
 * @interface Allocation
 * @description Struttura dati che mappa le allocazioni giornaliere.
 * La chiave esterna è l'ID dell'assegnazione (`assignmentId`).
 * La chiave interna è la data in formato YYYY-MM-DD.
 * Il valore è la percentuale di allocazione (da 0 a 100).
 */
export interface Allocation {
    [assignmentId: string]: {
        [date: string]: number;
    };
}

/**
 * @enum CalendarEventType
 * @description Definisce i tipi di eventi del calendario aziendale.
 */
export type CalendarEventType = 'NATIONAL_HOLIDAY' | 'COMPANY_CLOSURE' | 'LOCAL_HOLIDAY';

/**
 * @interface CalendarEvent
 * @description Rappresenta un evento nel calendario aziendale (festività, chiusura).
 */
export interface CalendarEvent {
    /** @property {string} [id] - L'identificatore univoco, generato dal database. */
    id?: string;
    /** @property {string} name - Il nome dell'evento (es. "Natale"). */
    name: string;
    /** @property {string} date - La data dell'evento in formato YYYY-MM-DD. */
    date: string;
    /** @property {CalendarEventType} type - Il tipo di evento. */
    type: CalendarEventType;
    /** @property {string | null} location - La sede specifica per l'evento, se di tipo 'LOCAL_HOLIDAY'. */
    location: string | null;
}