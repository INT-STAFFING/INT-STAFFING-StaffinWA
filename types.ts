
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
 * @interface RateCard
 * @description Rappresenta un listino prezzi di vendita.
 */
export interface RateCard {
    /** @property {string} [id] - L'identificatore univoco. */
    id?: string;
    /** @property {string} name - Nome del listino (es. "Listino Standard 2024"). */
    name: string;
    /** @property {string} currency - Valuta (default EUR). */
    currency: string;
}

/**
 * @interface RateCardEntry
 * @description Rappresenta una voce di listino (prezzo di vendita per un ruolo).
 */
export interface RateCardEntry {
    /** @property {string} rateCardId - ID del listino. */
    rateCardId: string;
    /** @property {string} roleId - ID del ruolo. */
    roleId: string;
    /** @property {number} dailyRate - Tariffa giornaliera di vendita. */
    dailyRate: number;
}

/**
 * @interface ProjectExpense
 * @description Rappresenta una spesa extra (non-labor) associata a un progetto.
 */
export interface ProjectExpense {
    /** @property {string} [id] - L'identificatore univoco. */
    id?: string;
    /** @property {string} projectId - ID del progetto associato. */
    projectId: string;
    /** @property {string} category - Categoria spesa (es. "Software", "Viaggi", "Hardware"). */
    category: string;
    /** @property {string} description - Descrizione dettagliata. */
    description: string;
    /** @property {number} amount - Importo della spesa. */
    amount: number;
    /** @property {string} date - Data della spesa (YYYY-MM-DD). */
    date: string;
    /** @property {boolean} billable - Se la spesa è rifatturabile al cliente. */
    billable: boolean;
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
    /** @property {string | null} tutorId - L'ID della risorsa che funge da Tutor. */
    tutorId?: string | null;
    /** @property {string} [notes] - Note aggiuntive sulla risorsa. */
    notes?: string;
}

/**
 * @interface Project
 * @description Rappresenta un progetto aziendale.
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
    /** @property {string | null} wbs - Work Breakdown Structure (opzionale). */
    wbs?: string | null;
    /** @property {number} capienza - Importo totale in € del contratto. */
    capienza: number;
    /** @property {number} backlog - Capienza residua calcolata. */
    backlog: number;
    /** @property {string | null} rateCardId - ID del listino prezzi associato. */
    rateCardId?: string | null;
}

/**
 * @interface ContractProject
 * @description Rappresenta l'associazione tra un contratto e un progetto.
 */
export interface ContractProject {
    /** @property {string} contractId - ID del contratto. */
    contractId: string;
    /** @property {string} projectId - ID del progetto. */
    projectId: string;
}

/**
 * @interface ContractManager
 * @description Rappresenta l'associazione tra un contratto e un manager (risorsa).
 */
export interface ContractManager {
    /** @property {string} contractId - ID del contratto. */
    contractId: string;
    /** @property {string} resourceId - ID della risorsa (manager). */
    resourceId: string;
}

/**
 * @type ExportablePrimitive
 * @description Valori supportati per l'esportazione clipboard-friendly.
 */
export type ExportablePrimitive = string | number | boolean | null | undefined | Date;

/**
 * @type ExportableCell
 * @description Valore di cella esportabile (primitive, array, o oggetto semplice).
 */
export type ExportableCell =
    | ExportablePrimitive
    | ExportablePrimitive[]
    | Record<string, ExportablePrimitive>;

/**
 * @type ExportableData
 * @description Record esportabile con chiavi stringa e valori compatibili.
 */
export type ExportableData = Record<string, ExportableCell>;

/**
 * @type ExportableInput
 * @description Oggetto generico di input da normalizzare per l'esportazione.
 */
export type ExportableInput = object;

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
    /** @property {boolean} [isOsrOpen] - Flag "OSR Aperta". */
    isOsrOpen?: boolean;
    /** @property {string} [osrNumber] - Numero OSR (solo se OSR Aperta è true). */
    osrNumber?: string;
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
 * @interface SkillMacroCategory
 * @description Rappresenta un macro ambito di competenze (es. "Backend", "Frontend").
 */
export interface SkillMacroCategory {
    id: string;
    name: string;
}

/**
 * @interface SkillCategory
 * @description Rappresenta una categoria di competenze (es. "Java", "React") che può appartenere a più macro categorie.
 */
export interface SkillCategory {
    id: string;
    name: string;
    /** @property {string[]} macroCategoryIds - ID delle macro categorie a cui appartiene. */
    macroCategoryIds?: string[];
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
    
    /** @property {string[]} categoryIds - ID delle categorie associate. */
    categoryIds?: string[];
    
    // Campi "Hydrated" per facilità d'uso nel frontend
    /** @property {string} [category] - Stringa concatenata per retrocompatibilità/visualizzazione (es. "Java, Database"). */
    category?: string;
    /** @property {string} [macroCategory] - Stringa concatenata per retrocompatibilità/visualizzazione. */
    macroCategory?: string;
    
    /** @property {boolean} [isCertification] - Se true, questa skill rappresenta una certificazione ufficiale. */
    isCertification?: boolean;
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
 * @interface LeaveType
 * @description Rappresenta una tipologia di assenza (es. Ferie, Malattia).
 */
export interface LeaveType {
    /** @property {string} [id] - L'identificatore univoco. */
    id?: string;
    /** @property {string} name - Nome della tipologia. */
    name: string;
    /** @property {string} color - Colore per la visualizzazione (HEX). */
    color: string;
    /** @property {boolean} requiresApproval - Se richiede approvazione. */
    requiresApproval: boolean;
    /** @property {boolean} affectsCapacity - Se impatta sulla capacità lavorativa. */
    affectsCapacity: boolean;
}

/**
 * @enum LeaveStatus
 * @description Stati possibili di una richiesta di assenza.
 */
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * @interface LeaveRequest
 * @description Rappresenta una richiesta di assenza o ferie.
 */
export interface LeaveRequest {
    /** @property {string} [id] - L'identificatore univoco. */
    id?: string;
    /** @property {string} resourceId - La risorsa che richiede l'assenza. */
    resourceId: string;
    /** @property {string} typeId - L'ID della tipologia di assenza. */
    typeId: string;
    /** @property {string} startDate - Data inizio (YYYY-MM-DD). */
    startDate: string;
    /** @property {string} endDate - Data fine (YYYY-MM-DD). */
    endDate: string;
    /** @property {LeaveStatus} status - Stato dell'approvazione. */
    status: LeaveStatus;
    /** @property {string | null} [managerId] - Chi ha approvato (effettivo attore). */
    managerId?: string | null;
    /** @property {string[]} [approverIds] - Lista degli ID risorse che possono approvare questa richiesta. */
    approverIds?: string[];
    /** @property {string} [notes] - Note aggiuntive. */
    notes?: string;
    /** @property {boolean} [isHalfDay] - Se è una mezza giornata (0.5). */
    isHalfDay?: boolean;
}

/**
 * @interface PageVisibility
 * @description Mappa la visibilità delle pagine. Key = percorso (es. /staffing), Value = true se solo admin.
 */
export interface PageVisibility {
    [path: string]: boolean;
}

/**
 * @enum UserRole
 * @description Ruoli utente per il sistema di autenticazione.
 */
export type UserRole = 'SIMPLE' | 'MANAGER' | 'SENIOR MANAGER' | 'MANAGING DIRECTOR' | 'ADMIN';

/**
 * @interface AppUser
 * @description Rappresenta un utente che può accedere all'applicazione.
 */
export interface AppUser {
    /** @property {string} id - UUID dell'utente. */
    id: string;
    /** @property {string} username - Nome utente per il login. */
    username: string;
    /** @property {UserRole} role - Ruolo dell'utente. */
    role: UserRole;
    /** @property {string | null} resourceId - ID della risorsa associata (opzionale). */
    resourceId: string | null;
    /** @property {boolean} isActive - Se l'utente è attivo (whitelist). */
    isActive: boolean;
    /** @property {string[]} permissions - Lista dei percorsi abilitati. */
    permissions: string[];
    /** @property {boolean} mustChangePassword - Se l'utente deve cambiare password al prossimo login. */
    mustChangePassword?: boolean;
}

/**
 * @interface RolePermission
 * @description Definisce i permessi di accesso alle pagine per ruolo.
 */
export interface RolePermission {
    /** @property {UserRole} role - Il ruolo a cui si applica il permesso. */
    role: UserRole;
    /** @property {string} pagePath - Il percorso della pagina (es. '/staffing'). */
    pagePath: string;
    /** @property {boolean} allowed - Se l'accesso è consentito. */
    allowed: boolean;
}

/**
 * @interface SidebarItem
 * @description Configurazione per un elemento della sidebar.
 */
export interface SidebarItem {
    path: string;
    label: string;
    icon: string;
    section: string; // 'Principale', 'Progetti', 'Risorse', 'Operatività', 'Supporto', 'Configurazione', 'Dati'
    color?: string; // 'primary', 'secondary', 'tertiary', 'error' etc.
    /**
     * @property {string} requiredPermission - Permesso opzionale per visualizzare l'elemento.
     * Se valorizzato, l'elemento viene renderizzato solo se l'utente dispone del permesso.
     */
    requiredPermission?: string;
}

/**
 * @interface SidebarFooterAction
 * @description Azione configurabile nel footer della sidebar.
 */
export interface SidebarFooterAction {
    id: 'changePassword' | 'logout';
    label: string;
    icon: string;
    color?: string;
    requiredPermission?: string;
}

/**
 * @interface SidebarSectionColors
 * @description Mappa dei colori personalizzati per le sezioni della sidebar.
 */
export interface SidebarSectionColors {
    [sectionName: string]: string;
}

/**
 * @interface Notification
 * @description Rappresenta una notifica di sistema.
 */
export interface Notification {
    id: string;
    recipientResourceId: string;
    title: string;
    message: string;
    link?: string;
    isRead: boolean;
    createdAt: string;
}

/**
 * @interface AuditLogEntry
 * @description Rappresenta un evento di log del sistema.
 */
export interface AuditLogEntry {
    id: string;
    userId: string | null;
    username: string | null;
    action: string;
    entity: string | null;
    entityId: string | null;
    details: any;
    ipAddress: string | null;
    createdAt: string;
}

/**
 * @interface DashboardCategory
 * @description Rappresenta una categoria (tab) nella pagina Dashboard.
 */
export interface DashboardCategory {
    id: string;
    label: string;
    cards: string[]; // ID delle card associate a questa categoria
}

/**
 * @interface EntitiesState
 * @description Stato condiviso fornito da AppProvider per dati anagrafici e configurazioni.
 */
export interface EntitiesState {
    clients: Client[];
    roles: Role[];
    roleCostHistory: RoleCostHistory[];
    rateCards: RateCard[];
    rateCardEntries: RateCardEntry[];
    projectExpenses: ProjectExpense[];
    resources: Resource[];
    projects: Project[];
    contracts: Contract[];
    contractProjects: ContractProject[];
    contractManagers: ContractManager[];
    assignments: Assignment[];
    horizontals: ConfigOption[];
    seniorityLevels: ConfigOption[];
    projectStatuses: ConfigOption[];
    clientSectors: ConfigOption[];
    locations: ConfigOption[];
    companyCalendar: CalendarEvent[];
    wbsTasks: WbsTask[];
    resourceRequests: ResourceRequest[];
    interviews: Interview[];
    skills: Skill[];
    skillCategories: SkillCategory[];
    skillMacroCategories: SkillMacroCategory[];
    resourceSkills: ResourceSkill[];
    projectSkills: ProjectSkill[];
    pageVisibility: PageVisibility;
    skillThresholds: SkillThresholds;
    planningSettings: { monthsBefore: number; monthsAfter: number };
    leaveTypes: LeaveType[];
    leaveRequests: LeaveRequest[];
    managerResourceIds: string[];
    sidebarConfig: SidebarItem[];
    sidebarSections: string[];
    sidebarSectionColors: SidebarSectionColors;
    sidebarFooterActions: SidebarFooterAction[];
    dashboardLayout: DashboardCategory[];
    roleHomePages: Record<string, string>;
    bottomNavPaths: string[]; // Nuova proprietà per la navigazione mobile dinamica
    notifications: Notification[];
    analyticsCache: Record<string, unknown>;
    loading: boolean;
}

/**
 * @interface EntitiesActions
 * @description Azioni disponibili sul provider e i relativi effetti sui dati locali e remoti.
 */
export interface EntitiesActions {
    /** Ricarica tutti i dati base e di pianificazione, aggiornando lo stato locale. */
    fetchData: () => Promise<void>;
    /** Recupera le notifiche server-side e aggiorna lo stato locale. */
    fetchNotifications: () => Promise<void>;
    /** Segna come lette una o più notifiche e riflette subito la modifica nello stato. */
    markNotificationAsRead: (id?: string) => Promise<void>;
    /** Crea una nuova risorsa e la aggiunge alla cache locale. */
    addResource: (resource: Omit<Resource, 'id'>) => Promise<Resource>;
    /** Aggiorna una risorsa esistente e sincronizza lo stato locale. */
    updateResource: (resource: Resource) => Promise<void>;
    /** Elimina una risorsa e la rimuove dalla cache locale. */
    deleteResource: (id: string) => Promise<void>;
    /** Crea un nuovo progetto e lo aggiunge al provider. */
    addProject: (project: Omit<Project, 'id'>) => Promise<Project | null>;
    /** Aggiorna un progetto e la relativa lista locale. */
    updateProject: (project: Project) => Promise<void>;
    /** Rimuove un progetto e aggiorna la cache. */
    deleteProject: (id: string) => Promise<void>;
    /** Crea un nuovo cliente e lo salva nello stato. */
    addClient: (client: Omit<Client, 'id'>) => Promise<void>;
    /** Modifica un cliente e sincronizza la lista. */
    updateClient: (client: Client) => Promise<void>;
    /** Cancella un cliente e rimuove l'elemento locale. */
    deleteClient: (id: string) => Promise<void>;
    /** Aggiunge un ruolo e lo espone subito ai consumatori. */
    addRole: (role: Omit<Role, 'id'>) => Promise<void>;
    /** Aggiorna un ruolo e ricarica la storia dei costi. */
    updateRole: (role: Role) => Promise<void>;
    /** Elimina un ruolo e aggiorna lo stato. */
    deleteRole: (id: string) => Promise<void>;
    /** CRUD per RateCards. */
    addRateCard: (rateCard: Omit<RateCard, 'id'>) => Promise<void>;
    updateRateCard: (rateCard: RateCard) => Promise<void>;
    deleteRateCard: (id: string) => Promise<void>;
    /** Aggiorna le entry di una rate card (UPSERT massivo). */
    upsertRateCardEntries: (entries: RateCardEntry[]) => Promise<void>;
    /** CRUD per ProjectExpenses. */
    addProjectExpense: (expense: Omit<ProjectExpense, 'id'>) => Promise<void>;
    updateProjectExpense: (expense: ProjectExpense) => Promise<void>;
    deleteProjectExpense: (id: string) => Promise<void>;
    /** Gestisce la creazione di una nuova opzione di configurazione tipizzata. */
    addConfigOption: (type: string, value: string) => Promise<void>;
    /** Modifica un'opzione di configurazione esistente. */
    updateConfigOption: (type: string, option: ConfigOption) => Promise<void>;
    /** Cancella un'opzione di configurazione e aggiorna lo stato coerente. */
    deleteConfigOption: (type: string, id: string) => Promise<void>;
    /** Crea un evento di calendario aziendale. */
    addCalendarEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<void>;
    /** Aggiorna un evento esistente. */
    updateCalendarEvent: (event: CalendarEvent) => Promise<void>;
    /** Rimuove un evento dal calendario. */
    deleteCalendarEvent: (id: string) => Promise<void>;
    /** Inserisce assegnazioni multiple e ricarica lo stato correlato. */
    addMultipleAssignments: (newAssignments: { resourceId: string; projectId: string }[]) => Promise<void>;
    /** Elimina un'assegnazione e le relative allocazioni. */
    deleteAssignment: (id: string) => Promise<void>;
    /** Calcola il costo corrente di un ruolo in base alla data. */
    getRoleCost: (roleId: string, date: Date) => number;
    /** Calcola la tariffa di vendita giornaliera per un ruolo in un contratto. */
    getSellRate: (rateCardId: string | null | undefined, roleId: string) => number;
    /** CRUD per richieste risorse. */
    addResourceRequest: (req: Omit<ResourceRequest, 'id'>) => Promise<void>;
    updateResourceRequest: (req: ResourceRequest) => Promise<void>;
    deleteResourceRequest: (id: string) => Promise<void>;
    /** CRUD per colloqui. */
    addInterview: (interview: Omit<Interview, 'id'>) => Promise<void>;
    updateInterview: (interview: Interview) => Promise<void>;
    deleteInterview: (id: string) => Promise<void>;
    /** Gestione completa dei contratti con sincronizzazione stato. */
    addContract: (contract: Omit<Contract, 'id'>, projectIds: string[], managerIds: string[]) => Promise<void>;
    updateContract: (contract: Contract, projectIds: string[], managerIds: string[]) => Promise<void>;
    deleteContract: (id: string) => Promise<void>;
    recalculateContractBacklog: (id: string) => Promise<void>;
    /** CRUD per competenze e categorie. */
    addSkill: (skill: Omit<Skill, 'id'>) => Promise<void>;
    updateSkill: (skill: Skill) => Promise<void>;
    deleteSkill: (id: string) => Promise<void>;
    addResourceSkill: (rs: ResourceSkill) => Promise<void>;
    deleteResourceSkill: (resourceId: string, skillId: string) => Promise<void>;
    addProjectSkill: (ps: ProjectSkill) => Promise<void>;
    deleteProjectSkill: (projectId: string, skillId: string) => Promise<void>;
    updateSkillThresholds: (thresholds: SkillThresholds) => Promise<void>;
    updatePlanningSettings: (settings: { monthsBefore: number; monthsAfter: number }) => Promise<void>;
    getResourceComputedSkills: (resourceId: string) => any[];
    /** CRUD per categorie e macro categorie di skill. */
    addSkillCategory: (cat: Omit<SkillCategory, 'id'>) => Promise<void>;
    updateSkillCategory: (cat: SkillCategory) => Promise<void>;
    deleteSkillCategory: (id: string) => Promise<void>;
    addSkillMacro: (macro: { name: string }) => Promise<void>;
    updateSkillMacro: (id: string, name: string) => Promise<void>;
    deleteSkillMacro: (id: string) => Promise<void>;
    /** CRUD per tipologie e richieste di ferie. */
    addLeaveType: (type: Omit<LeaveType, 'id'>) => Promise<void>;
    updateLeaveType: (type: LeaveType) => Promise<void>;
    deleteLeaveType: (id: string) => Promise<void>;
    addLeaveRequest: (req: Omit<LeaveRequest, 'id'>) => Promise<void>;
    updateLeaveRequest: (req: LeaveRequest) => Promise<void>;
    deleteLeaveRequest: (id: string) => Promise<void>;
    /** Aggiorna configurazioni UI e layout del provider. */
    updatePageVisibility: (visibility: PageVisibility) => Promise<void>;
    updateSidebarConfig: (config: SidebarItem[]) => Promise<void>;
    updateSidebarSections: (sections: string[]) => Promise<void>;
    updateSidebarSectionColors: (colors: SidebarSectionColors) => Promise<void>;
    updateSidebarFooterActions: (actions: SidebarFooterAction[]) => Promise<void>;
    updateDashboardLayout: (layout: DashboardCategory[]) => Promise<void>;
    updateRoleHomePages: (config: Record<string, string>) => Promise<void>;
    updateBottomNavPaths: (paths: string[]) => Promise<void>; // Nuova azione
    /** Innesca il ricalcolo dei dati analitici sul backend e aggiorna la cache locale. */
    forceRecalculateAnalytics: () => Promise<void>;
    
    /** 
     * Esegue l'algoritmo di best fit per trovare risorse adatte a una richiesta.
     * @returns Array di candidati ordinati per punteggio.
     */
    getBestFitResources: (params: { startDate: string; endDate: string; roleId: string; projectId: string }) => Promise<any[]>;
}

/**
 * @interface EntitiesContextType
 * @description Contratto completo esposto dal provider dell'applicazione.
 */
export interface EntitiesContextType extends EntitiesState, EntitiesActions {
    isActionLoading: (action: string) => boolean;
}

/**
 * @interface AllocationsContextType
 * @description Espone lo stato e le azioni legate alle allocazioni giornaliere.
 */
export interface AllocationsContextType {
    allocations: Allocation;
    updateAllocation: (assignmentId: string, date: string, percentage: number) => Promise<void>;
    bulkUpdateAllocations: (assignmentId: string, startDate: string, endDate: string, percentage: number) => Promise<void>;
}