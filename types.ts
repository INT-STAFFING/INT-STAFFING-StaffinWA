
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
    /** @property {number} [standardCost] - Un costo standard personalizzato per il ruolo. */
    standardCost?: number;
    /** @property {number} [dailyExpenses] - Le spese giornaliere accessorie, calcolate in base al costo giornaliero. */
    dailyExpenses?: number;
}

/**
 * @interface RoleCostHistory
 * @description Rappresenta la storia del costo giornaliero di un ruolo nel tempo.
 */
export interface RoleCostHistory {
    /** @property {string} id - ID univoco del record storico. */
    id: string;
    /** @property {string} roleId - ID del ruolo associato. */
    roleId: string;
    /** @property {number} dailyCost - Il costo in vigore in quel periodo. */
    dailyCost: number;
    /** @property {string} startDate - Data di inizio validità (YYYY-MM-DD). */
    startDate: string;
    /** @property {string | null} endDate - Data di fine validità (YYYY-MM-DD) o null se è il record corrente. */
    endDate: string | null;
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
    /** @property {number} maxStaffingPercentage - La percentuale massima di allocazione per questa risorsa. */
    maxStaffingPercentage: number;
    /** @property {boolean} resigned - Flag che indica se la risorsa è dimessa. */
    resigned: boolean;
    /** @property {string | null} lastDayOfWork - L'ultimo giorno di lavoro della risorsa (YYYY-MM-DD). */
    lastDayOfWork: string | null;
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
    /** @property {string | null} [contractId] - L'ID del contratto associato (opzionale). */
    contractId?: string | null;
}

/**
 * @interface Contract
 * @description Rappresenta un contratto.
 */
export interface Contract {
    /** @property {string} [id] - L'identificatore univoco. */
    id?: string;
    /** @property {string} name - Nome descrittivo del contratto. */
    name: string;
    /** @property {string | null} startDate - Data di inizio del contratto. */
    startDate: string | null;
    /** @property {string | null} endDate - Data di fine del contratto. */
    endDate: string | null;
    /** @property {string} cig - Codice CIG. */
    cig: string;
    /** @property {string | null} cigDerivato - Codice CIG derivato (opzionale). */
    cigDerivato: string | null;
    /** @property {number} capienza - Importo totale in € del contratto. */
    capienza: number;
    /** @property {number} backlog - Capienza residua calcolata. */
    backlog: number;
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

/**
 * @interface WbsTask
 * @description Rappresenta un incarico professionale (Work Breakdown Structure).
 */
export interface WbsTask {
    /** @property {string} [id] - L'identificatore univoco, generato dal database. */
    id?: string;
    /** @property {string} elementoWbs - Il codice identificativo dell'elemento WBS. */
    elementoWbs: string;
    /** @property {string} descrizioneWbe - La descrizione dell'incarico. */
    descrizioneWbe: string;
    /** @property {string | null} clientId - L'ID del cliente associato. */
    clientId: string | null;
    /** @property {string} periodo - Il periodo di riferimento (es. "2024"). */
    periodo: string;
    /** @property {number} ore - Le ore di lavoro stimate/consuntivate. */
    ore: number;
    /** @property {number} produzioneLorda - Il valore della produzione lorda. */
    produzioneLorda: number;
    /** @property {number} oreNetworkItalia - Ore aggiuntive del network Italia. */
    oreNetworkItalia: number;
    /** @property {number} produzioneLordaNetworkItalia - Produzione lorda aggiuntiva del network. */
    produzioneLordaNetworkItalia: number;
    /** @property {number} perdite - Perdite stimate/consuntivate. */
    perdite: number;
    /** @property {number} realisation - Percentuale di "realisation". */
    realisation: number;
    /** @property {number} speseOnorariEsterni - Spese per onorari esterni. */
    speseOnorariEsterni: number;
    /** @property {number} speseAltro - Altre spese. */
    speseAltro: number;
    /** @property {number} fattureOnorari - Importo delle fatture per onorari. */
    fattureOnorari: number;
    /** @property {number} fattureSpese - Importo delle fatture per spese. */
    fattureSpese: number;
    /** @property {number} iva - Importo IVA. */
    iva: number;
    /** @property {number} incassi - Importo totale incassato. */
    incassi: number;
    /** @property {string | null} primoResponsabileId - ID del primo responsabile. */
    primoResponsabileId: string | null;
    /** @property {string | null} secondoResponsabileId - ID del secondo responsabile. */
    secondoResponsabileId: string | null;
}

/**
 * @enum ResourceRequestStatus
 * @description Definisce i possibili stati di una richiesta di risorsa.
 */
export type ResourceRequestStatus = 'ATTIVA' | 'STANDBY' | 'CHIUSA';

/**
 * @interface ResourceRequest
 * @description Rappresenta una richiesta di risorsa per un progetto.
 */
export interface ResourceRequest {
    /** @property {string} [id] - L'identificatore univoco, generato dal database. */
    id?: string;
    /** @property {string} [requestCode] - L'identificatore univoco e leggibile (es. HCR00001). */
    requestCode?: string;
    /** @property {string} projectId - L'ID del progetto di riferimento. */
    projectId: string;
    /** @property {string} roleId - L'ID del ruolo richiesto. */
    roleId: string;
    /** @property {string | null} requestorId - L'ID della risorsa che ha effettuato la richiesta. */
    requestorId: string | null;
    /** @property {string} startDate - Data di inizio attività richiesta. */
    startDate: string;
    /** @property {string} endDate - Data di fine attività richiesta. */
    endDate: string;
    /** @property {number} commitmentPercentage - Percentuale di impegno richiesta. */
    commitmentPercentage: number;
    /** @property {boolean} isUrgent - Flag "urgente". */
    isUrgent: boolean;
    /** @property {boolean} isLongTerm - Flag "lunga durata" (calcolato > 2 mesi). */
    isLongTerm: boolean;
    /** @property {boolean} isTechRequest - Flag "richiesta TECH". */
    isTechRequest: boolean;
    /** @property {string} [notes] - Note facoltative. */
    notes?: string;
    /** @property {ResourceRequestStatus} status - Stato della richiesta (es. 'ATTIVA', 'STANDBY', 'CHIUSA'). */
    status: ResourceRequestStatus;
}

/**
 * @enum InterviewFeedback
 * @description Definisce i possibili feedback di un colloquio.
 */
export type InterviewFeedback = 'Positivo' | 'Positivo On Hold' | 'Negativo';

/**
 * @enum InterviewHiringStatus
 * @description Definisce i possibili stati di assunzione di un candidato.
 */
export type InterviewHiringStatus = 'SI' | 'NO' | 'No Rifiutato' | 'In Fase di Offerta';

/**
 * @enum InterviewStatus
 * @description Definisce i possibili stati di un processo di selezione.
 */
export type InterviewStatus = 'Aperto' | 'Chiuso' | 'StandBy' | 'Non Contattabile';

/**
 * @interface Interview
 * @description Rappresenta un colloquio di selezione per un candidato.
 */
export interface Interview {
    /** @property {string} [id] - L'identificatore univoco, generato dal database. */
    id?: string;
    /** @property {string | null} resourceRequestId - L'ID della richiesta di risorsa associata (opzionale). */
    resourceRequestId: string | null;
    /** @property {string} candidateName - Nome del candidato. */
    candidateName: string;
    /** @property {string} candidateSurname - Cognome del candidato. */
    candidateSurname: string;
    /** @property {string | null} birthDate - Data di nascita del candidato. */
    birthDate: string | null;
    /** @property {string | null} horizontal - L'Horizontal di possibile inserimento. */
    horizontal: string | null;
    /** @property {string | null} roleId - L'ID del ruolo di possibile inserimento. */
    roleId: string | null;
    /** @property {string | null} cvSummary - Breve riassunto del CV. */
    cvSummary: string | null;
    /** @property {string[] | null} interviewersIds - Array di ID delle risorse che hanno partecipato al colloquio. */
    interviewersIds: string[] | null;
    /** @property {string | null} interviewDate - Data del colloquio. */
    interviewDate: string | null;
    /** @property {InterviewFeedback | null} feedback - Feedback del colloquio. */
    feedback: InterviewFeedback | null;
    /** @property {string | null} notes - Note aggiuntive sul colloquio. */
    notes: string | null;
    /** @property {InterviewHiringStatus | null} hiringStatus - Stato dell'assunzione. */
    hiringStatus: InterviewHiringStatus | null;
    /** @property {string | null} entryDate - Data di ingresso prevista. */
    entryDate: string | null;
    /** @property {InterviewStatus} status - Stato del processo di selezione. */
    status: InterviewStatus;
}

/**
 * @interface Skill
 * @description Rappresenta una competenza tecnica o soft skill.
 */
export interface Skill {
    /** @property {string} [id] - L'identificatore univoco. */
    id?: string;
    /** @property {string} name - Nome della competenza. */
    name: string;
    /** @property {string} [category] - Categoria della competenza (es. Frontend, Backend). */
    category?: string;
}

/**
 * @interface ResourceSkill
 * @description Rappresenta l'associazione tra una risorsa e una competenza.
 */
export interface ResourceSkill {
    /** @property {string} resourceId - ID della risorsa. */
    resourceId: string;
    /** @property {string} skillId - ID della competenza. */
    skillId: string;
    /** @property {number} [level] - Livello di competenza (1-5). */
    level?: number;
    /** @property {string | null} [acquisitionDate] - Data di conseguimento (opzionale). */
    acquisitionDate?: string | null;
    /** @property {string | null} [expirationDate] - Data di scadenza (opzionale). */
    expirationDate?: string | null;
}

/**
 * @interface ProjectSkill
 * @description Rappresenta l'associazione tra un progetto e una competenza.
 */
export interface ProjectSkill {
    /** @property {string} projectId - ID del progetto. */
    projectId: string;
    /** @property {string} skillId - ID della competenza. */
    skillId: string;
}

/**
 * @interface ComputedSkill
 * @description Rappresenta una competenza aggregata per una risorsa, combinando dati manuali e inferiti.
 */
export interface ComputedSkill {
    /** @property {Skill} skill - L'oggetto Skill completo. */
    skill: Skill;
    /** @property {ResourceSkill | undefined} manualDetails - Dettagli manuali se presenti (es. date certificazione, livello manuale). */
    manualDetails?: ResourceSkill;
    /** @property {number} inferredDays - Giorni/Uomo totali calcolati dai progetti. */
    inferredDays: number;
    /** @property {number} inferredLevel - Livello calcolato in base ai giorni lavorati (1-5). */
    inferredLevel: number;
    /** @property {number} projectCount - Numero di progetti che hanno contribuito a questa competenza. */
    projectCount: number;
}

/**
 * Livelli di Competenza
 */
export const SKILL_LEVELS = {
    1: 'Novice',
    2: 'Junior',
    3: 'Middle',
    4: 'Senior',
    5: 'Expert'
} as const;

export type SkillLevelValue = keyof typeof SKILL_LEVELS;

/**
 * Interfaccia per i threshold dei livelli di competenza configurabili.
 */
export interface SkillThresholds {
    NOVICE: number;
    JUNIOR: number;
    MIDDLE: number;
    SENIOR: number;
    EXPERT: number;
}

/**
 * Soglie FTE di DEFAULT per il calcolo automatico del livello.
 */
export const DEFAULT_SKILL_LEVEL_THRESHOLDS: SkillThresholds = {
    NOVICE: 0,
    JUNIOR: 60,
    MIDDLE: 150,
    SENIOR: 350,
    EXPERT: 700
};

/**
 * @interface PageVisibility
 * @description Mappa la visibilità delle pagine. Key = percorso (es. /staffing), Value = true se solo admin.
 */
export interface PageVisibility {
    [path: string]: boolean;
}
