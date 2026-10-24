// Preços de materiais: comparação de preço + frete entre sites e lojas físicas, com histórico
import * as store from '../store.js';
import { $, $$, esc, icon, money, num, fmtDate, today, parseNum, parseDate, modal, confirmDialog, toast, formData, options, norm, emptyState, toYMD } from '../utils.js';
import { custoRegistro, UNIDADES } from '../logic.js';
import { chart, destroyCharts, chartColors } from '../charts.js';
import { exportCSV } from '../export.js';

let f = { periodo: '365', de: '', ate: '', material: '', tipo: '' };

export default {
  render(el) {
    destroyCharts();
    const todos = store.data.precos;
    const materiais = [...new Set(todos.map(r => r.material).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (f.material && !materiais.includes(f.material)) f.material = '';
    const matSel = f.material || materiais[0] || '';
    const lista = filtrar(todos).sort((a, b) => String(b.data).localeCompare(String(a.data)));

    el.innerHTML = `
      <div class="page-head">
        <div><h1>Preços de materiais</h1><p>Compare preço e frete de sites e lojas físicas</p></div>
        <div class="page-actions">
          <button class="btn btn-ghost" id="pcExp">${icon('download', 18)} Planilha</button>
          <button class="btn btn-primary" id="pcNovo">${icon('plus', 18)} Registrar preço</button>
        </div>
      </div>
      <div class="card card-pad mb">
        <div class="filters">
          <div class="f"><label>Período</label><select class="input" id="pcPer">${options([['30', 'Últimos 30 dias'], ['90', 'Últimos 3 meses'], ['180', 'Últimos 6 meses'], ['365', 'Últimos 12 meses'], ['tudo', 'Todo o histórico'], ['custom', 'Escolher datas']], f.periodo)}</select></div>
          <div class="f ${f.periodo === 'custom' ? '' : 'hidden'}"><label>De</label><input type="date" class="input" id="pcDe" value="${esc(f.de)}"></div>
          <div class="f ${f.periodo === 'custom' ? '' : 'hidden'}"><label>Até</label><input type="date" class="input" id="pcAte" value="${esc(f.ate)}"></div>
          <div class="f" style="flex:1 1 200px"><label>Material</label><select class="input" id="pcMat">${options(materiais, matSel, { empty: materiais.length ? undefined : 'Nenhum' })}</select></div>
          <div class="f"><label>Tipo de loja</label><select class="input" id="pcTipo">${options([['site', 'Sites'], ['fisica', 'Lojas físicas']], f.tipo, { empty: 'Sites e lojas' })}</select></div>
        </div>
      </div>
      <div id="pcComp"></div>
      <div class="card mt">
        <div class="card-head"><h3>${icon('list', 18)} Histórico de registros</h3><span class="small muted">Clique em preço, frete ou quantidade para editar</span></div>
        <div id="pcHist"></div>
      </div>`;

    // Comparação do material selecionado
    const doMat = lista.filter(r => r.material === matSel);
    const ultimos = ultimoPorFornecedor(doMat).sort((a, b) => custoRegistro(a).porUnidade - custoRegistro(b).porUnidade);
    const best = ultimos[0];
    $('#pcComp').innerHTML = !matSel ? emptyState('Registre preços de fornecedores para comparar quem compensa mais.') : `
      <div class="grid g2">
        <div class="card">
          <div class="card-head"><h3>${icon('trend', 18)} Quem compensa mais: ${esc(matSel)}</h3></div>
          <div class="card-body">${ultimos.length ? `
            ${best ? `<div class="alert info mb">${icon('check', 18)}<div><b>${esc(best.fornecedor)}</b> (${best.tipoLoja === 'fisica' ? 'loja física' : 'site'}) tem o menor custo com frete: <b>${money(custoRegistro(best).porUnidade)}</b> por ${esc(best.unidade || 'un')}${ultimos[1] ? `, ${money((custoRegistro(ultimos[1]).porUnidade - custoRegistro(best).porUnidade) * (Number(best.qtdEmbalagem) || 1))} a menos por embalagem que o 2º lugar` : ''}.</div></div>` : ''}
            <div class="chart-box sm"><canvas id="pcBar"></canvas></div>` : emptyState('Nenhum registro deste material no período.')}</div>
        </div>
        <div class="card">
          <div class="card-head"><h3>${icon('calendar', 18)} Evolução do preço total (com frete)</h3></div>
          <div class="card-body">${doMat.length ? '<div class="chart-box"><canvas id="pcLine"></canvas></div>' : emptyState('Sem histórico no período.')}</div>
        </div>
      </div>
      ${ultimos.length ? `<div class="card mt">
        <div class="card-head"><h3>${icon('list', 18)} Ranking de fornecedores (último preço de cada um)</h3>
          ${best && store.data.materiais.some(m => norm(m.nome) === norm(matSel)) ? `<button class="btn btn-soft btn-sm" id="pcUsar">${icon('box', 16)} Usar o melhor custo no estoque e na precificação</button>` : ''}</div>
        <div class="table-wrap"><table class="tbl resp"><thead><tr><th>Fornecedor</th><th>Posição</th><th>Tipo</th><th>Data</th><th class="right">Preço</th><th class="right">Frete</th><th class="right">Total</th><th class="right">Embalagem</th><th class="right">Por unidade</th></tr></thead>
          <tbody>${ultimos.map((r, i) => { const c = custoRegistro(r); return `<tr class="${i === 0 ? 'best' : ''}"><td class="first">${esc(r.fornecedor)}</td><td data-label="Posição">${i + 1}º${i === 0 ? ' <span class="badge pri">melhor</span>' : ''}</td><td data-label="Tipo">${r.tipoLoja === 'fisica' ? 'Loja física' : 'Site'}</td><td data-label="Data">${fmtDate(r.data)}</td><td data-label="Preço" class="right num">${money(r.preco)}</td><td data-label="Frete" class="right num">${money(r.frete)}</td><td data-label="Total" class="right num strong">${money(c.total)}</td><td data-label="Embalagem" class="right num">${num(r.qtdEmbalagem, 3)} ${esc(r.unidade)}</td><td data-label="Por unidade" class="right num strong">${money(c.porUnidade)}</td></tr>`; }).join('')}</tbody></table></div>
      </div>` : ''}`;

    if (ultimos.length) {
      const c = chartColors();
      chart($('#pcBar'), {
        type: 'bar',
        data: { labels: ultimos.map(r => r.fornecedor), datasets: [
          { label: 'Preço', data: ultimos.map(r => Number(r.preco) || 0), backgroundColor: ultimos.map((_, i) => i === 0 ? c.primary : c.neutral), borderRadius: 6, stack: 's' },
          { label: 'Frete', data: ultimos.map(r => Number(r.frete) || 0), backgroundColor: ultimos.map((_, i) => i === 0 ? c.primarySoft : c.grid), borderRadius: 6, stack: 's' }
        ] },
        options: { indexAxis: 'y', scales: { x: { stacked: true, grid: { display: true }, ticks: { callback: v => money(v).replace(',00', '') } }, y: { stacked: true, grid: { display: false }, ticks: { callback(v) { return this.getLabelForValue(v); } } } } }
      });
    }
    if (doMat.length) {
      const c = chartColors();
      const forn = [...new Set(doMat.map(r => r.fornecedor))];
      const datas = [...new Set(doMat.map(r => r.data))].sort();
      chart($('#pcLine'), {
        type: 'line',
        data: { labels: datas.map(fmtDate), datasets: forn.map((fo, i) => ({
          label: fo, spanGaps: true, tension: .25, pointRadius: 4,
          borderColor: c.series[i % c.series.length], backgroundColor: c.series[i % c.series.length],
          data: datas.map(d => { const r = doMat.filter(x => x.fornecedor === fo && x.data === d).pop(); return r ? custoRegistro(r).total : null; })
        })) }
      });
    }

    // Histórico
    $('#pcHist').innerHTML = lista.length ? `<div class="table-wrap"><table class="tbl resp">
      <thead><tr><th>Data</th><th>Material</th><th>Fornecedor</th><th>Tipo</th><th class="right">Preço</th><th class="right">Frete</th><th class="right">Qtd. emb.</th><th class="right">Total</th><th class="right">Por un.</th><th></th></tr></thead>
      <tbody>${lista.map(r => { const c = custoRegistro(r); return `<tr data-id="${r.id}">
        <td class="first">${fmtDate(r.data)}</td>
        <td data-label="Material">${esc(r.material)}</td>
        <td data-label="Fornecedor">${r.link && /^https?:\/\//.test(r.link) ? `<a href="${esc(r.link)}" target="_blank" rel="noopener noreferrer">${esc(r.fornecedor)}</a>` : esc(r.fornecedor)}</td>
        <td data-label="Tipo">${r.tipoLoja === 'fisica' ? 'Loja física' : 'Site'}</td>
        <td data-label="Preço" class="right"><input class="cell-input" data-c="preco" inputmode="decimal" value="${num(r.preco, 2)}" aria-label="Preço"></td>
        <td data-label="Frete" class="right"><input class="cell-input" data-c="frete" inputmode="decimal" value="${num(r.frete, 2)}" aria-label="Frete"></td>
        <td data-label="Qtd. embalagem" class="right"><input class="cell-input" data-c="qtdEmbalagem" inputmode="decimal" value="${num(r.qtdEmbalagem, 3)}" aria-label="Quantidade na embalagem"></td>
        <td data-label="Total" class="right num strong">${money(c.total)}</td>
        <td data-label="Por unidade" class="right num">${money(c.porUnidade)}<span class="muted">/${esc(r.unidade || 'un')}</span></td>
        <td class="acts"><button class="icon-btn" data-dup title="Registrar preço novo de hoje">${icon('refresh', 18)}</button><button class="icon-btn" data-edit title="Editar">${icon('edit', 18)}</button><button class="icon-btn danger" data-del title="Excluir">${icon('trash', 18)}</button></td>
      </tr>`; }).join('')}</tbody></table></div>` : emptyState('Nenhum registro no período.');

    $$('#pcHist tr[data-id]').forEach(tr => {
      const r = store.get('precos', tr.dataset.id);
      $$('[data-c]', tr).forEach(inp => inp.onchange = () => store.save('precos', { ...r, [inp.dataset.c]: parseNum(inp.value) }).then(() => toast('Preço atualizado.')));
      tr.querySelector('[data-dup]').onclick = () => precoForm({ ...r, id: undefined, data: today(), createdAt: undefined }, true);
      tr.querySelector('[data-edit]').onclick = () => precoForm(r);
      tr.querySelector('[data-del]').onclick = async () => { if (await confirmDialog('Excluir este registro de preço?', { ok: 'Excluir', danger: true })) { await store.remove('precos', r.id); toast('Registro excluído.'); } };
    });

    const re = () => this.render(el);
    $('#pcPer').onchange = e => { f.periodo = e.target.value; re(); };
    $('#pcDe').onchange = e => { f.de = e.target.value; re(); };
    $('#pcAte').onchange = e => { f.ate = e.target.value; re(); };
    $('#pcMat').onchange = e => { f.material = e.target.value; re(); };
    $('#pcTipo').onchange = e => { f.tipo = e.target.value; re(); };
    $('#pcNovo').onclick = () => precoForm({ material: matSel });
    $('#pcExp').onclick = () => exportCSV('precos');
    $('#pcUsar')?.addEventListener('click', async () => {
      const m = store.data.materiais.find(x => norm(x.nome) === norm(matSel));
      const v = Math.round(custoRegistro(best).porUnidade * 10000) / 10000;
      await store.save('materiais', { ...m, custoUnit: v, fornecedor: best.fornecedor, conteudoEmb: Number(best.qtdEmbalagem) || 1, precoEmb: Math.round(custoRegistro(best).total * 100) / 100 });
      toast(`Custo de ${m.nome} atualizado: ${money(custoRegistro(best).total)} a embalagem (com frete).`);
    });
  },
  destroy: destroyCharts
};

function filtrar(list) {
  let de = null, ate = null;
  if (f.periodo === 'custom') { de = parseDate(f.de); ate = parseDate(f.ate); }
  else if (f.periodo !== 'tudo') { const d = new Date(); d.setDate(d.getDate() - Number(f.periodo)); de = parseDate(toYMD(d)); }
  return list.filter(r => {
    const d = parseDate(r.data);
    if (de && (!d || d < de)) return false;
    if (ate && (!d || d > ate)) return false;
    if (f.tipo && r.tipoLoja !== f.tipo) return false;
    return true;
  });
}

function ultimoPorFornecedor(list) {
  const m = new Map();
  list.forEach(r => { const k = norm(r.fornecedor) + '|' + r.tipoLoja; const cur = m.get(k); if (!cur || String(r.data) > String(cur.data)) m.set(k, r); });
  return [...m.values()];
}

export function precoForm(r = {}, novo = false) {
  const v = { data: today(), tipoLoja: 'site', frete: 0, qtdEmbalagem: 1, unidade: 'un', ...r };
  const editando = !!r.id && !novo;
  const mats = [...new Set([...store.data.materiais.map(m => m.nome), ...store.data.precos.map(p => p.material)])].filter(Boolean);
  const forns = [...new Set(store.data.precos.map(p => p.fornecedor))].filter(Boolean);
  modal({
    title: editando ? 'Editar registro de preço' : 'Registrar preço',
    body: `<form class="form-grid" id="fPc">
      <div class="f s8"><label>Material *</label><input name="material" list="pcMats" value="${esc(v.material)}" placeholder="Ex.: Fio Amigurumi branco 125 g"></div>
      <div class="f s4"><label>Data</label><input type="date" name="data" value="${esc(v.data)}"></div>
      <div class="f s8"><label>Fornecedor (site ou loja) *</label><input name="fornecedor" list="pcForns" value="${esc(v.fornecedor)}"></div>
      <div class="f s4"><label>Tipo</label><select name="tipoLoja">${options([['site', 'Site'], ['fisica', 'Loja física']], v.tipoLoja)}</select></div>
      <div class="f s3"><label>Preço (R$) *</label><input name="preco" data-num inputmode="decimal" value="${v.preco ? num(v.preco, 2) : ''}"></div>
      <div class="f s3"><label>Frete (R$)</label><input name="frete" data-num inputmode="decimal" value="${num(v.frete, 2)}"></div>
      <div class="f s3"><label>Qtd. na embalagem</label><input name="qtdEmbalagem" data-num inputmode="decimal" value="${num(v.qtdEmbalagem, 3)}"></div>
      <div class="f s3"><label>Unidade</label><select name="unidade">${options(UNIDADES, v.unidade)}</select></div>
      <div class="f s12"><label>Link do site ou endereço da loja</label><input name="link" value="${esc(v.link)}"></div>
      <div class="f s12"><label>Observações</label><input name="obs" value="${esc(v.obs)}" placeholder="Prazo de entrega, cupom, frete grátis acima de…"></div>
      <datalist id="pcMats">${mats.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
      <datalist id="pcForns">${forns.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
    </form>`,
    actions: `<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="fPcSave">Salvar</button>`,
    onOpen(md, close) {
      $('#fPcSave', md).onclick = async () => {
        const o = formData($('#fPc', md));
        if (!o.material || !o.fornecedor) { toast('Informe o material e o fornecedor.', 'err'); return; }
        if (!(o.preco > 0)) { toast('Informe o preço.', 'err'); return; }
        if (!(o.qtdEmbalagem > 0)) o.qtdEmbalagem = 1;
        const base = editando ? r : {};
        await store.save('precos', { ...base, ...o });
        f.material = o.material;
        toast('Preço registrado.'); close();
      };
    }
  });
}
