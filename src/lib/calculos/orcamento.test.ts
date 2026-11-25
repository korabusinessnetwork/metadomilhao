import { describe, expect, it } from 'vitest'
import { ajusteLivre, categoriasEstimativa, validarLancamento } from './orcamento'

describe('orçamento e lançamentos', () => {
  it('O-02: ajuste livre até o dia 5 do mês do orçamento', () => {
    expect(ajusteLivre('2027-03-01', '2027-03-05')).toBe(true)
    expect(ajusteLivre('2027-03-01', '2027-03-06')).toBe(false)
    expect(ajusteLivre('2027-03-01', '2027-02-20')).toBe(true) // mês futuro
    expect(ajusteLivre('2027-03-01', '2027-04-01')).toBe(false) // mês passado
  })

  it('O-03: categoria sem lançamento em 2 meses fechados seguidos vira estimativa', () => {
    const r = categoriasEstimativa({
      categorias: ['mercado', 'diversos', 'nova'],
      ultimosMesesFechados: [
        { mes: '2027-04-01', categoriasComLancamento: ['mercado', 'nova'] },
        { mes: '2027-03-01', categoriasComLancamento: ['mercado'] },
      ],
    })
    expect(r).toEqual(['diversos'])
  })

  it('O-03: com menos de 2 meses fechados, nada é marcado', () => {
    expect(categoriasEstimativa({ categorias: ['a'], ultimosMesesFechados: [{ mes: '2027-03-01', categoriasComLancamento: [] }] })).toEqual([])
  })

  it('O-04: exige data válida, categoria e valor positivo inteiro em centavos', () => {
    expect(validarLancamento({ data: '2027-03-10', categoriaId: 'c1', valorCentavos: 1250 })).toEqual([])
    expect(validarLancamento({ data: '2027-02-30', categoriaId: 'c1', valorCentavos: 1250 })).toContain('Data inválida.')
    expect(validarLancamento({ data: '2027-03-10', categoriaId: '', valorCentavos: 1250 })).toContain('Escolha uma categoria.')
    expect(validarLancamento({ data: '2027-03-10', categoriaId: 'c1', valorCentavos: 0 })).toContain('O valor precisa ser maior que zero.')
    expect(validarLancamento({ data: '2027-03-10', categoriaId: 'c1', valorCentavos: 12.5 })).toContain('O valor precisa ser maior que zero.')
  })
})
