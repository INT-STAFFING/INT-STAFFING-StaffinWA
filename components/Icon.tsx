/**
 * @file Icon.tsx
 * @description Componente wrapper per renderizzare dinamicamente icone dalla libreria Lucide.
 */
import React from 'react';

// Si assume che `lucide-react` sia caricato globalmente tramite script tag in index.html.
// L'oggetto `lucide` sarà disponibile su `window`.
const lucide = (window as any).lucide;

interface IconProps extends React.SVGProps<SVGSVGElement> {
    name: string;
    size?: number | string;
}

const Icon: React.FC<IconProps> = ({ name, color, size, className, ...props }) => {
    // Converte il nome in formato PascalCase, come richiesto da lucide-react
    const camelCaseName = name.charAt(0).toUpperCase() + name.slice(1);
    const LucideIcon = lucide[camelCaseName];

    if (!LucideIcon) {
        console.warn(`Icona "${name}" non trovata nella libreria Lucide.`);
        // Ritorna un'icona di fallback per indicare il problema
        return React.createElement(lucide['AlertCircle'], {
            color: 'red',
            size: size || 20,
            className,
            ...props,
        });
    }

    return React.createElement(LucideIcon, {
        color: color || 'currentColor',
        size: size || 20,
        className,
        ...props,
    });
};

export default Icon;