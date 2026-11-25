import { inicioDaSemana, inicioDoMes, primeiroDiaUtilDoMes, proximoDiaUtil, somarDias, somarMeses } from './datas'

// Travas de risco (M-10 a M-13, TR-01, TR-05). A mesma regra roda no banco (ADR-003); aqui é para a tela.

export interface ParametrosTrava {
  riscoOperacaoCentavos: number
  stopGainR: number
  stopLossDiaR: number
  pctPerdaDia: number
  pctPerdaSemana: number
  pctPerdaMes: number
}

export interface CapitaisDoPeriodo {
  capitalInicioDiaCentavos: number
  capitalInicioSemanaCentavos: number
  capitalInicioMesCentavos: number
}

export interface Limites {
  metaDiaCentavos: number
  perdaDiaCentavos: number
  perdaSemanaCentavos: number
  perdaMesCentavos: number
}

export function limitesDoPeriodo(p: ParametrosTrava, c: CapitaisDoPeriodo): Limites {
  return {
    metaDiaCentavos: Math.round(p.stopGainR * p.riscoOperacaoCentavos), // M-10
    perdaDiaCentavos: Math.min(Math.round(p.stopLossDiaR * p.riscoOperacaoCentavos), Math.round((c.capitalInicioDiaCentavos * p.pctPerdaDia) / 100)), // M-11
    perdaSemanaCentavos: Math.round((c.capitalInicioSemanaCentavos * p.pctPerdaSemana) / 100), // M-12
    perdaMesCentavos: Math.round((c.capitalInicioMesCentavos * p.pctPerdaMes) / 100), // M-13
  }
}

export type MotivoTrava = 'perda_mes' | 'perda_semana' | 'perda_dia' | 'meta_dia' | 'manual'

export interface StatusTravas {
  aberto: boolean
  motivo: MotivoTrava | null
  /** TR-05: reabre sozinho nesta data. Não existe desbloqueio manual. */
  reabreEm: string | null
  limites: Limites
}

export const TEXTO_MOTIVO: Record<MotivoTrava, string> = {
  perda_mes: 'Limite de perda do mês atingido.',
  perda_semana: 'Limite de perda da semana atingido.',
  perda_dia: 'Limite de perda do dia atingido.',
  meta_dia: 'Meta de lucro do dia atingida.',
  manual: 'Dia encerrado por você.',
}

export interface ResultadosPeriodo {
  diaCentavos: number
  semanaCentavos: number
  mesCentavos: number
  /** Extremos do acumulado ao longo do período. Uma vez batido, o limite fica batido (TR-05). */
  piorDiaCentavos?: number
  melhorDiaCentavos?: number
  piorSemanaCentavos?: number
  piorMesCentavos?: number
}

/** TR-01: o período mais longo fechado vence (mês, depois semana, depois dia). */
export function statusTravas(e: ParametrosTrava & CapitaisDoPeriodo & ResultadosPeriodo & { data: string; encerradoManual: boolean }): StatusTravas {
  const limites = limitesDoPeriodo(e, e)
  const fechado = (motivo: MotivoTrava, reabreEm: string): StatusTravas => ({ aberto: false, motivo, reabreEm, limites })
  const piorMes = Math.min(e.mesCentavos, e.piorMesCentavos ?? e.mesCentavos)
  const piorSemana = Math.min(e.semanaCentavos, e.piorSemanaCentavos ?? e.semanaCentavos)
  const piorDia = Math.min(e.diaCentavos, e.piorDiaCentavos ?? e.diaCentavos)
  const melhorDia = Math.max(e.diaCentavos, e.melhorDiaCentavos ?? e.diaCentavos)
  // Limite zero (sem capital) não fecha nada: sem capital, a T-04 recusa qualquer operação
  const bateu = (resultado: number, limite: number) => limite > 0 && resultado <= -limite
  if (bateu(piorMes, limites.perdaMesCentavos)) return fechado('perda_mes', primeiroDiaUtilDoMes(somarMeses(inicioDoMes(e.data), 1)))
  if (bateu(piorSemana, limites.perdaSemanaCentavos)) return fechado('perda_semana', somarDias(inicioDaSemana(e.data), 7))
  if (bateu(piorDia, limites.perdaDiaCentavos)) return fechado('perda_dia', proximoDiaUtil(e.data))
  if (limites.metaDiaCentavos > 0 && melhorDia >= limites.metaDiaCentavos) return fechado('meta_dia', proximoDiaUtil(e.data))
  if (e.encerradoManual) return fechado('manual', proximoDiaUtil(e.data))
  return { aberto: true, motivo: null, reabreEm: null, limites }
}

/**
 * Resultado líquido do dia, da semana (desde segunda) e do mês da data, com os extremos do acumulado.
 * As operações chegam na ordem em que foram encerradas.
 */
export function resultadosDoPeriodo(ops: { data: string; resultadoLiquidoCentavos: number }[], data: string): Required<ResultadosPeriodo> {
  const semana = inicioDaSemana(data)
  const mes = inicioDoMes(data)
  let dia = 0, sem = 0, mesAc = 0
  let piorDia = 0, melhorDia = 0, piorSem = 0, piorMes = 0
  for (const o of ops) {
    if (o.data < mes || o.data > data) continue
    mesAc += o.resultadoLiquidoCentavos
    piorMes = Math.min(piorMes, mesAc)
    if (o.data >= semana) {
      sem += o.resultadoLiquidoCentavos
      piorSem = Math.min(piorSem, sem)
    }
    if (o.data === data) {
      dia += o.resultadoLiquidoCentavos
      piorDia = Math.min(piorDia, dia)
      melhorDia = Math.max(melhorDia, dia)
    }
  }
  return { diaCentavos: dia, semanaCentavos: sem, mesCentavos: mesAc, piorDiaCentavos: piorDia, melhorDiaCentavos: melhorDia, piorSemanaCentavos: piorSem, piorMesCentavos: piorMes }
}
