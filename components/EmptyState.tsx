
/**
 * @file EmptyState.tsx
 * @description Stato "vuoto" riutilizzabile: icona, titolo, descrizione e azione opzionale.
 * Sostituisce le tabelle/liste vuote prive di contesto con un messaggio guidato.
 */

import React from 'react';

interface EmptyStateProps {
    /** Icona Material Symbols (es. "inbox", "search_off"). */
    icon?: string;
    /** Titolo breve dello stato vuoto. */
    title: string;
    /** Descrizione opzionale a supporto. */
    description?: React.ReactNode;
    /** Etichetta dell'azione primaria opzionale. */
    actionLabel?: string;
    /** Callback dell'azione primaria opzionale. */
    onAction?: () => void;
    /** Variante di spaziatura: `default` per pagine, `compact` per celle/card. */
    size?: 'default' | 'compact';
    className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
    icon = 'inbox',
    title,
    description,
    actionLabel,
    onAction,
    size = 'default',
    className,
}) => {
    const padding = size === 'compact' ? 'py-8 px-4' : 'py-14 px-6';
    const iconSize = size === 'compact' ? 'text-4xl' : 'text-5xl';

    return (
        <div
            className={['flex flex-col items-center justify-center text-center', padding, className]
                .filter(Boolean)
                .join(' ')}
        >
            <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-4">
                <span className={`material-symbols-outlined ${iconSize} text-on-surface-variant`}>{icon}</span>
            </div>
            <h3 className="text-base font-semibold text-on-surface">{title}</h3>
            {description && (
                <p className="mt-1 text-sm text-on-surface-variant max-w-sm">{description}</p>
            )}
            {actionLabel && onAction && (
                <button
                    type="button"
                    onClick={onAction}
                    className="mt-5 px-6 py-2 bg-primary text-on-primary font-medium rounded-full hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
};

export default EmptyState;
