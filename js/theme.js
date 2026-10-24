// Leori Gestão — aparência editável (cor principal, barra lateral, fonte, modo, cantos)
import { mix, luminance, hexToRgb } from './utils.js';
import { DEFAULT_THEME } from './store.js';

export const PRESETS = [
  ['Grafite', '#57534e'], ['Areia', '#a08a6c'], ['Sálvia', '#6b7f6a'], ['Azul acinzentado', '#5b6b7f'],
  ['Rosa antigo', '#a8737a'], ['Lavanda', '#7d7397'], ['Terracota', '#b06a4f'], ['Petróleo', '#3f6f73']
];
export const FONTES = [
  ['Inter', "'Inter', system-ui, sans-serif"],
  ['Nunito', "'Nunito', system-ui, sans-serif"],
  ['Poppins', "'Poppins', system-ui, sans-serif"],
  ['Lora', "'Lora', Georgia, serif"],
  ['Sistema', "system-ui, 'Segoe UI', Roboto, sans-serif"]
];
const RAIO = { retos: '4px', medios: '10px', redondos: '16px' };
const LS = 'leori_tema';

export function applyTheme(t = {}) {
  t = { ...DEFAULT_THEME, ...t };
  const r = document.documentElement.style;
  const p = /^#[0-9a-f]{6}$/i.test(t.primaria) ? t.primaria : DEFAULT_THEME.primaria;
  const dark = t.modo === 'escuro';
  r.setProperty('--primary', p);
  r.setProperty('--primary-rgb', hexToRgb(p).join(','));
  r.setProperty('--primary-hover', mix(p, '#000000', 0.15));
  r.setProperty('--primary-soft', dark ? mix(p, '#1c1b1a', 0.75) : mix(p, '#ffffff', 0.88));
  r.setProperty('--primary-ink', dark ? mix(p, '#ffffff', 0.45) : mix(p, '#000000', 0.2));
  r.setProperty('--on-primary', luminance(p) > 0.45 ? '#1c1917' : '#ffffff');
  r.setProperty('--radius', RAIO[t.cantos] || RAIO.medios);
  r.setProperty('--font', (FONTES.find(f => f[0] === t.fonte) || FONTES[0])[1]);
  document.documentElement.dataset.tema = dark ? 'escuro' : 'claro';
  document.documentElement.dataset.side = t.lateral;
  if (t.lateral === 'cor') {
    r.setProperty('--side-bg', mix(p, '#000000', 0.35));
  } else r.removeProperty('--side-bg');
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = dark ? '#1c1b1a' : '#ffffff';
  try { localStorage.setItem(LS, JSON.stringify(t)); } catch { /* sem armazenamento local */ }
}

export function applyCachedTheme() {
  try { applyTheme(JSON.parse(localStorage.getItem(LS) || '{}')); } catch { applyTheme(); }
}

// Cores para gráficos: cor principal + tons neutros
export function chartColors() {
  const cs = getComputedStyle(document.documentElement);
  const p = cs.getPropertyValue('--primary').trim() || '#57534e';
  return {
    primary: p,
    primarySoft: mix(p, document.documentElement.dataset.tema === 'escuro' ? '#000000' : '#ffffff', 0.55),
    neutral: cs.getPropertyValue('--chart-neutral').trim() || '#a8a29e',
    grid: cs.getPropertyValue('--line').trim() || '#e7e5e4',
    text: cs.getPropertyValue('--muted').trim() || '#78716c',
    series: [p, '#a8a29e', mix(p, '#ffffff', 0.45), '#78716c', mix(p, '#000000', 0.35), '#d6d3d1', '#57534e', mix(p, '#ffffff', 0.7)]
  };
}
