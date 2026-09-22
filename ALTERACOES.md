# Academy Pop — versão 2.2: relatório de alterações para o programador

**Data:** 22/09/2026
**Base:** código `pauloacademy-master` (Next.js 14 + Express + PostgreSQL 16 + MinIO + nginx, via Docker Compose)
**Escopo:** SEO técnico, segurança do checkout, carrinho de compras, busca instantânea, páginas de categoria, conversão, blog e páginas institucionais editáveis.
**Novo na 2.1:** recuperação de acesso ao painel ("Esqueci minha senha" por e-mail + script de servidor) e verificação em 2 etapas (2FA) para os administradores.
**Novo na 2.2:** menu "Graduação" com os subitens Bacharelado, Tecnólogo e Superior Sequencial; categoria "Superior" renomeada para "Superior Sequencial"; Blog no menu do topo.
**Fora do escopo (cancelado pelo cliente):** motor de promoções/combos e pedidos de R$ 0,00.

Este documento diz, para cada mudança, **como era**, **como ficou** e **quais arquivos mudaram**. A seção 2 traz o passo a passo para publicar.

---

## 1. Resumo

| Área | Como era | Como ficou |
|---|---|---|
| Webhook Mercado Pago | Qualquer POST `{type:'payment'}` marcava o pedido como **pago**. Não conferia status, valor nem assinatura. | Valida a assinatura `x-signature`, consulta o pagamento na API do MP e só marca pago com `approved` e valor ≥ pedido. |
| Cartão (Checkout Pro) | Gravava o ID da *preferência*. O webhook traz o ID do *pagamento*, então o pedido **nunca era confirmado**. | Envia `external_reference = id do pedido` e `notification_url`. O webhook localiza o pedido por essa referência. |
| Retorno do cartão | Usava `APP_URL`, que não existia no container do backend. | `APP_URL` foi adicionada ao compose, `auto_return` ligado e a página de sucesso consulta o status real. |
| WhatsApp do checkout | Lia `NEXT_PUBLIC_WHATSAPP_NUMBER`, que não chegava ao backend, e caía em **5511999999999**. | Lê o número cadastrado no CMS (Rodapé). Se não houver, usa `WHATSAPP_NUMBER` do env. |
| Cupom | Uso contado ao **criar** o pedido. Cupons limitados se esgotavam com pedidos abandonados. | Uso contado ao **aprovar** o pagamento, uma única vez por pedido. |
| Erro do MP | Engolido: o cliente ia para o WhatsApp sem aviso. | Gravado em `orders.payment_error`, mostrado no admin. O cliente vê a mensagem e pode tentar outra forma de pagamento. |
| Carrinho | Um curso por pedido. | Vários cursos por pedido (`order_items`), com painel lateral, página `/carrinho` e checkout único `/checkout`. |
| Busca | Não existia. | Busca instantânea (PostgreSQL FTS + `unaccent` + `pg_trgm`) por nome, tipo e conteúdo, com tolerância a erro, filtros e relatório no admin. |
| robots/sitemap | 404. | `/robots.txt` e `/sitemap.xml` gerados dinamicamente a partir do banco. |
| Schema.org | Nenhum. | `EducationalOrganization`, `WebSite` + `SearchAction`, `Course`, `BreadcrumbList`, `FAQPage`, `ItemList`, `Article`, `HowTo`. |
| Canonical / Open Graph | Nenhum. | Em todas as páginas; a capa do curso vira a imagem de compartilhamento. |
| Home | 1,7 MB de HTML (201 cursos renderizados). | Até 6 cursos por categoria. Nos testes: cerca de 300 KB de HTML, **22 KB com gzip**. |
| Menu | Âncoras da home, 3 delas inexistentes (Cursos Livres, Bacharelado, Tecnólogo). | Gerado a partir das categorias reais do banco, com páginas próprias. Na 2.2: EJA · Técnico · **Graduação ▾** (Bacharelado `/graduacao`, Tecnólogo `/tecnologo`, Superior Sequencial `/superior-sequencial`) · Pós-Graduação · Todos os cursos · **Blog**. |
| Categoria "Superior" (2.2) | 6 cursos na categoria "Superior". | Renomeada automaticamente para "Superior Sequencial". `/superior` redireciona (308) para `/superior-sequencial`. |
| Contador de oferta | Renovava-se sozinho ao expirar (urgência falsa). | Some quando a data real passa. |
| Segurança | CORS `*`, login sem limite de tentativas, credenciais no README. | CORS restrito, rate limit no login e nos pedidos, credenciais removidas da documentação, avisos no log. |
| Recuperação de acesso (2.1) | Não existia: quem esquecesse a senha dependia de alguém mexer no banco. | "Esqueci minha senha" com link por e-mail (30 min, uso único) e script no servidor para gerar link, senha temporária ou desligar o 2FA. |
| 2FA (2.1) | Não existia: só e-mail e senha. | Código de 6 dígitos de app autenticador (TOTP), 10 códigos de recuperação, segredo criptografado, histórico de acessos e avisos por e-mail. |
| Sessões (2.1) | Token de 7 dias continuava válido mesmo após trocar a senha. | Trocar ou redefinir a senha e desligar o 2FA encerram as outras sessões (`token_version`). |

---

## 2. Como publicar (passo a passo)

> Tempo estimado: 30–45 min. Faça fora do horário de pico.

### 2.1 Backup (obrigatório)

```bash
cd /caminho/do/projeto
docker compose exec -T postgres pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner | gzip > backup_antes_v2.sql.gz
cp .env .env.antes_v2
```

### 2.2 Atualizar o código

Substitua os arquivos do projeto pelos desta versão **mantendo o `.env` atual** e os volumes do Docker. Não apague `postgres_data` nem `minio_data`.

### 2.3 Atualizar o `.env`

Acrescente ou revise estas variáveis (modelo em `.env.example`):

```dotenv
APP_URL=https://academypopeduca.com.br          # obrigatório: canonical, sitemap, retorno do cartão e webhook
NEXT_PUBLIC_APP_URL=https://academypopeduca.com.br
CORS_ORIGINS=                                   # vazio = só APP_URL
MERCADOPAGO_WEBHOOK_SECRET=                     # assinatura secreta do webhook (passo 2.6)
NEXT_PUBLIC_WHATSAPP_NUMBER=5561920045537       # usado só se o número do CMS estiver vazio
JWT_SECRET=<gere com: openssl rand -hex 32>     # troque se ainda for o do exemplo

# v2.1 – recuperação de senha e 2FA
TWOFA_ENCRYPTION_KEY=<gere com: openssl rand -hex 32>   # NUNCA troque depois que alguém ativar o 2FA
SMTP_HOST=smtp.seuprovedor.com
SMTP_PORT=587                                   # 465 = SSL (SMTP_SECURE=true)
SMTP_USER=usuario
SMTP_PASS=senha-ou-senha-de-app
SMTP_FROM="Academy Pop <nao-responda@academypopeduca.com.br>"
```

Sobre o SMTP: qualquer provedor serve (Google Workspace com senha de app, Brevo, Amazon SES, o SMTP da hospedagem). Configure SPF/DKIM do domínio no provedor para os e-mails não caírem no spam. Sem SMTP, o site funciona normalmente, mas "Esqueci minha senha" não envia nada: use o script da seção 2.6-B.

### 2.4 Trocar credenciais padrão (se ainda estiverem em uso)

No boot, o backend escreve avisos `⚠️ SEGURANÇA:` no log quando encontra valores de exemplo.

- **Senha do admin:** entre no painel e use **Segurança da conta**. É uma tela nova, com mínimo de 10 caracteres. `ADMIN_PASSWORD` do `.env` só vale na criação do primeiro admin.
- **JWT_SECRET:** gere um valor novo. Todos os admins logados precisarão entrar de novo.
- **Senha do banco:** num volume já criado, **mudar só o `.env` não troca a senha**. Faça nesta ordem:
  ```bash
  docker compose exec postgres psql -U "$DB_USER" -d "$DB_NAME" -c "ALTER USER $DB_USER WITH PASSWORD 'NOVA_SENHA';"
  # depois atualize DB_PASSWORD no .env
  ```
- **MinIO:** atualize `MINIO_ROOT_PASSWORD` no `.env`. O container lê a nova senha ao reiniciar.

### 2.5 Subir

```bash
docker compose up -d --build
docker compose logs -f backend   # aguarde as linhas abaixo
```

Linhas esperadas no log do backend:

```
Schema aplicado com sucesso
Banco de dados inicializado
Duração normalizada em N curso(s)     # só na primeira vez
Índice de busca atualizado
Backend rodando na porta 3001
```

As migrações rodam sozinhas e são idempotentes (`schema.sql` inteiro roda em todo boot). Elas criam as extensões `unaccent` e `pg_trgm`, que fazem parte da imagem `postgres:16-alpine`, e exigem que o usuário do banco seja dono do banco. Esse já é o caso na configuração do compose.

### 2.6 Mercado Pago

1. No painel do Mercado Pago, abra **Suas integrações > (aplicação) > Webhooks** e configure:
   - URL: `https://academypopeduca.com.br/api/orders/webhook/mercadopago`
   - Evento: **Pagamentos**
2. Copie a **assinatura secreta** para `MERCADOPAGO_WEBHOOK_SECRET` e rode `docker compose up -d backend`.
3. Faça um PIX de teste de baixo valor, com um cupom de 99% num curso de teste, e confira em **Admin > Pedidos** se o status muda sozinho para "Pago" (coluna "MP: approved").
4. Parcelamento: o site mostra "em até N parcelas". Se a escola assumir os juros, configure **parcelamento sem juros** no painel do MP. Caso contrário, os juros aparecem para o cliente no Checkout Pro.

### 2.6-B Acesso ao painel: e-mail, 2FA e recuperação pelo servidor

1. **Teste o e-mail:** em `/admin/login`, clique em **Esqueci minha senha** e confira se o link chega. O log do backend mostra `[e-mail] falha ao enviar` se o SMTP estiver errado.
2. **Ative o 2FA de cada admin:** em **Admin > Segurança da conta > Ativar verificação em 2 etapas**. É preciso a senha atual, um app autenticador (Google Authenticator, Microsoft Authenticator, Authy) e guardar os 10 códigos de recuperação.
3. **Se alguém perder a senha e o e-mail, ou o celular e os códigos,** use o script no servidor. Cada comando encerra as sessões abertas do usuário e fica registrado:

```bash
docker compose exec backend node src/cli/admin-recovery.js list
docker compose exec backend node src/cli/admin-recovery.js reset-link    admin@dominio.com   # link de nova senha (30 min)
docker compose exec backend node src/cli/admin-recovery.js temp-password admin@dominio.com   # senha temporária aleatória
docker compose exec backend node src/cli/admin-recovery.js disable-2fa   admin@dominio.com   # desliga o 2FA
```

Confirme a identidade da pessoa antes de usar o script e entregue o link ou a senha por um canal seguro.

### 2.7 Conferência pós-publicação

```bash
curl -s https://academypopeduca.com.br/robots.txt
curl -s https://academypopeduca.com.br/sitemap.xml | head
curl -s "https://academypopeduca.com.br/api/search?q=enfermagen" | head -c 300   # deve achar "enfermagem"
curl -sI https://www.academypopeduca.com.br | grep -i location                  # 301 para o domínio sem www
curl -s -o /dev/null -w "%{http_code}\n" https://academypopeduca.com.br/pos-graduacao
curl -s -X POST https://academypopeduca.com.br/api/orders/webhook/mercadopago \
     -H 'content-type: application/json' -d '{"type":"payment","data":{"id":"1"}}' -w "%{http_code}\n"
# com MERCADOPAGO_WEBHOOK_SECRET configurada, o esperado é 401
```

Depois confira no navegador:

- [ ] Busca no topo da home: digitar "gest" mostra resultados; "enfermagen" sugere "enfermagem".
- [ ] Adicionar 2 cursos ao carrinho → `/checkout` mostra os 2 → PIX gera QR code.
- [ ] Página de curso: rolar no celular mostra a barra fixa "Matricular".
- [ ] Links antigos `/checkout/<slug>` redirecionam para `/checkout?curso=<id>`.
- [ ] Teste de dados estruturados: https://search.google.com/test/rich-results com a URL de um curso.
- [ ] Login com 2FA: senha → código do app → painel. "Perdi o celular" aceita um código de recuperação.
- [ ] "Esqueci minha senha" envia o e-mail, e o link só funciona uma vez.
- [ ] Menu do topo: "Graduação" abre Bacharelado, Tecnólogo e Superior Sequencial; "Blog" aparece depois de "Todos os cursos". No celular, "Graduação" abre os 3 subitens.
- [ ] `https://academypopeduca.com.br/superior` redireciona para `/superior-sequencial`, que mostra os cursos antes listados em "Superior".

### 2.8 Google

- No **Search Console**, envie `https://academypopeduca.com.br/sitemap.xml`.
- Peça a indexação da home e das 5 páginas de categoria.

### 2.9 Conteúdo que o cliente precisa preencher no admin

| Onde | O quê |
|---|---|
| Conteúdo > Rastreamento | ID do GA4 (`G-…`) e do Meta Pixel. Os eventos já estão prontos no código. |
| Conteúdo > Hero | Título mais curto (sugestão: "Seu diploma reconhecido pelo MEC, 100% online") e as "provas" abaixo da busca. |
| Conteúdo > Sobre a Plataforma | A estatística "2.000+ Cursos" não bate com os cerca de 200 do site. Use `{total_cursos}` para mostrar o número real. |
| Conteúdo > Página Reconhecimento MEC | Nomes das IES certificadoras, links do e-MEC, logo e modelo de certificado. |
| Conteúdo > Página Como Funciona | Revisar as etapas; opcional: vídeo e prints da plataforma. |
| Conteúdo > Política / Termos | Texto-base gerado. **Revisão por advogado recomendada.** |
| Conteúdo > Rodapé | CNPJ (novo campo). |
| Depoimentos (tela nova) | Cadastrar depoimentos **reais** com autorização. A seção só aparece quando existe ao menos um. |
| Blog (tela nova) | Primeiros artigos. |
| Cursos | Desmarcar "Destaque" dos que não são destaque (hoje 169 de 201). Revisar textos que citam prazos diferentes do campo "Duração". Remover "Vagas restantes" e "Oferta expira em" onde não forem reais. |

### 2.10 Voltar à versão anterior (rollback)

```bash
docker compose down
# restaure os arquivos antigos do projeto
gunzip -c backup_antes_v2.sql.gz | docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME"   # só se necessário
cp .env.antes_v2 .env && docker compose up -d --build
```

As migrações v2 e v2.1 só **acrescentam** colunas e tabelas. A versão antiga continua funcionando no banco migrado, então normalmente não é preciso restaurar o banco.

---

## 3. Mudanças por área

### 3.1 Checkout, pagamentos e segurança

**Pedidos com vários cursos**
- Nova tabela `order_items (order_id, course_id, course_title, unit_price, discount, final_price)`.
- Pedidos antigos são migrados para ela no boot, um item por pedido.
- `orders.course_id` continua preenchido com o 1º curso, por compatibilidade.

**Preço sempre calculado no servidor** (`backend/src/lib/pricing.js`)
- `POST /api/orders/quote` devolve itens, subtotal, desconto, total, erro de cupom e o parcelamento máximo (menor valor de `installments` entre os cursos).
- Cursos inativos ou com preço 0 ("Consulte condições") vêm em `unavailable` e não podem ser comprados online.
- **Cartão:** cobra `price_installment` quando cadastrado, senão `price_pix`. Antes cobrava sempre `price_pix`, mesmo com outro total parcelado anunciado.
- **Cupom:** vale por item (cupom de um curso só dá desconto naquele curso).

**Criação do pedido** (`POST /api/orders`)
- Aceita `course_ids: []`, `items: [{course_id}]` ou o antigo `course_id`.
- Valida nome, e-mail, telefone e CPF (dígitos verificadores, obrigatório no boleto).
- Rate limit de 20 pedidos a cada 15 min por IP.
- Grava pedido + itens em transação e só depois chama o MP, com `external_reference = order.id`, `notification_url` e `idempotencyKey`.
- Gera `orders.access_token`, usado para consultar o status sem expor pedidos de terceiros (`GET /api/orders/:id/public-status?t=`).

**Webhook** (`POST /api/orders/webhook/mercadopago`)
1. Valida `x-signature` (HMAC-SHA256 do manifesto `id:…;request-id:…;ts:…;`) quando `MERCADOPAGO_WEBHOOK_SECRET` existe. Assinatura inválida → 401.
2. Busca o pagamento em `GET /v1/payments/{id}`.
3. Localiza o pedido por `external_reference`, ou por `payment_id` como alternativa.
4. `approved` e valor ≥ pedido → `paid` (+ `paid_at`, + uso do cupom uma vez, em transação com `FOR UPDATE`). `rejected`/`cancelled` → `failed`. `refunded`/`charged_back` → `refunded`.
5. Registra `payment_status_detail`. Erros devolvem 500 para o MP tentar de novo.

**Admin: marcar pago manualmente** usa a mesma rotina (conta o cupom uma vez).

**Segurança geral**
- `app.set('trust proxy', 1)`.
- CORS restrito a `CORS_ORIGINS`/`APP_URL`.
- Login: 5 tentativas a cada 15 min.
- Tela **Segurança da conta** no admin (troca de senha com mínimo de 10 caracteres, 2FA e histórico). Detalhes na seção 3.9.
- O handler de erro não devolve mais `err.message` ao cliente.
- Avisos no boot para `JWT_SECRET` fraco, senha padrão do admin, banco ou MinIO com senha de exemplo, e MP sem assinatura ou sem HTTPS.
- Credenciais removidas do README e do `.env.example`.

**Arquivos:** `backend/src/routes/orders.js` (reescrito), `backend/src/lib/{pricing,mercadopago,settings,cpf}.js` (novos), `backend/src/index.js`, `backend/src/routes/auth.js`, `backend/src/routes/dashboard.js`, `docker-compose.yml`, `.env.example`, `README.md`.

### 3.2 Carrinho e checkout (frontend)

- `lib/cart.tsx`: contexto React com o carrinho salvo em `localStorage` (só IDs e dados de exibição, até 20 cursos, sincronizado entre abas). Preços sempre via `/api/orders/quote`.
- **Botões:** "Adicionar ao carrinho" no card (ícone) e na página do curso. "Matricular agora" leva a `/checkout?curso=<id>` e compra só aquele curso, sem mexer no carrinho.
- **Carrinho:** ícone com contador no cabeçalho, painel lateral (`CartDrawer`) e página `/carrinho`.
- **`/checkout`:** checkout único com máscara de telefone e CPF, cupom recalculado no servidor, PIX com QR code e **confirmação automática** (consulta o status a cada 5 s), boleto com linha digitável e cartão via Checkout Pro. Em erro do MP, oferece outra forma de pagamento ou o WhatsApp.
- **Compatibilidade:** `/checkout/[slug]` virou um redirecionamento para `/checkout?curso=<id>`, então links antigos continuam funcionando.
- `/checkout/sucesso` consulta o status real do pedido. Antes afirmava "Pagamento Confirmado" sem checar.
- `/checkout` e `/carrinho` saem do índice do Google (`noindex` e bloqueio no robots).

### 3.3 Busca instantânea

**Backend** (`backend/src/routes/search.js`, `schema.sql`)
- Colunas em `courses`: `search_title`, `search_text`, `search_disciplines`, `search_tsv` (português, com radicalização) e `search_tsv_simple` (sem radicalização, para prefixos).
- Índices GIN nas duas `tsvector` e índices trigram em `search_title`/`search_text`.
- `refresh_course_search(id)` recalcula o documento de busca. Pesos: A título, B categoria + sinônimos, C módulos/disciplinas, D subtítulo/descrição.
- A função é chamada ao salvar um curso no admin e para todos os cursos a cada boot. **Se cursos forem inseridos direto no banco, rode** `SELECT refresh_course_search(NULL);`.
- `category_synonyms()`: "supletivo" → EJA, "mba"/"especialização" → Pós, etc.
- `GET /api/search?q=&categoria=&preco_max=&ch_min=&ch_max=&ordem=&limit=&offset=`:
  1. Busca por prefixo (`termo:*`) nos dois índices.
  2. Se não achar nada, usa similaridade de trigramas (tolerância a erro, `fuzzy: true`).
  3. Devolve `facets` (contagem por categoria), `suggestion` ("você quis dizer") e `reason` por resultado (ex.: "contém a disciplina Logística Reversa").
- `POST /api/search/log`: o front registra o termo quando o cliente para de digitar (1,2 s). Tem rate limit.
- `GET /api/search/popular` (mais buscados) e `GET /api/search/report` (admin).
- Tabela `search_logs`.

**Frontend** (`components/public/SearchBox.tsx`)
- Espera 150 ms após a última tecla e cancela a busca anterior (`AbortController`). Mostra resultados a partir de 2 caracteres.
- Destaque dos termos ignorando acentos, filtros rápidos por tipo com contagem.
- Setas, Enter e Esc funcionam; `role="combobox"` e `aria-activedescendant` para acessibilidade.
- Versão em tela cheia no celular. Atalho `/` abre a busca no cabeçalho.
- Com o campo vazio, mostra "vistos recentemente" e "mais buscados". Sem resultado, mostra um botão de WhatsApp com o termo.
- Aparece em três lugares: hero da home, cabeçalho (todas as páginas) e página `/cursos`.
- `/cursos`: catálogo completo e resultados da busca, com filtros (tipo, preço máximo, ordenação) e paginação de 24. Resultados de busca e filtros ficam em `noindex`.
- **Admin > Buscas no site:** termos mais buscados e termos **sem resultado**.

Desempenho medido com 201 cursos: resposta da API em cerca de 10–15 ms.

### 3.4 SEO técnico

- `app/robots.ts` e `app/sitemap.ts`, com revalidação de 1 h. O sitemap inclui home, páginas institucionais, categorias, cursos e posts.
- `app/layout.tsx`: `metadataBase`, template de título, descrição padrão, Open Graph, Twitter, `viewport`/`themeColor` e JSON-LD de organização e site com `SearchAction`.
- **Curso:** título, descrição e canonical próprios, OG com a capa, JSON-LD `Course` (preço, carga horária `PT570H`, modalidade online), `BreadcrumbList` e `FAQPage` a partir das FAQs cadastradas. Trilha de navegação visível. 3 cursos relacionados (link interno).
- **Categoria:** `ItemList` + `FAQPage`. **Blog:** `Article`. **Como funciona:** `HowTo`.
- **Imagens:** `sizes` em todas as `next/image` com `fill` (antes baixavam na largura da tela inteira), `priority` na imagem principal e `poweredByHeader: false`.
- **Fonte:** Inter servida localmente pelo pacote `@fontsource-variable/inter`. Antes era um `@import` do Google Fonts no CSS, que bloqueava a renderização.
- **Duração:** normalizada. As 10 grafias diferentes (`6-a12-meses`, `de-3-a-6-meses`…) viram `3 a 6 meses`, `6 a 12 meses` etc. O ajuste roda no boot e a cada salvamento (`backend/src/lib/duration.js`), e o admin sugere os valores padrão (`datalist`).
- **404** com cabeçalho, busca e atalhos para as categorias.
- **Renderização:** se a API não responder, a página não é guardada em cache vazia (`unstable_noStore` em `lib/data.ts`). No `docker build`, com a API fora do ar, as rotas viram dinâmicas e usam o cache de dados do Next. Isso evita a home "sem cursos" logo após o deploy, que podia acontecer na versão anterior.

### 3.5 Estrutura e páginas novas

| Rota | Conteúdo | Editável em |
|---|---|---|
| `/eja`, `/tecnico`, `/graduacao`, `/tecnologo`, `/superior-sequencial`, `/pos-graduacao` | Página de categoria: H1, texto, "para quem é", benefícios, todos os cursos (filtro por nome, ordenação, "carregar mais"), depoimentos, FAQ. | Textos-padrão em `frontend/src/lib/categories.ts`. O cliente pode sobrescrever em **Conteúdo > Páginas de Categoria**. |
| `/cursos` | Catálogo e resultados da busca. | — |
| `/como-funciona` | Jornada do aluno (etapas, vídeo, prints). | Conteúdo > Página Como Funciona |
| `/reconhecimento-mec` | IES certificadoras, e-MEC, como verificar. | Conteúdo > Página Reconhecimento MEC |
| `/politica-de-privacidade`, `/termos-de-uso` | Texto-base (LGPD, CDC art. 49). Antes o link era `#`. | Conteúdo > Política / Termos |
| `/blog`, `/blog/[slug]` | Lista e post com cursos relacionados. | Admin > Blog (tela nova) |

- A rota dinâmica `app/[categoria]` só responde para slugs de categorias que existem no banco. As rotas reservadas estão em `RESERVED_SLUGS`, e o resto devolve 404.
- **Menu e rodapé** são gerados a partir de `GET /api/courses/categories`. Links institucionais foram adicionados. Os componentes `SiteHeader`/`SiteFooter` (`components/public/Site.tsx`) buscam os dados no servidor.
- **Home:** `GET /api/courses?per_category=6` (máximo de 6 por categoria, destaques primeiro). As âncoras antigas `#cursos-eja` etc. continuam existindo.

### 3.6 Conversão

- **Hero:** título, busca em destaque, "provas" abaixo da busca (editáveis; padrão: polo oficial LA Educação/UNICORP, validade nacional, desde 2019), dois botões e um cartão com números no desktop. A imagem de fundo cadastrada no CMS agora é exibida (antes era ignorada). O dropdown da busca não é mais cortado (a seção não usa `overflow-hidden`).
- **Home:** grade de categorias com contagem e "a partir de R$", destaques por categoria com "Ver todos (N)", depoimentos, resumo de "Como funciona", últimos posts do blog e CTA final.
- **Depoimentos:** componente `Testimonials` na home, nas categorias e nos cursos. No curso, se não houver depoimento próprio, usa os da categoria. Tela nova **Admin > Depoimentos** (a API já existia, mas não havia tela).
- **Barra fixa no celular** (`StickyBuyBar`): preço, WhatsApp, carrinho e "Matricular". Aparece quando o cartão de preço sai da tela.
- **Contador de oferta:** só até a data real; some depois. O selo de vagas não pisca mais e aparece só se cadastrado. O admin mostra um aviso para usar apenas dados reais.
- **WhatsApp:** mensagem com o contexto da página ("Estou vendo o curso X…", "os cursos de Pós…", "procurei por 'termo'…").
- **GA4 e Meta Pixel** (`components/public/Analytics.tsx`, `lib/analytics.ts`): IDs em **Conteúdo > Rastreamento**, sem redeploy. Eventos: `view_item`, `add_to_cart`, `begin_checkout`, `purchase` (PIX na tela e cartão na página de sucesso, sem duplicar), `search`, `select_item`, `whatsapp_click`. Nada é carregado no `/admin`.

### 3.7 Admin

- **Telas novas:** Depoimentos, Blog, Buscas no site, Segurança da conta (2.1), Esqueci minha senha e Criar nova senha (2.1).
- **Conteúdo, seções novas:** Rastreamento, Como Funciona, Reconhecimento MEC, Páginas de Categoria, Política, Termos. Também foram adicionados os campos "provas do hero", CNPJ no rodapé e o marcador `{total_cursos}`.
- **Pedidos:** lista os cursos de cada pedido, o cupom, o status no MP (`MP: approved`) e o erro do MP. A busca aceita número do pedido.
- **Curso:** sugestões de duração padrão, dica sobre "Destaque" e aviso sobre gatilhos de urgência.

### 3.8 Infraestrutura

- **nginx:** redireciona 301 de `www.` para o domínio principal; cache de 1 ano para `/_next/static/`; cabeçalhos `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e HSTS (quando o proxy de TLS envia `X-Forwarded-Proto: https`); gzip para XML/JSON/fontes; `server_tokens off`. O nome do domínio está fixo no bloco do `www`: ajuste se mudar.
- **`scripts/backup.sh`:** `pg_dump` e cópia do volume do MinIO para `backups/`, com retenção de 14 dias. Sugestão de cron no próprio arquivo. **Copie a pasta `backups/` para fora do servidor.**
- `package-lock.json` foi incluído no frontend e no backend (build reproduzível).
- **Dependências novas:** backend `express-rate-limit`, `nodemailer` e `qrcode` (2.1); frontend `@fontsource-variable/inter`.

### 3.9 Recuperação de acesso e verificação em 2 etapas (v2.1)

**Como era:** só e-mail e senha. Não havia "esqueci minha senha" nem segundo fator. Trocar a senha não derrubava sessões já abertas (token de 7 dias). O `/auth/change-password` não tinha tela.

**Como ficou:**

*Login em duas etapas* (`POST /auth/login` → `POST /auth/login/2fa`)

- Com 2FA ativo, a senha certa devolve `{ requires_2fa: true, challenge }` em vez da sessão.
- O `challenge` é um JWT de 5 min assinado com **outra chave** (`JWT_SECRET + '::2fa-challenge'`), então não vale como sessão no backend nem no middleware do Next.
- A 2ª etapa aceita:
  - o código TOTP (6 dígitos, janela de ±30 s);
  - ou um código de recuperação (`XXXX-XXXX`, uso único, aceita minúsculas).
- **Anti-reuso:** um código já usado (`totp_last_step`) é recusado.
- E-mail inexistente e senha errada dão a mesma resposta, e o tempo de resposta é igualado com um hash fictício.

*TOTP* (`backend/src/lib/totp.js`)

- Implementação própria da RFC 6238, validada com os vetores oficiais da RFC. Compatível com Google Authenticator, Microsoft Authenticator, Authy e 1Password.
- O segredo fica **criptografado (AES-256-GCM)** com `TWOFA_ENCRYPTION_KEY`. Sem a chave, fica em texto com prefixo `plain:` e o log avisa.
- A chave é separada do `JWT_SECRET` de propósito: trocar o JWT não quebra o 2FA. **Trocar a `TWOFA_ENCRYPTION_KEY` depois de ativar o 2FA trava os códigos:** nesse caso, use `disable-2fa` no script.
- **Códigos de recuperação:** 10 por usuário, guardados só como SHA-256 e mostrados uma única vez, com opções de copiar e baixar `.txt`.

*Ativação e gestão* (tela **Admin > Segurança da conta**)

- **Ativar:**
  1. `POST /auth/2fa/setup` exige a senha atual e devolve o QR code (PNG em data URL) e a chave para digitar à mão.
  2. `POST /auth/2fa/enable` confirma com o 1º código do app e devolve os códigos de recuperação.
- **Desativar:** `POST /auth/2fa/disable` exige a senha e um código (do app ou de recuperação) e encerra as outras sessões.
- **Novos códigos:** `POST /auth/2fa/recovery-codes` (senha + código do app) invalida os anteriores.
- A tela também mostra quantos códigos restam (alerta com 3 ou menos) e as últimas 30 atividades da conta (`GET /auth/events`).

*Recuperação por e-mail* (telas `/admin/esqueci-senha` e `/admin/redefinir-senha`)

- `POST /auth/forgot-password` dá sempre a mesma resposta, sem revelar se o e-mail existe. Limite de 5 pedidos por hora por IP.
- O token tem 256 bits, vale **30 minutos**, é de **uso único** e fica no banco só como SHA-256. Um novo pedido invalida os anteriores.
- `GET /auth/reset-password/validate` e `POST /auth/reset-password`: nova senha com mínimo de 10 caracteres, e todas as sessões são encerradas.
- **O 2FA continua valendo após a redefinição.** Quem tem o e-mail não consegue, só com ele, passar pelo 2FA.
- **Avisos por e-mail:** senha alterada ou redefinida, 2FA ativado ou desativado, código de recuperação usado (com data, hora e IP).

*Sessões*

- `users.token_version` vai dentro do JWT (`tv`), e o `requireAuth` agora confere com o banco a cada requisição.
- Trocar ou redefinir a senha, desligar o 2FA e as ações do script incrementam a versão, o que derruba as sessões antigas.
- Tokens emitidos antes da atualização continuam válidos (`tv` ausente = 0), então ninguém é deslogado no deploy.

*Script de servidor* (`backend/src/cli/admin-recovery.js`): comandos `list`, `reset-link`, `temp-password` e `disable-2fa` (seção 2.6-B).

*Registro:* tabela `auth_events` com login, falhas, 2FA, recuperação e ações do script, incluindo IP e navegador.

*Limites de tentativas por IP:*

| Ação | Limite |
|---|---|
| Login | 5 a cada 15 min |
| Código 2FA | 8 a cada 15 min |
| Esqueci minha senha | 5 por hora |
| Redefinir senha | 10 por hora |
| Ações sensíveis (trocar senha, ativar ou desativar 2FA) | 10 a cada 15 min |

Todos contam apenas as falhas, exceto "esqueci minha senha", que conta todos os pedidos.

**Arquivos:**

- Backend: `src/routes/auth.js` (reescrito), `src/middleware/auth.js`, `src/lib/{totp,mailer}.js` (novos), `src/cli/admin-recovery.js` (novo), `src/db/schema.sql`, `src/index.js`, `tests/auth.test.js` (novo).
- Frontend: `src/app/admin/login/page.tsx` (reescrito), `src/app/admin/{esqueci-senha,redefinir-senha}/` (novos), `src/app/admin/senha/page.tsx` (reescrito como "Segurança da conta"), `src/components/admin/{AuthShell,PasswordStrength}.tsx` (novos), `src/middleware.ts`, `src/app/admin/layout.tsx`, `src/lib/{auth,api}.ts`.
- Raiz: `docker-compose.yml`, `.env.example`.

### 3.10 Menu Graduação, Superior Sequencial e Blog no topo (v2.2)

**Como era (v2.1):** o menu listava as categorias soltas (EJA, Técnico, Graduação, Superior, Pós-Graduação). O Blog só aparecia no rodapé e no menu do celular.

**Como ficou:**

- **Menu do topo** (computador), da esquerda para a direita:
  1. EJA
  2. Técnico
  3. **Graduação ▾**, que abre ao passar o mouse ou clicar:
     - Bacharelado → `/graduacao` (categoria `Graduação` no banco)
     - Tecnólogo → `/tecnologo` (categoria `Tecnólogo`)
     - Superior Sequencial → `/superior-sequencial` (categoria `Superior Sequencial`)
  4. Pós-Graduação
  5. Todos os cursos
  6. **Blog** (novo no topo; continua também no rodapé)

  O número de cursos aparece ao lado de cada subitem quando há cursos. Foi conferido em 1024 px e 1366 px de largura, sem quebrar a linha.
- **Menu do celular:** "Graduação" abre e fecha os mesmos 3 subitens.
- **Renomeação automática:** a migração em `schema.sql` troca a categoria "Superior" por "Superior Sequencial" nos cursos e posts do blog (`UPDATE ... WHERE category = 'Superior'`). É idempotente, roda no boot e reconstrói o índice da busca, incluindo sinônimos como "sequencial" e "formação específica".
- **Redirecionamento:** `/superior` vai para `/superior-sequencial` (308 permanente, em `next.config.js`), sem perder a indexação no Google.
- **Páginas sem cursos:** as 3 páginas do dropdown abrem mesmo sem cursos cadastrados (hoje o caso de Tecnólogo). Nesse caso mostram "Novos cursos em breve" + WhatsApp + FAQ e ficam com `noindex` até existir o primeiro curso. Outras categorias sem cursos continuam dando 404.
- **Textos-padrão novos** (`lib/categories.ts`) para Tecnólogo e Superior Sequencial: título, introdução, público, benefícios, FAQ e SEO.
  - O texto de Superior Sequencial diz que é um curso de nível superior de formação específica, **não uma graduação**. Vale revisar com a instituição certificadora.
  - Os textos podem ser alterados sem programador em **Conteúdo > Páginas de Categoria** (as opções agora são Graduação (Bacharelado), Tecnólogo e Superior Sequencial).
- **Admin > Cursos:** a lista de categorias agora é EJA, Técnico, Graduação, Tecnólogo, Superior Sequencial, Pós-Graduação, Livre e Compliance. "Superior" saiu da lista.

**Arquivos:**

- `frontend/src/components/public/Header.tsx`
- `frontend/src/lib/categories.ts` (`GRADUACAO_MENU` e `knownCategoryName`)
- `frontend/src/app/[categoria]/page.tsx`
- `frontend/next.config.js` (`redirects`)
- `frontend/src/app/admin/cursos/_components/CourseForm.tsx`
- `frontend/src/app/admin/conteudo/page.tsx`
- `backend/src/db/schema.sql` (renomeação e sinônimos)

**Se algum dia criarem um curso na categoria "Superior" de novo**, ele será renomeado no próximo boot. Use sempre "Superior Sequencial".

---

## 4. Banco de dados (migrações automáticas em `schema.sql`)

```
CREATE EXTENSION unaccent, pg_trgm
FUNÇÕES   f_unaccent(text), category_synonyms(text), refresh_course_search(int)
orders    + customer_cpf, mp_preference_id, payment_status_detail, payment_error,
            paid_at, access_token, coupon_counted   (+ índice em payment_id)
courses   + search_title, search_text, search_disciplines, search_tsv, search_tsv_simple (+ índices GIN)
NOVAS     order_items, search_logs, blog_posts (+ trigger updated_at)
DADOS     migra orders -> order_items; marca coupon_counted nos pedidos já pagos;
          normaliza courses.duration (no boot, via Node)
CMS       novas chaves criadas só se não existirem: como_funciona, reconhecimento, privacidade, termos
v2.1      users + token_version, totp_enabled, totp_secret, totp_pending_secret, totp_last_step,
                  recovery_codes (jsonb), password_changed_at, last_login_at
          NOVAS password_resets (só hash do token), auth_events (histórico de segurança)
v2.2      courses/blog_posts: category 'Superior' -> 'Superior Sequencial'; sinônimos de busca atualizados
```

Nada é apagado nem renomeado.

## 5. API — endpoints novos ou alterados

| Método | Rota | Acesso | Observação |
|---|---|---|---|
| GET | `/courses?per_category=N&limit=N` | público | novos parâmetros |
| GET | `/courses/categories` | público | categoria, contagem e menor preço |
| GET | `/courses/sitemap` | público | slug e updated_at |
| GET | `/courses/slug/:slug` | público | + `related` (3 da mesma categoria); não expõe colunas de busca |
| POST | `/orders/quote` | público | cotação do carrinho |
| POST | `/orders` | público | vários cursos; rate limit; nova resposta (`order`, `mode`, `items`, dados do pagamento) |
| GET | `/orders/:id/public-status?t=` | público com token | status do pedido |
| POST | `/orders/webhook/mercadopago` | MP | reescrito (seção 3.1) |
| GET | `/orders` | admin | + `items`, `coupon_code` |
| GET | `/search`, `/search/popular`; POST `/search/log` | público | busca |
| GET | `/search/report` | admin | relatório |
| GET | `/blog`, `/blog/slug/:slug` | público | posts publicados |
| GET/POST/PUT/DELETE | `/blog/admin/all`, `/blog/admin/:id`, `/blog`, `/blog/:id` | admin | CRUD |
| GET | `/content/testimonials/public?category=&limit=` | público | depoimentos ativos |
| POST | `/auth/login` | público | com 2FA ativo devolve `requires_2fa` + `challenge` (2.1) |
| POST | `/auth/login/2fa` | desafio | código TOTP ou de recuperação → sessão (2.1) |
| GET | `/auth/me` | admin | + `totp_enabled`, `recovery_codes_left`, `email_enabled` (2.1) |
| POST | `/auth/change-password` | admin | mínimo de 10 caracteres, rate limit, encerra outras sessões e devolve token novo |
| POST | `/auth/forgot-password` | público | envia link por e-mail; resposta sempre igual (2.1) |
| GET | `/auth/reset-password/validate?token=` | público | confere o link (2.1) |
| POST | `/auth/reset-password` | público | nova senha pelo link (2.1) |
| POST | `/auth/2fa/setup`, `/auth/2fa/enable`, `/auth/2fa/disable`, `/auth/2fa/recovery-codes` | admin | gestão do 2FA (2.1) |
| GET | `/auth/events` | admin | últimas 30 atividades da conta (2.1) |

## 6. Variáveis de ambiente

| Variável | Serviço | Novo? | Uso |
|---|---|---|---|
| `APP_URL` | backend, frontend (`SITE_URL`) | sim | URL pública (https) |
| `CORS_ORIGINS` | backend | sim | origens extras do CORS |
| `MERCADOPAGO_WEBHOOK_SECRET` | backend | sim | validação do webhook |
| `WHATSAPP_NUMBER` | backend | sim (vem de `NEXT_PUBLIC_WHATSAPP_NUMBER`) | alternativa quando o número do CMS está vazio |
| `JWT_SECRET` | backend, frontend | — | agora sem valor de exemplo |
| `TWOFA_ENCRYPTION_KEY` | backend | sim (2.1) | criptografa os segredos do 2FA; não trocar depois de usar |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | backend | sim (2.1) | e-mails de recuperação e de aviso de segurança |

## 7. Testes

- **Backend:** `cd backend && DATABASE_URL=<banco de TESTE> JWT_SECRET=<32+ caracteres> npm test`.
  - Cobre: cotação, cupom por curso, validações, pedido com vários itens, webhook forjado (401), PIX pendente não vira pago, valor divergente, aprovação e contagem única do cupom, token do status, cupom esgotado, cartão via `external_reference`, formato antigo `course_id`, boleto com CPF, listagem do admin, busca por prefixo e com erro de digitação.
  - O Mercado Pago é simulado. O teste cria e apaga os próprios dados.
  - **2.1:** `npm run test:auth` (também incluído em `npm test`). O envio de e-mail é simulado. Cobre:
    - login e troca de senha que derruba a sessão antiga;
    - "esqueci minha senha": resposta neutra, link de uso único, token só com hash no banco e link expirado;
    - ativação do 2FA com QR code e segredo criptografado;
    - login em 2 etapas, desafio que não vale como sessão e código que não pode ser reutilizado;
    - códigos de recuperação de uso único e geração de novos códigos;
    - desativação com senha + código;
    - os três comandos do script de servidor e o registro de eventos.
  - O TOTP foi conferido com os vetores de teste da RFC 6238.
- **Frontend:** `next build` sem erros de tipo. Testado com Playwright (desktop 1366 px e celular 390 px):
  - busca, "você quis dizer", sem resultado com WhatsApp e navegação por teclado;
  - carrinho com 2 cursos e checkout (modo WhatsApp);
  - barra fixa no celular;
  - admin (conteúdo, depoimentos, blog, buscas, pedidos);
  - **2.1:** esqueci a senha → link → nova senha → link reutilizado recusado → login → ativação do 2FA pelo QR code → sair → login com código do app → login com código de recuperação.
- **nginx:** `nginx -t` sem erros. Teste funcional validou os cabeçalhos de segurança, o redirecionamento 301 do `www`, o cache de `/_next/static` e o proxy de `/api`.
- **Não testado:** Mercado Pago real (sandbox/produção), upload no MinIO e **envio real de e-mail** (depende do SMTP de vocês). Faça os testes dos passos 2.6 e 2.6-B.

## 8. Pendências (não incluídas nesta versão)

1. **E-mail transacional** (confirmação e lembrete de PIX pendente): precisa escolher um provedor (Resend, Brevo…).
2. **Token do admin em cookie `httpOnly`:** hoje fica em `localStorage` + cookie comum, com validade de 7 dias. Na 2.1, a revogação por `token_version` reduz o risco.
7. **2FA obrigatório:** hoje cada admin escolhe se ativa. Tornar obrigatório é uma regra simples no login, se desejado.
8. **Contas de alunos:** o site não tem área do aluno; a recuperação de acesso e o 2FA valem para os administradores do painel.
3. **Reescrita dos textos dos 201 cursos** (problema → benefício → prova): o modelo de página está pronto; o conteúdo pode ser feito em lotes com a skill de cadastro de cursos.
4. **Conteúdo real:** depoimentos, dados das IES, prints ou vídeo da plataforma e artigos do blog.
5. **Revisão jurídica** da Política de Privacidade e dos Termos de Uso.
6. **Parcelamento sem juros:** configuração no painel do Mercado Pago (passo 2.6).

## 9. Arquivos

**Backend**

- Novos: `src/lib/{pricing,mercadopago,settings,cpf,duration}.js`, `src/routes/{search,blog}.js`, `tests/checkout.test.js`, `package-lock.json`.
- Alterados: `src/index.js`, `src/db/schema.sql`, `src/db/index.js`, `src/routes/{orders,courses,content,auth,dashboard}.js`, `package.json`.
- Novos na 2.1: `src/lib/{totp,mailer}.js`, `src/cli/admin-recovery.js`, `tests/auth.test.js`. Alterados na 2.1: `src/routes/auth.js` (reescrito), `src/middleware/auth.js`.

**Frontend**

- Novos:
  - `src/lib/{site,data,categories,schema,cart,analytics}.ts(x)`, `src/components/JsonLd.tsx`
  - `src/components/public/{SearchBox,CartDrawer,AddToCartButton,StickyBuyBar,Testimonials,Breadcrumbs,CategoryCourses,CatalogFilters,LegalPage,Site,Analytics,TrackView,RecordRecent}.tsx`
  - `src/app/{robots,sitemap}.ts`, `src/app/[categoria]/page.tsx`, `src/app/cursos/page.tsx`, `src/app/checkout/{page,layout}.tsx`, `src/app/carrinho/{page,layout}.tsx`
  - `src/app/{como-funciona,reconhecimento-mec,politica-de-privacidade,termos-de-uso}/page.tsx`, `src/app/blog/page.tsx`, `src/app/blog/[slug]/page.tsx`
  - `src/app/admin/{depoimentos,blog,buscas,senha}/page.tsx`
  - 2.1: `src/app/admin/{esqueci-senha,redefinir-senha}/{page,layout}.tsx`, `src/app/admin/login/layout.tsx`, `src/components/admin/{AuthShell,PasswordStrength}.tsx`
- Alterados:
  - `src/app/{layout,page,not-found}.tsx`, `src/app/globals.css`
  - `src/app/cursos/[slug]/page.tsx`, `src/app/checkout/[slug]/page.tsx`, `src/app/checkout/{sucesso,erro}/page.tsx`
  - `src/app/{sobre-nos,perguntas-frequentes}/page.tsx`
  - `src/app/admin/{conteudo,pedidos}/page.tsx`, `src/app/admin/cursos/_components/CourseForm.tsx`
  - `src/components/public/{Header,Footer,CourseCard,CountdownTimer,WhatsAppButton}.tsx`, `src/components/admin/Sidebar.tsx`
  - `src/types/index.ts`, `next.config.js`, `tailwind.config.js`, `package.json`, `package-lock.json`
  - 2.1: `src/app/admin/login/page.tsx`, `src/app/admin/senha/page.tsx`, `src/app/admin/layout.tsx`, `src/middleware.ts`, `src/lib/{auth,api}.ts`

**Raiz**

- Novos: `ALTERACOES.md`, `scripts/backup.sh`.
- Alterados: `docker-compose.yml`, `nginx/nginx.conf`, `.env.example`, `README.md`, `.gitignore`.
