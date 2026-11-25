import { describe, expect, it } from 'vitest'
import { valorComSinal, resumoCarteira } from './patrimonio'

describe('carteira', () => {
  it('aporte sempre positivo, resgate sempre negativo, rendimento e ajuste seguem o sinal escolhido', () => {
    expect(valorComSinal('aporte', 1000, true)).toBe(1000)
    expect(valorComSinal('resgate', 1000, false)).toBe(-1000)
    expect(valorComSinal('rendimento', 1000, true)).toBe(-1000)
    expect(valorComSinal('ajuste_saldo', 1000, false)).toBe(1000)
  })

  it('P-03 e P-04: soma por classe, reserva contra a meta e peso do capital de trade', () => {
    const r = resumoCarteira(
      [
        { classe: 'reserva', saldo_centavos: 600000 },
        { classe: 'reserva', saldo_centavos: 300000 },
        { classe: 'renda_fixa', saldo_centavos: 50000 },
        { classe: 'capital_trade', saldo_centavos: 50000 },
      ],
      1800000,
    )
    expect(r.totalCentavos).toBe(1000000)
    expect(r.porClasse.reserva).toBe(900000)
    expect(r.faltaReservaCentavos).toBe(900000)
    expect(r.reservaCompleta).toBe(false)
    expect(r.pctCapitalTrade).toBeCloseTo(0.05)
    expect(r.capitalTradeAcimaDoLimite).toBe(false)
  })

  it('P-03: sem meta definida (orçamento vazio), a reserva nunca aparece como completa', () => {
    const r = resumoCarteira([], 0)
    expect(r.reservaCompleta).toBe(false)
  })

  it('P-04: capital de trade acima de 10% do patrimônio é sinalizado', () => {
    const r = resumoCarteira([{ classe: 'reserva', saldo_centavos: 800000 }, { classe: 'capital_trade', saldo_centavos: 200000 }], 600000)
    expect(r.reservaCompleta).toBe(true)
    expect(r.faltaReservaCentavos).toBe(0)
    expect(r.capitalTradeAcimaDoLimite).toBe(true)
  })
})
