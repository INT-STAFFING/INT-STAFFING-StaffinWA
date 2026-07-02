
import { v4 as uuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
// Date dinamiche per la demo: i dati di esempio devono "vivere" intorno a oggi,
// altrimenti Staffing/Workload/Dashboard/Forecast appaiono vuoti col passare
// del tempo (le vecchie date hardcoded al 2024 rendevano la demo inutilizzabile).
// ---------------------------------------------------------------------------
const TODAY = new Date();
const CURRENT_YEAR = TODAY.getFullYear();
const isoDate = (d: Date): string => d.toISOString().split('T')[0];
const daysFromToday = (n: number): Date => {
    const d = new Date(TODAY);
    d.setDate(d.getDate() + n);
    return d;
};
/** Genera allocazioni sui giorni feriali nell'intervallo [from, to] (offset in giorni da oggi). */
const buildDemoAllocations = (from: number, to: number, percentage: number): Record<string, number> => {
    const out: Record<string, number> = {};
    for (let i = from; i <= to; i++) {
        const d = daysFromToday(i);
        const dow = d.getUTCDay();
        if (dow === 0 || dow === 6) continue;
        out[isoDate(d)] = percentage;
    }
    return out;
};
import { AppUser, Assignment, Allocation, CalendarEvent, Client, ConfigOption, Contract, ContractProject, ContractManager, Interview, LeaveRequest, LeaveType, Notification, Project, ProjectExpense, RateCard, Resource, ResourceRequest, Role, RoleCostHistory, Skill, SkillCategory, SkillMacroCategory, BillingMilestone, ResourceSkill, ProjectSkill, RoleEntityVisibility } from '../types';
import { KBArticle } from '../types/knowledgeBase';

export const INITIAL_MOCK_DATA: {
    functions: ConfigOption[];
    industries: ConfigOption[];
    seniorityLevels: ConfigOption[];
    projectStatuses: ConfigOption[];
    clientSectors: ConfigOption[];
    locations: ConfigOption[];
    clients: Client[];
    roles: Role[];
    resources: Resource[];
    projects: Project[];
    users: Partial<AppUser>[];
    assignments: Assignment[];
    allocations: Allocation;
    companyCalendar: CalendarEvent[];
    leaveTypes: LeaveType[];
    leaveRequests: LeaveRequest[];
    notifications: Notification[];
    resourceRequests: ResourceRequest[];
    interviews: Interview[];
    contracts: Contract[];
    contractProjects: ContractProject[];
    contractManagers: ContractManager[];
    roleCostHistory: RoleCostHistory[];
    skillCategories: SkillCategory[];
    skillMacroCategories: SkillMacroCategory[];
    skills: Skill[];
    resourceSkills: ResourceSkill[];
    projectSkills: ProjectSkill[];
    rateCards: RateCard[];
    rateCardEntries: any[]; // Using any to avoid strict checking on join table entries in mock
    projectExpenses: ProjectExpense[];
    billingMilestones: BillingMilestone[];
    // Config & Misc
    authConfig: { isEnabled: boolean };
    pageVisibility: Record<string, boolean>;
    skillThresholds: any;
    planningSettings: any;
    managerResourceIds: string[];
    sidebarConfig: any[];
    sidebarSections: string[];
    sidebarSectionColors: any;
    sidebarFooterActions: any[];
    dashboardLayout: any[];
    roleHomePages: any;
    analyticsCache: any;
    notificationConfigs: any[];
    notificationRules: any[];
    resourceEvaluations?: any[];
    roleEntityVisibility: RoleEntityVisibility[];
    knowledgeBaseArticles: KBArticle[];
} = {
  functions: [
    { id: 'h1', value: 'Software Engineering' }, 
    { id: 'h2', value: 'Data & AI' },
    { id: 'h3', value: 'Business Transformation' },
    { id: 'h4', value: 'Cloud Architecture' }
  ],
  industries: [
    { id: 'i1', value: 'Banking & Finance' },
    { id: 'i2', value: 'Energy & Utilities' },
    { id: 'i3', value: 'Public Sector' },
    { id: 'i4', value: 'Retail & Consumer' }
  ],
  seniorityLevels: [
    { id: 's1', value: 'Junior' }, 
    { id: 's2', value: 'Middle' },
    { id: 's3', value: 'Senior' },
    { id: 's4', value: 'Manager' }
  ],
  projectStatuses: [
    { id: 'ps1', value: 'In corso' }, 
    { id: 'ps2', value: 'Completato' },
    { id: 'ps3', value: 'In pausa' },
    { id: 'ps4', value: 'Pianificato' }
  ],
  clientSectors: [
    { id: 'cs1', value: 'Banking' },
    { id: 'cs2', value: 'Energy' },
    { id: 'cs3', value: 'Retail' },
    { id: 'cs4', value: 'Public Sector' }
  ],
  locations: [
    { id: 'l1', value: 'Milano' }, 
    { id: 'l2', value: 'Roma' },
    { id: 'l3', value: 'Torino' }
  ],
  clients: [
    { id: 'c1', name: 'Banca Intesa', sector: 'Banking', contactEmail: 'it@intesa.it' },
    { id: 'c2', name: 'EcoEnergy SPA', sector: 'Energy', contactEmail: 'staffing@ecoenergy.it' }
  ],
  roles: [
    { id: 'r1', name: 'Senior Developer', seniorityLevel: 'Senior', dailyCost: 600, standardCost: 550, dailyExpenses: 21, overheadPct: 15, chargeablePct: 90, trainingPct: 5, bdPct: 5 },
    { id: 'r2', name: 'Project Manager', seniorityLevel: 'Manager', dailyCost: 800, standardCost: 750, dailyExpenses: 28, overheadPct: 20, chargeablePct: 80, trainingPct: 5, bdPct: 15 }
  ],
  resources: [
    { 
      id: 'res1', name: 'Mario Rossi', email: 'm.rossi@partner.it', roleId: 'r1', 
      function: 'Software Engineering', industry: 'Banking & Finance', location: 'Milano', 
      hireDate: '2022-01-10', workSeniority: 8, maxStaffingPercentage: 100, resigned: false, lastDayOfWork: null,
      dailyCost: 600, isTalent: true, seniorityCode: 'L4'
    },
    { 
      id: 'res2', name: 'Elena Bianchi', email: 'e.bianchi@partner.it', roleId: 'r2', 
      function: 'Business Transformation', industry: 'Energy & Utilities', location: 'Roma', 
      hireDate: '2021-05-15', workSeniority: 12, maxStaffingPercentage: 100, resigned: false, lastDayOfWork: null,
      dailyCost: 800, isTalent: false, seniorityCode: 'M1'
    }
  ],
  projects: [
    { id: 'p1', name: 'App Mobile Intesa', clientId: 'c1', startDate: `${CURRENT_YEAR}-01-01`, endDate: `${CURRENT_YEAR}-12-31`, budget: 120000, realizationPercentage: 100, projectManager: 'Elena Bianchi', status: 'In corso', billingType: 'TIME_MATERIAL', contractId: 'ct1' },
    { id: 'p2', name: 'Data Platform EcoEnergy', clientId: 'c2', startDate: isoDate(daysFromToday(-60)), endDate: isoDate(daysFromToday(120)), budget: 80000, realizationPercentage: 100, projectManager: 'Elena Bianchi', status: 'In corso', billingType: 'FIXED_PRICE', contractId: null }
  ],
  users: [
    { id: 'admin-id', username: 'admin', role: 'ADMIN', resourceId: null, managerIds: [], isActive: true, mustChangePassword: false },
    { id: 'mgr-id', username: 'e.bianchi', role: 'MANAGER', resourceId: 'res2', managerIds: ['admin-id'], isActive: true, mustChangePassword: false },
    { id: 'dev-id', username: 'm.rossi', role: 'SIMPLE', resourceId: 'res1', managerIds: ['mgr-id'], isActive: true, mustChangePassword: false }
  ],
  assignments: [
    { id: 'as1', resourceId: 'res1', projectId: 'p1' },
    { id: 'as2', resourceId: 'res2', projectId: 'p2' }
  ],
  allocations: {
    'as1': buildDemoAllocations(-20, 25, 80),
    'as2': buildDemoAllocations(-10, 15, 50)
  },
  
  // Skill Data
  skillMacroCategories: [
      { id: 'mac1', name: 'Technology' },
      { id: 'mac2', name: 'Soft Skills' }
  ],
  skillCategories: [
      { id: 'cat1', name: 'Frontend', macroCategoryIds: ['mac1'] },
      { id: 'cat2', name: 'Backend', macroCategoryIds: ['mac1'] },
      { id: 'cat3', name: 'Management', macroCategoryIds: ['mac2'] }
  ],
  skills: [
      { id: 'sk1', name: 'React', categoryIds: ['cat1'], isCertification: false },
      { id: 'sk2', name: 'Node.js', categoryIds: ['cat2'], isCertification: false },
      { id: 'sk3', name: 'Agile/Scrum', categoryIds: ['cat3'], isCertification: false },
      { id: 'cert1', name: 'AWS Solutions Architect', categoryIds: ['cat2'], isCertification: true }
  ],
  resourceSkills: [
      { resourceId: 'res1', skillId: 'sk1', level: 5, acquisitionDate: '2022-01-01', expirationDate: null },
      { resourceId: 'res1', skillId: 'cert1', level: 5, acquisitionDate: '2023-05-10', expirationDate: '2026-05-10' }
  ],
  projectSkills: [
      { projectId: 'p1', skillId: 'sk1' }
  ],
  
  // HR Data
  resourceRequests: [],
  interviews: [
      {
          id: 'int1',
          candidateName: 'Luigi',
          candidateSurname: 'Verdi',
          status: 'Aperto',
          function: 'Software Engineering',
          resourceRequestId: null,
          roleId: 'r1',
          interviewDate: '2024-06-15',
          feedback: null,
          notes: '',
          hiringStatus: null,
          birthDate: null,
          cvSummary: null,
          interviewersIds: ['res2'],
          entryDate: null,
          // Ratings
          ratingTechnicalMastery: null,
          ratingProblemSolving: null,
          ratingMethodQuality: null,
          ratingDomainKnowledge: null,
          ratingAutonomy: null,
          ratingCommunication: null,
          ratingProactivity: null,
          ratingTeamFit: null
      }
  ],

  // Financials
  contracts: [
    { id: 'ct1', name: 'Accordo Quadro Intesa', startDate: `${CURRENT_YEAR}-01-01`, endDate: isoDate(daysFromToday(75)), cig: 'CIG0012345', cigDerivato: null, wbs: 'WBS-INT-01', capienza: 200000, backlog: 150000, rateCardId: 'rc1', billingType: 'TIME_MATERIAL' }
  ],
  contractProjects: [
    { contractId: 'ct1', projectId: 'p1' }
  ],
  contractManagers: [
    { contractId: 'ct1', resourceId: 'res2' }
  ],
  rateCards: [
    { id: 'rc1', name: 'Listino Standard', currency: 'EUR' }
  ],
  rateCardEntries: [
    { rateCardId: 'rc1', resourceId: 'res1', dailyRate: 750 },
    { rateCardId: 'rc1', resourceId: 'res2', dailyRate: 980 }
  ],
  projectExpenses: [],
  billingMilestones: [
    { id: 'bm1', projectId: 'p2', name: 'Anticipo 25%', date: isoDate(daysFromToday(20)), amount: 20000, status: 'PLANNED' }
  ],
  roleCostHistory: [],

  // Operational
  companyCalendar: [
    { id: 'ce1', name: 'Ferragosto', date: `${CURRENT_YEAR}-08-15`, type: 'NATIONAL_HOLIDAY', location: null },
    { id: 'ce2', name: 'Natale', date: `${CURRENT_YEAR}-12-25`, type: 'NATIONAL_HOLIDAY', location: null }
  ],
  leaveTypes: [
    { id: 'lt1', name: 'Ferie', color: '#4caf50', affectsCapacity: true, requiresApproval: true },
    { id: 'lt2', name: 'Malattia', color: '#f44336', affectsCapacity: true, requiresApproval: false },
    { id: 'lt3', name: 'Permesso', color: '#ff9800', affectsCapacity: true, requiresApproval: true }
  ],
  leaveRequests: [
    { id: 'lr1', resourceId: 'res1', typeId: 'lt1', startDate: isoDate(daysFromToday(7)), endDate: isoDate(daysFromToday(9)), status: 'PENDING', managerId: null, approverIds: ['res2'], notes: 'Ferie estive', isHalfDay: false }
  ],
  notifications: [],

  // Configuration
  authConfig: { isEnabled: false },
  pageVisibility: {},
  skillThresholds: { NOVICE: 0, JUNIOR: 60, MIDDLE: 150, SENIOR: 350, EXPERT: 700 },
  planningSettings: { monthsBefore: 6, monthsAfter: 18 },
  managerResourceIds: ['res2'],
  sidebarConfig: [],
  sidebarSections: ['Principale', 'Progetti', 'Risorse', 'Operatività', 'Supporto', 'Configurazione', 'Dati'],
  sidebarSectionColors: {},
  sidebarFooterActions: [],
  dashboardLayout: [],
  roleHomePages: {},
  analyticsCache: {},
  notificationConfigs: [],
  notificationRules: [],
  // Seed visibilità entità: tutti i ruoli non-ADMIN vedono tutte le entità (default aperto)
  roleEntityVisibility: (() => {
    const ROLES = ['SIMPLE', 'SIMPLE_EXT', 'MANAGER', 'MANAGER_EXT', 'SENIOR MANAGER', 'SENIOR MANAGER_EXT', 'ASSOCIATE DIRECTOR', 'ASSOCIATE DIRECTOR_EXT', 'MANAGING DIRECTOR', 'MANAGING DIRECTOR_EXT'];
    const ENTITIES = ['resources', 'projects', 'clients', 'assignments', 'allocations', 'contracts', 'rate_cards', 'skills', 'roles', 'leaves', 'resource_requests', 'interviews', 'wbs_tasks', 'billing_milestones', 'resource_evaluations'];
    return ROLES.flatMap(role => ENTITIES.map(entity => ({ role: role as any, entity, isVisible: true })));
  })(),
  knowledgeBaseArticles: [
    {
      id: 'kb1',
      title: 'Processo di Onboarding Risorse',
      content: '<h2>Onboarding</h2><p>Linee guida per l\'inserimento di una <strong>nuova risorsa</strong> nel team.</p>',
      format: 'html',
      tags: ['hr', 'onboarding'],
      createdAt: '2026-01-10T09:00:00.000Z',
      updatedAt: '2026-01-12T09:00:00.000Z',
      linkedEntities: [],
      version: 1,
    },
  ],
};
