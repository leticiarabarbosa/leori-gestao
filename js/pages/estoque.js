// Estoque: materiais com quantidade atual e mínima, alerta do que precisa repor.
// O material é cadastrado como é comprado (ex.: novelo de 65 g por R$ 16,99); o custo por unidade sai disso.
import * as store from '../store.js';
import { $, $$, esc, icon, money, num, parseNum, modal, confirmDialog, toast, formData, options, norm, emptyState } from '../utils.js';
import { CATEG_MATERIAIS, UNIDADES, EMBALAGENS, statusMaterial, materiaisParaRepor, embalagem, embPadrao, emEmbalagens, plural } from '../logic.js';
import { exportCSV } from '../export.js';

let filtro = 'todos', busca = '', cat = '';
const custoTxt = v => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

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
        <thead><tr><th>Material</th><th>Categoria</th><th class="right">Quantidade atual</th><th class="right">Mínimo</th><th>Situação</th><th class="right">Custo</th><th></th></tr></thead>
        <tbody>${lista.map(m => {
          const st = statusMaterial(m), e = embalagem(m);
          const passo = e.temEmb ? `1 ${e.nome}` : `1 ${m.unidade}`;
          return `<tr data-id="${m.id}">
          <td class="first">${esc(m.nome)}${m.fornecedor ? `<div class="small muted" style="font-weight:400">${esc(m.fornecedor)}</div>` : ''}</td>
          <td data-label="Categoria">${esc(m.categoria || '—')}</td>
          <td data-label="Atual" class="right"><div class="row" style="justify-content:flex-end;flex-wrap:nowrap;gap:4px">
            <button class="icon-btn" data-q="-1" aria-label="Tirar ${esc(passo)}" title="Tirar ${esc(passo)}">${icon('minus', 16)}</button>
            <span class="num" style="min-width:76px;text-align:center"><b>${num(m.quantidade, 3)} ${esc(m.unidade)}</b>${e.temEmb ? `<span class="small muted" style="display:block">${esc(emEmbalagens(m, m.quantidade))}</span>` : ''}</span>
            <button class="icon-btn" data-q="1" aria-label="Somar ${esc(passo)}" title="Somar ${esc(passo)}">${icon('plus', 16)}</button></div></td>
          <td data-label="Mínimo" class="right num">${num(m.minimo, 3)} ${esc(m.unidade)}${e.temEmb ? `<span class="small muted" style="display:block">${esc(emEmbalagens(m, m.minimo))}</span>` : ''}</td>
          <td data-label="Situação"><span class="badge ${st.cls}">${st.key !== 'ok' ? icon('alert', 13) : icon('check', 13)} ${st.label}</span></td>
          <td data-label="Custo" class="right num">${e.temEmb ? `${money(e.preco)} / ${esc(e.nome)}<span class="small muted" style="display:block">${custoTxt(m.custoUnit)} por ${esc(m.unidade)}</span>` : `${custoTxt(m.custoUnit)} / ${esc(m.unidade)}`}</td>
          <td class="acts"><button class="btn btn-sm btn-ghost" data-mov>Entrada/saída</button><button class="icon-btn" data-edit title="Editar">${icon('edit', 18)}</button><button class="icon-btn danger" data-del title="Excluir">${icon('trash', 18)}</button></td>
        </tr>`; }).join('')}</tbody></table></div>` : emptyState(todos.length ? 'Nenhum material com esse filtro.' : 'Cadastre fios, agulhas, enchimento, olhos, arame, cordão espaguete…');
      $$('#esLista tr[data-id]').forEach(tr => {
        const m = store.get('materiais', tr.dataset.id);
        const passo = embalagem(m).temEmb ? embalagem(m).conteudo : 1;
        $$('[data-q]', tr).forEach(b => b.onclick = () => store.save('materiais', { ...m, quantidade: Math.max(0, Math.round(((Number(m.quantidade) || 0) + Number(b.dataset.q) * passo) * 1000) / 1000) }));
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
  const v = { categoria: 'Fio', unidade: 'g', quantidade: 0, minimo: 0, ...preset, ...(m || {}) };
  const e0 = m ? embalagem(m) : { conteudo: '', preco: '', nome: embPadrao(v.categoria) };
  const n3 = x => x === '' || x == null ? '' : num(x, 3);
  modal({
    title: m ? 'Editar material' : 'Novo material',
    body: `<form class="form-grid" id="fMat">
      <div class="f s12"><label>Nome *</label><input name="nome" value="${esc(v.nome)}" placeholder="Ex.: Fio Amigurumi Círculo — Branco"></div>
      <div class="f s4"><label>Categoria</label><select name="categoria" id="mCat">${options(CATEG_MATERIAIS, v.categoria)}</select></div>
      <div class="f s4"><label>Medido em</label><select name="unidade" id="mUn">${options(UNIDADES, v.unidade)}</select></div>
      <div class="f s4"><label>Vem em</label><select name="nomeEmb" id="mEmb">${options(EMBALAGENS.map(x => [x, x[0].toUpperCase() + x.slice(1)]), e0.nome)}</select></div>

      <div class="section-title">Como você compra</div>
      <div class="f s6"><label id="lConteudo">Quanto vem em 1 novelo (g)</label><input name="conteudoEmb" id="mConteudo" inputmode="decimal" value="${n3(e0.conteudo)}" placeholder="Ex.: 65"></div>
      <div class="f s6"><label id="lPreco">Preço de 1 novelo (R$)</label><input name="precoEmb" id="mPreco" inputmode="decimal" value="${e0.preco === '' ? '' : num(e0.preco, 2)}" placeholder="Ex.: 16,99"></div>
      <p class="f s12 small" id="mCusto" style="color:var(--primary-ink);display:block"></p>

      <div class="section-title">Quanto você tem</div>
      <div class="f s3"><label id="lQtd">Quantidade atual (g)</label><input name="quantidade" id="mQtd" inputmode="decimal" value="${num(v.quantidade, 3)}"></div>
      <div class="f s3"><label id="lQtdE">ou em novelos</label><input id="mQtdE" inputmode="decimal"></div>
      <div class="f s3"><label id="lMin">Quantidade mínima (g)</label><input name="minimo" id="mMin" inputmode="decimal" value="${num(v.minimo, 3)}"></div>
      <div class="f s3"><label id="lMinE">ou em novelos</label><input id="mMinE" inputmode="decimal"></div>
      <p class="f s12 small muted">Digite em ${'gramas'} ou em novelos: um campo acompanha o outro. Abaixo do mínimo, o material aparece como "Repor".</p>

      <div class="section-title">Outros</div>
      <div class="f s12"><label>Fornecedor preferido</label><input name="fornecedor" value="${esc(v.fornecedor)}"></div>
      <div class="f s12"><label>Observações</label><textarea name="obs">${esc(v.obs)}</textarea></div>
    </form>`,
    actions: `<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="fMatSave">Salvar</button>`,
    onOpen(md, close) {
      const g = id => $(id, md);
      const conteudo = () => parseNum(g('#mConteudo').value);
      const fmt = x => x ? (Math.round(x * 1000) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 }) : '';
      // Atualiza rótulos, custo por unidade e os campos "em embalagens"
      const sync = () => {
        const un = g('#mUn').value, emb = g('#mEmb').value, c = conteudo(), preco = parseNum(g('#mPreco').value);
        const unNome = { g: 'gramas', kg: 'quilos', m: 'metros', cm: 'centímetros', un: 'unidades', par: 'pares', novelo: 'novelos', pacote: 'pacotes' }[un] || un;
        g('#lConteudo').textContent = `Quanto vem em 1 ${emb} (${un})`;
        g('#lPreco').textContent = `Preço de 1 ${emb} (R$)`;
        g('#lQtd').textContent = `Atual (${un})`;
        g('#lMin').textContent = `Mínimo (${un})`;
        g('#lQtdE').textContent = `ou em ${plural(2, emb)}`;
        g('#lMinE').textContent = `ou em ${plural(2, emb)}`;
        md.querySelector('#fMat p.muted').textContent = `Digite em ${unNome} ou em ${plural(2, emb)}: um campo acompanha o outro. Abaixo do mínimo, o material aparece como "Repor".`;
        g('#mCusto').innerHTML = c > 0 && preco > 0
          ? `<span style="display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap">${icon('check', 14)} Custo calculado: <b>${custoTxt(preco / c)} por ${esc(un)}</b> — é esse valor que vai para a precificação.</span>`
          : 'Preencha quanto vem e o preço para o sistema calcular o custo por ' + esc(un) + '.';
        ['#mQtdE', '#mMinE'].forEach(id => { g(id).disabled = !(c > 0); });
      };
      const fromUnits = () => { const c = conteudo(); if (c > 0) { g('#mQtdE').value = fmt(parseNum(g('#mQtd').value) / c); g('#mMinE').value = fmt(parseNum(g('#mMin').value) / c); } };
      g('#mQtd').oninput = () => { const c = conteudo(); if (c > 0) g('#mQtdE').value = fmt(parseNum(g('#mQtd').value) / c); };
      g('#mMin').oninput = () => { const c = conteudo(); if (c > 0) g('#mMinE').value = fmt(parseNum(g('#mMin').value) / c); };
      g('#mQtdE').oninput = () => { g('#mQtd').value = fmt(parseNum(g('#mQtdE').value) * conteudo()); };
      g('#mMinE').oninput = () => { g('#mMin').value = fmt(parseNum(g('#mMinE').value) * conteudo()); };
      g('#mConteudo').oninput = () => { sync(); fromUnits(); };
      g('#mPreco').oninput = sync;
      g('#mUn').onchange = sync;
      g('#mEmb').onchange = sync;
      g('#mCat').onchange = () => { if (!m) { g('#mEmb').value = embPadrao(g('#mCat').value); sync(); } };
      sync(); fromUnits();
      // ao tocar num número, seleciona tudo para digitar por cima
      ['#mConteudo', '#mPreco', '#mQtd', '#mQtdE', '#mMin', '#mMinE'].forEach(id => g(id).addEventListener('focus', e => e.target.select()));
      if (!m) ['#mQtd', '#mMin'].forEach(id => { if (parseNum(g(id).value) === 0) g(id).value = ''; });
      g('#fMatSave').onclick = async () => {
        const o = formData(g('#fMat'));
        if (!o.nome) { toast('Informe o nome do material.', 'err'); return; }
        const c = parseNum(o.conteudoEmb), preco = parseNum(o.precoEmb);
        if (!(c > 0)) { toast('Informe quanto vem em cada embalagem (ex.: 65 g).', 'err'); return; }
        await store.save('materiais', {
          ...(m || {}), nome: o.nome, categoria: o.categoria, unidade: o.unidade, nomeEmb: o.nomeEmb,
          conteudoEmb: c, precoEmb: preco, custoUnit: Math.round(preco / c * 100000) / 100000,
          quantidade: parseNum(o.quantidade), minimo: parseNum(o.minimo), fornecedor: o.fornecedor, obs: o.obs
        });
        toast('Material salvo.'); close();
      };
    }
  });
}

function movForm(m) {
  const e = embalagem(m);
  modal({
    title: `Movimentar: ${m.nome}`,
    body: `<form class="form-grid" id="fMov">
      <div class="f s4"><label>Tipo</label><select name="tipo">${options([['entrada', 'Entrada (comprei)'], ['saida', 'Saída (usei)'], ['ajuste', 'Ajustar para (contagem)']])}</select></div>
      <div class="f s4"><label>Quantidade</label><input name="qtd" data-num inputmode="decimal"></div>
      <div class="f s4"><label>Em</label><select name="em">${options(e.temEmb ? [['emb', plural(2, e.nome)], ['un', m.unidade]] : [['un', m.unidade]])}</select></div>
      <p class="f s12 small muted">Atual: ${num(m.quantidade, 3)} ${esc(m.unidade)}${e.temEmb ? ` (${esc(emEmbalagens(m, m.quantidade))})` : ''} · mínimo ${num(m.minimo, 3)} ${esc(m.unidade)}</p>
    </form>`,
    actions: `<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="fMovOk">Aplicar</button>`,
    onOpen(md, close) {
      $('#fMovOk', md).onclick = async () => {
        const o = formData($('#fMov', md));
        const qtd = o.em === 'emb' ? o.qtd * e.conteudo : o.qtd;
        const q = Number(m.quantidade) || 0;
        const nova = o.tipo === 'entrada' ? q + qtd : o.tipo === 'saida' ? q - qtd : qtd;
        await store.save('materiais', { ...m, quantidade: Math.max(0, Math.round(nova * 1000) / 1000) });
        toast('Estoque atualizado.'); close();
      };
    }
  });
}
