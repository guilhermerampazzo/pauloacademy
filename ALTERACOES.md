# Academy Pop — versão 2.4: relatório de alterações para o programador

**Data:** 24/09/2026
**Base:** código `pauloacademy-master` (Next.js 14 + Express + PostgreSQL 16 + MinIO + nginx, via Docker Compose)
**Escopo:** SEO técnico, segurança do checkout, carrinho de compras, busca instantânea, páginas de categoria, conversão, blog e páginas institucionais editáveis.
**Novo na 2.1:** recuperação de acesso ao painel ("Esqueci minha senha" por e-mail + script de servidor) e verificação em 2 etapas (2FA) para os administradores.
**Novo na 2.2:** menu "Graduação" com os subitens Bacharelado, Tecnólogo e Superior Sequencial; categoria "Superior" renomeada para "Superior Sequencial"; Blog no menu do topo.
**Novo na 2.3:** editor de textos do painel corrigido (parágrafos, colagem do Word/Google Docs e links), inserção de link com busca de cursos e pré-visualização do artigo antes de publicar. **Não há migração de banco nem variável de ambiente nova nesta versão.**
**Novo na 2.4:** correção do painel que abria a versão antiga (cache de 1 ano), **parcelado sem cartão da TMB** (PIX ou boleto) dentro do botão "Matricular agora", **menu retrátil** de cursos com as novas subcategorias, botão de matrícula nas seções adicionais do curso, **blog com rascunho e publicação agendada**, tabelas que cabem no celular, fim do "sem juros" indevido, imagem padrão de compartilhamento home mais leve com micro-cache no nginx e **páginas de parceiros** (instituições de ensino e empresas/convênios) com cadastro no painel e link no menu institucional. **Há migração de banco (automática), variáveis novas no `.env` e mudança no nginx.**
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
| Parágrafos do editor (2.3) | O Enter criava `<div>`, e o site só tinha estilo para `<p>`: o artigo publicado saía com os parágrafos colados, sem espaço entre eles. | O Enter cria `<p>`. O CSS também passou a estilizar `<div>` e `<h1>`, então **o conteúdo já salvo antes também aparece certo**, sem precisar reeditar. |
| Colar do Word / Google Docs (2.3) | Vinha com a formatação de origem (Arial 11pt cinza, margens zeradas, `<span>` e `id` do Docs), fugindo do padrão do site. | O conteúdo colado é limpo automaticamente: sobram só título, parágrafo, negrito, itálico, listas, tabela, link e imagem. A aparência é sempre a do site. |
| Inserir link (2.3) | Uma caixinha pedia a URL digitada na mão. Sem seleção, o link saía com o endereço como texto visível. Todo link abria em nova aba. | Janela com busca de curso pelo nome (o endereço é preenchido sozinho), campo do texto clicável, atalhos para as páginas do site e botão "Remover link". Link interno abre na mesma aba; externo, em nova aba. |
| "Título 1" no editor (2.3) | Gerava um `<h1>` sem estilo (saía do tamanho do texto comum) e um segundo H1 na página, o que atrapalha o Google. | As opções agora são Parágrafo, Título de seção (H2) e Subtítulo (H3). O H1 é só o título do artigo. |
| Ver antes de publicar (2.3) | Rascunho e post agendado devolvem 404 no site: só dava para conferir depois de publicado. | Botão "Ver como vai ficar" no painel, com o visual real do artigo e a prévia de como aparece no Google. O rascunho continua invisível para o público. |
| Painel abrindo a versão antiga (2.4) | `/admin`, `/admin/cursos` e `/admin/conteudo` chegavam com a versão anterior à 2.3, guardada por um cache na frente do servidor com `s-maxage=31536000` (1 ano). O menu aparecia sem Blog, e Cursos e Conteúdo ficavam carregando sem parar. | O painel é sempre dinâmico e sai com `Cache-Control: private, no-store`. O nginx troca qualquer `s-maxage` de 1 ano por `max-age=0, must-revalidate`. **É preciso limpar uma vez o cache antigo na hospedagem (seção 2.0).** |
| Tela em branco depois de um deploy (2.4) | Uma aba aberta antes da atualização ficava "carregando" para sempre (arquivos da versão anterior). | `error.tsx` no site e no painel: se o erro for de arquivo da versão antiga, a página recarrega sozinha uma vez. Nos outros erros, mostra "Tentar de novo". |
| Parcelado sem cartão – TMB (2.4) | Só PIX, cartão e boleto à vista. Os links da TMB eram fixos, com preço diferente do site, e vários estavam vencidos. | Nova opção **"Parcelado sem cartão (PIX ou boleto)"** no checkout do botão "Matricular agora". O site cria a oferta na TMB pela API **no preço do curso**, leva o aluno ao checkout da TMB e o webhook confirma o pedido quando a entrada é paga. Configuração em **Admin → Pagamentos TMB**. |
| Menu de cursos (2.4) | EJA · Técnico · Graduação ▾ · Pós-Graduação · Livre · **Todos os cursos** · Blog. | Menu retrátil: **EJA ▾** (EJA Ensino Fundamental, EJA Ensino Médio) · **Técnico ▾** (Cursos Técnicos, Pós-Técnico) · **Graduação ▾** (Bacharelado, Tecnólogo, Técnico para Tecnólogo, 2ª Licenciatura, 2ª Graduação, Superior Sequencial, Mestrado e Doutorado) · Pós-Graduação · Cursos Livres · Blog. "Todos os cursos" saiu do topo (continua no rodapé). |
| Categoria EJA (2.4) | Uma categoria "EJA" com todos os cursos. | Dividida automaticamente em "EJA Ensino Fundamental" e "EJA Ensino Médio". A página `/eja` continua no ar e lista as duas. |
| Tabelas no celular (2.4) | A tabela "Mercado de trabalho" (em cerca de 9 de cada 10 páginas de curso) passava da tela e a página inteira rolava para o lado. | A tabela rola só dentro do próprio bloco; a página fica na largura do celular. |
| "Sem juros" e parcelas (2.4) | 114 cursos (Tecnólogo e Superior Sequencial) anunciavam "12x de R$ 249,84 sem juros", que somam R$ 2.998,08, contra R$ 2.990,00 no PIX. O parcelado da TMB não mostrava valores. | **Decisão do cliente:** o cartão passa a ser 12x **sem juros** sobre o preço do PIX (12x R$ 249,17), por uma migração que roda uma vez. O cartão de preço mostra "sem juros" só quando é verdade e, logo abaixo, o bloco **"Boleto ou PIX parcelado"**: entrada, **todos os planos do link a partir de 3x** (03x, 04x … até o máximo do produto, ex.: 36x), "Taxa de juros do financiamento: de 1 a 36 parcelas, 3,49% a.m." e "sujeito a aprovação". Onde o parcelado soma mais que o PIX, a expressão "sem juros" continua sendo retirada dos textos. |
| Seções adicionais do curso (2.4) | Sem botão de compra entre as seções. | Cada seção adicional termina com **"Matricular agora"** e o preço. |
| Blog (2.4) | Um botão "Salvar" e a caixa "Publicado"; a data era gravada 3 horas deslocada (fuso). | Botões **Salvar como rascunho**, **Salvar**, **Programar publicação** (data e hora de Brasília) e **Publicar agora**. A lista mostra rascunho, agendado para… e publicado. O post agendado entra no ar sozinho. |
| Compartilhamento (2.4) | Home, categorias e páginas institucionais sem imagem no WhatsApp/Facebook. | Imagem padrão 1200×630 (`/og-default.jpg`), trocável em **Conteúdo → Rastreamento e compartilhamento**. |
| Home e velocidade (2.4) | 6 cursos por categoria (451 KB de HTML no ar) e a página montada a cada visita (TTFB de cerca de 1 s). | 3 cursos por categoria (uma linha) e **micro-cache de 30 s no nginx** para as páginas públicas: a maioria das visitas recebe a página pronta. Checkout, carrinho e painel ficam fora do cache. |
| Parceiros (2.4) | Não havia onde apresentar as instituições que certificam os cursos nem as empresas e convênios. | Cadastro em **Admin → Parceiros** (instituição de ensino ou empresa/convênio) e páginas `/parceiros` e `/parceiros/{endereço}`, com dados do e-MEC (IES) ou benefício, cupom e regras (convênio). Link só no menu institucional: rodapé e menu do celular. |

---

## 2. Como publicar (passo a passo)

> Tempo estimado: 30–45 min. Faça fora do horário de pico.

> **Se você já está na 2.3 e vai só para a 2.4:** faça o backup (2.1), substitua os arquivos (2.2), acrescente as variáveis da TMB e do GA4 no `.env` (2.3, bloco "v2.4"), rode `docker compose up -d --build` (2.5) e **limpe o cache antigo do painel (2.0)**. Depois configure a TMB (2.6-C) e confira a seção 2.7. As migrações rodam sozinhas: dividem a categoria "EJA" e criam as tabelas da TMB. O nginx mudou (micro-cache e cabeçalhos do painel).

> **Se você já está na 2.2 e vai só para a 2.3:** as mudanças são só de frontend. Substitua os arquivos (seção 2.2), rode `docker compose build frontend && docker compose up -d frontend` e confira a seção 2.7. Não há migração de banco, variável nova nem mudança no backend, no nginx ou no compose.

### 2.0 Limpar o cache antigo do painel (2.4 – uma vez)

Em 24/09/2026, `/admin`, `/admin/cursos` e `/admin/conteudo` chegavam com a versão **anterior à 2.3**. A resposta vinha **sem** os cabeçalhos de segurança que o nginx do projeto sempre coloca (`X-Frame-Options`, `X-Content-Type-Options`), com `Cache-Control: s-maxage=31536000` e `x-nextjs-cache: HIT`. Com `?1` no fim do endereço, a versão certa aparecia. Ou seja: **existe um cache na frente do nginx do projeto** (painel da hospedagem, proxy reverso do servidor ou CDN) guardando a página antiga por 1 ano.

1. Descubra quem está na frente: `curl -sI https://academypopeduca.com.br/admin/cursos` e compare com `curl -sI https://academypopeduca.com.br/admin/professores` (esta vem certa). Procure cabeçalhos como `x-cache`, `cf-cache-status`, `x-litespeed-cache`, `x-proxy-cache`. No servidor, `sudo nginx -T 2>/dev/null | grep -n proxy_cache` mostra se o nginx **do servidor** (fora do Docker) tem cache.
2. Limpe esse cache (botão "Purge/Limpar cache" do painel da hospedagem ou da CDN; no nginx do servidor, apague a pasta de `proxy_cache_path` e rode `sudo systemctl reload nginx`).
3. De preferência, configure esse cache para **respeitar** `Cache-Control: private/no-store` e para **não** guardar `/admin`, `/api`, `/checkout` e `/carrinho`.
4. Confira: `curl -sI https://academypopeduca.com.br/admin/cursos | grep -iE "cache-control|x-robots"` deve mostrar `private, no-store, max-age=0` e `noindex, nofollow` (depois de subir a 2.4).

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

# v2.4 – parcelado sem cartão (TMB) e vendas da TMB no GA4
TMB_API_TOKEN=                                  # portal da TMB > Produtos > TMB API (não envie por WhatsApp/e-mail)
TMB_WEBHOOK_TOKEN=<gere com: openssl rand -hex 24>   # o mesmo texto vai no campo "Valor" do webhook na TMB
TMB_WEBHOOK_HEADER=x-tmb-token                  # opcional: nome do cabeçalho ("Chave" na TMB)
GA4_API_SECRET=                                 # GA4 > Administrador > Fluxos de dados > site > Chaves secretas do Measurement Protocol
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

Na 2.4, o nginx passa a usar a pasta `/var/cache/nginx/academypop` **dentro do container** (micro-cache de 30 s). Ela some a cada `docker compose up -d --build`, então não sobra página velha depois de um deploy. Para limpar sem reiniciar: `docker compose exec nginx sh -c 'rm -rf /var/cache/nginx/academypop/*' && docker compose exec nginx nginx -s reload`.

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

### 2.6-C Parcelado sem cartão – TMB (2.4)

Situação no portal da TMB em 24/09/2026 (conferida só em leitura): produtos novos com início em **28/09/2026** – Tecnólogo EAD (R$ 2.990, até 31/12/2027), Graduação Tecnólogo 12 meses LA/UNICV (R$ 2.990, até 31/12/2027), Técnico para Tecnólogo (R$ 2.990, até 31/12/2027), Curso Técnico Nível Médio (R$ 1.188, até 31/12/2027) e **Pós-Graduação e MBA LA (R$ 999, só até 24/10/2026)**; "Cursos Superiores Sequenciais" (até 05/06/2027) e "TTI" continuam ativos. Nenhum webhook configurado. Taxas do produto novo: R$ 1,00 por operação, juros de 2,30% a.m. (1 a 36x) e comissão de 5% (1 a 24x).

1. **`.env`:** preencha `TMB_API_TOKEN` e `TMB_WEBHOOK_TOKEN` (2.3) e rode `docker compose up -d backend`. Sem o token da API, dá para usar links fixos por categoria, mas só para cursos com o mesmo preço do link.
2. **Webhook, em cada produto usado:** TMB → Produtos → (produto) → Integrações → **Webhook Vendas** → Nova configuração:
   - Nome: `AcademyPop site`
   - URL: `https://academypopeduca.com.br/api/orders/webhook/tmb`
   - Chave: `x-tmb-token`
   - Valor: o mesmo texto de `TMB_WEBHOOK_TOKEN`
   - Status: Ativo
   Faça o mesmo em **Webhook Etapas do Checkout** (opcional: mostra em Pedidos em que passo o aluno parou).
3. **Admin → Pagamentos TMB:** ligue "Mostrar Parcelado sem cartão no checkout" e, em cada categoria, marque **Ativo**, escolha o **produto TMB** (com o token, a lista vem da própria TMB) e a **quantidade de parcelas**. Salve.
4. **Teste:** num curso da categoria configurada, clique em "Matricular agora" → "Parcelado sem cartão" → "Continuar para o parcelamento". O site deve abrir o checkout da TMB com o preço do curso. Em **Pagamentos TMB → Ofertas criadas pelo site** aparece a oferta. Depois de uma venda real, confira em **Pedidos** se o status muda sozinho para "Pago" e, na TMB, o "Histórico de interações" do webhook (deve mostrar sucesso).
5. **Pontos a confirmar com a TMB** (o código já trata os dois casos):
   - se o link da oferta aceita `utm_source`, `utm_campaign` e `utm_content` na URL e devolve essas UTMs no webhook (se não devolver, o site acha o pedido pelo e-mail do aluno);
   - se a oferta criada pela API usa "PIX Parcelado TMB e Boleto Parcelado TMB" (a API não tem esse campo; no portal é uma escolha da oferta);
   - o valor mínimo por oferta (a documentação de Ofertas diz R$ 144) e o limite de parcelas por valor;
   - o nome do vendedor que aparece no checkout (hoje "PAULO OLIVEIRA PINTO").
6. **Renovação:** produtos e ofertas da TMB têm data de término. Produto vencido faz o link dar "Erro 400 – Oferta expirada" e o pedido aparece com erro em Pedidos. **O produto de Pós vence em 24/10/2026.**

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

# 2.4
curl -sI https://academypopeduca.com.br/admin/cursos | grep -iE "cache-control|x-robots"   # private, no-store / noindex
curl -sI https://academypopeduca.com.br/ | grep -i x-cache; curl -sI https://academypopeduca.com.br/ | grep -i x-cache   # MISS e depois HIT
curl -s https://academypopeduca.com.br/api/tmb/public                                      # {"enabled":true,...} depois de configurar
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://academypopeduca.com.br/api/orders/webhook/tmb \
     -H 'content-type: application/json' -d '{"status_pedido":"Efetivado"}'                   # esperado 401 (sem o token)
curl -s -o /dev/null -w "%{http_code}\n" https://academypopeduca.com.br/eja                   # 200
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
- [ ] **2.4:** o painel abre direto (sem `?1`) com Blog, Depoimentos, Buscas, Pagamentos TMB e Segurança no menu; Cursos e Conteúdo carregam.
- [ ] **2.4:** menu do topo: EJA, Técnico e Graduação abrem os subitens (no celular, cada grupo abre e fecha); "Todos os cursos" não aparece no topo.
- [ ] **2.4:** `/eja` lista os cursos de EJA Fundamental e Médio; confira em Admin → Cursos se cada curso de EJA ficou na categoria certa.
- [ ] **2.4:** página de um curso Tecnólogo no celular: a tabela "Mercado de trabalho" rola sozinha, a página não anda para o lado e não aparece "sem juros".
- [ ] **2.4:** cada seção adicional do curso termina com "Matricular agora".
- [ ] **2.4:** checkout de 1 curso de categoria configurada mostra "Parcelado sem cartão"; com 2 cursos ou com cupom, não mostra.
- [ ] **2.4:** Blog → Novo post → Programar publicação para daqui a 5 minutos → o post aparece no site sozinho (em até 2 minutos depois do horário).
- [ ] **2.4:** rodapé → Institucional → **Parceiros** abre `/parceiros` com as seções "Instituições de ensino" e "Empresas e convênios"; o menu do topo (computador) não mostra "Parceiros"; no celular, aparece junto de Sobre nós.
- [ ] **2.4:** compartilhar a home no WhatsApp mostra a imagem da Academy Pop (o WhatsApp pode levar um tempo para atualizar a prévia de links já enviados).

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
| **Pagamentos TMB (2.4)** | Ligar a opção, escolher o produto TMB e as parcelas de cada categoria (seção 2.6-C). |
| **Conteúdo → Rastreamento e compartilhamento (2.4)** | Opcional: trocar a imagem padrão de compartilhamento (1200 × 630 px). |
| **Cursos (2.4)** | Conferir a categoria dos cursos de EJA (Fundamental ou Médio). Cadastrar cursos nas categorias novas (Pós-Técnico, Técnico para Tecnólogo, 2ª Licenciatura, 2ª Graduação, Mestrado e Doutorado). Até ter cursos, essas páginas mostram "em breve" + WhatsApp e ficam fora do Google. |
| **Parceiros (2.4)** | Cadastrar as instituições de ensino (código e-MEC, atos de credenciamento, link da consulta no e-MEC, logo) e as empresas/convênios (benefício, cupom criado em Cupons, quem pode usar). Só aparecem no site os marcados como "Mostrar no site". |
| **Mercado Pago (2.4, obrigatório)** | Tecnólogo e Superior Sequencial passam a anunciar **12x sem juros no cartão**. No painel do Mercado Pago, configure o parcelamento **sem juros para o comprador em até 12x** (a escola assume a taxa). Sem isso, o Checkout Pro cobra juros do aluno e o anúncio deixa de ser verdade. |
| **Pagamentos TMB → tabela (2.4)** | Conferir por categoria: taxa de juros do financiamento (padrão 3,49% a.m., de 1 a 36 parcelas, campo editável), entrada (padrão 10% do preço) e parcela mínima exibida (padrão 3; a página mostra todos os planos até o máximo). A prévia mostra os valores para o menor preço da categoria. Confirme com a TMB se a taxa e a entrada batem com o contrato de cada produto (os produtos novos mostram 2,30% a.m. no portal; o cliente definiu mostrar 3,49% a.m.). |
| Cursos | Desmarcar "Destaque" dos que não são destaque (hoje 169 de 201). Revisar textos que citam prazos diferentes do campo "Duração". Remover "Vagas restantes" e "Oferta expira em" onde não forem reais. |

### 2.10 Voltar à versão anterior (rollback)

```bash
docker compose down
# restaure os arquivos antigos do projeto
gunzip -c backup_antes_v2.sql.gz | docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME"   # só se necessário
cp .env.antes_v2 .env && docker compose up -d --build
```

**2.4:** a migração troca a categoria "EJA" por "EJA Ensino Fundamental"/"EJA Ensino Médio". Para voltar à 2.3 sem restaurar o banco: `UPDATE courses SET category = 'EJA' WHERE category IN ('EJA Ensino Fundamental','EJA Ensino Médio');` (o resto só acrescenta tabelas e colunas).

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

### 3.11 Editor do painel, links e pré-visualização do blog (v2.3)

Levantado ao preparar a série de artigos do blog: o cadastro funcionava, mas o resultado publicado saía fora do padrão. Vale para o blog **e** para os textos de curso e das páginas institucionais, porque todos usam o mesmo editor.

**a) Parágrafos colados um no outro**

- **Como era:** o editor (`contentEditable`) usava o padrão do Chrome e criava `<div>` a cada Enter. O CSS `.prose-content` tinha regra para `p`, `h2`, `h3`, `ul`, `ol`, `a` e `strong`, mas **não para `div`** — resultado: margem 0 e o artigo virava um bloco único.
- **Como ficou:** `document.execCommand('defaultParagraphSeparator', false, 'p')` na montagem do editor; o conteúdo novo sai em `<p>`. Para o que já está salvo, o CSS ganhou `.prose-content div` (mesmo espaçamento de `p`), `h1`, `img`, `blockquote`, `table`, `th`, `td` e listas aninhadas. **Nada precisa ser reeditado.**

**b) Limpeza do conteúdo colado**

- **Como era:** colar do Word ou do Google Docs trazia `style="font-size:11pt;font-family:Arial;color:#1f1f1f"`, `class="MsoNormal"`, `<span id="docs-internal-guid-...">` e margens zeradas. O trecho colado aparecia menor e cinza no meio do artigo.
- **Como ficou:** `onPaste` limpa o HTML antes de inserir. Sobrevivem `p, br, strong, em, u, s, h2, h3, ul, ol, li, a, img, blockquote, table, thead, tbody, tr, th, td`; `b→strong`, `i→em`, `h1→h2`, `h4/h5/h6→h3`, `div` com texto→`p` (e `div` que só embrulha outros blocos é descartado); todo `style`, `class` e `id` é removido. Testado com HTML real do Word e do Google Docs.

**c) Inserir link (o que mais pesa para vender dentro do artigo)**

- **Como era:** `window.prompt('URL do link:')`. Com 201 cursos, cada link do artigo dependia de digitar o endereço certo na mão — fonte provável de 404. Sem texto selecionado, o Chrome criava o link mostrando a própria URL como texto. E o código forçava `target="_blank"` em **todos** os links da caixa, inclusive os internos.
- **Como ficou:** janela "Inserir link" com:
  - campo **"Palavra ou frase que fica clicável"** (já vem preenchido com o texto selecionado);
  - **busca de curso pelo nome** (usa `GET /search`, o mesmo motor da busca do site) — ao escolher, o endereço `/cursos/{slug}` é preenchido sozinho;
  - atalhos para as categorias e páginas do site (Todos os cursos, Blog, Como funciona, Reconhecimento MEC, Perguntas frequentes, Sobre nós);
  - campo livre para colar qualquer endereço;
  - link interno abre **na mesma aba**; link externo recebe `target="_blank" rel="noopener noreferrer"`;
  - novo botão **"Remover link"** na barra de ferramentas.

**d) Estilos de texto**

- "Título 1" saiu da lista (gerava `<h1>` sem estilo e um segundo H1 na página). As opções são **Parágrafo**, **Título de seção** (H2) e **Subtítulo** (H3).

**e) Pré-visualização antes de publicar**

- **Como era:** `GET /blog/slug/:slug` só devolve post com `published = true` e `published_at <= NOW()`. Rascunho e post agendado davam 404 — não havia como conferir antes de publicar.
- **Como ficou:** tela nova `/admin/blog/preview/{id}` (exige login, lê por `GET /blog/admin/:id`) com o visual real do artigo, o aviso de situação (rascunho / agendado para… / no ar) e a prévia de como o post aparece no Google (título, endereço e descrição com a contagem de caracteres). Botões: **"Ver como vai ficar"** no formulário e na lista de posts. **O rascunho continua invisível para o público** — a regra do site não mudou.

**Arquivos:**

- `frontend/src/components/admin/RichTextEditor.tsx` (reescrito)
- `frontend/src/app/admin/blog/page.tsx` (botões de pré-visualização e dica de link)
- `frontend/src/app/admin/blog/preview/[id]/page.tsx` (novo)
- `frontend/src/app/globals.css` (bloco “v2.3”)

**Sem impacto no banco e no `.env`.** Basta recompilar o frontend (seção 2.2/2.5).

---

### 3.12 Versão 2.4: cache do painel, TMB, menu retrátil, blog agendado, parceiros e ajustes do monitoramento

Origem: monitoramento do site e do painel em 24/09/2026 (só leitura) e pedidos do cliente no mesmo dia.

**a) Painel entregue na versão antiga (cache de 1 ano)**

- **Como era:** o App Router pré-gerava páginas do painel como estáticas, com `Cache-Control: s-maxage=31536000, stale-while-revalidate`. Um cache na frente do servidor guardou `/admin`, `/admin/cursos` e `/admin/conteudo` de uma versão anterior à 2.3 (arquivo `main-app-6de3c3100b91a0a9.js`, enquanto o resto do site usa `main-app-2a5d4c19ce891f66.js`). Resultado: menu sem Blog/Depoimentos/Buscas/Segurança e Cursos/Conteúdo carregando sem parar. Não havia `error.tsx`, então o erro de arquivo antigo (`ChunkLoadError`) virava "carregando" infinito.
- **Como ficou:**
  - `app/admin/layout.tsx` virou componente de servidor com `dynamic = 'force-dynamic'`, `revalidate = 0` e `robots: noindex`. A casca do painel (menu lateral) foi para `components/admin/AdminShell.tsx`.
  - nginx: `location /admin` com `Cache-Control: private, no-store, max-age=0` e `X-Robots-Tag: noindex, nofollow`; em `location /`, um `map` troca `s-maxage=31536000` por `public, max-age=0, must-revalidate`. Os cabeçalhos de segurança foram repetidos nesses blocos (um `add_header` no `location` anula os do `server`).
  - `app/error.tsx` e `app/admin/error.tsx` (componente `ErrorFallback`): com `ChunkLoadError` a página recarrega sozinha uma vez (trava de 30 s contra laço); nos outros erros, "Tentar de novo" e "Recarregar a página".
- **Arquivos:** `frontend/src/app/admin/layout.tsx`, `frontend/src/components/admin/AdminShell.tsx` (novo, era o layout), `frontend/src/components/ErrorFallback.tsx` (novo), `frontend/src/app/error.tsx` (novo), `frontend/src/app/admin/error.tsx` (novo), `nginx/nginx.conf`.

**b) Parcelado sem cartão – TMB no botão "Matricular agora"**

- **Como era:** o site só tinha PIX, cartão e boleto à vista (Mercado Pago). A TMB era usada com links fixos criados à mão, com preço por categoria diferente do site (ex.: Superior Sequencial R$ 1.490 na TMB e R$ 2.990 no site), sem aviso de venda para o site.
- **Como ficou:**
  - **Botão único:** "Matricular agora" continua levando a `/checkout?curso=ID`. Lá aparece a 4ª forma de pagamento, **"Parcelado sem cartão – PIX ou boleto em até Nx"**, com a explicação (checkout da TMB, análise de cadastro, juros da TMB, matrícula confirmada ao pagar a entrada). O botão vira "Continuar para o parcelamento". `/checkout?curso=ID&pagamento=tmb` já abre com a opção marcada.
  - **Regras (servidor, `lib/tmb.js` → `availability`):** integração ligada; 1 curso por vez; sem cupom; categoria ativa; preço ≥ R$ 144 (mínimo da TMB); com token da API e produto/parcelas configurados **ou** link fixo com o mesmo valor do curso. A cotação (`POST /orders/quote`) devolve `tmb: { available, reason, max_parcelas }`.
  - **Pedido (`POST /orders` com `payment_method: 'tmb'`):** grava o pedido pendente e pega o link da oferta: reaproveita a oferta já criada para o mesmo produto, valor e parcelas (tabela `tmb_offers`) ou cria uma nova com `POST https://api.tmbeducacao.com.br/api/ofertas` (`titulo`, `produto_id`, `valor_principal` = preço PIX do curso, `qtd_parcelas`). Acrescenta `utm_source=academypop`, `utm_medium=site`, `utm_campaign=<slug do curso>` e `utm_content=pedido-<id>` e devolve `mode: 'tmb'` + `payment_url`. O navegador vai para a TMB. Erro na TMB (ex.: produto expirado) fica em `orders.payment_error`, e o aluno vê a tela "Não conseguimos gerar o pagamento" com "Tentar outra forma de pagamento" e WhatsApp.
  - **Webhook (`POST /orders/webhook/tmb`):** exige o cabeçalho `x-tmb-token` igual a `TMB_WEBHOOK_TOKEN` (comparação em tempo constante; 401 se faltar). Acha o pedido por `utm_content`/`utm_last_content` = `pedido-<id>`, depois pelo número do pedido TMB e, por último, pelo e-mail (pedido TMB pendente dos últimos 30 dias). `Efetivado` → pago (usa o mesmo `markPaid` do Mercado Pago; valor menor que o pedido fica bloqueado com aviso); `Cancelado` → reembolsado (se já pago) ou falhou; `fase_checkout` (Etapas do Checkout) → só registra a etapa. Todo aviso fica em `tmb_events`. Campos novos da TMB são ignorados, como pede a documentação.
  - **GA4:** a venda confirmada pela TMB vai ao GA4 pelo servidor (Measurement Protocol, `lib/ga4.js`), com o `client_id` do cookie `_ga` capturado no checkout (`orders.ga_client_id`). Precisa de `GA4_API_SECRET`.
  - **Admin → Pagamentos TMB (tela nova):** situação (token da API, token do webhook, GA4), URL/Chave para colar na TMB, liga/desliga, tabela por categoria (Ativo, produto TMB – lista puxada da API –, parcelas, link fixo e valor), ofertas criadas (com desativar/reativar) e os últimos 20 avisos recebidos. A configuração fica na tabela nova `app_settings`, **fora** da API pública `/content`. O token nunca aparece no painel.
  - **Página do curso:** o cartão de preço mostra "ou parcele sem cartão no PIX ou boleto em até Nx (TMB, sujeito a análise)" e "Aceita PIX · Cartão · Boleto · Parcelado sem cartão" quando a categoria está configurada (`GET /tmb/public`, sem IDs nem links).
  - **Pedidos:** forma "parcelado TMB", etapa/status da TMB e número do pedido na TMB.
- **Arquivos:** backend `src/lib/tmb.js` (novo), `src/lib/ga4.js` (novo), `src/routes/tmb.js` (novo), `src/routes/orders.js`, `src/index.js`, `src/db/schema.sql`; frontend `src/app/checkout/page.tsx`, `src/lib/cart.tsx`, `src/lib/data.ts`, `src/app/cursos/[slug]/page.tsx`, `src/app/admin/tmb/page.tsx` (novo), `src/app/admin/pedidos/page.tsx`, `src/components/admin/Sidebar.tsx`, `src/types/index.ts`; raiz `docker-compose.yml`, `.env.example`.

**c) "Sem juros" de verdade e tabela do parcelado na caixa de compra**

- **Como era:** 114 cursos (Tecnólogo e Superior Sequencial) com PIX R$ 2.990,00 e cartão 12x R$ 249,84 (= R$ 2.998,08) diziam "12x de R$ 249,84 sem juros" no texto e na meta description. O parcelado da TMB aparecia só como "parcele sem cartão", sem valores.
- **Como ficou:**
  - **Decisão do cliente (24/09/2026): cartão em 12x sem juros.** Migração única em `schema.sql` (marca `migracao_v24_parcela_sem_juros` em `app_settings`): nos cursos de Tecnólogo e Superior Sequencial com parcelado maior que o PIX, `price_installment = price_pix` e `installment_value = price_pix / installments` (R$ 2.990,00 → 12x R$ 249,17). Roda uma vez: o que for mudado depois no admin fica. O checkout no cartão passa a cobrar o preço do PIX. **Configure no Mercado Pago o parcelamento sem juros para o comprador (seção 2.9).**
  - **Cartão de preço:** "ou 12x de R$ 249,17 **sem juros** no cartão" (o "sem juros" só aparece quando parcelas × valor não passa do PIX + R$ 0,10).
  - **Bloco "Boleto ou PIX parcelado (sem cartão)"** logo abaixo, quando a TMB está ativa para a categoria: "Entrada de R$ X + de 3 a N parcelas" e **todos os planos do link a partir de 3x** até o máximo do produto (ex.: curso de R$ 2.990, 10% de entrada, 3,49% a.m. e máximo de 36: 34 planos, de 03x R$ 960,33 a 36x R$ 132,43; 12x R$ 278,31), numa grade de 4 colunas (3 no celular) e "Taxa de juros do financiamento: de 1 a 36 parcelas, 3,49% a.m. Sujeito a aprovação de cadastro pela TMB. Valores estimados: o valor final aparece no checkout da TMB". O mesmo quadro aparece no checkout quando o aluno escolhe "Parcelado sem cartão", e a linha de preço das seções adicionais cita "boleto/PIX parcelado em até Nx".
  - **Conta:** entrada = percentual do preço ou valor fixo (limitada a 50% do preço); o restante é dividido pela tabela Price com os juros ao mês informados (`lib/pricing.ts > tmbSimulate`, igual a `lib/tmb.js > simulate` no backend). A lista vai da parcela mínima (padrão 12) até o máximo de parcelas configurado para a categoria (sem máximo informado: 36).
  - **Admin → Pagamentos TMB:** por categoria ativa, "Taxa de juros do financiamento (% a.m.)" (padrão 3,49, taxa informada pela TMB para 1 a 36 parcelas; editável), "Entrada" (padrão 10, em % do preço ou R$ fixo) e "Mostrar planos a partir de" (padrão 3 parcelas; a página mostra todos até o máximo), com prévia dos valores. Com o token da API, a entrada é enviada à TMB ao criar a oferta (`valor_boleto_entrada`) e passa a fazer parte da chave da oferta guardada (`tmb_offers.valor_entrada`). No link fixo vale a entrada que estiver no link.
  - **Textos:** onde o parcelado ainda soma mais que o PIX (outras categorias), a expressão "sem juros" continua sendo retirada do subtítulo, da descrição, das seções adicionais, do FAQ, do SEO, do JSON-LD e do card (`honestText`), e o cadastro do curso mostra um aviso.
- **Arquivos:** `backend/src/db/schema.sql`, `backend/src/lib/tmb.js`, `backend/src/routes/{tmb,orders}.js`; `frontend/src/lib/pricing.ts` (novo), `frontend/src/components/public/TmbTable.tsx` (novo), `frontend/src/app/cursos/[slug]/page.tsx`, `frontend/src/app/checkout/page.tsx`, `frontend/src/app/admin/tmb/page.tsx`, `frontend/src/components/public/CourseCard.tsx`, `frontend/src/app/admin/cursos/_components/CourseForm.tsx`.

**d) Menu retrátil e categorias novas**

- **Como era:** o menu era montado com as categorias do banco; só "Graduação" tinha submenu; "Todos os cursos" ficava no topo.
- **Como ficou:**
  - `MENU_GROUPS` e `MENU_SINGLE` em `lib/categories.ts` definem o menu: **EJA ▾** (EJA Ensino Fundamental, EJA Ensino Médio), **Técnico ▾** (Cursos Técnicos = categoria "Técnico", Pós-Técnico), **Graduação ▾** (Bacharelado = "Graduação", Tecnólogo, Técnico para Tecnólogo, 2ª Licenciatura = "Segunda Licenciatura", 2ª Graduação = "Segunda Graduação", Superior Sequencial, Mestrado e Doutorado), Pós-Graduação, Cursos Livres (= "Livre") e Blog. "Todos os cursos" saiu do topo (continua no rodapé e em `/cursos`). Pós-Graduação continua como item próprio (148 cursos).
  - Computador: cada grupo abre ao passar o mouse ou clicar e fecha com Esc, clique fora ou ao sair. Celular: cada grupo é um acordeão.
  - Categorias criadas no admin fora do menu entram como itens soltos (nada some).
  - Categorias do menu sem cursos abrem uma página própria com texto, "em breve" e WhatsApp, fora do Google (`noindex`) até ter cursos. Textos novos (título, introdução, para quem é, FAQ, SEO) para EJA Fundamental, EJA Médio, Pós-Técnico, Técnico para Tecnólogo, 2ª Licenciatura, 2ª Graduação, Mestrado e Doutorado (com o alerta sobre CAPES/validade) e Cursos Livres (deixa claro que não é reconhecido pelo MEC).
  - **Página de grupo `/eja`:** reúne EJA Ensino Fundamental, EJA Ensino Médio e a categoria antiga "EJA" (a URL já está no Google). Entra no sitemap.
  - Migração: cursos "EJA" só de Fundamental → "EJA Ensino Fundamental"; os demais (Médio e "Fundamental e Médio") → "EJA Ensino Médio"; posts do blog com "EJA" → "EJA Ensino Médio". Sinônimos de busca das categorias novas.
  - Cadastro de curso e Conteúdo → Páginas de Categoria usam a lista do menu (com o nome do menu entre parênteses).
- **Arquivos:** `frontend/src/lib/categories.ts`, `frontend/src/components/public/Header.tsx`, `frontend/src/app/[categoria]/page.tsx`, `frontend/src/app/sitemap.ts`, `frontend/src/app/admin/cursos/_components/CourseForm.tsx`, `frontend/src/app/admin/conteudo/page.tsx`, `backend/src/db/schema.sql`, `backend/src/db/index.js` (dados de exemplo).

**e) Botão "Matricular agora" nas seções adicionais**

- **Como era:** as seções adicionais da descrição (cadastradas no curso) não tinham chamada para a compra; o aluno precisava voltar ao topo ou esperar o fim da página.
- **Como ficou:** cada seção termina com **"Matricular agora"** (mesmo destino do botão principal) e a linha de preço (PIX, cartão e "parcelado sem cartão" quando houver). Curso sem preço mostra "Quero me matricular" pelo WhatsApp.
- **Arquivos:** `frontend/src/app/cursos/[slug]/page.tsx`.

**f) Blog: rascunho, salvar e publicação agendada**

- **Como era:** um botão "Salvar", a caixa "Publicado" e um campo de data. A data do `datetime-local` (hora de Brasília) era gravada como UTC: o post agendado para 09:00 entrava no ar às 06:00.
- **Como ficou:**
  - botões **Salvar como rascunho**, **Salvar** (mantém o status), **Programar publicação** (abre data e hora de Brasília → "Agendar") e **Publicar agora** (post já publicado mantém a data original);
  - selo de status no formulário e na lista: rascunho, **agendado · dd/mm hh:mm**, publicado · data;
  - o formulário continua aberto depois de salvar, para usar a pré-visualização;
  - backend: a data chega em ISO com fuso e é gravada em UTC (`timestamptz`); a conexão com o banco usa `timezone=UTC` e o Node lê `timestamp` como UTC. A regra pública (`published = true` e `published_at <= NOW()`) não mudou: o agendado entra no ar sozinho, e o blog e o post se atualizam em até 2 minutos.
- **Arquivos:** `frontend/src/app/admin/blog/page.tsx`, `backend/src/routes/blog.js`, `backend/src/db/index.js`.

**g) Tabelas no celular**

- **Como era:** `.prose-content table` tinha `width: 100%` sem rolagem própria. Numa amostra de 29 páginas de curso, 26 tinham tabela; no celular (390 px) a página ficava com 622 px e rolava para o lado.
- **Como ficou:** a tabela vira um bloco com `overflow-x: auto` (rola só ela), fonte e espaçamento menores até 640 px e largura mínima por coluna para não quebrar números no meio.
- **Arquivos:** `frontend/src/app/globals.css` (bloco "v2.4").

**h) Imagem de compartilhamento**

- **Como era:** só cursos e posts tinham `og:image`. A home ainda declarava `twitter:card = summary_large_image` sem imagem.
- **Como ficou:** `/og-default.jpg` (1200 × 630, 71 KB) no `openGraph` e no `twitter` do layout e das páginas de categoria. Pode ser trocada em **Conteúdo → Rastreamento e compartilhamento** (campo `tracking.og_image`).
- **Arquivos:** `frontend/public/og-default.jpg` (novo), `frontend/src/app/layout.tsx` (`generateMetadata`), `frontend/src/app/[categoria]/page.tsx`, `frontend/src/lib/data.ts`, `frontend/src/app/admin/conteudo/page.tsx`.

**i) Home mais leve e micro-cache**

- **Como era:** 6 cursos por categoria (451 KB de HTML medidos no ar em 24/09; cerca de 26 KB com gzip) e toda página pública montada a cada visita (TTFB de cerca de 1 s na primeira visita).
- **Como ficou:**
  - home com 3 cursos por categoria (uma linha no computador) e "Ver todos (N)". No teste local, com os mesmos dados, a home caiu de 280 KB para 228 KB; no ar, com 342 cursos, a queda deve ser maior (metade dos cards).
  - nginx com **micro-cache de 30 s** para as páginas públicas (`proxy_cache paginas`): a primeira visita monta a página; as seguintes recebem a cópia pronta (no teste local, a resposta caiu de ~45 ms para menos de 3 ms no servidor). Fica de fora: `/api`, `/admin`, `/checkout`, `/carrinho` e quem está logado no painel (cookie `admin_token`). O cabeçalho `X-Cache` (HIT/MISS) ajuda a conferir. As mudanças do painel aparecem no site em até 30 s (antes: 60 s a 5 min, pelo cache de dados do Next).
- **Arquivos:** `frontend/src/app/page.tsx`, `nginx/nginx.conf`.

**j) Páginas de parceiros (instituições de ensino e empresas/convênios)**

- **Como era:** não existia. As instituições certificadoras apareciam só em textos soltos (Reconhecimento MEC, Sobre nós), e não havia página para convênios com empresas, sindicatos e associações.
- **Como ficou:**
  - **Admin → Parceiros (tela nova):** botões "Nova instituição" e "Nova empresa/convênio"; lista separada por tipo, com logo, destaque, ordem, visível/oculto e alerta quando o cupom do convênio não existe ou está inativo.
    - Campos comuns: nome, endereço (slug), resumo, logo, imagem de capa, texto (mesmo editor do blog), site oficial, cidade/UF, categoria de cursos mostrada na página, mensagem do WhatsApp, SEO, destaque, ordem e "Mostrar no site".
    - Instituição de ensino: código e-MEC, conceito (CI/IGC), atos de credenciamento e link da consulta no e-MEC.
    - Empresa/convênio: benefício, cupom (escolhido da lista de Cupons, com aviso se não existir) e quem pode usar/como comprovar.
  - **`/parceiros`:** duas seções (Instituições de ensino, Empresas e convênios) com cards e o bloco "Sua empresa ou associação quer ser parceira?" com WhatsApp.
  - **`/parceiros/{endereço}`:** logo, tipo, cidade, resumo, texto; quadro "Credenciamento no MEC" (IES) ou "Condição do convênio" (o cupom só aparece se estiver ativo e dentro da validade); WhatsApp com mensagem própria, botão para a categoria de cursos e os 6 primeiros cursos dela; JSON-LD `CollegeOrUniversity`/`Organization` e `BreadcrumbList`. Parceiro oculto ou inexistente dá 404.
  - **Menu:** "Parceiros" entrou **só no menu institucional** (rodapé → Institucional e parte institucional do menu do celular). Não aparece na barra de cursos do topo. Também entrou nos atalhos do "Inserir link" do editor e no sitemap.
- **Arquivos:** backend `src/routes/partners.js` (novo), `src/index.js`, `src/db/schema.sql`, `tests/v24.test.js`; frontend `src/app/parceiros/page.tsx` (novo), `src/app/parceiros/[slug]/page.tsx` (novo), `src/app/admin/parceiros/page.tsx` (novo), `src/lib/{data,schema,categories}.ts`, `src/components/public/{Footer,Header}.tsx`, `src/components/admin/{Sidebar,RichTextEditor}.tsx`, `src/app/sitemap.ts`.

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
v2.4      courses: category 'EJA' -> 'EJA Ensino Fundamental' (título só com "fundamental") ou 'EJA Ensino Médio' (demais)
          blog_posts: related_category 'EJA' -> 'EJA Ensino Médio'
          category_synonyms(): sinônimos das categorias novas
          NOVAS app_settings (config interna, fora do /content), tmb_offers (UNIQUE produto_id+valor+qtd_parcelas),
                tmb_events (todo webhook recebido, com o payload)
          orders + tmb_order_id, tmb_status, tmb_phase, ga_client_id, ga_purchase_sent (+ índice em tmb_order_id)
          tmb_offers + valor_entrada (a chave única antiga produto+valor+parcelas foi removida; índice de busca)
          courses: Tecnólogo/Superior Sequencial com parcelado > PIX -> cartão = PIX, 12x sem juros (UMA vez)
          NOVA  partners (parceiros: tipo ies/empresa, dados do e-MEC, benefício, cupom, SEO; trigger updated_at)
          conexão do backend com timezone=UTC
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
| POST | `/orders/quote` | público | + `tmb: { available, reason, max_parcelas, simulacao: { entrada, juros_mes, opcoes[] } }` (2.4) |
| POST | `/orders` | público | aceita `payment_method: 'tmb'` e `ga_client_id`; resposta `mode: 'tmb'` + `payment_url` (2.4) |
| POST | `/orders/webhook/tmb` | TMB (cabeçalho `x-tmb-token`) | Vendas e Etapas do Checkout; 401 sem token (2.4) |
| GET | `/tmb/public` | público | categorias com parcelado sem cartão: máximo de parcelas, juros, entrada e parcela mínima exibida; sem IDs, links ou token (2.4) |
| GET/PUT | `/tmb/config` | admin | configuração, situação, ofertas e últimos avisos (2.4) |
| GET | `/tmb/produtos` | admin | lista de produtos da conta na TMB (via API) (2.4) |
| PUT | `/tmb/offers/:id` | admin | ativar/desativar oferta guardada (2.4) |
| POST/PUT | `/blog`, `/blog/:id` | admin | `published_at` em ISO com fuso, gravado em UTC (2.4) |
| GET | `/partners?type=ies\|empresa`, `/partners/slug/:slug` | público | parceiros ativos; página com cursos da categoria e cupom só se ativo (2.4) |
| GET/POST/PUT/DELETE | `/partners/admin/all`, `/partners/admin/:id`, `/partners`, `/partners/:id` | admin | cadastro de parceiros (2.4) |

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
| `TMB_API_TOKEN` | backend | sim (2.4) | cria ofertas e lista produtos na API da TMB |
| `TMB_WEBHOOK_TOKEN` | backend | sim (2.4) | segredo do webhook (campo "Valor" na TMB); sem ele o webhook é recusado |
| `TMB_WEBHOOK_HEADER` | backend | sim (2.4, opcional) | nome do cabeçalho do webhook (padrão `x-tmb-token`) |
| `TMB_API_URL` | backend | sim (2.4, opcional) | padrão `https://api.tmbeducacao.com.br` |
| `GA4_API_SECRET` | backend | sim (2.4, opcional) | envia ao GA4 as vendas confirmadas pela TMB |

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
  - **2.3 (editor e blog):** digitar 3 parágrafos e conferir que saem em `<p>` com espaçamento no artigo publicado; colar HTML real do Google Docs e do Word e conferir que `style`, `class` e `id` foram removidos (`b→strong`, `i→em`, `h1→h2`, listas e tabela preservadas); selecionar uma palavra, buscar o curso pelo nome na janela de link e conferir o `href` gerado (`/cursos/{slug}`, sem `target`); link externo com `target="_blank" rel="noopener noreferrer"`; botão "Remover link"; reabrir um post salvo e conferir que o conteúdo carrega no editor; pré-visualizar um rascunho (que continua 404 no site) e um post agendado.
- **2.4 – backend:** `npm run test:v24` (incluído em `npm test`; a API da TMB é simulada). Cobre: migração EJA (e rodar de novo sem mudar nada); TMB desligada; config só com login; `/tmb/public` e `/content` sem token, produto ou link; regras (1 curso, sem cupom, mínimo R$ 144); oferta criada no preço do curso com UTMs do pedido e reaproveitada; link fixo; webhook sem token (401); etapa do checkout; "Efetivado" com valor menor bloqueado e correto marcando pago; pedido achado pelo e-mail; "Cancelado"; erro da TMB gravado no pedido; blog agendado (404 antes, 200 depois, horário sem deslocar o fuso); migração única do 12x sem juros (só Tecnólogo/Superior Sequencial, uma vez); simulação da TMB no quote e entrada enviada na oferta; parceiros (cadastro só com login, slug único, lista e página pública, oculto fora do site, cupom só se ativo). Os testes das versões anteriores continuam passando. A migração também foi testada num banco criado com o `schema.sql` da 2.3.
- **2.4 – navegador (Playwright, 42 verificações, 1366 px e 390 px, pelo nginx):** menu retrátil (3 grupos, itens e sem "Todos os cursos"; acordeão no celular); `/eja` e página "em breve" com `noindex`; `og:image` na home e na categoria; "sem juros" retirado onde o parcelado soma mais e mantido onde é verdade (inclusive nos cards); cartão de preço com "parcele sem cartão"; "Matricular agora" nas seções adicionais; checkout com "Parcelado sem cartão", explicação, botão e redirecionamento para a TMB com `utm_content=pedido-N`; `?pagamento=tmb`; erro da TMB com "Tentar outra forma de pagamento"; 7 páginas sem rolagem lateral em 390 px; tabela rolando dentro do bloco; barra fixa; admin: Pagamentos TMB, blog (lista com os 3 status, agendar com data e hora – 09:30 de Brasília gravado como 12:30 UTC –, salvar rascunho), aviso de "sem juros" e categorias novas no cadastro, Conteúdo e Pedidos.
- **2.4 – parceiros no navegador (23 verificações):** "Parceiros" no rodapé e no menu do celular e fora do topo; `/parceiros` com as duas seções; página da IES (e-MEC, conceito, atos, cursos, JSON-LD) e do convênio (benefício, cupom, regras, botão); 404; sitemap; 390 px sem rolagem lateral; admin (lista por tipo, aviso de cupom inexistente, cupom ativo reconhecido, parceiro criado aparece no site).
- **2.4 – caixa de compra (13 verificações, 1366 e 390 px):** "12x de R$ 249,17 sem juros"; bloco "Boleto ou PIX parcelado" com entrada R$ 299,00 e os 34 planos de 03x R$ 960,33 a 36x R$ 132,43; "Taxa de juros do financiamento: de 1 a 36 parcelas, 3,49% a.m." e "sujeito a aprovação"; tabela no checkout; campos e prévia em Pagamentos TMB; sem rolagem lateral no celular.
- **2.4 – nginx:** `nginx -t` sem erros; teste com upstream local: `/admin` com `private, no-store` e `noindex`; resposta com `s-maxage=31536000` reescrita para `max-age=0, must-revalidate`; micro-cache MISS → HIT na home; checkout sem micro-cache; cabeçalhos de segurança presentes.
- **2.4 – não testado:** API real da TMB (o ambiente de teste não acessa `api.tmbeducacao.com.br`), webhook real da TMB, envio ao GA4 pelo Measurement Protocol e a limpeza do cache da hospedagem (seção 2.0). Faça os passos 2.0 e 2.6-C.
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
6. **Parcelamento sem juros no Mercado Pago:** obrigatório configurar na 2.4 para Tecnólogo e Superior Sequencial (seção 2.9). Nas outras categorias, o site continua retirando o "sem juros" onde ele não é verdade.
9. **TMB – confirmações com a TMB (2.4):** UTMs no link e no webhook, forma de pagamento das ofertas criadas pela API (PIX + boleto), valor mínimo e nome do vendedor no checkout (seção 2.6-C).
10. **Meta (Facebook) – conversão das vendas TMB (2.4):** a venda vai ao GA4 pelo servidor, mas não ao Meta Pixel (precisa da API de Conversões da Meta e de um token).
11. **Página de confirmação do pedido com endereço próprio** (PIX/boleto): continua no backlog.
12. **Eventos duplicados no GA4:** apagar no Google Analytics as regras `begin_checkout` e `contato_whatsapp` criadas sem código em 24/09 (o site já envia `begin_checkout` e `whatsapp_click`).
13. **Ideias do benchmark com a Hotmart (2.4, no backlog):** simulador de parcelas na página do curso, recuperação de checkout abandonado pelo WhatsApp, link de parcelamento exclusivo para consultores e antecipação dos recebíveis da TMB.

## 9. Arquivos

**Backend**

- Novos: `src/lib/{pricing,mercadopago,settings,cpf,duration}.js`, `src/routes/{search,blog}.js`, `tests/checkout.test.js`, `package-lock.json`.
- Alterados: `src/index.js`, `src/db/schema.sql`, `src/db/index.js`, `src/routes/{orders,courses,content,auth,dashboard}.js`, `package.json`.
- Novos na 2.1: `src/lib/{totp,mailer}.js`, `src/cli/admin-recovery.js`, `tests/auth.test.js`. Alterados na 2.1: `src/routes/auth.js` (reescrito), `src/middleware/auth.js`.
- Novos na 2.4: `src/lib/{tmb,ga4}.js`, `src/routes/{tmb,partners}.js`, `tests/v24.test.js`. Alterados na 2.4: `src/routes/{orders,blog}.js`, `src/index.js`, `src/db/{schema.sql,index.js}`, `package.json`.

**Frontend**

- Novos:
  - `src/lib/{site,data,categories,schema,cart,analytics}.ts(x)`, `src/components/JsonLd.tsx`
  - `src/components/public/{SearchBox,CartDrawer,AddToCartButton,StickyBuyBar,Testimonials,Breadcrumbs,CategoryCourses,CatalogFilters,LegalPage,Site,Analytics,TrackView,RecordRecent}.tsx`
  - `src/app/{robots,sitemap}.ts`, `src/app/[categoria]/page.tsx`, `src/app/cursos/page.tsx`, `src/app/checkout/{page,layout}.tsx`, `src/app/carrinho/{page,layout}.tsx`
  - `src/app/{como-funciona,reconhecimento-mec,politica-de-privacidade,termos-de-uso}/page.tsx`, `src/app/blog/page.tsx`, `src/app/blog/[slug]/page.tsx`
  - `src/app/admin/{depoimentos,blog,buscas,senha}/page.tsx`
  - 2.1: `src/app/admin/{esqueci-senha,redefinir-senha}/{page,layout}.tsx`, `src/app/admin/login/layout.tsx`, `src/components/admin/{AuthShell,PasswordStrength}.tsx`
  - 2.3: `src/app/admin/blog/preview/[id]/page.tsx`
  - 2.4: `src/app/admin/{tmb,parceiros}/page.tsx`, `src/app/parceiros/page.tsx`, `src/app/parceiros/[slug]/page.tsx`, `src/app/error.tsx`, `src/app/admin/error.tsx`, `src/components/ErrorFallback.tsx`, `src/components/admin/AdminShell.tsx` (antigo `app/admin/layout.tsx`), `src/lib/pricing.ts`, `src/components/public/TmbTable.tsx`, `public/og-default.jpg`
- Alterados:
  - `src/app/{layout,page,not-found}.tsx`, `src/app/globals.css`
  - `src/app/cursos/[slug]/page.tsx`, `src/app/checkout/[slug]/page.tsx`, `src/app/checkout/{sucesso,erro}/page.tsx`
  - `src/app/{sobre-nos,perguntas-frequentes}/page.tsx`
  - `src/app/admin/{conteudo,pedidos}/page.tsx`, `src/app/admin/cursos/_components/CourseForm.tsx`
  - `src/components/public/{Header,Footer,CourseCard,CountdownTimer,WhatsAppButton}.tsx`, `src/components/admin/Sidebar.tsx`
  - `src/types/index.ts`, `next.config.js`, `tailwind.config.js`, `package.json`, `package-lock.json`
  - 2.1: `src/app/admin/login/page.tsx`, `src/app/admin/senha/page.tsx`, `src/app/admin/layout.tsx`, `src/middleware.ts`, `src/lib/{auth,api}.ts`
  - 2.3: `src/components/admin/RichTextEditor.tsx` (reescrito), `src/app/admin/blog/page.tsx`, `src/app/globals.css`
  - 2.4: `src/app/admin/layout.tsx` (agora de servidor), `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/[categoria]/page.tsx`, `src/app/cursos/[slug]/page.tsx`, `src/app/checkout/page.tsx`, `src/app/sitemap.ts`, `src/app/globals.css`, `src/app/admin/{blog,conteudo,pedidos}/page.tsx`, `src/app/admin/cursos/_components/CourseForm.tsx`, `src/components/public/{Header,Footer,CourseCard}.tsx`, `src/components/admin/{Sidebar,RichTextEditor}.tsx`, `src/lib/{categories,data,cart,schema}.ts(x)`, `src/types/index.ts`

**Raiz**

- Novos: `ALTERACOES.md`, `scripts/backup.sh`.
- Alterados: `docker-compose.yml`, `nginx/nginx.conf`, `.env.example`, `README.md`, `.gitignore`.
- 2.4: `ALTERACOES.md`, `docker-compose.yml` (variáveis da TMB e do GA4 no backend), `nginx/nginx.conf` (painel sem cache, troca do `s-maxage` de 1 ano, micro-cache), `.env.example`.
