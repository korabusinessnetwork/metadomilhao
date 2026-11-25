import { describe, expect, it } from 'vitest'
import { prepararFechamento, patrimonioNaData } from './fechamento'

describe('fechamento mensal', () => {
  const movimentos = [
    { data: '2027-02-28', tipo: 'aporte' as const, valorCentavos: 100000 },
    { data: '2027-03-05', tipo: 'aporte' as const, valorCentavos: 200000 },
    { data: '2027-03-20', tipo: 'resgate' as const, valorCentavos: -50000 },
    { data: '2027-03-31', tipo: 'rendimento' as const, valorCentavos: 1300 },
    { data: '2027-04-01', tipo: 'aporte' as const, valorCentavos: 999999 },
  ]

  it('patrimônio real = soma dos movimentos até o fim do mês', () => {
    expect(patrimonioNaData(movimentos, '2027-03-31')).toBe(251300)
  })

  it('PL-04 e M-06: pré-preenche o mês e compara com o projetado', () => {
    const f = prepararFechamento({
      mes: '2027-03-01',
      rendasCentavos: [400000, 160000],
      lancamentosDoMes: [
        { valorCentavos: 300000, categoriaId: 'a' },
        { valorCentavos: 20000, categoriaId: 'b' },
        { valorCentavos: -20000, categoriaId: 'b' }, // estorno
      ],
      movimentos,
      orcadoCentavos: 315500,
      patrimonioAnteriorCentavos: 100000,
      taxaRealMensal: 0.0045,
      aportePlanejadoCentavos: 244500,
    })
    expect(f.rendaReal).toBe(560000)
    expect(f.gastoReal).toBe(300000)
    // aporte real = aportes − resgates do mês, sem rendimento
    expect(f.aporteReal).toBe(150000)
    expect(f.patrimonioReal).toBe(251300)
    // projetado = anterior × 1,0045 + aporte planejado
    expect(f.patrimonioProjetado).toBe(100450 + 244500)
    expect(f.metaAporte).toBe(244500)
    expect(f.metaBatida).toBe(false) // gasto ok, aporte abaixo da meta
    expect(f.desvioCentavos).toBe(251300 - 344950)
    expect(f.categoriasEstouradas).toEqual([])
  })

  it('aponta as categorias que estouraram o orçado', () => {
    const f = prepararFechamento({
      mes: '2027-03-01',
      rendasCentavos: [],
      lancamentosDoMes: [{ valorCentavos: 12000, categoriaId: 'mercado' }, { valorCentavos: 500, categoriaId: 'lazer' }],
      movimentos: [],
      orcadoCentavos: 20000,
      orcadoPorCategoria: { mercado: 10000, lazer: 1000 },
      patrimonioAnteriorCentavos: 0,
      taxaRealMensal: 0,
      aportePlanejadoCentavos: 0,
    })
    expect(f.categoriasEstouradas).toEqual([{ categoriaId: 'mercado', orcadoCentavos: 10000, realCentavos: 12000 }])
  })
})
