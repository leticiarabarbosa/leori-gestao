// Empresa: entradas, saídas, impostos pagos, caixa e valor para a conta pessoal
import * as store from '../store.js';
import { $, $$, esc, icon, money, fmtDate, today, modal, confirmDialog, toast, formData, options, periodRange, periodLabel, periodShift, byDateDesc, emptyState } from '../utils.js';
import { FORMAS, TIPOS_LANC, resumoFinanceiro, caixaAte } from '../logic.js';
import { pedidoForm } from './clientes.js';
import { exportCSV } from '../export.js';

const now = new Date();
let periodo = { tipo: 'mes', ano: now.getFullYear(), mes: now.getMonth(), sem: now.getMonth() < 6 ? 0 : 1 };
let aba = 'todos';

export default {
  render(el) {
    const range = periodRange(periodo);
    const r = resumoFinanceiro(range);
    const caixa = caixaAte(range[1] < new Date() ? range[1] : new Date());
    const perc = Number(store.settings.percPessoal) || 0;
    el.innerHTML = `
      <div class="page-head">
        <div><h1>Empresa</h1><p>Caixa, entradas, saídas, impostos e lucro</p></div>
        <div class="page-actions">
          <button class="btn btn-ghost" id="eExp">${icon('download', 18)} Planilha</button>
          <button class="btn btn-ghost" data-novo="saida">${icon('minus', 18)} Saída</button>
          <button class="btn btn-ghost" data-novo="imposto">${icon('file', 18)} Imposto pago</button>
          <button class="btn btn-primary" data-novo="entrada">${icon('plus', 18)} Entrada</button>
        </div>
      </div>
      <div class="row between mb">
        <div class="seg" id="eTipo">${[['mes', 'Mensal'], ['semestre', 'Semestral'], ['ano', 'Anual']].map(([k, l]) => `<button data-k="${k}" class="${periodo.tipo === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="period"><button class="icon-btn" id="ePrev" aria-label="Período anterior">${icon('chevL')}</button><span class="lbl">${periodLabel(periodo)}</span><button class="icon-btn" id="eNext" aria-label="Próximo período">${icon('chevR')}</button></div>
      </div>
      <div class="stats mb">
        <div class="card stat hl"><div class="lbl">${icon('wallet', 16)} Caixa da empresa</div><div class="val">${money(caixa)}</div><div class="hint">Saldo em ${range[1] < new Date() ? 'fim do período' : 'hoje'}</div></div>
        <div class="card stat"><div class="lbl">Entradas</div><div class="val">${money(r.entradas)}</div></div>
        <div class="card stat"><div class="lbl">Saídas</div><div class="val">${money(r.saidas)}</div></div>
        <div class="card stat"><div class="lbl">Impostos pagos</div><div class="val">${money(r.impostos)}</div><div class="hint">Lançados manualmente</div></div>
        <div class="card stat ${r.lucro < 0 ? 'neg' : ''}"><div class="lbl">Lucro do período</div><div class="val">${money(r.lucro)}</div><div class="hint">Entradas − saídas − impostos</div></div>
      </div>
      <div class="card card-pad mb">
        <div class="row between">
          <div>
            <div class="strong">${icon('trend', 18)} Para a conta pessoal</div>
            <p class="small muted">${perc}% do lucro do período vai para a conta pessoal (ajuste em Configurações).</p>
          </div>
          <button class="btn btn-soft" data-novo="retirada" ${r.aTransferir <= 0 ? '' : ''}>${icon('check', 18)} Registrar transferência</button>
        </div>
        <div class="grid g3 mt">
          <div><div class="small muted">Valor reservado</div><div class="strong num" style="font-size:20px">${money(r.reserva)}</div></div>
          <div><div class="small muted">Já transferido</div><div class="strong num" style="font-size:20px">${money(r.retiradas)}</div></div>
          <div><div class="small muted">Falta transferir</div><div class="strong num" style="font-size:20px">${money(r.aTransferir)}</div></div>
        </div>
        ${r.reserva > 0 ? `<div class="progress mt"><i style="width:${Math.min(100, r.retiradas / r.reserva * 100)}%"></i></div>` : ''}
      </div>
      <div class="card">
        <div class="card-head">
          <div class="tabs" style="margin:0;border:0" id="eAbas">${[['todos', 'Todos'], ...Object.entries(TIPOS_LANC).map(([k, v]) => [k, k === 'retirada' ? 'Transferências' : k === 'imposto' ? 'Impostos' : v + 's'])].map(([k, l]) => `<button data-k="${k}" class="${aba === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        </div>
        <div id="eLista"></div>
      </div>`;

    const lista = r.lista.filter(l => aba === 'todos' || l.tipo === aba).sort(byDateDesc());
    $('#eLista').innerHTML = lista.length ? `<div class="table-wrap"><table class="tbl resp">
      <thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th>Categoria</th><th>Forma</th><th class="right">Valor</th><th></th></tr></thead>
      <tbody>${lista.map(l => `<tr data-id="${l.id}">
        <td class="first">${fmtDate(l.data)}</td>
        <td data-label="Descrição">${esc(l.descricao || '—')}${l.auto ? ' <span class="badge pri" title="Gerado pelo pagamento do pedido">pedido</span>' : ''}</td>
        <td data-label="Tipo"><span class="badge ${l.tipo === 'entrada' ? 'ok' : l.tipo === 'imposto' ? 'warn' : ''}">${esc(TIPOS_LANC[l.tipo])}</span></td>
        <td data-label="Categoria">${esc(l.categoria || '—')}</td>
        <td data-label="Forma">${esc(l.forma || '—')}${l.parcelas > 1 ? ` · ${l.parcelas}x` : ''}</td>
        <td data-label="Valor" class="right num strong" style="color:${l.tipo === 'entrada' ? 'var(--ok)' : 'inherit'}">${l.tipo === 'entrada' ? '+' : '−'} ${money(l.valor)}</td>
        <td class="acts"><button class="icon-btn" data-edit title="Editar">${icon('edit', 18)}</button><button class="icon-btn danger" data-del title="Excluir">${icon('trash', 18)}</button></td>
      </tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="5" class="foot-label">Saldo da lista</td><td class="right num" data-label="Saldo da lista">${money(lista.reduce((s, l) => s + (l.tipo === 'entrada' ? l.valor : -l.valor), 0))}</td><td></td></tr></tfoot>
    </table></div>` : emptyState('Nenhum lançamento neste período.');

    $$('#eTipo button').forEach(b => b.onclick = () => { periodo.tipo = b.dataset.k; this.render(el); });
    $('#ePrev').onclick = () => { periodo = periodShift(periodo, -1); this.render(el); };
    $('#eNext').onclick = () => { periodo = periodShift(periodo, 1); this.render(el); };
    $$('#eAbas button').forEach(b => b.onclick = () => { aba = b.dataset.k; this.render(el); });
    $$('[data-novo]').forEach(b => b.onclick = () => lancForm(null, b.dataset.novo, b.dataset.novo === 'retirada' ? r.aTransferir : 0));
    $('#eExp').onclick = () => exportCSV('lancamentos');
    $$('#eLista tr[data-id]').forEach(tr => {
      const l = store.get('lancamentos', tr.dataset.id);
      tr.querySelector('[data-edit]').onclick = () => {
        if (l.auto && l.pedidoId && store.get('pedidos', l.pedidoId)) { toast('Esta entrada vem de um pedido: edite o pedido.'); pedidoForm(store.get('pedidos', l.pedidoId)); }
        else lancForm(l);
      };
      tr.querySelector('[data-del]').onclick = async () => {
        if (l.auto && store.get('pedidos', l.pedidoId)) {
          if (!await confirmDialog('Esta entrada foi gerada por um pedido pago. Excluir vai marcar o pedido como pendente. Continuar?', { ok: 'Marcar pendente', danger: true })) return;
          const { salvarPedido } = await import('../logic.js');
          await salvarPedido({ ...store.get('pedidos', l.pedidoId), status: 'pendente', dataPagamento: '' });
        } else {
          if (!await confirmDialog('Excluir este lançamento?', { ok: 'Excluir', danger: true })) return;
          await store.remove('lancamentos', l.id);
        }
        toast('Lançamento removido.');
      };
    });
  }
};

export function lancForm(l = null, tipo = 'entrada', valorSugerido = 0) {
  const v = { tipo, data: today(), valor: valorSugerido || '', forma: 'Pix', ...(l || {}) };
  const cats = t => t === 'entrada' ? store.settings.categoriasEntrada : t === 'saida' ? store.settings.categoriasSaida : t === 'imposto' ? ['DAS (MEI/Simples)', 'ISS', 'ICMS', 'INSS', 'Outros impostos'] : ['Conta pessoal'];
  const titulo = { entrada: 'entrada', saida: 'saída', imposto: 'imposto pago', retirada: 'transferência para conta pessoal' };
  modal({
    title: (l ? 'Editar ' : 'Nova ') + titulo[v.tipo],
    body: `<form class="form-grid" id="fLanc">
      <div class="f s6"><label>Tipo</label><select name="tipo" id="lTipo">${options(Object.entries(TIPOS_LANC), v.tipo)}</select></div>
      <div class="f s6"><label>Data</label><input type="date" name="data" value="${esc(v.data)}"></div>
      <div class="f s12"><label>Descrição</label><input name="descricao" value="${esc(v.descricao)}" placeholder="${v.tipo === 'imposto' ? 'Ex.: DAS de outubro' : v.tipo === 'saida' ? 'Ex.: Compra de fios' : ''}"></div>
      <div class="f s6"><label>Categoria</label><select name="categoria" id="lCat">${options(cats(v.tipo), v.categoria)}</select></div>
      <div class="f s6"><label>Valor (R$) *</label><input name="valor" data-num inputmode="decimal" value="${v.valor ? String(v.valor).replace('.', ',') : ''}"></div>
      <div class="f s6"><label>Forma</label><select name="forma">${options(FORMAS, v.forma)}</select></div>
      <div class="f s12"><label>Observações</label><textarea name="obs">${esc(v.obs)}</textarea></div>
      ${v.tipo === 'imposto' ? '<p class="f s12 small muted">O sistema não calcula impostos: registre aqui o valor que você pagou.</p>' : ''}
    </form>`,
    actions: `<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="fLancSave">Salvar</button>`,
    onOpen(m, close) {
      $('#lTipo', m).onchange = e => { $('#lCat', m).innerHTML = options(cats(e.target.value)); };
      $('#fLancSave', m).onclick = async () => {
        const o = formData($('#fLanc', m));
        if (!(o.valor > 0)) { toast('Informe o valor.', 'err'); return; }
        if (!o.descricao) o.descricao = o.categoria;
        await store.save('lancamentos', { ...(l || {}), ...o });
        toast('Lançamento salvo.'); close();
      };
    }
  });
}
