
/**
 * @file types.ts
 * @description Definizioni dei tipi e delle interfacce TypeScript utilizzate in tutta l'applicazione.
 */

export interface ConfigOption {
    id?: string;
    value: string;
}

export interface Client {
    id?: string;
    name: string;
    sector: string;
    contactEmail: string;
    version?: number;
}

export interface Role {
    id?: string;
    name: string;
    seniorityLevel: string;
    dailyCost: number;
    standardCost?: number;
    overheadPct?: number;
    dailyExpenses?: number;
    chargeablePct?: number;
    trainingPct?: number;
    bdPct?: number;
    version?: number;
}

export interface RoleCostHistory {
    id: string;
    roleId: string;
    dailyCost: number;
    startDate: string;
    endDate: string | null;
}

export interface RateCard {
    id?: string;
    name: string;
    currency: string;
    version?: number;
}

export interface RateCardEntry {
    id?: string; // Optional ID for frontend keys (composite key in DB)
    rateCardId: string;
    resourceId: string;
    dailyRate: number;
}

export interface ProjectExpense {
    id?: string;
    projectId: string;
    category: string;
    description: string;
    amount: number;
    date: string;
    billable: boolean;
    version?: number;
}

export type BillingType = 'TIME_MATERIAL' | 'FIXED_PRICE';
export type MilestoneStatus = 'PLANNED' | 'INVOICED' | 'PAID';

export interface BillingMilestone {
    id?: string;
    projectId: string;
    name: string;
    date: string;
    amount: number;
    status: MilestoneStatus;
    version?: number;
}

export interface Resource {
    id: string;
    name: string;
    email: string;
    roleId: string;
    function: string; 
    industry: string; 
    location: string;
    hireDate: string;
    workSeniority: number;
    notes?: string;
    maxStaffingPercentage: number;
    resigned: boolean;
    lastDayOfWork: string | null;
    tutorId?: string | null;
    dailyCost?: number;
    isTalent?: boolean;
    seniorityCode?: string;
    version?: number;
}

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
    contractId?: string | null;
    billingType?: BillingType;
    version?: number;
}

export interface Contract {
    id?: string;
    name: string;
    startDate: string | null;
    endDate: string | null;
    cig: string;
    cigDerivato: string | null;
    wbs?: string | null;
    capienza: number;
    backlog: number;
    rateCardId?: string | null;
    billingType?: BillingType;
    version?: number;
}

export interface ContractProject {
    contractId: string;
    projectId: string;
}

export interface ContractManager {
    contractId: string;
    resourceId: string;
}

export interface Assignment {
    id?: string;
    resourceId: string;
    projectId: string;
}

export interface Allocation {
    [assignmentId: string]: {
        [date: string]: number;
    };
}

export type CalendarEventType = 'NATIONAL_HOLIDAY' | 'COMPANY_CLOSURE' | 'LOCAL_HOLIDAY';

export interface CalendarEvent {
    id?: string;
    name: string;
    date: string;
    type: CalendarEventType;
    location: string | null;
    version?: number;
}

export interface WbsTask {
    id?: string;
    elementoWbs: string;
    descrizioneWbe: string;
    clientId: string | null;
    periodo: string;
    ore: number;
    produzioneLorda: number;
    oreNetworkItalia: number;
    produzioneLordaNetworkItalia: number;
    perdite: number;
    realisation: number;
    speseOnorariEsterni: number;
    speseAltro: number;
    fattureOnorari: number;
    fattureSpese: number;
    iva: number;
    incassi: number;
    primoResponsabileId: string | null;
    secondoResponsabileId: string | null;
}

export type ResourceRequestStatus = 'ATTIVA' | 'STANDBY' | 'CHIUSA';

export interface ResourceRequest {
    id?: string;
    requestCode?: string;
    projectId: string;
    roleId: string;
    requestorId: string | null;
    startDate: string;
    endDate: string;
    commitmentPercentage: number;
    isUrgent: boolean;
    isLongTerm: boolean;
    isTechRequest: boolean;
    isOsrOpen?: boolean;
    osrNumber?: string;
    notes?: string;
    status: ResourceRequestStatus;
    version?: number;
}

export type InterviewFeedback = 'Positivo' | 'Positivo On Hold' | 'Negativo';
export type InterviewHiringStatus = 'SI' | 'NO' | 'No Rifiutato' | 'In Fase di Offerta';
export type InterviewStatus = 'Aperto' | 'Chiuso' | 'StandBy' | 'Non Contattabile';

export interface Interview {
    id?: string;
    resourceRequestId: string | null;
    candidateName: string;
    candidateSurname: string;
    birthDate: string | null;
    function: string | null; // Renamed from horizontal
    roleId: string | null;
    cvSummary: string | null;
    interviewersIds: string[] | null;
    interviewDate: string | null;
    feedback: InterviewFeedback | null;
    notes: string | null;
    hiringStatus: InterviewHiringStatus | null;
    entryDate: string | null;
    status: InterviewStatus;
    version?: number;
    
    // Hard Skills Ratings (1-5)
    ratingTechnicalMastery?: number | null;
    ratingProblemSolving?: number | null;
    ratingMethodQuality?: number | null;
    
    // Soft Skills Ratings (1-5)
    ratingDomainKnowledge?: number | null;
    ratingAutonomy?: number | null;
    ratingCommunication?: number | null;
    ratingProactivity?: number | null;
    ratingTeamFit?: number | null;
}

export interface SkillMacroCategory {
    id: string;
    name: string;
}

export interface SkillCategory {
    id: string;
    name: string;
    macroCategoryIds?: string[];
}

export interface Skill {
    id?: string;
    name: string;
    categoryIds?: string[];
    category?: string;
    macroCategory?: string;
    isCertification?: boolean;
    version?: number;
}

export interface ResourceSkill {
    resourceId: string;
    skillId: string;
    level?: number;
    acquisitionDate?: string | null;
    expirationDate?: string | null;
}

export interface ProjectSkill {
    projectId: string;
    skillId: string;
}

export interface ComputedSkill {
    skill: Skill;
    manualDetails?: ResourceSkill;
    inferredDays: number;
    inferredLevel: number;
    projectCount: number;
}

export const SKILL_LEVELS = {
    1: 'Novice',
    2: 'Junior',
    3: 'Middle',
    4: 'Senior',
    5: 'Expert'
} as const;

export type SkillLevelValue = keyof typeof SKILL_LEVELS;

export interface SkillThresholds {
    NOVICE: number;
    JUNIOR: number;
    MIDDLE: number;
    SENIOR: number;
    EXPERT: number;
}

export const DEFAULT_SKILL_LEVEL_THRESHOLDS: SkillThresholds = {
    NOVICE: 0,
    JUNIOR: 60,
    MIDDLE: 150,
    SENIOR: 350,
    EXPERT: 700
};

export interface LeaveType {
    id?: string;
    name: string;
    color: string;
    requiresApproval: boolean;
    affectsCapacity: boolean;
    version?: number;
}

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface LeaveRequest {
    id?: string;
    resourceId: string;
    typeId: string;
    startDate: string;
    endDate: string;
    status: LeaveStatus;
    managerId?: string | null;
    approverIds?: string[];
    notes?: string;
    isHalfDay?: boolean;
    version?: number;
}

export interface PageVisibility {
    [path: string]: boolean;
}

export type UserRole = 'SIMPLE' | 'MANAGER' | 'SENIOR MANAGER' | 'MANAGING DIRECTOR' | 'ADMIN';

export interface AppUser {
    id: string;
    username: string;
    role: UserRole;
    resourceId: string | null;
    isActive: boolean;
    permissions: string[];
    mustChangePassword?: boolean;
    version?: number;
}

export interface RolePermission {
    role: UserRole;
    pagePath: string;
    isAllowed: boolean;
}

export interface SidebarItem {
    path: string;
    label: string;
    icon: string;
    section: string;
    color?: string;
    requiredPermission?: string;
}

export interface QuickAction {
    label: string;
    icon: string;
    link: string;
    color?: string;
}

export interface SidebarFooterAction {
    id: 'changePassword' | 'logout';
    label: string;
    icon: string;
    color?: string;
    requiredPermission?: string;
}

export interface SidebarSectionColors {
    [sectionName: string]: string;
}

export interface Notification {
    id: string;
    recipientResourceId: string;
    title: string;
    message: string;
    link?: string;
    isRead: boolean;
    createdAt: string;
}

export interface NotificationConfig {
    id?: string;
    eventType: string;
    webhookUrl: string;
    description?: string;
    isActive: boolean;
    createdAt?: string;
    version?: number;
}

// --- Notification Rule Builder ---

export type NotificationBlockType = 'header' | 'facts' | 'detailed_facts' | 'image' | 'table' | 'divider' | 'text';

export interface NotificationBlock {
    id: string;
    type: NotificationBlockType;
    config: {
        /** 'header' block */
        titleTemplate?: string;
        subtitleTemplate?: string;
        /** 'text' block */
        textTemplate?: string;
        /** 'facts' | 'detailed_facts' block */
        facts?: { nameTemplate: string; valueTemplate: string }[];
        /** 'image' block — supports {{context.xxx}} placeholders */
        imageUrlTemplate?: string;
        imageCaption?: string;
        /** 'table' block title */
        tableTitle?: string;
        headers?: string[];
    };
}

export interface NotificationRule {
    id?: string;
    name: string;
    eventType: string;
    webhookUrl: string;
    description?: string;
    isActive: boolean;
    /** JSON array of NotificationBlock, stored as JSONB in DB */
    templateBlocks: NotificationBlock[];
    color?: string;
    createdAt?: string;
    version?: number;
}

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

export interface DashboardCategory {
    id: string;
    label: string;
    cards: string[];
}

export type EvaluationStatus = 'DRAFT' | 'COMPLETED' | 'ARCHIVED';

export interface EvaluationMetric {
    id?: string;
    evaluationId?: string;
    category: string;
    metricKey: string;
    metricValue: string;
    score?: number;
}

export interface ResourceEvaluation {
    id?: string;
    resourceId: string;
    fiscalYear: number;
    evaluatorId: string | null;
    status: EvaluationStatus;
    overallRating?: number;
    summary?: string;
    updatedAt?: string;
    version?: number;
    metrics?: EvaluationMetric[];
}

export type ExportablePrimitive = string | number | boolean | Date;
export type ExportableCell = ExportablePrimitive | ExportablePrimitive[];
export type ExportableInput = Record<string, unknown>;
export type ExportableData = Record<string, ExportableCell>;

export interface EntitiesState {
    clients: Client[];
    roles: Role[];
    roleCostHistory: RoleCostHistory[];
    rateCards: RateCard[];
    rateCardEntries: RateCardEntry[];
    projectExpenses: ProjectExpense[];
    billingMilestones: BillingMilestone[];
    resources: Resource[];
    projects: Project[];
    contracts: Contract[];
    contractProjects: ContractProject[];
    contractManagers: ContractManager[];
    assignments: Assignment[];
    functions: ConfigOption[]; 
    industries: ConfigOption[]; 
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
    quickActions: QuickAction[];
    sidebarSections: string[];
    sidebarSectionColors: SidebarSectionColors;
    sidebarFooterActions: SidebarFooterAction[];
    dashboardLayout: DashboardCategory[];
    roleHomePages: Record<string, string>;
    bottomNavPaths: string[];
    notifications: Notification[];
    notificationConfigs: NotificationConfig[];
    notificationRules: NotificationRule[];
    analyticsCache: Record<string, unknown>;
    loading: boolean;
    evaluations: ResourceEvaluation[];
}

export interface EntitiesActions {
    fetchData: () => Promise<void>;
    fetchNotifications: () => Promise<void>;
    markNotificationAsRead: (id?: string) => Promise<void>;
    addResource: (resource: Omit<Resource, 'id'>) => Promise<Resource>;
    updateResource: (resource: Resource) => Promise<void>;
    deleteResource: (id: string) => Promise<void>;
    addProject: (project: Omit<Project, 'id'>) => Promise<Project | null>;
    updateProject: (project: Project) => Promise<void>;
    deleteProject: (id: string) => Promise<void>;
    addClient: (client: Omit<Client, 'id'>) => Promise<void>;
    updateClient: (client: Client) => Promise<void>;
    deleteClient: (id: string) => Promise<void>;
    addRole: (role: Omit<Role, 'id'>) => Promise<void>;
    updateRole: (role: Role) => Promise<void>;
    deleteRole: (id: string) => Promise<void>;
    addRateCard: (rateCard: Omit<RateCard, 'id'>) => Promise<void>;
    updateRateCard: (rateCard: RateCard) => Promise<void>;
    deleteRateCard: (id: string) => Promise<void>;
    upsertRateCardEntries: (entries: RateCardEntry[]) => Promise<void>;
    addProjectExpense: (expense: Omit<ProjectExpense, 'id'>) => Promise<void>;
    updateProjectExpense: (expense: ProjectExpense) => Promise<void>;
    deleteProjectExpense: (id: string) => Promise<void>;
    addBillingMilestone: (milestone: Omit<BillingMilestone, 'id'>) => Promise<void>;
    updateBillingMilestone: (milestone: BillingMilestone) => Promise<void>;
    deleteBillingMilestone: (id: string) => Promise<void>;
    addConfigOption: (type: string, value: string) => Promise<void>;
    updateConfigOption: (type: string, option: ConfigOption) => Promise<void>;
    deleteConfigOption: (type: string, id: string) => Promise<void>;
    addCalendarEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<void>;
    updateCalendarEvent: (event: CalendarEvent) => Promise<void>;
    deleteCalendarEvent: (id: string) => Promise<void>;
    addMultipleAssignments: (newAssignments: { resourceId: string; projectId: string }[]) => Promise<void>;
    deleteAssignment: (id: string) => Promise<void>;
    getRoleCost: (roleId: string, date: Date, resourceId?: string) => number;
    getSellRate: (rateCardId: string | null | undefined, resourceId: string) => number;
    addResourceRequest: (req: Omit<ResourceRequest, 'id'>) => Promise<void>;
    updateResourceRequest: (req: ResourceRequest) => Promise<void>;
    deleteResourceRequest: (id: string) => Promise<void>;
    addInterview: (interview: Omit<Interview, 'id'>) => Promise<void>;
    updateInterview: (interview: Interview) => Promise<void>;
    deleteInterview: (id: string) => Promise<void>;
    addContract: (contract: Omit<Contract, 'id'>, projectIds: string[], managerIds: string[]) => Promise<void>;
    updateContract: (contract: Contract, projectIds: string[], managerIds: string[]) => Promise<void>;
    deleteContract: (id: string) => Promise<void>;
    recalculateContractBacklog: (id: string) => Promise<void>;
    addSkill: (skill: Omit<Skill, 'id'>) => Promise<void>;
    updateSkill: (skill: Skill) => Promise<void>;
    deleteSkill: (id: string) => Promise<void>;
    addResourceSkill: (rs: ResourceSkill) => Promise<void>;
    deleteResourceSkill: (resourceId: string, skillId: string) => Promise<void>;
    addProjectSkill: (ps: ProjectSkill) => Promise<void>;
    deleteProjectSkill: (projectId: string, skillId: string) => Promise<void>;
    updateSkillThresholds: (thresholds: SkillThresholds) => Promise<void>;
    updatePlanningSettings: (settings: { monthsBefore: number; monthsAfter: number }) => Promise<void>;
    getResourceComputedSkills: (resourceId: string) => ComputedSkill[];
    addSkillCategory: (cat: Omit<SkillCategory, 'id'>) => Promise<void>;
    updateSkillCategory: (cat: SkillCategory) => Promise<void>;
    deleteSkillCategory: (id: string) => Promise<void>;
    addSkillMacro: (macro: { name: string }) => Promise<void>;
    updateSkillMacro: (id: string, name: string) => Promise<void>;
    deleteSkillMacro: (id: string) => Promise<void>;
    addLeaveType: (type: Omit<LeaveType, 'id'>) => Promise<void>;
    updateLeaveType: (type: LeaveType) => Promise<void>;
    deleteLeaveType: (id: string) => Promise<void>;
    addLeaveRequest: (req: Omit<LeaveRequest, 'id'>) => Promise<void>;
    updateLeaveRequest: (req: LeaveRequest) => Promise<void>;
    deleteLeaveRequest: (id: string) => Promise<void>;
    updatePageVisibility: (visibility: PageVisibility) => Promise<void>;
    updateSidebarConfig: (config: SidebarItem[]) => Promise<void>;
    updateQuickActions: (actions: QuickAction[]) => Promise<void>;
    updateSidebarSections: (sections: string[]) => Promise<void>;
    updateSidebarSectionColors: (colors: SidebarSectionColors) => Promise<void>;
    updateSidebarFooterActions: (actions: SidebarFooterAction[]) => Promise<void>;
    updateDashboardLayout: (layout: DashboardCategory[]) => Promise<void>;
    updateRoleHomePages: (config: Record<string, string>) => Promise<void>;
    updateBottomNavPaths: (paths: string[]) => Promise<void>;
    addNotificationConfig: (config: Omit<NotificationConfig, 'id'>) => Promise<void>;
    updateNotificationConfig: (config: NotificationConfig) => Promise<void>;
    deleteNotificationConfig: (id: string) => Promise<void>;
    addNotificationRule: (rule: Omit<NotificationRule, 'id'>) => Promise<void>;
    updateNotificationRule: (rule: NotificationRule) => Promise<void>;
    deleteNotificationRule: (id: string) => Promise<void>;
    forceRecalculateAnalytics: () => Promise<void>;
    getBestFitResources: (params: { startDate: string; endDate: string; roleId: string; projectId: string; commitmentPercentage: number }) => Promise<any[]>;
    fetchEvaluations: (resourceId?: string) => Promise<void>;
    addEvaluation: (evaluation: Omit<ResourceEvaluation, 'id'>) => Promise<void>;
    updateEvaluation: (evaluation: ResourceEvaluation) => Promise<void>;
    deleteEvaluation: (id: string) => Promise<void>;
}

export interface EntitiesContextType extends EntitiesState, EntitiesActions {
    isActionLoading: (action: string) => boolean;
}

export interface AllocationsContextType {
    allocations: Allocation;
    updateAllocation: (assignmentId: string, date: string, percentage: number) => Promise<void>;
    bulkUpdateAllocations: (assignmentId: string, startDate: string, endDate: string, percentage: number) => Promise<void>;
}

export interface SimulationResource extends Resource {
    isGhost: boolean;
    dailyExpenses: number;
}

export interface SimulationFinancials {
    [resourceId: string]: {
        dailyCost: number;
        dailyExpenses: number;
        sellRate: number;
    };
}

export interface SimulationProject extends Project {
    simulatedRateCardId?: string;
}

export interface SimulationScenario {
    id: string;
    name: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
    data: {
        resources: SimulationResource[];
        projects: SimulationProject[];
        assignments: Assignment[];
        allocations: Allocation;
        financials: SimulationFinancials;
        projectExpenses?: ProjectExpense[];
        billingMilestones?: BillingMilestone[];
    };
}
