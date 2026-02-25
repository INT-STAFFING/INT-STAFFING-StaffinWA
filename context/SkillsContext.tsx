/**
 * @file SkillsContext.tsx
 * @description Contesto per la gestione delle competenze, categorie di competenze e mappature risorsa/progetto.
 * Gestisce: skills, skillCategories, skillMacroCategories, resourceSkills, projectSkills, skillThresholds.
 * Nota: getResourceComputedSkills è nel coordinator AppContext perché richiede dati cross-domain (assignments).
 */

import React, { createContext, useState, useContext, useCallback, useMemo, ReactNode } from 'react';
import {
    Skill, SkillCategory, SkillMacroCategory, ResourceSkill, ProjectSkill, SkillThresholds
} from '../types';
import { useToast } from './ToastContext';
import { apiFetch } from '../services/apiClient';

// --- Tipi del contesto ---

export interface SkillsInitData {
    skills?: Skill[];
    skillCategories?: SkillCategory[];
    skillMacroCategories?: SkillMacroCategory[];
    resourceSkills?: ResourceSkill[];
    projectSkills?: ProjectSkill[];
    skillThresholds?: Partial<SkillThresholds>;
}

export interface SkillsContextValue {
    // Stato
    skills: Skill[];
    skillCategories: SkillCategory[];
    skillMacroCategories: SkillMacroCategory[];
    resourceSkills: ResourceSkill[];
    projectSkills: ProjectSkill[];
    skillThresholds: SkillThresholds;
    // CRUD Competenze (deleteSkill gestisce cascade interna a questo contesto)
    addSkill: (skill: Omit<Skill, 'id'>) => Promise<void>;
    updateSkill: (skill: Skill) => Promise<void>;
    deleteSkill: (id: string) => Promise<void>;
    // Resource Skills
    addResourceSkill: (rs: ResourceSkill) => Promise<void>;
    deleteResourceSkill: (resourceId: string, skillId: string) => Promise<void>;
    // Project Skills
    addProjectSkill: (ps: ProjectSkill) => Promise<void>;
    deleteProjectSkill: (projectId: string, skillId: string) => Promise<void>;
    // CRUD Categorie
    addSkillCategory: (cat: Omit<SkillCategory, 'id'>) => Promise<void>;
    updateSkillCategory: (cat: SkillCategory) => Promise<void>;
    deleteSkillCategory: (id: string) => Promise<void>;
    // CRUD Macro Categorie
    addSkillMacro: (macro: { name: string }) => Promise<void>;
    updateSkillMacro: (id: string, name: string) => Promise<void>;
    deleteSkillMacro: (id: string) => Promise<void>;
    // Soglie
    updateSkillThresholds: (thresholds: SkillThresholds) => Promise<void>;
    // Funzioni interne per il coordinator (cascade)
    initialize: (data: SkillsInitData) => void;
    _removeResourceSkillsByResource: (resourceId: string) => void;
    _removeProjectSkillsByProject: (projectId: string) => void;
}

const SkillsContext = createContext<SkillsContextValue | undefined>(undefined);

const DEFAULT_SKILL_THRESHOLDS: SkillThresholds = {
    NOVICE: 0, JUNIOR: 60, MIDDLE: 150, SENIOR: 350, EXPERT: 700
};

export const SkillsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { addToast } = useToast();

    const [skills, setSkills] = useState<Skill[]>([]);
    const [skillCategories, setSkillCategories] = useState<SkillCategory[]>([]);
    const [skillMacroCategories, setSkillMacroCategories] = useState<SkillMacroCategory[]>([]);
    const [resourceSkills, setResourceSkills] = useState<ResourceSkill[]>([]);
    const [projectSkills, setProjectSkills] = useState<ProjectSkill[]>([]);
    const [skillThresholds, setSkillThresholds] = useState<SkillThresholds>(DEFAULT_SKILL_THRESHOLDS);

    const initialize = useCallback((data: SkillsInitData) => {
        if (data.skills !== undefined) setSkills(data.skills);
        if (data.skillCategories !== undefined) setSkillCategories(data.skillCategories);
        if (data.skillMacroCategories !== undefined) setSkillMacroCategories(data.skillMacroCategories);
        if (data.resourceSkills !== undefined) setResourceSkills(data.resourceSkills);
        if (data.projectSkills !== undefined) setProjectSkills(data.projectSkills);
        if (data.skillThresholds !== undefined) {
            setSkillThresholds(prev => ({ ...prev, ...data.skillThresholds }));
        }
    }, []);

    const _removeResourceSkillsByResource = useCallback((resourceId: string) => {
        setResourceSkills(prev => prev.filter(rs => rs.resourceId !== resourceId));
    }, []);

    const _removeProjectSkillsByProject = useCallback((projectId: string) => {
        setProjectSkills(prev => prev.filter(ps => ps.projectId !== projectId));
    }, []);

    // --- CRUD Competenze ---
    const addSkill = useCallback(async (skill: Omit<Skill, 'id'>): Promise<void> => {
        try {
            const newSkill = await apiFetch<Skill>('/api/resources?entity=skills', {
                method: 'POST', body: JSON.stringify(skill)
            });
            setSkills(prev => [...prev, newSkill]);
            addToast('Competenza aggiunta con successo', 'success');
        } catch (e: any) {
            addToast(e.message || 'Errore durante l\'aggiunta della competenza.', 'error');
            throw e;
        }
    }, [addToast]);

    const updateSkill = useCallback(async (skill: Skill): Promise<void> => {
        try {
            const updated = await apiFetch<Skill>(`/api/resources?entity=skills&id=${skill.id}`, {
                method: 'PUT', body: JSON.stringify(skill)
            });
            setSkills(prev => prev.map(s => s.id === skill.id ? updated : s));
            addToast('Competenza aggiornata', 'success');
        } catch (e: any) {
            addToast(e.message || 'Errore durante l\'aggiornamento della competenza.', 'error');
            throw e;
        }
    }, [addToast]);

    const deleteSkill = useCallback(async (id: string): Promise<void> => {
        try {
            await apiFetch(`/api/resources?entity=skills&id=${id}`, { method: 'DELETE' });
            setSkills(prev => prev.filter(s => s.id !== id));
            // Cascade interna: rimuove skill anche da resourceSkills e projectSkills
            setResourceSkills(prev => prev.filter(rs => rs.skillId !== id));
            setProjectSkills(prev => prev.filter(ps => ps.skillId !== id));
        } catch (e: any) {
            addToast(e.message || 'Errore durante l\'eliminazione della competenza.', 'error');
            throw e;
        }
    }, [addToast]);

    // --- Resource Skills ---
    const addResourceSkill = useCallback(async (rs: ResourceSkill): Promise<void> => {
        try {
            const savedSkill = await apiFetch<ResourceSkill>('/api/resources?entity=resource_skills', {
                method: 'POST', body: JSON.stringify(rs)
            });
            setResourceSkills(prev => [
                ...prev.filter(i => !(i.resourceId === rs.resourceId && i.skillId === rs.skillId)),
                savedSkill
            ]);
        } catch (e: any) {
            addToast(e.message || 'Errore durante l\'aggiunta della competenza alla risorsa.', 'error');
            throw e;
        }
    }, [addToast]);

    const deleteResourceSkill = useCallback(async (resourceId: string, skillId: string): Promise<void> => {
        try {
            await apiFetch(`/api/resources?entity=resource_skills&resourceId=${resourceId}&skillId=${skillId}`, {
                method: 'DELETE'
            });
            setResourceSkills(prev => prev.filter(rs => !(rs.resourceId === resourceId && rs.skillId === skillId)));
        } catch (e: any) {
            addToast(e.message || 'Errore durante l\'eliminazione della competenza.', 'error');
            throw e;
        }
    }, [addToast]);

    // --- Project Skills ---
    const addProjectSkill = useCallback(async (ps: ProjectSkill): Promise<void> => {
        try {
            const savedPs = await apiFetch<ProjectSkill>('/api/resources?entity=project_skills', {
                method: 'POST', body: JSON.stringify(ps)
            });
            setProjectSkills(prev => [...prev, savedPs]);
        } catch (e: any) {
            addToast(e.message || 'Errore durante l\'aggiunta della competenza al progetto.', 'error');
            throw e;
        }
    }, [addToast]);

    const deleteProjectSkill = useCallback(async (projectId: string, skillId: string): Promise<void> => {
        try {
            await apiFetch(`/api/resources?entity=project_skills&projectId=${projectId}&skillId=${skillId}`, {
                method: 'DELETE'
            });
            setProjectSkills(prev => prev.filter(ps => !(ps.projectId === projectId && ps.skillId === skillId)));
        } catch (e: any) {
            addToast(e.message || 'Errore durante l\'eliminazione della competenza dal progetto.', 'error');
            throw e;
        }
    }, [addToast]);

    // --- CRUD Categorie ---
    const addSkillCategory = useCallback(async (cat: Omit<SkillCategory, 'id'>): Promise<void> => {
        try {
            const created = await apiFetch<SkillCategory>('/api/resources?entity=skill_categories', {
                method: 'POST', body: JSON.stringify(cat)
            });
            setSkillCategories(prev => [...prev, created]);
            addToast('Categoria aggiunta con successo', 'success');
        } catch (e: any) {
            addToast(e.message || 'Errore durante l\'aggiunta della categoria.', 'error');
            throw e;
        }
    }, [addToast]);

    const updateSkillCategory = useCallback(async (cat: SkillCategory): Promise<void> => {
        try {
            const updated = await apiFetch<SkillCategory>(
                `/api/resources?entity=skill_categories&id=${cat.id}`,
                { method: 'PUT', body: JSON.stringify(cat) }
            );
            setSkillCategories(prev => prev.map(c => c.id === cat.id ? updated : c));
            addToast('Categoria aggiornata', 'success');
        } catch (e: any) {
            addToast(e.message || 'Errore durante l\'aggiornamento della categoria.', 'error');
            throw e;
        }
    }, [addToast]);

    const deleteSkillCategory = useCallback(async (id: string): Promise<void> => {
        try {
            await apiFetch(`/api/resources?entity=skill_categories&id=${id}`, { method: 'DELETE' });
            setSkillCategories(prev => prev.filter(c => c.id !== id));
        } catch (e: any) {
            addToast(e.message || 'Errore durante l\'eliminazione della categoria.', 'error');
            throw e;
        }
    }, [addToast]);

    // --- CRUD Macro Categorie ---
    const addSkillMacro = useCallback(async (macro: { name: string }): Promise<void> => {
        try {
            const newMacro = await apiFetch<SkillMacroCategory>('/api/resources?entity=skill_macro_categories', {
                method: 'POST', body: JSON.stringify(macro)
            });
            setSkillMacroCategories(prev => [...prev, newMacro]);
            addToast('Macro categoria aggiunta con successo', 'success');
        } catch (e: any) {
            addToast(e.message || 'Errore durante l\'aggiunta della macro categoria.', 'error');
            throw e;
        }
    }, [addToast]);

    const updateSkillMacro = useCallback(async (id: string, name: string): Promise<void> => {
        try {
            const updated = await apiFetch<SkillMacroCategory>(
                `/api/resources?entity=skill_macro_categories&id=${id}`,
                { method: 'PUT', body: JSON.stringify({ name }) }
            );
            setSkillMacroCategories(prev => prev.map(m => m.id === id ? updated : m));
            addToast('Macro categoria aggiornata', 'success');
        } catch (e: any) {
            addToast(e.message || 'Errore durante l\'aggiornamento della macro categoria.', 'error');
            throw e;
        }
    }, [addToast]);

    const deleteSkillMacro = useCallback(async (id: string): Promise<void> => {
        try {
            await apiFetch(`/api/resources?entity=skill_macro_categories&id=${id}`, { method: 'DELETE' });
            setSkillMacroCategories(prev => prev.filter(m => m.id !== id));
        } catch (e: any) {
            addToast(e.message || 'Errore durante l\'eliminazione della macro categoria.', 'error');
            throw e;
        }
    }, [addToast]);

    // --- Soglie ---
    const updateSkillThresholds = useCallback(async (thresholds: SkillThresholds): Promise<void> => {
        try {
            const updates = Object.entries(thresholds).map(([key, value]) => ({
                key: `skill_threshold.${key}`, value: String(value)
            }));
            await apiFetch('/api/resources?entity=app-config-batch', {
                method: 'POST', body: JSON.stringify({ updates })
            });
            setSkillThresholds(thresholds);
        } catch (e) { addToast('Errore durante l\'aggiornamento delle soglie competenze.', 'error'); }
    }, [addToast]);

    const value = useMemo<SkillsContextValue>(() => ({
        skills, skillCategories, skillMacroCategories, resourceSkills, projectSkills, skillThresholds,
        addSkill, updateSkill, deleteSkill,
        addResourceSkill, deleteResourceSkill,
        addProjectSkill, deleteProjectSkill,
        addSkillCategory, updateSkillCategory, deleteSkillCategory,
        addSkillMacro, updateSkillMacro, deleteSkillMacro,
        updateSkillThresholds,
        initialize, _removeResourceSkillsByResource, _removeProjectSkillsByProject,
    }), [
        skills, skillCategories, skillMacroCategories, resourceSkills, projectSkills, skillThresholds,
        addSkill, updateSkill, deleteSkill,
        addResourceSkill, deleteResourceSkill,
        addProjectSkill, deleteProjectSkill,
        addSkillCategory, updateSkillCategory, deleteSkillCategory,
        addSkillMacro, updateSkillMacro, deleteSkillMacro,
        updateSkillThresholds,
        initialize, _removeResourceSkillsByResource, _removeProjectSkillsByProject,
    ]);

    return <SkillsContext.Provider value={value}>{children}</SkillsContext.Provider>;
};

export const useSkillsContext = (): SkillsContextValue => {
    const ctx = useContext(SkillsContext);
    if (!ctx) throw new Error('useSkillsContext must be used within SkillsProvider');
    return ctx;
};
