
/**
 * @file GraphDataView.tsx
 * @description Componente generico per la visualizzazione di dati tramite grafici (bar, line, pie)
 * utilizzando QuickChart.io per la generazione delle immagini. L'URL viene costruito tramite
 * `buildQuickChartUrl` da utils/pdfExport.
 */
import React from 'react';
import { buildQuickChartUrl } from '../utils/pdfExport';

interface GraphConfig {
    xKey: string;
    yKey: string;
    labelKey?: string; // per pie chart
    valueKey?: string; // per pie chart
}

interface GraphDataViewProps {
    data: any[];
    type: 'bar' | 'line' | 'pie';
    config: GraphConfig;
}

const GraphDataView: React.FC<GraphDataViewProps> = ({ data, type, config }) => {
    if (!data.length) {
        return (
            <div className="flex items-center justify-center h-full text-on-surface-variant text-sm italic">
                Nessun dato disponibile.
            </div>
        );
    }

    const url = buildQuickChartUrl(data, type, config.xKey, config.yKey);

    return (
        <div className="flex items-center justify-center w-full h-full p-2">
            <img
                src={url}
                alt="Grafico"
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                    const target = e.currentTarget;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                        parent.innerHTML =
                            '<span style="color:#888;font-size:12px;font-style:italic;">Impossibile caricare il grafico.</span>';
                    }
                }}
            />
        </div>
    );
};

export default GraphDataView;
