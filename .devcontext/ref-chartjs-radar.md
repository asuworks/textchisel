# Chart.js Radar Chart + Drag Plugin — Reference Guide

Generated: 2026-03-08
Purpose: Development reference for textchisel spider chart implementation.

---

## 1. Installation

```bash
npm install chart.js react-chartjs-2 chartjs-plugin-dragdata
```

### Version Compatibility

| Package | Version | Notes |
|---------|---------|-------|
| chart.js | ^4.x | Core library, tree-shakable |
| react-chartjs-2 | ^5.x | React wrapper for Chart.js v4 |
| chartjs-plugin-dragdata | ^2.3.x | Compatible with Chart.js v4, v3, v2.4+ |

---

## 2. React Setup & Plugin Registration

Chart.js v4 is tree-shakable. You must explicitly import and register every controller, element, scale, and plugin you use.

```tsx
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

// chartjs-plugin-dragdata auto-registers globally on import.
// Just importing it is enough:
import 'chartjs-plugin-dragdata';
```

### Disabling Auto-Registration (if needed)

If you want explicit control instead of global auto-registration:

```tsx
import ChartJSDragDataPlugin from 'chartjs-plugin-dragdata';
ChartJS.register(ChartJSDragDataPlugin);
```

---

## 3. Basic Radar Chart in React

```tsx
import React from 'react';
import { Radar } from 'react-chartjs-2';

const SpiderChart: React.FC = () => {
  const data = {
    labels: ['Clarity', 'Structure', 'Evidence', 'Style', 'Grammar', 'Depth'],
    datasets: [
      {
        label: 'Current Score',
        data: [3, 4, 2, 5, 3, 4],
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(54, 162, 235, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(54, 162, 235, 1)',
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      r: {
        min: 0,
        max: 5,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  return <Radar data={data} options={options} />;
};
```

---

## 4. Scale Configuration (RadialLinearScale)

The radar chart uses a single radial scale keyed as `r` in `options.scales`.

### Full Scale Options

```ts
const options = {
  scales: {
    r: {
      // --- Value range ---
      min: 0,              // Hard minimum (use suggestedMin for soft)
      max: 5,              // Hard maximum (use suggestedMax for soft)
      beginAtZero: true,

      // --- Tick marks (concentric rings) ---
      ticks: {
        stepSize: 1,        // Force ticks at 0, 1, 2, 3, 4, 5
        display: true,       // Show tick labels
        backdropColor: 'transparent', // Remove grey backdrop behind tick labels
        color: '#666',
        font: {
          size: 11,
        },
        // Custom tick label formatting:
        callback: function(value: number) {
          const levels = ['', 'Novice', 'Basic', 'Good', 'Strong', 'Expert'];
          return levels[value] || '';
        },
      },

      // --- Point labels (axis labels around perimeter) ---
      pointLabels: {
        display: true,
        color: '#333',
        font: {
          size: 13,
          weight: 'bold' as const,
          family: "'Inter', sans-serif",
        },
        padding: 10,
        // Scriptable: receives (context) => string
        // callback: (label: string, index: number) => label.toUpperCase(),
      },

      // --- Grid lines (concentric polygons) ---
      grid: {
        display: true,
        color: 'rgba(0, 0, 0, 0.1)',    // Grid line color
        lineWidth: 1,
        circular: false,  // false = polygon grid, true = circular grid
      },

      // --- Angle lines (radial spokes from center) ---
      angleLines: {
        display: true,
        color: 'rgba(0, 0, 0, 0.1)',
        lineWidth: 1,
        borderDash: [],          // e.g., [5, 5] for dashed
        borderDashOffset: 0,
      },
    },
  },
};
```

### Key Points

- `min` / `max` are hard bounds. Data outside them is clipped.
- `suggestedMin` / `suggestedMax` are soft bounds — they expand if data exceeds them.
- For discrete rubric levels (1-5), use `stepSize: 1` with `min: 0` and `max: 5`.
- `pointLabels` supports a `callback` for custom label formatting.
- `grid.circular: false` renders polygon-shaped grids (standard spider look). Set `true` for concentric circles.

---

## 5. Multiple Datasets (Overlay Two Polygons)

To overlay "current scores" and "target scores", define two dataset objects in the `datasets` array:

```ts
const data = {
  labels: ['Clarity', 'Structure', 'Evidence', 'Style', 'Grammar', 'Depth'],
  datasets: [
    {
      label: 'Current Score',
      data: [3, 4, 2, 5, 3, 4],
      backgroundColor: 'rgba(54, 162, 235, 0.15)',  // Light blue fill
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 2,
      pointBackgroundColor: 'rgba(54, 162, 235, 1)',
      pointBorderColor: '#fff',
      pointRadius: 6,
      pointHoverRadius: 8,
      fill: true,
      order: 1,  // Draw order (higher = drawn first / behind)
    },
    {
      label: 'Target Score',
      data: [4, 5, 4, 5, 4, 5],
      backgroundColor: 'rgba(255, 99, 132, 0.1)',   // Light red fill
      borderColor: 'rgba(255, 99, 132, 0.6)',
      borderWidth: 2,
      borderDash: [6, 3],                            // Dashed line
      pointBackgroundColor: 'rgba(255, 99, 132, 0.6)',
      pointBorderColor: '#fff',
      pointRadius: 4,
      pointStyle: 'triangle',
      fill: true,
      order: 2,  // Drawn behind current score
    },
  ],
};
```

### Dataset Properties Reference

| Property | Type | Description |
|----------|------|-------------|
| `label` | string | Legend label |
| `data` | number[] | One value per axis |
| `backgroundColor` | string | Fill color (use RGBA for opacity) |
| `borderColor` | string | Line color |
| `borderWidth` | number | Line thickness |
| `borderDash` | number[] | Dash pattern, e.g. `[6, 3]` |
| `fill` | boolean\|string | Fill area under line |
| `pointBackgroundColor` | string | Point fill color |
| `pointBorderColor` | string | Point border color |
| `pointRadius` | number | Point size in px |
| `pointHoverRadius` | number | Point size on hover |
| `pointStyle` | string | 'circle', 'triangle', 'rect', 'star', 'cross', etc. |
| `pointHitRadius` | number | Invisible hit area (set >= 25 for touch) |
| `tension` | number | Line curvature (0 = straight) |
| `order` | number | Draw order (higher = behind) |

---

## 6. Styling & Appearance

### Colors with Opacity

Use RGBA for fill transparency:

```ts
backgroundColor: 'rgba(54, 162, 235, 0.15)',  // 15% opacity fill
borderColor: 'rgba(54, 162, 235, 1)',           // Solid border
```

### Element Defaults (Global)

```ts
const options = {
  elements: {
    line: {
      borderWidth: 2,
      tension: 0,     // 0 = angular, 0.4 = smooth curves
    },
    point: {
      radius: 5,
      hoverRadius: 7,
      hitRadius: 25,   // Important for touch/drag
    },
  },
};
```

### Legend Configuration

```ts
const options = {
  plugins: {
    legend: {
      display: true,
      position: 'top' as const,
      labels: {
        usePointStyle: true,      // Use point icons instead of rectangles
        padding: 15,
        font: {
          size: 12,
        },
      },
    },
  },
};
```

### Tooltip Configuration

```ts
const options = {
  plugins: {
    tooltip: {
      enabled: true,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      titleFont: { size: 13 },
      bodyFont: { size: 12 },
      padding: 10,
      cornerRadius: 4,
      callbacks: {
        label: function(context: any) {
          return `${context.dataset.label}: ${context.parsed.r}/5`;
        },
      },
    },
  },
};
```

---

## 7. chartjs-plugin-dragdata Configuration

### Enabling Drag on the Chart

```ts
const options = {
  plugins: {
    dragData: {
      round: 0,            // Round dragged values to N decimal places (0 = integers)
      showTooltip: true,    // Show tooltip while dragging
      // dragX: false,      // Not applicable for radar (radar uses radial values)
    },
  },
  // Touch support: set pointHitRadius >= 25
  elements: {
    point: {
      hitRadius: 25,
    },
  },
};
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `round` | number | undefined | Round dragged value to N decimal places |
| `showTooltip` | boolean | true | Show tooltip during drag |
| `dragX` | boolean | false | Allow horizontal dragging (not used for radar) |
| `magnet.to` | function | undefined | Snap function, e.g. `Math.round` |

### Per-Dataset Enable/Disable

```ts
const data = {
  datasets: [
    {
      label: 'Current Score',
      data: [3, 4, 2, 5, 3, 4],
      dragData: true,          // This dataset IS draggable
    },
    {
      label: 'Target Score',
      data: [4, 5, 4, 5, 4, 5],
      dragData: false,         // This dataset is NOT draggable
    },
  ],
};
```

### Callbacks

The three callbacks are set in `options.plugins.dragData`:

```ts
const options = {
  plugins: {
    dragData: {
      round: 0,
      showTooltip: true,

      // Called when user begins dragging a point.
      // Return false to PREVENT dragging (lock the point).
      onDragStart: function(
        e: MouseEvent,
        datasetIndex: number,
        index: number,
        value: number
      ) {
        // Example: lock the "Target Score" dataset (index 1)
        if (datasetIndex === 1) return false;

        // Example: lock specific vertices by index
        // if (lockedVertices.has(index)) return false;

        // Return undefined or true to allow dragging
      },

      // Called continuously while dragging.
      // Return false to cancel the value update for this drag step.
      // Return a number to override the dragged value (clamping).
      onDrag: function(
        e: MouseEvent,
        datasetIndex: number,
        index: number,
        value: number
      ) {
        // Clamp value to scale bounds
        if (value < 1) return 1;
        if (value > 5) return 5;

        // Allow the drag
        return value;
      },

      // Called when user releases the point.
      // Use this to persist the final value.
      onDragEnd: function(
        e: MouseEvent,
        datasetIndex: number,
        index: number,
        value: number
      ) {
        // value is the final rounded value
        console.log(`Axis ${index} updated to ${value}`);
        // Persist to state / API here
      },
    },
  },
};
```

### Implementing Lock Behavior

To lock specific vertices so they cannot be dragged:

```tsx
// Track which vertices are locked (by axis index)
const [lockedAxes, setLockedAxes] = useState<Set<number>>(new Set([2, 4]));

const options = {
  plugins: {
    dragData: {
      round: 0,
      showTooltip: true,
      onDragStart: (
        e: MouseEvent,
        datasetIndex: number,
        index: number,
        value: number
      ) => {
        // Only allow dragging on the "current score" dataset (index 0)
        if (datasetIndex !== 0) return false;

        // Block dragging on locked axes
        if (lockedAxes.has(index)) return false;

        // Allow drag
        return undefined;
      },
      onDrag: (
        e: MouseEvent,
        datasetIndex: number,
        index: number,
        value: number
      ) => {
        // Snap to integers (rubric levels)
        return Math.round(value);
      },
      onDragEnd: (
        e: MouseEvent,
        datasetIndex: number,
        index: number,
        value: number
      ) => {
        // Update React state with the new score
        handleScoreChange(index, Math.round(value));
      },
    },
  },
};
```

### Magnet (Snap) Configuration

To snap dragged values to the nearest integer:

```ts
const options = {
  plugins: {
    dragData: {
      round: 0,
      magnet: {
        to: Math.round,   // Snaps to nearest integer on release
      },
    },
  },
};
```

---

## 8. Reactive Data Updates in React

### State-Driven Chart Updates

react-chartjs-2 automatically re-renders when `data` or `options` props change. Use React state:

```tsx
const [scores, setScores] = useState([3, 4, 2, 5, 3, 4]);

const data = useMemo(() => ({
  labels: ['Clarity', 'Structure', 'Evidence', 'Style', 'Grammar', 'Depth'],
  datasets: [
    {
      label: 'Current Score',
      data: scores,
      // ...styling
    },
  ],
}), [scores]);

const handleScoreChange = (axisIndex: number, newValue: number) => {
  setScores(prev => {
    const next = [...prev];
    next[axisIndex] = newValue;
    return next;
  });
};
```

### Accessing the Chart Instance via Ref

```tsx
import { useRef } from 'react';
import type { ChartJS } from 'chart.js';

const chartRef = useRef<ChartJS<'radar'>>(null);

// Access the Chart.js instance
useEffect(() => {
  const chart = chartRef.current;
  if (chart) {
    // Programmatic updates
    chart.data.datasets[0].data[2] = 5;
    chart.update();       // Re-render with animation
    // chart.update('none'); // Re-render without animation
  }
}, []);

return <Radar ref={chartRef} data={data} options={options} />;
```

### Important: redraw vs. update

- Passing new `data` object triggers an `update()` (smooth transition).
- Setting the `redraw` prop to `true` forces a full destroy + re-create (avoid unless necessary).

```tsx
<Radar data={data} options={options} redraw={false} />
```

---

## 9. Animation Configuration

```ts
const options = {
  animation: {
    duration: 400,                    // Transition duration in ms
    easing: 'easeOutQuart' as const,  // Easing function
  },
  // Disable animation entirely (for drag responsiveness):
  // animation: false,

  // Per-property animations:
  animations: {
    // Animate the polygon fill
    backgroundColor: {
      duration: 300,
      easing: 'linear',
    },
    // Animate point positions
    x: { duration: 0 },  // Instant x movement
    y: { duration: 0 },  // Instant y movement
  },

  // Transition-specific config
  transitions: {
    active: {
      animation: {
        duration: 200,    // Hover animation speed
      },
    },
  },
};
```

### Available Easing Functions

`linear`, `easeInQuad`, `easeOutQuad`, `easeInOutQuad`, `easeInCubic`, `easeOutCubic`, `easeInOutCubic`, `easeInQuart`, `easeOutQuart`, `easeInOutQuart`, `easeInQuint`, `easeOutQuint`, `easeInOutQuint`, `easeInSine`, `easeOutSine`, `easeInOutSine`, `easeInExpo`, `easeOutExpo`, `easeInOutExpo`, `easeInCirc`, `easeOutCirc`, `easeInOutCirc`, `easeInElastic`, `easeOutElastic`, `easeInOutElastic`, `easeInBack`, `easeOutBack`, `easeInOutBack`, `easeInBounce`, `easeOutBounce`, `easeInOutBounce`

---

## 10. Complete Example: Textchisel Spider Chart Skeleton

```tsx
import React, { useState, useMemo, useCallback } from 'react';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import 'chartjs-plugin-dragdata';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

interface SpiderChartProps {
  axisLabels: string[];
  currentScores: number[];
  targetScores: number[];
  lockedAxes: Set<number>;
  onScoreChange: (axisIndex: number, value: number) => void;
}

const SpiderChart: React.FC<SpiderChartProps> = ({
  axisLabels,
  currentScores,
  targetScores,
  lockedAxes,
  onScoreChange,
}) => {
  const data = useMemo(() => ({
    labels: axisLabels,
    datasets: [
      {
        label: 'Current Score',
        data: [...currentScores],
        backgroundColor: 'rgba(54, 162, 235, 0.15)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(54, 162, 235, 1)',
        pointBorderColor: '#fff',
        pointRadius: 6,
        pointHoverRadius: 8,
        pointHitRadius: 25,
        fill: true,
        dragData: true,   // Draggable
      },
      {
        label: 'Target Score',
        data: [...targetScores],
        backgroundColor: 'rgba(255, 99, 132, 0.08)',
        borderColor: 'rgba(255, 99, 132, 0.5)',
        borderWidth: 2,
        borderDash: [6, 3],
        pointBackgroundColor: 'rgba(255, 99, 132, 0.5)',
        pointBorderColor: '#fff',
        pointRadius: 4,
        pointStyle: 'triangle' as const,
        fill: true,
        dragData: false,  // Not draggable
      },
    ],
  }), [axisLabels, currentScores, targetScores]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      r: {
        min: 0,
        max: 5,
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          backdropColor: 'transparent',
          color: '#888',
          font: { size: 10 },
        },
        pointLabels: {
          color: '#333',
          font: { size: 13, weight: 'bold' as const },
          padding: 10,
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.08)',
          circular: false,
        },
        angleLines: {
          color: 'rgba(0, 0, 0, 0.08)',
        },
      },
    },
    elements: {
      line: { borderWidth: 2, tension: 0 },
      point: { hitRadius: 25 },
    },
    animation: {
      duration: 300,
      easing: 'easeOutQuart' as const,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: { usePointStyle: true, padding: 15 },
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.r}/5`,
        },
      },
      dragData: {
        round: 0,
        showTooltip: true,
        magnet: { to: Math.round },
        onDragStart: (
          _e: MouseEvent,
          datasetIndex: number,
          index: number,
          _value: number
        ) => {
          if (datasetIndex !== 0) return false;
          if (lockedAxes.has(index)) return false;
        },
        onDrag: (
          _e: MouseEvent,
          _datasetIndex: number,
          _index: number,
          value: number
        ) => {
          if (value < 1) return 1;
          if (value > 5) return 5;
          return Math.round(value);
        },
        onDragEnd: (
          _e: MouseEvent,
          _datasetIndex: number,
          index: number,
          value: number
        ) => {
          onScoreChange(index, Math.round(value));
        },
      },
    },
  }), [lockedAxes, onScoreChange]);

  return <Radar data={data} options={options} />;
};

export default SpiderChart;
```

---

## 11. TypeScript Considerations

### Augmenting Chart.js Types for dragData

chartjs-plugin-dragdata ships its own type declarations. If TypeScript does not recognize `dragData` in options, you can augment:

```ts
// types/chartjs-plugin-dragdata.d.ts
import 'chart.js';

declare module 'chart.js' {
  interface PluginOptionsByType<TType extends ChartType> {
    dragData?: {
      round?: number;
      showTooltip?: boolean;
      dragX?: boolean;
      magnet?: { to: (value: number) => number };
      onDragStart?: (e: MouseEvent, datasetIndex: number, index: number, value: number) => boolean | void;
      onDrag?: (e: MouseEvent, datasetIndex: number, index: number, value: number) => boolean | number | void;
      onDragEnd?: (e: MouseEvent, datasetIndex: number, index: number, value: number) => void;
    };
  }

  interface ChartDatasetProperties<TType extends ChartType, TData> {
    dragData?: boolean;
  }
}
```

---

## 12. Gotchas & Tips

1. **Tree-shaking**: You MUST register all Chart.js components you use. Missing `Filler` causes `fill: true` to silently fail.

2. **Touch support**: Set `pointHitRadius >= 25` on datasets or in `elements.point.hitRadius`. Without this, touch drag is nearly impossible on mobile.

3. **Auto-registration**: `chartjs-plugin-dragdata` auto-registers on import. If you import it in multiple files, it still only registers once. This is safe.

4. **Round + Magnet**: Both `round` and `magnet.to` affect final values. `round` applies during drag, `magnet.to` snaps on release. For integer-only rubric scores, use both: `round: 0` + `magnet: { to: Math.round }`.

5. **Re-render vs. update**: Changing the `data` prop triggers an in-place `chart.update()` with animation. Passing `redraw={true}` destroys and recreates the canvas (flickery; avoid).

6. **Callback stability**: Wrap `onDragEnd` and other callbacks with `useCallback` if they reference state, to avoid stale closures. Or use refs.

7. **Grid shape**: `grid.circular: false` gives the classic "spider web" polygon look. Set `true` for concentric circles.

8. **Scale key**: In Chart.js v4, radar scale is always `scales.r` (not `scale` or `scales.radial`).

9. **Dragging + state**: The dragdata plugin mutates `chart.data.datasets[i].data[j]` directly during drag. In `onDragEnd`, sync this back to React state. Do NOT set React state in `onDrag` (too frequent; causes re-render thrashing).

10. **Locking a whole dataset**: Set `dragData: false` on the dataset object. For per-point locking, use `onDragStart` returning `false`.

---

## Sources

1. [Chart.js Radar Chart Documentation](https://www.chartjs.org/docs/latest/charts/radar.html)
2. [Chart.js Linear Radial Axis (scales.r)](https://www.chartjs.org/docs/latest/axes/radial/linear.html)
3. [Chart.js Animations](https://www.chartjs.org/docs/latest/configuration/animations.html)
4. [react-chartjs-2 Radar Component](https://react-chartjs-2.js.org/components/radar/)
5. [react-chartjs-2 Radar Example](https://react-chartjs-2.js.org/examples/radar-chart/)
6. [react-chartjs-2 Chart Ref](https://react-chartjs-2.js.org/examples/chart-ref/)
7. [react-chartjs-2 TypeScript FAQ](https://react-chartjs-2.js.org/faq/typescript/)
8. [react-chartjs-2 Migration to v4](https://react-chartjs-2.js.org/docs/migration-to-v4/)
9. [chartjs-plugin-dragdata GitHub (artus9033)](https://github.com/artus9033/chartjs-plugin-dragdata)
10. [chartjs-plugin-dragdata npm](https://www.npmjs.com/package/chartjs-plugin-dragdata)
11. [chartjs-plugin-dragdata Radar Demo](https://github.com/artus9033/chartjs-plugin-dragdata/blob/master/pages/dist-demos/radar.html)
12. [chartjs-plugin-dragdata TypeScript Declarations](https://app.unpkg.com/chartjs-plugin-dragdata@2.3.1/files/dist/types/Configuration.d.ts)
