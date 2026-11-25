// Lógica pura da revisão de notícias (ADR-004, docs/10_PROMPTS v1). Sem imports: roda no Deno e no Vitest.

export const VERSAO_PROMPT = 'v1'

export const PROMPT_SISTEMA = `Você prepara uma revisão de notícias para um operador pessoa física de day trade na B3, antes da abertura do pregão.
Regras:
- Seja informativo. Nunca recomende comprar, vender ou manter. Não sugira preço de entrada, stop ou alvo.
- Use só notícias das últimas 24 horas, ou eventos agendados para hoje. Cite a fonte de cada item.
- Se não encontrar nada relevante para um ativo, diga isso. Não invente.
- Separe fato de interpretação. Marque interpretações como "possível impacto".
- Responda apenas com JSON válido no schema fornecido, em português do Brasil.

Schema de saída:
{
  "data": "AAAA-MM-DD",
  "agenda": [{ "hora": "HH:MM", "evento": "", "pais": "BR|US|outro", "relevancia": "alta|media|baixa" }],
  "ativos": [{
    "ativo": "",
    "noticias": [{ "titulo": "", "resumo": "", "fonte": "", "url": "" }],
    "possivel_impacto": "",
    "riscos_do_dia": [""],
    "sem_novidades": false
  }],
  "contexto_geral": ""
}`

export interface ItemWatchlist {
  ativo: string
  mercado: 'acoes' | 'mini_indice'
}

/** Só data e watchlist: nenhum dado financeiro pessoal vai para o prompt (docs/11_SEGURANCA). */
export function montarPromptUsuario(data: string, watchlist: ItemWatchlist[]): string {
  const lista = watchlist.map((w) => `${w.ativo} (${w.mercado === 'mini_indice' ? 'mini-índice' : 'ações'})`).join(', ')
  return [
    `Data: ${data} (America/Sao_Paulo)`,
    `Ativos: ${lista}`,
    'Inclua também: agenda macro do dia no Brasil e nos EUA que pode mexer com o Ibovespa, o dólar e os ativos acima.',
  ].join('\n')
}

/** Pega o primeiro objeto JSON do texto, mesmo dentro de ```json ... ```. */
export function extrairJson(texto: string): unknown {
  const inicio = texto.indexOf('{')
  if (inicio < 0) return null
  let profundidade = 0
  let emTexto = false
  let escape = false
  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i]
    if (emTexto) {
      if (escape) escape = false
      else if (c === '\\') escape = true
      else if (c === '"') emTexto = false
      continue
    }
    if (c === '"') emTexto = true
    else if (c === '{') profundidade++
    else if (c === '}') {
      profundidade--
      if (profundidade === 0) {
        try {
          return JSON.parse(texto.slice(inicio, i + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

export interface Noticia {
  titulo: string
  resumo: string
  fonte: string
  url: string
}

export interface RevisaoAtivo {
  ativo: string
  noticias: Noticia[]
  possivel_impacto: string
  riscos_do_dia: string[]
  sem_novidades: boolean
}

export interface ItemAgenda {
  hora: string
  evento: string
  pais: string
  relevancia: string
}

export interface Revisao {
  data: string
  agenda: ItemAgenda[]
  ativos: RevisaoAtivo[]
  contexto_geral: string
}

// IA-02: recomendação explícita. Palavras soltas como "vendas" ou "comprador" não contam.
const RECOMENDACAO = [
  /\b(compre|venda|vender|comprar|mantenha|manter|zere|zerar)\s+(o\s+|a\s+|os\s+|as\s+)?([A-Z]{4}\d{1,2}|WIN\w*|ativo|ação|ações|papel|papéis|posição|agora|já|na abertura)/i,
  /\b(melhor|hora de|vale a pena|recomenda\w*|sugiro|sugerimos|indicamos)\s+(a\s+)?(comprar|vender|manter|compra|venda)\b/i,
  /\b(entrada|stop|alvo)\s+(em|no|na)\s+R?\$?\s?\d/i,
]

const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

export type ResultadoValidacao = { ok: true; revisao: Revisao; fontes: { fonte: string; url: string }[] } | { ok: false; erro: string }

export function validarRevisao(bruto: unknown, dataEsperada: string): ResultadoValidacao {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return { ok: false, erro: 'Resposta não é um objeto JSON.' }
  const r = bruto as Record<string, unknown>
  if (texto(r.data) !== dataEsperada) return { ok: false, erro: 'A revisão é de outra data.' }
  if (!Array.isArray(r.agenda)) return { ok: false, erro: 'Campo "agenda" precisa ser uma lista.' }
  if (!Array.isArray(r.ativos)) return { ok: false, erro: 'Campo "ativos" precisa ser uma lista.' }

  const ativos: RevisaoAtivo[] = r.ativos.map((a) => {
    const x = (a ?? {}) as Record<string, unknown>
    const noticias = (Array.isArray(x.noticias) ? x.noticias : [])
      .map((n) => {
        const y = (n ?? {}) as Record<string, unknown>
        return { titulo: texto(y.titulo), resumo: texto(y.resumo), fonte: texto(y.fonte), url: texto(y.url) }
      })
      // docs/10_PROMPTS: item sem fonte é descartado
      .filter((n) => n.fonte !== '' && n.titulo !== '')
    return {
      ativo: texto(x.ativo).toUpperCase(),
      noticias,
      possivel_impacto: texto(x.possivel_impacto),
      riscos_do_dia: (Array.isArray(x.riscos_do_dia) ? x.riscos_do_dia : []).map(texto).filter(Boolean),
      sem_novidades: x.sem_novidades === true || noticias.length === 0,
    }
  })
  const agenda: ItemAgenda[] = r.agenda.map((a) => {
    const x = (a ?? {}) as Record<string, unknown>
    return { hora: texto(x.hora), evento: texto(x.evento), pais: texto(x.pais), relevancia: texto(x.relevancia) }
  }).filter((a) => a.evento !== '')

  const revisao: Revisao = { data: dataEsperada, agenda, ativos, contexto_geral: texto(r.contexto_geral) }
  const tudo = JSON.stringify(revisao)
  if (RECOMENDACAO.some((re) => re.test(tudo))) return { ok: false, erro: 'A resposta contém recomendação de compra ou venda.' }

  const fontes = ativos.flatMap((a) => a.noticias.map((n) => ({ fonte: n.fonte, url: n.url })))
  return { ok: true, revisao, fontes }
}

export interface Uso {
  tokensEntrada: number
  tokensSaida: number
  buscas: number
}

export interface Precos {
  precoEntradaUsdPorMilhao: number
  precoSaidaUsdPorMilhao: number
  precoBuscaUsd: number
  cotacaoUsdBrl: number
}

/** IA-04: custo estimado em centavos de real, arredondado para cima (a trava nunca subestima). */
export function custoEstimadoCentavos(u: Uso, p: Precos): number {
  const usd = (u.tokensEntrada * p.precoEntradaUsdPorMilhao) / 1e6 + (u.tokensSaida * p.precoSaidaUsdPorMilhao) / 1e6 + u.buscas * p.precoBuscaUsd
  return Math.ceil(Math.round(usd * p.cotacaoUsdBrl * 100 * 1e6) / 1e6)
}

/** IA-03: aviso a partir de 80% do teto; com 100%, não chama mais a API no mês. */
export function situacaoDoTeto(gastoNoMesCentavos: number, tetoCentavos: number): 'ok' | 'aviso' | 'bloqueado' {
  if (tetoCentavos <= 0 || gastoNoMesCentavos >= tetoCentavos) return 'bloqueado'
  if (gastoNoMesCentavos * 10 >= tetoCentavos * 8) return 'aviso'
  return 'ok'
}
