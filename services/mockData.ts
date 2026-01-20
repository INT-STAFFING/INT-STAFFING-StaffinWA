
import { v4 as uuidv4 } from 'uuid';

export const INITIAL_MOCK_DATA = {
  horizontals: [
    { id: 'h1', value: 'Web Development' }, 
    { id: 'h2', value: 'Data Science' },
    { id: 'h3', value: 'Cloud Architecture' },
    { id: 'h4', value: 'Cyber Security' }
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
    { id: 'cs1', value: 'Tecnologia' },
    { id: 'cs2', value: 'Finance' },
    { id: 'cs3', value: 'Retail' },
    { id: 'cs4', value: 'Energy' }
  ],
  locations: [
    { id: 'l1', value: 'Milano' }, 
    { id: 'l2', value: 'Roma' },
    { id: 'l3', value: 'Remote' }
  ],
  clients: [
    { id: 'c1', name: 'Global Tech Solution', sector: 'Tecnologia', contactEmail: 'info@globaltech.com' },
    { id: 'c2', name: 'EcoEnergy SPA', sector: 'Energy', contactEmail: 'staffing@ecoenergy.it' }
  ],
  roles: [
    { id: 'r1', name: 'Frontend Developer', seniorityLevel: 'Senior', dailyCost: 450, standardCost: 450, dailyExpenses: 15.75 },
    { id: 'r2', name: 'Backend Engineer', seniorityLevel: 'Senior', dailyCost: 500, standardCost: 500, dailyExpenses: 17.5 },
    { id: 'r3', name: 'Project Manager', seniorityLevel: 'Manager', dailyCost: 650, standardCost: 650, dailyExpenses: 22.75 }
  ],
  resources: [
    { 
      id: 'res1', name: 'Mario Rossi', email: 'mario@demo.com', roleId: 'r1', 
      horizontal: 'Web Development', location: 'Milano', hireDate: '2023-01-01', 
      workSeniority: 5, maxStaffingPercentage: 100, resigned: false, lastDayOfWork: null 
    },
    { 
      id: 'res2', name: 'Giulia Bianchi', email: 'giulia@demo.com', roleId: 'r3', 
      horizontal: 'Web Development', location: 'Roma', hireDate: '2022-06-15', 
      workSeniority: 8, maxStaffingPercentage: 100, resigned: false, lastDayOfWork: null 
    }
  ],
  projects: [
    { 
      id: 'p1', name: 'Portale E-commerce', clientId: 'c1', startDate: '2024-01-01', 
      endDate: '2025-12-31', budget: 150000, realizationPercentage: 100, 
      projectManager: 'Giulia Bianchi', status: 'In corso' 
    },
    { 
      id: 'p2', name: 'Smart Grid Analitica', clientId: 'c2', startDate: '2025-01-01', 
      endDate: '2025-12-31', budget: 80000, realizationPercentage: 100, 
      projectManager: 'Admin', status: 'In corso' 
    }
  ],
  users: [
    { id: 'admin-id', username: 'admin', role: 'ADMIN', resourceId: null, isActive: true, mustChangePassword: false }
  ],
  assignments: [
    { id: 'as1', resourceId: 'res1', projectId: 'p1' },
    { id: 'as2', resourceId: 'res2', projectId: 'p1' }
  ],
  allocations: {
    'as1': { '2025-07-21': 50, '2025-07-22': 50, '2025-07-23': 50 },
    'as2': { '2025-07-21': 100, '2025-07-22': 100, '2025-07-23': 100 }
  },
  companyCalendar: [
      { id: 'cal1', name: 'Ferragosto', date: '2025-08-15', type: 'NATIONAL_HOLIDAY', location: null }
  ],
  leaveTypes: [
    { id: 'lt1', name: 'Ferie', color: '#006493', requiresApproval: true, affects_capacity: true },
    { id: 'lt2', name: 'Malattia', color: '#ba1a1a', requiresApproval: false, affects_capacity: true }
  ],
  leaveRequests: [],
  notifications: [
    { id: 'not1', recipientResourceId: 'res2', title: 'Benvenuto', message: 'Il sistema di staffing è pronto per l\'uso.', isRead: false, createdAt: new Date().toISOString() }
  ],
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
