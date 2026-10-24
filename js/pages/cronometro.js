// Cronômetro de produção: cada sessão (início, fim, duração) fica registrada; o total vai para a peça e a precificação
import * as store from '../store.js';
import { $, $$, esc, icon, fmtDur, fmtDateTime, fmtDate, modal, confirmDialog, toast, formData, options, emptyState, parseDate, toYMD, money } from '../utils.js';
import { tempoPecaSeg, calcPreco } from '../logic.js';
import { novaPeca } from './precificacao.js';

let selPeca = '', selCli = '', tick = null;

const elapsedMs = t => !t ? 0 : (Number(t.acumuladoMs) || 0) + (t.status === 'running' && t.runStart ? Date.now() - new Date(t.runStart).getTime() : 0);

export default {
  render(el, [pecaParam]) {
    clearInterval(tick);
    const t = store.timer;
    if (t) { selPeca = t.pecaId; selCli = t.clienteId || ''; }
    else if (pecaParam && store.get('pecas', pecaParam)) { selPeca = pecaParam; selCli = store.get('pecas', pecaParam).clienteId || ''; }
    if (selPeca && !store.get('pecas', selPeca) && !t) selPeca = '';
    const clientes = [...store.data.clientes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const pecas = store.data.pecas.filter(p => !selCli || p.clienteId === selCli).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const peca = store.get('pecas', selPeca);
    const ativo = !!t;
    const st = t?.status;
    const sessoesPeca = store.data.sessoes.filter(s => s.pecaId === selPeca).sort((a, b) => String(b.inicio).localeCompare(String(a.inicio)));
    const recentes = [...store.data.sessoes].sort((a, b) => String(b.inicio).localeCompare(String(a.inicio))).slice(0, 10);

    el.innerHTML = `
      <div class="page-head">
        <div><h1>Cronômetro de produção</h1><p>Registre o tempo de cada sessão de trabalho</p></div>
        <div class="page-actions"><button class="btn btn-ghost" id="crNovaPeca">${icon('plus', 18)} Nova peça</button></div>
      </div>
      <div class="grid g-2-1 mb">
        <div class="card timer-card">
          <div class="form-grid" style="text-align:left;max-width:560px;margin:0 auto">
            <div class="f s6"><label>Cliente</label><select id="crCli" ${ativo ? 'disabled' : ''}>${options(clientes.map(c => [c.id, c.nome]), selCli, { empty: 'Todos os clientes' })}</select></div>
            <div class="f s6"><label>Peça em produção *</label><select id="crPeca" ${ativo ? 'disabled' : ''}>${options(pecas.map(p => [p.id, p.nome + (store.get('clientes', p.clienteId) && !selCli ? ' — ' + store.get('clientes', p.clienteId).nome : '')]), selPeca, { empty: pecas.length ? 'Selecione a peça…' : 'Cadastre uma peça' })}</select></div>
          </div>
          <div class="timer-display" id="crDisplay">${fmtDur(elapsedMs(t) / 1000, true)}</div>
          <div class="timer-state small muted">${st === 'running' ? '<span class="pulse"></span> Gravando sessão' : st === 'paused' ? `${icon('pause', 14)} Pausado` : 'Pronto para começar'}${t ? ` · início ${fmtDateTime(t.inicio).split(' ').pop()}` : ''}</div>
          <div class="timer-btns">
            ${!ativo ? `<button class="tbtn big" id="crPlay" ${selPeca ? '' : 'disabled'} aria-label="Iniciar">${icon('play', 34)}<span>Iniciar</span></button>` : ''}
            ${st === 'running' ? `<button class="tbtn big" id="crPause" aria-label="Pausar">${icon('pause', 32)}<span>Pausar</span></button>` : ''}
            ${st === 'paused' ? `<button class="tbtn big" id="crResume" aria-label="Continuar">${icon('play', 34)}<span>Continuar</span></button>` : ''}
            <button class="tbtn" id="crReset" ${ativo ? '' : 'disabled'} aria-label="Reiniciar">${icon('reset', 26)}<span>Reiniciar</span></button>
            <button class="tbtn" id="crStop" ${ativo ? '' : 'disabled'} aria-label="Parar e salvar">${icon('stop', 24)}<span>Parar</span></button>
          </div>
          <p class="small muted" style="margin-top:34px">Ao <b>parar</b>, a sessão é salva e o tempo total vai para a peça, o cliente e a precificação.</p>
        </div>
        <div class="card">
          <div class="card-head"><h3>${icon('yarn', 18)} ${peca ? esc(peca.nome) : 'Peça'}</h3>${peca ? `<a class="btn btn-sm btn-ghost" href="#/precificacao/${peca.id}">Precificação</a>` : ''}</div>
          <div class="card-body">${peca ? (() => {
            const total = tempoPecaSeg(peca.id), c = calcPreco(peca);
            return `<dl class="kv" style="grid-template-columns:130px 1fr">
              <dt>Cliente</dt><dd>${esc(store.get('clientes', peca.clienteId)?.nome || '—')}</dd>
              <dt>Tempo total</dt><dd class="strong">${fmtDur(total)}</dd>
              <dt>Sessões</dt><dd>${sessoesPeca.length}</dd>
              <dt>Mão de obra</dt><dd>${money(total / 3600 * (Number(peca.valorHora) || 0))} <span class="muted small">(${money(peca.valorHora)}/h)</span></dd>
              <dt>Preço atual</dt><dd>${money(c.preco)} ${peca.usarCronometro ? '' : '<div class="small muted">A precificação usa horas manuais. Marque "usar o tempo do cronômetro" na peça.</div>'}</dd>
            </dl>`;
          })() : emptyState('Escolha a peça para ver o tempo acumulado.')}</div>
        </div>
      </div>
      ${peca ? `<div class="card mb"><div class="card-head"><h3>${icon('list', 18)} Sessões desta peça</h3><button class="btn btn-sm btn-soft" id="crManual">${icon('plus', 16)} Sessão manual</button></div>
        ${sessoesPeca.length ? tabelaSessoes(sessoesPeca, false) : emptyState('Nenhuma sessão registrada para esta peça.')}</div>` : ''}
      <div class="card"><div class="card-head"><h3>${icon('timer', 18)} Sessões recentes</h3></div>
        ${recentes.length ? tabelaSessoes(recentes, true) : emptyState('As sessões aparecerão aqui.')}</div>`;

    // Atualiza o mostrador sem redesenhar a tela
    if (st === 'running') {
      tick = setInterval(() => {
        const d = $('#crDisplay'); if (!d) { clearInterval(tick); return; }
        d.textContent = fmtDur(elapsedMs(store.timer) / 1000, true);
      }, 500);
    }

    const re = () => this.render(el, []);
    $('#crCli').onchange = e => { selCli = e.target.value; if (selPeca && store.get('pecas', selPeca)?.clienteId !== selCli && selCli) selPeca = ''; re(); };
    $('#crPeca').onchange = e => { selPeca = e.target.value; re(); };
    $('#crNovaPeca').onclick = () => novaPecaRapida(id => { selPeca = id; re(); });
    $('#crPlay')?.addEventListener('click', () => {
      const p = store.get('pecas', selPeca);
      store.saveTimer({ status: 'running', pecaId: selPeca, clienteId: p?.clienteId || selCli || '', inicio: new Date().toISOString(), runStart: new Date().toISOString(), acumuladoMs: 0, pausas: 0 });
    });
    $('#crPause')?.addEventListener('click', () => store.saveTimer({ ...t, status: 'paused', acumuladoMs: elapsedMs(t), runStart: null, pausas: (t.pausas || 0) + 1 }));
    $('#crResume')?.addEventListener('click', () => store.saveTimer({ ...t, status: 'running', runStart: new Date().toISOString() }));
    $('#crReset').onclick = async () => {
      if (!await confirmDialog('Reiniciar zera o tempo desta sessão (sem salvar) e começa a contar de novo. Continuar?', { ok: 'Reiniciar' })) return;
      store.saveTimer({ ...t, status: 'running', inicio: new Date().toISOString(), runStart: new Date().toISOString(), acumuladoMs: 0, pausas: 0 });
    };
    $('#crStop').onclick = parar;
    $('#crManual')?.addEventListener('click', () => sessaoForm(null, selPeca));
    bindSessoes(el);
  },
  destroy() { clearInterval(tick); }
};

async function parar() {
  const t = store.timer;
  if (!t) return;
  const dur = Math.round(elapsedMs(t) / 1000);
  await store.saveTimer(null);
  if (dur < 1) { toast('Sessão sem tempo: nada foi salvo.'); return; }
  const p = store.get('pecas', t.pecaId);
  await store.save('sessoes', { pecaId: t.pecaId, pecaNome: p?.nome || '', clienteId: t.clienteId || p?.clienteId || '', inicio: t.inicio, fim: new Date().toISOString(), duracaoSeg: dur, pausas: t.pausas || 0, data: toYMD(new Date(t.inicio)) });
  await atualizarPeca(t.pecaId);
  toast(`Sessão de ${fmtDur(dur)} salva em "${p?.nome || 'peça'}".`);
}

// Grava o tempo total na peça e liga o uso do cronômetro na precificação se não houver horas manuais
async function atualizarPeca(pecaId) {
  const p = store.get('pecas', pecaId);
  if (!p) return;
  const total = tempoPecaSeg(pecaId);
  const patch = { ...p, tempoSegundos: total };
  if (!p.usarCronometro && !(Number(p.horas) > 0)) patch.usarCronometro = true;
  const c = calcPreco(patch);
  patch.precoCalculado = Math.round(c.preco * 100) / 100;
  await store.save('pecas', patch);
}

function tabelaSessoes(list, comPeca) {
  return `<div class="table-wrap"><table class="tbl resp">
    <thead><tr>${comPeca ? '<th>Peça</th>' : ''}<th>Data</th><th>Início</th><th>Fim</th><th class="right">Duração</th><th class="right">Pausas</th><th></th></tr></thead>
    <tbody>${list.map(s => `<tr data-sid="${s.id}">
      ${comPeca ? `<td class="first">${esc(store.get('pecas', s.pecaId)?.nome || s.pecaNome || '—')}</td>` : ''}
      <td ${comPeca ? 'data-label="Data"' : 'class="first"'}>${fmtDate(s.inicio)}</td>
      <td data-label="Início">${fmtDateTime(s.inicio).split(' ').pop()}</td>
      <td data-label="Fim">${fmtDateTime(s.fim).split(' ').pop()}</td>
      <td data-label="Duração" class="right strong num">${fmtDur(s.duracaoSeg)}</td>
      <td data-label="Pausas" class="right">${s.pausas || 0}</td>
      <td class="acts"><button class="icon-btn" data-edit title="Editar">${icon('edit', 18)}</button><button class="icon-btn danger" data-del title="Excluir">${icon('trash', 18)}</button></td>
    </tr>`).join('')}</tbody>
    ${!comPeca ? `<tfoot><tr><td colspan="3" class="foot-label">Total</td><td class="right num" data-label="Total">${fmtDur(list.reduce((a, s) => a + (s.duracaoSeg || 0), 0))}</td><td colspan="2"></td></tr></tfoot>` : ''}
  </table></div>`;
}

function bindSessoes(el) {
  $$('tr[data-sid]', el).forEach(tr => {
    const s = store.get('sessoes', tr.dataset.sid);
    tr.querySelector('[data-edit]').onclick = () => sessaoForm(s, s.pecaId);
    tr.querySelector('[data-del]').onclick = async () => {
      if (!await confirmDialog(`Excluir esta sessão de ${fmtDur(s.duracaoSeg)}? O tempo da peça será recalculado.`, { ok: 'Excluir', danger: true })) return;
      await store.remove('sessoes', s.id); await atualizarPeca(s.pecaId); toast('Sessão excluída.');
    };
  });
}

const localDT = iso => { const d = parseDate(iso) || new Date(); const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 16); };

function sessaoForm(s, pecaId) {
  const ini = s?.inicio || new Date(Date.now() - 3600000).toISOString();
  const fim = s?.fim || new Date().toISOString();
  modal({
    title: s ? 'Editar sessão' : 'Adicionar sessão manual',
    body: `<form class="form-grid" id="fSes">
      <div class="f s6"><label>Início</label><input type="datetime-local" name="inicio" value="${localDT(ini)}"></div>
      <div class="f s6"><label>Fim</label><input type="datetime-local" name="fim" value="${localDT(fim)}"></div>
      <div class="f s6"><label>Pausas (min) a descontar</label><input name="pausaMin" data-num inputmode="numeric" value="0"></div>
      <div class="f s12"><label>Observação</label><input name="obs" value="${esc(s?.obs)}"></div>
    </form>`,
    actions: `<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="fSesSave">Salvar</button>`,
    onOpen(md, close) {
      $('#fSesSave', md).onclick = async () => {
        const o = formData($('#fSes', md));
        const a = new Date(o.inicio), b = new Date(o.fim);
        if (isNaN(a) || isNaN(b) || b <= a) { toast('O fim precisa ser depois do início.', 'err'); return; }
        const dur = Math.max(0, Math.round((b - a) / 1000 - (o.pausaMin || 0) * 60));
        const p = store.get('pecas', pecaId);
        await store.save('sessoes', { ...(s || {}), pecaId, pecaNome: p?.nome || '', clienteId: s?.clienteId || p?.clienteId || '', inicio: a.toISOString(), fim: b.toISOString(), duracaoSeg: dur, data: toYMD(a), obs: o.obs, manual: !s || s.manual });
        await atualizarPeca(pecaId);
        toast('Sessão salva.'); close();
      };
    }
  });
}

function novaPecaRapida(cb) {
  const clientes = [...store.data.clientes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  modal({
    title: 'Nova peça',
    body: `<form class="form-grid" id="fNp">
      <div class="f s12"><label>Nome da peça *</label><input name="nome" placeholder="Ex.: Girafinha 20 cm"></div>
      <div class="f s12"><label>Cliente</label><select name="clienteId">${options(clientes.map(c => [c.id, c.nome]), selCli, { empty: 'Nenhum' })}</select></div>
      <p class="f s12 small muted">Os materiais e valores podem ser preenchidos depois, na Precificação.</p>
    </form>`,
    actions: `<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="fNpSave">Criar peça</button>`,
    onOpen(md, close) {
      $('#fNpSave', md).onclick = async () => {
        const o = formData($('#fNp', md));
        if (!o.nome) { toast('Dê um nome para a peça.', 'err'); return; }
        const p = novaPeca({ ...o, usarCronometro: true });
        await store.save('pecas', p);
        close(); cb(p.id);
      };
    }
  });
}
