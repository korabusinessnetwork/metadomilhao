import { describe, expect, it } from 'vitest'
import { premissasDoPlano } from './plano'

const plano = { meta_centavos: 100_000_000, taxa_real_mensal: 0.0045, aporte_atual_centavos: 88500, aporte_pos_mudanca_centavos: 244500 }

describe('premissas do plano', () => {
  it('F-01/F-02: mudança em 01/02, vista de novembro, usa o aporte atual em dez e jan; fevereiro já é o novo', () => {
    const p = premissasDoPlano(plano, '2027-02-01', '2026-11-25')
    expect(p.mesesAteMudanca).toBe(2)
    expect([1, 2, 3, 4].map(p.aporte)).toEqual([88500, 88500, 244500, 244500])
    expect(p.aporteDoProximoMes).toBe(88500)
  })

  it('F-02: depois da mudança, só o aporte novo', () => {
    const p = premissasDoPlano(plano, '2027-02-01', '2027-05-10')
    expect(p.mesesAteMudanca).toBe(0)
    expect(p.aporte(1)).toBe(244500)
  })

  it('sem data de mudança, o aporte atual vale para sempre', () => {
    const p = premissasDoPlano(plano, null, '2027-05-10')
    expect(p.aporte(500)).toBe(88500)
  })

  it('aporte planejado de um mês específico, para o fechamento', () => {
    const p = premissasDoPlano(plano, '2027-02-01', '2026-11-25')
    expect(p.aporteNoMes('2027-01-01')).toBe(88500)
    expect(p.aporteNoMes('2027-02-01')).toBe(244500)
  })
})
