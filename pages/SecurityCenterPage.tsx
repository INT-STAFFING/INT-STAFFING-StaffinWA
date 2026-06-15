
import React, { useState } from 'react';
import { IdentityPillar } from './security/IdentityPillar';
import { RBACPillar } from './security/RBACPillar';
import { EntityVisibilityPillar } from './security/EntityVisibilityPillar';
import { NavigationPillar } from './security/NavigationPillar';
import { AuditPillar } from './security/AuditPillar';
import { HierarchyPillar } from './security/HierarchyPillar';

// --- PAGINA PRINCIPALE SECURITY CENTER ---
const SecurityCenterPage: React.FC = () => {
    const [activePillar, setActivePillar] = useState<'id' | 'rbac' | 'entity' | 'nav' | 'audit' | 'hierarchy'>('audit');

    const pillars = [
        { id: 'audit',     label: 'Security Audit',         icon: 'policy',           desc: 'Timeline Attività' },
        { id: 'rbac',      label: 'Access Control Matrix',  icon: 'security',         desc: 'Rotte e Ruoli' },
        { id: 'entity',    label: 'Entity Visibility',      icon: 'visibility',       desc: 'Visibilità Entità' },
        { id: 'id',        label: 'Identity & Users',       icon: 'badge',            desc: 'Whitelist Utenti' },
        { id: 'hierarchy', label: 'Gerarchia',              icon: 'device_hub',       desc: 'Organigramma' },
        { id: 'nav',       label: 'App Architecture',       icon: 'account_tree',     desc: 'Menu e Landing' },
    ];

    return (
        <div className="flex h-full flex-col lg:flex-row gap-8">
            {/* Sidebar di Navigazione Interna */}
            <div className="lg:w-80 flex-shrink-0 space-y-3">
                <div className="p-2 mb-6">
                    <h1 className="text-3xl font-black text-primary tracking-tighter italic">SECURITY<span className="text-on-surface font-normal">CENTER</span></h1>
                    <p className="text-xs font-bold text-on-surface-variant opacity-60 uppercase tracking-widest mt-1">Control Panel v2.1</p>
                </div>

                {pillars.map(p => (
                    <button
                        key={p.id}
                        onClick={() => setActivePillar(p.id as any)}
                        className={`w-full flex items-center gap-4 px-6 py-5 rounded-[2rem] font-bold text-left transition-all duration-300 group ${
                            activePillar === p.id
                                ? 'bg-primary text-on-primary shadow-xl scale-105'
                                : 'bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant'
                        }`}
                    >
                        <span className={`material-symbols-outlined text-2xl ${activePillar === p.id ? 'text-on-primary' : 'text-primary'}`}>
                            {p.icon}
                        </span>
                        <div>
                            <p className="text-sm leading-none mb-1">{p.label}</p>
                            <p className={`text-[10px] font-normal uppercase tracking-widest opacity-60 ${activePillar === p.id ? 'text-on-primary' : ''}`}>
                                {p.desc}
                            </p>
                        </div>
                    </button>
                ))}

                <div className="mt-12 p-6 bg-error-container/10 border border-error/10 rounded-[2.5rem] relative overflow-hidden">
                    <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-7xl text-error/5 rotate-12">lock_open</span>
                    <p className="text-[10px] font-black text-error uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-error animate-pulse"></span> Safety Lock Active
                    </p>
                    <p className="text-[10px] text-on-surface-variant leading-relaxed font-bold">
                        Accesso permanente garantito al ruolo ADMIN. Le modifiche ai permessi critici richiedono ricaricamento sessione.
                    </p>
                </div>
            </div>

            {/* Contenitore Dinamico Contenuto */}
            <div className="flex-grow bg-surface rounded-[3rem] shadow-2xl border border-outline-variant overflow-hidden flex flex-col mb-20 lg:mb-0">
                <div className="p-10 flex-grow overflow-y-auto animate-fade-in custom-scrollbar">
                    {activePillar === 'id' && <IdentityPillar />}
                    {activePillar === 'rbac' && <RBACPillar />}
                    {activePillar === 'entity' && <EntityVisibilityPillar />}
                    {activePillar === 'nav' && <NavigationPillar />}
                    {activePillar === 'audit' && <AuditPillar />}
                    {activePillar === 'hierarchy' && <HierarchyPillar />}
                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--color-outline-variant); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--color-primary); }
            `}</style>
        </div>
    );
};

export default SecurityCenterPage;
