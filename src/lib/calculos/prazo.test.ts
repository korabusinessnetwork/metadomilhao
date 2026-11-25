import { describe, expect, it } from 'vitest'
import { formatarPrazo } from './prazo'

describe('prazo', () => {
  it('converte meses em anos e meses', () => {
    expect(formatarPrazo(403)).toBe('33 anos e 7 meses')
    expect(formatarPrazo(12)).toBe('1 ano')
    expect(formatarPrazo(13)).toBe('1 ano e 1 mês')
    expect(formatarPrazo(5)).toBe('5 meses')
    expect(formatarPrazo(0)).toBe('meta atingida')
    expect(formatarPrazo(null)).toBe('fora do alcance')
  })
})
