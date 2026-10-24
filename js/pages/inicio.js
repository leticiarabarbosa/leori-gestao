// Página inicial: resumo do período, gráficos de receita e lucro, metas, agenda e tarefas
import * as store from '../store.js';
import { $, $$, esc, icon, money, num, fmtDate, today, modal, confirmDialog, toast, formData, options, periodRange, periodLabel, periodShift, periodMonths, inRange, sum, MESES_CURTOS, emptyState, parseDate } from '../utils.js';
import { resumoFinanceiro, caixaAte, aReceber, materiaisParaRepor, statusMaterial } from '../logic.js';
import { chart, destroyCharts, chartColors } from '../charts.js';
import { pdfResumo } from '../export.js';
import { go } from '../app.js';

const now = new Date();
let periodo = { tipo: 'mes', ano: now.getFullYear(), mes: now.getMonth(), sem: now.getMonth() < 6 ? 0 : 1 };

export default {
  render(el) {
    destroyCharts();
    const range = periodRange(periodo);
    const r = resumoFinanceiro(range);
    const caixa = caixaAte(range[1] < new Date() ? range[1] : new Date());
    const rec = aReceber();
    const pedidosPer = store.data.pedidos.filter(p => inRange(p.data, range));
    const repor = materiaisParaRepor();
    const hoje = today();
    const agenda = store.data.agenda.filter(a => a.data >= hoje).sort((a, b) => (a.data + (a.hora || '')).localeCompare(b.data + (b.hora || ''))).slice(0, 6);
    const tarefas = [...store.data.tarefas].sort((a, b) => (a.feita - b.feita) || String(a.prazo || '9').localeCompare(String(b.prazo || '9')));
    const pend = tarefas.filter(t => !t.feita);
    const ola = now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite';

    el.innerHTML = `
      <div class="page-head">
        <div><h1>${ola}!</h1><p>Resumo do ateliê Leori · ${periodLabel(periodo)}</p></div>
        <div class="page-actions"><button class="btn btn-ghost" id="iPdf">${icon('file', 18)} PDF do período</button></div>
      </div>
      <div class="row between mb">
        <div class="seg" id="iTipo">${[['mes', 'Mensal'], ['semestre', 'Semestral'], ['ano', 'Anual']].map(([k, l]) => `<button data-k="${k}" class="${periodo.tipo === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="period"><button class="icon-btn" id="iPrev" aria-label="Período anterior">${icon('chevL')}</button><span class="lbl">${periodLabel(periodo)}</span><button class="icon-btn" id="iNext" aria-label="Próximo período">${icon('chevR')}</button></div>
      </div>
      <div class="stats mb">
        <div class="card stat hl"><div class="lbl">${icon('wallet', 16)} Caixa</div><div class="val">${money(caixa)}</div><div class="hint">Saldo da empresa</div></div>
        <div class="card stat"><div class="lbl">Receita</div><div class="val">${money(r.entradas)}</div><div class="hint">${pedidosPer.length} pedido(s) no período</div></div>
        <div class="card stat"><div class="lbl">Despesas</div><div class="val">${money(r.saidas)}</div></div>
        <div class="card stat"><div class="lbl">Impostos pagos</div><div class="val">${money(r.impostos)}</div></div>
        <div class="card stat ${r.lucro < 0 ? 'neg' : ''}"><div class="lbl">Lucro</div><div class="val">${money(r.lucro)}</div><div class="hint">Conta pessoal: ${money(r.reserva)}</div></div>
        <div class="card stat"><div class="lbl">A receber</div><div class="val">${money(rec.total)}</div><div class="hint">${rec.qtd} pedido(s) pendente(s)</div></div>
      </div>
      <div class="grid g-2-1 mb">
        <div class="card"><div class="card-head"><h3>${icon('trend', 18)} Receita e lucro por mês</h3></div><div class="card-body"><div class="chart-box"><canvas id="iChart"></canvas></div></div></div>
        <div class="card"><div class="card-head"><h3>Despesas por categoria</h3></div><div class="card-body">${r.saidas > 0 ? '<div class="chart-box"><canvas id="iPie"></canvas></div>' : emptyState('Sem despesas no período.')}</div></div>
      </div>
      <div class="grid g3 mb">
        <div class="card">
          <div class="card-head"><h3>${icon('target', 18)} Metas</h3><button class="btn btn-sm btn-soft" id="iMeta">${icon('plus', 16)} Meta</button></div>
          <div class="card-body">${metasHtml(range, r, pedidosPer)}</div>
        </div>
        <div class="card">
          <div class="card-head"><h3>${icon('calendar', 18)} Agenda</h3><button class="btn btn-sm btn-soft" id="iAg">${icon('plus', 16)} Compromisso</button></div>
          <div class="card-body">${agenda.length ? `<ul class="list">${agenda.map(a => `<li data-ag="${a.id}"><div class="badge pri" style="min-width:58px;justify-content:center">${fmtDate(a.data).slice(0, 5)}</div><div class="grow"><span>${esc(a.titulo)}</span><div class="meta">${a.hora ? esc(a.hora) + ' · ' : ''}${esc(a.obs || '')}</div></div><button class="icon-btn" data-edit title="Editar">${icon('edit', 16)}</button></li>`).join('')}</ul>` : emptyState('Nenhum compromisso futuro.')}</div>
        </div>
        <div class="card">
          <div class="card-head"><h3>${icon('check', 18)} Tarefas pendentes <span class="badge">${pend.length}</span></h3></div>
          <div class="card-body">
            <form class="row" id="iTarForm" style="flex-wrap:nowrap"><input class="input grow" id="iTarTxt" placeholder="Nova tarefa…" aria-label="Nova tarefa"><button class="btn btn-primary btn-sm" aria-label="Adicionar tarefa">${icon('plus', 16)}</button></form>
            ${tarefas.length ? `<ul class="list mt-s">${tarefas.slice(0, 12).map(t => `<li class="${t.feita ? 'task-done' : ''}" data-tar="${t.id}"><label class="check grow"><input type="checkbox" ${t.feita ? 'checked' : ''}><span>${esc(t.texto)}</span></label>${t.prazo ? `<span class="badge ${!t.feita && t.prazo < hoje ? 'danger' : ''}">${fmtDate(t.prazo).slice(0, 5)}</span>` : ''}<button class="icon-btn" data-edit title="Editar">${icon('edit', 16)}</button><button class="icon-btn danger" data-del title="Excluir">${icon('trash', 16)}</button></li>`).join('')}</ul>` : '<p class="small muted mt">Nada pendente por aqui.</p>'}
          </div>
        </div>
      </div>
      <div class="grid g2">
        <div class="card"><div class="card-head"><h3>${icon('list', 18)} Pagamentos pendentes</h3><a class="small" href="#/clientes">Ver clientes</a></div>
          ${rec.lista.length ? `<ul class="list card-body">${rec.lista.sort((a, b) => String(a.data).localeCompare(String(b.data))).slice(0, 6).map(p => `<li><div class="grow"><span>${esc(store.get('clientes', p.clienteId)?.nome || 'Sem cliente')}</span><div class="meta">${esc(p.descricao)} · ${fmtDate(p.data)}</div></div><b class="num">${money(p.valor)}</b></li>`).join('')}</ul>` : `<div class="card-body">${emptyState('Nenhum pagamento pendente.')}</div>`}
        </div>
        <div class="card"><div class="card-head"><h3>${icon('box', 18)} Estoque para repor</h3><a class="small" href="#/estoque">Ver estoque</a></div>
          ${repor.length ? `<ul class="list card-body">${repor.slice(0, 6).map(m => { const st = statusMaterial(m); return `<li><span class="grow">${esc(m.nome)}</span><span class="small muted num">${num(m.quantidade, 2)} / mín. ${num(m.minimo, 2)} ${esc(m.unidade)}</span><span class="badge ${st.cls}">${st.label}</span></li>`; }).join('')}</ul>` : `<div class="card-body">${emptyState('Estoque em ordem.')}</div>`}
        </div>
      </div>`;

    // Gráfico receita × lucro
    const c = chartColors();
    const meses = periodMonths(periodo);
    const serie = meses.map(({ ano, mes }) => resumoFinanceiro([new Date(ano, mes, 1), new Date(ano, mes + 1, 0, 23, 59, 59)]));
    chart($('#iChart'), {
      type: 'bar',
      data: { labels: meses.map(m => `${MESES_CURTOS[m.mes]}${periodo.tipo === 'mes' || meses[0].ano !== meses[meses.length - 1].ano ? '/' + String(m.ano).slice(2) : ''}`),
        datasets: [
          { type: 'bar', label: 'Receita', data: serie.map(s => s.entradas), backgroundColor: meses.map(m => periodo.tipo === 'mes' && m.mes !== periodo.mes ? c.primarySoft : c.primary), borderRadius: 6, order: 2 },
          { type: 'line', label: 'Lucro', data: serie.map(s => s.lucro), borderColor: c.text, backgroundColor: c.text, tension: .3, pointRadius: 3, order: 1 }
        ] }
    });
    if (r.saidas > 0) {
      const cats = {};
      r.lista.filter(l => l.tipo === 'saida').forEach(l => { cats[l.categoria || 'Outros'] = (cats[l.categoria || 'Outros'] || 0) + l.valor; });
      const ent = Object.entries(cats).sort((a, b) => b[1] - a[1]);
      chart($('#iPie'), { type: 'doughnut', data: { labels: ent.map(e => e[0]), datasets: [{ data: ent.map(e => e[1]), backgroundColor: c.series, borderWidth: 2, borderColor: getComputedStyle(document.body).getPropertyValue('--card') }] }, options: { cutout: '62%', interaction: { mode: 'nearest' } } });
    }

    // Ações
    const re = () => this.render(el);
    $$('#iTipo button').forEach(b => b.onclick = () => { periodo.tipo = b.dataset.k; re(); });
    $('#iPrev').onclick = () => { periodo = periodShift(periodo, -1); re(); };
    $('#iNext').onclick = () => { periodo = periodShift(periodo, 1); re(); };
    $('#iPdf').onclick = () => pdfResumo(periodo);
    $('#iMeta').onclick = () => metaForm();
    $$('[data-meta]').forEach(li => li.querySelector('[data-edit]').onclick = () => metaForm(store.get('metas', li.dataset.meta)));
    $('#iAg').onclick = () => agendaForm();
    $$('[data-ag]').forEach(li => li.querySelector('[data-edit]').onclick = () => agendaForm(store.get('agenda', li.dataset.ag)));
    $('#iTarForm').onsubmit = async e => {
      e.preventDefault();
      const txt = $('#iTarTxt').value.trim();
      if (!txt) return;
      await store.save('tarefas', { texto: txt, feita: false, prazo: '' });
    };
    $$('[data-tar]').forEach(li => {
      const t = store.get('tarefas', li.dataset.tar);
      li.querySelector('input').onchange = e => store.save('tarefas', { ...t, feita: e.target.checked });
      li.querySelector('[data-del]').onclick = () => store.remove('tarefas', t.id);
      li.querySelector('[data-edit]').onclick = () => tarefaForm(t);
    });
  },
  destroy: destroyCharts
};

function metasHtml(range, r, pedidosPer) {
  const metas = store.data.metas;
  if (!metas.length) return emptyState('Defina metas de receita, lucro ou número de pedidos.');
  return `<ul class="list">${metas.map(m => {
    const atual = m.tipo === 'receita' ? r.entradas : m.tipo === 'lucro' ? r.lucro : m.tipo === 'pedidos' ? pedidosPer.length : Number(m.atual) || 0;
    const pct = m.alvo > 0 ? Math.max(0, Math.min(100, atual / m.alvo * 100)) : 0;
    const fmt = v => m.tipo === 'pedidos' || m.tipo === 'manual' ? num(v, 2) : money(v);
    return `<li data-meta="${m.id}" style="flex-direction:column;align-items:stretch;gap:6px">
      <div class="row between"><b>${esc(m.titulo)}</b><button class="icon-btn" data-edit title="Editar">${icon('edit', 16)}</button></div>
      <div class="progress"><i style="width:${pct}%"></i></div>
      <div class="row between small muted"><span>${fmt(atual)} de ${fmt(m.alvo)}</span><span>${Math.round(pct)}%${m.tipo !== 'manual' ? ' no período' : ''}</span></div>
    </li>`;
  }).join('')}</ul>`;
}

function metaForm(m = null) {
  const v = { tipo: 'receita', ...(m || {}) };
  modal({
    title: m ? 'Editar meta' : 'Nova meta',
    body: `<form class="form-grid" id="fMeta">
      <div class="f s12"><label>Meta *</label><input name="titulo" value="${esc(v.titulo)}" placeholder="Ex.: Faturar R$ 3.000 no mês"></div>
      <div class="f s6"><label>Medir por</label><select name="tipo" id="mTipo">${options([['receita', 'Receita do período'], ['lucro', 'Lucro do período'], ['pedidos', 'Nº de pedidos no período'], ['manual', 'Valor manual']], v.tipo)}</select></div>
      <div class="f s6"><label>Alvo</label><input name="alvo" data-num inputmode="decimal" value="${v.alvo ? num(v.alvo, 2) : ''}"></div>
      <div class="f s6 ${v.tipo === 'manual' ? '' : 'hidden'}" id="mAtualBox"><label>Valor atual</label><input name="atual" data-num inputmode="decimal" value="${v.atual ? num(v.atual, 2) : ''}"></div>
    </form>`,
    actions: `${m ? '<button class="btn btn-ghost" id="fMetaDel" style="color:var(--danger);margin-right:auto">Excluir</button>' : ''}<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="fMetaSave">Salvar</button>`,
    onOpen(md, close) {
      $('#mTipo', md).onchange = e => $('#mAtualBox', md).classList.toggle('hidden', e.target.value !== 'manual');
      $('#fMetaSave', md).onclick = async () => { const o = formData($('#fMeta', md)); if (!o.titulo) { toast('Dê um nome à meta.', 'err'); return; } await store.save('metas', { ...(m || {}), ...o }); toast('Meta salva.'); close(); };
      $('#fMetaDel', md)?.addEventListener('click', async () => { await store.remove('metas', m.id); close(); });
    }
  });
}

function agendaForm(a = null) {
  const v = { data: today(), ...(a || {}) };
  modal({
    title: a ? 'Editar compromisso' : 'Novo compromisso',
    body: `<form class="form-grid" id="fAg">
      <div class="f s12"><label>Compromisso *</label><input name="titulo" value="${esc(v.titulo)}" placeholder="Ex.: Entregar pedido da Ana, feira de artesanato…"></div>
      <div class="f s6"><label>Data</label><input type="date" name="data" value="${esc(v.data)}"></div>
      <div class="f s6"><label>Hora</label><input type="time" name="hora" value="${esc(v.hora)}"></div>
      <div class="f s12"><label>Observação</label><input name="obs" value="${esc(v.obs)}"></div>
    </form>`,
    actions: `${a ? '<button class="btn btn-ghost" id="fAgDel" style="color:var(--danger);margin-right:auto">Excluir</button>' : ''}<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="fAgSave">Salvar</button>`,
    onOpen(md, close) {
      $('#fAgSave', md).onclick = async () => { const o = formData($('#fAg', md)); if (!o.titulo || !o.data) { toast('Informe o compromisso e a data.', 'err'); return; } await store.save('agenda', { ...(a || {}), ...o }); toast('Compromisso salvo.'); close(); };
      $('#fAgDel', md)?.addEventListener('click', async () => { await store.remove('agenda', a.id); close(); });
    }
  });
}

function tarefaForm(t) {
  modal({
    title: 'Editar tarefa',
    body: `<form class="form-grid" id="fTar"><div class="f s12"><label>Tarefa</label><input name="texto" value="${esc(t.texto)}"></div><div class="f s6"><label>Prazo</label><input type="date" name="prazo" value="${esc(t.prazo)}"></div></form>`,
    actions: `<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="fTarSave">Salvar</button>`,
    onOpen(md, close) { $('#fTarSave', md).onclick = async () => { await store.save('tarefas', { ...t, ...formData($('#fTar', md)) }); close(); }; }
  });
}
