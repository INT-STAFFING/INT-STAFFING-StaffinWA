
/**
 * @file SkillAnalysisPage.tsx
 * @description Pagina di analisi avanzata delle competenze con 4 visualizzazioni: Network, Heatmap, Chord, Radar.
 * Supporta filtri globali e controlli di zoom unificati.
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
import { max, descending, mean } from 'd3-array';
import { chord as d3Chord, ribbon as d3Ribbon } from 'd3-chord';
import { arc as d3Arc, lineRadial, curveLinearClosed } from 'd3-shape';
import { rgb } from 'd3-color';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import 'd3-transition';

type ViewMode = 'network' | 'heatmap' | 'chord' | 'radar';
type ZoomAction = { type: 'in' | 'out' | 'reset'; ts: number };

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
    zoomAction: ZoomAction,
    svgRef: React.RefObject<SVGSVGElement>
}> = ({ nodes, links, width, height, theme, zoomAction, svgRef }) => {

    const zoomBehavior = useRef<any>(null);
    const gRef = useRef<any>(null);

    useEffect(() => {
        if (!svgRef.current) return;
        const svg = select(svgRef.current);
        
        // Define zoom behavior only once or when dimensions change
        zoomBehavior.current = d3Zoom()
            .scaleExtent([0.1, 4])
            .on("zoom", (event: any) => {
                if(gRef.current) gRef.current.attr("transform", event.transform);
            });
        
        svg.call(zoomBehavior.current);
    }, [width, height, svgRef]);

    // Handle External Zoom Controls
    useEffect(() => {
        if (!svgRef.current || !zoomBehavior.current) return;
        const svg = select(svgRef.current);
        
        if (zoomAction.type === 'in') {
            svg.transition().duration(300).call(zoomBehavior.current.scaleBy, 1.2);
        } else if (zoomAction.type === 'out') {
            svg.transition().duration(300).call(zoomBehavior.current.scaleBy, 0.8);
        } else if (zoomAction.type === 'reset') {
            svg.transition().duration(750).call(zoomBehavior.current.transform, zoomIdentity.translate(width/2, height/2).scale(1).translate(-width/2, -height/2));
        }
    }, [zoomAction, width, height]);

    useEffect(() => {
        if (!svgRef.current || nodes.length === 0) return;
        
        const svg = select(svgRef.current);
        svg.selectAll("g").remove(); // Clean previous content but keep svg attributes

        const g = svg.append("g");
        gRef.current = g;
        
        // Initial Center
        // svg.call(zoomBehavior.current.transform, zoomIdentity.translate(width / 2, height / 2).scale(0.6).translate(-width/2, -height/2));

        // Color mapping
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
    width: number,
    height: number,
    theme: any,
    zoomAction: ZoomAction,
    svgRef: React.RefObject<SVGSVGElement>
}> = ({ data, resources, skills, width: containerWidth, height: containerHeight, theme, zoomAction, svgRef }) => {
    
    const zoomBehavior = useRef<any>(null);
    const gRef = useRef<any>(null);

    useEffect(() => {
        if (!svgRef.current) return;
        const svg = select(svgRef.current);
        
        zoomBehavior.current = d3Zoom()
            .scaleExtent([0.1, 5])
            .on("zoom", (event: any) => {
                if(gRef.current) gRef.current.attr("transform", event.transform);
            });
        
        svg.call(zoomBehavior.current);
    }, [svgRef]);

    useEffect(() => {
        if (!svgRef.current || !zoomBehavior.current) return;
        const svg = select(svgRef.current);
        
        if (zoomAction.type === 'in') {
            svg.transition().duration(300).call(zoomBehavior.current.scaleBy, 1.2);
        } else if (zoomAction.type === 'out') {
            svg.transition().duration(300).call(zoomBehavior.current.scaleBy, 0.8);
        } else if (zoomAction.type === 'reset') {
            svg.transition().duration(750).call(zoomBehavior.current.transform, zoomIdentity);
        }
    }, [zoomAction]);

    useEffect(() => {
        if (!svgRef.current || data.length === 0) return;
        
        const margin = { top: 150, right: 25, bottom: 30, left: 150 };
        const cellSize = 30;
        const width = Math.max(skills.length * cellSize + margin.left + margin.right, containerWidth);
        const height = Math.max(resources.length * cellSize + margin.top + margin.bottom, containerHeight);

        const svg = select(svgRef.current);
        svg.selectAll("g").remove();

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
        
        gRef.current = g;

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
            .style("z-index", "100")
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
                tooltip.style("visibility", "visible").text(`${d.resource} - ${d.skillLabel}: ${d.value.toFixed(0)} score`);
            })
            .on("mousemove", (event) => {
                tooltip.style("top", (event.pageY - 10) + "px").style("left", (event.pageX + 10) + "px");
            })
            .on("mouseout", () => tooltip.style("visibility", "hidden"));

        return () => { tooltip.remove(); };
    }, [data, resources, skills, theme, svgRef, containerWidth, containerHeight]);

    return <svg ref={svgRef} width={containerWidth} height={containerHeight} className="w-full h-full bg-surface-container-low rounded-xl border border-outline-variant cursor-move"></svg>;
};

// 3. Chord Diagram (Skill Co-occurrence)
const SkillChordDiagram: React.FC<{
    matrix: number[][],
    names: string[],
    width: number,
    height: number,
    theme: any,
    zoomAction: ZoomAction,
    svgRef: React.RefObject<SVGSVGElement>
}> = ({ matrix, names, width, height, theme, zoomAction, svgRef }) => {

    const zoomBehavior = useRef<any>(null);
    const gRef = useRef<any>(null);

    useEffect(() => {
        if (!svgRef.current) return;
        const svg = select(svgRef.current);
        
        zoomBehavior.current = d3Zoom()
            .scaleExtent([0.5, 5])
            .on("zoom", (event: any) => {
                if(gRef.current) gRef.current.attr("transform", event.transform);
            });
        
        svg.call(zoomBehavior.current);
    }, [svgRef]);

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
    }, [zoomAction, width, height]);

    useEffect(() => {
        if (!svgRef.current || matrix.length === 0) return;

        const svg = select(svgRef.current);
        svg.selectAll("g").remove();

        // Append the Main Group that will be Zoomed/Panned
        const g = svg.append("g");
        gRef.current = g;

        // Initial Centering
        svg.call(zoomBehavior.current.transform, zoomIdentity.translate(width / 2, height / 2));

        const outerRadius = Math.min(width, height) * 0.5 - 120;
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
interface RadarDataPoint {
    axis: string;
    value: number;
}

interface RadarDataSet {
    name: string;
    color: string;
    data: RadarDataPoint[];
}

const SkillRadarChart: React.FC<{
    datasets: RadarDataSet[],
    width: number,
    height: number,
    theme: any,
    zoomAction: ZoomAction,
    svgRef: React.RefObject<SVGSVGElement>
}> = ({ datasets, width, height, theme, zoomAction, svgRef }) => {

    const zoomBehavior = useRef<any>(null);
    const gRef = useRef<any>(null);

    useEffect(() => {
        if (!svgRef.current) return;
        const svg = select(svgRef.current);
        
        zoomBehavior.current = d3Zoom()
            .scaleExtent([0.5, 5])
            .on("zoom", (event: any) => {
                if(gRef.current) gRef.current.attr("transform", event.transform);
            });
        
        svg.call(zoomBehavior.current);
    }, [svgRef]);

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
    }, [zoomAction, width, height]);

    useEffect(() => {
        if (!svgRef.current || datasets.length === 0 || datasets[0].data.length === 0) return;

        const svg = select(svgRef.current);
        svg.selectAll("g").remove();

        const g = svg.append("g");
        gRef.current = g;

        // Initial Centering
        svg.call(zoomBehavior.current.transform, zoomIdentity.translate(width / 2, height / 2));

        const cfg = {
            w: width - 150,
            h: height - 150,
            levels: 5,
            maxValue: 100,
            labelFactor: 1.25,
            opacityArea: 0.25,
        };

        const radius = Math.min(cfg.w / 2, cfg.h / 2);
        const axesData = datasets[0].data; // Assuming all datasets have same axes
        const angleSlice = Math.PI * 2 / axesData.length;

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
            .data(axesData)
            .enter()
            .append("g")
            .attr("class", "axis");

        axis.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", (d, i) => rScale(cfg.maxValue * 1.1) * Math.cos(angleSlice * i - Math.PI / 2))
            .attr("y2", (d, i) => rScale(cfg.maxValue * 1.1) * Math.sin(angleSlice * i - Math.PI / 2))
            .attr("class", "line")
            .style("stroke", theme.outlineVariant)
            .style("stroke-width", "1px");

        axis.append("text")
            .attr("class", "legend")
            .style("font-size", "11px")
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .attr("x", (d, i) => rScale(cfg.maxValue * cfg.labelFactor) * Math.cos(angleSlice * i - Math.PI / 2))
            .attr("y", (d, i) => rScale(cfg.maxValue * cfg.labelFactor) * Math.sin(angleSlice * i - Math.PI / 2))
            .text((d) => d.axis)
            .style("fill", theme.onSurface);

        // Draw Datasets
        const radarLine = lineRadial<RadarDataPoint>()
            .radius((d) => rScale(d.value))
            .angle((d, i) => i * angleSlice)
            .curve(curveLinearClosed);

        datasets.forEach((dataset, idx) => {
            g.append("path")
                .datum(dataset.data)
                .attr("class", "radarArea")
                .attr("d", radarLine)
                .style("fill", dataset.color)
                .style("fill-opacity", cfg.opacityArea)
                .on('mouseover', function() {
                    select(this).transition().duration(200).style("fill-opacity", 0.7);
                })
                .on('mouseout', function() {
                    select(this).transition().duration(200).style("fill-opacity", cfg.opacityArea);
                })
                .append("title")
                .text(dataset.name);

            g.append("path")
                .datum(dataset.data)
                .attr("class", "radarStroke")
                .attr("d", radarLine)
                .style("stroke-width", "2px")
                .style("stroke", dataset.color)
                .style("fill", "none");
            
            // Draw points
            g.selectAll(`.radarCircle-${idx}`)
                .data(dataset.data)
                .enter().append("circle")
                .attr("class", "radarCircle")
                .attr("r", 3)
                .attr("cx", (d, i) => rScale(d.value) * Math.cos(angleSlice * i - Math.PI / 2))
                .attr("cy", (d, i) => rScale(d.value) * Math.sin(angleSlice * i - Math.PI / 2))
                .style("fill", dataset.color)
                .style("fill-opacity", 0.9)
                .append("title")
                .text((d) => `${dataset.name}: ${d.value}`);
        });

    }, [datasets, width, height, theme, svgRef]);

    return <svg ref={svgRef} width={width} height={height} className="w-full h-full bg-surface-container-low rounded-xl border border-outline-variant cursor-move" />;
};


// --- Main Page Component ---

const SkillAnalysisPage: React.FC = () => {
    const { resources, skills, projectSkills, resourceSkills, assignments, roles, locations, horizontals } = useEntitiesContext();
    const { theme, mode } = useTheme(); // Destructure mode
    
    const [view, setView] = useState<ViewMode>('network');
    const [zoomAction, setZoomAction] = useState<ZoomAction>({ type: 'reset', ts: 0 });
    
    // Filters State
    const [filters, setFilters] = useState({
        resourceName: '',
        roleIds: [] as string[],
        skillIds: [] as string[],
        category: '',
        macroCategory: '',
        isCertification: '',
        location: ''
    });

    const handleZoom = (type: 'in' | 'out' | 'reset') => {
        setZoomAction({ type, ts: Date.now() });
    };

    // Ref for export
    const chartRef = useRef<SVGSVGElement>(null);

    // --- Options for Filters ---
    const resourceOptions = useMemo(() => resources.filter(r => !r.resigned).map(r => ({ value: r.id!, label: r.name })), [resources]);
    const roleOptions = useMemo(() => roles.map(r => ({ value: r.id!, label: r.name })), [roles]);
    const locationOptions = useMemo(() => locations.map(l => ({ value: l.value, label: l.value })), [locations]);
    
    const skillOptions = useMemo(() => skills.map(s => ({ 
        value: s.id!, 
        label: formatSkillLabel(s.name, s.category) 
    })), [skills]);
    
    const categoryOptions = useMemo(() => {
        const cats = Array.from(new Set(skills.map(s => s.category).filter(Boolean)));
        return cats.sort().map(c => ({ value: c as string, label: c as string }));
    }, [skills]);
    const macroCategoryOptions = useMemo(() => {
        const macros = Array.from(new Set(skills.map(s => s.macroCategory).filter(Boolean)));
        return macros.sort().map(c => ({ value: c as string, label: c as string }));
    }, [skills]);

    // --- Data Filtering Logic ---
    const filteredResources = useMemo(() => {
        return resources.filter(r => {
            if (r.resigned) return false;
            const nameMatch = !filters.resourceName || r.name.toLowerCase().includes(filters.resourceName.toLowerCase());
            const roleMatch = filters.roleIds.length === 0 || filters.roleIds.includes(r.roleId);
            const locationMatch = !filters.location || r.location === filters.location;
            
            return nameMatch && roleMatch && locationMatch;
        });
    }, [resources, filters]);

    const filteredSkills = useMemo(() => {
        return skills.filter(s => {
            const skillMatch = filters.skillIds.length === 0 || filters.skillIds.includes(s.id!);
            const catMatch = !filters.category || s.category === filters.category;
            const macroMatch = !filters.macroCategory || s.macroCategory === filters.macroCategory;
            const certMatch = filters.isCertification === '' ? true : 
                              filters.isCertification === 'yes' ? s.isCertification : !s.isCertification;
            return skillMatch && catMatch && macroMatch && certMatch;
        });
    }, [skills, filters]);

    // --- Chart Data Preparation ---

    const networkData = useMemo(() => {
        if (view !== 'network') return { nodes: [], links: [] };
        const nodes: any[] = [];
        const links: any[] = [];
        const nodeIds = new Set();

        // 1. Add Filtered Skills
        filteredSkills.forEach(s => {
            nodes.push({ 
                id: `skill_${s.id}`, 
                name: formatSkillLabel(s.name, s.category),
                type: 'skill', 
                category: s.category,
                macroCategory: s.macroCategory, 
                isCertification: s.isCertification 
            });
            nodeIds.add(`skill_${s.id}`);
        });

        // 2. Add Filtered Resources & Create Links
        filteredResources.forEach(r => {
            // Optimization: Only add resource if it has at least one of the filtered skills
            const rSkills = resourceSkills.filter(rs => rs.resourceId === r.id);
            const hasRelevantSkill = rSkills.some(rs => nodeIds.has(`skill_${rs.skillId}`));
            
            if (hasRelevantSkill) {
                nodes.push({ id: `res_${r.id}`, name: r.name, type: 'resource' });
                
                rSkills.forEach(rs => {
                    if (nodeIds.has(`skill_${rs.skillId}`)) {
                        links.push({ source: `res_${r.id}`, target: `skill_${rs.skillId}`, value: 1 });
                    }
                });
            }
        });

        return { nodes, links };
    }, [filteredResources, filteredSkills, resourceSkills, view]);

    const heatmapData = useMemo(() => {
        if (view !== 'heatmap') return { data: [], resources: [], skills: [] };
        
        const data: { resource: string; skillLabel: string; value: number }[] = [];
        const resList = filteredResources.map(r => r.name);
        const skillList = filteredSkills.map(s => formatSkillLabel(s.name, s.category)); 

        filteredResources.forEach(r => {
            filteredSkills.forEach(s => {
                // Calculate "affinity"
                let days = 0;
                
                // Manual skill weight
                const manual = resourceSkills.find(rs => rs.resourceId === r.id && rs.skillId === s.id);
                if (manual) days += (manual.level || 1) * 20; 

                // Project inference weight
                const rAssignments = assignments.filter(a => a.resourceId === r.id);
                rAssignments.forEach(a => {
                    const hasSkill = projectSkills.some(ps => ps.projectId === a.projectId && ps.skillId === s.id);
                    if (hasSkill) days += 10;
                });

                if (days > 0) {
                    data.push({ resource: r.name, skillLabel: formatSkillLabel(s.name, s.category), value: Math.min(100, days) });
                }
            });
        });

        return { data, resources: resList, skills: skillList };
    }, [filteredResources, filteredSkills, assignments, projectSkills, resourceSkills, view]);

    const chordData = useMemo(() => {
        if (view !== 'chord') return { matrix: [], names: [] };
        
        // Co-occurrence of skills in projects (filtered skills only)
        const skillIndices = new Map<string, number>(filteredSkills.map((s, i) => [s.id!, i]));
        const n = filteredSkills.length;
        if (n === 0 || n > 50) return { matrix: [], names: [] }; // Performance guard

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

        return { matrix, names: filteredSkills.map(s => formatSkillLabel(s.name, s.category)) };
    }, [filteredSkills, projectSkills, view]);

    const radarData = useMemo<RadarDataSet[]>(() => {
        if (view !== 'radar') return [];
        
        // Limit skills for radar to keep it readable (max 8)
        const targetSkills = filteredSkills.slice(0, 8); 
        if (targetSkills.length < 3) return []; // Need at least 3 axes

        const datasets: RadarDataSet[] = [];
        const palette = schemeCategory10;
        const currentPalette = mode === 'dark' ? theme.dark : theme.light; // Select palette based on mode

        // Mode 1: Compare Individual Resources (up to 5)
        if (filteredResources.length <= 5) {
            filteredResources.forEach((r, idx) => {
                const dataPoints = targetSkills.map(s => {
                    const rs = resourceSkills.find(x => x.resourceId === r.id && x.skillId === s.id);
                    return {
                        axis: formatSkillLabel(s.name, s.category),
                        value: (rs?.level || 0) * 20 // 0-100 scale
                    };
                });
                datasets.push({
                    name: r.name,
                    color: palette[idx % 10],
                    data: dataPoints
                });
            });
        } 
        // Mode 2: Average of Filtered Resources (Group Profile)
        else {
            const avgDataPoints = targetSkills.map(s => {
                const values = filteredResources.map(r => {
                    const rs = resourceSkills.find(x => x.resourceId === r.id && x.skillId === s.id);
                    return (rs?.level || 0) * 20;
                });
                const avg = mean(values) || 0;
                return {
                    axis: formatSkillLabel(s.name, s.category),
                    value: avg
                };
            });
            datasets.push({
                name: 'Media Gruppo Filtrato',
                color: currentPalette.primary, // Fixed access
                data: avgDataPoints
            });
        }

        return datasets;
    }, [filteredResources, filteredSkills, resourceSkills, view, theme, mode]); // Added mode to deps

    const currentTheme = mode === 'dark' ? theme.dark : theme.light; // Use mode

    // Export Handlers (Reused)
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
            ctx.fillStyle = currentTheme.surface;
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

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
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

            {/* Global Filters */}
            <div className="bg-surface rounded-2xl shadow p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4 items-end">
                    {/* Resource Filters */}
                    <input 
                        type="text" 
                        placeholder="Risorsa..." 
                        className="form-input text-sm"
                        value={filters.resourceName}
                        onChange={e => setFilters(prev => ({ ...prev, resourceName: e.target.value }))}
                    />
                    <div className="md:col-span-2">
                        <MultiSelectDropdown name="roleIds" selectedValues={filters.roleIds} onChange={(_, v) => setFilters(f => ({...f, roleIds: v}))} options={roleOptions} placeholder="Ruoli"/>
                    </div>
                    <SearchableSelect name="location" value={filters.location} onChange={(_, v) => setFilters(f => ({...f, location: v}))} options={locationOptions} placeholder="Sede"/>
                    
                    {/* Skill Filters */}
                    <div className="md:col-span-2">
                        <MultiSelectDropdown name="skillIds" selectedValues={filters.skillIds} onChange={(_, v) => setFilters(f => ({...f, skillIds: v}))} options={skillOptions} placeholder="Competenze"/>
                    </div>
                    
                    {/* Advanced Skill Filters */}
                    <SearchableSelect name="category" value={filters.category} onChange={(_, v) => setFilters(f => ({...f, category: v}))} options={categoryOptions} placeholder="Ambito"/>
                    <SearchableSelect name="macroCategory" value={filters.macroCategory} onChange={(_, v) => setFilters(f => ({...f, macroCategory: v}))} options={macroCategoryOptions} placeholder="Macro Ambito"/>
                    
                    <select 
                        className="form-select text-sm"
                        value={filters.isCertification}
                        onChange={e => setFilters(prev => ({ ...prev, isCertification: e.target.value }))}
                    >
                        <option value="">Tutti i tipi</option>
                        <option value="yes">Solo Certificazioni</option>
                        <option value="no">Solo Competenze</option>
                    </select>

                    <button onClick={() => setFilters({ resourceName: '', roleIds: [], skillIds: [], category: '', macroCategory: '', isCertification: '', location: '' })} className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full hover:opacity-90 w-full text-sm font-medium">
                        Reset
                    </button>
                </div>
            </div>

            <div className="relative h-[700px] w-full bg-surface-container-low rounded-xl border border-outline-variant overflow-hidden">
                {/* Zoom Controls Overlay */}
                <div className="absolute top-4 right-4 flex flex-col gap-2 z-10 bg-surface/80 p-2 rounded-lg shadow backdrop-blur-sm">
                    <button onClick={() => handleZoom('in')} className="p-2 rounded hover:bg-surface-container-high text-on-surface" title="Zoom In">
                        <span className="material-symbols-outlined">add</span>
                    </button>
                    <button onClick={() => handleZoom('out')} className="p-2 rounded hover:bg-surface-container-high text-on-surface" title="Zoom Out">
                        <span className="material-symbols-outlined">remove</span>
                    </button>
                    <button onClick={() => handleZoom('reset')} className="p-2 rounded hover:bg-surface-container-high text-on-surface" title="Reset Zoom">
                        <span className="material-symbols-outlined">center_focus_strong</span>
                    </button>
                </div>

                {view === 'network' && <SkillForceGraph nodes={networkData.nodes} links={networkData.links} width={1200} height={700} theme={currentTheme} zoomAction={zoomAction} svgRef={chartRef} />}
                {view === 'heatmap' && <SkillHeatmap data={heatmapData.data} resources={heatmapData.resources} skills={heatmapData.skills} width={1200} height={700} theme={currentTheme} zoomAction={zoomAction} svgRef={chartRef} />}
                {view === 'chord' && <SkillChordDiagram matrix={chordData.matrix} names={chordData.names} width={1200} height={700} theme={currentTheme} zoomAction={zoomAction} svgRef={chartRef} />}
                {view === 'radar' && <SkillRadarChart datasets={radarData} width={1200} height={700} theme={currentTheme} zoomAction={zoomAction} svgRef={chartRef} />}
            </div>
        </div>
    );
};

export default SkillAnalysisPage;
