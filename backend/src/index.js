require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const { initDb, pool } = require('./db')
const { normalizeDuration } = require('./lib/duration')

const app = express()
const PORT = process.env.PORT || 3001

// Atrás do nginx: necessário para o rate limit enxergar o IP real do cliente
app.set('trust proxy', 1)

app.use(helmet({ contentSecurityPolicy: false }))

// CORS: antes aberto para qualquer origem ('*'). O site chama a API pelo
// mesmo domínio (/api), então só as origens configuradas são liberadas.
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.APP_URL || '')
  .split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean)
app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
    return cb(null, false)
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}))
app.use(morgan('combined'))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.get('/health', (req, res) => res.json({ status: 'ok' }))

app.use('/auth', require('./routes/auth'))
app.use('/courses', require('./routes/courses'))
app.use('/professors', require('./routes/professors'))
app.use('/content', require('./routes/content'))
app.use('/coupons', require('./routes/coupons'))
app.use('/orders', require('./routes/orders'))
app.use('/upload', require('./routes/upload'))
app.use('/dashboard', require('./routes/dashboard'))
app.use('/search', require('./routes/search'))
app.use('/blog', require('./routes/blog'))

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Erro interno do servidor' })
})

// Avisos de configuração insegura (não impedem o boot, mas aparecem no log)
function securityWarnings() {
  const warn = msg => console.warn(`\n⚠️  SEGURANÇA: ${msg}\n`)
  const jwt = process.env.JWT_SECRET || ''
  if (!jwt || jwt.length < 32 || jwt.includes('change_in_production') || jwt.includes('supersecret')) {
    warn('JWT_SECRET ausente, curto ou igual ao exemplo. Gere um novo: openssl rand -hex 32')
  }
  if (process.env.ADMIN_PASSWORD === 'Admin@2024') {
    warn('ADMIN_PASSWORD está com o valor padrão do README. Troque a senha do admin no painel e no .env.')
  }
  if ((process.env.DATABASE_URL || '').includes('paulopop123')) warn('Senha do banco igual ao exemplo (paulopop123).')
  if (process.env.MINIO_ROOT_PASSWORD === 'minioadmin123') warn('Senha do MinIO igual ao exemplo (minioadmin123).')
  if (!process.env.TWOFA_ENCRYPTION_KEY) {
    warn('TWOFA_ENCRYPTION_KEY não configurada: segredos do 2FA ficarão sem criptografia no banco. Gere: openssl rand -hex 32 (e NUNCA a troque depois de ativar o 2FA).')
  }
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) {
    warn('SMTP não configurado: "Esqueci minha senha" e os avisos de segurança por e-mail não serão enviados. Use o script src/cli/admin-recovery.js enquanto isso.')
  }
  if (process.env.MERCADOPAGO_ACCESS_TOKEN && !process.env.MERCADOPAGO_WEBHOOK_SECRET) {
    warn('MERCADOPAGO_WEBHOOK_SECRET não configurada: a assinatura do webhook não será validada.')
  }
  if (process.env.MERCADOPAGO_ACCESS_TOKEN && !(process.env.APP_URL || '').startsWith('https://')) {
    warn('APP_URL precisa ser https:// para o Mercado Pago enviar webhooks e redirecionar após o cartão.')
  }
}

// Tarefas de manutenção executadas a cada boot (idempotentes)
async function bootTasks() {
  // 1) Normaliza o campo duração ("6-a12-meses" -> "6 a 12 meses")
  const { rows } = await pool.query('SELECT id, duration FROM courses WHERE duration IS NOT NULL')
  let fixed = 0
  for (const r of rows) {
    const n = normalizeDuration(r.duration)
    if (n !== r.duration) {
      await pool.query('UPDATE courses SET duration = $1 WHERE id = $2', [n, r.id])
      fixed++
    }
  }
  if (fixed) console.log(`Duração normalizada em ${fixed} curso(s)`)
  // 2) Reconstrói o índice de busca de todos os cursos
  await pool.query('SELECT refresh_course_search(NULL)')
  console.log('Índice de busca atualizado')
}

async function start() {
  let retries = 10
  while (retries > 0) {
    try {
      await initDb()
      console.log('Banco de dados inicializado')
      break
    } catch (err) {
      retries--
      console.error(`Erro ao conectar ao banco, tentando novamente... (${retries} tentativas restantes)`)
      console.error(err.message)
      await new Promise(r => setTimeout(r, 3000))
    }
  }
  if (retries === 0) {
    console.error('Não foi possível conectar ao banco de dados')
    process.exit(1)
  }

  try { await bootTasks() } catch (err) { console.error('Erro nas tarefas de boot:', err.message) }
  securityWarnings()

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend rodando na porta ${PORT}`)
  })
}

if (require.main === module) start()

module.exports = { app, bootTasks }
