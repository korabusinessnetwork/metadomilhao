import { describe, expect, it } from 'vitest'
import { limiteGastoHoje } from './limite-gasto-hoje'

describe('limite de gasto do dia', () => {
  it('M-07: divide o variável restante pelos dias que faltam, contando hoje', () => {
    const r = limiteGastoHoje({
      hoje: '2027-03-01',
      orcamentoVariavelCentavos: 93000,
      gastoVariavelAteOntemCentavos: 0,
      gastoVariavelHojeCentavos: 0,
    })
    expect(r.diasRestantes).toBe(31)
    expect(r.limiteHojeCentavos).toBe(3000)
    expect(r.restanteHojeCentavos).toBe(3000)
    expect(r.estourou).toBe(false)
  })

  it('M-09: excedente de ontem reduz o limite dos dias seguintes', () => {
    // 30 dias de 1000; no dia 1 gastou 3900 (2900 a mais). Restam 29 dias para 26100, 900 por dia
    const r = limiteGastoHoje({
      hoje: '2027-04-02',
      orcamentoVariavelCentavos: 30000,
      gastoVariavelAteOntemCentavos: 3900,
      gastoVariavelHojeCentavos: 0,
    })
    expect(r.limiteHojeCentavos).toBe(900)
  })

  it('M-09: estouro só avisa, nunca bloqueia, e o restante fica negativo', () => {
    const r = limiteGastoHoje({
      hoje: '2027-04-30',
      orcamentoVariavelCentavos: 30000,
      gastoVariavelAteOntemCentavos: 29000,
      gastoVariavelHojeCentavos: 1500,
    })
    expect(r.limiteHojeCentavos).toBe(1000)
    expect(r.restanteHojeCentavos).toBe(-500)
    expect(r.estourou).toBe(true)
  })

  it('M-07: orçamento do mês já estourado dá limite zero, não negativo', () => {
    const r = limiteGastoHoje({
      hoje: '2027-04-10',
      orcamentoVariavelCentavos: 30000,
      gastoVariavelAteOntemCentavos: 31000,
      gastoVariavelHojeCentavos: 0,
    })
    expect(r.limiteHojeCentavos).toBe(0)
  })

  it('M-07: arredonda para baixo, nunca promete centavo que não existe', () => {
    const r = limiteGastoHoje({
      hoje: '2027-03-01',
      orcamentoVariavelCentavos: 10000,
      gastoVariavelAteOntemCentavos: 0,
      gastoVariavelHojeCentavos: 0,
    })
    expect(r.limiteHojeCentavos).toBe(322) // 10000 / 31 = 322,58
  })
})
