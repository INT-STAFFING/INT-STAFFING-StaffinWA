import React from 'react';

export type IconProps = React.SVGProps<SVGSVGElement>;

const createIcon = (children: React.ReactNode, displayName: string) => {
    const Icon = React.forwardRef<SVGSVGElement, IconProps>(({ className, ...props }, ref) => (
        <svg
            ref={ref}
            viewBox="0 0 24 24"
            width="1em"
            height="1em"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden="true"
            focusable="false"
            {...props}
        >
            {children}
        </svg>
    ));
    Icon.displayName = displayName;
    return Icon;
};

export const MenuIcon = createIcon(
    <>
        <line x1="4" y1="6" x2="20" y2="6" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="18" x2="20" y2="18" />
    </>,
    'MenuIcon'
);

export const CloseIcon = createIcon(
    <>
        <line x1="5" y1="5" x2="19" y2="19" />
        <line x1="19" y1="5" x2="5" y2="19" />
    </>,
    'CloseIcon'
);

export const CalendarIcon = createIcon(
    <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <polyline points="11 16 13.5 18.5 17 15" />
    </>,
    'CalendarIcon'
);

export const UsersIcon = createIcon(
    <>
        <circle cx="9" cy="7" r="3" />
        <path d="M3 21v-2a5 5 0 0 1 5-5h2" />
        <circle cx="17" cy="11" r="3" />
        <path d="M14 21v-2a5 5 0 0 1 5-5h2" />
    </>,
    'UsersIcon'
);

export const LayoutDashboardIcon = createIcon(
    <>
        <rect x="3" y="3" width="8" height="8" rx="1.5" />
        <rect x="13" y="3" width="8" height="5" rx="1.5" />
        <rect x="13" y="10" width="8" height="11" rx="1.5" />
        <rect x="3" y="13" width="8" height="8" rx="1.5" />
    </>,
    'LayoutDashboardIcon'
);

export const ClipboardListIcon = createIcon(
    <>
        <rect x="5" y="4" width="14" height="18" rx="2" />
        <path d="M9 4V2h6v2" />
        <line x1="9" y1="12" x2="15" y2="12" />
        <line x1="9" y1="16" x2="15" y2="16" />
        <circle cx="7" cy="12" r="0.9" />
        <circle cx="7" cy="16" r="0.9" />
    </>,
    'ClipboardListIcon'
);

export const MessageSquareIcon = createIcon(
    <>
        <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />
        <line x1="8" y1="10" x2="16" y2="10" />
        <line x1="8" y1="14" x2="14" y2="14" />
    </>,
    'MessageSquareIcon'
);

export const BookOpenIcon = createIcon(
    <>
        <path d="M2 5.5V20a1 1 0 0 0 1.23.97L10 19a3 3 0 0 1 2 .52V5a3 3 0 0 0-3-3H4a2 2 0 0 0-2 2.5z" />
        <path d="M22 5.5V20a1 1 0 0 1-1.23.97L14 19a3 3 0 0 0-2 .52V5a3 3 0 0 1 3-3h5a2 2 0 0 1 2 2.5z" />
    </>,
    'BookOpenIcon'
);

export const TrendingUpIcon = createIcon(
    <>
        <polyline points="3 17 9 11 13 15 21 7" />
        <polyline points="21 12 21 7 16 7" />
    </>,
    'TrendingUpIcon'
);

export const KanbanIcon = createIcon(
    <>
        <rect x="4" y="4" width="6" height="16" rx="1.5" />
        <rect x="14" y="4" width="6" height="9" rx="1.5" />
        <rect x="14" y="15" width="6" height="5" rx="1.5" />
    </>,
    'KanbanIcon'
);

export const BarChartIcon = createIcon(
    <>
        <line x1="4" y1="19" x2="20" y2="19" />
        <rect x="5" y="11" width="3" height="8" rx="1" />
        <rect x="11" y="7" width="3" height="12" rx="1" />
        <rect x="17" y="4" width="3" height="15" rx="1" />
    </>,
    'BarChartIcon'
);

export const PieChartIcon = createIcon(
    <>
        <path d="M12 3a9 9 0 1 1-9 9" />
        <path d="M12 3v9l7 7" />
    </>,
    'PieChartIcon'
);

export const UserCogIcon = createIcon(
    <>
        <circle cx="12" cy="7" r="3" />
        <path d="M5 21v-1a5 5 0 0 1 5-5h2" />
        <circle cx="18" cy="17" r="3" />
        <path d="M18 13v1" />
        <path d="M18 20v1" />
        <path d="M15.8 15.2l.7.7" />
        <path d="M20.5 19.9l.7.7" />
        <path d="M15.8 18.8l.7-.7" />
        <path d="M20.5 14.1l.7-.7" />
    </>,
    'UserCogIcon'
);

export const BriefcaseIcon = createIcon(
    <>
        <path d="M4 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
        <path d="M10 5h4a2 2 0 0 1 2 2v0H8v0a2 2 0 0 1 2-2z" />
        <line x1="2" y1="13" x2="22" y2="13" />
    </>,
    'BriefcaseIcon'
);

export const FileSignatureIcon = createIcon(
    <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M10 13c1 1 2 1 3 0l4-4" />
        <path d="M9 17.5c.5-.5 1.5-.5 2 0s1.5.5 2 0" />
    </>,
    'FileSignatureIcon'
);

export const BuildingIcon = createIcon(
    <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M9 21v-4" />
        <path d="M15 21v-4" />
        <path d="M9 7h.01" />
        <path d="M9 11h.01" />
        <path d="M15 7h.01" />
        <path d="M15 11h.01" />
    </>,
    'BuildingIcon'
);

export const BadgeCheckIcon = createIcon(
    <>
        <path d="M12 2l2.3 2.3 3.2-.6-.6 3.2L19 9l-2.3 2.3.6 3.2-3.2-.6L12 16l-2.3-2.3-3.2.6.6-3.2L5 9l2.3-2.3-.6-3.2 3.2.6z" />
        <path d="M9.5 9.5l2 2 3-3" />
    </>,
    'BadgeCheckIcon'
);

export const CalendarDaysIcon = createIcon(
    <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <circle cx="9" cy="15" r="0.9" />
        <circle cx="12" cy="18" r="0.9" />
        <circle cx="15" cy="15" r="0.9" />
    </>,
    'CalendarDaysIcon'
);

export const SettingsIcon = createIcon(
    <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 5 15.4a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 14 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>,
    'SettingsIcon'
);

export const DownloadIcon = createIcon(
    <>
        <path d="M12 3v12" />
        <polyline points="6 11 12 17 18 11" />
        <path d="M5 21h14" />
    </>,
    'DownloadIcon'
);

export const UploadIcon = createIcon(
    <>
        <path d="M12 21V9" />
        <polyline points="6 13 12 7 18 13" />
        <path d="M5 3h14" />
    </>,
    'UploadIcon'
);

export const ShieldIcon = createIcon(
    <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9.5 11.5l2 2 3-3" />
    </>,
    'ShieldIcon'
);

export const DatabaseIcon = createIcon(
    <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
        <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </>,
    'DatabaseIcon'
);

export const LogOutIcon = createIcon(
    <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
    </>,
    'LogOutIcon'
);

