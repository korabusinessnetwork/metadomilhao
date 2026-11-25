import { mesesEntre } from './datas'
import { projetarSerie, type FuncaoAporte } from './projecao'

/** M-01 */
export function metaAnualAporte(aporteMensalCentavos: number): number {
  return aporteMensalCentavos * 12
}

/** M-02 e M-03: projeta do patrimônio real do mês informado até dezembro do mesmo ano, no cenário base. */
export function metaAnualPatrimonio(e: {
  mesDoPatrimonio: string
  patrimonioRealCentavos: number
  taxaRealMensal: number
  aporte: FuncaoAporte
}): number {
  const ano = e.mesDoPatrimonio.slice(0, 4)
  const meses = Math.max(0, mesesEntre(e.mesDoPatrimonio, `${ano}-12-01`))
  const serie = projetarSerie({ patrimonioInicialCentavos: e.patrimonioRealCentavos, taxaRealMensal: e.taxaRealMensal, aporte: e.aporte, meses })
  return serie[serie.length - 1]!.patrimonioCentavos
}

/** M-04 */
export function metaGastoMes(itensOrcadosCentavos: number[]): number {
  return itensOrcadosCentavos.reduce((s, v) => s + v, 0)
}

/** M-05: a distribuição entre reserva e longo prazo segue P-01 (ver reserva.ts). */
export function metaAporteMes(e: { rendaCentavos: number; metaGastoCentavos: number }): number {
  return Math.max(0, e.rendaCentavos - e.metaGastoCentavos)
}

/** M-06 */
export function mesBatido(e: { gastoRealCentavos: number; orcadoCentavos: number; aporteRealCentavos: number; metaAporteCentavos: number }): boolean {
  return e.gastoRealCentavos <= e.orcadoCentavos && e.aporteRealCentavos >= e.metaAporteCentavos
}
