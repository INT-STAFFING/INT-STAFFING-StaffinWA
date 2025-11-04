import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {}

export type IconComponent = React.FC<IconProps>;

const createIcon = (render: () => React.ReactNode): IconComponent => {
    const Icon: IconComponent = ({ className, strokeWidth, ...props }) => (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth ?? 1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            {...props}
        >
            {render()}
        </svg>
    );
    return Icon;
};

export const Menu = createIcon(() => (
    <>
        <line x1="4" y1="6" x2="20" y2="6" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="18" x2="20" y2="18" />
    </>
));

export const SunMedium = createIcon(() => (
    <>
        <circle cx="12" cy="12" r="4" />
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="22" />
        <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" />
        <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
        <line x1="2" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="22" y2="12" />
        <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
        <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
    </>
));

export const Moon = createIcon(() => (
    <path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z" />
));

export const ChevronDown = createIcon(() => (
    <polyline points="6 9 12 15 18 9" />
));

export const Search = createIcon(() => (
    <>
        <circle cx="11" cy="11" r="6" />
        <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </>
));

export const Check = createIcon(() => (
    <polyline points="5 13 9 17 19 7" />
));

export const AlertCircle = createIcon(() => (
    <>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="13" />
        <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
    </>
));

export const Activity = createIcon(() => (
    <polyline points="4 12 7.5 12 9.5 7 13 17 15 12 20 12" />
));

export const BarChart3 = createIcon(() => (
    <>
        <line x1="6" y1="20" x2="6" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="18" y1="20" x2="18" y2="14" />
    </>
));

export const BookOpen = createIcon(() => (
    <>
        <path d="M3 5h7a2 2 0 012 2v13a4 4 0 00-4-4H3z" />
        <path d="M21 5h-7a2 2 0 00-2 2v13a4 4 0 014-4h5z" />
        <line x1="12" y1="7" x2="12" y2="22" />
    </>
));

export const Building2 = createIcon(() => (
    <>
        <path d="M3 21V9a2 2 0 012-2h6v14" />
        <path d="M21 21V5a2 2 0 00-2-2h-8v18" />
        <line x1="3" y1="21" x2="21" y2="21" />
        <line x1="7" y1="11" x2="9" y2="11" />
        <line x1="7" y1="14.5" x2="9" y2="14.5" />
        <line x1="15" y1="8.5" x2="17" y2="8.5" />
        <line x1="15" y1="12" x2="17" y2="12" />
        <line x1="15" y1="15.5" x2="17" y2="15.5" />
    </>
));

export const CalendarClock = createIcon(() => (
    <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <circle cx="16" cy="16" r="4" />
        <path d="M16 14v2l1.5 1.5" />
    </>
));

export const CalendarDays = createIcon(() => (
    <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="14" x2="10" y2="14" />
        <line x1="14" y1="14" x2="16" y2="14" />
        <line x1="8" y1="18" x2="10" y2="18" />
        <line x1="14" y1="18" x2="16" y2="18" />
    </>
));

export const ClipboardList = createIcon(() => (
    <>
        <rect x="6" y="3" width="12" height="18" rx="2" />
        <path d="M9 3v2a1 1 0 001 1h4a1 1 0 001-1V3" />
        <line x1="9" y1="10" x2="15" y2="10" />
        <line x1="9" y1="14" x2="15" y2="14" />
        <circle cx="8" cy="10" r="0.5" fill="currentColor" stroke="none" />
        <circle cx="8" cy="14" r="0.5" fill="currentColor" stroke="none" />
    </>
));

export const Database = createIcon(() => (
    <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
        <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </>
));

export const Download = createIcon(() => (
    <>
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="3" x2="12" y2="15" />
    </>
));

export const Upload = createIcon(() => (
    <>
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="17 14 12 9 7 14" />
        <line x1="12" y1="9" x2="12" y2="21" />
    </>
));

export const FileText = createIcon(() => (
    <>
        <path d="M14 2H7a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V9z" />
        <polyline points="14 2 14 9 21 9" />
        <line x1="9" y1="13" x2="15" y2="13" />
        <line x1="9" y1="17" x2="13" y2="17" />
    </>
));

export const Briefcase = createIcon(() => (
    <>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
        <line x1="3" y1="13" x2="21" y2="13" />
    </>
));

export const IdBadge = createIcon(() => (
    <>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <circle cx="12" cy="11" r="2.5" />
        <path d="M8.5 18a3.5 3.5 0 017 0" />
        <line x1="9" y1="6" x2="15" y2="6" />
    </>
));

export const Kanban = createIcon(() => (
    <>
        <rect x="4" y="4" width="6" height="16" rx="1.5" />
        <rect x="14" y="4" width="6" height="10" rx="1.5" />
        <line x1="14" y1="18" x2="20" y2="18" />
    </>
));

export const LayoutDashboard = createIcon(() => (
    <>
        <rect x="3" y="3" width="8" height="8" rx="2" />
        <rect x="13" y="3" width="8" height="5" rx="2" />
        <rect x="3" y="13" width="8" height="8" rx="2" />
        <rect x="13" y="11" width="8" height="10" rx="2" />
    </>
));

export const LineChart = createIcon(() => (
    <polyline points="4 16 9 11 13 15 20 7" />
));

export const LogOut = createIcon(() => (
    <>
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
    </>
));

export const MessageSquare = createIcon(() => (
    <>
        <path d="M21 15a2 2 0 01-2 2H8l-5 5V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </>
));

export const Palette = createIcon(() => (
    <>
        <path d="M12 3a9 9 0 109 9 3 3 0 01-3 3h-1.5a1.5 1.5 0 00-1.5 1.5 2.5 2.5 0 01-5 0 7 7 0 01-7-7 6.5 6.5 0 016.5-6.5z" />
        <circle cx="7.5" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
        <circle cx="9.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
        <circle cx="14.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
        <circle cx="16.5" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
    </>
));

export const Settings = createIcon(() => (
    <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </>
));

export const Shield = createIcon(() => (
    <path d="M12 3l8 4v5c0 5-3.58 9-8 9s-8-4-8-9V7z" />
));

export const UploadIcon = Upload;
export const DownloadIcon = Download;

export const Users = createIcon(() => (
    <>
        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="3" />
        <path d="M22 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
    </>
));

export const X = createIcon(() => (
    <>
        <line x1="5" y1="5" x2="19" y2="19" />
        <line x1="19" y1="5" x2="5" y2="19" />
    </>
));

export const AlertIcon = AlertCircle;
export const CheckIcon = Check;
export const ChevronIcon = ChevronDown;

export const UploadArrow = Upload;
export const DownloadArrow = Download;

export const Calendar = CalendarDays;

export const PaletteIcon = Palette;

export const LineChartIcon = LineChart;

export const DatabaseIcon = Database;

export const ClipboardIcon = ClipboardList;

export const ActivityIcon = Activity;

export const BarChartIcon = BarChart3;

export const MessageIcon = MessageSquare;

export const BookIcon = BookOpen;

export const ShieldIcon = Shield;

export const SettingsIcon = Settings;

export const PaletteSwatch = Palette;

export const MoonIcon = Moon;

export const SunIcon = SunMedium;

export const SearchIcon = Search;

export const LogoutIcon = LogOut;

