/**
 * @file hooks/useComputedSkills.ts
 * @description Hook per il calcolo delle competenze computate di una risorsa.
 * Utilizza direttamente SkillsContext e ProjectsContext per evitare dipendenza dal contesto monolitico.
 */

import { useCallback } from 'react';
import { ComputedSkill } from '../types';
import { useSkillsContext } from '../context/SkillsContext';
import { useProjectsContext } from '../context/ProjectsContext';

/**
 * Restituisce la funzione getResourceComputedSkills calcolata dai contesti di dominio.
 * Le pagine che usano questo hook si re-renderizzano solo quando cambiano skills o assignments,
 * non quando cambiano altri domini (HR, UI config, lookup, ecc.).
 */
export const useGetResourceComputedSkills = (): ((resourceId: string) => ComputedSkill[]) => {
    const { resourceSkills, projectSkills, skills, skillThresholds } = useSkillsContext();
    const { assignments } = useProjectsContext();

    return useCallback((resourceId: string): ComputedSkill[] => {
        const manual = resourceSkills.filter(rs => rs.resourceId === resourceId);
        const resourceAssignments = assignments.filter(a => a.resourceId === resourceId);
        const assignedProjectIds = new Set(resourceAssignments.map(a => a.projectId));
        const projectOccurrences = new Map<string, number>();
        projectSkills.forEach(ps => {
            if (assignedProjectIds.has(ps.projectId)) {
                projectOccurrences.set(ps.skillId, (projectOccurrences.get(ps.skillId) || 0) + 1);
            }
        });
        return skills.map(skill => {
            const manualEntry = manual.find(m => m.skillId === skill.id);
            const pCount = projectOccurrences.get(skill.id!) || 0;
            const inferredDays = pCount * 10;
            let inferredLevel = 1;
            if (inferredDays >= skillThresholds.EXPERT) inferredLevel = 5;
            else if (inferredDays >= skillThresholds.SENIOR) inferredLevel = 4;
            else if (inferredDays >= skillThresholds.MIDDLE) inferredLevel = 3;
            else if (inferredDays >= skillThresholds.JUNIOR) inferredLevel = 2;
            return { skill, manualDetails: manualEntry, inferredDays, inferredLevel, projectCount: pCount };
        }).filter(cs => cs.manualDetails || cs.projectCount > 0);
    }, [resourceSkills, assignments, projectSkills, skills, skillThresholds]);
};
