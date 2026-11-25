import { describe, expect, it } from 'vitest'
import { formatarCentavos, paraCentavos } from './dinheiro'

describe('dinheiro', () => {
  it('formata centavos em BRL com sinal', () => {
    expect(formatarCentavos(123456)).toBe('R$ 1.234,56')
    expect(formatarCentavos(-500, { sinal: true })).toBe('−R$ 5,00')
    expect(formatarCentavos(500, { sinal: true })).toBe('+R$ 5,00')
    expect(formatarCentavos(0)).toBe('R$ 0,00')
    expect(formatarCentavos(-500)).toBe('−R$ 5,00')
  })

  it('converte texto digitado em centavos inteiros', () => {
    expect(paraCentavos('12,50')).toBe(1250)
    expect(paraCentavos('1.234,5')).toBe(123450)
    expect(paraCentavos('R$ 10')).toBe(1000)
    expect(paraCentavos('0,1')).toBe(10)
    expect(paraCentavos('3,999')).toBeNull()
    expect(paraCentavos('')).toBeNull()
    expect(paraCentavos('abc')).toBeNull()
    expect(paraCentavos('-5')).toBeNull()
  })
})
