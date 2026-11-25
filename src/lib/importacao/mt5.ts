// Leitura do relatório de histórico do MT5 salvo em HTML (aba Histórico, Relatório, HTML). Spec: specs/mt5-parser.md.
// Função pura, sem DOM. Lê só a seção de posições; o que não entende vira aviso, nunca some calado.
import { dataValida } from '../calculos/datas'
import { mercadoDoAtivo, resultadoBrutoCentavos, type Direcao } from '../calculos/trade'

export interface PosicaoMt5 {
  /** Número da linha (<tr>) no relatório, para o aviso e para a tela apontarem o lugar certo */
  linha: number
  ticket: string
  ativo: string
  direcao: Direcao
  volume: number
  precoEntrada: number
  precoSaida: number
  stop: number | null
  alvo: number | null
  abertaEm: string
  fechadaEm: string
  /** Comissão + swap cobrados, em centavos positivos */
  custosCentavos: number
  /** Lucro bruto que o MT5 informa, em centavos */
  lucroBrutoCentavos: number
}

export interface LeituraMt5 {
  posicoes: PosicaoMt5[]
  avisos: string[]
}

/** O MT5 salva o HTML em UTF-16LE com BOM; outros caminhos geram UTF-8. */
export function decodificarRelatorio(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2))
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder('utf-8').decode(bytes.subarray(3))
  return new TextDecoder('utf-8').decode(bytes)
}

const ENTIDADES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function textoDaCelula(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTIDADES[n.toLowerCase()] ?? m)
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function linhasDaTabela(html: string): string[][] {
  const linhas: string[][] = []
  for (const tr of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    linhas.push([...tr[1]!.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((td) => textoDaCelula(td[1]!)))
  }
  return linhas
}

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

const SINONIMOS = {
  tempo: ['time', 'horario', 'hora', 'data'],
  ticket: ['position', 'posicao', 'ticket'],
  ativo: ['symbol', 'simbolo', 'ativo'],
  tipo: ['type', 'tipo'],
  volume: ['volume'],
  preco: ['price', 'preco'],
  stop: ['s / l', 's/l', 'sl'],
  alvo: ['t / p', 't/p', 'tp'],
  comissao: ['commission', 'comissao'],
  swap: ['swap'],
  lucro: ['profit', 'lucro'],
} as const

type Campo = keyof typeof SINONIMOS

/** Posições de cada campo no cabeçalho. Tempo e preço aparecem duas vezes: abertura e fechamento. */
function mapearCabecalho(celulas: string[]): Record<Campo, number[]> | null {
  const mapa = Object.fromEntries(Object.keys(SINONIMOS).map((c) => [c, [] as number[]])) as Record<Campo, number[]>
  celulas.forEach((c, i) => {
    const n = normalizar(c)
    for (const campo of Object.keys(SINONIMOS) as Campo[]) if ((SINONIMOS[campo] as readonly string[]).includes(n)) mapa[campo].push(i)
  })
  const completo =
    mapa.tempo.length >= 2 && mapa.preco.length >= 2 &&
    (['ticket', 'ativo', 'tipo', 'volume', 'stop', 'alvo', 'comissao', 'swap', 'lucro'] as Campo[]).every((c) => mapa[c].length >= 1)
  return completo ? mapa : null
}

/** "128 500", "1 234.56", "-0.35", "32,15": espaço é milhar; vírgula sozinha é decimal. */
function lerNumero(texto: string): number | null {
  let t = texto.replace(/\s/g, '')
  if (t === '') return null
  if (t.includes(',') && !t.includes('.')) t = t.replace(',', '.')
  else t = t.replace(/,/g, '')
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null
  return Number(t)
}

const emCentavos = (reais: number) => Math.round(Math.round(reais * 1e6) / 1e4)

/** MT5 escreve "2027.03.10 10:15:32" no horário do servidor da corretora, que no Brasil é o de Brasília. */
function lerHorario(texto: string): string | null {
  const m = /^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/.exec(texto.trim())
  if (!m) return null
  const data = `${m[1]}-${m[2]}-${m[3]}`
  if (!dataValida(data) || Number(m[4]) > 23 || Number(m[5]) > 59 || Number(m[6] ?? 0) > 59) return null
  return `${data}T${m[4]}:${m[5]}:${m[6] ?? '00'}-03:00`
}

function lerDirecao(texto: string): Direcao | null {
  const n = normalizar(texto)
  if (n === 'buy' || n === 'compra') return 'compra'
  if (n === 'sell' || n === 'venda') return 'venda'
  return null
}

const opcional = (v: number | null) => (v === null || v === 0 ? null : v)

export function lerRelatorioMt5(html: string): LeituraMt5 {
  const linhas = linhasDaTabela(html)
  const inicio = linhas.findIndex((l) => mapearCabecalho(l) !== null)
  if (inicio < 0) return { posicoes: [], avisos: ['Não achei a tabela de posições. Salve no MT5 pela aba Histórico, botão direito, Relatório, HTML.'] }

  const cabecalho = linhas[inicio]!
  const col = mapearCabecalho(cabecalho)!
  const posicoes: PosicaoMt5[] = []
  const avisos: string[] = []

  for (let i = inicio + 1; i < linhas.length; i++) {
    const celulas = linhas[i]!
    // Linha mais curta que o cabeçalho é título de outra seção ou resumo: a tabela de posições acabou
    if (celulas.length < cabecalho.length) break
    const linha = i + 1
    const v = (campo: Campo, ordem = 0) => celulas[col[campo][ordem]!] ?? ''
    const ignorar = (motivo: string) => avisos.push(`Linha ${linha} ignorada: ${motivo}.`)

    const abertaEm = lerHorario(v('tempo'))
    const fechadaEm = lerHorario(v('tempo', 1))
    if (!abertaEm) { ignorar(`data inválida (${v('tempo')})`); continue }
    if (!fechadaEm) { ignorar(`data inválida (${v('tempo', 1)})`); continue }
    const direcao = lerDirecao(v('tipo'))
    if (!direcao) { ignorar(`tipo desconhecido (${v('tipo')})`); continue }

    const volume = lerNumero(v('volume'))
    const entrada = lerNumero(v('preco'))
    const saida = lerNumero(v('preco', 1))
    const lucro = lerNumero(v('lucro'))
    const comissao = lerNumero(v('comissao')) ?? 0
    const swap = lerNumero(v('swap')) ?? 0
    const stop = v('stop') === '' ? null : lerNumero(v('stop'))
    const alvo = v('alvo') === '' ? null : lerNumero(v('alvo'))
    if (volume === null || volume <= 0) { ignorar(`volume inválido (${v('volume')})`); continue }
    if (entrada === null || entrada <= 0 || saida === null || saida <= 0) { ignorar('preço inválido'); continue }
    if (lucro === null) { ignorar(`lucro inválido (${v('lucro')})`); continue }
    if ((v('stop') !== '' && stop === null) || (v('alvo') !== '' && alvo === null)) { ignorar('S/L ou T/P inválido'); continue }
    const ativo = v('ativo').toUpperCase()
    if (!/^[A-Z0-9]{3,12}$/.test(ativo)) { ignorar(`ativo inválido (${v('ativo')})`); continue }

    posicoes.push({
      linha,
      ticket: v('ticket'),
      ativo,
      direcao,
      volume,
      precoEntrada: entrada,
      precoSaida: saida,
      stop: opcional(stop),
      alvo: opcional(alvo),
      abertaEm,
      fechadaEm,
      custosCentavos: Math.max(0, emCentavos(-(comissao + swap))),
      lucroBrutoCentavos: emCentavos(lucro),
    })
  }
  return { posicoes, avisos }
}

/**
 * Confere o lucro que o MT5 informa com o calculado pelos preços e pelo multiplicador do mercado (T-03).
 * Diferença indica contrato com multiplicador diferente do esperado: a tela avisa antes de confirmar.
 */
export function conferirLucro(p: PosicaoMt5): { calculadoCentavos: number; diferencaCentavos: number } {
  const calculadoCentavos = resultadoBrutoCentavos({
    mercado: mercadoDoAtivo(p.ativo),
    direcao: p.direcao,
    entrada: p.precoEntrada,
    saida: p.precoSaida,
    quantidade: p.volume,
  })
  return { calculadoCentavos, diferencaCentavos: p.lucroBrutoCentavos - calculadoCentavos }
}
