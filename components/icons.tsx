/**
 * @file icons.tsx
 * @description Icon components used throughout the application.
 */

import React from 'react';

export interface IconProps extends React.ComponentProps<'svg'> {
    title?: string;
}

const createIcon = (path: React.ReactNode) => ({ title, className, ...rest }: IconProps) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        aria-hidden={title ? undefined : true}
        role={title ? 'img' : 'presentation'}
        className={`w-5 h-5 ${className ?? ''}`.trim()}
        {...rest}
    >
        {title ? <title>{title}</title> : null}
        {path}
    </svg>
);

export const CalendarIcon = createIcon(
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 9h18M4.5 6.75h15A1.5 1.5 0 0 1 21 8.25v11.25A1.5 1.5 0 0 1 19.5 21h-15A1.5 1.5 0 0 1 3 19.5V8.25A1.5 1.5 0 0 1 4.5 6.75Zm3 7.5h3v3h-3v-3Z" />
);

export const UsersIcon = createIcon(
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 20a6 6 0 0 0-12 0m12 0v-.75a3 3 0 0 0-3-3h-6a3 3 0 0 0-3 3V20m12 0h3m-3 0V6a3 3 0 1 0-6 0v14m-6 0H3m3 0V6a3 3 0 1 1 6 0v14" />
);

export const ChartPieIcon = createIcon(
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 3.25c0-.69.56-1.25 1.25-1.25A9.5 9.5 0 0 1 22 11.5c0 .69-.56 1.25-1.25 1.25H12.5a1.25 1.25 0 0 1-1.25-1.25V3.25Zm0 0C7.246 3.25 4 6.496 4 10.5S7.246 17.75 11.25 17.75 18.5 14.504 18.5 10.5" />
);

export const ClipboardIcon = createIcon(
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75h6M9 7.5h6m-7.5 4.5h3m0 3h-3m3 3h-3M7.5 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75h-1.5" />
);

export const ChatBubbleIcon = createIcon(
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.375 19.125 4.5 21v-3.75a9 9 0 1 1 9 9c-1.586 0-3.08-.38-4.392-1.05M9 13.5h6m-6-3h6" />
);

export const BookOpenIcon = createIcon(
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 5.25A2.25 2.25 0 0 1 6.75 3h10.5a2.25 2.25 0 0 1 2.25 2.25v13.5a.75.75 0 0 1-1.125.65L12 16.125 5.625 19.4A.75.75 0 0 1 4.5 18.75V5.25Z" />
);

export const SparklesIcon = createIcon(
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5 10.5 9l4.5 1.5-4.5 1.5L9 16.5 7.5 12 3 10.5 7.5 9 9 4.5Zm6-1.5.75 2.25L18 6l-2.25.75L15 9l-.75-2.25L12 6l2.25-.75L15 3Zm3 10.5.75 2.25L21 17.25l-2.25.75L18 21l-.75-2.25L15 17.25l2.25-.75L18 13.5Z" />
);

export const BuildingIcon = createIcon(
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M4.5 21v-8.25a1.5 1.5 0 0 1 1.5-1.5h12a1.5 1.5 0 0 1 1.5 1.5V21M9 21v-3.75a1.5 1.5 0 0 1 1.5-1.5h3a1.5 1.5 0 0 1 1.5 1.5V21M9 3h6a1.5 1.5 0 0 1 1.5 1.5V11.25H7.5V4.5A1.5 1.5 0 0 1 9 3Z" />
);

export const BriefcaseIcon = createIcon(
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 7.5v-1.5a2.25 2.25 0 0 1 2.25-2.25h1.5A2.25 2.25 0 0 1 15 6v1.5M4.5 10.5h15m-15 0v7.5A2.25 2.25 0 0 0 6.75 20.25h10.5A2.25 2.25 0 0 0 19.5 18v-7.5m-15 0V9A2.25 2.25 0 0 1 6.75 6.75h10.5A2.25 2.25 0 0 1 19.5 9v1.5" />
);

export const DocumentChartIcon = createIcon(
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5h7.5m-7.5 3h3m5.25 1.5v9.75a1.5 1.5 0 0 1-1.5 1.5H7.5a1.5 1.5 0 0 1-1.5-1.5V6a1.5 1.5 0 0 1 1.5-1.5H15a1.5 1.5 0 0 1 1.5 1.5Zm-9 9 2.25-2.25L12 15l3-3 1.5 1.5" />
);

export const CogIcon = createIcon(
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.094c.55 0 1.02.398 1.11.94l.149.894a1.125 1.125 0 0 0 1.627.79l.764-.44a1.125 1.125 0 0 1 1.45.257l.774.978c.33.416.304 1.005-.06 1.392l-.63.66a1.125 1.125 0 0 0 0 1.578l.63.66c.364.387.39.976.06 1.392l-.774.978a1.125 1.125 0 0 1-1.45.257l-.764-.44a1.125 1.125 0 0 0-1.627.79l-.15.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.02-.398-1.11-.94l-.149-.894a1.125 1.125 0 0 0-1.627-.79l-.764.44a1.125 1.125 0 0 1-1.45-.257l-.774-.978a1.125 1.125 0 0 1 .06-1.392l.63-.66a1.125 1.125 0 0 0 0-1.578l-.63-.66a1.125 1.125 0 0 1-.06-1.392l.774-.978a1.125 1.125 0 0 1 1.45-.257l.764.44c.533.308 1.2-.096 1.627-.79l.149-.894Z" />
);

export const CloudArrowDownIcon = createIcon(
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 12 15.75l3-3m-3 3v-6m0 6v3.75M3.375 18A3.375 3.375 0 0 1 0 14.625 3.375 3.375 0 0 1 3.375 11.25c.434 0 .85.086 1.226.24A5.25 5.25 0 0 1 14.25 7.5c2.502 0 4.566 1.711 5.077 4.005A3.75 3.75 0 0 1 18.75 18H9Z" />
);

export const CloudArrowUpIcon = createIcon(
    <path strokeLinecap="round" strokeLinejoin="round" d="m9 8.25 3-3 3 3M12 18V6m0-3.75a5.25 5.25 0 0 1 5.077 4.005A3.75 3.75 0 0 1 21.75 10.5 3.75 3.75 0 0 1 18 14.25H9.75a3.75 3.75 0 0 1-3.623-2.842A3.748 3.748 0 0 1 3.75 7.5a3.75 3.75 0 0 1 3.75-3.75H12Z" />
);

export const ShieldCheckIcon = createIcon(
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.75 4.5 6.75v5.25c0 5.135 3.438 9.885 7.5 11.25 4.062-1.365 7.5-6.115 7.5-11.25V6.75L12 3.75Zm-1.5 9 2.25 2.25 4.5-4.5" />
);

export const BeakerIcon = createIcon(
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75h6M9 3.75v8.693a3.75 3.75 0 0 1-.879 2.418l-2.63 3.153A1.5 1.5 0 0 0 6.654 21h10.692a1.5 1.5 0 0 0 1.163-2.986l-2.63-3.153a3.75 3.75 0 0 1-.879-2.418V3.75" />
);

export const ChartBarIcon = createIcon(
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5h2.25V21H3v-7.5Zm4.5-4.5h2.25V21H7.5V9Zm4.5-6h2.25V21H12V3Zm4.5 9h2.25V21H16.5v-9Z" />
);

export const PlayIcon = createIcon(
    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 6.75 7.5 4.5-7.5 4.5v-9Z" />
);

export const ArrowRightIcon = createIcon(
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0-6-6m6 6-6 6" />
);

export const SparkLineIcon = createIcon(
    <path strokeLinecap="round" strokeLinejoin="round" d="m3 15 4.5-6L12 15l3-4.5L21 15" />
);

export const MagnifierIcon = createIcon(
    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m0 0A7.5 7.5 0 1 0 5.25 5.25 7.5 7.5 0 0 0 16.65 16.65Z" />
);

export const BellIcon = createIcon(
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 18.75a2.25 2.25 0 1 1-4.5 0m9-3.75H5.25c.621-1.084 1.103-2.25 1.103-3.75V9a5.625 5.625 0 0 1 11.25 0v2.25c0 1.5.482 2.666 1.102 3.75Z" />
);

export const XMarkIcon = createIcon(
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6m0 12L6 6" />
);

export const SparklesMinimalIcon = createIcon(
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.75 13.5 9h5.25L15.375 12l1.875 6-5.25-3-5.25 3 1.875-6L5.25 9H10.5L12 3.75Z" />
);

export const SpinnerIcon = (props: React.ComponentProps<'svg'>) => (
    <svg className={`animate-spin ${props.className ?? ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" {...props}>
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

export default SpinnerIcon;
