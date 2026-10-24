// Precificação: preço de cada peça = (materiais + horas × valor/hora + frete) + margem de lucro
import * as store from '../store.js';
import { $, $$, esc, icon, money, num, fmtDur, parseNum, modal, confirmDialog, toast, options, emptyState, uid, norm } from '../utils.js';
import { calcPreco, itensPadrao, tempoPecaSeg, UNIDADES } from '../logic.js';
import { go } from '../app.js';
import { pedidoForm } from './clientes.js';
import { exportCSV } from '../export.js';

let draft = null, dirty = false, busca = '';

export default {
  render(el, [id]) {
    if (id) return renderEditor(el, id);
    draft = null; dirty = false;
    renderLista(el);
  },
  keep(what) {
    if (!draft) return false;
    if (['sessoes', 'materiais', 'settings'].includes(what)) updateResumo();
    return true;  // editor aberto: não redesenha para não perder o que está sendo digitado
  },
  destroy() { draft = null; dirty = false; }
};

function renderLista(el) {
  const pecas = [...store.data.pecas].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  el.innerHTML = `
    <div class="page-head">
      <div><h1>Precificação</h1><p>O preço é recalculado sempre que um valor muda</p></div>
      <div class="page-actions">
        <button class="btn btn-ghost" id="prExp">${icon('download', 18)} Planilha</button>
        <button class="btn btn-primary" id="prNova">${icon('plus', 18)} Nova peça</button>
      </div>
    </div>
    <div class="row mb"><div class="search grow" style="max-width:380px">${icon('search', 18)}<input class="input" id="prBusca" placeholder="Buscar peça ou cliente" value="${esc(busca)}"></div></div>
    <div id="prCards"></div>`;
  const draw = () => {
    const q = norm(busca);
    const lista = pecas.filter(p => !q || norm(p.nome + ' ' + (store.get('clientes', p.clienteId)?.nome || '')).includes(q));
    $('#prCards').innerHTML = lista.length ? `<div class="cards">${lista.map(p => {
      const c = calcPreco(p), cli = store.get('clientes', p.clienteId);
      return `<button class="card item-card" data-id="${p.id}">
        <div class="row between"><b>${esc(p.nome)}</b>${p.usarCronometro ? `<span class="badge pri">${icon('timer', 13)} cronômetro</span>` : ''}</div>
        <div class="small muted">${cli ? esc(cli.nome) : 'Sem cliente vinculado'}</div>
        <div class="price">${money(c.preco)}</div>
        <div class="small muted">Custo ${money(c.custo)} · ${num(c.horas, 1)} h · margem ${num(p.margem, 0)}%</div>
      </button>`;
    }).join('')}</div>` : emptyState(pecas.length ? 'Nenhuma peça encontrada.' : 'Cadastre uma peça para calcular o preço.');
    $$('#prCards [data-id]').forEach(b => b.onclick = () => go('precificacao/' + b.dataset.id));
  };
  draw();
  $('#prBusca').oninput = e => { busca = e.target.value; draw(); };
  $('#prNova').onclick = () => go('precificacao/nova');
  $('#prExp').onclick = () => exportCSV('pecas');
}

export function novaPeca(extra = {}) {
  return { id: uid(), nome: '', clienteId: '', horas: 0, usarCronometro: false, valorHora: Number(store.settings.valorHora) || 0, margem: Number(store.settings.margem) || 0, frete: 0, itens: itensPadrao(), obs: '', ...extra };
}

function renderEditor(el, id) {
  const existente = store.get('pecas', id);
  if (!existente && id !== 'nova') { el.innerHTML = '<div class="alert">Peça não encontrada. <a href="#/precificacao">Voltar</a></div>'; return; }
  // o rascunho é zerado a cada navegação (destroy); só é criado aqui na primeira renderização
  if (!draft) { draft = existente ? structuredClone(existente) : novaPeca(); dirty = false; }
  const p = draft;
  const clientes = [...store.data.clientes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const tempo = tempoPecaSeg(p.id);
  el.innerHTML = `
    <div class="page-head">
      <div><a href="#/precificacao" class="small muted" style="text-decoration:none" id="prVoltar">← Precificação</a><h1>${existente ? esc(p.nome) : 'Nova peça'}</h1></div>
      <div class="page-actions">
        ${existente ? `<button class="btn btn-ghost" id="prDup">${icon('copy', 18)} Duplicar</button><button class="btn btn-ghost" id="prBaixa">${icon('box', 18)} Baixar do estoque</button>` : ''}
        <button class="btn btn-primary" id="prSalvar">${icon('check', 18)} Salvar</button>
      </div>
    </div>
    <div class="price-layout">
      <div class="grid" style="gap:16px">
        <div class="card"><div class="card-head"><h3>Peça</h3></div><div class="card-body form-grid">
          <div class="f s8"><label>Nome da peça *</label><input data-k="nome" value="${esc(p.nome)}" placeholder="Ex.: Coelhinha 30 cm"></div>
          <div class="f s4"><label>Cliente</label><select data-k="clienteId">${options(clientes.map(c => [c.id, c.nome]), p.clienteId, { empty: 'Nenhum' })}</select></div>
          <div class="f s12"><label>Observações</label><input data-k="obs" value="${esc(p.obs)}" placeholder="Cores, tamanho, detalhes…"></div>
        </div></div>

        <div class="card"><div class="card-head"><h3>${icon('timer', 18)} Mão de obra</h3></div><div class="card-body form-grid">
          <label class="check f s12"><input type="checkbox" data-k="usarCronometro" ${p.usarCronometro ? 'checked' : ''}> Usar o tempo registrado no cronômetro (${fmtDur(tempo)})</label>
          <div class="f s4"><label>Horas trabalhadas</label><input data-k="horas" data-n inputmode="decimal" value="${p.usarCronometro ? num(tempo / 3600, 2) : num(p.horas, 2)}" ${p.usarCronometro ? 'disabled' : ''} id="prHoras"></div>
          <div class="f s4"><label>Valor da hora (R$)</label><input data-k="valorHora" data-n inputmode="decimal" value="${num(p.valorHora, 2)}"></div>
          <div class="f s4" style="justify-content:flex-end">${existente ? `<a class="btn btn-ghost" href="#/cronometro/${p.id}">${icon('play', 16)} Abrir cronômetro</a>` : '<span class="small muted">Salve a peça para usar o cronômetro.</span>'}</div>
        </div></div>

        <div class="card"><div class="card-head"><h3>${icon('yarn', 18)} Materiais</h3><button class="btn btn-sm btn-soft" id="prAddItem">${icon('plus', 16)} Adicionar material</button></div>
          <div class="card-body">
            <div class="mat-row head"><span>Material</span><span>Qtd.</span><span>Un.</span><span>Valor un. (R$)</span><span class="right">Subtotal</span><span></span></div>
            <div id="prItens"></div>
            <datalist id="matList">${store.data.materiais.map(m => `<option value="${esc(m.nome)}">`).join('')}</datalist>
            <p class="small muted mt">Digite o nome de um material do estoque para puxar unidade e valor automaticamente. Todos os valores podem ser editados.</p>
          </div>
        </div>

        <div class="card"><div class="card-head"><h3>Frete e lucro</h3></div><div class="card-body form-grid">
          <div class="f s6"><label>Frete (R$)</label><input data-k="frete" data-n inputmode="decimal" value="${num(p.frete, 2)}"></div>
          <div class="f s6"><label>Margem de lucro (%)</label><input data-k="margem" data-n inputmode="decimal" value="${num(p.margem, 2)}"></div>
        </div></div>
        ${existente ? `<div><button class="btn btn-ghost" id="prDel" style="color:var(--danger)">${icon('trash', 18)} Excluir peça</button></div>` : ''}
      </div>

      <div class="card card-pad price-sum" id="prResumo"></div>
    </div>`;

  drawItens();
  updateResumo();

  $$('[data-k]', el).forEach(inp => {
    const ev = inp.type === 'checkbox' || inp.tagName === 'SELECT' ? 'change' : 'input';
    inp.addEventListener(ev, () => {
      const k = inp.dataset.k;
      p[k] = inp.type === 'checkbox' ? inp.checked : inp.dataset.n !== undefined ? parseNum(inp.value) : inp.value;
      dirty = true;
      if (k === 'usarCronometro') {
        const h = $('#prHoras'); h.disabled = p.usarCronometro;
        h.value = num(p.usarCronometro ? tempoPecaSeg(p.id) / 3600 : p.horas, 2);
      }
      updateResumo();
    });
  });
  $('#prAddItem').onclick = () => { p.itens.push({ id: uid(), categoria: '', materialId: '', descricao: '', quantidade: 0, unidade: 'un', valorUnit: 0 }); dirty = true; drawItens(); $$('#prItens .mat-desc input').pop()?.focus(); };
  $('#prSalvar').onclick = salvar;
  $('#prVoltar').onclick = async e => {
    if (dirty) { e.preventDefault(); if (await confirmDialog('Sair sem salvar as alterações?', { ok: 'Sair sem salvar' })) { dirty = false; draft = null; go('precificacao'); } }
  };
  if (existente) {
    $('#prDel').onclick = async () => {
      if (!await confirmDialog(`Excluir a peça "${p.nome}"? As sessões do cronômetro dela continuam salvas.`, { ok: 'Excluir', danger: true })) return;
      await store.remove('pecas', p.id); draft = null; dirty = false; toast('Peça excluída.'); go('precificacao');
    };
    $('#prDup').onclick = async () => {
      const copia = { ...structuredClone(p), id: uid(), nome: p.nome + ' (cópia)', usarCronometro: false, horas: calcPreco(p).horas };
      delete copia.createdAt;
      await store.save('pecas', copia); draft = null; toast('Peça duplicada.'); go('precificacao/' + copia.id);
    };
    $('#prBaixa').onclick = baixarEstoque;
  }
}

function drawItens() {
  const p = draft;
  $('#prItens').innerHTML = p.itens.map(i => `
    <div class="mat-row" data-iid="${i.id}">
      <div class="mat-desc"><input class="input" list="matList" data-ik="descricao" value="${esc(i.descricao)}" placeholder="${esc(i.categoria || 'Material')}"></div>
      <input class="input" data-ik="quantidade" data-n inputmode="decimal" value="${num(i.quantidade, 3)}" aria-label="Quantidade">
      <select class="input" data-ik="unidade" aria-label="Unidade">${options(UNIDADES, i.unidade)}</select>
      <input class="input" data-ik="valorUnit" data-n inputmode="decimal" value="${num(i.valorUnit, 4)}" aria-label="Valor unitário">
      <span class="sub" data-sub>${money(i.quantidade * i.valorUnit)}</span>
      <button class="icon-btn danger" data-rm title="Remover">${icon('trash', 18)}</button>
    </div>`).join('') || '<p class="muted small">Nenhum material. Adicione os materiais usados na peça.</p>';
  $$('#prItens .mat-row').forEach(row => {
    const it = p.itens.find(x => x.id === row.dataset.iid);
    $$('[data-ik]', row).forEach(inp => {
      inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => {
        const k = inp.dataset.ik;
        it[k] = inp.dataset.n !== undefined ? parseNum(inp.value) : inp.value;
        if (k === 'descricao') {
          const m = store.data.materiais.find(x => norm(x.nome) === norm(inp.value));
          if (m) {
            it.materialId = m.id; it.unidade = m.unidade || it.unidade; it.valorUnit = Number(m.custoUnit) || 0; it.categoria = m.categoria;
            $('[data-ik=unidade]', row).value = it.unidade; $('[data-ik=valorUnit]', row).value = num(it.valorUnit, 4);
          } else it.materialId = '';
        }
        $('[data-sub]', row).textContent = money(it.quantidade * it.valorUnit);
        dirty = true; updateResumo();
      });
    });
    $('[data-rm]', row).onclick = () => { p.itens = p.itens.filter(x => x !== it); dirty = true; drawItens(); updateResumo(); };
  });
}

function updateResumo() {
  const box = $('#prResumo');
  if (!box || !draft) return;
  const c = calcPreco(draft);
  if (draft.usarCronometro) { const h = $('#prHoras'); if (h) h.value = num(c.horas, 2); }
  box.innerHTML = `
    <h3 style="font-size:15px;margin-bottom:6px">Resumo do preço</h3>
    <div class="line"><span>Materiais</span><span>${money(c.materiais)}</span></div>
    <div class="line"><span>Mão de obra <small class="muted">(${num(c.horas, 2)} h × ${money(draft.valorHora)})</small></span><span>${money(c.maoDeObra)}</span></div>
    <div class="line"><span>Frete</span><span>${money(c.frete)}</span></div>
    <div class="line strong"><span>Custo total</span><span>${money(c.custo)}</span></div>
    <div class="line"><span>Lucro (${num(draft.margem, 2)}%)</span><span>${money(c.lucro)}</span></div>
    <div class="final"><small>Preço final</small><b>${money(c.preco)}</b></div>
    ${store.get('pecas', draft.id) ? `<button class="btn btn-ghost mt" style="width:100%;justify-content:center" id="prPedido">${icon('plus', 18)} Criar pedido com este preço</button>` : ''}
    ${dirty ? '<p class="small muted mt" style="text-align:center">Alterações ainda não salvas</p>' : ''}`;
  $('#prPedido')?.addEventListener('click', () => {
    if (dirty) { toast('Salve a peça antes de criar o pedido.', 'err'); return; }
    pedidoForm(null, { clienteId: draft.clienteId, pecaId: draft.id, descricao: draft.nome, valor: Math.round(c.preco * 100) / 100 });
  });
}

async function salvar() {
  const p = draft;
  if (!p.nome.trim()) { toast('Dê um nome para a peça.', 'err'); return; }
  const c = calcPreco(p);
  p.precoCalculado = Math.round(c.preco * 100) / 100;
  p.custoCalculado = Math.round(c.custo * 100) / 100;
  p.tempoSegundos = tempoPecaSeg(p.id);
  const novo = !store.get('pecas', p.id);
  await store.save('pecas', structuredClone(p));
  dirty = false; toast('Peça salva.');
  if (novo) { draft = null; go('precificacao/' + p.id); } else updateResumo();
}

function baixarEstoque() {
  const itens = draft.itens.filter(i => i.materialId && i.quantidade > 0 && store.get('materiais', i.materialId));
  if (!itens.length) { toast('Nenhum material desta peça está ligado ao estoque.', 'err'); return; }
  modal({
    title: 'Dar baixa no estoque',
    body: `<p class="mb">Os materiais abaixo serão descontados do estoque:</p>
      <ul class="list">${itens.map(i => { const m = store.get('materiais', i.materialId); return `<li><span class="grow">${esc(m.nome)}</span><span class="num">${num(m.quantidade, 3)} → <b>${num(m.quantidade - i.quantidade, 3)}</b> ${esc(m.unidade)}</span></li>`; }).join('')}</ul>`,
    actions: `<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="bxOk">Dar baixa</button>`,
    onOpen(m, close) {
      $('#bxOk', m).onclick = async () => {
        for (const i of itens) { const mt = store.get('materiais', i.materialId); await store.save('materiais', { ...mt, quantidade: Math.round((mt.quantidade - i.quantidade) * 1000) / 1000 }); }
        toast('Estoque atualizado.'); close();
      };
    }
  });
}
