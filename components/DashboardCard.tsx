import React from 'react';

interface DashboardCardProps {
    title: React.ReactNode;
    actions?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    titleAs?: keyof JSX.IntrinsicElements;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ title, actions, children, className = '', titleAs: TitleTag = 'h2' }) => {
    return (
        <section className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 flex flex-col gap-6 ${className}`}>
            <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <TitleTag className="text-xl font-semibold text-gray-900 dark:text-white">{title}</TitleTag>
                {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
            </header>
            <div className="flex-1 min-h-0">{children}</div>
        </section>
    );
};

export default DashboardCard;
