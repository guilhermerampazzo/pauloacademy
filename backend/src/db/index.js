const { Pool, types } = require('pg')

// v2.4: datas sempre em UTC (sessão do banco e leitura no Node), para o agendamento
// do blog e os horários do admin não dependerem do fuso do servidor.
types.setTypeParser(1114, s => (s ? new Date(s.replace(' ', 'T') + 'Z') : s))
const fs = require('fs')
const path = require('path')
const bcrypt = require('bcryptjs')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  options: '-c timezone=UTC',
})

async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8')
  await pool.query(schema)
  console.log('Schema aplicado com sucesso')
  await seedAdmin()
  await seedContent()
  await seedSampleData()
}

async function seedAdmin() {
  const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [process.env.ADMIN_EMAIL])
  if (rows.length > 0) return

  const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10)
  await pool.query(
    'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)',
    [process.env.ADMIN_EMAIL, hash, process.env.ADMIN_NAME]
  )
  console.log(`Admin criado: ${process.env.ADMIN_EMAIL}`)
}

async function seedContent() {
  const sections = [
    {
      key: 'hero',
      title: 'Hero Principal',
      data: {
        headline: 'Transforme sua carreira com educação de qualidade',
        subheadline: 'Cursos EJA, Pós-Graduação e muito mais — 100% EAD, com certificado reconhecido.',
        cta_text: 'Ver Cursos',
        cta_url: '#cursos',
        background_image: '',
        badge_text: 'Mais de 5.000 alunos formados',
      }
    },
    {
      key: 'benefits',
      title: 'Barra de Benefícios',
      data: {
        items: [
          { icon: 'award', text: 'Certificado Reconhecido' },
          { icon: 'monitor', text: '100% Online' },
          { icon: 'clock', text: 'Estude no seu ritmo' },
          { icon: 'headphones', text: 'Suporte Dedicado' },
        ]
      }
    },
    {
      key: 'about',
      title: 'Sobre a Academia',
      data: {
        title: 'Por que escolher a Academy Pop?',
        text: 'Somos especializados em EJA e Compliance, com cursos desenvolvidos por profissionais experientes do mercado. Nossa metodologia é focada na aplicação prática e na sua empregabilidade.',
        image: '',
        stats: [
          { value: '5.000+', label: 'Alunos Formados' },
          { value: '15+', label: 'Cursos Disponíveis' },
          { value: '98%', label: 'Satisfação' },
          { value: '30 dias', label: 'Para emitir certificado' },
        ]
      }
    },
    {
      key: 'footer',
      title: 'Rodapé',
      data: {
        company_name: 'Academy Pop',
        description: 'Educação de qualidade para transformar vidas.',
        whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5511999999999',
        email: 'contato@academypop.com.br',
        address: '',
        instagram: '',
        facebook: '',
        youtube: '',
      }
    }
  ]

  // v2: páginas institucionais editáveis no CMS (só são criadas se não existirem)
  sections.push(
    {
      key: 'como_funciona',
      title: 'Página Como Funciona',
      data: {
        title: 'Como funciona estudar na Academy Pop',
        intro: 'Do primeiro contato ao certificado, você tem acompanhamento em cada etapa. Tudo 100% online, no seu ritmo.',
        steps: [
          { title: 'Escolha o curso', text: 'Encontre o curso ideal pela busca ou fale com um consultor pelo WhatsApp para tirar dúvidas.' },
          { title: 'Faça a matrícula', text: 'Pague por PIX, boleto ou cartão em até 12x. A matrícula é confirmada assim que o pagamento é aprovado.' },
          { title: 'Receba o acesso', text: 'Você recebe os dados de acesso à plataforma de estudos e começa quando quiser.' },
          { title: 'Estude no seu ritmo', text: 'Aulas, materiais e avaliações online, com suporte da nossa equipe sempre que precisar.' },
          { title: 'Receba o certificado', text: 'Concluídas as etapas, o certificado é emitido pela instituição certificadora.' },
        ],
        video_url: '',
        images: [],
      },
    },
    {
      key: 'reconhecimento',
      title: 'Página Reconhecimento MEC',
      data: {
        title: 'Reconhecimento e instituições certificadoras',
        intro: 'A Academy Pop é polo parceiro de instituições credenciadas. Nesta página você confere quem certifica cada tipo de curso e como verificar a regularidade no e-MEC.',
        institutions: [],
        how_to_verify: [
          'Acesse emec.mec.gov.br',
          'Clique em "Consulta Avançada" e pesquise pelo nome da instituição',
          'Confira a situação do credenciamento e dos cursos',
        ],
        diploma_image: '',
      },
    },
    {
      key: 'privacidade',
      title: 'Política de Privacidade',
      data: {
        title: 'Política de Privacidade',
        updated_at: new Date().toISOString().slice(0, 10),
        html: '<p>Esta política explica como a Academy Pop trata os dados pessoais de quem visita o site e de quem se matricula em nossos cursos, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).</p><h2>Dados que coletamos</h2><ul><li>Dados informados por você na matrícula ou no contato: nome, e-mail, telefone/WhatsApp e, quando necessário para o pagamento, CPF.</li><li>Dados de navegação: páginas visitadas, termos pesquisados no site e informações técnicas do dispositivo, coletados por cookies e ferramentas de análise.</li></ul><h2>Para que usamos</h2><ul><li>Processar a matrícula e o pagamento.</li><li>Entrar em contato sobre o seu pedido e o seu curso.</li><li>Enviar informações sobre cursos, quando você autorizar.</li><li>Melhorar o site e medir o desempenho das nossas campanhas.</li></ul><h2>Com quem compartilhamos</h2><p>Com a instituição certificadora do curso escolhido, com o processador de pagamentos (Mercado Pago) e com ferramentas de análise (como Google Analytics e Meta), apenas no necessário para as finalidades acima. Não vendemos dados pessoais.</p><h2>Seus direitos</h2><p>Você pode pedir acesso, correção, portabilidade ou exclusão dos seus dados, e revogar consentimentos, pelos contatos informados no rodapé do site.</p><h2>Segurança e retenção</h2><p>Adotamos medidas técnicas para proteger os dados e os mantemos pelo tempo necessário para cumprir as finalidades e as obrigações legais.</p>',
      },
    },
    {
      key: 'termos',
      title: 'Termos de Uso',
      data: {
        title: 'Termos de Uso',
        updated_at: new Date().toISOString().slice(0, 10),
        html: '<p>Ao usar este site e contratar um curso, você concorda com os termos abaixo.</p><h2>Matrícula</h2><p>A matrícula é confirmada após a aprovação do pagamento. Os dados informados devem ser verdadeiros e completos, pois serão usados na emissão de documentos acadêmicos.</p><h2>Preços e pagamento</h2><p>Os preços exibidos valem para a data da contratação. Pagamentos são processados pelo Mercado Pago por PIX, boleto ou cartão de crédito.</p><h2>Direito de arrependimento</h2><p>Nas compras pela internet, você pode desistir em até 7 dias da contratação, conforme o art. 49 do Código de Defesa do Consumidor, pelos contatos informados no rodapé.</p><h2>Certificação</h2><p>A certificação é emitida pela instituição credenciada responsável pelo curso, após o cumprimento dos requisitos acadêmicos.</p><h2>Contato</h2><p>Dúvidas sobre estes termos podem ser enviadas pelos canais informados no rodapé.</p>',
      },
    }
  )

  for (const section of sections) {
    const { rows } = await pool.query('SELECT id FROM content_sections WHERE key = $1', [section.key])
    if (rows.length === 0) {
      await pool.query(
        'INSERT INTO content_sections (key, title, data) VALUES ($1, $2, $3)',
        [section.key, section.title, JSON.stringify(section.data)]
      )
    }
  }
  console.log('Conteúdo inicial criado')
}

async function seedSampleData() {
  const { rows } = await pool.query('SELECT id FROM courses LIMIT 1')
  if (rows.length > 0) return

  // Professor exemplo
  const profResult = await pool.query(
    `INSERT INTO professors (name, bio, photo, linkedin) VALUES ($1, $2, $3, $4) RETURNING id`,
    [
      'Prof. Dr. Carlos Mendes',
      'Doutor em Educação pela USP, com 15 anos de experiência em EJA e políticas públicas de educação.',
      '',
      'https://linkedin.com'
    ]
  )
  const professorId = profResult.rows[0].id

  await pool.query(`INSERT INTO professor_specialties (professor_id, name) VALUES ($1, $2), ($1, $3)`,
    [professorId, 'EJA', 'Educação de Adultos'])

  // Curso EJA
  const ejaResult = await pool.query(
    `INSERT INTO courses (slug, title, subtitle, description, workload, modality, duration, category, price_pix, price_installment, installments, installment_value, active, featured, whatsapp_message)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
    [
      'curso-eja',
      'Curso EJA – Educação de Jovens e Adultos',
      'Conclua em 4 meses com certificado reconhecido',
      '<h2>Sobre o Curso</h2><p>O Curso EJA é voltado para jovens e adultos que desejam concluir o Ensino Fundamental ou Médio de forma rápida e certificada. Com metodologia adaptada ao perfil adulto, você estuda no seu ritmo, sem abrir mão da qualidade.</p><h2>Para quem é este curso?</h2><ul><li>Adultos que não concluíram os estudos na idade regular</li><li>Profissionais que precisam do diploma para progressão na carreira</li><li>Pessoas que buscam valorização pessoal e profissional</li></ul>',
      200, 'EAD', '4 meses', 'EJA Ensino Médio',
      1350.00, 1350.00, 12, 112.50,
      true, true,
      'Olá! Tenho interesse no Curso EJA. Podem me passar mais informações?'
    ]
  )
  const ejaId = ejaResult.rows[0].id

  await pool.query('INSERT INTO course_professors (course_id, professor_id) VALUES ($1, $2)', [ejaId, professorId])

  const mod1 = await pool.query(
    'INSERT INTO course_modules (course_id, name, workload, order_index) VALUES ($1, $2, $3, $4) RETURNING id',
    [ejaId, 'Módulo 1 – Língua Portuguesa e Literatura', 50, 0]
  )
  await pool.query(`INSERT INTO course_disciplines (module_id, name, order_index) VALUES ($1,$2,$3),($1,$4,$5),($1,$6,$7)`,
    [mod1.rows[0].id, 'Interpretação de Texto', 0, 'Gramática Essencial', 1, 'Produção Textual', 2])

  const mod2 = await pool.query(
    'INSERT INTO course_modules (course_id, name, workload, order_index) VALUES ($1, $2, $3, $4) RETURNING id',
    [ejaId, 'Módulo 2 – Matemática Aplicada', 50, 1]
  )
  await pool.query(`INSERT INTO course_disciplines (module_id, name, order_index) VALUES ($1,$2,$3),($1,$4,$5),($1,$6,$7)`,
    [mod2.rows[0].id, 'Matemática Básica', 0, 'Geometria', 1, 'Estatística', 2])

  const mod3 = await pool.query(
    'INSERT INTO course_modules (course_id, name, workload, order_index) VALUES ($1, $2, $3, $4) RETURNING id',
    [ejaId, 'Módulo 3 – Ciências da Natureza', 50, 2]
  )
  await pool.query(`INSERT INTO course_disciplines (module_id, name, order_index) VALUES ($1,$2,$3),($1,$4,$5)`,
    [mod3.rows[0].id, 'Biologia Básica', 0, 'Química e Física', 1])

  const mod4 = await pool.query(
    'INSERT INTO course_modules (course_id, name, workload, order_index) VALUES ($1, $2, $3, $4) RETURNING id',
    [ejaId, 'Módulo 4 – Ciências Humanas', 50, 3]
  )
  await pool.query(`INSERT INTO course_disciplines (module_id, name, order_index) VALUES ($1,$2,$3),($1,$4,$5)`,
    [mod4.rows[0].id, 'História do Brasil', 0, 'Geografia e Atualidades', 1])

  // Cupom de exemplo para EJA
  await pool.query(
    `INSERT INTO coupons (course_id, code, discount_percent, max_uses, active) VALUES ($1, $2, $3, $4, $5)`,
    [ejaId, 'EJA10', 10.00, 100, true]
  )

  // Depoimento EJA
  await pool.query(
    `INSERT INTO testimonials (name, role, content, course_id, active, order_index) VALUES ($1,$2,$3,$4,$5,$6)`,
    ['Maria Silva', 'Auxiliar Administrativa', 'Depois de 20 anos sem estudar, consegui terminar meu ensino médio em apenas 4 meses! O material é excelente e o suporte foi incrível.', ejaId, true, 0]
  )

  // Professor Compliance
  const profComp = await pool.query(
    `INSERT INTO professors (name, bio, photo, linkedin) VALUES ($1, $2, $3, $4) RETURNING id`,
    [
      'Dr. Ricardo Pinheiro',
      'Especialista em Compliance Corporativo, com passagem por grandes consultorias e órgãos reguladores.',
      '',
      'https://linkedin.com'
    ]
  )
  const profCompId = profComp.rows[0].id
  await pool.query(`INSERT INTO professor_specialties (professor_id, name) VALUES ($1,$2),($1,$3)`,
    [profCompId, 'Compliance', 'Direito Administrativo'])

  // Pós-Graduação Compliance
  const compResult = await pool.query(
    `INSERT INTO courses (slug, title, subtitle, description, workload, modality, duration, category, price_pix, price_installment, installments, installment_value, active, featured, whatsapp_message)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
    [
      'pos-graduacao-compliance',
      'Pós-Graduação em Compliance',
      'Torne-se especialista em conformidade e gestão de riscos corporativos',
      '<h2>Sobre o Curso</h2><p>A Pós-Graduação em Compliance é voltada para profissionais que desejam se especializar na área de conformidade corporativa, gestão de riscos e ética empresarial. Totalmente online com 560 horas e corpo docente especializado.</p><h2>Mercado em Alta</h2><p>O mercado de Compliance cresce 25% ao ano no Brasil, com alta demanda por profissionais qualificados.</p><h2>Para quem é?</h2><ul><li>Advogados e Contadores</li><li>Gestores e Diretores</li><li>Profissionais de RH e Financeiro</li><li>Servidores Públicos</li></ul>',
      560, 'EAD', '18 meses', 'Pós-Graduação',
      1548.00, 1548.00, 12, 129.00,
      true, true,
      'Olá! Tenho interesse na Pós-Graduação em Compliance. Podem me passar mais informações?'
    ]
  )
  const compId = compResult.rows[0].id

  await pool.query('INSERT INTO course_professors (course_id, professor_id) VALUES ($1, $2)', [compId, profCompId])

  const cm1 = await pool.query(
    'INSERT INTO course_modules (course_id, name, workload, order_index) VALUES ($1, $2, $3, $4) RETURNING id',
    [compId, 'Módulo 1 – Fundamentos do Compliance', 80, 0]
  )
  await pool.query(`INSERT INTO course_disciplines (module_id, name, order_index) VALUES ($1,$2,$3),($1,$4,$5),($1,$6,$7)`,
    [cm1.rows[0].id, 'Conceitos e Evolução do Compliance', 0, 'Framework Internacional (ISO 37001)', 1, 'Legislação Brasileira Anticorrupção', 2])

  const cm2 = await pool.query(
    'INSERT INTO course_modules (course_id, name, workload, order_index) VALUES ($1, $2, $3, $4) RETURNING id',
    [compId, 'Módulo 2 – Gestão de Riscos', 80, 1]
  )
  await pool.query(`INSERT INTO course_disciplines (module_id, name, order_index) VALUES ($1,$2,$3),($1,$4,$5)`,
    [cm2.rows[0].id, 'Identificação e Mapeamento de Riscos', 0, 'Controles Internos e Mitigação', 1])

  const cm3 = await pool.query(
    'INSERT INTO course_modules (course_id, name, workload, order_index) VALUES ($1, $2, $3, $4) RETURNING id',
    [compId, 'Módulo 3 – Due Diligence e KYC', 80, 2]
  )
  await pool.query(`INSERT INTO course_disciplines (module_id, name, order_index) VALUES ($1,$2,$3),($1,$4,$5)`,
    [cm3.rows[0].id, 'Know Your Customer (KYC)', 0, 'Due Diligence em Terceiros', 1])

  const cm4 = await pool.query(
    'INSERT INTO course_modules (course_id, name, workload, order_index) VALUES ($1, $2, $3, $4) RETURNING id',
    [compId, 'Módulo 4 – LGPD e Proteção de Dados', 80, 3]
  )
  await pool.query(`INSERT INTO course_disciplines (module_id, name, order_index) VALUES ($1,$2,$3),($1,$4,$5)`,
    [cm4.rows[0].id, 'Fundamentos da LGPD', 0, 'Implementação de Programas de Privacidade', 1])

  const cm5 = await pool.query(
    'INSERT INTO course_modules (course_id, name, workload, order_index) VALUES ($1, $2, $3, $4) RETURNING id',
    [compId, 'Módulo 5 – Canal de Denúncias e Investigação', 80, 4]
  )
  await pool.query(`INSERT INTO course_disciplines (module_id, name, order_index) VALUES ($1,$2,$3),($1,$4,$5)`,
    [cm5.rows[0].id, 'Estruturação do Canal de Denúncias', 0, 'Condução de Investigações Internas', 1])

  const cm6 = await pool.query(
    'INSERT INTO course_modules (course_id, name, workload, order_index) VALUES ($1, $2, $3, $4) RETURNING id',
    [compId, 'Módulo 6 – Prática e TCC', 160, 5]
  )
  await pool.query(`INSERT INTO course_disciplines (module_id, name, order_index) VALUES ($1,$2,$3),($1,$4,$5)`,
    [cm6.rows[0].id, 'Estudo de Casos Reais', 0, 'Trabalho de Conclusão de Curso', 1])

  await pool.query(
    `INSERT INTO testimonials (name, role, content, course_id, active, order_index) VALUES ($1,$2,$3,$4,$5,$6)`,
    ['João Oliveira', 'Gerente de Compliance', 'Excelente programa. Após a pós, fui promovido e triplicamos nossa estrutura de compliance na empresa.', compId, true, 0]
  )

  console.log('Dados de seed inseridos com sucesso')
}

module.exports = { pool, initDb }
