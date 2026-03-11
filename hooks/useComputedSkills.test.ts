/* @vitest-environment jsdom */
/**
 * @file hooks/useComputedSkills.test.ts
 * @description Test unitari per useGetResourceComputedSkills.
 * Verifica il calcolo delle competenze computate: skill manuali, skill inferite
 * dai progetti e calcolo del livello inferito tramite soglie.
 */
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGetResourceComputedSkills } from './useComputedSkills';
import { DEFAULT_SKILL_LEVEL_THRESHOLDS } from '../types';

// ---------------------------------------------------------------------------
// Mock dei context di dominio
// ---------------------------------------------------------------------------
vi.mock('../context/SkillsContext');
vi.mock('../context/ProjectsContext');

import { useSkillsContext } from '../context/SkillsContext';
import { useProjectsContext } from '../context/ProjectsContext';

const skill1 = { id: 'sk1', name: 'React', isCertification: false };
const skill2 = { id: 'sk2', name: 'TypeScript', isCertification: false };
const skill3 = { id: 'sk3', name: 'AWS', isCertification: true };

const setupContexts = ({
    resourceSkills = [],
    projectSkills = [],
    skills = [skill1, skill2, skill3],
    skillThresholds = DEFAULT_SKILL_LEVEL_THRESHOLDS,
    assignments = [],
}: {
    resourceSkills?: any[];
    projectSkills?: any[];
    skills?: any[];
    skillThresholds?: any;
    assignments?: any[];
} = {}) => {
    vi.mocked(useSkillsContext).mockReturnValue({ resourceSkills, projectSkills, skills, skillThresholds } as any);
    vi.mocked(useProjectsContext).mockReturnValue({ assignments } as any);
};

beforeEach(() => {
    setupContexts();
});

describe('useGetResourceComputedSkills – casi base', () => {
    it('restituisce array vuoto se la risorsa non ha skill né assignment', () => {
        const { result } = renderHook(() => useGetResourceComputedSkills());
        const skills = result.current('r1');
        expect(skills).toHaveLength(0);
    });

    it('include le skill manuali della risorsa', () => {
        setupContexts({
            resourceSkills: [{ resourceId: 'r1', skillId: 'sk1', level: 3 }],
        });
        const { result } = renderHook(() => useGetResourceComputedSkills());
        const computed = result.current('r1');
        expect(computed).toHaveLength(1);
        expect(computed[0].skill.id).toBe('sk1');
        expect(computed[0].manualDetails?.level).toBe(3);
    });

    it('non include skill di un\'altra risorsa', () => {
        setupContexts({
            resourceSkills: [{ resourceId: 'r2', skillId: 'sk1', level: 3 }],
        });
        const { result } = renderHook(() => useGetResourceComputedSkills());
        expect(result.current('r1')).toHaveLength(0);
    });

    it('include skill inferite dai progetti assegnati', () => {
        setupContexts({
            assignments: [{ id: 'a1', resourceId: 'r1', projectId: 'p1' }],
            projectSkills: [{ projectId: 'p1', skillId: 'sk1' }],
        });
        const { result } = renderHook(() => useGetResourceComputedSkills());
        const computed = result.current('r1');
        expect(computed).toHaveLength(1);
        expect(computed[0].skill.id).toBe('sk1');
        expect(computed[0].projectCount).toBe(1);
        expect(computed[0].inferredDays).toBe(10);
    });

    it('non include skill di progetti non assegnati alla risorsa', () => {
        setupContexts({
            assignments: [{ id: 'a1', resourceId: 'r1', projectId: 'p1' }],
            projectSkills: [{ projectId: 'p2', skillId: 'sk2' }], // p2 non assegnato
        });
        const { result } = renderHook(() => useGetResourceComputedSkills());
        expect(result.current('r1')).toHaveLength(0);
    });

    it('conteggia correttamente più progetti con la stessa skill', () => {
        setupContexts({
            assignments: [
                { id: 'a1', resourceId: 'r1', projectId: 'p1' },
                { id: 'a2', resourceId: 'r1', projectId: 'p2' },
            ],
            projectSkills: [
                { projectId: 'p1', skillId: 'sk1' },
                { projectId: 'p2', skillId: 'sk1' },
            ],
        });
        const { result } = renderHook(() => useGetResourceComputedSkills());
        const computed = result.current('r1');
        expect(computed[0].projectCount).toBe(2);
        expect(computed[0].inferredDays).toBe(20);
    });
});

describe('useGetResourceComputedSkills – calcolo livello inferito', () => {
    // DEFAULT_SKILL_LEVEL_THRESHOLDS: NOVICE=0, JUNIOR=60, MIDDLE=150, SENIOR=350, EXPERT=700
    // inferredDays = projectCount * 10

    it('livello 1 (NOVICE) per 0 giorni inferiti', () => {
        setupContexts({
            resourceSkills: [{ resourceId: 'r1', skillId: 'sk1', level: 2 }],
        });
        const { result } = renderHook(() => useGetResourceComputedSkills());
        const cs = result.current('r1')[0];
        // Nessun progetto → inferredDays = 0 → livello 1
        expect(cs.inferredLevel).toBe(1);
    });

    it('livello 2 (JUNIOR) per >= 60 giorni inferiti (6 progetti)', () => {
        const numProjects = 6; // 6 * 10 = 60 giorni
        setupContexts({
            assignments: Array.from({ length: numProjects }, (_, i) => ({ id: `a${i}`, resourceId: 'r1', projectId: `p${i}` })),
            projectSkills: Array.from({ length: numProjects }, (_, i) => ({ projectId: `p${i}`, skillId: 'sk1' })),
        });
        const { result } = renderHook(() => useGetResourceComputedSkills());
        expect(result.current('r1')[0].inferredLevel).toBe(2);
    });

    it('livello 3 (MIDDLE) per >= 150 giorni inferiti (15 progetti)', () => {
        const numProjects = 15;
        setupContexts({
            assignments: Array.from({ length: numProjects }, (_, i) => ({ id: `a${i}`, resourceId: 'r1', projectId: `p${i}` })),
            projectSkills: Array.from({ length: numProjects }, (_, i) => ({ projectId: `p${i}`, skillId: 'sk1' })),
        });
        const { result } = renderHook(() => useGetResourceComputedSkills());
        expect(result.current('r1')[0].inferredLevel).toBe(3);
    });

    it('livello 5 (EXPERT) per >= 700 giorni inferiti (70 progetti)', () => {
        const numProjects = 70;
        setupContexts({
            assignments: Array.from({ length: numProjects }, (_, i) => ({ id: `a${i}`, resourceId: 'r1', projectId: `p${i}` })),
            projectSkills: Array.from({ length: numProjects }, (_, i) => ({ projectId: `p${i}`, skillId: 'sk1' })),
        });
        const { result } = renderHook(() => useGetResourceComputedSkills());
        expect(result.current('r1')[0].inferredLevel).toBe(5);
    });
});

describe('useGetResourceComputedSkills – unione skill manuali e inferite', () => {
    it('una skill appare una volta sola se presente sia manualmente che via progetto', () => {
        setupContexts({
            resourceSkills: [{ resourceId: 'r1', skillId: 'sk1', level: 4 }],
            assignments: [{ id: 'a1', resourceId: 'r1', projectId: 'p1' }],
            projectSkills: [{ projectId: 'p1', skillId: 'sk1' }],
        });
        const { result } = renderHook(() => useGetResourceComputedSkills());
        const computed = result.current('r1').filter(cs => cs.skill.id === 'sk1');
        expect(computed).toHaveLength(1);
        expect(computed[0].manualDetails?.level).toBe(4); // ha anche dati manuali
        expect(computed[0].projectCount).toBe(1);          // e dati inferiti
    });

    it('il risultato è stabile (identità referenziale del callback invariata per stessi input)', () => {
        setupContexts({ resourceSkills: [{ resourceId: 'r1', skillId: 'sk1', level: 2 }] });
        const { result, rerender } = renderHook(() => useGetResourceComputedSkills());
        const firstFn = result.current;
        rerender();
        expect(result.current).toBe(firstFn); // useCallback → stessa referenza
    });
});
