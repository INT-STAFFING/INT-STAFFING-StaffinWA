/**
 * @file FeedbackState.tsx
 * @description Componenti riutilizzabili per skeleton e stati vuoti nelle pagine principali.
 */

import React from 'react';

/**
 * Scheletro generico utilizzato per simulare blocchi di contenuto durante il caricamento.
 */
export const SkeletonBlock: React.FC<{ height?: string; width?: string; className?: string }> = ({
    height = 'h-4',
    width = 'w-full',
    className = '',
}) => (
    <div
        className={`rounded-xl bg-muted/60 dark:bg-dark-muted/60 backdrop-blur-[2px] ${height} ${width} ${className}`}
        aria-hidden="true"
    />
);

/**
 * Layout skeleton principale usato quando la pagina sta caricando i dati iniziali.
 */
export const PageSkeleton: React.FC = () => (
    <div className="space-y-8 animate-pulse" role="status" aria-live="polite">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <SkeletonBlock height="h-9" width="w-48" />
            <div className="flex-1 flex md:justify-end gap-3">
                <SkeletonBlock height="h-10" width="w-32" />
                <SkeletonBlock height="h-10" width="w-24" />
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SkeletonBlock height="h-40" className="shadow-soft" />
            <SkeletonBlock height="h-40" className="shadow-soft" />
        </div>
        <div className="space-y-4">
            <SkeletonBlock height="h-6" width="w-64" />
            <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, idx) => (
                    <SkeletonBlock key={idx} height="h-14" className="shadow-soft" />
                ))}
            </div>
        </div>
    </div>
);

interface EmptyStateProps {
    /** Titolo principale da mostrare nello stato vuoto. */
    title: string;
    /** Descrizione aggiuntiva per guidare l'utente. */
    description: string;
    /** Azione opzionale da renderizzare sotto forma di pulsanti o link. */
    action?: React.ReactNode;
    /** Icona opzionale mostrata sopra il titolo. */
    icon?: React.ReactNode;
}

/**
 * Stato vuoto riutilizzabile per le liste principali.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, action, icon }) => (
    <div className="surface-card text-center py-16 px-6 mx-auto max-w-3xl space-y-4">
        <div className="flex flex-col items-center justify-center gap-4">
            {icon && <div className="h-16 w-16 text-primary/80 flex items-center justify-center">{icon}</div>}
            <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-foreground dark:text-dark-foreground">{title}</h2>
                <p className="text-muted-foreground dark:text-dark-muted-foreground">
                    {description}
                </p>
            </div>
            {action && <div className="flex flex-wrap items-center justify-center gap-3">{action}</div>}
        </div>
    </div>
);

export default EmptyState;
