import { describe, expect, it } from 'vitest'
import { apurarIR, vencimentoDarf, mesesDeDayTrade } from './ir'

describe('agrupamento por dia e mês', () => {
  it('soma o resultado de cada dia e ordena os meses', () => {
    const ops = [
      { data: '2027-04-02', resultado_liquido_centavos: 100 },
      { data: '2027-03-10', resultado_liquido_centavos: 500 },
      { data: '2027-03-10', resultado_liquido_centavos: -200 },
      { data: '2027-03-11', resultado_liquido_centavos: 50 },
    ]
    expect(mesesDeDayTrade(ops)).toEqual([
      { mes: '2027-03-01', resultadosDiariosCentavos: [300, 50] },
      { mes: '2027-04-01', resultadosDiariosCentavos: [100] },
    ])
  })
})

describe('IR de day trade (IR-01 a IR-04)', () => {
  it('IR-04: vencimento no último dia útil do mês seguinte', () => {
    expect(vencimentoDarf('2027-03-01')).toBe('2027-04-30') // sexta
    expect(vencimentoDarf('2027-04-01')).toBe('2027-05-31') // segunda
    expect(vencimentoDarf('2027-06-01')).toBe('2027-07-30') // 31/07 é sábado
  })

  it('IR-01 e IR-02: 20% do lucro líquido menos 1% retido sobre cada dia positivo', () => {
    const [m] = apurarIR([{ mes: '2027-03-01', resultadosDiariosCentavos: [100000, -20000, 50000] }])
    expect(m).toMatchObject({
      lucroLiquidoCentavos: 130000,
      irrfCentavos: 1500, // 1% de 1000 + 1% de 500
      baseCentavos: 130000,
      impostoDevidoCentavos: 24500, // 26000 − 1500
      prejuizoAcumuladoCentavos: 0,
      vencimento: '2027-04-30',
    })
  })

  it('IR-03: prejuízo acumula e compensa o lucro dos meses seguintes', () => {
    const r = apurarIR([
      { mes: '2027-03-01', resultadosDiariosCentavos: [-80000] },
      { mes: '2027-04-01', resultadosDiariosCentavos: [50000] },
      { mes: '2027-05-01', resultadosDiariosCentavos: [100000] },
    ])
    expect(r[0]).toMatchObject({ impostoDevidoCentavos: 0, prejuizoAcumuladoCentavos: 80000 })
    expect(r[1]).toMatchObject({ prejuizoCompensadoCentavos: 50000, baseCentavos: 0, prejuizoAcumuladoCentavos: 30000 })
    // abril: base 0, então os 500 retidos sobram e abatem maio
    expect(r[2]).toMatchObject({ prejuizoCompensadoCentavos: 30000, baseCentavos: 70000, impostoDevidoCentavos: 14000 - 1000 - 500 })
  })

  it('IRRF maior que o imposto do mês sobra para os meses seguintes, nunca vira imposto negativo', () => {
    const r = apurarIR([
      { mes: '2027-03-01', resultadosDiariosCentavos: [100000, -99000] }, // lucro 1000, IRRF 1000, imposto 200
      { mes: '2027-04-01', resultadosDiariosCentavos: [10000] },
    ])
    expect(r[0]).toMatchObject({ impostoDevidoCentavos: 0, irrfSobraCentavos: 800 })
    expect(r[1]).toMatchObject({ impostoDevidoCentavos: 2000 - 100 - 800 })
  })
})
