// Leori Gestão — inicialização, login, navegação e roteamento
import * as store from './store.js';
import { $, $$, esc, icon, toast } from './utils.js';
import { applyTheme, applyCachedTheme } from './theme.js';
import { materiaisParaRepor } from './logic.js';

applyCachedTheme();

export const NAV = [
  { id: 'inicio', label: 'Início', icon: 'home' },
  { id: 'clientes', label: 'Clientes', icon: 'users' },
  { id: 'empresa', label: 'Empresa', icon: 'wallet' },
  { id: 'precificacao', label: 'Precificação', icon: 'calc' },
  { id: 'estoque', label: 'Estoque', icon: 'box' },
  { id: 'precos', label: 'Preços de materiais', short: 'Preços', icon: 'tag' },
  { id: 'cronometro', label: 'Cronômetro', icon: 'timer' },
  { id: 'config', label: 'Configurações', short: 'Ajustes', icon: 'settings' }
];
const BOTTOM = ['inicio', 'clientes', 'empresa', 'cronometro'];

const PAGES = {
  inicio: () => import('./pages/inicio.js'),
  clientes: () => import('./pages/clientes.js'),
  empresa: () => import('./pages/empresa.js'),
  precificacao: () => import('./pages/precificacao.js'),
  estoque: () => import('./pages/estoque.js'),
  precos: () => import('./pages/precos.js'),
  cronometro: () => import('./pages/cronometro.js'),
  config: () => import('./pages/config.js')
};

const root = $('#root');
let current = null;   // { id, params, mod }

// ── Login ────────────────────────────────────────────────────────
function renderLogin(mode = 'entrar') {
  document.title = 'Entrar — Leori Gestão';
  const titles = { entrar: 'Entrar', criar: 'Criar conta', esqueci: 'Recuperar senha' };
  root.innerHTML = `
    <div class="login-wrap">
      <form class="login-card" id="loginForm" novalidate>
        <div class="brand-mark">${icon('bear', 30)}</div>
        <h1>Leori</h1>
        <p class="sub">Gestão do ateliê de amigurumis · ${titles[mode]}</p>
        <div class="form-grid" style="grid-template-columns:1fr">
          <div class="f s12"><label for="lEmail">E-mail</label><input id="lEmail" type="email" autocomplete="username" required></div>
          ${mode !== 'esqueci' ? `<div class="f s12"><label for="lSenha">Senha</label><input id="lSenha" type="password" autocomplete="${mode === 'criar' ? 'new-password' : 'current-password'}" minlength="8" required></div>` : ''}
          ${mode === 'criar' ? `<div class="f s12"><label for="lSenha2">Repita a senha</label><input id="lSenha2" type="password" autocomplete="new-password" required></div>` : ''}
        </div>
        <p class="form-msg mt-s" id="lMsg"></p>
        <button class="btn btn-primary" type="submit">${mode === 'esqueci' ? 'Enviar link de recuperação' : titles[mode]}</button>
        <div class="login-links">
          ${mode === 'entrar'
            ? `<button type="button" class="link-btn" data-mode="esqueci">Esqueci minha senha</button>${store.DEMO ? '<button type="button" class="link-btn" data-mode="criar">Criar conta</button>' : ''}`
            : `<button type="button" class="link-btn" data-mode="entrar">Voltar para o login</button>`}
        </div>
        ${store.DEMO ? `<div class="demo-note"><b>Modo demonstração:</b> o Firebase ainda não foi configurado. Qualquer e-mail e senha entram e os dados ficam só neste navegador.</div>` : ''}
      </form>
    </div>`;
  $$('.login-links [data-mode]').forEach(b => b.onclick = () => renderLogin(b.dataset.mode));
  const msg = $('#lMsg');
  $('#loginForm').onsubmit = async e => {
    e.preventDefault();
    const email = $('#lEmail').value.trim();
    const senha = $('#lSenha')?.value || '';
    const btn = e.submitter || $('#loginForm button[type=submit]');
    msg.className = 'form-msg mt-s err';
    if (!/^\S+@\S+\.\S+$/.test(email)) { msg.textContent = 'Digite um e-mail válido.'; return; }
    if (mode !== 'esqueci' && senha.length < (mode === 'criar' ? 8 : 1)) { msg.textContent = mode === 'criar' ? 'A senha precisa ter pelo menos 8 caracteres.' : 'Digite sua senha.'; return; }
    if (mode === 'criar' && senha !== $('#lSenha2').value) { msg.textContent = 'As senhas não conferem.'; return; }
    btn.disabled = true;
    try {
      if (mode === 'entrar') await store.login(email, senha);
      else if (mode === 'criar') await store.signup(email, senha);
      else { await store.resetPassword(email); msg.className = 'form-msg mt-s ok'; msg.textContent = 'Se o e-mail estiver cadastrado, você receberá um link para criar nova senha.'; }
      if (store.DEMO && mode !== 'esqueci') onAuth(store.user);
    } catch (err) {
      msg.textContent = store.authError(err);
    } finally { btn.disabled = false; }
  };
}

// ── Estrutura do app ─────────────────────────────────────────────
function renderShell() {
  const u = store.user;
  root.innerHTML = `
    <div class="app">
      <aside class="side" aria-label="Menu principal">
        <div class="side-brand"><div class="logo">${icon('bear', 24)}</div><div><b>Leori</b><small>Gestão</small></div></div>
        <nav class="side-nav">${NAV.map(n => `<a class="nav-item" href="#/${n.id}" data-nav="${n.id}">${icon(n.icon)}<span>${esc(window.innerWidth < 1024 && n.short ? n.short : n.label)}</span></a>`).join('')}</nav>
        <div class="side-foot">
          <div class="user"><div class="avatar">${esc((u.email || 'L')[0].toUpperCase())}</div><div class="email" title="${esc(u.email)}">${esc(u.email)}</div></div>
          <button class="nav-item" id="btnSair">${icon('logout')}<span>Sair</span></button>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <div class="logo">${icon('bear', 20)}</div><b>Leori Gestão</b>
          <button class="icon-btn" id="btnMenu" aria-label="Abrir menu">${icon('menu', 22)}</button>
        </header>
        ${store.DEMO ? '<div class="demo-bar">Modo demonstração — os dados ficam só neste navegador até o Firebase ser configurado.</div>' : ''}
        <main class="page" id="page"></main>
      </div>
      <nav class="bottom-nav" aria-label="Menu inferior">
        ${BOTTOM.map(id => { const n = NAV.find(x => x.id === id); return `<button data-nav="${id}">${icon(n.icon, 24)}<span>${esc(n.short || n.label)}</span></button>`; }).join('')}
        <button id="btnMais" data-more>${icon('more', 24)}<span>Mais</span></button>
      </nav>
      <div class="drawer-back" id="drawer">
        <div class="drawer" role="dialog" aria-label="Todas as seções">
          <div class="grab"></div>
          <div class="drawer-grid">
            ${NAV.map(n => `<button data-nav="${n.id}">${icon(n.icon, 26)}<span>${esc(n.short || n.label)}</span></button>`).join('')}
            <button data-go="config/aparencia">${icon('palette', 26)}<span>Aparência</span></button>
          </div>
          <button class="btn btn-ghost mt" style="width:100%;justify-content:center" id="btnSair2">${icon('logout')} Sair</button>
          <div class="who">${esc(u.email)}</div>
        </div>
      </div>
    </div>`;
  const drawer = $('#drawer');
  const closeDrawer = () => drawer.classList.remove('open');
  $('#btnMenu').onclick = () => drawer.classList.add('open');
  $('#btnMais').onclick = () => drawer.classList.add('open');
  drawer.onclick = e => { if (e.target === drawer) closeDrawer(); };
  $$('button[data-nav]').forEach(b => b.onclick = () => { closeDrawer(); go(b.dataset.nav); });
  $$('button[data-go]').forEach(b => b.onclick = () => { closeDrawer(); go(b.dataset.go); });
  const sair = async () => { await store.logout(); if (store.DEMO) onAuth(null); };
  $('#btnSair').onclick = sair;
  $('#btnSair2').onclick = sair;
  updateBadges();
}

function updateBadges() {
  const repor = materiaisParaRepor().length;
  const running = store.timer && store.timer.status === 'running';
  $$('[data-nav]').forEach(el => {
    el.querySelector('.badge-dot')?.remove();
    const id = el.dataset.nav;
    let v = '';
    if (id === 'estoque' && repor) v = repor;
    if (id === 'cronometro' && running) v = '●';
    if (v !== '') el.insertAdjacentHTML('beforeend', `<span class="badge-dot" title="${id === 'estoque' ? 'Itens para repor' : 'Cronômetro rodando'}">${v}</span>`);
  });
}

function setActive(id) {
  $$('[data-nav]').forEach(el => el.classList.toggle('active', el.dataset.nav === id));
  $('#btnMais')?.classList.toggle('active', !BOTTOM.includes(id));
}

// ── Roteamento por hash (#/pagina/parametro) ─────────────────────
export function go(path) { location.hash = '#/' + path; }

async function route() {
  if (!store.user) return;
  const [id = 'inicio', ...params] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const pageId = PAGES[id] ? id : 'inicio';
  setActive(pageId);
  const el = $('#page');
  if (!el) return;
  if (!store.ready) { el.innerHTML = '<div class="loading"><div class="spinner"></div></div>'; current = { id: pageId, params, mod: null }; return; }
  try {
    const mod = (await PAGES[pageId]()).default;
    current?.mod?.destroy?.();
    current = { id: pageId, params, mod };
    const n = NAV.find(x => x.id === pageId);
    document.title = `${n.label} — Leori Gestão`;
    el.innerHTML = '';
    mod.render(el, params);
    window.scrollTo(0, 0);
  } catch (err) {
    console.error(err);
    el.innerHTML = `<div class="alert danger">Não foi possível abrir esta tela. Recarregue a página.</div>`;
  }
}

function rerender(what) {
  updateBadges();
  if (!current) return;
  if (!current.mod) { if (store.ready) route(); return; }
  if (what === 'settings') applyTheme(store.settings.tema);
  if (current.mod.keep?.(what)) return;  // tela com edição em andamento decide se redesenha
  const el = $('#page');
  const y = window.scrollY;
  el.innerHTML = '';
  current.mod.render(el, current.params);
  window.scrollTo(0, y);
}

function onAuth(u) {
  if (!u) { current = null; renderLogin(); return; }
  applyTheme(store.settings.tema);
  renderShell();
  route();
}

window.addEventListener('hashchange', route);
store.onChange(what => { if (what === 'ready') { applyTheme(store.settings.tema); route(); } else rerender(what); });
window.addEventListener('online', () => toast('Conexão restabelecida. Sincronizando…'));
window.addEventListener('offline', () => toast('Sem internet: as alterações serão enviadas quando a conexão voltar.', 'err'));

store.initAuth(onAuth).catch(err => {
  console.error(err);
  root.innerHTML = `<div class="login-wrap"><div class="login-card"><h1>Leori</h1><p class="alert danger mt">Não foi possível conectar ao servidor. Verifique a internet e recarregue a página.</p></div></div>`;
});
