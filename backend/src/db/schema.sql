-- Usuários admin
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Cursos
CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  subtitle VARCHAR(500),
  description TEXT,
  cover_image VARCHAR(500),
  workload INTEGER,
  modality VARCHAR(50) DEFAULT 'EAD',
  duration VARCHAR(100),
  category VARCHAR(100) DEFAULT 'Livre',
  price_pix DECIMAL(10,2) DEFAULT 0,
  price_installment DECIMAL(10,2) DEFAULT 0,
  installments INTEGER DEFAULT 12,
  installment_value DECIMAL(10,2) DEFAULT 0,
  active BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  vacancy_count INTEGER,
  offer_expires_at TIMESTAMP,
  whatsapp_message TEXT,
  seo_title VARCHAR(500),
  seo_description VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Módulos do curso
CREATE TABLE IF NOT EXISTS course_modules (
  id SERIAL PRIMARY KEY,
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  name VARCHAR(500) NOT NULL,
  workload INTEGER DEFAULT 0,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Disciplinas de cada módulo
CREATE TABLE IF NOT EXISTS course_disciplines (
  id SERIAL PRIMARY KEY,
  module_id INTEGER REFERENCES course_modules(id) ON DELETE CASCADE,
  name VARCHAR(500) NOT NULL,
  order_index INTEGER DEFAULT 0
);

-- Professores
CREATE TABLE IF NOT EXISTS professors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  bio VARCHAR(600),
  photo VARCHAR(500),
  linkedin VARCHAR(500),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Especialidades dos professores
CREATE TABLE IF NOT EXISTS professor_specialties (
  id SERIAL PRIMARY KEY,
  professor_id INTEGER REFERENCES professors(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL
);

-- Relação curso-professores
CREATE TABLE IF NOT EXISTS course_professors (
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  professor_id INTEGER REFERENCES professors(id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, professor_id)
);

-- Cupons de desconto
CREATE TABLE IF NOT EXISTS coupons (
  id SERIAL PRIMARY KEY,
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  code VARCHAR(100) UNIQUE NOT NULL,
  discount_percent DECIMAL(5,2) NOT NULL,
  expires_at TIMESTAMP,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seções de conteúdo (CMS)
CREATE TABLE IF NOT EXISTS content_sections (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  title VARCHAR(255),
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Depoimentos
CREATE TABLE IF NOT EXISTS testimonials (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(255),
  content TEXT NOT NULL,
  photo VARCHAR(500),
  course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Pedidos
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  course_id INTEGER REFERENCES courses(id),
  coupon_id INTEGER REFERENCES coupons(id),
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50),
  amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50),
  payment_id VARCHAR(255),
  payment_url TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Seções extras por curso (descrições adicionais)
CREATE TABLE IF NOT EXISTS course_extra_sections (
  id SERIAL PRIMARY KEY,
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  content TEXT,
  image VARCHAR(500),
  order_index INTEGER DEFAULT 0
);

-- FAQ por curso
CREATE TABLE IF NOT EXISTS course_faqs (
  id SERIAL PRIMARY KEY,
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  question VARCHAR(500) NOT NULL,
  answer TEXT NOT NULL,
  order_index INTEGER DEFAULT 0
);

-- Migrações
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='courses' AND column_name='price_original') THEN
    ALTER TABLE courses ADD COLUMN price_original DECIMAL(10,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='courses' AND column_name='discount_percent') THEN
    ALTER TABLE courses ADD COLUMN discount_percent DECIMAL(5,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='professors' AND column_name='role') THEN
    ALTER TABLE professors ADD COLUMN role VARCHAR(100) DEFAULT 'Professor';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='professors' AND column_name='team_type') THEN
    ALTER TABLE professors ADD COLUMN team_type VARCHAR(30) DEFAULT 'docente';
  END IF;
END $$;

-- =====================================================================
-- v2 (2026-09) – carrinho, pagamentos, busca, blog, SEO
-- Tudo idempotente: pode rodar em todo boot sem efeito colateral.
-- =====================================================================

-- Extensões para a busca (fazem parte do contrib do postgres:16-alpine)
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent() não é IMMUTABLE; este wrapper permite usá-lo em índices
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text AS $$
  SELECT public.unaccent('public.unaccent', $1)
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

-- Pedidos: novas colunas
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_cpf VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_preference_id VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status_detail VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_error TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS access_token VARCHAR(64);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_counted BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_orders_payment_id ON orders(payment_id);

-- Itens do pedido (carrinho: vários cursos por pedido)
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
  course_title VARCHAR(500) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) NOT NULL DEFAULT 0,
  final_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- Migra pedidos antigos (1 curso por pedido) para order_items
INSERT INTO order_items (order_id, course_id, course_title, unit_price, discount, final_price, created_at)
SELECT o.id, o.course_id, COALESCE(c.title, 'Curso removido'), o.amount, 0, o.amount, o.created_at
FROM orders o
LEFT JOIN courses c ON c.id = o.course_id
WHERE o.course_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id);

-- Pedidos antigos já pagos: não recontar uso de cupom
UPDATE orders SET coupon_counted = true WHERE status = 'paid' AND coupon_counted = false AND coupon_id IS NOT NULL;

-- Busca de cursos
ALTER TABLE courses ADD COLUMN IF NOT EXISTS search_text TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS search_title TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS search_disciplines TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS search_tsv tsvector;
-- versão sem radicalização: garante que prefixos como "automatizad" achem "automatizado"
ALTER TABLE courses ADD COLUMN IF NOT EXISTS search_tsv_simple tsvector;
CREATE INDEX IF NOT EXISTS idx_courses_search_tsv ON courses USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS idx_courses_search_tsv_simple ON courses USING GIN (search_tsv_simple);
CREATE INDEX IF NOT EXISTS idx_courses_search_title_trgm ON courses USING GIN (search_title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_courses_search_text_trgm ON courses USING GIN (search_text gin_trgm_ops);

-- Sinônimos por categoria (entram no índice com peso B)
CREATE OR REPLACE FUNCTION category_synonyms(cat text) RETURNS text AS $$
  SELECT CASE lower(f_unaccent(coalesce(cat, '')))
    WHEN 'eja' THEN 'eja supletivo ensino medio ensino fundamental jovens adultos terminar estudos'
    WHEN 'pos-graduacao' THEN 'pos posgraduacao pos-graduacao especializacao mba lato sensu'
    WHEN 'graduacao' THEN 'graduacao faculdade bacharelado licenciatura ensino superior'
    WHEN 'superior sequencial' THEN 'superior sequencial sequencial formacao especifica ensino superior curso superior'
    WHEN 'tecnico' THEN 'tecnico curso tecnico profissionalizante'
    WHEN 'tecnologo' THEN 'tecnologo superior graduacao tecnologica'
    WHEN 'livre' THEN 'livre curso livre capacitacao'
    ELSE ''
  END
$$ LANGUAGE sql IMMUTABLE;

-- Recalcula o documento de busca de um curso (ou de todos, se NULL)
CREATE OR REPLACE FUNCTION refresh_course_search(cid integer) RETURNS void AS $$
  WITH disc AS (
    SELECT cm.course_id,
           string_agg(DISTINCT cm.name, ' | ') AS modules,
           string_agg(cd.name, ' | ' ORDER BY cm.order_index, cd.order_index) AS disciplines
    FROM course_modules cm
    LEFT JOIN course_disciplines cd ON cd.module_id = cm.id
    WHERE cid IS NULL OR cm.course_id = cid
    GROUP BY cm.course_id
  )
  UPDATE courses c SET
    search_title = lower(f_unaccent(coalesce(c.title, ''))),
    search_disciplines = coalesce(d.disciplines, ''),
    search_text = lower(f_unaccent(concat_ws(' ',
      c.title, c.category, category_synonyms(c.category), c.subtitle,
      d.modules, d.disciplines,
      regexp_replace(coalesce(c.description, ''), '<[^>]+>', ' ', 'g')))),
    search_tsv =
      setweight(to_tsvector('portuguese', f_unaccent(coalesce(c.title, ''))), 'A') ||
      setweight(to_tsvector('portuguese', f_unaccent(coalesce(c.category, '') || ' ' || category_synonyms(c.category))), 'B') ||
      setweight(to_tsvector('portuguese', f_unaccent(coalesce(d.modules, '') || ' ' || coalesce(d.disciplines, ''))), 'C') ||
      setweight(to_tsvector('portuguese', f_unaccent(coalesce(c.subtitle, '') || ' ' ||
        regexp_replace(coalesce(c.description, ''), '<[^>]+>', ' ', 'g'))), 'D'),
    search_tsv_simple =
      setweight(to_tsvector('simple', f_unaccent(coalesce(c.title, ''))), 'A') ||
      setweight(to_tsvector('simple', f_unaccent(coalesce(c.category, '') || ' ' || category_synonyms(c.category))), 'B') ||
      setweight(to_tsvector('simple', f_unaccent(coalesce(d.modules, '') || ' ' || coalesce(d.disciplines, ''))), 'C') ||
      setweight(to_tsvector('simple', f_unaccent(coalesce(c.subtitle, '') || ' ' ||
        regexp_replace(coalesce(c.description, ''), '<[^>]+>', ' ', 'g'))), 'D')
  FROM (SELECT id FROM courses WHERE cid IS NULL OR id = cid) ids
  LEFT JOIN disc d ON d.course_id = ids.id
  WHERE c.id = ids.id
$$ LANGUAGE sql;

-- Registro das buscas (relatório no admin)
CREATE TABLE IF NOT EXISTS search_logs (
  id SERIAL PRIMARY KEY,
  term VARCHAR(200) NOT NULL,
  results INTEGER NOT NULL DEFAULT 0,
  category VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_search_logs_created ON search_logs(created_at);

-- Blog
CREATE TABLE IF NOT EXISTS blog_posts (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  excerpt VARCHAR(600),
  content TEXT,
  cover_image VARCHAR(500),
  related_category VARCHAR(100),
  author VARCHAR(255),
  published BOOLEAN DEFAULT false,
  published_at TIMESTAMP,
  seo_title VARCHAR(500),
  seo_description VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================================
-- v2.1 (2026-09) – recuperação de senha e autenticação em 2 fatores (admin)
-- =====================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;   -- invalida sessões antigas
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT;                             -- criptografado (TWOFA_ENCRYPTION_KEY)
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_pending_secret TEXT;                     -- durante a ativação
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_last_step BIGINT;                        -- impede reutilizar o mesmo código
ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_codes JSONB NOT NULL DEFAULT '[]';   -- hashes SHA-256
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS password_resets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,     -- SHA-256 do token; o token em si só existe no e-mail
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  requested_ip VARCHAR(64),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);

-- Registro de eventos de segurança (login, falhas, 2FA, recuperação)
CREATE TABLE IF NOT EXISTS auth_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  email VARCHAR(255),
  event VARCHAR(50) NOT NULL,
  ip VARCHAR(64),
  user_agent VARCHAR(300),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_events_created ON auth_events(created_at);

-- v2.2: categoria "Superior" passa a se chamar "Superior Sequencial" (item do menu Graduação)
UPDATE courses SET category = 'Superior Sequencial' WHERE category = 'Superior';
UPDATE blog_posts SET related_category = 'Superior Sequencial' WHERE related_category = 'Superior';

-- =====================================================================
-- v2.4 (2026-09) – menu retrátil, parcelado TMB, blog agendado
-- =====================================================================

-- Menu retrátil: a categoria "EJA" foi dividida em "EJA Ensino Fundamental" e "EJA Ensino Médio".
-- Cursos só de Fundamental -> EJA Ensino Fundamental; os demais (Médio e "Fundamental e Médio") -> EJA Ensino Médio.
-- Depois é só ajustar no admin, se precisar. A página /eja continua existindo e lista os dois.
UPDATE courses SET category = 'EJA Ensino Fundamental'
 WHERE category = 'EJA' AND f_unaccent(lower(title)) LIKE '%fundamental%' AND f_unaccent(lower(title)) NOT LIKE '%medio%';
UPDATE courses SET category = 'EJA Ensino Médio' WHERE category = 'EJA';
UPDATE blog_posts SET related_category = 'EJA Ensino Médio' WHERE related_category = 'EJA';

-- Sinônimos de busca das categorias novas (entram no índice com peso B)
CREATE OR REPLACE FUNCTION category_synonyms(cat text) RETURNS text AS $$
  SELECT CASE lower(f_unaccent(coalesce(cat, '')))
    WHEN 'eja' THEN 'eja supletivo ensino medio ensino fundamental jovens adultos terminar estudos'
    WHEN 'eja ensino fundamental' THEN 'eja supletivo ensino fundamental fundamental jovens adultos terminar estudos'
    WHEN 'eja ensino medio' THEN 'eja supletivo ensino medio segundo grau jovens adultos terminar estudos'
    WHEN 'pos-graduacao' THEN 'pos posgraduacao pos-graduacao especializacao mba lato sensu'
    WHEN 'graduacao' THEN 'graduacao faculdade bacharelado licenciatura ensino superior'
    WHEN 'superior sequencial' THEN 'superior sequencial sequencial formacao especifica ensino superior curso superior'
    WHEN 'tecnico' THEN 'tecnico curso tecnico profissionalizante'
    WHEN 'pos-tecnico' THEN 'pos tecnico pos-tecnico especializacao tecnica'
    WHEN 'tecnologo' THEN 'tecnologo superior graduacao tecnologica'
    WHEN 'tecnico para tecnologo' THEN 'tecnico para tecnologo aproveitamento graduacao tecnologica'
    WHEN 'segunda licenciatura' THEN 'segunda licenciatura 2 licenciatura professor habilitacao'
    WHEN 'segunda graduacao' THEN 'segunda graduacao 2 graduacao faculdade aproveitamento'
    WHEN 'mestrado e doutorado' THEN 'mestrado doutorado stricto sensu pos-graduacao'
    WHEN 'livre' THEN 'livre curso livre capacitacao'
    ELSE ''
  END
$$ LANGUAGE sql IMMUTABLE;

-- Configurações internas (não saem na API pública /content)
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Parcelado TMB: ofertas criadas pela API (uma por produto/preço/parcelas, reaproveitada)
CREATE TABLE IF NOT EXISTS tmb_offers (
  id SERIAL PRIMARY KEY,
  category VARCHAR(100),
  produto_id INTEGER NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  qtd_parcelas INTEGER NOT NULL,
  titulo VARCHAR(200),
  url TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (produto_id, valor, qtd_parcelas)
);

-- Parcelado TMB: registro de todo webhook recebido (auditoria e suporte)
CREATE TABLE IF NOT EXISTS tmb_events (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  tmb_order_id INTEGER,
  status_pedido VARCHAR(50),
  fase_checkout VARCHAR(100),
  payload JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tmb_events_created ON tmb_events(created_at);
-- entrada personalizada da oferta (valor_boleto_entrada na API da TMB): passa a fazer parte da chave da oferta
ALTER TABLE tmb_offers ADD COLUMN IF NOT EXISTS valor_entrada DECIMAL(10,2);
ALTER TABLE tmb_offers DROP CONSTRAINT IF EXISTS tmb_offers_produto_id_valor_qtd_parcelas_key;
CREATE INDEX IF NOT EXISTS idx_tmb_offers_busca ON tmb_offers(produto_id, valor, qtd_parcelas);

-- v2.4 (decisão do cliente em 24/09/2026): Tecnólogo e Superior Sequencial passam a ter o cartão
-- em 12x SEM JUROS sobre o preço do PIX (antes: 12x R$ 249,84 = R$ 2.998,08 contra R$ 2.990,00 no PIX).
-- Roda UMA vez (marca em app_settings); depois o admin pode mudar cada curso livremente.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'migracao_v24_parcela_sem_juros') THEN
    UPDATE courses
       SET price_installment = price_pix,
           installment_value = ROUND(price_pix / NULLIF(installments, 0), 2)
     WHERE category IN ('Tecnólogo', 'Superior Sequencial')
       AND price_pix > 0 AND installments > 0
       AND price_installment > price_pix;
    INSERT INTO app_settings (key, data) VALUES ('migracao_v24_parcela_sem_juros', jsonb_build_object('em', NOW()));
  END IF;
END $$;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS tmb_order_id INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tmb_status VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tmb_phase VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ga_client_id VARCHAR(40);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ga_purchase_sent BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_orders_tmb_order ON orders(tmb_order_id);

-- v2.4: parceiros (instituições de ensino e empresas/convênios), com página própria em /parceiros/{slug}
CREATE TABLE IF NOT EXISTS partners (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL DEFAULT 'ies',          -- 'ies' | 'empresa'
  slug VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  logo VARCHAR(500),
  cover_image VARCHAR(500),
  summary VARCHAR(600),                             -- resumo (lista e Google)
  content TEXT,                                     -- texto da página (editor)
  website VARCHAR(500),
  city VARCHAR(120),
  state VARCHAR(2),
  -- instituição de ensino
  emec_code VARCHAR(30),
  emec_url VARCHAR(500),
  accreditation TEXT,                               -- atos de credenciamento (portaria, data)
  mec_score VARCHAR(20),                            -- CI / IGC
  -- empresa / convênio
  benefit VARCHAR(300),                             -- ex.: 15% de desconto em todos os cursos
  coupon_code VARCHAR(100),
  eligibility TEXT,                                 -- quem pode usar
  -- vínculo com cursos e contato
  related_category VARCHAR(100),
  whatsapp_message TEXT,
  featured BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  seo_title VARCHAR(500),
  seo_description VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_partners_type ON partners(type, active);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_courses_updated_at
    BEFORE UPDATE ON courses
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE OR REPLACE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE OR REPLACE TRIGGER update_blog_posts_updated_at
    BEFORE UPDATE ON blog_posts
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE OR REPLACE TRIGGER update_partners_updated_at
    BEFORE UPDATE ON partners
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
