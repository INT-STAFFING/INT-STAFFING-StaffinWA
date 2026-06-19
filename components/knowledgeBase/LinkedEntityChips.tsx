/**
 * @file components/knowledgeBase/LinkedEntityChips.tsx
 * @description Visualizza le entità collegate a una scheda KB come chip/badge.
 * - In sola lettura: i chip sono link cliccabili che navigano alla sezione dell'entità.
 * - Con `onRemove`: i chip mostrano un pulsante di rimozione (usato nella form di editing).
 */

import React from 'react';
import { Link } from 'react-router-dom';
import type { LinkedEntity } from '../../types/knowledgeBase';
import { ENTITY_TYPE_META, getEntityRoute } from '../../utils/knowledgeBaseFilters';

interface LinkedEntityChipsProps {
    entities: LinkedEntity[];
    /** Se fornito, i chip diventano rimovibili (modalità editing) invece che navigabili. */
    onRemove?: (entity: LinkedEntity) => void;
    className?: string;
}

const chipBase = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-container text-on-surface-variant border border-outline-variant';

const LinkedEntityChips: React.FC<LinkedEntityChipsProps> = ({ entities, onRemove, className }) => {
    if (!entities || entities.length === 0) return null;

    return (
        <div className={['flex flex-wrap gap-2', className].filter(Boolean).join(' ')}>
            {entities.map((entity) => {
                const meta = ENTITY_TYPE_META[entity.entityType];
                const key = `${entity.entityType}-${entity.entityId}`;
                const inner = (
                    <>
                        <span className="material-symbols-outlined text-sm" aria-hidden="true">{meta.icon}</span>
                        <span className="truncate max-w-[12rem]">{entity.label}</span>
                    </>
                );

                if (onRemove) {
                    return (
                        <span key={key} className={chipBase}>
                            {inner}
                            <button
                                type="button"
                                aria-label={`Rimuovi collegamento: ${entity.label}`}
                                onClick={() => onRemove(entity)}
                                className="ml-0.5 text-on-surface-variant hover:text-error"
                            >
                                <span className="material-symbols-outlined text-sm" aria-hidden="true">close</span>
                            </button>
                        </span>
                    );
                }

                return (
                    <Link
                        key={key}
                        to={getEntityRoute(entity)}
                        title={`${meta.label}: ${entity.label}`}
                        className={`${chipBase} hover:bg-surface-container-high hover:text-primary transition-colors`}
                    >
                        {inner}
                    </Link>
                );
            })}
        </div>
    );
};

export default LinkedEntityChips;
