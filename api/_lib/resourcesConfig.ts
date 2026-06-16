/**
 * @file api/_lib/resourcesConfig.ts
 * @description Configurazione statica del dispatcher CRUD generico (api/resources.ts):
 * mapping entità→tabella, campi JSONB, entità sotto controllo di visibilità (Layer 3 RBAC)
 * e schemi di validazione Zod per ciascuna tabella. Estratto da api/resources.ts
 * per ridurne la dimensione — nessuna logica, solo dati.
 */
import { z } from '../../libs/zod.js';

// Campi che devono essere serializzati come JSON prima di essere passati a PostgreSQL
// (colonne di tipo JSONB — pg driver non serializza automaticamente gli array JS)
export const JSONB_FIELDS: Record<string, string[]> = {
    'notification_rules': ['templateBlocks'],
    'app_users': ['managerIds'],
};

// Entità soggette al controllo di visibilità per ruolo (Layer 3 RBAC).
// Lista unica condivisa tra GET, POST, PUT, DELETE.
export const ENTITY_VISIBILITY_CONTROLLED = [
    'resources', 'projects', 'clients', 'assignments', 'allocations', 'contracts',
    'rate_cards', 'rate_card_entries', 'billing_milestones', 'leave_requests',
    'resource_requests', 'interviews', 'wbs_tasks', 'resource_evaluations',
    'company_calendar',
];

export const TABLE_MAPPING: Record<string, string> = {
    'leaves': 'leave_requests',
    'leave_types': 'leave_types',
    'role-permissions': 'role_permissions',
    'security-users': 'app_users',
    'app-users': 'app_users',
    'rate_cards': 'rate_cards',
    'rate_card_entries': 'rate_card_entries',
    'project_expenses': 'project_expenses',
    'billing_milestones': 'billing_milestones',
    'audit_logs': 'action_logs',
    'analytics_cache': 'analytics_cache',
    'notification_configs': 'notification_configs',
    'notification_rules': 'notification_rules',
    'resource_skills': 'resource_skills',
    'project_skills': 'project_skills',
    'contract_projects': 'contract_projects',
    'contract_managers': 'contract_managers',
    'notifications': 'notifications',
    'app_config': 'app_config',
    'skill_categories': 'skill_categories',
    'skill_macro_categories': 'skill_macro_categories',
    'resource_evaluations': 'resource_evaluations',
    'evaluation_metrics': 'evaluation_metrics',
    'resource_requests': 'resource_requests',
    'role_entity_visibility': 'role_entity_visibility',
};

export const VALIDATION_SCHEMAS: Record<string, any> = {
    'resources': z.object({
        name: z.string(),
        email: z.string().optional().nullable(),
        roleId: z.string().optional().nullable(),
        function: z.string().optional().nullable(), // Ridenominato
        industry: z.string().optional().nullable(), // Aggiunto
        location: z.string().optional().nullable(),
        hireDate: z.string().optional().nullable(),
        workSeniority: z.coerce.number().optional().nullable(),
        notes: z.string().optional().nullable(),
        maxStaffingPercentage: z.coerce.number().optional().nullable(),
        resigned: z.boolean().optional().nullable(),
        lastDayOfWork: z.string().optional().nullable(),
        tutorId: z.string().optional().nullable(),
        dailyCost: z.coerce.number().optional().nullable(),
        isTalent: z.boolean().optional().nullable(),
        seniorityCode: z.string().optional().nullable()
    }),
    'projects': z.object({
        name: z.string(),
        clientId: z.string().optional().nullable(),
        startDate: z.string().optional().nullable(),
        endDate: z.string().optional().nullable(),
        budget: z.coerce.number().optional().nullable(),
        realizationPercentage: z.coerce.number().optional().nullable(),
        projectManager: z.string().optional().nullable(),
        status: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        contractId: z.string().optional().nullable(),
        billingType: z.string().optional().nullable()
    }).refine(data => {
        if (!data.startDate || !data.endDate) return true;
        return data.endDate >= data.startDate;
    }, { message: 'La data di fine non può essere antecedente alla data di inizio', path: ['endDate'] }),
    'clients': z.object({
        name: z.string(),
        sector: z.string().optional().nullable(),
        contactEmail: z.string().optional().nullable()
    }),
    'roles': z.object({
        name: z.string(),
        seniorityLevel: z.string().optional().nullable(),
        dailyCost: z.coerce.number().optional().nullable(),
        standardCost: z.coerce.number().optional().nullable(),
        dailyExpenses: z.coerce.number().optional().nullable(),
        overheadPct: z.coerce.number().optional(),
        chargeablePct: z.coerce.number().optional(),
        trainingPct: z.coerce.number().optional(),
        bdPct: z.coerce.number().optional()
    }),
    'skills': z.object({
        name: z.string(),
        isCertification: z.boolean().optional().nullable(),
        categoryIds: z.array(z.string()).optional().nullable()
    }),
    'skill_categories': z.object({
        name: z.string(),
        macroCategoryIds: z.array(z.string()).optional().nullable()
    }),
    'skill_macro_categories': z.object({
        name: z.string()
    }),
    'resource_skills': z.object({
        resourceId: z.string(),
        skillId: z.string(),
        level: z.coerce.number().optional().nullable(),
        acquisitionDate: z.string().optional().nullable(),
        expirationDate: z.string().optional().nullable()
    }).refine(data => {
        if (!data.acquisitionDate || !data.expirationDate) return true;
        return data.expirationDate >= data.acquisitionDate;
    }, { message: 'La data di scadenza non può essere antecedente alla data di acquisizione', path: ['expirationDate'] }),
    'project_skills': z.object({
        projectId: z.string(),
        skillId: z.string()
    }),
    'contracts': z.object({
        name: z.string(),
        startDate: z.string().optional().nullable(),
        endDate: z.string().optional().nullable(),
        cig: z.string(),
        cigDerivato: z.string().optional().nullable(),
        wbs: z.string().optional().nullable(),
        capienza: z.coerce.number(),
        backlog: z.coerce.number().optional().nullable(),
        rateCardId: z.string().optional().nullable(),
        billingType: z.string().optional().nullable()
    }).refine(data => {
        if (!data.startDate || !data.endDate) return true;
        return data.endDate >= data.startDate;
    }, { message: 'La data di fine non può essere antecedente alla data di inizio', path: ['endDate'] }),
    'contract_projects': z.object({
        contractId: z.string(),
        projectId: z.string()
    }),
    'contract_managers': z.object({
        contractId: z.string(),
        resourceId: z.string()
    }),
    'rate_card_entries': z.object({
        rateCardId: z.string(),
        resourceId: z.string(),
        dailyRate: z.coerce.number()
    }),
    'evaluation_metrics': z.object({
        evaluationId: z.string(),
        category: z.string(),
        metricKey: z.string(),
        metricValue: z.string().optional().nullable(),
        score: z.coerce.number().optional().nullable()
    }),
    'app_config': z.object({
        key: z.string(),
        value: z.string()
    }),
    'analytics_cache': z.object({
        key: z.string(),
        data: z.any(),
        scope: z.string().optional().nullable()
    }),
    'notifications': z.object({
        recipientResourceId: z.string(),
        title: z.string(),
        message: z.string(),
        link: z.string().optional().nullable(),
        isRead: z.boolean().optional()
    }),
    'role_permissions': z.object({
        role: z.string(),
        pagePath: z.string(),
        isAllowed: z.boolean().optional()
    }),
    'role_entity_visibility': z.object({
        role: z.string(),
        entity: z.string(),
        isVisible: z.boolean()
    }),
    'leave_types': z.object({
        name: z.string(),
        color: z.string().optional().nullable(),
        requiresApproval: z.boolean().optional().nullable(),
        affects_capacity: z.boolean().optional().nullable()
    }),
    'leave_requests': z.object({
        resourceId: z.string(),
        typeId: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        status: z.string().optional(),
        managerId: z.string().optional().nullable(),
        approverIds: z.array(z.string()).optional().nullable(),
        notes: z.string().optional().nullable(),
        isHalfDay: z.boolean().optional().nullable()
    }).refine(data => {
        if (!data.startDate || !data.endDate) return true;
        return data.endDate >= data.startDate;
    }, { message: 'La data di fine non può essere antecedente alla data di inizio', path: ['endDate'] }),
    'rate_cards': z.object({
        name: z.string(),
        currency: z.string().optional().nullable()
    }),
    'project_expenses': z.object({
        projectId: z.string(),
        category: z.string(),
        description: z.string().optional().nullable(),
        amount: z.coerce.number(),
        date: z.string(),
        billable: z.boolean().optional().nullable()
    }),
    'billing_milestones': z.object({
        projectId: z.string(),
        name: z.string(),
        date: z.string(),
        amount: z.coerce.number(),
        status: z.string().optional().nullable()
    }),
    'app_users': z.object({
        username: z.string(),
        role: z.string(),
        resourceId: z.string().optional().nullable(),
        managerIds: z.array(z.string()).optional().nullable(),
        isActive: z.boolean().optional().nullable()
    }),
    'notification_configs': z.object({
        eventType: z.string(),
        webhookUrl: z.string(),
        description: z.string().optional().nullable(),
        isActive: z.boolean().optional()
    }),
    'notification_rules': z.object({
        name: z.string(),
        eventType: z.string(),
        webhookUrl: z.string(),
        description: z.string().optional().nullable(),
        isActive: z.boolean().optional(),
        templateBlocks: z.array(z.object({
            id: z.string(),
            type: z.string(),
            config: z.object({
                titleTemplate: z.string().optional().nullable(),
                subtitleTemplate: z.string().optional().nullable(),
                textTemplate: z.string().optional().nullable(),
                facts: z.array(z.object({ nameTemplate: z.string(), valueTemplate: z.string() })).optional().nullable(),
                imageUrlTemplate: z.string().optional().nullable(),
                imageCaption: z.string().optional().nullable(),
                tableTitle: z.string().optional().nullable(),
                headers: z.array(z.string()).optional().nullable(),
            })
        })).optional(),
        color: z.string().optional().nullable(),
    }),
    'interviews': z.object({
        resourceRequestId: z.string().optional().nullable(),
        candidateName: z.string(),
        candidateSurname: z.string(),
        birthDate: z.string().optional().nullable(),
        function: z.string().optional().nullable(), // renamed from horizontal
        roleId: z.string().optional().nullable(),
        cvSummary: z.string().optional().nullable(),
        interviewersIds: z.array(z.string()).optional().nullable(),
        interviewDate: z.string().optional().nullable(),
        feedback: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        hiringStatus: z.string().optional().nullable(),
        entryDate: z.string().optional().nullable(),
        status: z.string(),
        ratingTechnicalMastery: z.coerce.number().optional().nullable(),
        ratingProblemSolving: z.coerce.number().optional().nullable(),
        ratingMethodQuality: z.coerce.number().optional().nullable(),
        ratingDomainKnowledge: z.coerce.number().optional().nullable(),
        ratingAutonomy: z.coerce.number().optional().nullable(),
        ratingCommunication: z.coerce.number().optional().nullable(),
        ratingProactivity: z.coerce.number().optional().nullable(),
        ratingTeamFit: z.coerce.number().optional().nullable()
    }),
    'resource_evaluations': z.object({
        resourceId: z.string(),
        fiscalYear: z.coerce.number(),
        evaluatorId: z.string().optional().nullable(),
        status: z.string().optional(),
        overallRating: z.coerce.number().optional().nullable(),
        summary: z.string().optional().nullable(),
        metrics: z.array(z.object({
             category: z.string(),
             metricKey: z.string(),
             metricValue: z.string().optional().nullable(),
             score: z.coerce.number().optional().nullable()
        })).optional()
    }),
    'resource_requests': z.object({
        projectId: z.string(),
        roleId: z.string(),
        requestorId: z.string().optional().nullable(),
        startDate: z.string(),
        endDate: z.string(),
        commitmentPercentage: z.coerce.number(),
        isUrgent: z.boolean().optional(),
        isLongTerm: z.boolean().optional(),
        isTechRequest: z.boolean().optional(),
        isOsrOpen: z.boolean().optional(),
        osrNumber: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        status: z.string(),
    }),
    'company_calendar': z.object({
        name: z.string(),
        date: z.string(),
        type: z.string(),
        location: z.string().optional().nullable()
    }),
};
