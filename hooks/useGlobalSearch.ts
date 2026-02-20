
import { useMemo } from 'react';
import { useResourcesContext } from '../context/ResourcesContext';
import { useProjectsContext } from '../context/ProjectsContext';
import { useSkillsContext } from '../context/SkillsContext';
import { useHRContext } from '../context/HRContext';
import { normalizePath } from '../utils/paths';

export interface SearchResult {
    id: string;
    type: 'RISORSA' | 'PROGETTO' | 'CLIENTE' | 'CONTRATTO' | 'COMPETENZA' | 'CERTIFICAZIONE' | 'RICHIESTA' | 'COLLOQUIO' | 'WBS';
    title: string;
    subtitle: string;
    link: string;
    icon: string;
    score: number;
}

export const useGlobalSearch = (query: string) => {
    const { resources, roles } = useResourcesContext();
    const { projects, clients, contracts } = useProjectsContext();
    const { skills } = useSkillsContext();
    const { resourceRequests, interviews } = useHRContext();

    const results = useMemo<SearchResult[]>(() => {
        if (!query || query.length < 2) return [];

        const lowerQuery = query.toLowerCase();
        const matches: SearchResult[] = [];

        // Helper for scoring
        const calcScore = (text: string) => {
            if (!text) return 0;
            const lower = text.toLowerCase();
            if (lower === lowerQuery) return 100;
            if (lower.startsWith(lowerQuery)) return 80;
            if (lower.includes(lowerQuery)) return 50;
            return 0;
        };

        // 1. Resources (Match: name, email, location)
        resources.filter(r => !r.resigned).forEach(r => {
            const score = Math.max(calcScore(r.name), calcScore(r.email), calcScore(r.location));
            if (score > 0) {
                matches.push({
                    id: r.id!,
                    type: 'RISORSA',
                    title: r.name,
                    subtitle: `${r.email} • ${r.location}`,
                    link: `/resources?editId=${r.id}`,
                    icon: 'person',
                    score
                });
            }
        });

        // 2. Projects (Match: name, projectManager)
        projects.forEach(p => {
            const score = Math.max(calcScore(p.name), calcScore(p.projectManager || ''));
            if (score > 0) {
                matches.push({
                    id: p.id!,
                    type: 'PROGETTO',
                    title: p.name,
                    subtitle: `PM: ${p.projectManager || 'N/A'}`,
                    link: `/projects?editId=${p.id}`,
                    icon: 'folder',
                    score
                });
            }
        });

        // 3. Clients (Match: name, sector)
        clients.forEach(c => {
            const score = Math.max(calcScore(c.name), calcScore(c.sector));
            if (score > 0) {
                matches.push({
                    id: c.id!,
                    type: 'CLIENTE',
                    title: c.name,
                    subtitle: c.sector,
                    link: `/clients?editId=${c.id}`,
                    icon: 'domain',
                    score
                });
            }
        });

        // 4. Contracts (Match: name, cig, wbs)
        contracts.forEach(c => {
            const score = Math.max(calcScore(c.name), calcScore(c.cig), calcScore(c.wbs || ''));
            if (score > 0) {
                // WBS match directs to WBS Analysis, otherwise to Contracts
                const isWbsMatch = calcScore(c.wbs || '') > 0;
                
                if (isWbsMatch) {
                     matches.push({
                        id: c.id!,
                        type: 'WBS',
                        title: c.wbs || 'N/A',
                        subtitle: `Contratto: ${c.name}`,
                        link: `/wbs-analysis?search=${encodeURIComponent(c.wbs || '')}`,
                        icon: 'account_tree',
                        score
                    });
                }
                
                matches.push({
                    id: c.id!,
                    type: 'CONTRATTO',
                    title: c.name,
                    subtitle: `CIG: ${c.cig}`,
                    link: `/contracts?editId=${c.id}`,
                    icon: 'description',
                    score
                });
            }
        });

        // 5. Skills & Certifications (Match: name)
        skills.forEach(s => {
            const score = calcScore(s.name);
            if (score > 0) {
                if (s.isCertification) {
                    matches.push({
                        id: s.id!,
                        type: 'CERTIFICAZIONE',
                        title: s.name,
                        subtitle: s.macroCategory || 'Certificazione',
                        link: `/certifications?editId=${s.id}`,
                        icon: 'verified',
                        score
                    });
                } else {
                    matches.push({
                        id: s.id!,
                        type: 'COMPETENZA',
                        title: s.name,
                        subtitle: s.category || 'Skill',
                        link: `/skills?editId=${s.id}`,
                        icon: 'school',
                        score
                    });
                }
            }
        });

        // 6. Resource Requests (Match: project, role)
        resourceRequests.forEach(req => {
            const project = projects.find(p => p.id === req.projectId);
            const role = roles.find(r => r.id === req.roleId);
            const searchText = `${project?.name || ''} ${role?.name || ''}`;
            const score = calcScore(searchText);

            if (score > 0) {
                matches.push({
                    id: req.id!,
                    type: 'RICHIESTA',
                    title: `${role?.name} per ${project?.name}`,
                    subtitle: `Stato: ${req.status}`,
                    link: `/resource-requests?editId=${req.id}`,
                    icon: 'assignment_ind',
                    score
                });
            }
        });

        // 7. Interviews (Match: candidate name)
        interviews.forEach(i => {
            const fullName = `${i.candidateName} ${i.candidateSurname}`;
            const score = calcScore(fullName);
            if (score > 0) {
                matches.push({
                    id: i.id!,
                    type: 'COLLOQUIO',
                    title: fullName,
                    subtitle: `Data: ${i.interviewDate || 'N/A'}`,
                    link: `/interviews?editId=${i.id}`,
                    icon: 'groups',
                    score
                });
            }
        });

        return matches.sort((a, b) => b.score - a.score);

    }, [query, resources, projects, clients, contracts, skills, resourceRequests, interviews, roles]);

    return results;
};
