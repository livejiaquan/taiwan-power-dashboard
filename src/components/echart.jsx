import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  AriaComponent,
  GridComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  AriaComponent,
  GridComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
  SVGRenderer
]);

function prefersReducedMotion() {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

// Thin ECharts binding: one instance per mount, options replaced on change,
// resized with its container. SVG keeps text crisp on every DPR, and motion is
// dropped for viewers who ask for reduced motion.
export default function EChart({ option, className, ariaLabel }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    const chart = echarts.init(containerRef.current, null, { renderer: 'svg' });
    chartRef.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(
      { ...option, animation: prefersReducedMotion() ? false : option.animation ?? true },
      { notMerge: true }
    );
  }, [option]);

  return <div ref={containerRef} className={className} role="img" aria-label={ariaLabel} />;
}
