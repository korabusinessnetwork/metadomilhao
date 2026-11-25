import { describe, expect, it } from 'vitest'
import { estatisticasTrade, type OperacaoFechada } from './estatisticas'

const op = (liquido: number, extra: Partial<OperacaoFechada> = {}): OperacaoFechada => ({
  data: '2027-03-10',
  resultadoLiquidoCentavos: liquido,
  riscoCentavos: 1000,
  setup: 'FVG',
  timeframe: '5m',
  violacaoTrava: false,
  ...extra,
})

describe('estatísticas de trade (T-06, T-07)', () => {
  it('T-06: acerto, payoff, expectativa, sequência de perdas e drawdown', () => {
    const e = estatisticasTrade([op(2000), op(-1000), op(-1000), op(-1000), op(3000), op(-500)])
    expect(e.total).toBe(6)
    expect(e.taxaAcerto).toBeCloseTo(2 / 6)
    expect(e.payoffMedio).toBeCloseTo(2500 / 875) // média dos ganhos ÷ média das perdas
    expect(e.expectativaCentavos).toBe(250) // 1500 ÷ 6
    expect(e.expectativaR).toBeCloseTo(0.25)
    expect(e.maiorSequenciaPerdas).toBe(3)
    expect(e.drawdownMaximoCentavos).toBe(3000) // de +2000 para −1000
    expect(e.resultadoCentavos).toBe(1500)
  })

  it('T-06: resultado por setup e por timeframe', () => {
    const e = estatisticasTrade([op(2000, { setup: 'FVG' }), op(-1000, { setup: 'Rompimento', timeframe: '15m' }), op(500, { setup: 'FVG' })])
    expect(e.porSetup.FVG).toMatchObject({ total: 2, resultadoCentavos: 2500, taxaAcerto: 1 })
    expect(e.porSetup.Rompimento).toMatchObject({ total: 1, resultadoCentavos: -1000, taxaAcerto: 0 })
    expect(e.porTimeframe['15m']).toMatchObject({ total: 1, resultadoCentavos: -1000 })
  })

  it('T-07: abaixo de 100 operações, a expectativa é amostra pequena', () => {
    expect(estatisticasTrade([op(100)]).amostraConfiavel).toBe(false)
    expect(estatisticasTrade(Array.from({ length: 100 }, () => op(100))).amostraConfiavel).toBe(true)
  })

  it('TR-06: violações aparecem com contagem e resultado', () => {
    const e = estatisticasTrade([op(-1000, { violacaoTrava: true }), op(500), op(-300, { violacaoTrava: true })])
    expect(e.violacoes).toEqual({ quantidade: 2, resultadoCentavos: -1300 })
  })

  it('sem operações, tudo zero e nada de divisão por zero', () => {
    const e = estatisticasTrade([])
    expect(e).toMatchObject({ total: 0, taxaAcerto: 0, payoffMedio: 0, expectativaCentavos: 0, expectativaR: 0, drawdownMaximoCentavos: 0 })
  })
})
