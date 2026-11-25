import { inicioDoMes, somarMeses, ultimoDiaUtilDoMes } from './datas'

// IR de day trade (IR-01 a IR-04). Apoio para conferência, não declaração oficial.

/** IR-04: último dia útil do mês seguinte. Feriados nacionais entram com o calendário da Fase 3. */
export function vencimentoDarf(mes: string): string {
  return ultimoDiaUtilDoMes(somarMeses(mes, 1))
}

export interface MesDayTrade {
  mes: string
  /** Resultado líquido de cada dia operado no mês */
  resultadosDiariosCentavos: number[]
}

export interface ApuracaoMes {
  mes: string
  lucroLiquidoCentavos: number
  irrfCentavos: number
  prejuizoCompensadoCentavos: number
  baseCentavos: number
  impostoDevidoCentavos: number
  prejuizoAcumuladoCentavos: number
  /** IRRF que sobrou para abater nos meses seguintes */
  irrfSobraCentavos: number
  vencimento: string
}

/** Agrupa o resultado líquido por dia e por mês, em ordem cronológica. */
export function mesesDeDayTrade(ops: { data: string; resultado_liquido_centavos: number | null }[]): MesDayTrade[] {
  const porMes = new Map<string, Map<string, number>>()
  for (const o of ops) {
    const mes = inicioDoMes(o.data)
    const dias = porMes.get(mes) ?? new Map<string, number>()
    dias.set(o.data, (dias.get(o.data) ?? 0) + (o.resultado_liquido_centavos ?? 0))
    porMes.set(mes, dias)
  }
  return [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, dias]) => ({ mes, resultadosDiariosCentavos: [...dias.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v) }))
}

const ALIQUOTA = 0.2
const ALIQUOTA_IRRF = 0.01

/** Meses em ordem cronológica. O prejuízo e o IRRF que sobram passam para os meses seguintes. */
export function apurarIR(meses: MesDayTrade[], prejuizoInicialCentavos = 0): ApuracaoMes[] {
  let prejuizo = prejuizoInicialCentavos
  let irrfSobra = 0
  return meses.map((m) => {
    const lucro = m.resultadosDiariosCentavos.reduce((s, v) => s + v, 0)
    // IR-02: 1% sobre o resultado positivo de cada dia
    const irrf = m.resultadosDiariosCentavos.filter((v) => v > 0).reduce((s, v) => s + Math.round(v * ALIQUOTA_IRRF), 0)
    let compensado = 0
    let base = 0
    if (lucro <= 0) {
      prejuizo += -lucro // IR-03
    } else {
      compensado = Math.min(prejuizo, lucro)
      prejuizo -= compensado
      base = lucro - compensado
    }
    // IR-01: 20% da base menos o IRRF disponível
    const imposto = Math.round(base * ALIQUOTA)
    const irrfDisponivel = irrf + irrfSobra
    const impostoDevido = Math.max(0, imposto - irrfDisponivel)
    irrfSobra = irrfDisponivel - (imposto - impostoDevido)
    return {
      mes: m.mes,
      lucroLiquidoCentavos: lucro,
      irrfCentavos: irrf,
      prejuizoCompensadoCentavos: compensado,
      baseCentavos: base,
      impostoDevidoCentavos: impostoDevido,
      prejuizoAcumuladoCentavos: prejuizo,
      irrfSobraCentavos: irrfSobra,
      vencimento: vencimentoDarf(m.mes),
    }
  })
}
