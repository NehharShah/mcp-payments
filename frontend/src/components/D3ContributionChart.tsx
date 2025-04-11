import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { parseISO, format } from 'date-fns';

interface ContributionData {
  date: string;
  value: number;
}

interface D3ContributionChartProps {
  data: ContributionData[];
  width?: number;
  height?: number;
}

const D3ContributionChart: React.FC<D3ContributionChartProps> = ({
  data,
  width = 800,
  height = 400,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();

    // Set margins
    const margin = { top: 20, right: 30, bottom: 30, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create SVG
    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Parse dates and create scales
    const xScale = d3
      .scaleTime()
      .domain(d3.extent(data, d => parseISO(d.date)) as [Date, Date])
      .range([0, innerWidth]);

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(data, d => d.value) || 0])
      .range([innerHeight, 0])
      .nice();

    // Create area generator
    const areaGenerator = d3
      .area<ContributionData>()
      .x(d => xScale(parseISO(d.date)))
      .y0(innerHeight)
      .y1(d => yScale(d.value))
      .curve(d3.curveMonotoneX);

    // Create line generator for the stroke
    const lineGenerator = d3
      .line<ContributionData>()
      .x(d => xScale(parseISO(d.date)))
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX);

    // Add gradient
    const gradient = svg
      .append('defs')
      .append('linearGradient')
      .attr('id', 'area-gradient')
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', 0)
      .attr('y2', innerHeight);

    gradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#6366F1')
      .attr('stop-opacity', 0.8);

    gradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#6366F1')
      .attr('stop-opacity', 0);

    // Add area path with animation
    svg
      .append('path')
      .datum(data)
      .attr('class', 'area')
      .attr('fill', 'url(#area-gradient)')
      .attr('d', areaGenerator)
      .style('opacity', 0)
      .transition()
      .duration(1000)
      .style('opacity', 1);

    // Add line path with animation
    const path = svg
      .append('path')
      .datum(data)
      .attr('class', 'line')
      .attr('fill', 'none')
      .attr('stroke', '#6366F1')
      .attr('stroke-width', 2)
      .attr('d', lineGenerator);

    const pathLength = path.node()?.getTotalLength() || 0;
    path
      .attr('stroke-dasharray', pathLength)
      .attr('stroke-dashoffset', pathLength)
      .transition()
      .duration(1000)
      .attr('stroke-dashoffset', 0);

    // Add axes
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(5)
      .tickFormat(d => format(d as Date, 'MMM d'));

    const yAxis = d3.axisLeft(yScale).ticks(5);

    svg
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    svg.append('g').attr('class', 'y-axis').call(yAxis);

    // Add data points with hover effect
    const tooltip = d3
      .select('body')
      .append('div')
      .attr('class', 'tooltip')
      .style('position', 'absolute')
      .style('background-color', 'white')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)')
      .style('display', 'none');

    svg
      .selectAll<SVGCircleElement, ContributionData>('.data-point')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'data-point')
      .attr('cx', d => xScale(parseISO(d.date)))
      .attr('cy', d => yScale(d.value))
      .attr('r', 0)
      .attr('fill', '#6366F1')
      .transition()
      .delay((_, i) => i * 100)
      .duration(500)
      .attr('r', 4);

    // Add hover interactions
    svg
      .selectAll<SVGCircleElement, ContributionData>('.data-point')
      .on('mouseover', function(event: MouseEvent, d: ContributionData) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', 6);

        tooltip
          .style('display', 'block')
          .html(
            `Date: ${format(parseISO(d.date), 'MMM d, yyyy')}<br/>Value: ${
              d.value
            }`
          )
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 10}px`);
      })
      .on('mouseout', function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', 4);

        tooltip.style('display', 'none');
      });

    // Cleanup function
    return () => {
      tooltip.remove();
    };
  }, [data, width, height]);

  return (
    <div className="relative w-full h-full">
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ minHeight: '300px' }}
      />
    </div>
  );
};

export default D3ContributionChart;
