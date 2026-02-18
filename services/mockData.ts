
import { v4 as uuidv4 } from 'uuid';
import { AppUser, Assignment, Allocation, CalendarEvent, Client, ConfigOption, Contract, Interview, LeaveRequest, LeaveType, Notification, Project, ProjectExpense, RateCard, Resource, ResourceRequest, Role, RoleCostHistory, Skill, SkillCategory, SkillMacroCategory, BillingMilestone, ResourceSkill, ProjectSkill } from '../types';

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
    { id: 'p1', name: 'App Mobile Intesa', clientId: 'c1', startDate: '2024-02-01', endDate: '2024-11-30', budget: 120000, realizationPercentage: 100, projectManager: 'Elena Bianchi', status: 'In corso', billingType: 'TIME_MATERIAL' }
  ],
  users: [
    { id: 'admin-id', username: 'admin', role: 'ADMIN', resourceId: null, isActive: true, mustChangePassword: false }
  ],
  assignments: [
    { id: 'as1', resourceId: 'res1', projectId: 'p1' }
  ],
  allocations: {
    'as1': { '2024-06-03': 100, '2024-06-04': 100, '2024-06-05': 100 }
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
  contracts: [],
  rateCards: [],
  rateCardEntries: [],
  projectExpenses: [],
  billingMilestones: [],
  roleCostHistory: [],
  
  // Operational
  companyCalendar: [],
  leaveTypes: [],
  leaveRequests: [],
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
  notificationRules: []
};
