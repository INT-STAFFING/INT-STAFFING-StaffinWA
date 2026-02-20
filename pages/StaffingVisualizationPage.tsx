
/**
 * @file StaffingVisualizationPage.tsx
 * @description Pagina di visualizzazione grafica dello staffing con diagrammi Sankey e Network.
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAllocationsContext } from '../context/AppContext';
import { useResourcesContext } from '../context/ResourcesContext';
import { useProjectsContext } from '../context/ProjectsContext';
import { useLookupContext } from '../context/LookupContext';
import { isHoliday } from '../utils/dateUtils';
import { SpinnerIcon } from '../components/icons';
import { useTheme } from '../context/ThemeContext';

type ViewMode = 'sankey' | 'network';

const StaffingVisualizationPage: React.FC = () => {
    const { projects, clients, contracts, assignments, contractProjects } = useProjectsContext();
    const { resources } = useResourcesContext();
    const { companyCalendar } = useLookupContext();
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
        
        const isDarkMode = document.documentElement.classList.contains('dark');
        const currentPalette = isDarkMode ? theme.dark : theme.light;

        const data = JSON.parse(chartDataString);

        if (data.nodes.length === 0) {
            setIsLoading(false);
            return;
        }

        const width = 1200;
        const height = view === 'sankey' ? 1600 : 800;

        const draw = async () => {
            // Dynamic Imports
            const [
                d3Selection, 
                d3Scale, 
                d3Zoom, 
                d3Force, 
                d3Drag, 
                d3Sankey,
                _d3Transition
            ] = await Promise.all([
                import('d3-selection'),
                import('d3-scale'),
                import('d3-zoom'),
                import('d3-force'),
                import('d3-drag'),
                import('d3-sankey'),
                import('d3-transition')
            ]);
            
            const svg = d3Selection.select(svgRef.current);
            svg.selectAll("*").remove();
            svg.attr("viewBox", `0 0 ${width} ${height}`);
            
            const tooltip = d3Selection.select("body").append("div")
                .attr("class", "d3-tooltip")
                .style("position", "absolute")
                .style("z-index", "10")
                .style("visibility", "hidden")
                .style("background", currentPalette.inverseSurface)
                .style("color", currentPalette.inverseOnSurface)
                .style("padding", "8px")
                .style("border-radius", "4px")
                .style("font-size", "12px");

            if (view === 'sankey') {
                const { nodeWidth, nodePadding, linkOpacity } = theme.visualizationSettings.sankey;

                const sankeyGenerator = d3Sankey.sankey()
                    .nodeWidth(nodeWidth)
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

                const { nodes, links } = sankeyGenerator(graph);
                
                const color = d3Scale.scaleOrdinal()
                    .domain(['resource', 'project', 'client', 'contract'])
                    .range([currentPalette.primary, currentPalette.tertiary, currentPalette.secondary, currentPalette.primaryContainer]);

                svg.append("g")
                    .selectAll("rect")
                    .data(nodes)
                    .join("rect")
                    .attr("x", (d: any) => d.x0)
                    .attr("y", (d: any) => d.y0)
                    .attr("height", (d: any) => d.y1 - d.y0)
                    .attr("width", (d: any) => d.x1 - d.x0)
                    .attr("fill", (d: any) => color(d.type) as string)
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
                    .attr("stroke-opacity", linkOpacity)
                    .selectAll("g")
                    .data(links)
                    .join("g")
                    .style("mix-blend-mode", "multiply");

                link.append("path")
                    .attr("d", d3Sankey.sankeyLinkHorizontal())
                    .attr("stroke", (d: any) => color(d.source.type) as string)
                    .attr("stroke-width", (d: any) => Math.max(1, d.width));
                    
                link.on("mouseover", function(event: any, d: any) {
                        d3Selection.select(this).attr("stroke-opacity", 0.8);
                        tooltip.style("visibility", "visible").text(`${d.source.name} → ${d.target.name}: ${d.value.toFixed(1)} G/U`);
                    })
                    .on("mousemove", (event: any) => {
                        tooltip.style("top", (event.pageY - 10) + "px").style("left", (event.pageX + 10) + "px");
                    })
                    .on("mouseout", function() {
                        d3Selection.select(this).attr("stroke-opacity", linkOpacity);
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
                    .attr("fill", currentPalette.onSurface)
                    .text((d: any) => d.name);
            
            } else { // network
                const { chargeStrength, linkDistance, centerStrength, nodeRadius } = theme.visualizationSettings.network;

                const zoomBehavior = d3Zoom.zoom()
                    .scaleExtent([0.1, 4])
                    .on("zoom", (event: any) => {
                        g.attr("transform", event.transform);
                    });
                
                const g = svg.append("g");
                svg.call(zoomBehavior as any);

                 const color = d3Scale.scaleOrdinal()
                    .domain(['resource', 'project', 'client', 'contract'])
                    .range([currentPalette.primary, currentPalette.tertiary, currentPalette.secondary, currentPalette.primaryContainer]);

                const simulation = d3Force.forceSimulation(data.nodes)
                    .force("link", d3Force.forceLink(data.links).id((d: any) => d.id).distance(linkDistance))
                    .force("charge", d3Force.forceManyBody().strength(chargeStrength))
                    .force("center", d3Force.forceCenter(width / 2, height / 2))
                    .force("x", d3Force.forceX(width / 2).strength(centerStrength))
                    .force("y", d3Force.forceY(height / 2).strength(centerStrength));
                    
                const link = g.append("g")
                    .attr("stroke", currentPalette.outline)
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
                    .call(d3Drag.drag()
                        .on("start", (event: any, d: any) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
                        .on("drag", (event: any, d: any) => { d.fx = event.x; d.fy = event.y; })
                        .on("end", (event: any, d: any) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }) as any
                    );

                nodeGroup.append("circle")
                    .attr("r", nodeRadius)
                    .attr("fill", (d: any) => color(d.type) as string)
                    .attr("stroke", currentPalette.surface)
                    .attr("stroke-width", 1.5);

                nodeGroup.append("text")
                    .text((d: any) => d.name)
                    .attr("x", 12)
                    .attr("y", 3)
                    .attr("font-size", "10px")
                    .attr("fill", currentPalette.onSurface);
                
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
        };

        draw();
        
        return () => {
             import('d3-selection').then(d3 => d3.select(".d3-tooltip").remove());
        };

    }, [chartDataString, view, theme.visualizationSettings, theme.dark, theme.light]);

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
            const isDarkMode = document.documentElement.classList.contains('dark');
            ctx.fillStyle = isDarkMode ? theme.dark.background : theme.light.background;
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
            <h1 className="text-3xl font-bold text-on-surface mb-6">Visualizzazione Staffing</h1>
            
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 p-4 bg-surface rounded-2xl shadow">
                <div>
                    <label className="text-sm font-medium mr-2 text-on-surface-variant">Mese:</label>
                    <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="form-select text-sm py-1">
                        {monthOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
                <div className="flex items-center space-x-1 bg-surface-container p-1 rounded-full">
                    <button onClick={() => setView('sankey')} className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${view === 'sankey' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant'}`}>Diagramma di Flusso</button>
                    <button onClick={() => setView('network')} className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${view === 'network' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant'}`}>Mappa delle Connessioni</button>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleExportSVG} className="flex items-center px-3 py-1.5 text-sm bg-secondary-container text-on-secondary-container rounded-full hover:opacity-90">
                        <span className="material-symbols-outlined mr-2 text-base">download</span> SVG
                    </button>
                    <button onClick={handleExportPNG} className="flex items-center px-3 py-1.5 text-sm bg-secondary-container text-on-secondary-container rounded-full hover:opacity-90">
                        <span className="material-symbols-outlined mr-2 text-base">download</span> PNG
                    </button>
                </div>
            </div>

            <div className="bg-surface rounded-2xl shadow p-4 overflow-auto relative min-h-[600px]">
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-surface/50 z-10">
                        <SpinnerIcon className="w-10 h-10 text-primary" />
                    </div>
                )}
                <svg ref={svgRef} width="100%" height="100%" className="min-w-[800px] min-h-[600px]"></svg>
                
                {chartData.nodes.length === 0 && !isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center text-on-surface-variant">
                        Nessun dato disponibile per il periodo selezionato.
                    </div>
                )}
            </div>
        </div>
    );
};

export default StaffingVisualizationPage;