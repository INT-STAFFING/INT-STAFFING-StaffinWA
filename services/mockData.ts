
import { v4 as uuidv4 } from 'uuid';

export const INITIAL_MOCK_DATA = {
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
    { id: 'r1', name: 'Senior Developer', seniorityLevel: 'Senior', dailyCost: 600, standardCost: 550, dailyExpenses: 21 },
    { id: 'r2', name: 'Project Manager', seniorityLevel: 'Manager', dailyCost: 800, standardCost: 750, dailyExpenses: 28 }
  ],
  resources: [
    { 
      id: 'res1', name: 'Mario Rossi', email: 'm.rossi@partner.it', roleId: 'r1', 
      function: 'Software Engineering', industry: 'Banking & Finance', location: 'Milano', 
      hireDate: '2022-01-10', workSeniority: 8, maxStaffingPercentage: 100, resigned: false, lastDayOfWork: null 
    },
    { 
      id: 'res2', name: 'Elena Bianchi', email: 'e.bianchi@partner.it', roleId: 'r2', 
      function: 'Business Transformation', industry: 'Energy & Utilities', location: 'Roma', 
      hireDate: '2021-05-15', workSeniority: 12, maxStaffingPercentage: 100, resigned: false, lastDayOfWork: null 
    }
  ],
  projects: [
    { id: 'p1', name: 'App Mobile Intesa', clientId: 'c1', startDate: '2024-02-01', endDate: '2024-11-30', budget: 120000, realizationPercentage: 100, projectManager: 'Elena Bianchi', status: 'In corso' }
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
  companyCalendar: [],
  leaveTypes: [],
  leaveRequests: [],
  notifications: [],
  resourceRequests: [],
  interviews: [],
  contracts: [],
  authConfig: { isEnabled: false },
  roleCostHistory: [],
  skillCategories: [],
  skillMacroCategories: [],
  resourceSkills: [],
  projectSkills: [],
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
  analyticsCache: {}
};
