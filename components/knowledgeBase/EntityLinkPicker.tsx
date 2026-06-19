/**
 * @file components/knowledgeBase/EntityLinkPicker.tsx
 * @description Sezione "Collega a" della form scheda KB.
 * Mostra un selettore ricercabile per ciascun tipo di entità (Risorse, Competenze,
 * Progetti, Contratti, Clienti); le opzioni sono fornite dal chiamante a partire
 * dagli store/servizi esistenti. Un articolo può collegarsi a zero o più entità di
 * tipi diversi. Le entità già collegate sono mostrate come chip rimovibili.
 */

import React, { useCallback } from 'react';
import SearchableSelect from '../SearchableSelect';
import LinkedEntityChips from './LinkedEntityChips';
import type { Option } from '../forms/types';
import type { LinkedEntity, LinkedEntityType } from '../../types/knowledgeBase';
import { ENTITY_TYPES, ENTITY_TYPE_META } from '../../utils/knowledgeBaseFilters';

interface EntityLinkPickerProps {
    value: LinkedEntity[];
    onChange: (next: LinkedEntity[]) => void;
    /** Opzioni selezionabili per tipo di entità: { value: id, label: nome }. */
    optionsByType: Record<LinkedEntityType, Option[]>;
}

const EntityLinkPicker: React.FC<EntityLinkPickerProps> = ({ value, onChange, optionsByType }) => {
    const handleSelect = useCallback((entityType: LinkedEntityType, entityId: string) => {
        if (!entityId) return;
        const already = value.some(e => e.entityType === entityType && e.entityId === entityId);
        if (already) return;
        const option = optionsByType[entityType].find(o => o.value === entityId);
        const label = option?.label ?? entityId;
        onChange([...value, { entityType, entityId, label }]);
    }, [value, onChange, optionsByType]);

    const handleRemove = useCallback((entity: LinkedEntity) => {
        onChange(value.filter(e => !(e.entityType === entity.entityType && e.entityId === entity.entityId)));
    }, [value, onChange]);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ENTITY_TYPES.map((type) => {
                    const meta = ENTITY_TYPE_META[type];
                    const linkedIds = new Set(value.filter(e => e.entityType === type).map(e => e.entityId));
                    const available = optionsByType[type].filter(o => !linkedIds.has(o.value));
                    return (
                        <div key={type}>
                            <label className="block text-xs font-medium text-on-surface-variant mb-1 flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm" aria-hidden="true">{meta.icon}</span>
                                {meta.plural}
                            </label>
                            <SearchableSelect
                                name={`kb-link-${type}`}
                                value=""
                                options={available}
                                onChange={(_name, val) => handleSelect(type, val)}
                                placeholder={`Aggiungi ${meta.label.toLowerCase()}...`}
                            />
                        </div>
                    );
                })}
            </div>

            {value.length > 0 && (
                <div>
                    <p className="text-xs font-medium text-on-surface-variant mb-2">Entità collegate ({value.length})</p>
                    <LinkedEntityChips entities={value} onRemove={handleRemove} />
                </div>
            )}
        </div>
    );
};

export default EntityLinkPicker;
