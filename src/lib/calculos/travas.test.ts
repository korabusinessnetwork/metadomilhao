import { describe, expect, it } from 'vitest'
import { statusTravas, limitesDoPeriodo, resultadosDoPeriodo } from './travas'

const param = { riscoOperacaoCentavos: 6000, stopGainR: 2, stopLossDiaR: 2, pctPerdaDia: 2, pctPerdaSemana: 3, pctPerdaMes: 8 }
const capitais = { capitalInicioDiaCentavos: 600000, capitalInicioSemanaCentavos: 600000, capitalInicioMesCentavos: 600000 }

describe('limites e travas (M-10 a M-13, TR-01)', () => {
  it('M-10 a M-13: limites do período', () => {
    expect(limitesDoPeriodo(param, capitais)).toEqual({
      metaDiaCentavos: 12000, // 2R
      perdaDiaCentavos: 12000, // min(2R = 120, 2% de 6000 = 120)
      perdaSemanaCentavos: 18000, // 3%
      perdaMesCentavos: 48000, // 8%
    })
    // M-11: com capital menor, 2% do capital vence 2R
    expect(limitesDoPeriodo(param, { ...capitais, capitalInicioDiaCentavos: 300000 }).perdaDiaCentavos).toBe(6000)
  })

  it('sem capital (limites zero), o diário não fecha por "perda" de R$ 0: quem barra é a T-04', () => {
    const s = statusTravas({
      data: '2027-03-10', ...param,
      capitalInicioDiaCentavos: 0, capitalInicioSemanaCentavos: 0, capitalInicioMesCentavos: 0,
      diaCentavos: 0, semanaCentavos: 0, mesCentavos: 0, encerradoManual: false,
    })
    expect(s.aberto).toBe(true)
  })

  it('TR-01: dia aberto dentro dos limites', () => {
    const s = statusTravas({ data: '2027-03-10', ...param, ...capitais, diaCentavos: 5000, semanaCentavos: 5000, mesCentavos: 5000, encerradoManual: false })
    expect(s.aberto).toBe(true)
    expect(s.motivo).toBeNull()
  })

  it('TR-01 e M-10: bater a meta de lucro fecha o dia, e ele reabre no próximo dia útil', () => {
    const s = statusTravas({ data: '2027-03-12', ...param, ...capitais, diaCentavos: 12000, semanaCentavos: 12000, mesCentavos: 12000, encerradoManual: false })
    expect(s).toMatchObject({ aberto: false, motivo: 'meta_dia', reabreEm: '2027-03-15' }) // sexta → segunda
  })

  it('TR-01 e M-11: bater o limite de perda do dia fecha o dia', () => {
    const s = statusTravas({ data: '2027-03-10', ...param, ...capitais, diaCentavos: -12000, semanaCentavos: -12000, mesCentavos: -12000, encerradoManual: false })
    expect(s).toMatchObject({ aberto: false, motivo: 'perda_dia', reabreEm: '2027-03-11' })
  })

  it('TR-01 e M-12: perda semanal fecha a semana até a segunda seguinte', () => {
    const s = statusTravas({ data: '2027-03-10', ...param, ...capitais, diaCentavos: -1000, semanaCentavos: -18000, mesCentavos: -18000, encerradoManual: false })
    expect(s).toMatchObject({ aberto: false, motivo: 'perda_semana', reabreEm: '2027-03-15' })
  })

  it('TR-01 e M-13: perda mensal vence as outras e fecha até o primeiro dia útil do mês seguinte', () => {
    const s = statusTravas({ data: '2027-07-20', ...param, ...capitais, diaCentavos: -12000, semanaCentavos: -20000, mesCentavos: -48000, encerradoManual: false })
    expect(s).toMatchObject({ aberto: false, motivo: 'perda_mes', reabreEm: '2027-08-02' }) // 01/08/2027 é domingo
  })

  it('encerrar o dia na mão também fecha só o dia', () => {
    const s = statusTravas({ data: '2027-03-10', ...param, ...capitais, diaCentavos: 0, semanaCentavos: 0, mesCentavos: 0, encerradoManual: true })
    expect(s).toMatchObject({ aberto: false, motivo: 'manual', reabreEm: '2027-03-11' })
  })

  it('TR-05: período fechado não reabre com lucro posterior (a violação com lucro não desfaz a trava)', () => {
    const ops = [
      { data: '2027-03-10', resultadoLiquidoCentavos: -6000 },
      { data: '2027-03-10', resultadoLiquidoCentavos: -6000 }, // bateu −12000: dia fechado
      { data: '2027-03-10', resultadoLiquidoCentavos: 12000 }, // violação com lucro
    ]
    const r = resultadosDoPeriodo(ops, '2027-03-10')
    expect(r.diaCentavos).toBe(0)
    expect(r.piorDiaCentavos).toBe(-12000)
    const s = statusTravas({ data: '2027-03-10', ...param, ...capitais, ...r, encerradoManual: false })
    expect(s.motivo).toBe('perda_dia')
  })

  it('soma os resultados do dia, da semana (começa na segunda) e do mês', () => {
    const ops = [
      { data: '2027-03-07', resultadoLiquidoCentavos: -500 }, // domingo, semana anterior
      { data: '2027-03-08', resultadoLiquidoCentavos: 1000 }, // segunda
      { data: '2027-03-10', resultadoLiquidoCentavos: -3000 },
      { data: '2027-03-10', resultadoLiquidoCentavos: 200 },
      { data: '2027-02-26', resultadoLiquidoCentavos: 9999 }, // mês anterior
    ]
    expect(resultadosDoPeriodo(ops, '2027-03-10')).toMatchObject({ diaCentavos: -2800, semanaCentavos: -1800, mesCentavos: -2300 })
  })
})
