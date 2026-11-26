import { describe, expect, it } from 'vitest'
import { abertaEmDoDia, montarCalendarioTrade, podeRegistrarNoDia, registradaDepois, resultadoCurto } from './calendarioTrade'

const op = (data: string, liquido: number | null, extra: { violacao?: boolean } = {}) => ({
  data,
  resultado_liquido_centavos: liquido,
  violacao_trava: extra.violacao ?? false,
})

describe('calendário de trade (T-10)', () => {
  it('monta só os dias de pregão possíveis (segunda a sexta), em semanas de 5 colunas', () => {
    // novembro de 2026: dia 1 é domingo, dia 2 é segunda, dia 30 é segunda
    const c = montarCalendarioTrade({ mes: '2026-11-01', hoje: '2026-11-26', ops: [], feriados: [] })
    expect(c.semanas[0]!.map((d) => d?.data ?? null)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'])
    expect(c.semanas.flat().filter((d) => d !== null)).toHaveLength(21)
    // a última semana tem só a segunda 30; o resto fica vazio
    expect(c.semanas.at(-1)!.map((d) => d?.data ?? null)).toEqual(['2026-11-30', null, null, null, null])
  })

  it('mês que começa no meio da semana deixa as colunas anteriores vazias', () => {
    // outubro de 2026: dia 1 é quinta
    const c = montarCalendarioTrade({ mes: '2026-10-01', hoje: '2026-11-26', ops: [], feriados: [] })
    expect(c.semanas[0]!.map((d) => d?.data ?? null)).toEqual([null, null, null, '2026-10-01', '2026-10-02'])
  })

  it('soma o líquido das operações encerradas do dia e conta todas, inclusive em aberto', () => {
    const c = montarCalendarioTrade({
      mes: '2026-11-01',
      hoje: '2026-11-26',
      ops: [op('2026-11-03', 12000), op('2026-11-03', -4550), op('2026-11-03', null), op('2026-11-04', -2000, { violacao: true })],
      feriados: [],
    })
    const dia3 = c.semanas.flat().find((d) => d?.data === '2026-11-03')!
    expect(dia3.resultadoCentavos).toBe(7450)
    expect(dia3.operacoes).toBe(3)
    expect(dia3.teveViolacao).toBe(false)
    const dia4 = c.semanas.flat().find((d) => d?.data === '2026-11-04')!
    expect(dia4.teveViolacao).toBe(true)
    // dia sem operação: resultado null, não zero (zero seria um dia operado empatado)
    expect(c.semanas.flat().find((d) => d?.data === '2026-11-05')!.resultadoCentavos).toBeNull()
  })

  it('marca hoje, futuro e feriado', () => {
    const c = montarCalendarioTrade({ mes: '2026-11-01', hoje: '2026-11-26', ops: [], feriados: ['2026-11-20'] })
    const d = (data: string) => c.semanas.flat().find((x) => x?.data === data)!
    expect(d('2026-11-26').hoje).toBe(true)
    expect(d('2026-11-27').futuro).toBe(true)
    expect(d('2026-11-25').futuro).toBe(false)
    expect(d('2026-11-20').feriado).toBe(true)
    expect(d('2026-11-19').feriado).toBe(false)
  })

  it('total do mês soma só o que foi encerrado', () => {
    const c = montarCalendarioTrade({ mes: '2026-11-01', hoje: '2026-11-26', ops: [op('2026-11-03', 12000), op('2026-11-10', -2000), op('2026-11-10', null)], feriados: [] })
    expect(c.totalCentavos).toBe(10000)
    expect(c.diasOperados).toBe(2)
  })

  it('podeRegistrarNoDia: hoje e dias passados de pregão sim; futuro, feriado e fim de semana não', () => {
    const feriados = ['2026-11-20']
    expect(podeRegistrarNoDia('2026-11-26', '2026-11-26', feriados)).toEqual({ pode: true })
    expect(podeRegistrarNoDia('2026-11-25', '2026-11-26', feriados)).toEqual({ pode: true })
    expect(podeRegistrarNoDia('2026-11-27', '2026-11-26', feriados)).toEqual({ pode: false, motivo: 'Dia futuro: só dá para registrar o que já aconteceu.' })
    expect(podeRegistrarNoDia('2026-11-20', '2026-11-26', feriados)).toEqual({ pode: false, motivo: 'Feriado na B3: não houve pregão.' })
    expect(podeRegistrarNoDia('2026-11-22', '2026-11-26', feriados)).toEqual({ pode: false, motivo: 'Fim de semana: não houve pregão.' })
  })

  it('abertaEmDoDia: junta dia e hora no fuso de São Paulo e recusa hora inválida', () => {
    expect(abertaEmDoDia('2026-11-25', '10:05')).toBe('2026-11-25T10:05:00-03:00')
    expect(abertaEmDoDia('2026-11-25', '9:05')).toBe('2026-11-25T09:05:00-03:00')
    expect(abertaEmDoDia('2026-11-25', '24:00')).toBeNull()
    expect(abertaEmDoDia('2026-11-25', '10:60')).toBeNull()
    expect(abertaEmDoDia('2026-11-25', '')).toBeNull()
    expect(abertaEmDoDia('2026-02-30', '10:00')).toBeNull()
  })

  it('registradaDepois: criada num dia posterior ao da operação, no fuso de São Paulo', () => {
    expect(registradaDepois({ data: '2026-11-25', criado_em: '2026-11-26T13:00:00Z' })).toBe(true)
    expect(registradaDepois({ data: '2026-11-25', criado_em: '2026-11-25T20:00:00Z' })).toBe(false)
    // 01:30 UTC do dia 26 ainda é dia 25 em São Paulo
    expect(registradaDepois({ data: '2026-11-25', criado_em: '2026-11-26T01:30:00Z' })).toBe(false)
  })

  it('resultadoCurto: reais arredondados com sinal, sem cortar dígitos', () => {
    expect(resultadoCurto(15880)).toBe('+159')
    expect(resultadoCurto(-6120)).toBe('−61')
    expect(resultadoCurto(125049)).toBe('+1.250')
    expect(resultadoCurto(0)).toBe('0')
    // perda pequena não vira "0" sem sinal: o sinal continua dizendo a direção
    expect(resultadoCurto(-30)).toBe('−0')
  })
})
