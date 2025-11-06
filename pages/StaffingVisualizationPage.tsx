/**
 * @file StaffingVisualizationPage.tsx
 * @description Pagina di visualizzazione grafica dello staffing con diagrammi Sankey e Network.
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { isHoliday } from '../utils/dateUtils';
import { SpinnerIcon } from '../components/icons';
import { useTheme } from '../context/ThemeContext';

// Informa TypeScript che D3 e d3-sankey sono disponibili come variabili globali (da CDN).
declare var d3: any;

type ViewMode = 'sankey' | 'network';

const StaffingVisualizationPage: React.FC = () => {
    const { resources, projects, clients, contracts, assignments, contractProjects, companyCalendar } = useEntitiesContext();
    const { allocations } = useAllocationsContext();
    const { theme } = useTheme();

    const [view, setView] = useState<ViewMode>('sankey');
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [isLoading, setIsLoading] = useState(true);

    const svgRef = useRef<SVGSVGElement>(null);

    const monthOptions = useMemo(() => {
        const options = [];
        const today = new Date();
        for (let i = -6; i <= 6; i++) {
            const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
            options.push({
                value: date.toISOString().slice(0, 7),
                label: date.toLocaleString('it-IT', { month: 'long', year: 'numeric' }),
            });
        }
        return options;
    }, []);

    const chartData = useMemo(() => {
        if (resources.length === 0 || projects.length === 0 || clients.length === 0) return { nodes: [], links: [] };

        const [year, month] = selectedMonth.split('-').map(Number);
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);

        const projectTotals: { [projectId: string]: number } = {};
        const resourceProjectLinks: { source: string; target: string; value: number }[] = [];

        // 1. Calcola link Risorsa -> Progetto e totali per progetto
        assignments.forEach(assignment => {
            const resource = resources.find(r => r.id === assignment.resourceId);
            if (!resource) return;

            const assignmentAllocations = allocations[assignment.id!];
            let totalPersonDays = 0;
            if (assignmentAllocations) {
                let currentDate = new Date(firstDay);
                while (currentDate <= lastDay) {
                    const dateStr = currentDate.toISOString().split('T')[0];
                    if (assignmentAllocations[dateStr] && !isHoliday(currentDate, resource.location, companyCalendar) && currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
                        totalPersonDays += (assignmentAllocations[dateStr] / 100);
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            }

            if (totalPersonDays > 0) {
                resourceProjectLinks.push({
                    source: `res_${assignment.resourceId}`,
                    target: `proj_${assignment.projectId}`,
                    value: totalPersonDays,
                });
                projectTotals[assignment.projectId] = (projectTotals[assignment.projectId] || 0) + totalPersonDays;
            }
        });

        const projectClientLinks: { source: string; target: string; value: number }[] = [];
        const clientContractTotals: { [clientId: string]: { [contractId: string]: number } } = {};

        // 2. Calcola link Progetto -> Cliente e aggrega sforzo Cliente -> Contratto
        Object.keys(projectTotals).forEach(projectId => {
            const project = projects.find(p => p.id === projectId);
            if (!project || !project.clientId) return;
            
            const effort = projectTotals[projectId];

            projectClientLinks.push({
                source: `proj_${projectId}`,
                target: `cli_${project.clientId}`,
                value: effort,
            });

            let contractId = project.contractId;
            if (!contractId) {
                const contractLink = contractProjects.find(cp => cp.projectId === project.id);
                if (contractLink) contractId = contractLink.contractId;
            }

            if (contractId) {
                if (!clientContractTotals[project.clientId]) {
                    clientContractTotals[project.clientId] = {};
                }
                if (!clientContractTotals[project.clientId][contractId]) {
                    clientContractTotals[project.clientId][contractId] = 0;
                }
                clientContractTotals[project.clientId][contractId] += effort;
            }
        });

        // 3. Calcola link Cliente -> Contratto
        const clientContractLinks: { source: string; target: string; value: number }[] = [];
        Object.keys(clientContractTotals).forEach(clientId => {
            Object.keys(clientContractTotals[clientId]).forEach(contractId => {
                const value = clientContractTotals[clientId][contractId];
                if (value > 0) {
                    clientContractLinks.push({
                        source: `cli_${clientId}`,
                        target: `cont_${contractId}`,
                        value: value,
                    });
                }
            });
        });

        const links = [...resourceProjectLinks, ...projectClientLinks, ...clientContractLinks];
        
        const activeNodeIds = new Set(links.flatMap(l => [l.source, l.target]));
        if (activeNodeIds.size === 0) return { nodes: [], links: [] };
        
        // 4. Definisce tutti i nodi e filtra quelli attivi
        const activeNodes = [
            ...resources.map(r => ({ id: `res_${r.id}`, name: r.name, type: 'resource' })),
            ...projects.map(p => ({ id: `proj_${p.id}`, name: p.name, type: 'project' })),
            ...clients.map(c => ({ id: `cli_${c.id}`, name: c.name, type: 'client' })),
            ...contracts.map(c => ({ id: `cont_${c.id}`, name: c.name, type: 'contract' })),
        ].filter(n => activeNodeIds.has(n.id));

        return { nodes: activeNodes, links };

    }, [selectedMonth, resources, projects, clients, contracts, assignments, allocations, contractProjects, companyCalendar]);
    
    const chartDataString = useMemo(() => JSON.stringify(chartData), [chartData]);

    useEffect(() => {
        setIsLoading(true);

        if (!svgRef.current) {
            setIsLoading(false);
            return;
        }

        const data = JSON.parse(chartDataString);

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        if (data.nodes.length === 0) {
            setIsLoading(false);
            return;
        }

        const width = 1200;
        const height = view === 'sankey' ? 1600 : 800;
        svg.attr("viewBox", `0 0 ${width} ${height}`);
        
        const tooltip = d3.select("body").append("div")
            .attr("class", "d3-tooltip")
            .style("position", "absolute")
            .style("z-index", "10")
            .style("visibility", "hidden")
            .style("background", "#333")
            .style("color", "#fff")
            .style("padding", "8px")
            .style("border-radius", "4px")
            .style("font-size", "12px");

        if (view === 'sankey') {
            // PARAMETRI SANKEY: Recupera le impostazioni dal tema.
            const { nodeWidth, nodePadding, linkOpacity } = theme.visualizationSettings.sankey;

            const sankey = d3.sankey()
                // nodeWidth: Controlla la larghezza (spessore orizzontale) dei rettangoli verticali (nodi).
                .nodeWidth(nodeWidth)
                // nodePadding: Controlla lo spazio verticale tra i nodi all'interno della stessa colonna.
                .nodePadding(nodePadding)
                .extent([[1, 5], [width - 1, height - 5]]);
            
            const nodeById = new Map(data.nodes.map((d: any, i: number) => [d.id, i]));
            const graph = {
                nodes: data.nodes,
                links: data.links.map((d: any) => ({
                    source: nodeById.get(d.source),
                    target: nodeById.get(d.target),
                    value: d.value,
                }))
            };

            const { nodes, links } = sankey(graph);
            
            const color = d3.scaleOrdinal()
                .domain(['resource', 'project', 'client', 'contract'])
                .range(['#3b82f6', '#10b981', '#8b5cf6', '#f97316']);

            svg.append("g")
                .selectAll("rect")
                .data(nodes)
                .join("rect")
                .attr("x", (d: any) => d.x0)
                .attr("y", (d: any) => d.y0)
                .attr("height", (d: any) => d.y1 - d.y0)
                .attr("width", (d: any) => d.x1 - d.x0)
                .attr("fill", (d: any) => color(d.type))
                .on("mouseover", (event: any, d: any) => {
                    tooltip.style("visibility", "visible").text(`${d.name}`);
                })
                .on("mousemove", (event: any) => {
                    tooltip.style("top", (event.pageY - 10) + "px").style("left", (event.pageX + 10) + "px");
                })
                .on("mouseout", () => {
                    tooltip.style("visibility", "hidden");
                });

            const link = svg.append("g")
                .attr("fill", "none")
                // linkOpacity: Controlla la trasparenza dei flussi. Utile per visualizzare meglio gli incroci.
                .attr("stroke-opacity", linkOpacity)
                .selectAll("g")
                .data(links)
                .join("g")
                .style("mix-blend-mode", "multiply");

            link.append("path")
                .attr("d", d3.sankeyLinkHorizontal())
                .attr("stroke", (d: any) => color(d.source.type))
                .attr("stroke-width", (d: any) => Math.max(1, d.width));
                
            link.on("mouseover", function(event: any, d: any) {
                    d3.select(this).attr("stroke-opacity", 0.8);
                    tooltip.style("visibility", "visible").text(`${d.source.name} → ${d.target.name}: ${d.value.toFixed(1)} G/U`);
                })
                .on("mousemove", (event: any) => {
                    tooltip.style("top", (event.pageY - 10) + "px").style("left", (event.pageX + 10) + "px");
                })
                .on("mouseout", function() {
                    d3.select(this).attr("stroke-opacity", linkOpacity);
                    tooltip.style("visibility", "hidden");
                });

            svg.append("g")
                .selectAll("text")
                .data(nodes)
                .join("text")
                .attr("x", (d: any) => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
                .attr("y", (d: any) => (d.y1 + d.y0) / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", (d: any) => d.x0 < width / 2 ? "start" : "end")
                .attr("font-size", "10px")
                .attr("fill", "currentColor")
                .text((d: any) => d.name);
        
        } else { // network
            // PARAMETRI NETWORK: Recupera le impostazioni dal tema.
            const { chargeStrength, linkDistance, centerStrength, nodeRadius } = theme.visualizationSettings.network;

            const zoom = d3.zoom()
                .scaleExtent([0.1, 4])
                .on("zoom", (event: any) => {
                    g.attr("transform", event.transform);
                });
            
            const g = svg.append("g");
            svg.call(zoom);

             const color = d3.scaleOrdinal()
                .domain(['resource', 'project', 'client', 'contract'])
                .range(['#3b82f6', '#10b981', '#8b5cf6', '#f97316']);

            const simulation = d3.forceSimulation(data.nodes)
                // linkDistance: Imposta la distanza "ideale" che i collegamenti (le "molle") cercano di raggiungere.
                .force("link", d3.forceLink(data.links).id((d: any) => d.id).distance(linkDistance))
                // chargeStrength: È la forza principale di repulsione tra tutti i nodi. Un valore più negativo aumenta la distanza tra loro.
                .force("charge", d3.forceManyBody().strength(chargeStrength))
                // center: Forza che attira l'intero grafico verso il centro dell'area di disegno.
                .force("center", d3.forceCenter(width / 2, height / 2))
                // x e y: Forze "gentili" che attirano i nodi verso il centro orizzontale e verticale.
                // centerStrength: Controlla l'intensità di queste forze centripete.
                .force("x", d3.forceX(width / 2).strength(centerStrength))
                .force("y", d3.forceY(height / 2).strength(centerStrength));
                
            const link = g.append("g")
                .attr("stroke", "#999")
                .attr("stroke-opacity", 0.6)
                .selectAll("line")
                .data(data.links)
                .join("line")
                .attr("stroke-width", (d: any) => Math.max(1, Math.sqrt(d.value)));  

            const nodeGroup = g.append("g")
                .selectAll(".node-group")
                .data(data.nodes)
                .join("g")
                .attr("class", "node-group")
                .call(d3.drag()
                    .on("start", (event: any, d: any) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
                    .on("drag", (event: any, d: any) => { d.fx = event.x; d.fy = event.y; })
                    .on("end", (event: any, d: any) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
                );

            nodeGroup.append("circle")
                // nodeRadius: Controlla la dimensione (raggio) dei cerchi che rappresentano i nodi.
                .attr("r", nodeRadius)
                .attr("fill", (d: any) => color(d.type))
                .attr("stroke", "#fff")
                .attr("stroke-width", 1.5);

            nodeGroup.append("text")
                .text((d: any) => d.name)
                .attr("x", 12)
                .attr("y", 3)
                .attr("font-size", "10px")
                .attr("fill", "currentColor");
            
            nodeGroup.on("mouseover", (event: any, d: any) => {
                    tooltip.style("visibility", "visible").text(`${d.name}`);
                })
                .on("mousemove", (event: any) => {
                    tooltip.style("top", (event.pageY - 10) + "px").style("left", (event.pageX + 10) + "px");
                })
                .on("mouseout", () => {
                    tooltip.style("visibility", "hidden");
                });

            simulation.on("tick", () => {
                link
                    .attr("x1", (d: any) => d.source.x)
                    .attr("y1", (d: any) => d.source.y)
                    .attr("x2", (d: any) => d.target.x)
                    .attr("y2", (d: any) => d.target.y);

                nodeGroup
                    .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
            });
        }
        
        setIsLoading(false);
        
        return () => {
            d3.select(".d3-tooltip").remove();
        };

    }, [chartDataString, view, theme.visualizationSettings]);

    const handleExportSVG = () => {
        if (!svgRef.current) return;
        const svgData = new XMLSerializer().serializeToString(svgRef.current);
        const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `staffing_${view}_${selectedMonth}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportPNG = () => {
        if (!svgRef.current) return;
        const svg = svgRef.current;
        const { width, height } = svg.viewBox.baseVal;
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const svgData = new XMLSerializer().serializeToString(svg);
        const img = new Image();
        img.onload = () => {
            ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('color-scheme') === 'dark' ? '#0f172a' : '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            const pngUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = pngUrl;
            link.download = `staffing_${view}_${selectedMonth}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    };


    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">Visualizzazione Staffing</h1>
            
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                <div>
                    <label className="text-sm font-medium mr-2">Mese:</label>
                    <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="form-select text-sm py-1">
                        {monthOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
                <div className="flex items-center space-x-1 bg-gray-200 dark:bg-gray-700 p-1 rounded-md">
                    <button onClick={() => setView('sankey')} className={`px-3 py-1 text-sm font-medium rounded-md capitalize ${view === 'sankey' ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow' : 'text-gray-600 dark:text-gray-300'}`}>Diagramma di Flusso</button>
                    <button onClick={() => setView('network')} className={`px-3 py-1 text-sm font-medium rounded-md capitalize ${view === 'network' ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow' : 'text-gray-600 dark:text-gray-300'}`}>Mappa delle Connessioni</button>
                </div>
                <div className="flex items-center space-x-2">
                    <button onClick={handleExportSVG} className="flex items-center px-3 py-1.5 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50" disabled={isLoading || chartData.nodes.length === 0}>
                        <span className="mr-2">📥</span>
                        SVG
                    </button>
                    <button onClick={handleExportPNG} className="flex items-center px-3 py-1.5 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50" disabled={isLoading || chartData.nodes.length === 0}>
                        <span className="mr-2">📥</span>
                        PNG
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 overflow-auto">
                {isLoading && (
                    <div className="flex justify-center items-center h-96">
                        <SpinnerIcon className="w-12 h-12 text-blue-500" />
                    </div>
                )}
                {!isLoading && chartData.nodes.length === 0 && (
                    <div className="flex justify-center items-center h-96 text-gray-500">
                        Nessun dato di allocazione trovato per il mese selezionato.
                    </div>
                )}
                {!isLoading && chartData.nodes.length > 0 && (
                    <svg ref={svgRef}></svg>
                )}
            </div>
            <style>{`.form-select { display: inline-block; border-radius: 0.375rem; border: 1px solid #D1D5DB; background-color: #FFFFFF; padding: 0.5rem 2rem 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; } .dark .form-select { border-color: #4B5563; background-color: #374151; color: #F9FAFB; }`}</style>
        </div>
    );
};

export default StaffingVisualizationPage;