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
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY } from 'd3-force';
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

    const zoomBehavior = useRef<any>(null);
    const gRef = useRef<SVGGElement>(null);

    // Setup Zoom Behavior on the parent SVG
    useEffect(() => {
        if (!svgRef.current || !gRef.current) return;
        const svg = select(svgRef.current);
        const g = select(gRef.current);
        
        zoomBehavior.current = d3Zoom()
            .scaleExtent([0.1, 4])
            .on("zoom", (event: any) => {
                g.attr("transform", event.transform);
            });
        
        svg.call(zoomBehavior.current);
        
        // Initial center
        svg.call(zoomBehavior.current.transform, zoomIdentity.translate(width / 2, height / 2));
    }, [width, height, svgRef]);

    // Handle External Zoom Actions
    useEffect(() => {
        if (!svgRef.current || !zoomBehavior.current) return;
        const svg = select(svgRef.current);
        
        if (zoomAction.type === 'in') {
            svg.transition().duration(300).call(zoomBehavior.current.scaleBy, 1.2);
        } else if (zoomAction.type === 'out') {
            svg.transition().duration(300).call(zoomBehavior.current.scaleBy, 0.8);
        } else if (zoomAction.type === 'reset') {
            svg.transition().duration(750).call(zoomBehavior.current.transform, zoomIdentity.translate(width / 2, height / 2));
        }
    }, [zoomAction, width, height, svgRef]);

    // Run Force Simulation
    useEffect(() => {
        if (!gRef.current || nodes.length === 0) return;
        
        const g = select(gRef.current);
        g.selectAll("*").remove(); // Clean up previous render

        const colorScale = scaleOrdinal<string, string>()
            .domain(['resource', 'skill'])
            .range([theme.primary, theme.secondary]);

        const simulation = forceSimulation(nodes)
            .force("link", forceLink(links).id((d: any) => d.id).distance(100))
            .force("charge", forceManyBody().strength(-300))
            .force("collide", forceCollide(30))
            .force("x", forceX(0).strength(0.05))
            .force("y", forceY(0).strength(0.05));

        const link = g.append("g")
            .attr("stroke", theme.outlineVariant)
            .attr("stroke-opacity", 0.6)
            .selectAll("line")
            .data(links)
            .join("line")
            .attr("stroke-width", (d: any) => Math.sqrt(d.value || 1));

        const node = g.append("g")
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5)
            .selectAll("circle")
            .data(nodes)
            .join("circle")
            .attr("r", (d: any) => d.type === 'resource' ? 8 : 5)
            .attr("fill", (d: any) => colorScale(d.type))
            .call(d3Drag()
                .on("start", (event: any, d: any) => {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                })
                .on("drag", (event: any, d: any) => {
                    d.fx = event.x;
                    d.fy = event.y;
                })
                .on("end", (event: any, d: any) => {
                    if (!event.active) simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                }) as any);

        node.append("title")
            .text((d: any) => d.name);
            
        // Labels
        const labels = g.append("g")
            .attr("class", "labels")
            .selectAll("text")
            .data(nodes)
            .join("text")
            .attr("dx", 12)
            .attr("dy", 4)
            .text((d: any) => d.name)
            .style("font-size", "10px")
            .style("fill", theme.onSurface)
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
    }, [nodes, links, theme]);

    // IMPORTANT: Return a valid React Element (SVG Group)
    return <g ref={gRef} />;
};

const SkillAnalysisPage: React.FC = () => {
    const { resources, resourceSkills, skills } = useEntitiesContext();
    const { theme: appTheme } = useTheme();
    const isDarkMode = document.documentElement.classList.contains('dark');
    const currentPalette = isDarkMode ? appTheme.dark : appTheme.light;

    const [view, setView] = useState<ViewMode>('network');
    const [zoomAction, setZoomAction] = useState<ZoomAction>({ type: 'reset', ts: 0 });
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

    useEffect(() => {
        if (containerRef.current) {
            setDimensions({
                width: containerRef.current.clientWidth,
                height: containerRef.current.clientHeight
            });
        }
        
        const handleResize = () => {
            if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight
                });
            }
        };
        
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Prepare Data for Network
    const graphData = useMemo(() => {
        if (resources.length === 0) return { nodes: [], links: [] };

        const nodes: any[] = [];
        const links: any[] = [];
        const addedNodes = new Set();

        resources.forEach(r => {
            if (!r.resigned) {
                nodes.push({ id: `res_${r.id}`, name: r.name, type: 'resource' });
                addedNodes.add(`res_${r.id}`);
            }
        });

        resourceSkills.forEach(rs => {
            const skill = skills.find(s => s.id === rs.skillId);
            const res = resources.find(r => r.id === rs.resourceId);
            
            if (skill && res && !res.resigned) {
                const skillNodeId = `skill_${skill.id}`;
                if (!addedNodes.has(skillNodeId)) {
                    nodes.push({ id: skillNodeId, name: skill.name, type: 'skill' });
                    addedNodes.add(skillNodeId);
                }
                
                links.push({
                    source: `res_${res.id}`,
                    target: skillNodeId,
                    value: rs.level || 1
                });
            }
        });

        return { nodes, links };
    }, [resources, resourceSkills, skills]);

    const handleZoom = (type: 'in' | 'out' | 'reset') => {
        setZoomAction({ type, ts: Date.now() });
    };

    return (
        <div className="flex flex-col h-full space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-center bg-surface p-4 rounded-2xl shadow gap-4">
                <h1 className="text-2xl font-bold text-on-surface">Analisi Competenze</h1>
                <div className="flex items-center space-x-2">
                    <select 
                        value={view} 
                        onChange={(e) => setView(e.target.value as ViewMode)} 
                        className="form-select text-sm py-1"
                    >
                        <option value="network">Network Graph</option>
                        <option value="heatmap">Heatmap (Coming Soon)</option>
                    </select>
                    <button onClick={() => handleZoom('in')} className="p-2 hover:bg-surface-container rounded-full text-on-surface-variant"><span className="material-symbols-outlined">add</span></button>
                    <button onClick={() => handleZoom('out')} className="p-2 hover:bg-surface-container rounded-full text-on-surface-variant"><span className="material-symbols-outlined">remove</span></button>
                    <button onClick={() => handleZoom('reset')} className="p-2 hover:bg-surface-container rounded-full text-on-surface-variant"><span className="material-symbols-outlined">center_focus_strong</span></button>
                </div>
            </div>

            <div className="flex-grow bg-surface rounded-2xl shadow overflow-hidden relative" ref={containerRef} style={{ minHeight: '500px' }}>
                <svg ref={svgRef} width="100%" height="100%" className="cursor-grab active:cursor-grabbing">
                    {view === 'network' && graphData.nodes.length > 0 && (
                        <SkillForceGraph 
                            nodes={graphData.nodes} 
                            links={graphData.links} 
                            width={dimensions.width} 
                            height={dimensions.height}
                            theme={currentPalette}
                            zoomAction={zoomAction}
                            svgRef={svgRef}
                        />
                    )}
                    {(view !== 'network' || graphData.nodes.length === 0) && (
                        <text x="50%" y="50%" textAnchor="middle" fill={currentPalette.onSurfaceVariant}>
                            {graphData.nodes.length === 0 ? 'Nessun dato disponibile.' : `Visualizzazione ${view} non ancora implementata.`}
                        </text>
                    )}
                </svg>
            </div>
        </div>
    );
};

export default SkillAnalysisPage;
