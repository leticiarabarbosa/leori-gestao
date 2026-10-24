// Clientes: cadastro (contato, dados fiscais, entrega), histórico de pedidos e pagamentos
import * as store from '../store.js';
import { $, $$, esc, icon, money, fmtDate, fmtDur, today, modal, confirmDialog, toast, formData, options, norm, byDateDesc, emptyState } from '../utils.js';
import { FORMAS, ETAPAS, salvarPedido, excluirPedido, resumoCliente, enderecoTexto, calcPreco } from '../logic.js';
import { go } from '../app.js';
import { exportCSV, pdfNF } from '../export.js';

let busca = '', filtro = 'todos';

export default {
  render(el, [id]) {
    if (id) return renderDetalhe(el, id);
    renderLista(el);
  }
};

// ── Lista ────────────────────────────────────────────────────────
function renderLista(el) {
  const todos = [...store.data.clientes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  el.innerHTML = `
    <div class="page-head">
      <div><h1>Clientes</h1><p>${todos.length} cadastrado(s)</p></div>
      <div class="page-actions">
        <button class="btn btn-ghost" id="cExp">${icon('download', 18)} Planilha</button>
        <button class="btn btn-ghost" id="pNovo">${icon('plus', 18)} Novo pedido</button>
        <button class="btn btn-primary" id="cNovo">${icon('plus', 18)} Novo cliente</button>
      </div>
    </div>
    <div class="card">
      <div class="card-head">
        <div class="search grow" style="max-width:380px">${icon('search', 18)}<input class="input" id="cBusca" placeholder="Buscar por nome, telefone, e-mail ou CPF/CNPJ" value="${esc(busca)}"></div>
        <div class="seg" id="cFiltro">${[['todos', 'Todos'], ['pendente', 'Com pagamento pendente']].map(([k, l]) => `<button data-k="${k}" class="${filtro === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      </div>
      <div id="cTabela"></div>
    </div>`;
  const draw = () => {
    const q = norm(busca);
    const lista = todos.filter(c => {
      if (q && !norm([c.nome, c.telefone, c.email, c.documento, c.redeSocial].join(' ')).includes(q)) return false;
      if (filtro === 'pendente' && resumoCliente(c.id).pendente <= 0) return false;
      return true;
    });
    $('#cTabela').innerHTML = lista.length ? `
      <div class="table-wrap"><table class="tbl resp">
        <thead><tr><th>Nome</th><th>Telefone</th><th>Cidade</th><th class="right">Pedidos</th><th class="right">Total comprado</th><th class="right">Pendente</th><th></th></tr></thead>
        <tbody>${lista.map(c => {
          const r = resumoCliente(c.id);
          return `<tr class="clickable" data-id="${c.id}">
            <td class="first">${esc(c.nome)}</td>
            <td data-label="Telefone">${esc(c.telefone || '—')}</td>
            <td data-label="Cidade">${esc(c.endereco?.cidade || '—')}</td>
            <td data-label="Pedidos" class="right">${r.pedidos.length}</td>
            <td data-label="Total" class="right num">${money(r.total)}</td>
            <td data-label="Pendente" class="right">${r.pendente > 0 ? `<span class="badge warn">${money(r.pendente)}</span>` : '<span class="muted">—</span>'}</td>
            <td class="acts">${icon('chevR', 18)}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>` : emptyState(todos.length ? 'Nenhum cliente encontrado.' : 'Cadastre seu primeiro cliente para começar.');
    $$('#cTabela tr[data-id]').forEach(tr => tr.onclick = () => go('clientes/' + tr.dataset.id));
  };
  draw();
  $('#cBusca').oninput = e => { busca = e.target.value; draw(); };
  $$('#cFiltro button').forEach(b => b.onclick = () => { filtro = b.dataset.k; $$('#cFiltro button').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  $('#cNovo').onclick = () => clienteForm();
  $('#pNovo').onclick = () => pedidoForm();
  $('#cExp').onclick = () => exportCSV('clientes');
}

// ── Detalhe ──────────────────────────────────────────────────────
function renderDetalhe(el, id) {
  const c = store.get('clientes', id);
  if (!c) { el.innerHTML = `<div class="alert">Cliente não encontrado. <a href="#/clientes">Voltar</a></div>`; return; }
  const r = resumoCliente(id);
  const pedidos = [...r.pedidos].sort(byDateDesc());
  const ent = c.entregaIgual ? c.endereco : c.entrega;
  el.innerHTML = `
    <div class="page-head">
      <div><a href="#/clientes" class="small muted" style="text-decoration:none">← Clientes</a><h1>${esc(c.nome)}</h1>
        <p>${c.criadoEm || c.createdAt ? 'Cliente desde ' + fmtDate(c.createdAt) : ''}</p></div>
      <div class="page-actions">
        <button class="btn btn-ghost" id="dExp" title="Exportar todos os dados deste cliente (LGPD)">${icon('shield', 18)} Dados do cliente</button>
        <button class="btn btn-ghost" id="dEdit">${icon('edit', 18)} Editar</button>
        <button class="btn btn-primary" id="dPed">${icon('plus', 18)} Novo pedido</button>
      </div>
    </div>
    <div class="stats mb">
      <div class="card stat"><div class="lbl">Total comprado</div><div class="val">${money(r.total)}</div><div class="hint">${r.pedidos.length} pedido(s)</div></div>
      <div class="card stat"><div class="lbl">Pago</div><div class="val">${money(r.pago)}</div></div>
      <div class="card stat ${r.pendente > 0 ? 'neg' : ''}"><div class="lbl">Pendente</div><div class="val">${money(r.pendente)}</div></div>
      <div class="card stat"><div class="lbl">Tempo de produção</div><div class="val">${fmtDur(r.tempoSeg)}</div><div class="hint">${r.pecas.length} peça(s) vinculada(s)</div></div>
    </div>
    <div class="grid g3 mb">
      <div class="card"><div class="card-head"><h3>${icon('phone', 18)} Contato</h3></div><div class="card-body"><dl class="kv">
        <dt>Telefone</dt><dd>${c.telefone ? `<a href="https://wa.me/55${esc(c.telefone.replace(/\D/g, ''))}" target="_blank" rel="noopener">${esc(c.telefone)}</a>` : '—'}</dd>
        <dt>E-mail</dt><dd>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '—'}</dd>
        <dt>Rede social</dt><dd>${esc(c.redeSocial || '—')}</dd>
        <dt>Observações</dt><dd>${esc(c.obs || '—')}</dd>
      </dl></div></div>
      <div class="card"><div class="card-head"><h3>${icon('file', 18)} Dados para nota fiscal</h3></div><div class="card-body"><dl class="kv">
        <dt>${c.tipoPessoa === 'PJ' ? 'CNPJ' : 'CPF'}</dt><dd>${esc(c.documento || '—')}</dd>
        ${c.tipoPessoa === 'PJ' ? `<dt>Razão social</dt><dd>${esc(c.razaoSocial || '—')}</dd><dt>Insc. estadual</dt><dd>${esc(c.ie || '—')}</dd>` : ''}
        <dt>Endereço</dt><dd>${esc(enderecoTexto(c.endereco) || '—')}</dd>
      </dl></div></div>
      <div class="card"><div class="card-head"><h3>${icon('pin', 18)} Endereço de entrega</h3></div><div class="card-body">
        <p>${esc(enderecoTexto(ent) || '—')}</p>${c.entregaIgual ? '<p class="small muted mt-s">Mesmo endereço da nota fiscal</p>' : ''}
        ${c.consentimento ? `<p class="small muted mt">${icon('shield', 14)} Consentimento LGPD registrado em ${fmtDate(c.consentimentoData)}</p>` : '<p class="small mt" style="color:var(--warn)">Consentimento LGPD não registrado</p>'}
      </div></div>
    </div>
    <div class="card mb">
      <div class="card-head"><h3>${icon('list', 18)} Histórico de compras</h3></div>
      ${pedidos.length ? `<div class="table-wrap"><table class="tbl resp">
        <thead><tr><th>Data</th><th>Descrição</th><th>Etapa</th><th class="right">Valor</th><th>Pagamento</th><th>Forma</th><th></th></tr></thead>
        <tbody>${pedidos.map(p => linhaPedido(p)).join('')}</tbody>
      </table></div>` : emptyState('Nenhum pedido registrado para este cliente.')}
    </div>
    ${r.pecas.length ? `<div class="card mb"><div class="card-head"><h3>${icon('timer', 18)} Peças e tempo de produção</h3></div>
      <div class="table-wrap"><table class="tbl resp"><thead><tr><th>Peça</th><th class="right">Tempo (cronômetro)</th><th class="right">Preço calculado</th><th></th></tr></thead>
      <tbody>${r.pecas.map(p => `<tr><td class="first">${esc(p.nome)}</td><td data-label="Tempo" class="right">${fmtDur(store.data.sessoes.filter(s => s.pecaId === p.id).reduce((a, s) => a + (s.duracaoSeg || 0), 0))}</td><td data-label="Preço" class="right num">${money(calcPreco(p).preco)}</td><td class="acts"><a class="btn btn-sm btn-ghost" href="#/precificacao/${p.id}">Abrir</a></td></tr>`).join('')}</tbody></table></div></div>` : ''}
    <div class="row"><button class="btn btn-ghost" id="dDel" style="color:var(--danger)">${icon('trash', 18)} Excluir cliente e seus dados</button></div>`;

  $('#dEdit').onclick = () => clienteForm(c);
  $('#dPed').onclick = () => pedidoForm(null, { clienteId: id });
  $('#dExp').onclick = () => exportCSV('cliente', id);
  bindPedidoActs(el);
  $('#dDel').onclick = async () => {
    if (!await confirmDialog(`Excluir "${c.nome}" e todos os pedidos dele? As entradas no caixa geradas por esses pedidos também serão removidas. Isso não pode ser desfeito.`, { ok: 'Excluir', danger: true })) return;
    for (const p of r.pedidos) await excluirPedido(p.id);
    for (const pc of r.pecas) await store.save('pecas', { ...pc, clienteId: '' });
    await store.remove('clientes', id);
    toast('Cliente excluído.');
    go('clientes');
  };
}

function linhaPedido(p, comCliente = false) {
  const etapa = ETAPAS.find(e => e[0] === p.etapa)?.[1] || '—';
  const cli = comCliente ? store.get('clientes', p.clienteId) : null;
  return `<tr data-pid="${p.id}">
    <td class="first">${fmtDate(p.data)}${comCliente ? ` · ${esc(cli?.nome || 'Sem cliente')}` : ''}</td>
    <td data-label="Descrição">${esc(p.descricao || '—')}${p.quantidade > 1 ? ` <span class="muted">×${p.quantidade}</span>` : ''}</td>
    <td data-label="Etapa"><span class="badge">${esc(etapa)}</span></td>
    <td data-label="Valor" class="right num strong">${money(p.valor)}</td>
    <td data-label="Pagamento">${p.status === 'pago' ? `<span class="badge ok">${icon('check', 13)} Pago ${p.dataPagamento ? fmtDate(p.dataPagamento) : ''}</span>` : '<span class="badge warn">Pendente</span>'}</td>
    <td data-label="Forma">${esc(p.forma || '—')}${p.parcelas > 1 ? ` · ${p.parcelas}x` : ''}</td>
    <td class="acts">
      ${p.status !== 'pago' ? `<button class="btn btn-sm btn-soft" data-pagar>Registrar pagamento</button>` : ''}
      <button class="icon-btn" data-nf title="Resumo para nota fiscal">${icon('file', 18)}</button>
      <button class="icon-btn" data-edit title="Editar">${icon('edit', 18)}</button>
      <button class="icon-btn danger" data-del title="Excluir">${icon('trash', 18)}</button>
    </td></tr>`;
}
export { linhaPedido };

export function bindPedidoActs(el) {
  $$('tr[data-pid]', el).forEach(tr => {
    const p = store.get('pedidos', tr.dataset.pid);
    tr.querySelector('[data-edit]').onclick = () => pedidoForm(p);
    tr.querySelector('[data-nf]').onclick = () => nfResumo(p.id);
    tr.querySelector('[data-pagar]')?.addEventListener('click', () => pagamentoForm(p));
    tr.querySelector('[data-del]').onclick = async () => {
      if (!await confirmDialog('Excluir este pedido? Se ele estava pago, a entrada no caixa também será removida.', { ok: 'Excluir', danger: true })) return;
      await excluirPedido(p.id); toast('Pedido excluído.');
    };
  });
}

// ── Formulário de cliente ────────────────────────────────────────
const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
function enderecoCampos(pref, e = {}) {
  return `
    <div class="f s3"><label>CEP</label><div class="row" style="flex-wrap:nowrap"><input name="${pref}.cep" value="${esc(e.cep)}" inputmode="numeric" placeholder="00000-000" data-cep="${pref}"><button type="button" class="icon-btn" data-buscacep="${pref}" title="Buscar endereço pelo CEP">${icon('search', 18)}</button></div></div>
    <div class="f s7"><label>Rua</label><input name="${pref}.rua" value="${esc(e.rua)}"></div>
    <div class="f s2"><label>Número</label><input name="${pref}.numero" value="${esc(e.numero)}"></div>
    <div class="f s4"><label>Complemento</label><input name="${pref}.complemento" value="${esc(e.complemento)}"></div>
    <div class="f s3"><label>Bairro</label><input name="${pref}.bairro" value="${esc(e.bairro)}"></div>
    <div class="f s3"><label>Cidade</label><input name="${pref}.cidade" value="${esc(e.cidade)}"></div>
    <div class="f s2"><label>UF</label><select name="${pref}.uf">${options(UFS, e.uf, { empty: '—' })}</select></div>`;
}

export function clienteForm(c = null, onSaved) {
  const v = c || { tipoPessoa: 'PF', entregaIgual: true };
  modal({
    title: c ? 'Editar cliente' : 'Novo cliente', size: 'lg',
    body: `<form class="form-grid" id="fCli" novalidate>
      <div class="section-title">Contato</div>
      <div class="f s12"><label>Nome completo *</label><input name="nome" value="${esc(v.nome)}" required autocomplete="off"></div>
      <div class="f s4"><label>Telefone / WhatsApp</label><input name="telefone" value="${esc(v.telefone)}" inputmode="tel" placeholder="(00) 00000-0000"></div>
      <div class="f s4"><label>E-mail</label><input name="email" type="email" value="${esc(v.email)}"></div>
      <div class="f s4"><label>Rede social</label><input name="redeSocial" value="${esc(v.redeSocial)}" placeholder="@usuario"></div>
      <div class="section-title">Dados para nota fiscal</div>
      <div class="f s3"><label>Tipo</label><select name="tipoPessoa" id="tpPessoa">${options([['PF', 'Pessoa física'], ['PJ', 'Pessoa jurídica']], v.tipoPessoa)}</select></div>
      <div class="f s3"><label id="docLbl">${v.tipoPessoa === 'PJ' ? 'CNPJ' : 'CPF'}</label><input name="documento" value="${esc(v.documento)}" inputmode="numeric" id="docInp"><small class="muted" id="docMsg"></small></div>
      <div class="f s3 pj ${v.tipoPessoa === 'PJ' ? '' : 'hidden'}"><label>Razão social</label><input name="razaoSocial" value="${esc(v.razaoSocial)}"></div>
      <div class="f s3 pj ${v.tipoPessoa === 'PJ' ? '' : 'hidden'}"><label>Inscrição estadual</label><input name="ie" value="${esc(v.ie)}"></div>
      ${enderecoCampos('endereco', v.endereco)}
      <div class="section-title">Endereço de entrega</div>
      <label class="check f s12"><input type="checkbox" name="entregaIgual" id="entIgual" ${v.entregaIgual ? 'checked' : ''}> Mesmo endereço da nota fiscal</label>
      <div class="sub-grid ${v.entregaIgual ? 'hidden' : ''}" id="entCampos">${enderecoCampos('entrega', v.entrega)}</div>
      <div class="section-title">Outros</div>
      <div class="f s12"><label>Observações</label><textarea name="obs">${esc(v.obs)}</textarea></div>
      <label class="check f s12"><input type="checkbox" name="consentimento" ${v.consentimento ? 'checked' : ''}> O cliente autorizou o uso dos dados dele para pedidos, entrega e emissão de nota fiscal (LGPD).</label>
    </form>`,
    actions: `<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="fCliSave">Salvar</button>`,
    onOpen(m, close) {
      const f = $('#fCli', m);
      $('#tpPessoa', m).onchange = e => { const pj = e.target.value === 'PJ'; $('#docLbl', m).textContent = pj ? 'CNPJ' : 'CPF'; $$('.pj', m).forEach(x => x.classList.toggle('hidden', !pj)); };
      $('#entIgual', m).onchange = e => $('#entCampos', m).classList.toggle('hidden', e.target.checked);
      $('#docInp', m).onblur = e => { const d = e.target.value.replace(/\D/g, ''); $('#docMsg', m).textContent = d && !docValido(d) ? 'Confira o número: parece inválido.' : ''; if (d.length === 11) e.target.value = d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'); if (d.length === 14) e.target.value = d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'); };
      $$('[data-buscacep]', m).forEach(b => b.onclick = () => buscaCep(m, b.dataset.buscacep));
      $('#fCliSave', m).onclick = async () => {
        const o = formData(f);
        if (!o.nome) { toast('Informe o nome do cliente.', 'err'); return; }
        const obj = {
          ...(c || {}), nome: o.nome, telefone: o.telefone, email: o.email, redeSocial: o.redeSocial,
          tipoPessoa: o.tipoPessoa, documento: o.documento, razaoSocial: o.razaoSocial || '', ie: o.ie || '',
          endereco: pick(o, 'endereco'), entregaIgual: o.entregaIgual, entrega: o.entregaIgual ? {} : pick(o, 'entrega'),
          obs: o.obs, consentimento: o.consentimento,
          consentimentoData: o.consentimento ? (c?.consentimentoData || today()) : ''
        };
        const id = await store.save('clientes', obj);
        toast('Cliente salvo.'); close();
        onSaved ? onSaved(id) : (!c && go('clientes/' + id));
      };
    }
  });
}
function pick(o, pref) {
  const r = {};
  Object.keys(o).filter(k => k.startsWith(pref + '.')).forEach(k => { r[k.slice(pref.length + 1)] = o[k]; });
  return r;
}
async function buscaCep(m, pref) {
  const cep = $(`[name="${pref}.cep"]`, m).value.replace(/\D/g, '');
  if (cep.length !== 8) { toast('Digite um CEP com 8 números.', 'err'); return; }
  try {
    const r = await (await fetch(`https://viacep.com.br/ws/${cep}/json/`)).json();
    if (r.erro) throw 0;
    const set = (k, v) => { const i = $(`[name="${pref}.${k}"]`, m); if (i && v) i.value = v; };
    set('rua', r.logradouro); set('bairro', r.bairro); set('cidade', r.localidade); set('uf', r.uf);
    $(`[name="${pref}.numero"]`, m).focus();
  } catch { toast('CEP não encontrado.', 'err'); }
}
function docValido(d) {
  const calc = (s, w) => { const r = s.split('').reduce((a, n, i) => a + n * w[i], 0) % 11; return r < 2 ? 0 : 11 - r; };
  if (/^(\d)\1+$/.test(d)) return false;
  if (d.length === 11) {
    const v1 = calc(d.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]), v2 = calc(d.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    return v1 == d[9] && v2 == d[10];
  }
  if (d.length === 14) {
    const v1 = calc(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]), v2 = calc(d.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    return v1 == d[12] && v2 == d[13];
  }
  return false;
}

// ── Formulário de pedido ─────────────────────────────────────────
export function pedidoForm(p = null, defaults = {}) {
  const v = { data: today(), quantidade: 1, status: 'pendente', etapa: 'producao', parcelas: 1, forma: 'Pix', ...defaults, ...(p || {}) };
  const clientes = [...store.data.clientes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const pecas = store.data.pecas;
  modal({
    title: p ? 'Editar pedido' : 'Novo pedido', size: 'lg',
    body: `<form class="form-grid" id="fPed" novalidate>
      <div class="f s8"><label>Cliente *</label><select name="clienteId">${options(clientes.map(c => [c.id, c.nome]), v.clienteId, { empty: 'Selecione…' })}</select></div>
      <div class="f s4"><label>Data do pedido</label><input type="date" name="data" value="${esc(v.data)}"></div>
      <div class="f s8"><label>Descrição (o que foi vendido) *</label><input name="descricao" value="${esc(v.descricao)}" placeholder="Ex.: Ursinho 25 cm personalizado"></div>
      <div class="f s4"><label>Peça da precificação</label><select name="pecaId" id="pPeca">${options(pecas.map(x => [x.id, x.nome]), v.pecaId, { empty: 'Nenhuma' })}</select></div>
      <div class="f s3"><label>Quantidade</label><input name="quantidade" data-num inputmode="numeric" value="${esc(v.quantidade)}"></div>
      <div class="f s3"><label>Valor total (R$) *</label><input name="valor" data-num inputmode="decimal" value="${v.valor ? String(v.valor).replace('.', ',') : ''}" id="pValor"></div>
      <div class="f s6"><label>Etapa</label><select name="etapa">${options(ETAPAS, v.etapa)}</select></div>
      <div class="section-title">Pagamento</div>
      <div class="f s3"><label>Status</label><select name="status" id="pStatus">${options([['pendente', 'Pendente'], ['pago', 'Pago']], v.status)}</select></div>
      <div class="f s3"><label>Data do pagamento</label><input type="date" name="dataPagamento" value="${esc(v.dataPagamento || '')}" id="pDataPag"></div>
      <div class="f s3"><label>Forma de pagamento</label><select name="forma">${options(FORMAS, v.forma)}</select></div>
      <div class="f s3"><label>Parcelas</label><input name="parcelas" data-num inputmode="numeric" value="${esc(v.parcelas)}"></div>
      <div class="f s12"><label>Observações</label><textarea name="obs">${esc(v.obs)}</textarea></div>
      <p class="f s12 small muted">Ao marcar como <b>pago</b>, o valor entra automaticamente no caixa da aba Empresa (entrada, lucro do mês e reserva para a conta pessoal).</p>
    </form>`,
    actions: `<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="fPedSave">Salvar pedido</button>`,
    onOpen(m, close) {
      $('#pPeca', m).onchange = e => {
        const pc = store.get('pecas', e.target.value);
        if (!pc) return;
        const q = Number($('[name=quantidade]', m).value) || 1;
        $('#pValor', m).value = (calcPreco(pc).preco * q).toFixed(2).replace('.', ',');
        const d = $('[name=descricao]', m); if (!d.value) d.value = pc.nome;
      };
      $('#pStatus', m).onchange = e => { if (e.target.value === 'pago' && !$('#pDataPag', m).value) $('#pDataPag', m).value = today(); };
      $('#fPedSave', m).onclick = async () => {
        const o = formData($('#fPed', m));
        if (!o.clienteId) { toast('Escolha o cliente.', 'err'); return; }
        if (!o.descricao) { toast('Descreva o pedido.', 'err'); return; }
        if (!(o.valor > 0)) { toast('Informe o valor.', 'err'); return; }
        if (o.status === 'pago' && !o.dataPagamento) o.dataPagamento = today();
        if (o.status !== 'pago') o.dataPagamento = '';
        o.parcelas = Math.max(1, Math.round(o.parcelas || 1));
        o.quantidade = Math.max(1, o.quantidade || 1);
        await salvarPedido({ ...(p || {}), ...o });
        if (o.pecaId) { const pc = store.get('pecas', o.pecaId); if (pc && !pc.clienteId) await store.save('pecas', { ...pc, clienteId: o.clienteId }); }
        toast(o.status === 'pago' ? 'Pedido salvo e entrada lançada no caixa.' : 'Pedido salvo.');
        close();
      };
    }
  });
}

function pagamentoForm(p) {
  modal({
    title: 'Registrar pagamento',
    body: `<form class="form-grid" id="fPag">
      <p class="f s12">${esc(p.descricao)} — <b>${money(p.valor)}</b></p>
      <div class="f s6"><label>Data do pagamento</label><input type="date" name="dataPagamento" value="${today()}"></div>
      <div class="f s6"><label>Forma</label><select name="forma">${options(FORMAS, p.forma)}</select></div>
      <div class="f s6"><label>Parcelas</label><input name="parcelas" data-num inputmode="numeric" value="${esc(p.parcelas || 1)}"></div>
    </form>`,
    actions: `<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="fPagOk">${icon('check', 18)} Confirmar pagamento</button>`,
    onOpen(m, close) {
      $('#fPagOk', m).onclick = async () => {
        const o = formData($('#fPag', m));
        await salvarPedido({ ...p, ...o, parcelas: Math.max(1, Math.round(o.parcelas || 1)), status: 'pago' });
        toast('Pagamento registrado. Caixa atualizado.'); close();
      };
    }
  });
}

// ── Resumo para o emissor de nota fiscal ─────────────────────────
export function nfTexto(pedidoId) {
  const p = store.get('pedidos', pedidoId);
  const c = store.get('clientes', p.clienteId) || {};
  const pj = c.tipoPessoa === 'PJ';
  return [
    'RESUMO PARA EMISSÃO DE NOTA FISCAL — LEORI',
    '(Este resumo não é uma nota fiscal. Use os dados no emissor oficial.)',
    '',
    'TOMADOR / DESTINATÁRIO',
    `Nome: ${pj && c.razaoSocial ? c.razaoSocial : c.nome || ''}`,
    `${pj ? 'CNPJ' : 'CPF'}: ${c.documento || '(não informado)'}`,
    pj && c.ie ? `Inscrição estadual: ${c.ie}` : '',
    `Endereço: ${enderecoTexto(c.endereco) || '(não informado)'}`,
    `E-mail: ${c.email || '—'}`,
    `Telefone: ${c.telefone || '—'}`,
    '',
    'ITEM',
    `Descrição: ${p.descricao}`,
    `Quantidade: ${p.quantidade || 1}`,
    `Valor unitário: ${money((p.valor || 0) / (p.quantidade || 1))}`,
    `Valor total: ${money(p.valor)}`,
    '',
    'PAGAMENTO',
    `Situação: ${p.status === 'pago' ? 'Pago em ' + fmtDate(p.dataPagamento) : 'Pendente'}`,
    `Forma: ${p.forma || '—'}${p.parcelas > 1 ? ` em ${p.parcelas}x` : ''}`,
    `Data do pedido: ${fmtDate(p.data)}`,
    '',
    'ENTREGA',
    enderecoTexto(c.entregaIgual ? c.endereco : c.entrega) || '(não informado)'
  ].filter(l => l !== '').join('\n').replace(/\n(TOMADOR|ITEM|PAGAMENTO|ENTREGA)/g, '\n\n$1');
}

export function nfResumo(pedidoId) {
  const txt = nfTexto(pedidoId);
  const c = store.get('clientes', store.get('pedidos', pedidoId)?.clienteId);
  const faltando = [!c?.documento && 'CPF/CNPJ', !c?.endereco?.rua && 'endereço'].filter(Boolean);
  modal({
    title: 'Resumo para nota fiscal', size: 'lg',
    body: `${faltando.length ? `<div class="alert mb">${icon('alert', 18)} Falta no cadastro do cliente: ${faltando.join(' e ')}.</div>` : ''}<div class="nf-box">${esc(txt)}</div>`,
    actions: `<button class="btn btn-ghost" data-close>Fechar</button><button class="btn btn-ghost" id="nfPdf">${icon('download', 18)} PDF</button><button class="btn btn-primary" id="nfCopy">${icon('copy', 18)} Copiar texto</button>`,
    onOpen(m) {
      $('#nfCopy', m).onclick = async () => { try { await navigator.clipboard.writeText(txt); toast('Resumo copiado.'); } catch { toast('Não foi possível copiar.', 'err'); } };
      $('#nfPdf', m).onclick = () => pdfNF(pedidoId, txt);
    }
  });
}
