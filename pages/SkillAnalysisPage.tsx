
/**
 * @file SkillAnalysisPage.tsx
 * @description Pagina di analisi avanzata delle competenze con 4 visualizzazioni: Network, Heatmap, Chord, Radar.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { select } from 'd3-selection';
import { zoom as d3Zoom, zoomIdentity } from 'd3-zoom';
import { scaleOrdinal, scaleBand, scaleSequential, scaleLinear } from 'd3-scale';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY } from 'd3-force';
import { drag as d3Drag } from 'd3-drag';
import { interpolateBlues, schemeCategory10 } from 'd3-scale-chromatic';
import { axisLeft, axisTop } from 'd3-axis';
import { max, descending } from 'd3-array';
import { chord as d3Chord, ribbon as d3Ribbon } from 'd3-chord';
import { arc as d3Arc, lineRadial, curveLinearClosed } from 'd3-shape';
import { rgb } from 'd3-color';
import SearchableSelect from '../components/SearchableSelect';
import 'd3-transition'; // Import transition to avoid crashes on interactions

type ViewMode = 'network' | 'heatmap' | 'chord' | 'radar';

// --- Helper to format label ---
const formatSkillLabel = (name: string, context?: string) => {
    return context ? `${name} (${context})` : name;
};

// --- Components for each visualization ---

// 1. Force-Directed Graph (Skill Network)
const SkillForceGraph: React.FC<{ 
    nodes: any[], 
    links: any[], 
    width: number, 
    height: number,
    theme: any,
    svgRef: React.RefObject<SVGSVGElement>
}> = ({ nodes, links, width, height, theme, svgRef }) => {

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

        // Color mapping: Resources = Primary, Projects = Orange, Skills = Based on Macro Category (Category10)
        const macroCategoryColor = scaleOrdinal(schemeCategory10);

        const getNodeColor = (d: any) => {
            if (d.type === 'resource') return theme.primary;
            if (d.type === 'project') return '#e67e22';
            if (d.type === 'skill') {
                if (d.isCertification) return '#e6c200'; // Gold for certs
                return macroCategoryColor(d.macroCategory || 'default');
            }
            return '#ccc';
        };

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
            .attr("r", (d: any) => d.type === 'skill' ? (d.isCertification ? 10 : 8) : d.type === 'project' ? 12 : 6)
            .attr("fill", (d: any) => getNodeColor(d))
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
            .text((d: any) => {
                if (d.type === 'skill') return `SKILL: ${d.name}\nAmbito: ${d.category || '-'}\nMacro: ${d.macroCategory || '-'}`;
                return d.name;
            });

        simulation.on("tick", () => {
            link
                .attr("x1", (d: any) => d.source.x)
                .attr("y1", (d: any) => d.source.y)
                .attr("x2", (d: any) => d.target.x)
                .attr("y2", (d: any) => d.target.y);

            node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
        });

        return () => { simulation.stop(); };
    }, [nodes, links, width, height, theme, svgRef]);

    return <svg ref={svgRef} width={width} height={height} className="w-full h-full bg-surface-container-low rounded-xl border border-outline-variant cursor-move" />;
};

// 2. Matrix Heatmap
const SkillHeatmap: React.FC<{
    data: { resource: string; skillLabel: string; value: number }[],
    resources: string[],
    skills: string[],
    theme: any,
    svgRef: React.RefObject<SVGSVGElement>
}> = ({ data, resources, skills, theme, svgRef }) => {
    
    useEffect(() => {
        if (!svgRef.current || data.length === 0) return;
        
        const margin = { top: 150, right: 25, bottom: 30, left: 150 };
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
            .data(data, (d: any) => d.resource + ':' + d.skillLabel)
            .enter()
            .append("rect")
            .attr("x", (d: any) => x(d.skillLabel) || 0)
            .attr("y", (d: any) => y(d.resource) || 0)
            .attr("width", x.bandwidth())
            .attr("height", y.bandwidth())
            .style("fill", (d: any) => colorScale(d.value))
            .on("mouseover", (event, d: any) => {
                tooltip.style("visibility", "visible").text(`${d.resource} - ${d.skillLabel}: ${d.value.toFixed(0)} days`);
            })
            .on("mousemove", (event) => {
                tooltip.style("top", (event.pageY - 10) + "px").style("left", (event.pageX + 10) + "px");
            })
            .on("mouseout", () => tooltip.style("visibility", "hidden"));

        return () => { tooltip.remove(); };
    }, [data, resources, skills, theme, svgRef]);

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
    theme: any,
    svgRef: React.RefObject<SVGSVGElement>
}> = ({ matrix, names, width, height, theme, svgRef }) => {

    useEffect(() => {
        if (!svgRef.current || matrix.length === 0) return;

        const svg = select(svgRef.current);
        svg.selectAll("*").remove();

        // Append the Main Group that will be Zoomed/Panned
        // IMPORTANT: Create g BEFORE setting up zoom that references it.
        const g = svg.append("g");

        // Zoom Behavior Setup
        const zoomBehavior = d3Zoom()
            .scaleExtent([0.5, 5]) // Limit zoom scale
            .on("zoom", (event: any) => {
                g.attr("transform", event.transform);
            });

        svg.call(zoomBehavior as any);

        // Initial Centering
        const initialTransform = zoomIdentity.translate(width / 2, height / 2);
        svg.call(zoomBehavior.transform as any, initialTransform);

        const outerRadius = Math.min(width, height) * 0.5 - 120; // Increased margin for labels
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

        const chords = chordGenerator(matrix);

        // Groups (Arcs)
        const group = g.append("g")
            .selectAll("g")
            .data(chords.groups)
            .join("g");

        group.append("path")
            .attr("fill", (d: any) => color(d.index.toString()) as string)
            .attr("stroke", (d: any) => rgb(color(d.index.toString()) as string).darker().toString() as string)
            .attr("d", (d: any) => arcGenerator(d as any) as string);

        // Labels
        group.append("text")
            .each((d: any) => { d.angle = (d.startAngle + d.endAngle) / 2; })
            .attr("dy", ".35em")
            .attr("transform", (d: any) => `
                rotate(${(d.angle * 180 / Math.PI - 90)})
                translate(${innerRadius + 26})
                ${d.angle > Math.PI ? "rotate(180)" : ""}
            `)
            .attr("text-anchor", (d: any) => d.angle > Math.PI ? "end" : "start")
            .text((d: any) => names[d.index] || '')
            .style("font-size", "10px")
            .style("fill", theme.onSurface);

        // Ribbons (Links)
        g.append("g")
            .attr("fill-opacity", 0.67)
            .selectAll("path")
            .data(chords)
            .join("path")
            .attr("d", ribbonGenerator as any)
            .attr("fill", (d: any) => color(d.target.index.toString()) as string)
            .attr("stroke", (d: any) => rgb(color(d.target.index.toString()) as string).darker().toString() as string);

    }, [matrix, names, width, height, theme, svgRef]);

    return <svg ref={svgRef} width={width} height={height} className="w-full h-full bg-surface-container-low rounded-xl border border-outline-variant cursor-move" />;
};

// 4. Radar Chart (Skill Profile)
const SkillRadarChart: React.FC<{
    data: { axis: string; value: number }[],
    width: number,
    height: number,
    theme: any,
    svgRef: React.RefObject<SVGSVGElement>
}> = ({ data, width, height, theme, svgRef }) => {

    useEffect(() => {
        if (!svgRef.current || data.length === 0) return;

        const svg = select(svgRef.current);
        svg.selectAll("*").remove();

        // Append the Main Group that will be Zoomed/Panned
        const g = svg.append("g");

        // Zoom Behavior Setup
        const zoomBehavior = d3Zoom()
            .scaleExtent([0.5, 5])
            .on("zoom", (event: any) => {
                g.attr("transform", event.transform);
            });

        svg.call(zoomBehavior as any);

        // Initial Centering
        const initialTransform = zoomIdentity.translate(width / 2, height / 2);
        svg.call(zoomBehavior.transform as any, initialTransform);

        const cfg = {
            w: width - 100,
            h: height - 100,
            levels: 5,
            maxValue: 100,
            labelFactor: 1.25,
            opacityArea: 0.35,
            color: theme.primary
        };

        const radius = Math.min(cfg.w / 2, cfg.h / 2);
        const angleSlice = Math.PI * 2 / data.length;

        const rScale = scaleLinear()
            .range([0, radius])
            .domain([0, cfg.maxValue]);

        // Circular grid
        const axisGrid = g.append("g").attr("class", "axisWrapper");

        axisGrid.selectAll(".levels")
            .data(Array.from({ length: cfg.levels }, (_, i) => i + 1).reverse())
            .enter()
            .append("circle")
            .attr("class", "gridCircle")
            .attr("r", (d) => radius / cfg.levels * d)
            .style("fill", "#CDCDCD")
            .style("stroke", "#CDCDCD")
            .style("fill-opacity", 0.1);

        // Axes
        const axis = axisGrid.selectAll(".axis")
            .data(data)
            .enter()
            .append("g")
            .attr("class", "axis");

        axis.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", (d, i) => rScale(cfg.maxValue * 1.1) * Math.cos(angleSlice * i - Math.PI / 2))
            .attr("y2", (d, i) => rScale(cfg.maxValue * 1.1) * Math.sin(angleSlice * i - Math.PI / 2))
            .attr("class", "line")
            .style("stroke", "white")
            .style("stroke-width", "2px");

        axis.append("text")
            .attr("class", "legend")
            .style("font-size", "11px")
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .attr("x", (d, i) => rScale(cfg.maxValue * cfg.labelFactor) * Math.cos(angleSlice * i - Math.PI / 2))
            .attr("y", (d, i) => rScale(cfg.maxValue * cfg.labelFactor) * Math.sin(angleSlice * i - Math.PI / 2))
            .text((d) => d.axis)
            .style("fill", theme.onSurface);

        // The Radar Chart Blob
        const radarLine = lineRadial<{axis: string, value: number}>()
            .radius((d) => rScale(d.value))
            .angle((d, i) => i * angleSlice)
            .curve(curveLinearClosed);

        g.append("path")
            .datum(data)
            .attr("class", "radarArea")
            .attr("d", radarLine)
            .style("fill", cfg.color)
            .style("fill-opacity", cfg.opacityArea)
            .on('mouseover', function() {
                (select(this) as any).transition().duration(200).style("fill-opacity", 0.7);
            })
            .on('mouseout', function() {
                (select(this) as any).transition().duration(200).style("fill-opacity", cfg.opacityArea);
            });

        g.append("path")
            .datum(data)
            .attr("class", "radarStroke")
            .attr("d", radarLine)
            .style("stroke-width", "2px")
            .style("stroke", cfg.color)
            .style("fill", "none");

        // Points
        g.selectAll(".radarCircle")
            .data(data)
            .enter().append("circle")
            .attr("class", "radarCircle")
            .attr("r", 4)
            .attr("cx", (d, i) => rScale(d.value) * Math.cos(angleSlice * i - Math.PI / 2))
            .attr("cy", (d, i) => rScale(d.value) * Math.sin(angleSlice * i - Math.PI / 2))
            .style("fill", cfg.color)
            .style("fill-opacity", 0.8);

    }, [data, width, height, theme, svgRef]);

    return <svg ref={svgRef} width={width} height={height} className="w-full h-full bg-surface-container-low rounded-xl border border-outline-variant cursor-move" />;
};


// --- Main Page Component ---

const SkillAnalysisPage: React.FC = () => {
    const { resources, skills, projectSkills, resourceSkills, assignments } = useEntitiesContext();
    const { theme } = useTheme();
    
    const [view, setView] = useState<ViewMode>('network');
    const [selectedResource, setSelectedResource] = useState<string>('');
    
    // Ref for export
    const chartRef = useRef<SVGSVGElement>(null);

    // Export Handlers
    const handleExportSVG = () => {
        if (!chartRef.current) return;
        const svgData = new XMLSerializer().serializeToString(chartRef.current);
        const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `skill_analysis_${view}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportPNG = () => {
        if (!chartRef.current) return;
        const svg = chartRef.current;
        const width = svg.clientWidth || 800;
        const height = svg.clientHeight || 600;
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const svgData = new XMLSerializer().serializeToString(svg);
        const img = new Image();
        img.onload = () => {
            const isDarkMode = document.documentElement.classList.contains('dark');
            ctx.fillStyle = isDarkMode ? theme.dark.surface : theme.light.surface;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, width, height);
            const pngUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = pngUrl;
            link.download = `skill_analysis_${view}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    };

    // Prepare Data
    const resourceOptions = useMemo(() => resources.map(r => ({ value: r.id!, label: r.name })), [resources]);

    const networkData = useMemo(() => {
        if (view !== 'network') return { nodes: [], links: [] };
        const nodes: any[] = [];
        const links: any[] = [];
        const nodeIds = new Set();

        // Skills
        skills.forEach(s => {
            nodes.push({ 
                id: `skill_${s.id}`, 
                name: formatSkillLabel(s.name, s.category), // Use disambiguated label if needed or just short name 
                type: 'skill', 
                category: s.category,
                macroCategory: s.macroCategory, 
                isCertification: s.isCertification 
            });
            nodeIds.add(`skill_${s.id}`);
        });

        // Resources & Links
        resources.forEach(r => {
            if (r.resigned) return;
            nodes.push({ id: `res_${r.id}`, name: r.name, type: 'resource' });
            nodeIds.add(`res_${r.id}`);

            const rSkills = resourceSkills.filter(rs => rs.resourceId === r.id);
            rSkills.forEach(rs => {
                if (nodeIds.has(`skill_${rs.skillId}`)) {
                    links.push({ source: `res_${r.id}`, target: `skill_${rs.skillId}`, value: 1 });
                }
            });
        });

        return { nodes, links };
    }, [resources, skills, resourceSkills, view]);

    const heatmapData = useMemo(() => {
        if (view !== 'heatmap') return { data: [], resources: [], skills: [] };
        
        const data: { resource: string; skillLabel: string; value: number }[] = [];
        const resList = resources.filter(r => !r.resigned).map(r => r.name);
        const skillList = skills.map(s => formatSkillLabel(s.name, s.category)); // Use formatted label for axis

        resources.filter(r => !r.resigned).forEach(r => {
            skills.forEach(s => {
                // Calculate "affinity" based on assignments to projects with that skill
                const rAssignments = assignments.filter(a => a.resourceId === r.id);
                let days = 0;
                rAssignments.forEach(a => {
                    const hasSkill = projectSkills.some(ps => ps.projectId === a.projectId && ps.skillId === s.id);
                    if (hasSkill) days += 10; // Simple weight
                });
                // Add manual skill weight
                const manual = resourceSkills.find(rs => rs.resourceId === r.id && rs.skillId === s.id);
                if (manual) days += 50; 

                if (days > 0) {
                    data.push({ resource: r.name, skillLabel: formatSkillLabel(s.name, s.category), value: days });
                }
            });
        });

        return { data, resources: resList, skills: skillList };
    }, [resources, skills, assignments, projectSkills, resourceSkills, view]);

    const chordData = useMemo(() => {
        if (view !== 'chord') return { matrix: [], names: [] };
        // Co-occurrence of skills in projects
        const skillIndices = new Map<string, number>(skills.map((s, i) => [s.id!, i]));
        const n = skills.length;
        const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

        projectSkills.forEach(ps1 => {
            projectSkills.forEach(ps2 => {
                if (ps1.projectId === ps2.projectId && ps1.skillId !== ps2.skillId) {
                    const i = skillIndices.get(ps1.skillId);
                    const j = skillIndices.get(ps2.skillId);
                    if (i !== undefined && j !== undefined) {
                        matrix[i][j]++;
                    }
                }
            });
        });

        return { matrix, names: skills.map(s => formatSkillLabel(s.name, s.category)) };
    }, [skills, projectSkills, view]);

    const radarData = useMemo(() => {
        if (view !== 'radar' || !selectedResource) return [];
        
        // Compare resource skills vs Max possible (level 5)
        const rSkills = resourceSkills.filter(rs => rs.resourceId === selectedResource);
        
        // Pick top 6 skills for cleaner radar or all manual skills
        const data = rSkills.map(rs => {
            const skill = skills.find(s => s.id === rs.skillId);
            return {
                axis: skill ? formatSkillLabel(skill.name, skill.category) : 'Unknown',
                value: (rs.level || 1) * 20 // 1-5 => 20-100
            };
        });

        return data;
    }, [selectedResource, resourceSkills, skills, view]);

    const isDarkMode = document.documentElement.classList.contains('dark');
    const currentTheme = isDarkMode ? theme.dark : theme.light;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-4 bg-surface rounded-2xl shadow">
                <h1 className="text-3xl font-bold text-on-surface">Analisi Competenze</h1>
                
                <div className="flex items-center space-x-1 bg-surface-container p-1 rounded-full">
                    <button onClick={() => setView('network')} className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 ${view === 'network' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant hover:text-on-surface'}`}>Network</button>
                    <button onClick={() => setView('heatmap')} className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 ${view === 'heatmap' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant hover:text-on-surface'}`}>Heatmap</button>
                    <button onClick={() => setView('chord')} className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 ${view === 'chord' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant hover:text-on-surface'}`}>Chord</button>
                    <button onClick={() => setView('radar')} className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 ${view === 'radar' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant hover:text-on-surface'}`}>Radar</button>
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

            {view === 'radar' && (
                <div className="w-64 mx-auto">
                    <SearchableSelect 
                        name="resource" 
                        value={selectedResource} 
                        onChange={(_, v) => setSelectedResource(v)} 
                        options={resourceOptions} 
                        placeholder="Seleziona Risorsa per Radar" 
                    />
                </div>
            )}

            <div className="h-[700px] w-full">
                {view === 'network' && <SkillForceGraph nodes={networkData.nodes} links={networkData.links} width={1200} height={700} theme={currentTheme} svgRef={chartRef} />}
                {view === 'heatmap' && <SkillHeatmap data={heatmapData.data} resources={heatmapData.resources} skills={heatmapData.skills} theme={currentTheme} svgRef={chartRef} />}
                {view === 'chord' && <SkillChordDiagram matrix={chordData.matrix} names={chordData.names} width={1200} height={700} theme={currentTheme} svgRef={chartRef} />}
                {view === 'radar' && <SkillRadarChart data={radarData} width={1200} height={700} theme={currentTheme} svgRef={chartRef} />}
            </div>
        </div>
    );
};

export default SkillAnalysisPage;
