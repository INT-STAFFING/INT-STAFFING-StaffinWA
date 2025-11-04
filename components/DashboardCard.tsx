/**
 * @file DashboardCard.tsx
 * @description Componente riutilizzabile per le card della dashboard. Supporta varianti per KPI e per contenitori generici.
 */
import React from 'react';
import Icon from './Icon';

type CardVariant = 'standard' | 'warning';

interface DashboardCardProps {
    /** @property {string} [title] - Il titolo della card. */
    title?: string;
    /** @property {string | number} [value] - Il valore principale da mostrare (per card KPI). */
    value?: string | number;
    /** @property {string} [icon] - Il nome di un'icona Lucide da mostrare (per card KPI). */
    icon?: string;
    /** @property {CardVariant} [variant] - La variante di colore ('standard' o 'warning'). */
    variant?: CardVariant;
    /** @property {() => void} [onClick] - Funzione da eseguire al click, rende la card cliccabile. */
    onClick?: () => void;
    /** @property {React.ReactNode} [children] - Contenuto aggiuntivo (es. lista per card KPI, tabelle per card contenitore). */
    children?: React.ReactNode;
    /** @property {React.ReactNode} [filters] - Componente per i filtri (per card contenitore). */
    filters?: React.ReactNode;
}

/**
 * Sottocomponente per le card di tipo "Key Performance Indicator".
 * Mostra un titolo, un valore e un'icona con sfondo tonale.
 */
const KpiCard: React.FC<DashboardCardProps> = ({ title, value, icon, variant = 'standard', onClick, children }) => {
    const isClickable = !!onClick;

    const variantClasses = {
        standard: {
            wrapper: 'bg-card dark:bg-dark-card',
            iconBg: 'bg-blue-100 dark:bg-blue-900/50',
            iconText: 'text-blue-600 dark:text-blue-400',
            titleText: 'text-muted-foreground',
            valueText: 'text-foreground dark:text-dark-foreground',
        },
        warning: {
            wrapper: 'bg-amber-100 dark:bg-amber-900/50',
            iconBg: 'bg-amber-200 dark:bg-amber-800/50',
            iconText: 'text-amber-700 dark:text-amber-300',
            titleText: 'text-amber-800 dark:text-amber-200',
            valueText: 'text-amber-900 dark:text-amber-100',
        },
    };

    const currentVariant = variantClasses[variant];
    const wrapperClasses = `${currentVariant.wrapper} rounded-lg shadow ${isClickable ? 'cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all duration-200' : ''}`;
    
    return (
        <div className={wrapperClasses} onClick={onClick}>
            <div className="p-[var(--space-5)] flex flex-col justify-start h-full">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className={`text-[var(--font-size-sm)] font-medium ${currentVariant.titleText}`}>{title}</h3>
                        <p className={`mt-[var(--space-1)] text-[var(--font-size-3xl)] font-semibold ${currentVariant.valueText}`}>{value}</p>
                    </div>
                    {icon && (
                        <div className={`flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full ${currentVariant.iconBg}`}>
                            <Icon name={icon} size={24} className={currentVariant.iconText} />
                        </div>
                    )}
                </div>
                {children && <div className="mt-auto pt-2 flex-grow">{children}</div>}
            </div>
        </div>
    );
};

/**
 * Sottocomponente per le card di tipo "Contenitore".
 * Fornisce uno stile uniforme per racchiudere elementi complessi come tabelle e grafici.
 */
const ContainerCard: React.FC<DashboardCardProps> = ({ title, filters, children }) => {
    return (
        <div className="bg-card dark:bg-dark-card rounded-lg shadow">
            <div className="p-[var(--space-5)] md:p-[var(--space-6)]">
                <div className="flex flex-col md:flex-row justify-between md:items-start mb-[var(--space-4)]">
                    {title && <h2 className="text-[var(--font-size-xl)] font-semibold text-foreground dark:text-dark-foreground mb-4 md:mb-0">{title}</h2>}
                    {filters && <div className="w-full md:w-auto md:max-w-xs">{filters}</div>}
                </div>
                <div className="overflow-y-auto max-h-96">
                    {children}
                </div>
            </div>
        </div>
    );
};

/**
 * Componente principale DashboardCard.
 * Funge da dispatcher, renderizzando KpiCard o ContainerCard in base alle prop fornite.
 */
const DashboardCard: React.FC<DashboardCardProps> = (props) => {
    // Se la card ha un'icona o un valore, viene considerata una KPI card.
    if (props.value !== undefined || props.icon) {
        return <KpiCard {...props} />;
    }
    // Altrimenti, è una card contenitore.
    return <ContainerCard {...props} />;
};

export default DashboardCard;
