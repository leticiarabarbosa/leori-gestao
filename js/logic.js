// Leori Gestão — regras de negócio (cálculos usados por várias telas)
import * as store from './store.js';
import { inRange, parseDate, sum, today } from './utils.js';

export const FORMAS = ['Pix', 'Dinheiro', 'Cartão de crédito', 'Cartão de débito', 'Transferência', 'Boleto', 'Outro'];
export const CATEG_MATERIAIS = ['Fio', 'Agulha', 'Enchimento', 'Olhos de segurança', 'Arame', 'Cordão espaguete', 'Embalagem', 'Acessórios', 'Outros'];
export const UNIDADES = ['un', 'g', 'kg', 'm', 'cm', 'novelo', 'pacote', 'par'];
export const ETAPAS = [['orcamento', 'Orçamento'], ['producao', 'Em produção'], ['pronto', 'Pronto'], ['entregue', 'Entregue']];
export const TIPOS_LANC = { entrada: 'Entrada', saida: 'Saída', imposto: 'Imposto pago', retirada: 'Transferência p/ conta pessoal' };

// ── Pedidos ↔ caixa ──────────────────────────────────────────────
// Um pedido pago gera (ou atualiza) uma entrada no caixa com id fixo "pedido-<id>".
// Voltar o pedido para pendente remove essa entrada.
export const lancIdDoPedido = pedidoId => `pedido-${pedidoId}`;

export async function salvarPedido(p) {
  const id = await store.save('pedidos', p);
  const lid = lancIdDoPedido(id);
  if (p.status === 'pago' && p.valor > 0) {
    const cli = store.get('clientes', p.clienteId);
    await store.save('lancamentos', {
      id: lid, tipo: 'entrada', auto: true, pedidoId: id, clienteId: p.clienteId || '',
      data: p.dataPagamento || p.data || today(),
      descricao: `Pedido: ${p.descricao || 'peça'}${cli ? ' — ' + cli.nome : ''}`,
      categoria: 'Venda', valor: p.valor, forma: p.forma || '',
      parcelas: p.parcelas || 1
    });
  } else if (store.get('lancamentos', lid)) {
    await store.remove('lancamentos', lid);
  }
  return id;
}
export async function excluirPedido(id) {
  await store.remove('pedidos', id);
  if (store.get('lancamentos', lancIdDoPedido(id))) await store.remove('lancamentos', lancIdDoPedido(id));
}

// ── Finanças ─────────────────────────────────────────────────────
export function resumoFinanceiro(range) {
  const L = store.data.lancamentos.filter(l => inRange(l.data, range));
  const tot = t => sum(L.filter(l => l.tipo === t), l => l.valor);
  const entradas = tot('entrada'), saidas = tot('saida'), impostos = tot('imposto'), retiradas = tot('retirada');
  const lucro = entradas - saidas - impostos;
  const reserva = Math.max(0, lucro) * (Number(store.settings.percPessoal) || 0) / 100;
  return { entradas, saidas, impostos, retiradas, lucro, reserva, aTransferir: Math.max(0, reserva - retiradas), lista: L };
}

// Saldo do caixa acumulado até a data (inclusive)
export function caixaAte(date = new Date()) {
  const lim = date instanceof Date ? date : parseDate(date);
  let s = Number(store.settings.saldoInicial) || 0;
  store.data.lancamentos.forEach(l => {
    const d = parseDate(l.data);
    if (!d || d > lim) return;
    s += l.tipo === 'entrada' ? l.valor : -(Number(l.valor) || 0);
  });
  return s;
}

export function aReceber() {
  const p = store.data.pedidos.filter(x => x.status !== 'pago');
  return { total: sum(p, x => x.valor), qtd: p.length, lista: p };
}

// ── Precificação ─────────────────────────────────────────────────
export function tempoPecaSeg(pecaId) {
  return sum(store.data.sessoes.filter(s => s.pecaId === pecaId), s => s.duracaoSeg);
}

export function horasDaPeca(peca) {
  if (peca.usarCronometro) return tempoPecaSeg(peca.id) / 3600;
  return Number(peca.horas) || 0;
}

export function calcPreco(peca) {
  const itens = peca.itens || [];
  const materiais = sum(itens, i => (Number(i.quantidade) || 0) * (Number(i.valorUnit) || 0));
  const horas = horasDaPeca(peca);
  const maoDeObra = horas * (Number(peca.valorHora) || 0);
  const frete = Number(peca.frete) || 0;
  const custo = materiais + maoDeObra + frete;
  const lucro = custo * (Number(peca.margem) || 0) / 100;
  return { materiais, horas, maoDeObra, frete, custo, lucro, preco: custo + lucro };
}

// Itens padrão de uma peça nova
export function itensPadrao() {
  const base = [
    ['Fio', 'Fio', 'g'], ['Enchimento', 'Enchimento (fibra)', 'g'], ['Arame', 'Arame (esqueleto)', 'm'],
    ['Cordão espaguete', 'Cordão espaguete (esqueleto)', 'm'], ['Olhos de segurança', 'Olhos de segurança', 'par']
  ];
  return base.map(([cat, desc, un], i) => {
    const m = store.data.materiais.find(x => x.categoria === cat);
    return { id: 'i' + i + Date.now().toString(36), categoria: cat, materialId: m?.id || '', descricao: m ? m.nome : desc, quantidade: 0, unidade: m?.unidade || un, valorUnit: m ? Number(m.custoUnit) || 0 : 0 };
  });
}

// ── Estoque ──────────────────────────────────────────────────────
export function statusMaterial(m) {
  const q = Number(m.quantidade) || 0, min = Number(m.minimo) || 0;
  if (q <= 0) return { key: 'zerado', label: 'Sem estoque', cls: 'danger' };
  if (q < min) return { key: 'repor', label: 'Repor', cls: 'warn' };
  return { key: 'ok', label: 'Em ordem', cls: 'ok' };
}
export const materiaisParaRepor = () => store.data.materiais.filter(m => statusMaterial(m).key !== 'ok');

// Embalagem em que o material é comprado (ex.: novelo de 65 g por R$ 16,99).
// Materiais antigos, sem embalagem, contam como embalagem de 1 unidade ao custo unitário.
export const EMBALAGENS = ['novelo', 'rolo', 'pacote', 'cartela', 'caixa', 'unidade'];
export function embPadrao(categoria) {
  return { 'Fio': 'novelo', 'Arame': 'rolo', 'Cordão espaguete': 'rolo', 'Olhos de segurança': 'cartela' }[categoria] || 'pacote';
}
export function embalagem(m) {
  const conteudo = Number(m.conteudoEmb) > 0 ? Number(m.conteudoEmb) : 1;
  const preco = m.precoEmb != null && m.precoEmb !== '' ? Number(m.precoEmb) || 0 : (Number(m.custoUnit) || 0) * conteudo;
  return { conteudo, preco, nome: m.nomeEmb || (Number(m.conteudoEmb) > 0 ? embPadrao(m.categoria) : m.unidade || 'un'), temEmb: Number(m.conteudoEmb) > 1 };
}
export const plural = (n, palavra) => (Math.abs(n - 1) < 1e-9 ? palavra : palavra.replace(/(ão)$/, 'ões').replace(/([^s])$/, '$1s'));
// "3 novelos" (ou "2,5 novelos")
export function emEmbalagens(m, qtd) {
  const e = embalagem(m);
  if (!e.temEmb) return '';
  const n = (Number(qtd) || 0) / e.conteudo;
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${plural(n, e.nome)}`;
}

// ── Preços de fornecedores ───────────────────────────────────────
export function custoRegistro(r) {
  const total = (Number(r.preco) || 0) + (Number(r.frete) || 0);
  const q = Number(r.qtdEmbalagem) || 1;
  return { total, porUnidade: total / q };
}

// ── Cliente ──────────────────────────────────────────────────────
export function resumoCliente(cid) {
  const pedidos = store.data.pedidos.filter(p => p.clienteId === cid);
  const pecas = store.data.pecas.filter(p => p.clienteId === cid);
  return {
    pedidos, pecas,
    total: sum(pedidos, p => p.valor),
    pago: sum(pedidos.filter(p => p.status === 'pago'), p => p.valor),
    pendente: sum(pedidos.filter(p => p.status !== 'pago'), p => p.valor),
    tempoSeg: sum(store.data.sessoes.filter(s => s.clienteId === cid || pecas.some(p => p.id === s.pecaId)), s => s.duracaoSeg)
  };
}

export function enderecoTexto(e) {
  if (!e) return '';
  const l1 = [e.rua, e.numero].filter(Boolean).join(', ');
  return [l1, e.complemento, e.bairro, [e.cidade, e.uf].filter(Boolean).join('/'), e.cep ? 'CEP ' + e.cep : ''].filter(Boolean).join(' — ');
}
