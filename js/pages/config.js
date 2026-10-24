// Configurações: negócio, aparência, exportação de dados, conta e privacidade
import * as store from '../store.js';
import { $, $$, esc, icon, num, parseNum, toast, confirmDialog, today } from '../utils.js';
import { applyTheme, PRESETS, FONTES } from '../theme.js';
import { exportCSV, exportExcel, pdfResumo, TABELAS } from '../export.js';
import { go } from '../app.js';

const ABAS = [['negocio', 'Negócio'], ['aparencia', 'Aparência'], ['exportar', 'Exportar dados'], ['conta', 'Conta e privacidade']];

export default {
  render(el, [aba = 'negocio']) {
    if (!ABAS.some(a => a[0] === aba)) aba = 'negocio';
    el.innerHTML = `
      <div class="page-head"><div><h1>Configurações</h1><p>Ajustes do sistema Leori Gestão</p></div></div>
      <div class="tabs" id="cfAbas">${ABAS.map(([k, l]) => `<button data-k="${k}" class="${aba === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div id="cfBody"></div>`;
    $$('#cfAbas button').forEach(b => b.onclick = () => go('config/' + b.dataset.k));
    ({ negocio, aparencia, exportar, conta })[aba]($('#cfBody'));
  }
};

function negocio(el) {
  const s = store.settings;
  el.innerHTML = `
    <div class="grid g2">
      <div class="card"><div class="card-head"><h3>${icon('calc', 18)} Precificação</h3></div><div class="card-body form-grid">
        <div class="f s6"><label>Valor da hora padrão (R$)</label><input data-s="valorHora" inputmode="decimal" value="${num(s.valorHora, 2)}"></div>
        <div class="f s6"><label>Margem de lucro padrão (%)</label><input data-s="margem" inputmode="decimal" value="${num(s.margem, 2)}"></div>
        <p class="f s12 small muted">Usados ao criar uma peça nova. Cada peça pode ter valores próprios.</p>
      </div></div>
      <div class="card"><div class="card-head"><h3>${icon('wallet', 18)} Caixa e conta pessoal</h3></div><div class="card-body form-grid">
        <div class="f s6"><label>% do lucro para a conta pessoal</label><input data-s="percPessoal" inputmode="decimal" value="${num(s.percPessoal, 2)}"></div>
        <div class="f s6"><label>Saldo inicial do caixa (R$)</label><input data-s="saldoInicial" inputmode="decimal" value="${num(s.saldoInicial, 2)}"></div>
        <p class="f s12 small muted">O saldo inicial é o dinheiro que a empresa já tinha antes de começar a usar o sistema.</p>
      </div></div>
      <div class="card"><div class="card-head"><h3>Categorias de saída</h3></div><div class="card-body">
        <textarea class="input" data-l="categoriasSaida" rows="6">${esc(s.categoriasSaida.join('\n'))}</textarea><p class="small muted mt-s">Uma por linha.</p>
      </div></div>
      <div class="card"><div class="card-head"><h3>Categorias de entrada</h3></div><div class="card-body">
        <textarea class="input" data-l="categoriasEntrada" rows="6">${esc(s.categoriasEntrada.join('\n'))}</textarea><p class="small muted mt-s">Uma por linha.</p>
      </div></div>
    </div>`;
  $$('[data-s]', el).forEach(i => i.onchange = () => store.saveSettings({ [i.dataset.s]: parseNum(i.value) }).then(() => toast('Configuração salva.')));
  $$('[data-l]', el).forEach(i => i.onchange = () => {
    const l = i.value.split('\n').map(x => x.trim()).filter(Boolean);
    store.saveSettings({ [i.dataset.l]: l.length ? l : ['Outros'] }).then(() => toast('Categorias salvas.'));
  });
}

function aparencia(el) {
  const t = store.settings.tema;
  const set = patch => { applyTheme({ ...store.settings.tema, ...patch }); store.saveSettings({ tema: patch }); };
  el.innerHTML = `
    <div class="grid g2">
      <div class="card"><div class="card-head"><h3>${icon('palette', 18)} Cor principal</h3></div><div class="card-body">
        <div class="swatches">${PRESETS.map(([n, c]) => `<button class="swatch ${c.toLowerCase() === t.primaria.toLowerCase() ? 'on' : ''}" style="background:${c}" data-cor="${c}" title="${esc(n)}" aria-label="${esc(n)}"></button>`).join('')}</div>
        <div class="row mt">
          <label class="lbl-s" for="apCor">Outra cor:</label>
          <input type="color" id="apCor" value="${esc(t.primaria)}" style="width:52px;height:40px;border:1px solid var(--line-2);border-radius:8px;background:none;cursor:pointer">
          <input class="input" id="apHex" value="${esc(t.primaria)}" maxlength="7" style="width:110px" aria-label="Código da cor">
        </div>
        <p class="small muted mt">Usada em botões, destaques, alertas informativos e gráficos.</p>
      </div></div>
      <div class="card"><div class="card-head"><h3>Barra lateral</h3></div><div class="card-body">
        <div class="opt-cards">${[['escura', 'Escura', '#292524'], ['clara', 'Clara', '#ffffff'], ['cor', 'Na cor principal', 'var(--primary)']].map(([k, l, c]) => `<button class="opt-card ${t.lateral === k ? 'on' : ''}" data-lat="${k}"><div class="mini-side"><i style="background:${c}"></i><b></b></div>${l}</button>`).join('')}</div>
        <p class="small muted mt">No celular a navegação fica no menu inferior.</p>
      </div></div>
      <div class="card"><div class="card-head"><h3>Modo</h3></div><div class="card-body">
        <div class="opt-cards">${[['claro', 'Claro'], ['escuro', 'Escuro']].map(([k, l]) => `<button class="opt-card ${t.modo === k ? 'on' : ''}" data-modo="${k}"><div class="mini-side"><i style="background:${k === 'claro' ? '#e7e5e4' : '#0f0e0d'}"></i><b style="background:${k === 'claro' ? '#f6f5f3' : '#201f1d'}"></b></div>${l}</button>`).join('')}</div>
      </div></div>
      <div class="card"><div class="card-head"><h3>Fonte e cantos</h3></div><div class="card-body">
        <div class="opt-cards">${FONTES.map(([n, css]) => `<button class="opt-card ${t.fonte === n ? 'on' : ''}" data-fonte="${esc(n)}" style="font-family:${css}">${esc(n)}<div class="small muted">Leori 123</div></button>`).join('')}</div>
        <div class="opt-cards mt">${[['retos', 'Retos', '4px'], ['medios', 'Médios', '10px'], ['redondos', 'Redondos', '16px']].map(([k, l, r]) => `<button class="opt-card ${t.cantos === k ? 'on' : ''}" data-cantos="${k}" style="border-radius:${r}">${l}</button>`).join('')}</div>
      </div></div>
    </div>
    <div class="card card-pad mt">
      <div class="row between"><div><b>Pré-visualização</b><p class="small muted">As mudanças valem na hora e são salvas na sua conta (aparecem em todos os aparelhos).</p></div>
        <div class="row"><span class="badge pri">Destaque</span><button class="btn btn-soft">Botão suave</button><button class="btn btn-primary">Botão principal</button><button class="btn btn-ghost" id="apReset">${icon('reset', 16)} Restaurar padrão</button></div></div>
    </div>`;
  $$('[data-cor]', el).forEach(b => b.onclick = () => { set({ primaria: b.dataset.cor }); aparencia(el); });
  $('#apCor').oninput = e => { $('#apHex').value = e.target.value; applyTheme({ ...store.settings.tema, primaria: e.target.value }); };
  $('#apCor').onchange = e => { set({ primaria: e.target.value }); aparencia(el); };
  $('#apHex').onchange = e => { const v = e.target.value.trim(); if (/^#[0-9a-f]{6}$/i.test(v)) { set({ primaria: v }); aparencia(el); } else toast('Use o formato #RRGGBB.', 'err'); };
  $$('[data-lat]', el).forEach(b => b.onclick = () => { set({ lateral: b.dataset.lat }); aparencia(el); });
  $$('[data-modo]', el).forEach(b => b.onclick = () => { set({ modo: b.dataset.modo }); aparencia(el); });
  $$('[data-fonte]', el).forEach(b => b.onclick = () => { set({ fonte: b.dataset.fonte }); aparencia(el); });
  $$('[data-cantos]', el).forEach(b => b.onclick = () => { set({ cantos: b.dataset.cantos }); aparencia(el); });
  $('#apReset').onclick = () => { set({ ...store.DEFAULT_THEME }); aparencia(el); toast('Aparência padrão restaurada.'); };
}

function exportar(el) {
  const now = new Date();
  el.innerHTML = `
    <div class="grid g2">
      <div class="card"><div class="card-head"><h3>${icon('download', 18)} Planilha completa</h3></div><div class="card-body">
        <p class="mb">Baixe todos os dados em um arquivo Excel (.xlsx), com uma aba para cada parte do sistema.</p>
        <button class="btn btn-primary" id="exXlsx">${icon('download', 18)} Baixar Excel completo</button>
      </div></div>
      <div class="card"><div class="card-head"><h3>${icon('file', 18)} PDF de resumo</h3></div><div class="card-body">
        <p class="mb">Caixa, lucro, impostos, lançamentos, pedidos e estoque a repor.</p>
        <div class="row"><button class="btn btn-ghost" data-pdf="mes">Mês atual</button><button class="btn btn-ghost" data-pdf="semestre">Semestre atual</button><button class="btn btn-ghost" data-pdf="ano">Ano atual</button></div>
        <p class="small muted mt">Para outro período, use o botão "PDF do período" na página inicial.</p>
      </div></div>
      <div class="card" style="grid-column:1/-1"><div class="card-head"><h3>Planilhas CSV separadas</h3><span class="small muted">Abrem no Excel, Google Planilhas e no emissor de nota</span></div><div class="card-body">
        <div class="row">${Object.entries(TABELAS).map(([k, t]) => `<button class="btn btn-ghost btn-sm" data-csv="${k}">${icon('download', 16)} ${esc(t.nome)} <span class="muted">(${(store.data[k] || []).length})</span></button>`).join('')}</div>
      </div></div>
    </div>`;
  $('#exXlsx').onclick = exportExcel;
  $$('[data-csv]', el).forEach(b => b.onclick = () => exportCSV(b.dataset.csv));
  $$('[data-pdf]', el).forEach(b => b.onclick = () => pdfResumo({ tipo: b.dataset.pdf, ano: now.getFullYear(), mes: now.getMonth(), sem: now.getMonth() < 6 ? 0 : 1 }));
}

function conta(el) {
  el.innerHTML = `
    <div class="grid g2">
      <div class="card"><div class="card-head"><h3>${icon('users', 18)} Conta</h3></div><div class="card-body">
        <dl class="kv"><dt>E-mail</dt><dd>${esc(store.user.email)}</dd><dt>Armazenamento</dt><dd>${store.DEMO ? 'Modo demonstração (só neste navegador)' : 'Firebase — sincronizado em tempo real'}</dd></dl>
        <div class="row mt">
          ${store.DEMO ? '' : `<button class="btn btn-ghost" id="ctSenha">${icon('mail', 18)} Trocar senha por e-mail</button>`}
          <button class="btn btn-ghost" id="ctSair">${icon('logout', 18)} Sair</button>
        </div>
      </div></div>
      <div class="card"><div class="card-head"><h3>${icon('shield', 18)} Privacidade (LGPD)</h3></div><div class="card-body small" style="line-height:1.6">
        <ul style="padding-left:18px">
          <li>Só você, com login e senha, acessa os dados. As regras do banco bloqueiam qualquer outro acesso.</li>
          <li>Os dados dos clientes ficam na sua conta do Firebase (Google), com conexão criptografada.</li>
          <li>No cadastro do cliente, registre o consentimento para uso dos dados em pedidos, entrega e nota fiscal.</li>
          <li>Se um cliente pedir, use "Dados do cliente" na ficha dele para entregar uma cópia, ou exclua o cadastro.</li>
          <li>Não use computadores públicos e saia da conta em aparelhos compartilhados.</li>
        </ul>
      </div></div>
      ${store.DEMO ? `<div class="card"><div class="card-head"><h3>Modo demonstração</h3></div><div class="card-body">
        <p class="mb small">Carregue dados de exemplo para conhecer o sistema, ou apague tudo deste navegador.</p>
        <div class="row"><button class="btn btn-soft" id="ctSample">Carregar exemplo</button><button class="btn btn-ghost" id="ctClear" style="color:var(--danger)">Apagar dados</button></div>
      </div></div>` : ''}
    </div>`;
  $('#ctSair').onclick = async () => { await store.logout(); location.reload(); };
  $('#ctSenha')?.addEventListener('click', async () => { try { await store.resetPassword(store.user.email); toast('Enviamos um link para seu e-mail.'); } catch (e) { toast(store.authError(e), 'err'); } });
  $('#ctSample')?.addEventListener('click', async () => { const { sample } = await import('../sample.js'); store.loadSample(sample()); toast('Dados de exemplo carregados.'); go('inicio'); });
  $('#ctClear')?.addEventListener('click', async () => { if (await confirmDialog('Apagar todos os dados de demonstração deste navegador?', { ok: 'Apagar', danger: true })) { store.clearDemo(); toast('Dados apagados.'); } });
}
