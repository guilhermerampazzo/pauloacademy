// Configuração das categorias: slug da URL, textos das páginas de categoria e do menu.
// O nome (name) é exatamente o valor do campo "category" do curso no banco.
// Categorias novas cadastradas no admin funcionam sem mexer aqui (usam o texto genérico).

export interface CategoryInfo {
  name: string
  slug: string
  label: string          // texto curto do menu
  headline: string       // H1 da página de categoria
  intro: string          // parágrafo de abertura
  audience: string[]     // para quem é
  benefits: { title: string; text: string }[]
  faq: { question: string; answer: string }[]
  seoTitle: string
  seoDescription: string
  order: number
}

export function slugifyCategory(cat: string) {
  return String(cat || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const KNOWN: Record<string, Omit<CategoryInfo, 'name' | 'slug'>> = {
  'eja': {
    label: 'EJA',
    headline: 'EJA online: conclua o Ensino Fundamental ou Médio no seu ritmo',
    intro: 'Parou de estudar e precisa do certificado para um emprego, concurso ou faculdade? A Educação de Jovens e Adultos da Academy Pop é 100% online, com certificado reconhecido e acompanhamento da nossa equipe do início ao fim.',
    audience: ['Quem parou de estudar e quer concluir o Ensino Fundamental ou Médio', 'Quem precisa do certificado para emprego, promoção ou concurso', 'Quem quer entrar em curso técnico ou faculdade'],
    benefits: [
      { title: 'Certificado reconhecido', text: 'Emitido por instituição credenciada, com validade em todo o Brasil.' },
      { title: '100% online', text: 'Estude pelo celular ou computador, no horário que couber na sua rotina.' },
      { title: 'Acompanhamento humano', text: 'Nossa equipe tira dúvidas e acompanha você até o certificado.' },
    ],
    faq: [
      { question: 'Quem pode fazer o EJA?', answer: 'Pessoas a partir de 15 anos para o Ensino Fundamental e a partir de 18 anos para o Ensino Médio, que não concluíram os estudos na idade regular.' },
      { question: 'O certificado do EJA online tem validade?', answer: 'Sim. O certificado é emitido por instituição credenciada e tem validade nacional, igual ao do ensino regular.' },
      { question: 'Posso fazer faculdade depois do EJA?', answer: 'Sim. Com o certificado do Ensino Médio você pode prestar vestibular, Enem e se matricular em cursos técnicos e superiores.' },
    ],
    seoTitle: 'EJA Online Reconhecido pelo MEC – Ensino Médio e Fundamental EAD',
    seoDescription: 'Conclua o Ensino Médio ou Fundamental com o EJA 100% online da Academy Pop. Certificado com validade nacional e acompanhamento do início ao fim.',
    order: 1,
  },
  'tecnico': {
    label: 'Técnico',
    headline: 'Cursos técnicos EAD com diploma reconhecido',
    intro: 'Qualificação profissional rápida para entrar no mercado ou conseguir registro no conselho da sua área. Cursos técnicos 100% online, com diploma de validade nacional.',
    audience: ['Quem quer uma profissão em menos tempo que uma faculdade', 'Quem já atua na área e precisa do diploma técnico para o registro profissional', 'Quem busca promoção ou mudança de carreira'],
    benefits: [
      { title: 'Diploma técnico válido', text: 'Emitido por instituição credenciada, com validade nacional.' },
      { title: 'Estude no seu ritmo', text: 'Conteúdo online disponível a qualquer hora, sem sair de casa.' },
      { title: 'Parcelamento', text: 'Pague no PIX com desconto ou parcele no cartão.' },
    ],
    faq: [
      { question: 'O curso técnico EAD tem o mesmo valor do presencial?', answer: 'Sim. O diploma do curso técnico a distância tem a mesma validade do presencial quando emitido por instituição credenciada.' },
      { question: 'Quais os requisitos para fazer um curso técnico?', answer: 'Em geral, é preciso ter concluído ou estar cursando o Ensino Médio. Confira os requisitos na página de cada curso.' },
    ],
    seoTitle: 'Cursos Técnicos EAD com Diploma Reconhecido | Academy Pop',
    seoDescription: 'Cursos técnicos 100% online com diploma de validade nacional. Enfermagem, Logística, Segurança do Trabalho e mais. Parcele em até 12x.',
    order: 2,
  },
  'graduacao': {
    label: 'Graduação',
    headline: 'Graduação EAD: bacharelado e licenciatura reconhecidos pelo MEC',
    intro: 'Conquiste o diploma de ensino superior estudando online, com mensalidades que cabem no bolso e diploma reconhecido pelo MEC.',
    audience: ['Quem quer o primeiro diploma de nível superior', 'Quem busca uma segunda graduação', 'Quem precisa do diploma para concurso ou promoção'],
    benefits: [
      { title: 'Reconhecido pelo MEC', text: 'Cursos de instituições credenciadas, com diploma válido em todo o país.' },
      { title: 'Flexibilidade', text: 'Aulas online para estudar de onde e quando quiser.' },
      { title: 'Atendimento humano', text: 'Consultores para ajudar da escolha do curso à formatura.' },
    ],
    faq: [
      { question: 'O diploma de graduação EAD é igual ao presencial?', answer: 'Sim. Pela legislação, o diploma de graduação a distância tem a mesma validade do presencial e não informa a modalidade.' },
      { question: 'Posso fazer segunda graduação?', answer: 'Sim. Fale com um consultor para verificar as condições e o aproveitamento de disciplinas.' },
    ],
    seoTitle: 'Graduação EAD Reconhecida pelo MEC | Academy Pop',
    seoDescription: 'Bacharelado e licenciatura 100% online, com diploma reconhecido pelo MEC. Fale com um consultor e comece sua graduação.',
    order: 3,
  },
  'tecnologo': {
    label: 'Tecnólogo',
    headline: 'Graduação tecnológica EAD: diploma de nível superior em menos tempo',
    intro: 'O curso tecnólogo é uma graduação focada no mercado de trabalho, mais curta que o bacharelado e com diploma reconhecido pelo MEC. 100% online, no seu ritmo.',
    audience: ['Quem quer um diploma de graduação em menos tempo', 'Quem já atua na área e quer se qualificar', 'Quem busca promoção, concurso ou uma pós-graduação depois'],
    benefits: [
      { title: 'É graduação', text: 'Diploma de nível superior reconhecido pelo MEC, que permite seguir para a pós-graduação.' },
      { title: 'Foco prático', text: 'Conteúdo voltado para a atuação profissional na área escolhida.' },
      { title: '100% online', text: 'Estude pelo celular ou computador, no horário que couber na sua rotina.' },
    ],
    faq: [
      { question: 'Tecnólogo é curso superior?', answer: 'Sim. O tecnólogo é uma graduação, com diploma de nível superior reconhecido pelo MEC, assim como o bacharelado e a licenciatura.' },
      { question: 'Posso fazer pós-graduação depois do tecnólogo?', answer: 'Sim. Com o diploma de tecnólogo você pode fazer pós-graduação e MBA.' },
    ],
    seoTitle: 'Tecnólogo EAD – Graduação Tecnológica Reconhecida pelo MEC | Academy Pop',
    seoDescription: 'Cursos tecnólogos 100% online: graduação de nível superior em menos tempo, com diploma reconhecido pelo MEC. Fale com um consultor.',
    order: 4,
  },
  'superior-sequencial': {
    label: 'Superior Sequencial',
    headline: 'Superior Sequencial EAD: formação de nível superior focada na sua área',
    intro: 'Os cursos superiores sequenciais de formação específica são de nível superior, mais curtos que uma graduação e voltados para uma área de atuação. 100% online, com certificação de validade nacional.',
    audience: ['Quem concluiu o Ensino Médio e quer uma formação superior mais rápida', 'Profissionais que querem se especializar numa área específica', 'Quem busca crescimento na carreira'],
    benefits: [
      { title: 'Nível superior', text: 'Formação específica emitida por instituição credenciada, com validade nacional.' },
      { title: 'Mais rápido', text: 'Duração menor que a de uma graduação, com foco no que a sua área exige.' },
      { title: 'Suporte dedicado', text: 'Equipe disponível para tirar dúvidas do início ao fim.' },
    ],
    faq: [
      { question: 'Superior Sequencial é o mesmo que graduação?', answer: 'Não. É um curso de nível superior de formação específica, diferente do bacharelado, da licenciatura e do tecnólogo. Fale com um consultor para confirmar se ele atende ao seu objetivo (concurso, promoção ou pós-graduação).' },
      { question: 'Quem pode fazer um curso Superior Sequencial?', answer: 'Quem já concluiu o Ensino Médio. Confira os requisitos na página de cada curso.' },
    ],
    seoTitle: 'Curso Superior Sequencial EAD | Academy Pop',
    seoDescription: 'Cursos superiores sequenciais de formação específica 100% online, com certificação de validade nacional. Conheça os cursos da Academy Pop.',
    order: 5,
  },
  'pos-graduacao': {
    label: 'Pós-Graduação',
    headline: 'Pós-graduação e MBA EAD reconhecidos pelo MEC',
    intro: 'Especialize-se sem parar a sua rotina. Pós-graduações e MBAs 100% online, com certificado de validade nacional, para quem quer promoção, aumento de salário ou pontuação em concursos.',
    audience: ['Profissionais graduados que querem se especializar', 'Servidores públicos que buscam progressão na carreira', 'Quem quer pontuar em concursos e processos seletivos'],
    benefits: [
      { title: 'Certificado reconhecido', text: 'Emitido por instituição credenciada pelo MEC, válido em todo o Brasil.' },
      { title: 'Conclusão flexível', text: 'Estude no seu ritmo, com prazos pensados para quem trabalha.' },
      { title: 'Preço acessível', text: 'Desconto no PIX ou parcelamento no cartão.' },
    ],
    faq: [
      { question: 'A pós-graduação EAD tem o mesmo valor da presencial?', answer: 'Sim. A pós-graduação lato sensu a distância, emitida por instituição credenciada, tem a mesma validade da presencial.' },
      { question: 'Preciso ter graduação para fazer pós?', answer: 'Sim. É necessário ter concluído um curso superior (bacharelado, licenciatura ou tecnólogo).' },
      { question: 'A pós conta para progressão no serviço público?', answer: 'Em geral sim, por ser lato sensu com certificado válido. Confira as regras do seu órgão ou plano de carreira.' },
    ],
    seoTitle: 'Pós-Graduação e MBA EAD Reconhecidos pelo MEC | Academy Pop',
    seoDescription: 'Pós-graduações e MBAs 100% online com certificado de validade nacional. Estude no seu ritmo e pague no PIX ou em até 12x.',
    order: 6,
  },
}

const GENERIC = (name: string): Omit<CategoryInfo, 'name' | 'slug'> => ({
  label: name,
  headline: `Cursos de ${name} EAD`,
  intro: `Conheça os cursos de ${name} da Academy Pop: 100% online, com certificado de validade nacional e atendimento humanizado.`,
  audience: [],
  benefits: [
    { title: 'Certificado reconhecido', text: 'Validade em todo o território nacional.' },
    { title: '100% online', text: 'Estude no seu ritmo, de onde estiver.' },
    { title: 'Suporte dedicado', text: 'Atendimento humano do início ao fim.' },
  ],
  faq: [],
  seoTitle: `Cursos de ${name} EAD | Academy Pop`,
  seoDescription: `Cursos de ${name} 100% online com certificado de validade nacional na Academy Pop.`,
  order: 50,
})

// Menu "Graduação" (dropdown): cada item é uma categoria com página própria.
// "Bacharelado" = categoria "Graduação" (endereço /graduacao).
// As páginas existem mesmo sem cursos cadastrados (mostram "em breve" + WhatsApp).
export const GRADUACAO_MENU: { name: string; label: string }[] = [
  { name: 'Graduação', label: 'Bacharelado' },
  { name: 'Tecnólogo', label: 'Tecnólogo' },
  { name: 'Superior Sequencial', label: 'Superior Sequencial' },
]
export const GRADUACAO_NAMES = new Set(GRADUACAO_MENU.map(g => g.name))

/** Categorias com texto próprio: a página abre mesmo se ainda não houver cursos */
export function knownCategoryName(slug: string): string | null {
  const g = GRADUACAO_MENU.find(x => slugifyCategory(x.name) === slug)
  return g ? g.name : null
}

export function getCategoryInfo(name: string): CategoryInfo {
  const slug = slugifyCategory(name)
  const base = KNOWN[slug] || GENERIC(name)
  return { name, slug, ...base }
}

export function categoryHref(name: string) {
  return `/${slugifyCategory(name)}`
}

export function sortCategories<T extends { category: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => getCategoryInfo(a.category).order - getCategoryInfo(b.category).order)
}

// Rotas de primeiro nível que NÃO podem ser tratadas como categoria
export const RESERVED_SLUGS = new Set([
  'admin', 'api', 'cursos', 'checkout', 'carrinho', 'blog', 'sobre-nos', 'perguntas-frequentes',
  'como-funciona', 'reconhecimento-mec', 'politica-de-privacidade', 'termos-de-uso', 'uploads',
])
