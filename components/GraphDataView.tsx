
/**
 * @file GraphDataView.tsx
 * @description Componente generico per la visualizzazione di dati tramite grafici (bar, line, pie).
 */
import React, { useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

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
    const svgRef = useRef<SVGSVGElement>(null);
    const { theme } = useTheme();
    const isDarkMode = document.documentElement.classList.contains('dark');
    const currentPalette = isDarkMode ? theme.dark : theme.light;

    useEffect(() => {
        if (!svgRef.current || data.length === 0) return;

        let resizeTimer: number;
        let observer: ResizeObserver;

        const drawChart = async () => {
            const svg = await import('d3-selection').then(m => m.select(svgRef.current));
            // Ensure transitions are loaded. d3-transition side-effects apply to selection prototype
            await import('d3-transition');
            const { scaleBand, scaleLinear } = await import('d3-scale');
            const { axisBottom, axisLeft } = await import('d3-axis');
            const { max } = await import('d3-array');

            svg.selectAll("*").remove(); // Pulisce il render precedente

            const parent = svg.node()?.parentElement;
            if (!parent) return;

            
            const { width: containerWidth, height: containerHeight } = parent.getBoundingClientRect();
            
            const margin = { top: 20, right: 20, bottom: 80, left: 60 };
            const width = containerWidth - margin.left - margin.right;
            const height = containerHeight - margin.top - margin.bottom;

            if (width <= 0 || height <= 0) return;

            const chart = svg.append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);
                
            const d3Select = await import('d3-selection');
            const tooltip = d3Select.select("body").selectAll(".d3-tooltip").data([null]).join("div")
                .attr("class", "d3-tooltip")
                .style("position", "absolute")
                .style("z-index", "100")
                .style("visibility", "hidden")
                .style("background", currentPalette.surfaceContainerHighest)
                .style("color", currentPalette.onSurface)
                .style("padding", "8px 12px")
                .style("border-radius", "8px")
                .style("font-size", "12px")
                .style("box-shadow", "0 4px 6px rgba(0,0,0,0.1)");
            
            const getNestedValue = (obj: any, key: string) => key.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);

            if (type === 'bar') {
                const x = scaleBand()
                    .domain(data.map(d => getNestedValue(d, config.xKey)))
                    .range([0, width])
                    .padding(0.4);

                const rawYMax = max(data, (d: any) => getNestedValue(d, config.yKey));
                const yMax = Number(rawYMax) || 0;
                const y = scaleLinear()
                    .domain([0, (yMax > 0 ? yMax : 10) * 1.1])
                    .range([height, 0]);

                chart.append("g")
                    .attr("transform", `translate(0,${height})`)
                    .call(axisBottom(x))
                    .selectAll("text")
                    .attr("fill", currentPalette.onSurfaceVariant)
                    .style("text-anchor", "end")
                    .attr("dx", "-.8em")
                    .attr("dy", ".15em")
                    .attr("transform", "rotate(-65)");
                
                chart.append("g")
                    .call(axisLeft(y).ticks(5))
                    .selectAll("text")
                    .attr("fill", currentPalette.onSurfaceVariant);

                const bars = chart.selectAll(".bar")
                    .data(data)
                    .join("rect")
                    .attr("class", "bar")
                    .attr("x", (d: any) => x(getNestedValue(d, config.xKey)) || 0)
                    .attr("y", (d: any) => y(0))
                    .attr("width", x.bandwidth())
                    .attr("height", 0)
                    .attr("fill", currentPalette.primary)
                    .attr("rx", 3)
                    .on("mouseover", (event: any, d: any) => {
                        d3Select.select(event.currentTarget).attr("fill", currentPalette.primaryContainer);
                        tooltip.style("visibility", "visible").html(`<strong>${getNestedValue(d, config.xKey)}</strong><br/>Valore: ${getNestedValue(d, config.yKey).toFixed(2)}`);
                    })
                    .on("mousemove", (event: any) => {
                        tooltip.style("top", (event.pageY - 10) + "px").style("left", (event.pageX + 10) + "px");
                    })
                    .on("mouseout", (event: any) => {
                        d3Select.select(event.currentTarget).attr("fill", currentPalette.primary);
                        tooltip.style("visibility", "hidden");
                    });
                
                (bars as any).transition()
                    .duration(800)
                    .attr("y", (d: any) => y(getNestedValue(d, config.yKey)))
                    .attr("height", (d: any) => height - y(getNestedValue(d, config.yKey)));
            } else {
                chart.append("text")
                    .text(`Grafico '${type}' non implementato.`)
                    .attr("x", width/2)
                    .attr("y", height/2)
                    .attr("text-anchor", "middle")
                    .attr("fill", currentPalette.onSurfaceVariant);
            }
        };
        
        drawChart();
        
        // Setup resize observer
        const parent = svgRef.current.parentElement;
        if(parent) {
             observer = new ResizeObserver(() => {
                clearTimeout(resizeTimer);
                resizeTimer = window.setTimeout(drawChart, 300);
            });
            observer.observe(parent);
        }

        return () => {
            if(observer) observer.disconnect();
            import('d3-selection').then(m => m.select(".d3-tooltip").remove());
        };

    }, [data, type, config, theme, isDarkMode, currentPalette]);


    return <svg ref={svgRef} width="100%" height="100%"></svg>;
};

export default GraphDataView;