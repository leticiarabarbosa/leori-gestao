// Exportação: planilhas (CSV e Excel) e PDFs (resumo do período e resumo para nota fiscal)
import * as store from './store.js';
import { downloadBlob, fmtDate, fmtDateTime, money, today, toast, periodRange, periodLabel, inRange, MESES_CURTOS } from './utils.js';
import { TIPOS_LANC, ETAPAS, resumoFinanceiro, caixaAte, aReceber, calcPreco, custoRegistro, statusMaterial, enderecoTexto, materiaisParaRepor } from './logic.js';

const LIBS = {
  jspdf: ['https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'],
  xlsx: ['https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js']
};
const loaded = {};
function loadLib(name) {
  if (!loaded[name]) {
    loaded[name] = LIBS[name].reduce((p, src) => p.then(() => new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Falha ao carregar ' + src));
      document.head.appendChild(s);
    })), Promise.resolve());
  }
  return loaded[name];
}

const cli = id => store.get('clientes', id)?.nome || '';
const peca = id => store.get('pecas', id)?.nome || '';
const n2 = v => Math.round((Number(v) || 0) * 100) / 100;

// Definição das planilhas: [título da coluna, função que extrai o valor]
export const TABELAS = {
  clientes: { nome: 'Clientes', cols: [
    ['Nome', c => c.nome], ['Telefone', c => c.telefone], ['E-mail', c => c.email], ['Rede social', c => c.redeSocial],
    ['Tipo', c => c.tipoPessoa], ['CPF/CNPJ', c => c.documento], ['Razão social', c => c.razaoSocial], ['Inscrição estadual', c => c.ie],
    ['Endereço (nota fiscal)', c => enderecoTexto(c.endereco)], ['Endereço de entrega', c => enderecoTexto(c.entregaIgual ? c.endereco : c.entrega)],
    ['Consentimento LGPD', c => c.consentimento ? 'Sim ' + fmtDate(c.consentimentoData) : 'Não'], ['Observações', c => c.obs], ['Cadastrado em', c => fmtDate(c.createdAt)]
  ] },
  pedidos: { nome: 'Pedidos', cols: [
    ['Data', p => fmtDate(p.data)], ['Cliente', p => cli(p.clienteId)], ['Descrição', p => p.descricao], ['Peça', p => peca(p.pecaId)], ['Quantidade', p => p.quantidade],
    ['Valor', p => n2(p.valor)], ['Etapa', p => ETAPAS.find(e => e[0] === p.etapa)?.[1] || ''], ['Pagamento', p => p.status === 'pago' ? 'Pago' : 'Pendente'],
    ['Data do pagamento', p => fmtDate(p.dataPagamento)], ['Forma', p => p.forma], ['Parcelas', p => p.parcelas], ['Observações', p => p.obs]
  ] },
  lancamentos: { nome: 'Caixa', cols: [
    ['Data', l => fmtDate(l.data)], ['Tipo', l => TIPOS_LANC[l.tipo]], ['Descrição', l => l.descricao], ['Categoria', l => l.categoria],
    ['Forma', l => l.forma], ['Valor', l => n2(l.tipo === 'entrada' ? l.valor : -l.valor)], ['Origem', l => l.auto ? 'Pedido' : 'Manual'], ['Observações', l => l.obs]
  ] },
  materiais: { nome: 'Estoque', cols: [
    ['Material', m => m.nome], ['Categoria', m => m.categoria], ['Unidade', m => m.unidade], ['Quantidade atual', m => m.quantidade], ['Quantidade mínima', m => m.minimo],
    ['Situação', m => statusMaterial(m).label], ['Custo por unidade', m => n2(m.custoUnit)], ['Fornecedor', m => m.fornecedor], ['Observações', m => m.obs]
  ] },
  precos: { nome: 'Preços fornecedores', cols: [
    ['Data', r => fmtDate(r.data)], ['Material', r => r.material], ['Fornecedor', r => r.fornecedor], ['Tipo', r => r.tipoLoja === 'fisica' ? 'Loja física' : 'Site'],
    ['Preço', r => n2(r.preco)], ['Frete', r => n2(r.frete)], ['Total', r => n2(custoRegistro(r).total)], ['Qtd. na embalagem', r => r.qtdEmbalagem], ['Unidade', r => r.unidade],
    ['Custo por unidade', r => Math.round(custoRegistro(r).porUnidade * 10000) / 10000], ['Link/endereço', r => r.link], ['Observações', r => r.obs]
  ] },
  pecas: { nome: 'Precificação', cols: [
    ['Peça', p => p.nome], ['Cliente', p => cli(p.clienteId)], ['Horas', p => n2(calcPreco(p).horas)], ['Valor da hora', p => n2(p.valorHora)],
    ['Materiais', p => n2(calcPreco(p).materiais)], ['Mão de obra', p => n2(calcPreco(p).maoDeObra)], ['Frete', p => n2(p.frete)], ['Custo total', p => n2(calcPreco(p).custo)],
    ['Margem %', p => p.margem], ['Preço final', p => n2(calcPreco(p).preco)],
    ['Materiais usados', p => (p.itens || []).filter(i => i.quantidade > 0).map(i => `${i.descricao}: ${i.quantidade} ${i.unidade} x ${i.valorUnit}`).join(' | ')]
  ] },
  sessoes: { nome: 'Sessões de produção', cols: [
    ['Peça', s => peca(s.pecaId) || s.pecaNome], ['Cliente', s => cli(s.clienteId)], ['Início', s => fmtDateTime(s.inicio)], ['Fim', s => fmtDateTime(s.fim)],
    ['Duração (min)', s => Math.round((s.duracaoSeg || 0) / 60)], ['Pausas', s => s.pausas || 0], ['Observação', s => s.obs]
  ] },
  tarefas: { nome: 'Tarefas', cols: [['Tarefa', t => t.texto], ['Prazo', t => fmtDate(t.prazo)], ['Concluída', t => t.feita ? 'Sim' : 'Não']] },
  agenda: { nome: 'Agenda', cols: [['Data', a => fmtDate(a.data)], ['Hora', a => a.hora], ['Compromisso', a => a.titulo], ['Observação', a => a.obs]] },
  metas: { nome: 'Metas', cols: [['Meta', m => m.titulo], ['Tipo', m => m.tipo], ['Alvo', m => m.alvo], ['Atual (manual)', m => m.atual]] }
};

function rows(key, list) {
  const t = TABELAS[key];
  return [t.cols.map(c => c[0]), ...list.map(x => t.cols.map(c => { const v = c[1](x); return v ?? ''; }))];
}

function csvString(matrix) {
  return '﻿' + matrix.map(r => r.map(v => {
    let s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
    if (/[";\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }).join(';')).join('\r\n');
}

// key: nome da tabela, ou 'cliente' + id para exportar os dados de um cliente (LGPD)
export async function exportCSV(key, id) {
  if (key === 'cliente') {
    const c = store.get('clientes', id);
    const peds = store.data.pedidos.filter(p => p.clienteId === id);
    const m = [['DADOS DO CLIENTE'], ...rows('clientes', [c]), [], ['PEDIDOS'], ...rows('pedidos', peds)];
    downloadBlob(new Blob([csvString(m)], { type: 'text/csv;charset=utf-8' }), `leori-cliente-${slug(c.nome)}-${today()}.csv`);
    return;
  }
  const list = store.data[key] || [];
  if (!list.length) { toast('Não há dados para exportar.', 'err'); return; }
  downloadBlob(new Blob([csvString(rows(key, list))], { type: 'text/csv;charset=utf-8' }), `leori-${slug(TABELAS[key].nome)}-${today()}.csv`);
}

export async function exportExcel() {
  try {
    toast('Gerando planilha…');
    await loadLib('xlsx');
    const XLSX = window.XLSX;
    const wb = XLSX.utils.book_new();
    Object.keys(TABELAS).forEach(k => {
      const ws = XLSX.utils.aoa_to_sheet(rows(k, store.data[k] || []));
      ws['!cols'] = TABELAS[k].cols.map(c => ({ wch: Math.max(12, c[0].length + 2) }));
      XLSX.utils.book_append_sheet(wb, ws, TABELAS[k].nome.slice(0, 31));
    });
    XLSX.writeFile(wb, `leori-gestao-${today()}.xlsx`);
  } catch (e) { console.error(e); toast('Não foi possível gerar a planilha. Verifique a internet.', 'err'); }
}

const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function newPdf() {
  await loadLib('jspdf');
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
  return doc;
}
function primaryRGB() {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--primary-rgb').trim();
  return v ? v.split(',').map(Number) : [87, 83, 78];
}
function header(doc, titulo, sub) {
  const c = primaryRGB();
  doc.setFillColor(...c); doc.rect(0, 0, 210, 26, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('Leori', 14, 12);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(titulo, 14, 19);
  if (sub) doc.text(sub, 196, 19, { align: 'right' });
  doc.setTextColor(40, 37, 36);
}
function footer(doc) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(140);
    doc.text(`Gerado pelo Leori Gestão em ${new Date().toLocaleString('pt-BR')}`, 14, 290);
    doc.text(`${i}/${n}`, 196, 290, { align: 'right' });
  }
}

export async function pdfResumo(periodo) {
  try {
    toast('Gerando PDF…');
    const doc = await newPdf();
    const range = periodRange(periodo);
    const r = resumoFinanceiro(range);
    const rec = aReceber();
    header(doc, 'Resumo do período', periodLabel(periodo));
    const c = primaryRGB();
    const theme = { headStyles: { fillColor: c, textColor: 255 }, styles: { fontSize: 9, cellPadding: 2 }, margin: { left: 14, right: 14 } };
    doc.autoTable({ ...theme, startY: 34, head: [['Indicador', 'Valor']], body: [
      ['Caixa da empresa (fim do período)', money(caixaAte(range[1] < new Date() ? range[1] : new Date()))],
      ['Entradas', money(r.entradas)], ['Saídas', money(r.saidas)], ['Impostos pagos', money(r.impostos)],
      ['Lucro (entradas - saídas - impostos)', money(r.lucro)],
      [`Reservado para conta pessoal (${store.settings.percPessoal}% do lucro)`, money(r.reserva)],
      ['Já transferido para conta pessoal', money(r.retiradas)],
      ['A receber de clientes (pedidos pendentes)', `${money(rec.total)} (${rec.qtd})`]
    ], columnStyles: { 1: { halign: 'right' } } });
    // Por mês
    const meses = {};
    r.lista.forEach(l => { const k = l.data.slice(0, 7); meses[k] ||= { e: 0, s: 0, i: 0 }; if (l.tipo === 'entrada') meses[k].e += l.valor; if (l.tipo === 'saida') meses[k].s += l.valor; if (l.tipo === 'imposto') meses[k].i += l.valor; });
    const mk = Object.keys(meses).sort();
    if (mk.length > 1) {
      doc.autoTable({ ...theme, startY: doc.lastAutoTable.finalY + 8, head: [['Mês', 'Entradas', 'Saídas', 'Impostos', 'Lucro']],
        body: mk.map(k => { const m = meses[k]; const [y, mo] = k.split('-'); return [`${MESES_CURTOS[+mo - 1]}/${y}`, money(m.e), money(m.s), money(m.i), money(m.e - m.s - m.i)]; }),
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } } });
    }
    doc.autoTable({ ...theme, startY: doc.lastAutoTable.finalY + 8, head: [['Data', 'Tipo', 'Descrição', 'Categoria', 'Valor']],
      body: r.lista.sort((a, b) => a.data.localeCompare(b.data)).map(l => [fmtDate(l.data), TIPOS_LANC[l.tipo], l.descricao || '', l.categoria || '', (l.tipo === 'entrada' ? '+ ' : '- ') + money(l.valor)]),
      columnStyles: { 4: { halign: 'right' } } });
    const peds = store.data.pedidos.filter(p => inRange(p.data, range));
    if (peds.length) doc.autoTable({ ...theme, startY: doc.lastAutoTable.finalY + 8, head: [['Data', 'Cliente', 'Pedido', 'Valor', 'Pagamento']],
      body: peds.sort((a, b) => a.data.localeCompare(b.data)).map(p => [fmtDate(p.data), cli(p.clienteId), p.descricao, money(p.valor), p.status === 'pago' ? 'Pago' : 'Pendente']),
      columnStyles: { 3: { halign: 'right' } } });
    const repor = materiaisParaRepor();
    if (repor.length) doc.autoTable({ ...theme, startY: doc.lastAutoTable.finalY + 8, head: [['Material para repor', 'Atual', 'Mínimo']],
      body: repor.map(m => [m.nome, `${m.quantidade} ${m.unidade}`, `${m.minimo} ${m.unidade}`]) });
    footer(doc);
    doc.save(`leori-resumo-${slug(periodLabel(periodo))}.pdf`);
  } catch (e) { console.error(e); toast('Não foi possível gerar o PDF. Verifique a internet.', 'err'); }
}

export async function pdfNF(pedidoId, texto) {
  try {
    const doc = await newPdf();
    const p = store.get('pedidos', pedidoId);
    header(doc, 'Resumo para emissão de nota fiscal', fmtDate(p.data));
    doc.setFont('courier', 'normal'); doc.setFontSize(10);
    const lines = doc.splitTextToSize(texto.split('\n').slice(2).join('\n'), 180);
    doc.text(lines, 14, 36);
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(120);
    doc.text('Este documento não é uma nota fiscal. Use estes dados no emissor oficial.', 14, 282);
    footer(doc);
    doc.save(`leori-nf-${slug(cli(p.clienteId))}-${p.data}.pdf`);
  } catch (e) { console.error(e); toast('Não foi possível gerar o PDF.', 'err'); }
}
