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
  // v2.4: novas categorias do menu retrátil
  'eja-ensino-fundamental': {
    label: 'EJA Ensino Fundamental',
    headline: 'EJA Ensino Fundamental online: conclua o 6º ao 9º ano no seu ritmo',
    intro: 'Não terminou o Ensino Fundamental? Com o EJA online você conclui essa etapa estudando pelo celular ou computador e recebe o certificado de validade nacional, emitido por instituição credenciada.',
    audience: ['Quem tem 15 anos ou mais e não concluiu o Ensino Fundamental', 'Quem precisa do certificado para trabalhar ou fazer um curso', 'Quem quer seguir depois para o EJA Ensino Médio'],
    benefits: [
      { title: 'Certificado com validade nacional', text: 'Emitido por instituição credenciada, igual ao do ensino regular.' },
      { title: '100% online', text: 'Estude no horário que couber na sua rotina.' },
      { title: 'Acompanhamento humano', text: 'Nossa equipe acompanha você até o certificado.' },
    ],
    faq: [
      { question: 'Qual a idade mínima para o EJA Ensino Fundamental?', answer: 'A partir de 15 anos completos, conforme as regras da Educação de Jovens e Adultos.' },
      { question: 'Depois posso fazer o EJA Ensino Médio?', answer: 'Sim. Com o certificado do Fundamental você pode se matricular no EJA Ensino Médio.' },
    ],
    seoTitle: 'EJA Ensino Fundamental Online com Certificado | Academy Pop',
    seoDescription: 'Conclua o Ensino Fundamental pelo EJA 100% online, com certificado de validade nacional e acompanhamento do início ao fim.',
    order: 1.1,
  },
  'eja-ensino-medio': {
    label: 'EJA Ensino Médio',
    headline: 'EJA Ensino Médio online: conclua o Ensino Médio no seu ritmo',
    intro: 'Termine o Ensino Médio estudando online e receba o certificado de validade nacional, emitido por instituição credenciada. Ideal para emprego, concurso, curso técnico ou faculdade.',
    audience: ['Quem tem 18 anos ou mais e não concluiu o Ensino Médio', 'Quem precisa do certificado para emprego, promoção ou concurso', 'Quem quer entrar em curso técnico ou faculdade'],
    benefits: [
      { title: 'Certificado com validade nacional', text: 'Emitido por instituição credenciada, igual ao do ensino regular.' },
      { title: '100% online', text: 'Estude pelo celular ou computador, no seu horário.' },
      { title: 'Acompanhamento humano', text: 'Nossa equipe tira dúvidas e acompanha você até o certificado.' },
    ],
    faq: [
      { question: 'Qual a idade mínima para o EJA Ensino Médio?', answer: 'A partir de 18 anos completos, conforme as regras da Educação de Jovens e Adultos.' },
      { question: 'Posso fazer faculdade depois do EJA?', answer: 'Sim. Com o certificado do Ensino Médio você pode prestar vestibular, Enem e se matricular em cursos técnicos e superiores.' },
    ],
    seoTitle: 'EJA Ensino Médio Online com Certificado | Academy Pop',
    seoDescription: 'Conclua o Ensino Médio pelo EJA 100% online, com certificado de validade nacional e acompanhamento do início ao fim.',
    order: 1.2,
  },
  'pos-tecnico': {
    label: 'Pós-Técnico',
    headline: 'Pós-Técnico EAD: especialização técnica para quem já é técnico',
    intro: 'A especialização técnica de nível médio (pós-técnico) aprofunda a sua formação numa área específica. É para quem já concluiu um curso técnico e quer se destacar no mercado.',
    audience: ['Técnicos formados que querem se especializar', 'Quem busca promoção ou uma nova função na área', 'Quem precisa comprovar especialização técnica'],
    benefits: [
      { title: 'Foco na sua área', text: 'Conteúdo específico para quem já atua como técnico.' },
      { title: '100% online', text: 'Estude no seu ritmo, sem parar de trabalhar.' },
      { title: 'Atendimento humano', text: 'Consultores ajudam você a escolher a especialização certa.' },
    ],
    faq: [
      { question: 'Quem pode fazer um pós-técnico?', answer: 'Quem já concluiu um curso técnico de nível médio, em geral na mesma área ou em área relacionada. Confira os requisitos na página de cada curso.' },
    ],
    seoTitle: 'Pós-Técnico EAD – Especialização Técnica | Academy Pop',
    seoDescription: 'Especialização técnica de nível médio 100% online para quem já é técnico. Fale com um consultor da Academy Pop.',
    order: 2.5,
  },
  'tecnico-para-tecnologo': {
    label: 'Técnico para Tecnólogo',
    headline: 'Técnico para Tecnólogo: aproveite o seu curso técnico e chegue à graduação mais rápido',
    intro: 'Quem já tem diploma de curso técnico pode aproveitar disciplinas e concluir uma graduação tecnológica em menos tempo, com diploma de nível superior reconhecido pelo MEC. As regras de aproveitamento variam por curso e instituição.',
    audience: ['Técnicos formados que querem o diploma de nível superior', 'Quem quer aproveitar o que já estudou no curso técnico', 'Quem busca promoção, concurso ou pós-graduação depois'],
    benefits: [
      { title: 'Aproveitamento do técnico', text: 'Parte das disciplinas pode ser aproveitada, conforme a análise da instituição.' },
      { title: 'É graduação', text: 'Diploma de tecnólogo, de nível superior, reconhecido pelo MEC.' },
      { title: '100% online', text: 'Estude pelo celular ou computador, no seu ritmo.' },
    ],
    faq: [
      { question: 'Quanto tempo leva do técnico ao tecnólogo?', answer: 'Depende do curso e do aproveitamento aprovado pela instituição. Fale com um consultor e envie o seu histórico para uma análise.' },
      { question: 'Preciso ter o diploma do técnico?', answer: 'Sim. O aproveitamento é feito a partir do diploma e do histórico do curso técnico concluído.' },
    ],
    seoTitle: 'Técnico para Tecnólogo EAD – Aproveite seu Curso Técnico | Academy Pop',
    seoDescription: 'Transforme o seu curso técnico em graduação tecnológica reconhecida pelo MEC, com aproveitamento de disciplinas. 100% online.',
    order: 4.5,
  },
  'segunda-licenciatura': {
    label: '2ª Licenciatura',
    headline: 'Segunda Licenciatura EAD: habilite-se para lecionar em outra área',
    intro: 'Para professores que já têm licenciatura e querem lecionar outra disciplina. Curso de nível superior, 100% online, com diploma reconhecido pelo MEC.',
    audience: ['Professores licenciados que querem ampliar a área de atuação', 'Quem busca mais aulas ou progressão na carreira docente', 'Quem precisa da habilitação para concurso'],
    benefits: [
      { title: 'Nova habilitação', text: 'Diploma de licenciatura na nova área, reconhecido pelo MEC.' },
      { title: 'Duração menor', text: 'Mais curta que uma primeira licenciatura, porque aproveita a formação pedagógica.' },
      { title: '100% online', text: 'Estude sem deixar a sala de aula.' },
    ],
    faq: [
      { question: 'Quem pode fazer a segunda licenciatura?', answer: 'Quem já concluiu uma licenciatura. Os requisitos exatos estão na página de cada curso.' },
    ],
    seoTitle: 'Segunda Licenciatura EAD Reconhecida pelo MEC | Academy Pop',
    seoDescription: 'Segunda licenciatura 100% online para professores que querem lecionar em outra área, com diploma reconhecido pelo MEC.',
    order: 4.6,
  },
  'segunda-graduacao': {
    label: '2ª Graduação',
    headline: 'Segunda Graduação EAD: um novo diploma aproveitando o que você já estudou',
    intro: 'Já tem curso superior? Na segunda graduação você pode aproveitar disciplinas da primeira e conquistar um novo diploma em menos tempo, 100% online e reconhecido pelo MEC.',
    audience: ['Quem já é graduado e quer mudar de área', 'Quem precisa de um segundo diploma para concurso ou promoção', 'Quem quer aproveitar disciplinas já cursadas'],
    benefits: [
      { title: 'Aproveitamento de disciplinas', text: 'Conforme a análise do histórico pela instituição.' },
      { title: 'Reconhecido pelo MEC', text: 'Diploma de graduação com validade nacional.' },
      { title: 'Atendimento humano', text: 'Consultores ajudam a escolher o curso e a enviar os documentos.' },
    ],
    faq: [
      { question: 'A segunda graduação é mais curta?', answer: 'Pode ser, dependendo das disciplinas aproveitadas da primeira graduação. Fale com um consultor para uma análise.' },
    ],
    seoTitle: 'Segunda Graduação EAD Reconhecida pelo MEC | Academy Pop',
    seoDescription: 'Segunda graduação 100% online com aproveitamento de disciplinas e diploma reconhecido pelo MEC. Fale com um consultor.',
    order: 4.7,
  },
  'mestrado-e-doutorado': {
    label: 'Mestrado e Doutorado',
    headline: 'Mestrado e Doutorado',
    intro: 'Pós-graduação stricto sensu para quem quer seguir carreira acadêmica, docência no ensino superior ou pesquisa. Antes de se matricular, confira se o programa é recomendado pela CAPES e se o diploma será válido no Brasil. Um consultor ajuda você a verificar.',
    audience: ['Graduados e especialistas que querem a carreira acadêmica', 'Professores que buscam titulação para o ensino superior', 'Profissionais que querem pontuar em concursos e planos de carreira'],
    benefits: [
      { title: 'Orientação na escolha', text: 'Ajudamos a verificar a recomendação do programa pela CAPES e a validade do diploma.' },
      { title: 'Titulação acadêmica', text: 'Mestrado e doutorado são exigidos para muitas carreiras no ensino superior.' },
      { title: 'Atendimento humano', text: 'Consultores explicam requisitos, prazos e documentos.' },
    ],
    faq: [
      { question: 'Mestrado EAD tem validade?', answer: 'Tem validade no Brasil quando o programa é recomendado pela CAPES e reconhecido pelo MEC. Títulos de programas estrangeiros precisam ser reconhecidos por uma universidade brasileira. Confira sempre antes de se matricular.' },
    ],
    seoTitle: 'Mestrado e Doutorado | Academy Pop',
    seoDescription: 'Mestrado e doutorado com orientação para escolher um programa válido no Brasil. Fale com um consultor da Academy Pop.',
    order: 5.5,
  },
  'livre': {
    label: 'Cursos Livres',
    headline: 'Cursos livres EAD com certificado',
    intro: 'Cursos rápidos de qualificação profissional, 100% online, com certificado de conclusão. Os cursos livres não precisam de autorização do MEC e não substituem um diploma técnico ou de graduação.',
    audience: ['Quem quer aprender uma habilidade nova rapidamente', 'Quem precisa de horas complementares ou atualização', 'Quem quer melhorar o currículo'],
    benefits: [
      { title: 'Rápido e prático', text: 'Conteúdo direto ao ponto para aplicar no trabalho.' },
      { title: 'Certificado de conclusão', text: 'Para incluir no currículo e comprovar a qualificação.' },
      { title: '100% online', text: 'Estude no seu ritmo, pelo celular ou computador.' },
    ],
    faq: [
      { question: 'Curso livre é reconhecido pelo MEC?', answer: 'Não. Cursos livres não passam por autorização ou reconhecimento do MEC. O certificado comprova a qualificação, mas não equivale a curso técnico ou graduação.' },
    ],
    seoTitle: 'Cursos Livres EAD com Certificado | Academy Pop',
    seoDescription: 'Cursos livres 100% online com certificado de conclusão para qualificação profissional. Conheça os cursos da Academy Pop.',
    order: 7,
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

// v2.4: menu retrátil de cursos. Cada grupo abre uma lista; cada item é uma categoria
// com página própria (/slug). Itens sem cursos cadastrados abrem mesmo assim
// ("em breve" + WhatsApp) e ficam fora do Google (noindex) até ter cursos.
// "name" é exatamente o valor do campo "category" do curso no banco.
export interface MenuItem { name: string; label: string }
export interface MenuGroup { label: string; slug: string; items: MenuItem[] }

export const MENU_GROUPS: MenuGroup[] = [
  {
    label: 'EJA', slug: 'eja',
    items: [
      { name: 'EJA Ensino Fundamental', label: 'EJA Ensino Fundamental' },
      { name: 'EJA Ensino Médio', label: 'EJA Ensino Médio' },
    ],
  },
  {
    label: 'Técnico', slug: 'grupo-tecnico',
    items: [
      { name: 'Técnico', label: 'Cursos Técnicos' },
      { name: 'Pós-Técnico', label: 'Pós-Técnico' },
    ],
  },
  {
    label: 'Graduação', slug: 'grupo-graduacao',
    items: [
      { name: 'Graduação', label: 'Bacharelado' },
      { name: 'Tecnólogo', label: 'Tecnólogo' },
      { name: 'Técnico para Tecnólogo', label: 'Técnico para Tecnólogo' },
      { name: 'Segunda Licenciatura', label: '2ª Licenciatura' },
      { name: 'Segunda Graduação', label: '2ª Graduação' },
      { name: 'Superior Sequencial', label: 'Superior Sequencial' },
      { name: 'Mestrado e Doutorado', label: 'Mestrado e Doutorado' },
    ],
  },
]

/** Itens soltos do menu (sem submenu), depois dos grupos */
export const MENU_SINGLE: MenuItem[] = [
  { name: 'Pós-Graduação', label: 'Pós-Graduação' },
  { name: 'Livre', label: 'Cursos Livres' },
]

/** Todas as categorias previstas no menu, na ordem do menu (usado no admin e no rodapé) */
export const MENU_CATEGORY_NAMES: string[] = [
  ...MENU_GROUPS.flatMap(g => g.items.map(i => i.name)),
  ...MENU_SINGLE.map(i => i.name),
]
const MENU_NAMES = new Set(MENU_CATEGORY_NAMES)

// Compatibilidade (v2.2/v2.3): o menu "Graduação" antigo
export const GRADUACAO_MENU = MENU_GROUPS[2].items
export const GRADUACAO_NAMES = new Set(GRADUACAO_MENU.map(g => g.name))

/**
 * Páginas de grupo: /eja lista os cursos de EJA Fundamental, EJA Médio e da
 * categoria antiga "EJA" (a página /eja já está no Google e continua existindo).
 */
export const GROUP_PAGES: Record<string, { name: string; categories: string[] }> = {
  eja: { name: 'EJA', categories: ['EJA Ensino Fundamental', 'EJA Ensino Médio', 'EJA'] },
}

/** Categorias do menu: a página abre mesmo se ainda não houver cursos */
export function knownCategoryName(slug: string): string | null {
  const name = MENU_CATEGORY_NAMES.find(n => slugifyCategory(n) === slug)
  return name || null
}

/** Nome como aparece no menu (ex.: "Graduação" -> "Bacharelado") */
export function menuLabel(name: string) {
  const item = [...MENU_GROUPS.flatMap(g => g.items), ...MENU_SINGLE].find(i => i.name === name)
  return item ? item.label : getCategoryInfo(name).label
}

export function isMenuCategory(name: string) {
  return MENU_NAMES.has(name)
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
  'como-funciona', 'reconhecimento-mec', 'politica-de-privacidade', 'termos-de-uso', 'uploads', 'parceiros',
])
