import { describe, expect, it } from 'vitest'
import { projetarSerie, mesesAteMeta, taxaAnualEquivalente, montarCenarios } from './projecao'

const META = 100_000_000 // R$ 1 milhão em centavos

describe('plano do milhão', () => {
  it('PL-01: patrimônio × (1 + taxa) + aporte, mês a mês', () => {
    const serie = projetarSerie({ patrimonioInicialCentavos: 100000, taxaRealMensal: 0.01, aporte: () => 10000, meses: 2 })
    expect(serie).toEqual([
      { mes: 0, patrimonioCentavos: 100000 },
      { mes: 1, patrimonioCentavos: 111000 },
      { mes: 2, patrimonioCentavos: 122110 },
    ])
  })

  it('PL-02: mostra o equivalente anual da taxa real', () => {
    expect(taxaAnualEquivalente(0.0045)).toBeCloseTo(0.05536, 4)
  })

  it('confere a documentação: R$ 885 por mês a 0,45% real, do zero, leva ~33 anos e 7 meses', () => {
    const meses = mesesAteMeta({ patrimonioInicialCentavos: 0, taxaRealMensal: 0.0045, aporte: () => 88500, metaCentavos: META })
    expect(meses).toBe(403)
  })

  it('F-01/F-02: com a mudança em 3 meses o aporte vira R$ 2.445 e o prazo cai para ~19 anos e 7 meses', () => {
    const meses = mesesAteMeta({
      patrimonioInicialCentavos: 0,
      taxaRealMensal: 0.0045,
      aporte: (m) => (m <= 3 ? 88500 : 244500),
      metaCentavos: META,
    })
    expect(meses).toBe(235)
  })

  it('PL-05: sem aporte e sem rendimento, a meta fica fora do alcance', () => {
    expect(mesesAteMeta({ patrimonioInicialCentavos: 1000, taxaRealMensal: 0, aporte: () => 0, metaCentavos: META })).toBeNull()
  })

  it('PL-05: patrimônio já acima da meta dá prazo zero', () => {
    expect(mesesAteMeta({ patrimonioInicialCentavos: META, taxaRealMensal: 0.0045, aporte: () => 0, metaCentavos: META })).toBe(0)
  })

  it('PL-03: conservador usa taxa − 0,15 p.p. e o cenário com trade só existe com T-09', () => {
    const base = { patrimonioInicialCentavos: 0, taxaRealMensal: 0.0045, aporte: () => 244500, metaCentavos: META }
    const sem = montarCenarios(base, { tradeHabilitado: false, aporteTradeCentavos: 50000 })
    expect(sem.map((c) => c.id)).toEqual(['base', 'conservador'])
    expect(sem[1]!.taxaRealMensal).toBeCloseTo(0.003, 10)
    expect(sem[1]!.meses!).toBeGreaterThan(sem[0]!.meses!)

    const com = montarCenarios(base, { tradeHabilitado: true, aporteTradeCentavos: 50000 })
    expect(com.map((c) => c.id)).toEqual(['base', 'conservador', 'com_trade'])
    expect(com[2]!.meses!).toBeLessThan(com[0]!.meses!)
  })
})
