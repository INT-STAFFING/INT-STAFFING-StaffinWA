import React, { useState, useEffect, useMemo } from 'react';
import { useUIConfigContext } from '../../context/UIConfigContext';
import { useToast } from '../../context/ToastContext';
import { UserRole } from '../../types';
import { routesManifest } from '../../routes';

// --- PILASTRO 5: NAVIGAZIONE E ARCHITETTURA ---
export const NavigationPillar: React.FC = () => {
    const { sidebarConfig, updateSidebarConfig, roleHomePages, updateRoleHomePages, sidebarSections } = useUIConfigContext();
    const { addToast } = useToast();
    const [localSidebar, setLocalSidebar] = useState(sidebarConfig);

    // Sync local state with context when context updates (e.g. initial load)
    // AND MERGE WITH ROUTESMANIFEST to ensure new pages are visible
    useEffect(() => {
        const currentPaths = new Set(sidebarConfig.map(item => item.path));

        // Find routes in manifest that are missing from the stored config
        const newItems = routesManifest
            .filter(r => r.showInSidebar && !currentPaths.has(r.path))
            .map(r => ({
                path: r.path,
                label: r.label,
                icon: r.icon,
                section: r.section || 'Altro',
                requiredPermission: r.requiredPermission
            }));

        if (newItems.length > 0) {
            setLocalSidebar([...sidebarConfig, ...newItems]);
        } else {
            setLocalSidebar(sidebarConfig);
        }
    }, [sidebarConfig]);

    const ROLES: UserRole[] = [
        'SIMPLE', 'SIMPLE_EXT',
        'MANAGER', 'MANAGER_EXT',
        'SENIOR MANAGER', 'SENIOR MANAGER_EXT',
        'ASSOCIATE DIRECTOR', 'ASSOCIATE DIRECTOR_EXT',
        'MANAGING DIRECTOR', 'MANAGING DIRECTOR_EXT',
        'ADMIN',
    ];
    const availablePages = useMemo(() =>
        routesManifest.filter(r => r.requiresAuth !== false).sort((a,b) => a.label.localeCompare(b.label)),
    []);

    const handleSaveMenu = async () => {
        await updateSidebarConfig(localSidebar);
        addToast('Struttura menu aggiornata', 'success');
    };

    const handleMove = (index: number, direction: -1 | 1) => {
        if ((direction === -1 && index === 0) || (direction === 1 && index === localSidebar.length - 1)) return;

        const newItems = [...localSidebar];
        const temp = newItems[index];
        newItems[index] = newItems[index + direction];
        newItems[index + direction] = temp;
        setLocalSidebar(newItems);
    };

    const handleSectionChange = (index: number, newSection: string) => {
        const newItems = [...localSidebar];
        newItems[index] = { ...newItems[index], section: newSection };
        setLocalSidebar(newItems);
    };

    return (
        <div className="space-y-10">
            <section>
                <div className="mb-6">
                    <h3 className="text-2xl font-bold text-on-surface">Pagine di Atterraggio</h3>
                    <p className="text-sm text-on-surface-variant">Definisci la Home Page predefinita per ogni ruolo utente.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {ROLES.map(role => (
                        <div key={role} className="bg-surface-container-low p-5 rounded-2xl border border-outline-variant shadow-sm">
                            <label className="block text-[10px] font-bold text-primary mb-3 uppercase tracking-wide">Home per {role}</label>
                            <select
                                value={roleHomePages[role] || '/staffing'}
                                onChange={e => updateRoleHomePages({...roleHomePages, [role]: e.target.value})}
                                className="form-select text-sm font-bold bg-transparent border-primary/20"
                            >
                                {availablePages.map(p => <option key={p.path} value={p.path}>{p.label}</option>)}
                            </select>
                        </div>
                    ))}
                </div>
            </section>

            <section>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div>
                        <h3 className="text-2xl font-bold text-on-surface">Struttura Sidebar</h3>
                        <p className="text-sm text-on-surface-variant">Ordina le voci e assegna le categorie per il menu principale.</p>
                    </div>
                    <button onClick={handleSaveMenu} className="w-full sm:w-auto px-6 py-2 bg-primary text-on-primary rounded-full font-bold shadow-lg">Salva Struttura</button>
                </div>
                <div className="bg-surface-container-lowest border border-outline-variant rounded-[2rem] shadow-inner max-h-[600px] overflow-y-auto">
                    {localSidebar.map((item, idx) => (
                        <div key={item.path} className="flex items-center gap-4 p-3 border-b border-outline-variant hover:bg-surface-container-low transition-colors group">
                            {/* Reorder Controls */}
                            <div className="flex flex-col gap-1">
                                <button
                                    onClick={() => handleMove(idx, -1)}
                                    disabled={idx === 0}
                                    className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-surface-container disabled:opacity-20 text-on-surface-variant"
                                >
                                    <span className="material-symbols-outlined text-sm">keyboard_arrow_up</span>
                                </button>
                                <button
                                    onClick={() => handleMove(idx, 1)}
                                    disabled={idx === localSidebar.length - 1}
                                    className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-surface-container disabled:opacity-20 text-on-surface-variant"
                                >
                                    <span className="material-symbols-outlined text-sm">keyboard_arrow_down</span>
                                </button>
                            </div>

                            {/* Icon */}
                            <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface-variant shrink-0">
                                <span className="material-symbols-outlined">{item.icon}</span>
                            </div>

                            {/* Main Info */}
                            <div className="flex-grow grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                                {/* Label Input */}
                                <div className="md:col-span-5">
                                     <label className="text-[10px] font-bold text-primary uppercase tracking-wide block mb-1">Etichetta</label>
                                     <input
                                        type="text"
                                        value={item.label}
                                        onChange={e => {
                                            const next = [...localSidebar];
                                            next[idx] = { ...item, label: e.target.value };
                                            setLocalSidebar(next);
                                        }}
                                        className="w-full bg-transparent font-bold text-on-surface border-b border-transparent focus:border-primary focus:ring-0 p-0 text-sm"
                                    />
                                </div>

                                {/* Section Selector */}
                                <div className="md:col-span-4">
                                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide block mb-1">Sezione</label>
                                    <select
                                        value={item.section || ''}
                                        onChange={(e) => handleSectionChange(idx, e.target.value)}
                                        className="w-full bg-surface-container-high text-xs rounded-lg border-none focus:ring-1 focus:ring-primary py-1.5 px-2 font-medium"
                                    >
                                        {sidebarSections.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>

                                {/* Path Info (Read-only) */}
                                <div className="md:col-span-3 flex items-center gap-1 text-[10px] font-mono text-on-surface-variant/70 overflow-hidden">
                                    <span className="material-symbols-outlined text-[10px]">link</span>
                                    <span className="truncate" title={item.path}>{item.path}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};
