// Estatísticas de trade (T-06, T-07, TR-06). Só operações fechadas.

export interface OperacaoFechada {
  data: string
  resultadoLiquidoCentavos: number
  riscoCentavos: number
  setup: string
  timeframe: string
  violacaoTrava: boolean
}

export interface Grupo {
  total: number
  taxaAcerto: number
  expectativaR: number
  resultadoCentavos: number
}

export interface Estatisticas extends Grupo {
  payoffMedio: number
  expectativaCentavos: number
  maiorSequenciaPerdas: number
  drawdownMaximoCentavos: number
  porSetup: Record<string, Grupo>
  porTimeframe: Record<string, Grupo>
  violacoes: { quantidade: number; resultadoCentavos: number }
  /** T-07: só a partir de 100 operações */
  amostraConfiavel: boolean
}

export const AMOSTRA_MINIMA = 100

const media = (v: number[]) => (v.length === 0 ? 0 : v.reduce((s, x) => s + x, 0) / v.length)
const emR = (o: OperacaoFechada) => (o.riscoCentavos > 0 ? o.resultadoLiquidoCentavos / o.riscoCentavos : 0)

function grupo(ops: OperacaoFechada[]): Grupo {
  return {
    total: ops.length,
    taxaAcerto: ops.length === 0 ? 0 : ops.filter((o) => o.resultadoLiquidoCentavos > 0).length / ops.length,
    expectativaR: media(ops.map(emR)),
    resultadoCentavos: ops.reduce((s, o) => s + o.resultadoLiquidoCentavos, 0),
  }
}

function agrupar(ops: OperacaoFechada[], chave: (o: OperacaoFechada) => string): Record<string, Grupo> {
  const mapa = new Map<string, OperacaoFechada[]>()
  for (const o of ops) mapa.set(chave(o), [...(mapa.get(chave(o)) ?? []), o])
  return Object.fromEntries([...mapa.entries()].map(([k, v]) => [k, grupo(v)]))
}

/** As operações chegam em ordem cronológica. */
export function estatisticasTrade(ops: OperacaoFechada[]): Estatisticas {
  const ganhos = ops.filter((o) => o.resultadoLiquidoCentavos > 0).map((o) => o.resultadoLiquidoCentavos)
  const perdas = ops.filter((o) => o.resultadoLiquidoCentavos < 0).map((o) => -o.resultadoLiquidoCentavos)
  const mediaPerda = media(perdas)

  let sequencia = 0
  let maiorSequenciaPerdas = 0
  let acumulado = 0
  let pico = 0
  let drawdownMaximoCentavos = 0
  for (const o of ops) {
    sequencia = o.resultadoLiquidoCentavos < 0 ? sequencia + 1 : 0
    maiorSequenciaPerdas = Math.max(maiorSequenciaPerdas, sequencia)
    acumulado += o.resultadoLiquidoCentavos
    pico = Math.max(pico, acumulado)
    drawdownMaximoCentavos = Math.max(drawdownMaximoCentavos, pico - acumulado)
  }
  const violadas = ops.filter((o) => o.violacaoTrava)

  return {
    ...grupo(ops),
    payoffMedio: mediaPerda === 0 ? 0 : media(ganhos) / mediaPerda,
    expectativaCentavos: Math.round(media(ops.map((o) => o.resultadoLiquidoCentavos))),
    maiorSequenciaPerdas,
    drawdownMaximoCentavos,
    porSetup: agrupar(ops, (o) => o.setup),
    porTimeframe: agrupar(ops, (o) => o.timeframe),
    violacoes: { quantidade: violadas.length, resultadoCentavos: violadas.reduce((s, o) => s + o.resultadoLiquidoCentavos, 0) },
    amostraConfiavel: ops.length >= AMOSTRA_MINIMA,
  }
}
