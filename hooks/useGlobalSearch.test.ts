/* @vitest-environment jsdom */
/**
 * @file hooks/useGlobalSearch.test.ts
 * @description Test unitari per useGlobalSearch.
 * Verifica scoring, filtri e ordinamento dei risultati di ricerca globale.
 */
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGlobalSearch } from './useGlobalSearch';

// ---------------------------------------------------------------------------
// Mock dei context di dominio
// ---------------------------------------------------------------------------
vi.mock('../context/ResourcesContext');
vi.mock('../context/ProjectsContext');
vi.mock('../context/SkillsContext');
vi.mock('../context/HRContext');

import { useResourcesContext } from '../context/ResourcesContext';
import { useProjectsContext } from '../context/ProjectsContext';
import { useSkillsContext } from '../context/SkillsContext';
import { useHRContext } from '../context/HRContext';

const mockResource = {
    id: 'r1', name: 'Mario Rossi', email: 'mario.rossi@example.com',
    roleId: 'role1', function: 'Technology', industry: 'IT', location: 'Milano',
    hireDate: '2020-01-01', workSeniority: 3, maxStaffingPercentage: 100,
    resigned: false, lastDayOfWork: null,
};
const mockResignedResource = { ...mockResource, id: 'r2', name: 'Luigi Bianchi', email: 'luigi@example.com', resigned: true };

const mockProject = { id: 'p1', name: 'Progetto Alpha', clientId: 'c1', startDate: null, endDate: null, budget: 0, realizationPercentage: 100, projectManager: 'Mario Rossi', status: 'ATTIVO', billingType: 'TIME_MATERIAL' as const };
const mockClient  = { id: 'c1', name: 'Acme Corp', sector: 'Technology', contactEmail: 'info@acme.com' };
const mockContract = { id: 'ct1', name: 'Contratto Beta', startDate: null, endDate: null, cig: 'CIG-001', cigDerivato: null, wbs: 'WBS-XYZ', capienza: 0, backlog: 0 };
const mockSkill   = { id: 'sk1', name: 'React', isCertification: false, category: 'Frontend' };
const mockCert    = { id: 'sk2', name: 'AWS Certified', isCertification: true, macroCategory: 'Cloud' };
const mockRequest = { id: 'req1', projectId: 'p1', roleId: 'role1', requestorId: null, startDate: '2025-01-01', endDate: '2025-12-31', commitmentPercentage: 100, isUrgent: false, isLongTerm: false, isTechRequest: false, status: 'ATTIVA' as const };
const mockInterview = { id: 'int1', resourceRequestId: 'req1', candidateName: 'Anna', candidateSurname: 'Verdi', birthDate: null, function: null, roleId: null, cvSummary: null, interviewersIds: null, interviewDate: '2025-06-01', feedback: null, notes: null, hiringStatus: null, entryDate: null, status: 'Aperto' as const };
const mockRole = { id: 'role1', name: 'Senior Developer', seniorityLevel: 'SENIOR', dailyCost: 500 };

const defaultContexts = () => {
    vi.mocked(useResourcesContext).mockReturnValue({ resources: [mockResource, mockResignedResource], roles: [mockRole] } as any);
    vi.mocked(useProjectsContext).mockReturnValue({ projects: [mockProject], clients: [mockClient], contracts: [mockContract] } as any);
    vi.mocked(useSkillsContext).mockReturnValue({ skills: [mockSkill, mockCert] } as any);
    vi.mocked(useHRContext).mockReturnValue({ resourceRequests: [mockRequest], interviews: [mockInterview] } as any);
};

beforeEach(() => {
    defaultContexts();
});

describe('useGlobalSearch – casi base', () => {
    it('restituisce array vuoto per query troppo corta (< 2 caratteri)', () => {
        const { result } = renderHook(() => useGlobalSearch('a'));
        expect(result.current).toHaveLength(0);
    });

    it('restituisce array vuoto per query vuota', () => {
        const { result } = renderHook(() => useGlobalSearch(''));
        expect(result.current).toHaveLength(0);
    });

    it('trova una risorsa per nome (corrispondenza parziale)', () => {
        const { result } = renderHook(() => useGlobalSearch('Mario'));
        const resources = result.current.filter(r => r.type === 'RISORSA');
        expect(resources).toHaveLength(1);
        expect(resources[0].title).toBe('Mario Rossi');
    });

    it('esclude le risorse dimissionarie (resigned = true)', () => {
        const { result } = renderHook(() => useGlobalSearch('Luigi'));
        const resources = result.current.filter(r => r.type === 'RISORSA');
        expect(resources).toHaveLength(0);
    });

    it('trova una risorsa per email', () => {
        const { result } = renderHook(() => useGlobalSearch('mario.rossi'));
        const resources = result.current.filter(r => r.type === 'RISORSA');
        expect(resources).toHaveLength(1);
    });
});

describe('useGlobalSearch – scoring e ordinamento', () => {
    it('assegna score 100 per corrispondenza esatta', () => {
        const { result } = renderHook(() => useGlobalSearch('Mario Rossi'));
        const risorsa = result.current.find(r => r.type === 'RISORSA' && r.title === 'Mario Rossi');
        expect(risorsa?.score).toBe(100);
    });

    it('assegna score 80 per corrispondenza a inizio stringa', () => {
        const { result } = renderHook(() => useGlobalSearch('Mario'));
        const risorsa = result.current.find(r => r.type === 'RISORSA');
        expect(risorsa?.score).toBe(80);
    });

    it('assegna score 50 per corrispondenza parziale', () => {
        const { result } = renderHook(() => useGlobalSearch('Rossi'));
        const risorsa = result.current.find(r => r.type === 'RISORSA');
        expect(risorsa?.score).toBe(50);
    });

    it('ordina i risultati per score decrescente', () => {
        // Aggiunge una risorsa con nome che inizia con "Mario" per avere score 80
        // e una risorsa con "Mario" nel mezzo per score 50
        vi.mocked(useResourcesContext).mockReturnValue({
            resources: [
                { ...mockResource, id: 'r3', name: 'Amario Test', email: 'test@x.com' },
                { ...mockResource, id: 'r1', name: 'Mario Esatto', email: 'mario@x.com' },
            ],
            roles: [],
        } as any);
        const { result } = renderHook(() => useGlobalSearch('mario'));
        const scores = result.current.map(r => r.score);
        // Devono essere in ordine decrescente
        for (let i = 1; i < scores.length; i++) {
            expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
        }
    });
});

describe('useGlobalSearch – tipi di entità', () => {
    it('trova un progetto per nome', () => {
        const { result } = renderHook(() => useGlobalSearch('Alpha'));
        const projects = result.current.filter(r => r.type === 'PROGETTO');
        expect(projects).toHaveLength(1);
        expect(projects[0].title).toBe('Progetto Alpha');
        expect(projects[0].link).toContain('/projects');
    });

    it('trova un cliente per nome', () => {
        const { result } = renderHook(() => useGlobalSearch('Acme'));
        const clients = result.current.filter(r => r.type === 'CLIENTE');
        expect(clients).toHaveLength(1);
        expect(clients[0].link).toContain('/clients');
    });

    it('trova un contratto per nome e genera anche risultato WBS quando wbs corrisponde', () => {
        const { result } = renderHook(() => useGlobalSearch('WBS-XYZ'));
        const wbs = result.current.filter(r => r.type === 'WBS');
        expect(wbs).toHaveLength(1);
        expect(wbs[0].link).toContain('/wbs-analysis');
    });

    it('trova un contratto per nome (senza match WBS)', () => {
        const { result } = renderHook(() => useGlobalSearch('Beta'));
        const contratti = result.current.filter(r => r.type === 'CONTRATTO');
        expect(contratti).toHaveLength(1);
        expect(contratti[0].title).toBe('Contratto Beta');
    });

    it('distingue COMPETENZA da CERTIFICAZIONE', () => {
        const { result: r1 } = renderHook(() => useGlobalSearch('React'));
        expect(r1.current.find(r => r.type === 'COMPETENZA')).toBeDefined();

        const { result: r2 } = renderHook(() => useGlobalSearch('AWS'));
        expect(r2.current.find(r => r.type === 'CERTIFICAZIONE')).toBeDefined();
    });

    it('trova un colloquio per nome del candidato', () => {
        const { result } = renderHook(() => useGlobalSearch('Anna'));
        const colloqui = result.current.filter(r => r.type === 'COLLOQUIO');
        expect(colloqui).toHaveLength(1);
        expect(colloqui[0].title).toBe('Anna Verdi');
    });

    it('restituisce link con editId per le risorse', () => {
        const { result } = renderHook(() => useGlobalSearch('Mario Rossi'));
        const risorsa = result.current.find(r => r.type === 'RISORSA');
        expect(risorsa?.link).toContain('editId=r1');
    });
});

describe('useGlobalSearch – dati vuoti', () => {
    it('restituisce array vuoto se tutti i contesti sono vuoti', () => {
        vi.mocked(useResourcesContext).mockReturnValue({ resources: [], roles: [] } as any);
        vi.mocked(useProjectsContext).mockReturnValue({ projects: [], clients: [], contracts: [] } as any);
        vi.mocked(useSkillsContext).mockReturnValue({ skills: [] } as any);
        vi.mocked(useHRContext).mockReturnValue({ resourceRequests: [], interviews: [] } as any);

        const { result } = renderHook(() => useGlobalSearch('test'));
        expect(result.current).toHaveLength(0);
    });
});
