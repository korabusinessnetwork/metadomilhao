import { describe, expect, it } from 'vitest'
import { metaAnualAporte, metaAnualPatrimonio, metaGastoMes, metaAporteMes, mesBatido } from './metas'

describe('metas', () => {
  it('M-01: meta anual de aporte = aporte mensal × 12', () => {
    expect(metaAnualAporte(244500)).toBe(2934000)
  })

  it('M-02/M-03: meta anual de patrimônio projeta até dezembro a partir do patrimônio real', () => {
    // real de outubro já fechado; projeta novembro e dezembro
    expect(metaAnualPatrimonio({ mesDoPatrimonio: '2027-10-01', patrimonioRealCentavos: 1000000, taxaRealMensal: 0, aporte: () => 100000 }))
      .toBe(1200000)
    expect(metaAnualPatrimonio({ mesDoPatrimonio: '2027-12-01', patrimonioRealCentavos: 1000000, taxaRealMensal: 0.01, aporte: () => 100000 }))
      .toBe(1000000)
  })

  it('M-04: meta de gasto = soma do orçamento do mês', () => {
    expect(metaGastoMes([50000, 100000, 165500])).toBe(315500)
  })

  it('M-05: meta de aporte = renda − meta de gasto, nunca negativa', () => {
    expect(metaAporteMes({ rendaCentavos: 560000, metaGastoCentavos: 315500 })).toBe(244500)
    expect(metaAporteMes({ rendaCentavos: 300000, metaGastoCentavos: 315500 })).toBe(0)
  })

  it('M-06: mês batido exige gasto ≤ orçado e aporte ≥ meta', () => {
    expect(mesBatido({ gastoRealCentavos: 315500, orcadoCentavos: 315500, aporteRealCentavos: 244500, metaAporteCentavos: 244500 })).toBe(true)
    expect(mesBatido({ gastoRealCentavos: 315501, orcadoCentavos: 315500, aporteRealCentavos: 300000, metaAporteCentavos: 244500 })).toBe(false)
    expect(mesBatido({ gastoRealCentavos: 300000, orcadoCentavos: 315500, aporteRealCentavos: 244499, metaAporteCentavos: 244500 })).toBe(false)
  })
})
