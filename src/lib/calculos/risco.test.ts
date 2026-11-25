import { describe, expect, it } from 'vitest'
import { avaliarAumentoRisco, tradeValidado, desempenhoDe, aporteMensalDoTrade } from './risco'

const ok = { operacoesFechadas: 100, expectativaLiquidaCentavos: 50, violacoesUltimos30Dias: 0, ultimaMudancaRisco: '2027-01-10', hoje: '2027-07-10', riscoAtualCentavos: 6000 }

describe('desempenho para T-08 e T-09', () => {
  it('conta operações fechadas, expectativa líquida e violações dos últimos 30 dias (igual ao banco)', () => {
    const ops = [
      { data: '2027-06-01', resultadoLiquidoCentavos: 300, violacaoTrava: true }, // 39 dias antes: fora da janela
      { data: '2027-06-10', resultadoLiquidoCentavos: -100, violacaoTrava: true }, // exatamente 30 dias antes: fora (data > hoje − 30)
      { data: '2027-06-11', resultadoLiquidoCentavos: 400, violacaoTrava: true },
      { data: '2027-07-10', resultadoLiquidoCentavos: 200, violacaoTrava: false },
    ]
    expect(desempenhoDe(ops, '2027-07-10')).toEqual({ operacoesFechadas: 4, expectativaLiquidaCentavos: 200, violacoesUltimos30Dias: 1 })
  })
})

describe('aporte vindo do trade (P-05)', () => {
  it('média mensal do lucro líquido × percentual para aporte; prejuízo médio não vira aporte', () => {
    const ops = [
      { data: '2027-03-10', resultadoLiquidoCentavos: 30000 },
      { data: '2027-03-20', resultadoLiquidoCentavos: -10000 },
      { data: '2027-04-05', resultadoLiquidoCentavos: 20000 },
    ]
    // (20000 + 20000) / 2 meses = 20000 × 70%
    expect(aporteMensalDoTrade(ops, 70)).toBe(14000)
    expect(aporteMensalDoTrade([{ data: '2027-03-10', resultadoLiquidoCentavos: -500 }], 70)).toBe(0)
    expect(aporteMensalDoTrade([], 70)).toBe(0)
  })
})

describe('aumento de risco (T-08) e entrada no plano (T-09)', () => {
  it('T-08: tudo atendido permite até +25%', () => {
    expect(avaliarAumentoRisco({ ...ok, riscoNovoCentavos: 7500 })).toEqual({ permitido: true, motivos: [], riscoMaximoCentavos: 7500 })
  })

  it('T-08: aumento acima de 25% é recusado', () => {
    expect(avaliarAumentoRisco({ ...ok, riscoNovoCentavos: 7501 }).motivos).toContain('Aumento máximo de 25% por etapa: até R$ 75,00.')
  })

  it('T-08: precisa de 100 operações, expectativa positiva e zero violações em 30 dias', () => {
    const r = avaliarAumentoRisco({ ...ok, operacoesFechadas: 99, expectativaLiquidaCentavos: 0, violacoesUltimos30Dias: 1, riscoNovoCentavos: 7000 })
    expect(r.permitido).toBe(false)
    expect(r.motivos).toEqual([
      'Faltam 1 operações para chegar a 100.',
      'A expectativa líquida precisa ser positiva.',
      'Houve violação de trava nos últimos 30 dias.',
    ])
  })

  it('T-08: no máximo uma etapa a cada 6 meses', () => {
    const r = avaliarAumentoRisco({ ...ok, hoje: '2027-07-09', riscoNovoCentavos: 7000 })
    expect(r.motivos).toContain('Próximo aumento só a partir de 10/07/2027.')
  })

  it('reduzir ou manter o risco é sempre permitido', () => {
    expect(avaliarAumentoRisco({ ...ok, operacoesFechadas: 3, riscoNovoCentavos: 5000 }).permitido).toBe(true)
  })

  it('T-09: trade só entra no plano com 100 operações, expectativa positiva e zero violações em 30 dias', () => {
    expect(tradeValidado({ operacoesFechadas: 100, expectativaLiquidaCentavos: 1, violacoesUltimos30Dias: 0 })).toBe(true)
    expect(tradeValidado({ operacoesFechadas: 100, expectativaLiquidaCentavos: 1, violacoesUltimos30Dias: 1 })).toBe(false)
    expect(tradeValidado({ operacoesFechadas: 80, expectativaLiquidaCentavos: 900, violacoesUltimos30Dias: 0 })).toBe(false)
  })
})
