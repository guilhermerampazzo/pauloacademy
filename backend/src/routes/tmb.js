// v2.4: Pagamentos TMB (parcelado sem cartão) – configuração no admin e dados públicos mínimos
const router = require('express').Router()
const { pool } = require('../db')
const { requireAuth } = require('../middleware/auth')
const { appUrl } = require('../lib/settings')
const tmb = require('../lib/tmb')

// Público: só o necessário para a página do curso mostrar "parcele sem cartão"
router.get('/public', async (req, res) => {
  try {
    const cfg = await tmb.getConfig()
    const categories = {}
    if (cfg.enabled) {
      for (const [name, c] of Object.entries(cfg.categories)) {
        const usable = c.active && ((tmb.tokenConfigured() && c.produto_id && c.qtd_parcelas) || (c.link_manual && c.link_manual_valor))
        // v2.4: juros, entrada e parcelas exibidas: a página do curso calcula a tabela para o preço de cada curso
        if (usable) categories[name] = {
          max_parcelas: c.qtd_parcelas || null,
          juros_mes: c.juros_mes ?? tmb.DEFAULT_JUROS,
          entrada_tipo: c.entrada_tipo || 'percentual',
          entrada_valor: c.entrada_valor ?? tmb.DEFAULT_ENTRADA_PCT,
          parcela_minima: c.parcela_minima || tmb.DEFAULT_PARCELA_MINIMA,
        }
      }
    }
    res.set('Cache-Control', 'public, max-age=60')
    res.json({ enabled: cfg.enabled && Object.keys(categories).length > 0, min_value: tmb.MIN_VALUE, categories })
  } catch (err) {
    res.json({ enabled: false })
  }
})

// Admin: configuração + situação (token e webhook configurados?)
router.get('/config', requireAuth, async (req, res) => {
  try {
    const config = await tmb.getConfig()
    const { rows: offers } = await pool.query(
      'SELECT id, category, produto_id, valor, qtd_parcelas, titulo, url, active, created_at FROM tmb_offers ORDER BY created_at DESC LIMIT 100')
    const { rows: events } = await pool.query(
      `SELECT id, order_id, tmb_order_id, status_pedido, fase_checkout, created_at FROM tmb_events ORDER BY created_at DESC LIMIT 20`)
    res.json({
      config,
      status: {
        api_token: tmb.tokenConfigured(),
        webhook_token: tmb.webhookTokenConfigured(),
        webhook_url: `${appUrl() || 'https://academypopeduca.com.br'}/api/orders/webhook/tmb`,
        webhook_header: process.env.TMB_WEBHOOK_HEADER || 'x-tmb-token',
        ga4_api_secret: !!process.env.GA4_API_SECRET,
        min_value: tmb.MIN_VALUE,
      },
      offers,
      events,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao carregar a configuração da TMB' })
  }
})

router.put('/config', requireAuth, async (req, res) => {
  try {
    const data = await tmb.saveConfig(req.body || {})
    res.json({ config: data })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao salvar a configuração da TMB' })
  }
})

// Admin: produtos cadastrados na TMB (para escolher o ID sem copiar à mão)
router.get('/produtos', requireAuth, async (req, res) => {
  if (!tmb.tokenConfigured()) return res.status(400).json({ error: 'Configure TMB_API_TOKEN no servidor para listar os produtos.' })
  try {
    res.json(await tmb.listProdutos())
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

// Admin: desativar uma oferta guardada (a próxima venda cria outra pela API)
router.put('/offers/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('UPDATE tmb_offers SET active = $1 WHERE id = $2 RETURNING *', [!!req.body?.active, req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Oferta não encontrada' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar a oferta' })
  }
})

module.exports = router
