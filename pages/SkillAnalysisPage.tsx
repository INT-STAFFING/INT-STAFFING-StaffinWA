/**
 * @file SkillAnalysisPage.tsx
 * @description Pagina di analisi avanzata delle competenze con 4 visualizzazioni: Network, Heatmap, Chord, Radar.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { select } from 'd3-selection';
import { zoom as d3Zoom } from 'd3-zoom';
import { scaleOrdinal, scaleBand, scaleSequential, scaleLinear } from 'd3-scale';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY } from 'd3-force';
import { drag as d3Drag } from 'd3-drag';
import { interpolateBlues, schemeCategory10 } from 'd3-scale-chromatic';
import { axisLeft, axisTop } from 'd3-axis';
import { max, descending } from 'd3-array';
import { chord as d3Chord, ribbon as d3Ribbon } from 'd3-chord';
import { arc as d3Arc, lineRadial } from 'd3-shape';
import { rgb } from 'd3-color';
import SearchableSelect from '../components/SearchableSelect';

// --- Components for each visualization ---

// 1. Force-Directed Graph (Skill Network)
const SkillForceGraph: React.FC<{ 
    nodes: any[], 
    links: any[], 
    width: number, 
    height: number,
    theme: any
}> = ({ nodes, links, width, height, theme }) => {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current || nodes.length === 0) return;
        
        const svg = select(svgRef.current);
        svg.selectAll("*").remove(); // Clean previous

        const g = svg.append("g");
        
        // Zoom behavior
        const zoomBehavior = d3Zoom()
            .scaleExtent([0.1, 4])
            .on("zoom", (event: any) => g.attr("transform", event.transform));
        
        svg.call(zoomBehavior as any);

        const color = scaleOrdinal<string, string>()
            .domain(['skill', 'resource', 'project'])
            .range([theme.tertiary, theme.primary, '#e67e22']); // Greenish (Skill), Blue (Res), Orange (Proj)

        const simulation = forceSimulation(nodes)
            .force("link", forceLink(links).id((d: any) => d.id).distance(100))
            .force("charge", forceManyBody().strength(-300))
            .force("center", forceCenter(width / 2, height / 2))
            .force("collide", forceCollide(30));

        const link = g.append("g")
            .attr("stroke", theme.outline)
            .attr("stroke-opacity", 0.4)
            .selectAll("line")
            .data(links)
            .join("line")
            .attr("stroke-width", 1);

        const node = g.append("g")
            .selectAll(".node")
            .data(nodes)
            .join("g")
            .attr("class", "node")
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
                }) as any
            );

        node.append("circle")
            .attr("r", (d: any) => d.type === 'skill' ? 8 : d.type === 'project' ? 12 : 6)
            .attr("fill", (d: any) => color(d.type))
            .attr("stroke", theme.surface)
            .attr("stroke-width", 1.5);

        node.append("text")
            .text((d: any) => d.name)
            .attr("x", 12)
            .attr("y", 4)
            .attr("font-size", "10px")
            .attr("fill", theme.onSurface)
            .style("pointer-events", "none");

        node.append("title")
            .text((d: any) => `${d.type.toUpperCase()}: ${d.name}`);

        simulation.on("tick", () => {
            link
                .attr("x1", (d: any) => d.source.x)
                .attr("y1", (d: any) => d.source.y)
                .attr("x2", (d: any) => d.target.x)
                .attr("y2", (d: any) => d.target.y);

            node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
        });

        return () => { simulation.stop(); };
    }, [nodes, links, width, height, theme]);

    return <svg ref={svgRef} width={width} height={height} className="w-full h-full bg-surface-container-low rounded-xl border border-outline-variant" />;
};

// 2. Matrix Heatmap
const SkillHeatmap: React.FC<{
    data: { resource: string; skill: string; value: number }[],
    resources: string[],
    skills: string[],
    theme: any
}> = ({ data, resources, skills, theme }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    
    useEffect(() => {
        if (!svgRef.current || data.length === 0) return;
        
        const margin = { top: 100, right: 25, bottom: 30, left: 150 };
        const cellSize = 30;
        const width = skills.length * cellSize + margin.left + margin.right;
        const height = resources.length * cellSize + margin.top + margin.bottom;

        const svg = select(svgRef.current)
            .attr("width", width)
            .attr("height", height)
            .html(null); // clear

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Scales
        const x = scaleBand()
            .range([0, skills.length * cellSize])
            .domain(skills)
            .padding(0.05);

        const y = scaleBand()
            .range([0, resources.length * cellSize])
            .domain(resources)
            .padding(0.05);

        const colorScale = scaleSequential()
            .interpolator(interpolateBlues)
            .domain([0, max(data, d => d.value) || 100]);

        // Rows (Resources)
        g.append("g")
            .call(axisLeft(y))
            .selectAll("text")
            .attr("fill", theme.onSurface)
            .style("font-size", "11px");

        // Columns (Skills)
        g.append("g")
            .call(axisTop(x))
            .selectAll("text")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "start")
            .attr("dx", "0.5em")
            .attr("dy", "-0.5em")
            .attr("fill", theme.onSurface)
            .style("font-size", "11px");
        
        // Tooltip
        const tooltip = select("body").append("div")
            .attr("class", "d3-tooltip")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background", theme.inverseSurface)
            .style("color", theme.inverseOnSurface)
            .style("padding", "5px")
            .style("border-radius", "4px")
            .style("font-size", "10px");

        // Cells
        g.selectAll()
            .data(data, (d: any) => d.resource + ':' + d.skill)
            .enter()
            .append("rect")
            .attr("x", (d: any) => x(d.skill) || 0)
            .attr("y", (d: any) => y(d.resource) || 0)
            .attr("width", x.bandwidth())
            .attr("height", y.bandwidth())
            .style("fill", (d: any) => colorScale(d.value))
            .on("mouseover", (event, d: any) => {
                tooltip.style("visibility", "visible").text(`${d.resource} - ${d.skill}: ${d.value.toFixed(0)} days`);
            })
            .on("mousemove", (event) => {
                tooltip.style("top", (event.pageY - 10) + "px").style("left", (event.pageX + 10) + "px");
            })
            .on("mouseout", () => tooltip.style("visibility", "hidden"));

        return () => { tooltip.remove(); };
    }, [data, resources, skills, theme]);

    return (
        <div className="overflow-auto h-[600px] w-full bg-surface-container-low rounded-xl border border-outline-variant">
            <svg ref={svgRef}></svg>
        </div>
    );
};

// 3. Chord Diagram (Skill Co-occurrence)
const SkillChordDiagram: React.FC<{
    matrix: number[][],
    names: string[],
    width: number,
    height: number,
    theme: any
}> = ({ matrix, names, width, height, theme }) => {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current || matrix.length === 0) return;

        const svg = select(svgRef.current);
        svg.selectAll("*").remove();

        const outerRadius = Math.min(width, height) * 0.5 - 60;
        const innerRadius = outerRadius - 20;

        const chordGenerator = d3Chord()
            .padAngle(0.05)
            .sortSubgroups(descending);

        const arcGenerator = d3Arc()
            .innerRadius(innerRadius)
            .outerRadius(outerRadius);

        const ribbonGenerator = d3Ribbon()
            .radius(innerRadius);

        const color = scaleOrdinal(schemeCategory10);

        const g = svg.append("g")
            .attr("transform", `translate(${width / 2},${height / 2})`);

        const chords = chordGenerator(matrix);

        // Groups (Arcs)
        const group = g.append("g")
            .selectAll("g")
            .data(chords.groups)
            .join("g");

        group.append("path")
            .attr("fill", (d: any) => color(d.index.toString()))
            .attr("stroke", (d: any) => rgb(color(d.index.toString()) as string).darker().toString())
            .attr("d", arcGenerator as any);

        // Labels
        group.append("text")
            .each((d: any) => { d.angle = (d.startAngle + d.endAngle) / 2; })
            .attr("dy", ".35em")
            .attr("transform", (d: any) => `
                rotate(${(d.angle * 180 / Math.PI - 90)})
                translate(${outerRadius + 5})
                ${d.angle > Math.PI ? "rotate(180)" : ""}
            `)
            .attr("text-anchor", (d: any) => d.angle > Math.PI ? "end" : "start")
            .text((d: any) => names[d.index])
            .style("font-size", "10px")
            .attr("fill", theme.onSurface);

        // Ribbons
        g.append("g")
            .attr("fill-opacity", 0.67)
            .selectAll("path")
            .data(chords)
            .join("path")
            .attr("d", ribbonGenerator as any)
            .attr("fill", (d: any) => color(d.target.index.toString()))
            .attr("stroke", (d: any) => rgb(color(d.target.index.toString()) as string).darker().toString());

    }, [matrix, names, width, height, theme]);

    return <svg ref={svgRef} width={width} height={height} className="bg-surface-container-low rounded-xl border border-outline-variant mx-auto" />;
};

// 4. Radar Chart
const SkillRadarChart: React.FC<{
    data: { axis: string; value: number }[],
    width: number,
    height: number,
    theme: any
}> = ({ data, width, height, theme }) => {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current || data.length === 0) return;

        const svg = select(svgRef.current);
        svg.selectAll("*").remove();

        const margin = 50;
        const radius = Math.min(width, height) / 2 - margin;
        const angleSlice = Math.PI * 2 / data.length;

        // Scale
        const rScale = scaleLinear()
            .range([0, radius])
            .domain([0, 100]); // Normalized 0-100

        const g = svg.append("g")
            .attr("transform", `translate(${width/2},${height/2})`);

        // Circular grid
        const levels = 5;
        for(let i=0; i<levels; i++){
            const levelFactor = radius * ((i+1)/levels);
            g.selectAll(".levels")
             .data(data)
             .enter()
             .append("line")
             .attr("x1", (d, i) => levelFactor * Math.cos(angleSlice*i - Math.PI/2))
             .attr("y1", (d, i) => levelFactor * Math.sin(angleSlice*i - Math.PI/2))
             .attr("x2", (d, i) => levelFactor * Math.cos(angleSlice*(i+1) - Math.PI/2))
             .attr("y2", (d, i) => levelFactor * Math.sin(angleSlice*(i+1) - Math.PI/2))
             .attr("class", "line")
             .style("stroke", theme.outline)
             .style("stroke-opacity", "0.3")
             .style("stroke-width", "1px");
        }

        // Axes
        const axis = g.selectAll(".axis")
            .data(data)
            .enter()
            .append("g")
            .attr("class", "axis");

        axis.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", (d, i) => rScale(100) * Math.cos(angleSlice*i - Math.PI/2))
            .attr("y2", (d, i) => rScale(100) * Math.sin(angleSlice*i - Math.PI/2))
            .attr("class", "line")
            .style("stroke", theme.outline)
            .style("stroke-width", "1px");

        axis.append("text")
            .attr("class", "legend")
            .style("font-size", "10px")
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .attr("x", (d, i) => rScale(115) * Math.cos(angleSlice*i - Math.PI/2))
            .attr("y", (d, i) => rScale(115) * Math.sin(angleSlice*i - Math.PI/2))
            .text(d => d.axis)
            .attr("fill", theme.onSurface);

        // Radar Area
        const radarLineGenerator = lineRadial<{ axis: string; value: number }>()
            .radius(d => rScale(d.value))
            .angle((d, i) => i * angleSlice);
            
        g.append("path")
            .datum(data)
            .attr("d", radarLineGenerator as any)
            .style("fill", theme.primary)
            .style("fill-opacity", 0.5)
            .style("stroke", theme.primary)
            .style("stroke-width", 2);

    }, [data, width, height, theme]);

    return <svg ref={svgRef} width={width} height={height} className="bg-surface-container-low rounded-xl border border-outline-variant mx-auto" />;
};


// --- Main Page Component ---

const SkillAnalysisPage: React.FC = () => {
    const { resources, skills, projects, getResourceComputedSkills, projectSkills } = useEntitiesContext();
    const { theme: appTheme, mode } = useTheme();
    const theme = mode === 'light' ? appTheme.light : appTheme.dark;

    const [activeTab, setActiveTab] = useState<'network' | 'heatmap' | 'chord' | 'radar'>('network');
    const [selectedResourceId, setSelectedResourceId] = useState<string>('');
    
    // --- Data Preparation ---

    // 1. Network Data
    const networkData = useMemo(() => {
        const nodes: any[] = [];
        const links: any[] = [];
        const nodeSet = new Set();

        resources.forEach(r => {
            if(!r.resigned) {
                nodes.push({ id: r.id, name: r.name, type: 'resource' });
                nodeSet.add(r.id);
            }
        });
        
        skills.forEach(s => {
            nodes.push({ id: s.id, name: s.name, type: 'skill' });
            nodeSet.add(s.id);
        });

        // Connect Res -> Skills
        resources.forEach(r => {
            if(r.resigned) return;
            const compSkills = getResourceComputedSkills(r.id!);
            compSkills.forEach(cs => {
                if(cs.manualDetails || cs.inferredDays > 50) { // Filter noise
                    links.push({ source: r.id, target: cs.skill.id, value: 1 });
                }
            });
        });

        // Connect Proj -> Skills
        projects.forEach(p => {
             if(p.status === 'Completato') return; // Skip completed
             nodes.push({ id: p.id, name: p.name, type: 'project' });
             nodeSet.add(p.id);
             const pSkills = projectSkills.filter(ps => ps.projectId === p.id);
             pSkills.forEach(ps => {
                 if(nodeSet.has(ps.skillId)) {
                     links.push({ source: p.id, target: ps.skillId, value: 1 });
                 }
             });
        });

        return { nodes, links };
    }, [resources, skills, projects, getResourceComputedSkills, projectSkills]);

    // 2. Heatmap Data
    const heatmapData = useMemo(() => {
        const activeResources = resources.filter(r => !r.resigned).slice(0, 30); // Limit for perf
        const topSkills = skills.slice(0, 20); // Limit
        const data: any[] = [];
        
        activeResources.forEach(r => {
            const compSkills = getResourceComputedSkills(r.id!);
            topSkills.forEach(s => {
                const found = compSkills.find(cs => cs.skill.id === s.id);
                const val = found ? (found.manualDetails ? 100 : Math.min(found.inferredDays, 100)) : 0;
                if (val > 0) {
                    data.push({ resource: r.name, skill: s.name, value: val });
                }
            });
        });
        
        return {
            data,
            resources: activeResources.map(r => r.name),
            skills: topSkills.map(s => s.name)
        };
    }, [resources, skills, getResourceComputedSkills]);

    // 3. Chord Data (Skill Co-occurrence)
    const chordData = useMemo(() => {
        const topSkills = skills.slice(0, 15); // Limit for clean chart
        const names = topSkills.map(s => s.name);
        const idToIndex = new Map(topSkills.map((s, i) => [s.id, i]));
        const size = topSkills.length;
        const matrix = Array(size).fill(0).map(() => Array(size).fill(0));

        projects.forEach(p => {
            const pSkills = projectSkills.filter(ps => ps.projectId === p.id).map(ps => ps.skillId);
            for(let i = 0; i < pSkills.length; i++) {
                for(let j = i + 1; j < pSkills.length; j++) {
                    const idx1 = idToIndex.get(pSkills[i]);
                    const idx2 = idToIndex.get(pSkills[j]);
                    if (idx1 !== undefined && idx2 !== undefined) {
                        matrix[idx1][idx2]++;
                        matrix[idx2][idx1]++;
                    }
                }
            }
        });

        return { matrix, names };
    }, [skills, projects, projectSkills]);

    // 4. Radar Data
    const radarData = useMemo(() => {
        if (!selectedResourceId) return [];
        const compSkills = getResourceComputedSkills(selectedResourceId);
        // Get top 6 skills
        const sorted = compSkills.sort((a,b) => (b.manualDetails ? 1000 : b.inferredDays) - (a.manualDetails ? 1000 : a.inferredDays)).slice(0, 8);
        
        return sorted.map(cs => ({
            axis: cs.skill.name,
            value: cs.manualDetails ? 100 : Math.min((cs.inferredDays / 100) * 100, 90) // Normalize to 100
        }));
    }, [selectedResourceId, getResourceComputedSkills]);

    const resourceOptions = useMemo(() => resources.filter(r => !r.resigned).map(r => ({ value: r.id!, label: r.name })), [resources]);

    return (
        <div className="flex flex-col h-full">
            <h1 className="text-3xl font-bold text-on-surface mb-6">Analisi Grafica Competenze</h1>

            <div className="flex border-b border-outline-variant mb-6">
                <button onClick={() => setActiveTab('network')} className={`px-6 py-3 font-medium text-sm ${activeTab === 'network' ? 'border-b-2 border-primary text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>Network</button>
                <button onClick={() => setActiveTab('heatmap')} className={`px-6 py-3 font-medium text-sm ${activeTab === 'heatmap' ? 'border-b-2 border-primary text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>Heatmap</button>
                <button onClick={() => setActiveTab('chord')} className={`px-6 py-3 font-medium text-sm ${activeTab === 'chord' ? 'border-b-2 border-primary text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>Co-Occorrenza</button>
                <button onClick={() => setActiveTab('radar')} className={`px-6 py-3 font-medium text-sm ${activeTab === 'radar' ? 'border-b-2 border-primary text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>Radar (Profilo)</button>
            </div>

            <div className="flex-grow">
                {activeTab === 'network' && (
                    <div className="h-[600px]">
                        <p className="text-sm text-on-surface-variant mb-2">Relazioni tra Risorse (Blu), Competenze (Viola) e Progetti (Arancione). Zoomabile e trascinabile.</p>
                        <SkillForceGraph nodes={networkData.nodes} links={networkData.links} width={1200} height={600} theme={theme} />
                    </div>
                )}

                {activeTab === 'heatmap' && (
                    <div>
                        <p className="text-sm text-on-surface-variant mb-2">Distribuzione competenze per risorsa (top 30 risorse x top 20 skills).</p>
                        <SkillHeatmap data={heatmapData.data} resources={heatmapData.resources} skills={heatmapData.skills} theme={theme} />
                    </div>
                )}

                {activeTab === 'chord' && (
                    <div className="flex flex-col items-center">
                         <p className="text-sm text-on-surface-variant mb-4">Quali competenze vengono usate insieme negli stessi progetti?</p>
                        <SkillChordDiagram matrix={chordData.matrix} names={chordData.names} width={700} height={700} theme={theme} />
                    </div>
                )}

                {activeTab === 'radar' && (
                    <div className="flex flex-col items-center gap-6">
                        <div className="w-72">
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Seleziona Risorsa</label>
                            <SearchableSelect name="res" value={selectedResourceId} onChange={(_, v) => setSelectedResourceId(v)} options={resourceOptions} placeholder="Scegli una risorsa..." />
                        </div>
                        
                        {selectedResourceId ? (
                            radarData.length > 0 ? (
                                <SkillRadarChart data={radarData} width={500} height={500} theme={theme} />
                            ) : (
                                <p className="text-on-surface-variant mt-10">Nessuna competenza rilevata per questa risorsa.</p>
                            )
                        ) : (
                            <p className="text-on-surface-variant mt-10">Seleziona una risorsa per visualizzare il profilo delle competenze.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SkillAnalysisPage;