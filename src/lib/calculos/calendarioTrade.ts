// Calendário do diário de trade (T-10): um mês em semanas de pregão (segunda a sexta).
import { dataEmSaoPaulo, dataValida, diaDaSemana, diaDoMes, diasNoMes, inicioDoMes } from './datas'

export interface DiaCalendario {
  data: string
  dia: number
  hoje: boolean
  futuro: boolean
  feriado: boolean
  /** Soma do líquido das operações encerradas. null quando não houve operação encerrada. */
  resultadoCentavos: number | null
  /** Todas as operações do dia, inclusive em aberto */
  operacoes: number
  teveViolacao: boolean
}

export interface CalendarioTrade {
  /** Semanas de 5 colunas (segunda a sexta); null onde o dia é de outro mês */
  semanas: (DiaCalendario | null)[][]
  totalCentavos: number
  diasOperados: number
}

interface OperacaoDoDia {
  data: string
  resultado_liquido_centavos: number | null
  violacao_trava: boolean
}

export function montarCalendarioTrade(p: { mes: string; hoje: string; ops: OperacaoDoDia[]; feriados: string[] }): CalendarioTrade {
  const inicio = inicioDoMes(p.mes)
  const [ano, mes] = inicio.split('-').map(Number) as [number, number]
  const semanas: (DiaCalendario | null)[][] = []
  let semana: (DiaCalendario | null)[] = []
  let totalCentavos = 0
  let diasOperados = 0

  for (let d = 1; d <= diasNoMes(ano, mes); d++) {
    const data = `${inicio.slice(0, 8)}${String(d).padStart(2, '0')}`
    const sem = diaDaSemana(data) // 0 = domingo
    if (sem === 0 || sem === 6) continue
    const coluna = sem - 1
    if (semana.length > 0 && coluna === 0) {
      semanas.push(completar(semana))
      semana = []
    }
    while (semana.length < coluna) semana.push(null)

    const doDia = p.ops.filter((o) => o.data === data)
    const encerradas = doDia.filter((o) => o.resultado_liquido_centavos !== null)
    const resultado = encerradas.length > 0 ? encerradas.reduce((s, o) => s + (o.resultado_liquido_centavos ?? 0), 0) : null
    if (resultado !== null) {
      totalCentavos += resultado
      diasOperados++
    }
    semana.push({
      data,
      dia: diaDoMes(data),
      hoje: data === p.hoje,
      futuro: data > p.hoje,
      feriado: p.feriados.includes(data),
      resultadoCentavos: resultado,
      operacoes: doDia.length,
      teveViolacao: doDia.some((o) => o.violacao_trava),
    })
  }
  if (semana.length > 0) semanas.push(completar(semana))
  return { semanas, totalCentavos, diasOperados }
}

function completar(semana: (DiaCalendario | null)[]): (DiaCalendario | null)[] {
  const s = [...semana]
  while (s.length < 5) s.push(null)
  return s
}

export type PodeRegistrar = { pode: true } | { pode: false; motivo: string }

/** Só se registra o que já aconteceu, num dia de pregão. O banco confere de novo (T-10). */
export function podeRegistrarNoDia(data: string, hoje: string, feriados: string[]): PodeRegistrar {
  if (data > hoje) return { pode: false, motivo: 'Dia futuro: só dá para registrar o que já aconteceu.' }
  const sem = diaDaSemana(data)
  if (sem === 0 || sem === 6) return { pode: false, motivo: 'Fim de semana: não houve pregão.' }
  if (feriados.includes(data)) return { pode: false, motivo: 'Feriado na B3: não houve pregão.' }
  return { pode: true }
}

/** Hora da entrada (HH:MM) no dia escolhido, em São Paulo (UTC−3, sem horário de verão desde 2019). */
export function abertaEmDoDia(data: string, hora: string): string | null {
  if (!dataValida(data)) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(hora.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return `${data}T${String(h).padStart(2, '0')}:${m[2]}:00-03:00`
}

/** T-10: operação lançada num dia posterior ao em que aconteceu. Derivado de criado_em, que o banco carimba. */
export function registradaDepois(o: { data: string; criado_em: string }): boolean {
  return dataEmSaoPaulo(new Date(o.criado_em)) > o.data
}

/**
 * Resultado do dia no quadradinho: reais inteiros com sinal, sem "R$" para caber no celular sem cortar
 * (a legenda diz que é em reais e o detalhe do dia mostra os centavos).
 */
export function resultadoCurto(centavos: number) {
  const sinal = centavos > 0 ? '+' : centavos < 0 ? '−' : ''
  return sinal + Math.round(Math.abs(centavos) / 100).toLocaleString('pt-BR')
}
