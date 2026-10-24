// Leori Gestão — camada de dados.
// Modo real: Firebase Auth + Firestore em users/{uid}/{coleção}/{id}, com sincronização em tempo real.
// Modo demonstração (sem configuração do Firebase): mesmos métodos, dados no localStorage.
import { firebaseConfig } from './firebase-config.js';
import { uid as newId } from './utils.js';

export const DEMO = !firebaseConfig.apiKey;
const FB = 'https://www.gstatic.com/firebasejs/10.13.2/';

export const COLLECTIONS = ['clientes', 'pedidos', 'lancamentos', 'materiais', 'precos', 'pecas', 'sessoes', 'tarefas', 'metas', 'agenda'];

export const DEFAULT_THEME = {
  primaria: '#57534e',   // grafite quente
  lateral: 'escura',     // escura | clara | cor
  fonte: 'Inter',
  modo: 'claro',         // claro | escuro
  cantos: 'medios'       // retos | medios | redondos
};

export const DEFAULT_SETTINGS = {
  valorHora: 15,
  margem: 30,
  percPessoal: 50,
  saldoInicial: 0,
  categoriasSaida: ['Materiais', 'Fios', 'Embalagens', 'Frete', 'Taxas de cartão/plataforma', 'Divulgação', 'Ferramentas', 'Outros'],
  categoriasEntrada: ['Venda', 'Encomenda', 'Feira/evento', 'Outros'],
  tema: { ...DEFAULT_THEME }
};

const listeners = new Set();
export const data = Object.fromEntries(COLLECTIONS.map(c => [c, []]));
export let settings = structuredClone(DEFAULT_SETTINGS);
export let timer = null;
export let user = null;
export let ready = false;

let fb = null;      // módulos do Firebase carregados sob demanda
let auth = null, db = null;
let unsubs = [];

export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
let emitT;
function emit(what) {
  clearTimeout(emitT);
  emitT = setTimeout(() => listeners.forEach(fn => fn(what)), 30);
}

function mergeSettings(s) {
  settings = { ...structuredClone(DEFAULT_SETTINGS), ...(s || {}) };
  settings.tema = { ...DEFAULT_THEME, ...((s && s.tema) || {}) };
}

// ── Autenticação ─────────────────────────────────────────────────
export async function initAuth(cb) {
  if (DEMO) {
    const saved = localStorage.getItem('leori_demo_user');
    user = saved ? JSON.parse(saved) : null;
    if (user) startDemo();
    cb(user);
    return;
  }
  const [app, a, f] = await Promise.all([
    import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-firestore.js')
  ]);
  fb = { ...a, ...f };
  const appInst = app.initializeApp(firebaseConfig);
  auth = a.getAuth(appInst);
  try {
    db = f.initializeFirestore(appInst, {
      ignoreUndefinedProperties: true,
      localCache: f.persistentLocalCache({ tabManager: f.persistentMultipleTabManager() })
    });
  } catch {
    db = f.getFirestore(appInst);
  }
  a.onAuthStateChanged(auth, u => {
    stopSync();
    user = u ? { uid: u.uid, email: u.email } : null;
    if (user) startSync();
    cb(user);
  });
}

const AUTH_ERR = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/email-already-in-use': 'Já existe uma conta com este e-mail.',
  'auth/weak-password': 'Senha fraca: use pelo menos 8 caracteres.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  'auth/network-request-failed': 'Sem conexão com a internet.',
  'auth/operation-not-allowed': 'Login por e-mail/senha não está ativado no Firebase.'
};
export const authError = e => AUTH_ERR[e?.code] || e?.message || 'Não foi possível concluir.';

export async function login(email, senha) {
  if (DEMO) {
    user = { uid: 'demo', email };
    localStorage.setItem('leori_demo_user', JSON.stringify(user));
    startDemo();
    return user;
  }
  return fb.signInWithEmailAndPassword(auth, email, senha);
}
export async function signup(email, senha) {
  if (DEMO) return login(email, senha);
  return fb.createUserWithEmailAndPassword(auth, email, senha);
}
export async function resetPassword(email) {
  if (DEMO) return;
  return fb.sendPasswordResetEmail(auth, email);
}
export async function logout() {
  if (DEMO) { localStorage.removeItem('leori_demo_user'); user = null; return; }
  stopSync();
  return fb.signOut(auth);
}

// ── Sincronização em tempo real ──────────────────────────────────
function stopSync() {
  unsubs.forEach(u => u());
  unsubs = [];
  COLLECTIONS.forEach(c => { data[c] = []; });
  mergeSettings(null);
  timer = null;
  ready = false;
}

function startSync() {
  const base = ['users', user.uid];
  let pending = COLLECTIONS.length + 1;
  const mark = () => { if (--pending === 0) { ready = true; emit('ready'); } };
  COLLECTIONS.forEach(c => {
    let first = true;
    unsubs.push(fb.onSnapshot(fb.collection(db, ...base, c), snap => {
      data[c] = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      if (first) { first = false; mark(); }
      emit(c);
    }, err => { console.error(c, err); if (first) { first = false; mark(); } }));
  });
  let firstS = true;
  unsubs.push(fb.onSnapshot(fb.doc(db, ...base, 'meta', 'settings'), snap => {
    mergeSettings(snap.exists() ? snap.data() : null);
    if (firstS) { firstS = false; mark(); }
    emit('settings');
  }, err => { console.error('settings', err); if (firstS) { firstS = false; mark(); } }));
  unsubs.push(fb.onSnapshot(fb.doc(db, ...base, 'meta', 'timer'), snap => {
    timer = snap.exists() ? snap.data() : null;
    emit('timer');
  }));
}

// ── Modo demonstração (localStorage) ─────────────────────────────
const DEMO_KEY = 'leori_demo_db';
function startDemo() {
  const raw = JSON.parse(localStorage.getItem(DEMO_KEY) || '{}');
  COLLECTIONS.forEach(c => { data[c] = raw[c] || []; });
  mergeSettings(raw.settings);
  timer = raw.timer || null;
  ready = true;
  emit('ready');
}
function saveDemo() {
  localStorage.setItem(DEMO_KEY, JSON.stringify({ ...data, settings, timer }));
}

// ── Escrita ──────────────────────────────────────────────────────
function clean(obj) {
  const o = { ...obj };
  delete o.id;
  Object.keys(o).forEach(k => o[k] === undefined && delete o[k]);
  return o;
}

// Cria ou mescla um documento. Retorna o id.
export async function save(col, obj, id = obj.id) {
  id = id || newId();
  const now = new Date().toISOString();
  const existing = data[col].find(x => x.id === id);
  const doc = clean({ ...obj, updatedAt: now, ...(existing ? {} : { createdAt: obj.createdAt || now }) });
  if (DEMO) {
    if (existing) Object.assign(existing, doc);
    else data[col].push({ ...doc, id });
    saveDemo(); emit(col);
    return id;
  }
  // atualização otimista do cache local para a tela responder na hora
  if (existing) Object.assign(existing, doc); else data[col].push({ ...doc, id });
  emit(col);
  await fb.setDoc(fb.doc(db, 'users', user.uid, col, id), doc, { merge: true });
  return id;
}

export async function remove(col, id) {
  data[col] = data[col].filter(x => x.id !== id);
  emit(col);
  if (DEMO) { saveDemo(); return; }
  await fb.deleteDoc(fb.doc(db, 'users', user.uid, col, id));
}

export async function saveSettings(patch) {
  mergeSettings({ ...settings, ...patch, tema: { ...settings.tema, ...(patch.tema || {}) } });
  emit('settings');
  if (DEMO) { saveDemo(); return; }
  await fb.setDoc(fb.doc(db, 'users', user.uid, 'meta', 'settings'), clean(settings), { merge: true });
}

export async function saveTimer(t) {
  timer = t;
  emit('timer');
  if (DEMO) { saveDemo(); return; }
  const ref = fb.doc(db, 'users', user.uid, 'meta', 'timer');
  if (t) await fb.setDoc(ref, clean(t)); else await fb.deleteDoc(ref);
}

export const get = (col, id) => data[col].find(x => x.id === id);

// Dados de exemplo (só no modo demonstração) para conhecer o sistema
export function loadSample(sample) {
  Object.entries(sample).forEach(([k, v]) => { if (COLLECTIONS.includes(k)) data[k] = v; });
  saveDemo(); emit('ready');
}
export function clearDemo() {
  COLLECTIONS.forEach(c => { data[c] = []; });
  timer = null;
  saveDemo(); emit('ready');
}
