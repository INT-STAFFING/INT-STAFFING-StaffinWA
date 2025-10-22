/**
 * @file StaffingVisualizationPage.tsx
 * @description Pagina di visualizzazione grafica dello staffing con diagrammi Sankey e Network.
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { isHoliday } from '../utils/dateUtils';
import { SpinnerIcon } from '../components/icons';

// Informa TypeScript che D3 e d3-sankey sono disponibili come variabili globali (da CDN).
declare var d3: any;

type ViewMode = 'sankey' | 'network';

const StaffingVisualizationPage: React.FC = () => {
    const { resources, projects, contracts, assignments, contractProjects, companyCalendar } = useEntitiesContext();
    const { allocations } = useAllocationsContext();

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
        setIsLoading(true);
        if (resources.length === 0 || projects.length === 0) return { nodes: [], links: [] };

        const [year, month] = selectedMonth.split('-').map(Number);
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);

        const links: { source: string; target: string; value: number }[] = [];
        const projectTotals: { [projectId: string]: number } = {};

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
                links.push({
                    source: `res_${assignment.resourceId}`,
                    target: `proj_${assignment.projectId}`,
                    value: totalPersonDays,
                });
                projectTotals[assignment.projectId] = (projectTotals[assignment.projectId] || 0) + totalPersonDays;
            }
        });

        projects.forEach(project => {
            let contractId = project.contractId;
            if (!contractId) {
                const contractLink = contractProjects.find(cp => cp.projectId === project.id);
                if (contractLink) contractId = contractLink.contractId;
            }

            if (contractId && projectTotals[project.id!]) {
                links.push({
                    source: `proj_${project.id}`,
                    target: `cont_${contractId}`,
                    value: projectTotals[project.id!],
                });
            }
        });
        
        const activeNodeIds = new Set(links.flatMap(l => [l.source, l.target]));
        if (activeNodeIds.size === 0) return { nodes: [], links: [] };
        
        const activeNodes = [
            ...resources.map(r => ({ id: `res_${r.id}`, name: r.name, type: 'resource' })),
            ...projects.map(p => ({ id: `proj_${p.id}`, name: p.name, type: 'project' })),
            ...contracts.map(c => ({ id: `cont_${c.id}`, name: c.name, type: 'contract' })),
        ].filter(n => activeNodeIds.has(n.id));

        setIsLoading(false);
        return { nodes: activeNodes, links };

    }, [selectedMonth, resources, projects, contracts, assignments, allocations, contractProjects, companyCalendar]);
    
    useEffect(() => {
        if (!svgRef.current || chartData.nodes.length === 0) {
            if (svgRef.current) d3.select(svgRef.current).selectAll("*").remove();
            return;
        }

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const width = 1200;
        const height = 800;
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
            const sankey = d3.sankey()
                .nodeWidth(20)
                .nodePadding(10)
                .extent([[1, 5], [width - 1, height - 5]]);
            
            const { nodes, links } = sankey({
                nodes: chartData.nodes.map(d => ({ ...d })),
                links: chartData.links.map(d => ({ ...d }))
            });
            
            const color = d3.scaleOrdinal()
                .domain(['resource', 'project', 'contract'])
                .range(['#3b82f6', '#10b981', '#f97316']);

            svg.append("g")
                .selectAll("rect")
                .data(nodes)
                .join("rect")
                .attr("x", d => d.x0)
                .attr("y", d => d.y0)
                .attr("height", d => d.y1 - d.y0)
                .attr("width", d => d.x1 - d.x0)
                .attr("fill", d => color(d.type))
                .on("mouseover", (event, d) => {
                    tooltip.style("visibility", "visible").text(`${d.name}`);
                })
                .on("mousemove", (event) => {
                    tooltip.style("top", (event.pageY - 10) + "px").style("left", (event.pageX + 10) + "px");
                })
                .on("mouseout", () => {
                    tooltip.style("visibility", "hidden");
                });

            const link = svg.append("g")
                .attr("fill", "none")
                .attr("stroke-opacity", 0.5)
                .selectAll("g")
                .data(links)
                .join("g")
                .style("mix-blend-mode", "multiply");

            link.append("path")
                .attr("d", d3.sankeyLinkHorizontal())
                .attr("stroke", d => color(d.source.type))
                .attr("stroke-width", d => Math.max(1, d.width));
                
            link.on("mouseover", function(event, d) {
                    d3.select(this).attr("stroke-opacity", 0.8);
                    tooltip.style("visibility", "visible").text(`${d.source.name} → ${d.target.name}: ${d.value.toFixed(1)} G/U`);
                })
                .on("mousemove", (event) => {
                    tooltip.style("top", (event.pageY - 10) + "px").style("left", (event.pageX + 10) + "px");
                })
                .on("mouseout", function() {
                    d3.select(this).attr("stroke-opacity", 0.5);
                    tooltip.style("visibility", "hidden");
                });

            svg.append("g")
                .selectAll("text")
                .data(nodes)
                .join("text")
                .attr("x", d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
                .attr("y", d => (d.y1 + d.y0) / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
                .attr("font-size", "10px")
                .attr("fill", "#666")
                .text(d => d.name);
        
        } else { // network
             const color = d3.scaleOrdinal()
                .domain(['resource', 'project', 'contract'])
                .range(['#3b82f6', '#10b981', '#f97316']);

            const simulation = d3.forceSimulation(chartData.nodes)
                .force("link", d3.forceLink(chartData.links).id(d => d.id).distance(100))
                .force("charge", d3.forceManyBody().strength(-200))
                .force("center", d3.forceCenter(width / 2, height / 2));
                
            const link = svg.append("g")
                .attr("stroke", "#999")
                .attr("stroke-opacity", 0.6)
                .selectAll("line")
                .data(chartData.links)
                .join("line")
                .attr("stroke-width", d => Math.sqrt(d.value));

            const node = svg.append("g")
                .attr("stroke", "#fff")
                .attr("stroke-width", 1.5)
                .selectAll("circle")
                .data(chartData.nodes)
                .join("circle")
                .attr("r", 8)
                .attr("fill", d => color(d.type))
                .call(d3.drag()
                    .on("start", (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
                    .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
                    .on("end", (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
                );

            node.on("mouseover", (event, d) => {
                    tooltip.style("visibility", "visible").text(`${d.name}`);
                })
                .on("mousemove", (event) => {
                    tooltip.style("top", (event.pageY - 10) + "px").style("left", (event.pageX + 10) + "px");
                })
                .on("mouseout", () => {
                    tooltip.style("visibility", "hidden");
                });

            simulation.on("tick", () => {
                link
                    .attr("x1", d => d.source.x)
                    .attr("y1", d => d.source.y)
                    .attr("x2", d => d.target.x)
                    .attr("y2", d => d.target.y);

                node
                    .attr("cx", d => d.x)
                    .attr("cy", d => d.y);
            });
        }
        
        // Cleanup tooltip on component unmount
        return () => {
            d3.select(".d3-tooltip").remove();
        };

    }, [chartData, view]);

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
