// Gráficos (Chart.js) com as cores do tema
import { chartColors } from './theme.js';
import { money } from './utils.js';

const ativos = new Set();

export function destroyCharts() { ativos.forEach(c => c.destroy()); ativos.clear(); }

export function chart(canvas, cfg) {
  if (!window.Chart || !canvas) return null;
  const c = chartColors();
  const Chart = window.Chart;
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.color = c.text;
  const base = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 14 } },
      tooltip: { callbacks: { label: ctx => `${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${cfg.money === false ? ctx.formattedValue : money(ctx.raw?.y ?? ctx.raw)}` } }
    },
    scales: cfg.type === 'doughnut' ? {} : {
      x: { grid: { display: false }, border: { color: c.grid } },
      y: { grid: { color: c.grid }, border: { display: false }, beginAtZero: true, ticks: { callback: v => cfg.money === false ? v : money(v).replace(',00', '') } }
    }
  };
  const inst = new Chart(canvas, { type: cfg.type, data: cfg.data, options: deepMerge(base, cfg.options || {}) });
  ativos.add(inst);
  return inst;
}

function deepMerge(a, b) {
  const o = { ...a };
  Object.entries(b).forEach(([k, v]) => { o[k] = v && typeof v === 'object' && !Array.isArray(v) && typeof a[k] === 'object' ? deepMerge(a[k], v) : v; });
  return o;
}

export { chartColors };
