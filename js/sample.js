// Dados de exemplo para o modo demonstração (não são usados com o Firebase)
import { toYMD, uid } from './utils.js';
import { lancIdDoPedido } from './logic.js';

export function sample() {
  const d = (diasAtras) => { const x = new Date(); x.setDate(x.getDate() - diasAtras); return toYMD(x); };
  const iso = (diasAtras, h) => { const x = new Date(); x.setDate(x.getDate() - diasAtras); x.setHours(h, 0, 0, 0); return x.toISOString(); };
  const end = (e) => ({ cep: '57000-000', rua: e[0], numero: e[1], complemento: '', bairro: e[2], cidade: e[3], uf: e[4] });
  const clientes = [
    ['Ana Beatriz Souza', '(82) 99911-2233', 'ana@exemplo.com', '@anabia', '529.982.247-25', ['Rua das Flores', '120', 'Ponta Verde', 'Maceió', 'AL']],
    ['Carla Mendes Lima', '(82) 98822-3344', 'carla@exemplo.com', '@carlamendes', '111.444.777-35', ['Av. Fernandes Lima', '900', 'Farol', 'Maceió', 'AL']],
    ['Loja Mimos Kids LTDA', '(81) 3333-4455', 'compras@mimoskids.com', '@mimoskids', '11.222.333/0001-81', ['Rua do Sol', '45', 'Boa Vista', 'Recife', 'PE']],
    ['Juliana Prado', '(11) 97777-6655', 'ju.prado@exemplo.com', '@juprado', '', ['Rua Augusta', '1500', 'Consolação', 'São Paulo', 'SP']],
    ['Marcos Vinícius Alves', '(82) 99654-1212', '', '@marcosv', '', ['Rua Jangadeiros', '33', 'Pajuçara', 'Maceió', 'AL']]
  ].map(([nome, telefone, email, redeSocial, documento, e], i) => ({
    id: 'c' + i, nome, telefone, email, redeSocial, documento, tipoPessoa: documento.length > 14 ? 'PJ' : 'PF',
    razaoSocial: documento.length > 14 ? nome : '', endereco: end(e), entregaIgual: true, entrega: {}, consentimento: i !== 4,
    consentimentoData: d(200 - i * 20), createdAt: iso(200 - i * 20, 10)
  }));
  const materiais = [
    ['Fio Amigurumi branco', 'Fio', 'g', 380, 200, 0.16, 'Armarinho Central'],
    ['Fio Amigurumi rosa bebê', 'Fio', 'g', 120, 200, 0.16, 'Armarinho Central'],
    ['Fio Amigurumi caramelo', 'Fio', 'g', 450, 150, 0.17, 'Loja do Crochê (site)'],
    ['Fibra siliconada', 'Enchimento', 'g', 900, 500, 0.04, 'Armarinho Central'],
    ['Olhos de segurança 9 mm', 'Olhos de segurança', 'par', 6, 20, 0.6, 'Loja do Crochê (site)'],
    ['Arame galvanizado 18', 'Arame', 'm', 12, 5, 0.9, 'Casa das Ferragens'],
    ['Cordão espaguete', 'Cordão espaguete', 'm', 0, 10, 0.5, 'Armarinho Central'],
    ['Agulha 2,5 mm', 'Agulha', 'un', 2, 1, 14, 'Loja do Crochê (site)'],
    ['Saquinho de organza', 'Embalagem', 'un', 25, 15, 0.8, 'Embalagens Já']
  ].map(([nome, categoria, unidade, quantidade, minimo, custoUnit, fornecedor], i) => {
    // embalagem de compra: [nome, conteúdo]
    const emb = [['novelo', 125], ['novelo', 65], ['novelo', 65], ['pacote', 1000], ['cartela', 20], ['rolo', 10], ['rolo', 20], ['unidade', 1], ['pacote', 50]][i];
    return { id: 'm' + i, nome, categoria, unidade, quantidade, minimo, custoUnit, fornecedor, nomeEmb: emb[0], conteudoEmb: emb[1], precoEmb: Math.round(custoUnit * emb[1] * 100) / 100 };
  });
  const precos = [];
  const forn = [['Armarinho Central', 'fisica', 0], ['Loja do Crochê (site)', 'site', 18], ['Mercado Fios (site)', 'site', 12]];
  [[0, 'Fio Amigurumi branco', 125, 19.9], [3, 'Fibra siliconada', 1000, 38], [4, 'Olhos de segurança 9 mm', 20, 11]].forEach(([mi, mat, q, base]) => {
    [300, 200, 120, 40, 5].forEach((dias, k) => forn.forEach(([fo, tipo, fr], j) => {
      if ((k + j) % 2 && dias !== 5) return;
      precos.push({ id: uid(), data: d(dias), material: mat, fornecedor: fo, tipoLoja: tipo, preco: Math.round((base * (1 + j * .06 - (j === 2 ? .18 : 0)) * (1 + k * .03)) * 100) / 100, frete: fr, qtdEmbalagem: q, unidade: materiais[mi].unidade });
    }));
  });
  const itens = (fio, ench, olhos, arame) => [
    { id: uid(), categoria: 'Fio', materialId: 'm2', descricao: 'Fio Amigurumi caramelo', quantidade: fio, unidade: 'g', valorUnit: 0.17 },
    { id: uid(), categoria: 'Enchimento', materialId: 'm3', descricao: 'Fibra siliconada', quantidade: ench, unidade: 'g', valorUnit: 0.04 },
    { id: uid(), categoria: 'Arame', materialId: 'm5', descricao: 'Arame galvanizado 18', quantidade: arame, unidade: 'm', valorUnit: 0.9 },
    { id: uid(), categoria: 'Cordão espaguete', materialId: 'm6', descricao: 'Cordão espaguete', quantidade: arame, unidade: 'm', valorUnit: 0.5 },
    { id: uid(), categoria: 'Olhos de segurança', materialId: 'm4', descricao: 'Olhos de segurança 9 mm', quantidade: olhos, unidade: 'par', valorUnit: 0.6 }
  ];
  const pecas = [
    { id: 'p0', nome: 'Ursinho Teddy 25 cm', clienteId: 'c0', horas: 0, usarCronometro: true, valorHora: 18, margem: 30, frete: 0, itens: itens(110, 60, 1, 0.5) },
    { id: 'p1', nome: 'Coelhinha com vestido 30 cm', clienteId: 'c1', horas: 9, usarCronometro: false, valorHora: 18, margem: 35, frete: 15, itens: itens(160, 80, 1, 1) },
    { id: 'p2', nome: 'Kit maternidade (3 peças)', clienteId: 'c2', horas: 16, usarCronometro: false, valorHora: 16, margem: 25, frete: 25, itens: itens(320, 150, 3, 1.5) },
    { id: 'p3', nome: 'Girafinha articulada', clienteId: '', horas: 0, usarCronometro: true, valorHora: 18, margem: 30, frete: 0, itens: itens(90, 50, 1, 1.2) }
  ];
  const sessoes = [[0, 12, 9, 2.5], [0, 10, 14, 3], [0, 6, 9, 2], [3, 3, 15, 1.5], [3, 1, 9, 2.25]].map(([pi, dias, h, horas]) => ({
    id: uid(), pecaId: 'p' + pi, pecaNome: pecas[pi].nome, clienteId: pecas[pi].clienteId, inicio: iso(dias, h), fim: new Date(new Date(iso(dias, h)).getTime() + horas * 3600000).toISOString(), duracaoSeg: horas * 3600, pausas: 1, data: d(dias)
  }));
  const pedidos = [
    ['c0', 230, 'Ursinho Teddy 25 cm', 'p0', 'pago', 'Pix', 1, 5, 'pronto'],
    ['c1', 260, 'Coelhinha com vestido', 'p1', 'pendente', 'Cartão de crédito', 2, 3, 'producao'],
    ['c2', 690, 'Kit maternidade (3 peças) x2', 'p2', 'pago', 'Boleto', 1, 40, 'entregue'],
    ['c2', 480, 'Chaveiros personalizados (24)', '', 'pago', 'Transferência', 1, 70, 'entregue'],
    ['c3', 180, 'Polvo do humor', '', 'pago', 'Pix', 1, 100, 'entregue'],
    ['c0', 150, 'Naninha coelho', '', 'pago', 'Pix', 1, 130, 'entregue'],
    ['c4', 210, 'Dinossauro 28 cm', '', 'pendente', 'Dinheiro', 1, 20, 'entregue'],
    ['c1', 320, 'Casal de noivinhos', '', 'pago', 'Cartão de crédito', 3, 160, 'entregue'],
    ['c3', 140, 'Baleia azul', '', 'pago', 'Pix', 1, 190, 'entregue'],
    ['c2', 540, 'Móbile de berço', '', 'pago', 'Boleto', 1, 220, 'entregue']
  ].map(([clienteId, valor, descricao, pecaId, status, forma, parcelas, dias, etapa], i) => ({
    id: 'o' + i, clienteId, valor, descricao, pecaId, status, forma, parcelas, data: d(dias + 4), dataPagamento: status === 'pago' ? d(dias) : '', etapa, quantidade: 1
  }));
  const lancamentos = pedidos.filter(p => p.status === 'pago').map(p => ({
    id: lancIdDoPedido(p.id), tipo: 'entrada', auto: true, pedidoId: p.id, clienteId: p.clienteId, data: p.dataPagamento,
    descricao: `Pedido: ${p.descricao} — ${clientes.find(c => c.id === p.clienteId).nome}`, categoria: 'Venda', valor: p.valor, forma: p.forma, parcelas: p.parcelas
  }));
  [[8, 'saida', 'Compra de fios', 'Fios', 186.5], [15, 'saida', 'Fibra e olhos', 'Materiais', 92], [38, 'imposto', 'DAS MEI', 'DAS (MEI/Simples)', 75.9],
    [8, 'imposto', 'DAS MEI', 'DAS (MEI/Simples)', 75.9], [45, 'saida', 'Anúncio Instagram', 'Divulgação', 60], [70, 'saida', 'Embalagens', 'Embalagens', 48],
    [68, 'imposto', 'DAS MEI', 'DAS (MEI/Simples)', 75.9], [100, 'saida', 'Compra de fios', 'Fios', 210], [130, 'saida', 'Taxa maquininha', 'Taxas de cartão/plataforma', 18.4],
    [160, 'saida', 'Fios e agulhas', 'Materiais', 140], [30, 'retirada', 'Transferência mensal', 'Conta pessoal', 250], [2, 'saida', 'Frete Correios', 'Frete', 32]
  ].forEach(([dias, tipo, descricao, categoria, valor]) => lancamentos.push({ id: uid(), tipo, data: d(dias), descricao, categoria, valor, forma: 'Pix' }));
  return {
    clientes, materiais, precos, pecas, sessoes, pedidos, lancamentos,
    tarefas: [{ id: uid(), texto: 'Comprar cordão espaguete', feita: false, prazo: d(-2) }, { id: uid(), texto: 'Fotografar coelhinha para o Instagram', feita: false, prazo: '' }, { id: uid(), texto: 'Responder orçamento da Juliana', feita: true, prazo: '' }],
    metas: [{ id: uid(), titulo: 'Faturar R$ 1.500 no mês', tipo: 'receita', alvo: 1500 }, { id: uid(), titulo: '6 pedidos no mês', tipo: 'pedidos', alvo: 6 }],
    agenda: [{ id: uid(), titulo: 'Entregar ursinho da Ana', data: d(-1), hora: '15:00', obs: 'Ponta Verde' }, { id: uid(), titulo: 'Feira de artesanato', data: d(-9), hora: '09:00', obs: 'Levar 15 peças' }]
  };
}
