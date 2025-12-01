/**
 * @file SkillAnalysisPage.tsx
 * @description Pagina di analisi avanzata delle competenze con visualizzazioni grafiche.
 * Supporta filtri globali e controlli di zoom unificati.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { select } from 'd3-selection';
import { zoom as d3Zoom, zoomIdentity } from 'd3-zoom';
import { scaleOrdinal } from 'd3-scale';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';
import { drag as d3Drag } from 'd3-drag';
import 'd3-transition';

type ViewMode = 'network' | 'heatmap' | 'chord' | 'radar' | 'dendrogram' | 'packing' | 'sankey' | 'bubble';
type ZoomAction = { type: 'in' | 'out' | 'reset'; ts: number };

// --- Components for each visualization ---

// 1. Force-Directed Graph (Skill Network)
const SkillForceGraph: React.FC<{ 
    nodes: any[], 
    links: any[], 
    width: number, 
    height: number,
    theme: any,
    zoomAction: ZoomAction,
    svgRef: React.RefObject<SVGSVGElement>
}> = ({ nodes, links, width, height, theme, zoomAction, svgRef }) => {

    const gRef = useRef<SVGSVGElement>(null);

    // Zoom handling
    useEffect(() => {
        if (!svgRef.current || !gRef.current) return;
        const svg = select(svgRef.current);
        const g = select(gRef.current as any);

        const zoom = d3Zoom()
            .scaleExtent([0.1, 8])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(zoom as any);

        if (zoomAction.type === 'reset') {
            svg.transition().duration(750).call(zoom.transform as any, zoomIdentity);
        } else if (zoomAction.type === 'in') {
            svg.transition().duration(750).call(zoom.scaleBy as any, 1.2);
        } else if (zoomAction.type === 'out') {
            svg.transition().duration(750).call(zoom.scaleBy as any, 0.8);
        }

    }, [zoomAction, svgRef]);

    // Force Simulation
    useEffect(() => {
        if (!nodes.length || !gRef.current) return;

        const g = select(gRef.current as any);
        g.selectAll("*").remove(); // Clear previous

        const isDark = theme.mode === 'dark';
        const palette = isDark ? theme.dark : theme.light;

        const simulation = forceSimulation(nodes)
            .force("link", forceLink(links).id((d: any) => d.id).distance(100))
            .force("charge", forceManyBody().strength(-300))
            .force("center", forceCenter(width / 2, height / 2))
            .force("collide", forceCollide(30));

        const link = g.append("g")
            .attr("stroke", palette.outline)
            .attr("stroke-opacity", 0.6)
            .selectAll("line")
            .data(links)
            .join("line")
            .attr("stroke-width", (d: any) => Math.sqrt(d.value || 1));

        const colorScale = scaleOrdinal<string>()
            .domain(['Skill', 'Resource', 'Project'])
            .range([palette.primary, palette.tertiary, palette.secondary]);

        const node = g.append("g")
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5)
            .selectAll("circle")
            .data(nodes)
            .join("circle")
            .attr("r", (d: any) => d.group === 'Skill' ? 8 : 5)
            .attr("fill", (d: any) => colorScale(d.group))
            .call(d3Drag()
                .on("start", (event, d: any) => {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                })
                .on("drag", (event, d: any) => {
                    d.fx = event.x;
                    d.fy = event.y;
                })
                .on("end", (event, d: any) => {
                    if (!event.active) simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                }) as any);

        node.append("title")
            .text((d: any) => d.id);

        const labels = g.append("g")
            .selectAll("text")
            .data(nodes)
            .join("text")
            .attr("dx", 12)
            .attr("dy", ".35em")
            .text((d: any) => d.id)
            .style("font-size", "10px")
            .style("fill", palette.onSurface)
            .style("pointer-events", "none");

        simulation.on("tick", () => {
            link
                .attr("x1", (d: any) => d.source.x)
                .attr("y1", (d: any) => d.source.y)
                .attr("x2", (d: any) => d.target.x)
                .attr("y2", (d: any) => d.target.y);

            node
                .attr("cx", (d: any) => d.x)
                .attr("cy", (d: any) => d.y);
            
            labels
                .attr("x", (d: any) => d.x)
                .attr("y", (d: any) => d.y);
        });

        return () => {
            simulation.stop();
        };
    }, [nodes, links, width, height, theme]);

    return (
        <g ref={gRef as any}></g>
    );
};

const SkillAnalysisPage: React.FC = () => {
    const { skills, resources, resourceSkills } = useEntitiesContext();
    const { theme } = useTheme();
    const svgRef = useRef<SVGSVGElement>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('network');
    const [zoomAction, setZoomAction] = useState<ZoomAction>({ type: 'reset', ts: 0 });

    // Prepare Data for Network Graph
    const graphData = useMemo(() => {
        const nodes: any[] = [];
        const links: any[] = [];
        const nodeSet = new Set();

        // Add Skills
        skills.forEach(s => {
            if (!nodeSet.has(s.id)) {
                nodes.push({ id: s.name, group: 'Skill' }); // Using name as ID for visualization simplicity
                nodeSet.add(s.id); 
            }
        });

        // Add Resources and Links
        resources.filter(r => !r.resigned).forEach(r => {
            const mySkills = resourceSkills.filter(rs => rs.resourceId === r.id);
            if (mySkills.length > 0) {
                nodes.push({ id: r.name, group: 'Resource' });
                mySkills.forEach(rs => {
                    const skill = skills.find(s => s.id === rs.skillId);
                    if (skill) {
                        links.push({ source: r.name, target: skill.name, value: rs.level || 1 });
                    }
                });
            }
        });

        return { nodes, links };
    }, [skills, resources, resourceSkills]);

    const handleZoom = (type: 'in' | 'out' | 'reset') => {
        setZoomAction({ type, ts: Date.now() });
    };

    return (
        <div className="h-full flex flex-col space-y-4">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-on-surface">Analisi Competenze</h1>
                <div className="flex gap-2">
                    <button onClick={() => handleZoom('in')} className="p-2 rounded bg-surface-container hover:bg-surface-container-high text-on-surface"><span className="material-symbols-outlined">add</span></button>
                    <button onClick={() => handleZoom('out')} className="p-2 rounded bg-surface-container hover:bg-surface-container-high text-on-surface"><span className="material-symbols-outlined">remove</span></button>
                    <button onClick={() => handleZoom('reset')} className="p-2 rounded bg-surface-container hover:bg-surface-container-high text-on-surface"><span className="material-symbols-outlined">center_focus_strong</span></button>
                </div>
            </div>

            <div className="flex-grow bg-surface rounded-2xl shadow overflow-hidden relative border border-outline-variant">
                {viewMode === 'network' && (
                    <svg ref={svgRef} className="w-full h-full" style={{ minHeight: '600px' }}>
                        <SkillForceGraph 
                            nodes={graphData.nodes} 
                            links={graphData.links} 
                            width={1200} // Approximate, d3 handles centering usually
                            height={800} 
                            theme={theme}
                            zoomAction={zoomAction}
                            svgRef={svgRef}
                        />
                    </svg>
                )}
                {viewMode !== 'network' && (
                    <div className="flex items-center justify-center h-full text-on-surface-variant">
                        Vista {viewMode} in lavorazione...
                    </div>
                )}
            </div>
        </div>
    );
};

export default SkillAnalysisPage;