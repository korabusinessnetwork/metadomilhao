import { describe, expect, it } from 'vitest'
import { dataEmSaoPaulo, diasRestantesNoMes, inicioDoMes, somarMeses, mesesEntre, ultimoDiaDoMes, dataValida } from './datas'

describe('datas em America/Sao_Paulo', () => {
  it('vira o dia à meia-noite de Brasília, não de UTC', () => {
    // 02:30 UTC = 23:30 do dia anterior em São Paulo (UTC-3)
    expect(dataEmSaoPaulo(new Date('2027-03-01T02:30:00Z'))).toBe('2027-02-28')
    expect(dataEmSaoPaulo(new Date('2027-03-01T03:00:00Z'))).toBe('2027-03-01')
  })

  it('conta os dias restantes do mês incluindo hoje', () => {
    expect(diasRestantesNoMes('2027-02-01')).toBe(28)
    expect(diasRestantesNoMes('2027-02-28')).toBe(1)
    expect(diasRestantesNoMes('2028-02-28')).toBe(2) // bissexto
    expect(diasRestantesNoMes('2027-03-15')).toBe(17)
  })

  it('aritmética de meses', () => {
    expect(inicioDoMes('2027-03-15')).toBe('2027-03-01')
    expect(ultimoDiaDoMes('2027-02-10')).toBe('2027-02-28')
    expect(somarMeses('2027-11-01', 3)).toBe('2028-02-01')
    expect(somarMeses('2027-03-01', -1)).toBe('2027-02-01')
    expect(mesesEntre('2026-11-01', '2027-02-01')).toBe(3)
    expect(mesesEntre('2027-02-01', '2026-11-01')).toBe(-3)
  })

  it('valida datas de calendário', () => {
    expect(dataValida('2027-02-28')).toBe(true)
    expect(dataValida('2027-02-29')).toBe(false)
    expect(dataValida('2027-13-01')).toBe(false)
    expect(dataValida('01/02/2027')).toBe(false)
  })
})
