import { ultimoDiaDoMes } from './datas'
import { mesBatido, metaAporteMes } from './metas'

export type TipoMovimento = 'aporte' | 'resgate' | 'rendimento' | 'ajuste_saldo'

export interface MovimentoSimples {
  data: string
  tipo: TipoMovimento
  valorCentavos: number
}

/** Saldo = soma dos movimentos até a data (inclusive). */
export function patrimonioNaData(movimentos: MovimentoSimples[], data: string): number {
  return movimentos.filter((m) => m.data <= data).reduce((s, m) => s + m.valorCentavos, 0)
}

export interface EntradaFechamento {
  mes: string
  rendasCentavos: number[]
  lancamentosDoMes: { valorCentavos: number; categoriaId: string }[]
  movimentos: MovimentoSimples[]
  orcadoCentavos: number
  orcadoPorCategoria?: Record<string, number>
  /** Patrimônio real do mês anterior (fechamento vigente, ou saldo no fim do mês anterior). */
  patrimonioAnteriorCentavos: number
  taxaRealMensal: number
  aportePlanejadoCentavos: number
}

export interface RascunhoFechamento {
  rendaReal: number
  gastoReal: number
  aporteReal: number
  patrimonioReal: number
  patrimonioProjetado: number
  metaAporte: number
  metaBatida: boolean
  desvioCentavos: number
  categoriasEstouradas: { categoriaId: string; orcadoCentavos: number; realCentavos: number }[]
}

/**
 * Pré-preenche o fechamento (docs/05_FLUXOS). O dono confere e confirma; nada é gravado aqui.
 * Projetado do mês (PL-04) = patrimônio real anterior × (1 + taxa real) + aporte planejado.
 */
export function prepararFechamento(e: EntradaFechamento): RascunhoFechamento {
  const fim = ultimoDiaDoMes(e.mes)
  const rendaReal = e.rendasCentavos.reduce((s, v) => s + v, 0)
  const gastoReal = e.lancamentosDoMes.reduce((s, l) => s + l.valorCentavos, 0)
  const aporteReal = e.movimentos
    .filter((m) => m.data >= e.mes && m.data <= fim && (m.tipo === 'aporte' || m.tipo === 'resgate'))
    .reduce((s, m) => s + m.valorCentavos, 0)
  const patrimonioReal = patrimonioNaData(e.movimentos, fim)
  const patrimonioProjetado = Math.round(e.patrimonioAnteriorCentavos * (1 + e.taxaRealMensal) + e.aportePlanejadoCentavos)
  const metaAporte = rendaReal > 0 ? metaAporteMes({ rendaCentavos: rendaReal, metaGastoCentavos: e.orcadoCentavos }) : e.aportePlanejadoCentavos

  const realPorCategoria = new Map<string, number>()
  for (const l of e.lancamentosDoMes) realPorCategoria.set(l.categoriaId, (realPorCategoria.get(l.categoriaId) ?? 0) + l.valorCentavos)
  const categoriasEstouradas = Object.entries(e.orcadoPorCategoria ?? {})
    .map(([categoriaId, orcadoCentavos]) => ({ categoriaId, orcadoCentavos, realCentavos: realPorCategoria.get(categoriaId) ?? 0 }))
    .filter((c) => c.realCentavos > c.orcadoCentavos)

  return {
    rendaReal,
    gastoReal,
    aporteReal,
    patrimonioReal,
    patrimonioProjetado,
    metaAporte,
    metaBatida: mesBatido({ gastoRealCentavos: gastoReal, orcadoCentavos: e.orcadoCentavos, aporteRealCentavos: aporteReal, metaAporteCentavos: metaAporte }),
    desvioCentavos: patrimonioReal - patrimonioProjetado,
    categoriasEstouradas,
  }
}
