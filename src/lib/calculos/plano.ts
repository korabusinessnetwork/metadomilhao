import { inicioDoMes, mesesEntre } from './datas'
import type { FuncaoAporte } from './projecao'

export interface ParametrosPlano {
  meta_centavos: number
  taxa_real_mensal: number
  aporte_atual_centavos: number
  aporte_pos_mudanca_centavos: number
}

export interface Premissas {
  metaCentavos: number
  taxaRealMensal: number
  /** Meses projetados (a partir do mês seguinte ao de hoje) que ainda usam o aporte atual. */
  mesesAteMudanca: number
  /** Aporte do mês m da projeção, m = 1 é o mês seguinte ao de hoje. */
  aporte: FuncaoAporte
  aporteDoProximoMes: number
  /** Aporte planejado de um mês do calendário ('AAAA-MM-01'). */
  aporteNoMes: (mes: string) => number
}

/**
 * F-01: antes do mês da mudança vale o aporte atual. F-02: a partir do mês da mudança, o aporte pós-mudança.
 * Sem data de mudança, o aporte atual vale para todos os meses.
 */
export function premissasDoPlano(plano: ParametrosPlano, dataMudanca: string | null, hoje: string): Premissas {
  const mesHoje = inicioDoMes(hoje)
  const mesMudanca = dataMudanca ? inicioDoMes(dataMudanca) : null
  const aporteNoMes = (mes: string) =>
    mesMudanca === null || mes < mesMudanca ? plano.aporte_atual_centavos : plano.aporte_pos_mudanca_centavos
  // m = 1 é o próximo mês; o mês da mudança fica em m = mesesEntre(hoje, mudança)
  const mesesAteMudanca = mesMudanca === null ? Infinity : Math.max(0, mesesEntre(mesHoje, mesMudanca) - 1)
  const aporte: FuncaoAporte = (m) => (m <= mesesAteMudanca ? plano.aporte_atual_centavos : plano.aporte_pos_mudanca_centavos)
  return {
    metaCentavos: plano.meta_centavos,
    taxaRealMensal: plano.taxa_real_mensal,
    mesesAteMudanca,
    aporte,
    aporteDoProximoMes: aporte(1),
    aporteNoMes,
  }
}
