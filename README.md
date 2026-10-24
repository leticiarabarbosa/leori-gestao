# Leori Gestão

Sistema web de gestão do ateliê de amigurumis em crochê **Leori**: clientes, caixa da empresa, precificação, estoque, preços de fornecedores e cronômetro de produção, com resumos por período.

## Telas

| Tela | O que faz |
|---|---|
| **Início** | Resumo mensal, semestral ou anual: caixa, receita, despesas, impostos, lucro, a receber. Gráficos de receita/lucro e despesas por categoria. Metas, agenda e tarefas. PDF do período. |
| **Clientes** | Cadastro (contato, CPF/CNPJ, endereço fiscal e de entrega, consentimento LGPD), histórico de compras, pagamento (pago/pendente, forma, parcelas) e resumo para o emissor de nota fiscal. |
| **Empresa** | Entradas, saídas, impostos pagos (lançamento manual), caixa, lucro e valor para a conta pessoal. Pedido pago entra no caixa sozinho. |
| **Precificação** | Preço = materiais + horas × valor da hora + frete + margem. Recalcula a cada alteração. Usa o tempo do cronômetro se quiser. |
| **Estoque** | Quantidade atual e mínima, alerta do que precisa repor, entrada/saída rápida. |
| **Preços de materiais** | Preço e frete por fornecedor (site ou loja física), histórico com datas, filtro por período, ranking e gráficos. |
| **Cronômetro** | Iniciar, pausar, continuar, reiniciar e parar. Cada sessão é salva com início, fim e duração; o total vai para a peça, o cliente e a precificação. |
| **Configurações** | Valores padrão, % do lucro para a conta pessoal, **Aparência** (cor, barra lateral, fonte, modo escuro, cantos), exportação (Excel, CSV, PDF), conta e privacidade. |

O sistema **não emite nota fiscal** e **não calcula impostos**: guarda os dados e gera um resumo para o emissor oficial; impostos são lançados como valores pagos.

## Tecnologia

- HTML, CSS e JavaScript puro (módulos ES), sem etapa de build.
- Firebase Authentication (e-mail e senha) e Cloud Firestore com sincronização em tempo real e cache offline.
- Chart.js (gráficos), jsPDF + AutoTable (PDF) e SheetJS (Excel), carregados por CDN.
- Publicação: Vercel (principal) e GitHub Pages.

## Estrutura

```
index.html              página única
css/styles.css          estilos (computador, tablet ≤1023px, celular ≤767px)
js/app.js               login, navegação e rotas (#/pagina)
js/store.js             dados: Firebase ou modo demonstração (localStorage)
js/logic.js             regras de negócio (caixa, lucro, preço, estoque)
js/theme.js             aparência editável
js/export.js            CSV, Excel e PDF
js/pages/*.js           uma tela por arquivo
firestore.rules         regras de segurança do banco
js/firebase-config.js   configuração pública do app web do Firebase
```

## Onde ficam os dados no Firebase

Firestore → coleção `users` → documento com o seu UID → subcoleções:
`clientes`, `pedidos`, `lancamentos`, `materiais`, `precos`, `pecas`, `sessoes`, `tarefas`, `metas`, `agenda`,
e `meta/settings` (configurações e aparência) e `meta/timer` (cronômetro em andamento).

## Segurança e LGPD

- Login obrigatório. As regras do Firestore (`firestore.rules`) só deixam cada usuário ler e gravar `users/{seu uid}`.
- A configuração em `js/firebase-config.js` é pública por natureza (identifica o projeto); não há chaves secretas no código.
- Ficha do cliente: registro de consentimento, exportação dos dados do cliente e exclusão completa.

## Modo demonstração

Sem configuração do Firebase, o sistema roda em modo demonstração: qualquer e-mail entra e os dados ficam só no navegador. Em Configurações → Conta é possível carregar dados de exemplo.

## Rodar localmente

Qualquer servidor estático na pasta do projeto, por exemplo:

```bash
npx serve .
```
