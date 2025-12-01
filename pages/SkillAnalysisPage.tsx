
/**
 * @file SkillAnalysisPage.tsx
 * @description Pagina di analisi avanzata delle competenze con 8 visualizzazioni.
 * Supporta filtri globali e controlli di zoom unificati.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { select } from 'd3-selection';
import { zoom as d3Zoom, zoomIdentity, zoomTransform } from 'd3-zoom';
import { scaleOrdinal, scaleBand, scaleSequential, scaleLinear, scaleSqrt } from 'd3-scale';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY } from 'd3-force';
import { drag as d3Drag } from 'd3-drag';
import { interpolate } from 'd3-interpolate';
import { axisLeft, axisTop } from 'd3-axis';
import { max, descending, mean } from 'd3-array';
import { chord as d3Chord, ribbon as d3Ribbon } from 'd3-chord';
import { arc as d3Arc, lineRadial, curveLinearClosed, linkRadial as d3LinkRadial } from 'd3-shape';
import { rgb } from 'd3-color';
import { tree as d3Tree, hierarchy as d3Hierarchy, pack as d3Pack } from 'd3-hierarchy';
import { sankey as d3Sankey, sankeyLinkHorizontal } from 'd3-sankey';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import 'd3-transition';
import { Skill } from '../types';

type ViewMode = 'network' | 'heatmap' | 'chord' | 'radar' | 'dendrogram' | 'packing' | 'sankey' | 'bubble';
type ZoomAction = { type: 'in' | 'out' | 'reset'; ts: number };
type DisplayMode = 'all' | 'skills_only' | 'certs_only' | 'not_empty';

// --- Helper to truncate label ---
const truncateLabel = (str: string, maxLength: number = 15) => {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
};

// --- Helper for Theme Colors ---
const getThemePalette = (theme: any) => [
    theme.primary,
    theme.secondary,
    theme.tertiary,
    theme.error,
    theme.primaryContainer,
    theme.secondaryContainer,
    theme.tertiaryContainer,
    theme.errorContainer
];

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
        
        zoomBehavior.current = d3Zoom()
            .scaleExtent([0.1, 4])
            .on("zoom", (event: any) => {
                if(gRef.current) gRef.current.attr("transform", event.transform);
            });
        
        svg.call(zoomBehavior.current);
    }, [width, height, svgRef]);

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
        svg.selectAll("g").remove();

        const g = svg.append("g");
        gRef.current = g;
        
        const t = zoomTransform(svg.node() as Element);
        if (t.k !== 1 || t.x !== 0 || t.y !== 0) {
             g.attr("transform", t.toString());
        } else {
             svg.call(zoomBehavior.current.transform, zoomIdentity.translate(width/2, height/2));
        }
        
        const fullPalette = getThemePalette(theme);
        const skillPalette = fullPalette.filter(c => c !== theme.primary);
        const macroCategoryColor = scaleOrdinal(skillPalette);

        const getNodeColor = (d: any) => {
            if (d.type === 'resource') return theme.primary;
            if (d.type === 'project') return theme.secondary;
            if (d.type === 'skill') {
                if (d.isCertification) return theme.tertiary; 
                return macroCategoryColor(d.macroCategory || 'default');
            }
            return theme.surfaceVariant;
        };

        // --- Calculate Degree (Number of connections) ---
        const degreeMap = new Map<string, number>();
        nodes.forEach(n => degreeMap.set(n.id, 0));
        links.forEach(l => {
            const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
            const targetId = typeof l.target === 'object' ? l.target.id : l.target;
            
            degreeMap.set(sourceId, (degreeMap.get(sourceId) || 0) + 1);
            degreeMap.set(targetId, (degreeMap.get(targetId) || 0) + 1);
        });

        nodes.forEach(n => {
            n.degree = degreeMap.get(n.id) || 0;
        });

        const maxDegree = Math.max(...Array.from(degreeMap.values()), 1);

        const radiusScale = scaleSqrt()
            .domain([0, maxDegree])
            .range([5, 25]); 

        const simulation = forceSimulation(nodes)
            .force("link", forceLink(links).id((d: any) => d.id).distance(100))
            .force("charge", forceManyBody().strength(-300))
            .force("center", forceCenter(0, 0))
            .force("collide", forceCollide((d: any) => radiusScale(d.degree) + 5));

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
            .attr("r", (d: any) => {
                const baseRadius = radiusScale(d.degree);
                return d.type === 'project' ? baseRadius * 1.2 : baseRadius;
            })
            .attr("fill", (d: any) => getNodeColor(d))
            .attr("stroke", theme.surface)
            .attr("stroke-width", 1.5);

        node.append("text")
            .text((d: any) => truncateLabel(d.name, 15))
            .attr("x", (d: any) => radiusScale(d.degree) + 4)
            .attr("y", 4)
            .attr("font-size", "10px")
            .attr("fill", theme.onSurface)
            .style("pointer-events", "none");

        node.append("title")
            .text((d: any) => {
                let tooltip = d.name;
                if (d.type === 'skill') tooltip = `SKILL: ${d.name}\nAmbito: ${d.category || '-'}\nMacro: ${d.macroCategory || '-'}`;
                return `${tooltip}\nConnessioni: ${d.degree}`;
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
        
        const svg = select(svgRef.current);
        svg.selectAll("g").remove();

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
        
        gRef.current = g;
        
        const t = zoomTransform(svg.node() as Element);
        if (t.k !== 1 || t.x !== 0 || t.y !== 0) {
             g.attr("transform", t.toString());
        }

        const x = scaleBand()
            .range([0, skills.length * cellSize])
            .domain(skills)
            .padding(0.05);

        const y = scaleBand()
            .range([0, resources.length * cellSize])
            .domain(resources)
            .padding(0.05);

        const colorScale = scaleSequential()
            .interpolator(interpolate(theme.surfaceContainerHighest, theme.primary))
            .domain([0, max(data, d => d.value) || 100]);

        // Rows (Resources)
        g.append("g")
            .call(axisLeft(y).tickFormat((d) => truncateLabel(d, 20)))
            .selectAll("text")
            .attr("fill", theme.onSurface)
            .style("font-size", "11px");

        // Columns (Skills)
        g.append("g")
            .call(axisTop(x).tickFormat((d) => truncateLabel(d, 20)))
            .selectAll("text")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "start")
            .attr("dx", "0.5em")
            .attr("dy", "-0.5em")
            .attr("fill", theme.onSurface)
            .style("font-size", "11px");
        
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
    }, [width, height, svgRef]);

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
        if (!svgRef.current || matrix.length === 0 || names.length === 0) {
            if(svgRef.current) select(svgRef.current).selectAll("g").remove();
            return;
        }

        const svg = select(svgRef.current);
        svg.selectAll("g").remove();

        const g = svg.append("g");
        gRef.current = g;

        const t = zoomTransform(svg.node() as Element);
        if (t.k === 1 && t.x === 0 && t.y === 0) {
             svg.call(zoomBehavior.current.transform, zoomIdentity.translate(width / 2, height / 2));
        } else {
             g.attr("transform", t.toString());
        }
        
        const outerRadius = Math.min(width, height) * 0.5 - 60;
        const innerRadius = outerRadius - 20;

        if (innerRadius <= 0) return; 

        const chordGenerator = d3Chord()
            .padAngle(0.05)
            .sortSubgroups(descending);

        const arcGenerator = d3Arc()
            .innerRadius(innerRadius)
            .outerRadius(outerRadius);

        const ribbonGenerator = d3Ribbon()
            .radius(innerRadius);

        const palette = getThemePalette(theme);
        const color = scaleOrdinal(palette);

        const chords = chordGenerator(matrix);

        const group = g.append("g")
            .selectAll("g")
            .data(chords.groups)
            .join("g");

        group.append("path")
            .attr("fill", (d: any) => color(d.index.toString()) as string)
            .attr("stroke", (d: any) => rgb(color(d.index.toString()) as string).darker().toString() as string)
            .attr("d", (d: any) => arcGenerator(d as any) as string)
            .append("title")
            .text((d: any) => `${names[d.index]}: ${d.value.toFixed(0)} co-occorrenze`);

        group.append("text")
            .each((d: any) => { d.angle = (d.startAngle + d.endAngle) / 2; })
            .attr("dy", ".35em")
            .attr("transform", (d: any) => `
                rotate(${(d.angle * 180 / Math.PI - 90)})
                translate(${innerRadius + 26})
                ${d.angle > Math.PI ? "rotate(180)" : ""}
            `)
            .attr("text-anchor", (d: any) => d.angle > Math.PI ? "end" : "start")
            .text((d: any) => truncateLabel(names[d.index], 15))
            .style("font-size", "10px")
            .style("fill", theme.onSurface);

        g.append("g")
            .attr("fill-opacity", 0.67)
            .selectAll("path")
            .data(chords)
            .join("path")
            .attr("d", ribbonGenerator as any)
            .attr("fill", (d: any) => color(d.target.index.toString()) as string)
            .attr("stroke", (d: any) => rgb(color(d.target.index.toString()) as string).darker().toString() as string)
            .append("title")
            .text((d: any) => `${names[d.source.index]} ↔ ${names[d.target.index]}\nCo-occorrenze: ${d.source.value}`);

    }, [matrix, names, width, height, theme, svgRef]);

    return <svg ref={svgRef} width={width} height={height} className="w-full h-full bg-surface-container-low rounded-xl border border-outline-variant cursor-move" />;
};

// 4. Radar Chart
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

        const t = zoomTransform(svg.node() as Element);
        if (t.k === 1 && t.x === 0 && t.y === 0) {
             svg.call(zoomBehavior.current.transform, zoomIdentity.translate(width / 2, height / 2));
        } else {
             g.attr("transform", t.toString());
        }

        const cfg = {
            w: width - 150,
            h: height - 150,
            levels: 5,
            maxValue: 5, 
            labelFactor: 1.25,
            opacityArea: 0.25,
        };

        const radius = Math.min(cfg.w / 2, cfg.h / 2);
        const axesData = datasets[0].data; 
        const angleSlice = Math.PI * 2 / axesData.length;

        const rScale = scaleLinear()
            .range([0, radius])
            .domain([0, cfg.maxValue]);

        const axisGrid = g.append("g").attr("class", "axisWrapper");

        axisGrid.selectAll(".levels")
            .data(Array.from({ length: cfg.levels }, (_, i) => i + 1).reverse())
            .enter()
            .append("circle")
            .attr("class", "gridCircle")
            .attr("r", (d) => radius / cfg.levels * d)
            .style("fill", theme.surfaceVariant)
            .style("stroke", theme.outlineVariant)
            .style("fill-opacity", 0.3);

        axisGrid.selectAll(".axisLabel")
            .data(Array.from({ length: cfg.levels }, (_, i) => i + 1).reverse())
            .enter().append("text")
            .attr("class", "axisLabel")
            .attr("x", 4)
            .attr("y", (d) => -radius / cfg.levels * d)
            .attr("dy", "0.4em")
            .style("font-size", "10px")
            .attr("fill", theme.onSurfaceVariant)
            .text((d) => d);

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
            .text((d) => truncateLabel(d.axis, 15))
            .style("fill", theme.onSurface)
            .append("title")
            .text(d => d.axis);

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
                .text((d) => `${dataset.name}: Livello ${d.value.toFixed(1)}`);
        });

    }, [datasets, width, height, theme, svgRef]);

    return <svg ref={svgRef} width={width} height={height} className="w-full h-full bg-surface-container-low rounded-xl border border-outline-variant cursor-move" />;
};

// 5. Radial Dendrogram
const SkillRadialTree: React.FC<{
    data: any,
    width: number,
    height: number,
    theme: any,
    zoomAction: ZoomAction,
    svgRef: React.RefObject<SVGSVGElement>
}> = ({ data, width, height, theme, zoomAction, svgRef }) => {

    const zoomBehavior = useRef<any>(null);
    const gRef = useRef<any>(null);

    useEffect(() => {
        if (!svgRef.current) return;
        const svg = select(svgRef.current);
        
        zoomBehavior.current = d3Zoom()
            .scaleExtent([0.1, 4])
            .on("zoom", (event: any) => {
                if(gRef.current) gRef.current.attr("transform", event.transform);
            });
        
        svg.call(zoomBehavior.current);
    }, [width, height, svgRef]);

    useEffect(() => {
        if (!svgRef.current || !zoomBehavior.current) return;
        const svg = select(svgRef.current);
        
        if (zoomAction.type === 'in') {
            svg.transition().duration(300).call(zoomBehavior.current.scaleBy, 1.2);
        } else if (zoomAction.type === 'out') {
            svg.transition().duration(300).call(zoomBehavior.current.scaleBy, 0.8);
        } else if (zoomAction.type === 'reset') {
            svg.transition().duration(750).call(zoomBehavior.current.transform, zoomIdentity.translate(width / 2, height / 2).scale(0.8));
        }
    }, [zoomAction, width, height]);

    useEffect(() => {
        if (!svgRef.current || !data) return;

        const svg = select(svgRef.current);
        svg.selectAll("g").remove();

        const g = svg.append("g");
        gRef.current = g;

        const t = zoomTransform(svg.node() as Element);
        if (t.k === 1 && t.x === 0 && t.y === 0) {
             svg.call(zoomBehavior.current.transform, zoomIdentity.translate(width / 2, height / 2).scale(0.8));
        } else {
             g.attr("transform", t.toString());
        }

        const layoutRadius = 600; 

        const root = d3Hierarchy(data);
        
        const tree = d3Tree()
            .size([2 * Math.PI, layoutRadius])
            .separation((a, b) => (a.parent === b.parent ? 1 : 2) / (a.depth || 1));

        tree(root);

        g.append("g")
            .attr("fill", "none")
            .attr("stroke", theme.outlineVariant)
            .attr("stroke-opacity", 0.4)
            .attr("stroke-width", 1.5)
            .selectAll("path")
            .data(root.links())
            .join("path")
            .attr("d", d3LinkRadial()
                .angle((d: any) => d.x)
                .radius((d: any) => d.y) as any
            );

        const node = g.append("g")
            .selectAll("circle")
            .data(root.descendants())
            .join("circle")
            .attr("transform", (d: any) => `
                rotate(${d.x * 180 / Math.PI - 90})
                translate(${d.y},0)
            `)
            .attr("fill", (d: any) => {
                if (d.depth === 0) return theme.inverseSurface;
                if (d.depth === 3) return theme.tertiary;
                if (d.depth === 4) return theme.primary;
                return theme.secondary;
            })
            .attr("r", (d: any) => d.depth === 4 ? 3 : 5);

        g.append("g")
            .attr("stroke-linejoin", "round")
            .attr("stroke-width", 3)
            .selectAll("text")
            .data(root.descendants())
            .join("text")
            .attr("transform", (d: any) => `
                rotate(${d.x * 180 / Math.PI - 90}) 
                translate(${d.y},0) 
                rotate(${d.x >= Math.PI ? 180 : 0})
            `)
            .attr("dy", "0.31em")
            .attr("x", (d: any) => d.x < Math.PI === !d.children ? 6 : -6)
            .attr("text-anchor", (d: any) => d.x < Math.PI === !d.children ? "start" : "end")
            .attr("fill", (d: any) => d.depth === 4 ? theme.primary : theme.onSurface)
            .attr("font-size", (d: any) => d.depth === 4 ? "9px" : "11px")
            .attr("font-weight", (d: any) => d.depth === 3 ? "bold" : "normal")
            .text((d: any) => truncateLabel(d.data.name, 20))
            .clone(true).lower()
            .attr("stroke", theme.surface)
            .attr("stroke-width", 4)
            .select(function() { return this.parentNode; }).append("title").text((d: any) => d.data.name);

    }, [data, width, height, theme, svgRef]);

    return <svg ref={svgRef} width={width} height={height} className="w-full h-full bg-surface-container-low rounded-xl border border-outline-variant cursor-move" />;
};

// 6. Circle Packing
const SkillCirclePacking: React.FC<{
    data: any,
    width: number,
    height: number,
    theme: any,
    zoomAction: ZoomAction,
    svgRef: React.RefObject<SVGSVGElement>
}> = ({ data, width, height, theme, zoomAction, svgRef }) => {

    const zoomBehavior = useRef<any>(null);
    const gRef = useRef<any>(null);

    useEffect(() => {
        if (!svgRef.current) return;
        const svg = select(svgRef.current);
        
        zoomBehavior.current = d3Zoom()
            .scaleExtent([0.1, 8])
            .on("zoom", (event: any) => {
                if(gRef.current) gRef.current.attr("transform", event.transform);
            });
        
        svg.call(zoomBehavior.current);
    }, [width, height, svgRef]);

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
    }, [zoomAction, width, height]);

    useEffect(() => {
        if (!svgRef.current || !data) return;

        const svg = select(svgRef.current);
        svg.selectAll("g").remove();

        const g = svg.append("g");
        gRef.current = g;

        const t = zoomTransform(svg.node() as Element);
        if (t.k === 1 && t.x === 0 && t.y === 0) {
             // Default center
        } else {
             g.attr("transform", t.toString());
        }

        const root = d3Hierarchy(data)
            .sum(d => d.value)
            .sort((a: any, b: any) => (b.value || 0) - (a.value || 0));
            
        if (!root.value) {
             g.append("text")
                .attr("x", width/2)
                .attr("y", height/2)
                .attr("text-anchor", "middle")
                .attr("fill", theme.onSurfaceVariant)
                .text("Nessun dato disponibile per il Packing (0 skills assegnate)");
             return;
        }

        const pack = d3Pack()
            .size([width, height])
            .padding(3);

        pack(root);

        const getColor = (d: any) => {
            if (!d.children) return theme.primaryContainer; 
            switch(d.depth) {
                case 0: return 'transparent'; 
                case 1: return theme.surfaceContainerHigh; 
                case 2: return theme.secondaryContainer; 
                default: return theme.surface;
            }
        };

        const node = g.selectAll("g")
            .data(root.descendants())
            .join("g")
            .attr("transform", (d: any) => `translate(${d.x},${d.y})`);

        node.append("circle")
            .attr("r", (d: any) => d.r)
            .attr("fill", (d: any) => getColor(d))
            .attr("stroke", theme.outlineVariant)
            .attr("stroke-width", 1)
            .on("mouseover", function() { 
                select(this).attr("stroke", theme.primary).attr("stroke-width", 2); 
            })
            .on("mouseout", function() { 
                select(this).attr("stroke", theme.outlineVariant).attr("stroke-width", 1); 
            });

        node.append("title")
            .text((d: any) => `${d.data.name}\nRisorse: ${d.value}`);

        // Labels
        node.filter((d: any) => !d.children && d.r > 15).append("text")
            .attr("dy", "0.3em")
            .style("text-anchor", "middle")
            .text((d: any) => truncateLabel(d.data.name, Math.floor(d.r / 3))) 
            .attr("font-size", "10px")
            .attr("fill", theme.onPrimaryContainer)
            .style("pointer-events", "none"); 

    }, [data, width, height, theme, svgRef]);

    return <svg ref={svgRef} width={width} height={height} className="w-full h-full bg-surface-container-low rounded-xl border border-outline-variant cursor-move" />;
};

// 7. Sankey Diagram
const SkillSankeyChart: React.FC<{
    data: { nodes: any[], links: any[] },
    width: number,
    height: number,
    theme: any,
    zoomAction: ZoomAction,
    svgRef: React.RefObject<SVGSVGElement>
}> = ({ data, width, height, theme, zoomAction, svgRef }) => {

    const zoomBehavior = useRef<any>(null);
    const gRef = useRef<any>(null);

    useEffect(() => {
        if (!svgRef.current) return;
        const svg = select(svgRef.current);
        
        zoomBehavior.current = d3Zoom()
            .scaleExtent([0.1, 4])
            .on("zoom", (event: any) => {
                if(gRef.current) gRef.current.attr("transform", event.transform);
            });
        
        svg.call(zoomBehavior.current);
    }, [width, height, svgRef]);

    useEffect(() => {
        if (!svgRef.current || !zoomBehavior.current) return;
        const svg = select(svgRef.current);
        if (zoomAction.type === 'in') svg.transition().call(zoomBehavior.current.scaleBy, 1.2);
        else if (zoomAction.type === 'out') svg.transition().call(zoomBehavior.current.scaleBy, 0.8);
        else if (zoomAction.type === 'reset') svg.transition().call(zoomBehavior.current.transform, zoomIdentity);
    }, [zoomAction]);

    useEffect(() => {
        if (!svgRef.current || data.nodes.length === 0) return;

        const svg = select(svgRef.current);
        svg.selectAll("g").remove();

        const g = svg.append("g");
        gRef.current = g;
        
        const t = zoomTransform(svg.node() as Element);
        g.attr("transform", t.toString());

        const sankeyGenerator = d3Sankey()
            .nodeWidth(15)
            .nodePadding(10)
            .extent([[1, 1], [width - 1, height - 6]]);

        const sankeyData = {
            nodes: data.nodes.map(d => ({ ...d })),
            links: data.links.map(d => ({ ...d }))
        };

        const { nodes, links } = sankeyGenerator(sankeyData as any);
        
        const palette = getThemePalette(theme);
        const color = scaleOrdinal(palette);

        g.append("g")
            .attr("fill", "none")
            .attr("stroke-opacity", 0.5)
            .selectAll("g")
            .data(links)
            .join("g")
            .style("mix-blend-mode", "multiply")
            .append("path")
            .attr("d", sankeyLinkHorizontal())
            .attr("stroke", (d: any) => color(d.source.type || 'default'))
            .attr("stroke-width", (d: any) => Math.max(1, d.width))
            .append("title")
            .text((d: any) => `${d.source.name} → ${d.target.name}\n${d.value}`);

        g.append("g")
            .selectAll("rect")
            .data(nodes)
            .join("rect")
            .attr("x", (d: any) => d.x0)
            .attr("y", (d: any) => d.y0)
            .attr("height", (d: any) => d.y1 - d.y0)
            .attr("width", (d: any) => d.x1 - d.x0)
            .attr("fill", (d: any) => {
                if (d.type === 'resource') return theme.primary;
                if (d.type === 'skill') return theme.secondary;
                return color(d.type);
            })
            .attr("stroke", theme.outline)
            .append("title")
            .text((d: any) => `${d.name} (${d.type})`);

        g.append("g")
            .attr("font-size", "10px")
            .attr("font-family", "sans-serif")
            .selectAll("text")
            .data(nodes)
            .join("text")
            .attr("x", (d: any) => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
            .attr("y", (d: any) => (d.y1 + d.y0) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", (d: any) => d.x0 < width / 2 ? "start" : "end")
            .text((d: any) => truncateLabel(d.name, 15))
            .attr("fill", theme.onSurface)
            .append("title")
            .text((d: any) => d.name);

    }, [data, width, height, theme, svgRef]);

    return <svg ref={svgRef} width={width} height={height} className="w-full h-full bg-surface-container-low rounded-xl border border-outline-variant cursor-move" />;
};

// 8. Bubble Chart
const SkillBubbleChart: React.FC<{
    data: any,
    width: number,
    height: number,
    theme: any,
    zoomAction: ZoomAction,
    svgRef: React.RefObject<SVGSVGElement>
}> = ({ data, width, height, theme, zoomAction, svgRef }) => {

    const zoomBehavior = useRef<any>(null);
    const gRef = useRef<any>(null);

    useEffect(() => {
        if (!svgRef.current) return;
        const svg = select(svgRef.current);
        
        zoomBehavior.current = d3Zoom()
            .scaleExtent([0.1, 8])
            .on("zoom", (event: any) => {
                if(gRef.current) gRef.current.attr("transform", event.transform);
            });
        
        svg.call(zoomBehavior.current);
    }, [width, height, svgRef]);

    useEffect(() => {
        if (!svgRef.current || !zoomBehavior.current) return;
        const svg = select(svgRef.current);
        
        if (zoomAction.type === 'in') svg.transition().duration(300).call(zoomBehavior.current.scaleBy, 1.2);
        else if (zoomAction.type === 'out') svg.transition().duration(300).call(zoomBehavior.current.scaleBy, 0.8);
        else if (zoomAction.type === 'reset') svg.transition().duration(750).call(zoomBehavior.current.transform, zoomIdentity);
    }, [zoomAction]);

    useEffect(() => {
        if (!svgRef.current || !data) return;

        const svg = select(svgRef.current);
        svg.selectAll("g").remove();

        const g = svg.append("g");
        gRef.current = g;

        const t = zoomTransform(svg.node() as Element);
        g.attr("transform", t.toString());

        const root = d3Hierarchy(data)
            .sum(d => d.value)
            .sort((a: any, b: any) => (b.value || 0) - (a.value || 0));
            
        if (!root.value) {
             g.append("text").attr("x", width/2).attr("y", height/2).attr("text-anchor", "middle").attr("fill", theme.onSurfaceVariant).text("Nessun dato.");
             return;
        }

        const pack = d3Pack().size([width, height]).padding(5);
        pack(root);

        const colorScale = scaleSequential(interpolate(theme.primaryContainer, theme.primary))
            .domain([0, max(root.leaves(), (d: any) => d.value) || 10]);

        const node = g.selectAll("g")
            .data(root.leaves())
            .join("g")
            .attr("transform", (d: any) => `translate(${d.x},${d.y})`);

        node.append("circle")
            .attr("r", (d: any) => d.r)
            .attr("fill", (d: any) => colorScale(d.value) as string)
            .attr("stroke", theme.outline)
            .attr("stroke-width", 1)
            .on("mouseover", function() { select(this).attr("stroke-width", 2).attr("stroke", theme.tertiary); })
            .on("mouseout", function() { select(this).attr("stroke-width", 1).attr("stroke", theme.outline); });

        node.append("title").text((d: any) => `${d.data.name}: ${d.value} risorse`);

        const textGroup = node.append("text")
            .style("text-anchor", "middle")
            .attr("fill", theme.onPrimary)
            .style("pointer-events", "none")
            .style("text-shadow", "0px 1px 2px rgba(0,0,0,0.4)");

        textGroup.append("tspan")
            .attr("x", 0)
            .attr("dy", "-0.2em")
            .style("font-weight", "bold")
            .style("font-size", (d: any) => `${Math.max(8, Math.min(d.r / 2.5, 14))}px`) 
            .text((d: any) => truncateLabel(d.data.name, Math.floor(d.r / 3)));

        textGroup.append("tspan")
            .attr("x", 0)
            .attr("dy", "1.2em")
            .style("font-size", (d: any) => `${Math.max(8, Math.min(d.r / 3, 12))}px`)
            .text((d: any) => d.value);

    }, [data, width, height, theme, svgRef]);

    return <svg ref={svgRef} width={width} height={height} className="w-full h-full bg-surface-container-low rounded-xl border border-outline-variant cursor-move" />;
};


// --- Main Page Component ---

const SkillAnalysisPage: React.FC = () => {
    const { 
        resources, skills, projectSkills, resourceSkills, assignments, roles, locations, 
        skillCategories, skillMacroCategories 
    } = useEntitiesContext();
    const { theme, mode } = useTheme(); 
    
    const [view, setView] = useState<ViewMode>('network');
    const [zoomAction, setZoomAction] = useState<ZoomAction>({ type: 'reset', ts: 0 });
    
    const [filters, setFilters] = useState({
        resourceIds: [] as string[],
        roleIds: [] as string[],
        skillIds: [] as string[],
        categoryId: '', // Changed to ID
        macroCategoryId: '', // Changed to ID
        displayMode: 'all' as DisplayMode,
        location: ''
    });
    const [hideEmptyRows, setHideEmptyRows] = useState(false);

    const handleZoom = (type: 'in' | 'out' | 'reset') => {
        setZoomAction({ type, ts: Date.now() });
    };

    const chartRef = useRef<SVGSVGElement>(null);

    const resourceOptions = useMemo(() => resources.filter(r => !r.resigned).map(r => ({ value: r.id!, label: r.name })), [resources]);
    const roleOptions = useMemo(() => roles.map(r => ({ value: r.id!, label: r.name })), [roles]);
    const locationOptions = useMemo(() => locations.map(l => ({ value: l.value, label: l.value })), [locations]);
    
    // Updated Options - Clean Labels & ID Values
    const skillOptions = useMemo(() => skills.map(s => ({ value: s.id!, label: s.name })), [skills]);
    const categoryOptions = useMemo(() => skillCategories.map(c => ({ value: c.id, label: c.name })).sort((a, b) => a.label.localeCompare(b.label)), [skillCategories]);
    const macroCategoryOptions = useMemo(() => skillMacroCategories.map(m => ({ value: m.id, label: m.name })).sort((a, b) => a.label.localeCompare(b.label)), [skillMacroCategories]);

    // --- Filter Logic ---

    const filteredSkills = useMemo(() => {
        return skills.filter(s => {
            // 1. Skill ID Filter
            if (filters.skillIds.length > 0 && !filters.skillIds.includes(s.id!)) return false;

            // 2. Category ID Filter (Ambito)
            if (filters.categoryId) {
                if (!s.categoryIds?.includes(filters.categoryId)) return false;
            }

            // 3. Macro Category ID Filter
            if (filters.macroCategoryId) {
                // Check if any of the skill's categories belong to the selected macro
                const belongsToMacro = s.categoryIds?.some(catId => {
                    const cat = skillCategories.find(c => c.id === catId);
                    return cat?.macroCategoryIds?.includes(filters.macroCategoryId);
                });
                if (!belongsToMacro) return false;
            }
            
            if (filters.displayMode === 'skills_only' && s.isCertification) return false;
            if (filters.displayMode === 'certs_only' && !s.isCertification) return false;

            return true;
        });
    }, [skills, filters, skillCategories]);

    const filteredResources = useMemo(() => {
        const validSkillIds = new Set(filteredSkills.map(s => s.id));

        return resources.filter(r => {
            if (r.resigned) return false;
            const resMatch = filters.resourceIds.length === 0 || filters.resourceIds.includes(r.id!);
            const roleMatch = filters.roleIds.length === 0 || filters.roleIds.includes(r.roleId);
            const locationMatch = !filters.location || r.location === filters.location;

            if (hideEmptyRows || filters.displayMode === 'not_empty') {
                const hasRelevantSkill = resourceSkills.some(rs => 
                    rs.resourceId === r.id && validSkillIds.has(rs.skillId)
                );
                if (!hasRelevantSkill) return false;
            }

            return resMatch && roleMatch && locationMatch;
        });
    }, [resources, filters, resourceSkills, filteredSkills, hideEmptyRows]);

    // --- Data Preparation ---

    const networkData = useMemo(() => {
        if (view !== 'network') return { nodes: [], links: [] };
        
        const nodes: any[] = [];
        const links: any[] = [];
        const nodeIds = new Set();

        filteredSkills.forEach(s => {
            nodes.push({ id: `skill_${s.id}`, name: s.name, type: 'skill', category: s.category, macroCategory: s.macroCategory, isCertification: s.isCertification });
            nodeIds.add(`skill_${s.id}`);
        });

        filteredResources.forEach(r => {
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
        
        const data: any[] = [];
        const resList = filteredResources.map(r => r.name);
        const skillList = filteredSkills.map(s => s.name); 
        
        filteredResources.forEach(r => {
            filteredSkills.forEach(s => {
                let days = 0;
                const manual = resourceSkills.find(rs => rs.resourceId === r.id && rs.skillId === s.id);
                if (manual) days += (manual.level || 1) * 20; 
                
                const rAssignments = assignments.filter(a => a.resourceId === r.id);
                rAssignments.forEach(a => {
                    if(projectSkills.some(ps => ps.projectId === a.projectId && ps.skillId === s.id)) {
                        days += 10;
                    }
                });

                if (days > 0) {
                    data.push({
                        resource: r.name,
                        skillLabel: s.name,
                        value: Math.min(100, days)
                    });
                }
            });
        });

        return { data, resources: resList, skills: skillList };
    }, [filteredResources, filteredSkills, assignments, projectSkills, resourceSkills, view]);

    const chordData = useMemo(() => {
        if (view !== 'chord') return { matrix: [], names: [] };
        
        const relevantSkillIds = new Set(filteredSkills.map(s => s.id));
        const relevantSkillIndices = new Map<string, number>(filteredSkills.map((s, i) => [s.id!, i]));
        
        const n = filteredSkills.length;
        if (n === 0 || n > 50) return { matrix: [], names: [] }; 

        const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
        
        filteredResources.forEach(r => {
            const rSkillIds = resourceSkills
                .filter(rs => rs.resourceId === r.id && relevantSkillIds.has(rs.skillId))
                .map(rs => rs.skillId);

            for (let i = 0; i < rSkillIds.length; i++) {
                for (let j = i + 1; j < rSkillIds.length; j++) {
                    const idx1 = relevantSkillIndices.get(rSkillIds[i]);
                    const idx2 = relevantSkillIndices.get(rSkillIds[j]);
                    if (idx1 !== undefined && idx2 !== undefined) {
                        matrix[idx1][idx2]++;
                        matrix[idx2][idx1]++;
                    }
                }
            }
        });

        return { matrix, names: filteredSkills.map(s => s.name) };
    }, [filteredSkills, resourceSkills, filteredResources, view]);

    const radarData = useMemo(() => {
        if (view !== 'radar') return [];
        
        const targetSkills = filteredSkills.slice(0, 8);
        if (targetSkills.length < 3) return []; 
        
        const datasets: any[] = [];
        const palette = getThemePalette(mode === 'dark' ? theme.dark : theme.light);

        if (filteredResources.length <= 5) {
            filteredResources.forEach((r, idx) => {
                const dataPoints = targetSkills.map(s => {
                    const rs = resourceSkills.find(x => x.resourceId === r.id && x.skillId === s.id);
                    return { axis: s.name, value: rs?.level || 0 }; 
                });
                datasets.push({ name: r.name, color: palette[idx % palette.length], data: dataPoints });
            });
        } else {
            const avgDataPoints = targetSkills.map(s => {
                const values = filteredResources.map(r => {
                    const rs = resourceSkills.find(x => x.resourceId === r.id && x.skillId === s.id);
                    return rs?.level || 0;
                });
                const avg = mean(values) || 0;
                return { axis: s.name, value: avg };
            });
            const currentPalette = mode === 'dark' ? theme.dark : theme.light;
            datasets.push({ name: 'Media Gruppo Filtrato', color: currentPalette.primary, data: avgDataPoints });
        }

        return datasets;
    }, [filteredResources, filteredSkills, resourceSkills, view, theme, mode]);

    const dendrogramData = useMemo(() => {
        if (view !== 'dendrogram') return null;
        
        const root: any = { name: "Competenze", children: [] };
        const groups = new Map<string, Map<string, Map<string, any[]>>>();

        filteredSkills.forEach(skill => {
            const associatedResources = resourceSkills
                .filter(rs => rs.skillId === skill.id)
                .map(rs => filteredResources.find(r => r.id === rs.resourceId))
                .filter(r => r !== undefined)
                .map(r => ({ name: r!.name, type: 'resource' }));

            const addToGroups = (macroName: string, catName: string) => {
                if (!groups.has(macroName)) groups.set(macroName, new Map());
                if (!groups.get(macroName)?.has(catName)) groups.get(macroName)?.set(catName, new Map());
                groups.get(macroName)?.get(catName)?.set(skill.name, associatedResources);
            };

            if (!skill.categoryIds || skill.categoryIds.length === 0) {
                addToGroups('Altro', 'Generico');
            } else {
                skill.categoryIds.forEach(catId => {
                    const cat = skillCategories.find(c => c.id === catId);
                    const catName = cat?.name || 'Unknown';
                    
                    if (!cat?.macroCategoryIds || cat.macroCategoryIds.length === 0) {
                        addToGroups('Altro', catName);
                    } else {
                        cat.macroCategoryIds.forEach(macroId => {
                            const macro = skillMacroCategories.find(m => m.id === macroId);
                            const macroName = macro?.name || 'Unknown';
                            addToGroups(macroName, catName);
                        });
                    }
                });
            }
        });

        groups.forEach((catMap, macroName) => {
            const macroNode: any = { name: macroName, type: 'macro', children: [] };
            catMap.forEach((skillMap, catName) => {
                const catNode: any = { name: catName, type: 'category', children: [] };
                skillMap.forEach((resList, skillName) => {
                    const skillNode: any = { name: skillName, type: 'skill', children: resList };
                    catNode.children.push(skillNode);
                });
                macroNode.children.push(catNode);
            });
            root.children.push(macroNode);
        });

        return root;
    }, [filteredSkills, filteredResources, resourceSkills, view, skillCategories, skillMacroCategories]);

    const packingData = useMemo(() => {
        if (view !== 'packing') return null;
        
        const root: any = { name: "Competenze", children: [] };
        const groups = new Map<string, Map<string, any[]>>();

        filteredSkills.forEach(skill => {
            const count = resourceSkills.filter(rs => 
                rs.skillId === skill.id && 
                filteredResources.some(r => r.id === rs.resourceId)
            ).length;

            if (count === 0) return;

            const addToGroups = (macroName: string, catName: string) => {
                if (!groups.has(macroName)) groups.set(macroName, new Map());
                if (!groups.get(macroName)?.has(catName)) groups.get(macroName)?.set(catName, []);
                groups.get(macroName)?.get(catName)?.push({ name: skill.name, value: count });
            };

            if (!skill.categoryIds || skill.categoryIds.length === 0) {
                addToGroups('Altro', 'Generico');
            } else {
                skill.categoryIds.forEach(catId => {
                    const cat = skillCategories.find(c => c.id === catId);
                    const catName = cat?.name || 'Unknown';
                    
                    if (!cat?.macroCategoryIds || cat.macroCategoryIds.length === 0) {
                        addToGroups('Altro', catName);
                    } else {
                        cat.macroCategoryIds.forEach(macroId => {
                            const macro = skillMacroCategories.find(m => m.id === macroId);
                            const macroName = macro?.name || 'Unknown';
                            addToGroups(macroName, catName);
                        });
                    }
                });
            }
        });

        groups.forEach((catMap, macroName) => {
            const macroNode: any = { name: macroName, children: [] };
            catMap.forEach((skillsList, catName) => {
                const catNode: any = { name: catName, children: skillsList };
                macroNode.children.push(catNode);
            });
            root.children.push(macroNode);
        });

        return root;
    }, [filteredSkills, filteredResources, resourceSkills, view, skillCategories, skillMacroCategories]);

    const sankeyData = useMemo(() => {
        if (view !== 'sankey') return { nodes: [], links: [] };

        const nodes: any[] = [];
        const links: any[] = [];
        const nodeMap = new Map<string, number>();
        
        let nodeIdx = 0;
        const addNode = (name: string, type: string) => {
            const id = `${type}_${name}`;
            if (!nodeMap.has(id)) {
                nodes.push({ name: name, type });
                nodeMap.set(id, nodeIdx++);
            }
            return nodeMap.get(id)!;
        };

        const linkMap = new Map<string, number>(); 

        filteredSkills.forEach(skill => {
            const skillName = skill.name;
            const connectedResources = resourceSkills
                .filter(rs => rs.skillId === skill.id)
                .map(rs => filteredResources.find(r => r.id === rs.resourceId))
                .filter(r => r !== undefined) as any[];

            if (connectedResources.length === 0) return;

            const processPath = (macroName: string, catName: string) => {
                const mIdx = addNode(macroName, 'macro');
                const cIdx = addNode(catName, 'category');
                const sIdx = addNode(skillName, 'skill');

                const keyMC = `${mIdx}-${cIdx}`;
                linkMap.set(keyMC, (linkMap.get(keyMC) || 0) + connectedResources.length);

                const keyCS = `${cIdx}-${sIdx}`;
                linkMap.set(keyCS, (linkMap.get(keyCS) || 0) + connectedResources.length);

                connectedResources.forEach(res => {
                    const rIdx = addNode(res.name, 'resource');
                    const keySR = `${sIdx}-${rIdx}`;
                    linkMap.set(keySR, (linkMap.get(keySR) || 0) + 1);
                });
            };

            if (!skill.categoryIds || skill.categoryIds.length === 0) {
                processPath('Altro', 'Generico');
            } else {
                skill.categoryIds.forEach(catId => {
                    const cat = skillCategories.find(c => c.id === catId);
                    const catName = cat?.name || 'Unknown';
                    
                    if (!cat?.macroCategoryIds || cat.macroCategoryIds.length === 0) {
                        processPath('Altro', catName);
                    } else {
                        cat.macroCategoryIds.forEach(macroId => {
                            const macro = skillMacroCategories.find(m => m.id === macroId);
                            const macroName = macro?.name || 'Unknown';
                            processPath(macroName, catName);
                        });
                    }
                });
            }
        });

        linkMap.forEach((val, key) => {
            const [source, target] = key.split('-').map(Number);
            links.push({ source, target, value: val });
        });

        return { nodes, links };
    }, [filteredSkills, filteredResources, resourceSkills, view, skillCategories, skillMacroCategories]);

    const bubbleData = useMemo(() => {
        if (view !== 'bubble') return null;
        const counts = new Map<string, number>();
        resourceSkills.forEach(rs => {
            if (filteredResources.some(r => r.id === rs.resourceId)) {
                const skill = skills.find(s => s.id === rs.skillId);
                if (skill && filteredSkills.some(fs => fs.id === skill.id)) {
                    const name = skill.name;
                    counts.set(name, (counts.get(name) || 0) + 1);
                }
            }
        });
        const children = Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
        return { name: "Skills", children };
    }, [view, resourceSkills, filteredResources, skills, filteredSkills]);


    const currentTheme = mode === 'dark' ? theme.dark : theme.light; 

    // Export handlers
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
                
                <div className="flex items-center space-x-1 bg-surface-container p-1 rounded-full overflow-x-auto max-w-full">
                    <button onClick={() => setView('network')} className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 whitespace-nowrap ${view === 'network' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant hover:text-on-surface'}`}>Network</button>
                    <button onClick={() => setView('heatmap')} className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 whitespace-nowrap ${view === 'heatmap' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant hover:text-on-surface'}`}>Heatmap</button>
                    <button onClick={() => setView('chord')} className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 whitespace-nowrap ${view === 'chord' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant hover:text-on-surface'}`}>Chord</button>
                    <button onClick={() => setView('radar')} className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 whitespace-nowrap ${view === 'radar' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant hover:text-on-surface'}`}>Radar</button>
                    <button onClick={() => setView('dendrogram')} className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 whitespace-nowrap ${view === 'dendrogram' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant hover:text-on-surface'}`}>Dendrogramma</button>
                    <button onClick={() => setView('packing')} className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 whitespace-nowrap ${view === 'packing' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant hover:text-on-surface'}`}>Packing</button>
                    <button onClick={() => setView('sankey')} className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 whitespace-nowrap ${view === 'sankey' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant hover:text-on-surface'}`}>Sankey</button>
                    <button onClick={() => setView('bubble')} className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 whitespace-nowrap ${view === 'bubble' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant hover:text-on-surface'}`}>Bubble</button>
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
                    <div className="md:col-span-2">
                        <MultiSelectDropdown name="resourceIds" selectedValues={filters.resourceIds} onChange={(_, v) => setFilters(f => ({...f, resourceIds: v}))} options={resourceOptions} placeholder="Risorse"/>
                    </div>
                    
                    <div className="md:col-span-1">
                        <MultiSelectDropdown name="roleIds" selectedValues={filters.roleIds} onChange={(_, v) => setFilters(f => ({...f, roleIds: v}))} options={roleOptions} placeholder="Ruoli"/>
                    </div>
                    <SearchableSelect name="location" value={filters.location} onChange={(_, v) => setFilters(f => ({...f, location: v}))} options={locationOptions} placeholder="Sede"/>
                    
                    <div className="md:col-span-2">
                        <MultiSelectDropdown name="skillIds" selectedValues={filters.skillIds} onChange={(_, v) => setFilters(f => ({...f, skillIds: v}))} options={skillOptions} placeholder="Competenze"/>
                    </div>
                    
                    <SearchableSelect name="category" value={filters.categoryId} onChange={(_, v) => setFilters(f => ({...f, categoryId: v}))} options={categoryOptions} placeholder="Ambito"/>
                    <SearchableSelect name="macroCategory" value={filters.macroCategoryId} onChange={(_, v) => setFilters(f => ({...f, macroCategoryId: v}))} options={macroCategoryOptions} placeholder="Macro Ambito"/>
                    
                    <select 
                        className="form-select text-sm"
                        value={filters.displayMode}
                        onChange={e => setFilters(prev => ({ ...prev, displayMode: e.target.value as DisplayMode }))}
                    >
                        <option value="all">Tutti (Competenze e Cert.)</option>
                        <option value="skills_only">Solo Competenze (No Cert)</option>
                        <option value="certs_only">Solo Certificazioni</option>
                        <option value="not_empty">Solo con Competenze/Cert.</option>
                    </select>

                    <div className="flex items-center gap-2 bg-surface-container px-2 py-2 rounded h-full">
                        <input 
                            type="checkbox" 
                            id="hideEmptyRows" 
                            checked={hideEmptyRows} 
                            onChange={e => setHideEmptyRows(e.target.checked)} 
                            className="form-checkbox"
                        />
                        <label htmlFor="hideEmptyRows" className="text-xs text-on-surface whitespace-nowrap cursor-pointer select-none">
                            Nascondi righe vuote
                        </label>
                    </div>

                    <button onClick={() => { setFilters({ resourceIds: [], roleIds: [], skillIds: [], categoryId: '', macroCategoryId: '', displayMode: 'all', location: '' }); setHideEmptyRows(false); }} className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full hover:opacity-90 w-full text-sm font-medium">
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
                {view === 'dendrogram' && <SkillRadialTree data={dendrogramData} width={1200} height={700} theme={currentTheme} zoomAction={zoomAction} svgRef={chartRef} />}
                {view === 'packing' && <SkillCirclePacking data={packingData} width={1200} height={700} theme={currentTheme} zoomAction={zoomAction} svgRef={chartRef} />}
                {view === 'sankey' && <SkillSankeyChart data={sankeyData} width={1200} height={700} theme={currentTheme} zoomAction={zoomAction} svgRef={chartRef} />}
                {view === 'bubble' && <SkillBubbleChart data={bubbleData} width={1200} height={700} theme={currentTheme} zoomAction={zoomAction} svgRef={chartRef} />}
            </div>
        </div>
    );
};

export default SkillAnalysisPage;
