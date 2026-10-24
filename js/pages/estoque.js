// Estoque: materiais com quantidade atual e mínima, alerta do que precisa repor
import * as store from '../store.js';
import { $, $$, esc, icon, money, num, modal, confirmDialog, toast, formData, options, norm, emptyState } from '../utils.js';
import { CATEG_MATERIAIS, UNIDADES, statusMaterial, materiaisParaRepor } from '../logic.js';
import { exportCSV } from '../export.js';

let filtro = 'todos', busca = '', cat = '';

export default {
  render(el) {
    const todos = [...store.data.materiais].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const repor = materiaisParaRepor();
    const zerados = repor.filter(m => statusMaterial(m).key === 'zerado');
    el.innerHTML = `
      <div class="page-head">
        <div><h1>Estoque</h1><p>${todos.length} material(is) cadastrado(s)</p></div>
        <div class="page-actions">
          <button class="btn btn-ghost" id="esExp">${icon('download', 18)} Planilha</button>
          <button class="btn btn-primary" id="esNovo">${icon('plus', 18)} Novo material</button>
        </div>
      </div>
      ${repor.length ? `<div class="alert ${zerados.length ? 'danger' : ''} mb">${icon('alert', 20)}<div><b>${repor.length} material(is) abaixo do mínimo.</b> ${zerados.length ? `${zerados.length} sem estoque. ` : ''}Repor: ${repor.slice(0, 6).map(m => esc(m.nome)).join(', ')}${repor.length > 6 ? '…' : ''}</div></div>` : todos.length ? `<div class="alert info mb">${icon('check', 20)}<div>Tudo em ordem: nenhum material abaixo do mínimo.</div></div>` : ''}
      <div class="stats mb">
        <div class="card stat"><div class="lbl">Em ordem</div><div class="val">${todos.length - repor.length}</div></div>
        <div class="card stat ${repor.length ? 'neg' : ''}"><div class="lbl">Precisam repor</div><div class="val">${repor.length}</div></div>
        <div class="card stat"><div class="lbl">Valor em estoque</div><div class="val">${money(todos.reduce((s, m) => s + Math.max(0, m.quantidade) * (m.custoUnit || 0), 0))}</div></div>
      </div>
      <div class="card">
        <div class="card-head">
          <div class="filters grow">
            <div class="search f" style="flex:1 1 220px">${icon('search', 18)}<input class="input" id="esBusca" placeholder="Buscar material" value="${esc(busca)}"></div>
            <div class="f"><select class="input" id="esCat">${options(CATEG_MATERIAIS, cat, { empty: 'Todas as categorias' })}</select></div>
          </div>
          <div class="seg" id="esFiltro">${[['todos', 'Todos'], ['repor', 'Precisa repor'], ['ok', 'Em ordem']].map(([k, l]) => `<button data-k="${k}" class="${filtro === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        </div>
        <div id="esLista"></div>
      </div>`;
    const draw = () => {
      const q = norm(busca);
      const lista = todos.filter(m => (!q || norm(m.nome + ' ' + m.fornecedor).includes(q)) && (!cat || m.categoria === cat) &&
        (filtro === 'todos' || (filtro === 'ok' ? statusMaterial(m).key === 'ok' : statusMaterial(m).key !== 'ok')));
      $('#esLista').innerHTML = lista.length ? `<div class="table-wrap"><table class="tbl resp">
        <thead><tr><th>Material</th><th>Categoria</th><th class="right">Quantidade atual</th><th class="right">Mínimo</th><th>Situação</th><th class="right">Custo/un.</th><th></th></tr></thead>
        <tbody>${lista.map(m => { const st = statusMaterial(m); return `<tr data-id="${m.id}">
          <td class="first">${esc(m.nome)}${m.fornecedor ? `<div class="small muted" style="font-weight:400">${esc(m.fornecedor)}</div>` : ''}</td>
          <td data-label="Categoria">${esc(m.categoria || '—')}</td>
          <td data-label="Atual" class="right"><div class="row" style="justify-content:flex-end;flex-wrap:nowrap;gap:4px">
            <button class="icon-btn" data-q="-1" aria-label="Diminuir">${icon('minus', 16)}</button>
            <span class="num strong" style="min-width:64px;text-align:center">${num(m.quantidade, 3)} ${esc(m.unidade)}</span>
            <button class="icon-btn" data-q="1" aria-label="Aumentar">${icon('plus', 16)}</button></div></td>
          <td data-label="Mínimo" class="right num">${num(m.minimo, 3)} ${esc(m.unidade)}</td>
          <td data-label="Situação"><span class="badge ${st.cls}">${st.key !== 'ok' ? icon('alert', 13) : icon('check', 13)} ${st.label}</span></td>
          <td data-label="Custo/un." class="right num">${money(m.custoUnit)}</td>
          <td class="acts"><button class="btn btn-sm btn-ghost" data-mov>Entrada/saída</button><button class="icon-btn" data-edit title="Editar">${icon('edit', 18)}</button><button class="icon-btn danger" data-del title="Excluir">${icon('trash', 18)}</button></td>
        </tr>`; }).join('')}</tbody></table></div>` : emptyState(todos.length ? 'Nenhum material com esse filtro.' : 'Cadastre fios, agulhas, enchimento, olhos, arame, cordão espaguete…');
      $$('#esLista tr[data-id]').forEach(tr => {
        const m = store.get('materiais', tr.dataset.id);
        $$('[data-q]', tr).forEach(b => b.onclick = () => store.save('materiais', { ...m, quantidade: Math.max(0, Math.round(((Number(m.quantidade) || 0) + Number(b.dataset.q)) * 1000) / 1000) }));
        tr.querySelector('[data-mov]').onclick = () => movForm(m);
        tr.querySelector('[data-edit]').onclick = () => materialForm(m);
        tr.querySelector('[data-del]').onclick = async () => { if (await confirmDialog(`Excluir "${m.nome}" do estoque?`, { ok: 'Excluir', danger: true })) { await store.remove('materiais', m.id); toast('Material excluído.'); } };
      });
    };
    draw();
    $('#esBusca').oninput = e => { busca = e.target.value; draw(); };
    $('#esCat').onchange = e => { cat = e.target.value; draw(); };
    $$('#esFiltro button').forEach(b => b.onclick = () => { filtro = b.dataset.k; $$('#esFiltro button').forEach(x => x.classList.toggle('on', x === b)); draw(); });
    $('#esNovo').onclick = () => materialForm();
    $('#esExp').onclick = () => exportCSV('materiais');
  }
};

export function materialForm(m = null, preset = {}) {
  const v = { categoria: 'Fio', unidade: 'g', quantidade: 0, minimo: 0, custoUnit: 0, ...preset, ...(m || {}) };
  modal({
    title: m ? 'Editar material' : 'Novo material',
    body: `<form class="form-grid" id="fMat">
      <div class="f s12"><label>Nome *</label><input name="nome" value="${esc(v.nome)}" placeholder="Ex.: Fio Amigurumi Círculo — Branco"></div>
      <div class="f s6"><label>Categoria</label><select name="categoria">${options(CATEG_MATERIAIS, v.categoria)}</select></div>
      <div class="f s6"><label>Unidade</label><select name="unidade">${options(UNIDADES, v.unidade)}</select></div>
      <div class="f s4"><label>Quantidade atual</label><input name="quantidade" data-num inputmode="decimal" value="${num(v.quantidade, 3)}"></div>
      <div class="f s4"><label>Quantidade mínima</label><input name="minimo" data-num inputmode="decimal" value="${num(v.minimo, 3)}"></div>
      <div class="f s4"><label>Custo por unidade (R$)</label><input name="custoUnit" data-num inputmode="decimal" value="${num(v.custoUnit, 4)}"></div>
      <div class="f s12"><label>Fornecedor preferido</label><input name="fornecedor" value="${esc(v.fornecedor)}"></div>
      <div class="f s12"><label>Observações</label><textarea name="obs">${esc(v.obs)}</textarea></div>
      <p class="f s12 small muted">Dica: o custo por unidade é usado na precificação. Ex.: novelo de 100 g por R$ 18 → R$ 0,18 por g.</p>
    </form>`,
    actions: `<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="fMatSave">Salvar</button>`,
    onOpen(md, close) {
      $('#fMatSave', md).onclick = async () => {
        const o = formData($('#fMat', md));
        if (!o.nome) { toast('Informe o nome do material.', 'err'); return; }
        await store.save('materiais', { ...(m || {}), ...o });
        toast('Material salvo.'); close();
      };
    }
  });
}

function movForm(m) {
  modal({
    title: `Movimentar: ${m.nome}`,
    body: `<form class="form-grid" id="fMov">
      <div class="f s6"><label>Tipo</label><select name="tipo">${options([['entrada', 'Entrada (comprei)'], ['saida', 'Saída (usei)'], ['ajuste', 'Ajustar para (contagem)']])}</select></div>
      <div class="f s6"><label>Quantidade (${esc(m.unidade)})</label><input name="qtd" data-num inputmode="decimal"></div>
      <p class="f s12 small muted">Atual: ${num(m.quantidade, 3)} ${esc(m.unidade)} · mínimo ${num(m.minimo, 3)}</p>
    </form>`,
    actions: `<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="fMovOk">Aplicar</button>`,
    onOpen(md, close) {
      $('#fMovOk', md).onclick = async () => {
        const o = formData($('#fMov', md));
        const q = Number(m.quantidade) || 0;
        const nova = o.tipo === 'entrada' ? q + o.qtd : o.tipo === 'saida' ? q - o.qtd : o.qtd;
        await store.save('materiais', { ...m, quantidade: Math.max(0, Math.round(nova * 1000) / 1000) });
        toast('Estoque atualizado.'); close();
      };
    }
  });
}
