

export interface Client { id: string; name: string; sector: string; contactEmail: string; }
export interface Role { id: string; name: string; seniorityLevel: string; dailyCost: number; standardCost: number; dailyExpenses: number; }
export interface Resource { id?: string; name: string; email: string; roleId: string; horizontal: string; location: string; hireDate: string; workSeniority: number; maxStaffingPercentage: number; notes?: string; resigned?: boolean; lastDayOfWork?: string | null; tutorId?: string | null; }
export interface Project { id?: string; name: string; clientId: string; startDate: string | null; endDate: string | null; budget: number; realizationPercentage: number; projectManager: string; status: string; notes?: string; contractId?: string | null; }
export interface Assignment { id?: string; resourceId: string; projectId: string; }
export type Allocation = { [assignmentId: string]: { [date: string]: number } };
export interface ConfigOption { id?: string; value: string; }
export type CalendarEventType = 'NATIONAL_HOLIDAY' | 'COMPANY_CLOSURE' | 'LOCAL_HOLIDAY';
export interface CalendarEvent { id?: string; name: string; date: string; type: CalendarEventType; location: string | null; }
export interface WbsTask { id: string; elementoWbs: string; descrizioneWbe: string; clientId?: string; periodo: string; ore: number; produzioneLorda: number; oreNetworkItalia: number; produzioneLordaNetworkItalia: number; perdite: number; realisation: number; speseOnorariEsterni: number; speseAltro: number; fattureOnorari: number; fattureSpese: number; iva: number; incassi: number; primoResponsabileId?: string; secondoResponsabileId?: string; }
export type ResourceRequestStatus = 'ATTIVA' | 'STANDBY' | 'CHIUSA';
export interface ResourceRequest { id?: string; requestCode?: string; projectId: string; roleId: string; requestorId: string | null; startDate: string; endDate: string; commitmentPercentage: number; isUrgent: boolean; isLongTerm: boolean; isTechRequest: boolean; isOsrOpen: boolean; osrNumber: string | null; notes: string; status: ResourceRequestStatus; createdAt?: string; }
export type InterviewStatus = 'Aperto' | 'Chiuso' | 'StandBy' | 'Non Contattabile';
export type InterviewHiringStatus = 'SI' | 'NO' | 'No Rifiutato' | 'In Fase di Offerta';
export type InterviewFeedback = 'Positivo' | 'Positivo On Hold' | 'Negativo';
export interface Interview { id?: string; resourceRequestId: string | null; candidateName: string; candidateSurname: string; birthDate: string | null; horizontal: string | null; roleId: string | null; cvSummary: string | null; interviewersIds: string[]; interviewDate: string | null; feedback: InterviewFeedback | null; notes: string | null; hiringStatus: InterviewHiringStatus | null; entryDate: string | null; status: InterviewStatus; createdAt?: string; }
export interface Contract { id?: string; name: string; startDate: string | null; endDate: string | null; cig: string; cigDerivato: string | null; capienza: number; backlog: number; }
export interface ContractProject { contractId: string; projectId: string; }
export interface ContractManager { contractId: string; resourceId: string; }
export interface Skill { id?: string; name: string; categoryIds?: string[]; category?: string; macroCategory?: string; isCertification: boolean; }
export interface ResourceSkill { resourceId: string; skillId: string; level: number; acquisitionDate?: string | null; expirationDate?: string | null; }
export interface ProjectSkill { projectId: string; skillId: string; }
export type PageVisibility = { [key: string]: boolean };
export type SkillThresholds = { [key: string]: number };
export interface RoleCostHistory { id: string; roleId: string; startDate: string; endDate?: string; dailyCost: number; }
export interface LeaveType { id?: string; name: string; color: string; requiresApproval: boolean; affectsCapacity: boolean; }
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export interface LeaveRequest { id?: string; resourceId: string; typeId: string; startDate: string; endDate: string; status: LeaveStatus; managerId?: string | null; approverIds?: string[]; notes: string; isHalfDay: boolean; created_at?: string; }
export interface SkillCategory { id: string; name: string; macroCategoryIds?: string[]; }
export interface SkillMacroCategory { id: string; name: string; }
export interface AppUser { id: string; username: string; role: string; resourceId?: string | null; isActive: boolean; permissions: string[]; mustChangePassword?: boolean; }
export interface RolePermission { role: string; pagePath: string; allowed: boolean; }
export type SidebarItem = { path: string; label: string; icon: string; section: string; color?: string; };
export type SidebarSectionColors = { [section: string]: string };
export interface Notification { id: string; title: string; message: string; type: 'info' | 'warning' | 'error' | 'success'; isRead: boolean; createdAt: string; link?: string; }
export interface DashboardCategory { id: string; label: string; cards: string[]; }
export type ActivityStatus = 'In linea' | 'In ritardo' | 'Conclusa' | 'Non Iniziata';
export interface ProjectActivity { id?: string; projectId: string; description: string; ownerId: string; startDate: string; endDate: string; status: ActivityStatus; notes?: string; updatedAt: string; }
export interface ComputedSkill { skill: Skill; inferredLevel: number | null; manualDetails: ResourceSkill | null; sourceProjects: string[]; }
export const SKILL_LEVELS: Record<number, string> = { 1: 'Base', 2: 'Intermedio', 3: 'Avanzato', 4: 'Esperto', 5: 'Guru' };
export type SkillLevelValue = 1 | 2 | 3 | 4 | 5;
export interface AuditLogEntry { id: string; userId?: string; username: string; action: string; entity: string; entityId?: string; details?: any; ipAddress?: string; createdAt: string; }
export type UserRole = 'SIMPLE' | 'MANAGER' | 'SENIOR MANAGER' | 'MANAGING DIRECTOR' | 'ADMIN';
