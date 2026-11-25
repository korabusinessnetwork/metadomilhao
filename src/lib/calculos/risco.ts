import { formatarCentavos } from './dinheiro'
import { somarDias, somarMeses } from './datas'
import { AMOSTRA_MINIMA } from './estatisticas'

export interface Desempenho {
  operacoesFechadas: number
  expectativaLiquidaCentavos: number
  violacoesUltimos30Dias: number
}

/** Mesma janela do banco: violações com data > hoje − 30 dias. */
export function desempenhoDe(ops: { data: string; resultadoLiquidoCentavos: number; violacaoTrava: boolean }[], hoje: string): Desempenho {
  const limite = somarDias(hoje, -30)
  const soma = ops.reduce((s, o) => s + o.resultadoLiquidoCentavos, 0)
  return {
    operacoesFechadas: ops.length,
    expectativaLiquidaCentavos: ops.length === 0 ? 0 : Math.round(soma / ops.length),
    violacoesUltimos30Dias: ops.filter((o) => o.violacaoTrava && o.data > limite).length,
  }
}

/** P-05: lucro de trade não paga despesa; uma parte (padrão 70%) vira aporte. Média por mês operado. */
export function aporteMensalDoTrade(ops: { data: string; resultadoLiquidoCentavos: number }[], pctParaAporte: number): number {
  const meses = new Set(ops.map((o) => o.data.slice(0, 7))).size
  if (meses === 0) return 0
  const media = ops.reduce((s, o) => s + o.resultadoLiquidoCentavos, 0) / meses
  return media > 0 ? Math.round((media * pctParaAporte) / 100) : 0
}

/** T-09: o trade só vira premissa do plano com amostra, expectativa positiva e disciplina. */
export function tradeValidado(d: Desempenho): boolean {
  return d.operacoesFechadas >= AMOSTRA_MINIMA && d.expectativaLiquidaCentavos > 0 && d.violacoesUltimos30Dias === 0
}

function adicionarMesesNaData(data: string, meses: number): string {
  // mesmo dia do mês, N meses depois
  return `${somarMeses(data, meses).slice(0, 8)}${data.slice(8, 10)}`
}

/** T-08: até +25% por etapa, uma etapa a cada 6 meses, com T-09 atendida. Reduzir é sempre permitido. */
export function avaliarAumentoRisco(
  e: Desempenho & { ultimaMudancaRisco: string | null; hoje: string; riscoAtualCentavos: number; riscoNovoCentavos: number },
): { permitido: boolean; motivos: string[]; riscoMaximoCentavos: number } {
  const riscoMaximoCentavos = Math.floor(e.riscoAtualCentavos * 1.25)
  if (e.riscoNovoCentavos <= e.riscoAtualCentavos) return { permitido: true, motivos: [], riscoMaximoCentavos }
  const motivos: string[] = []
  if (e.operacoesFechadas < AMOSTRA_MINIMA) motivos.push(`Faltam ${AMOSTRA_MINIMA - e.operacoesFechadas} operações para chegar a 100.`)
  if (e.expectativaLiquidaCentavos <= 0) motivos.push('A expectativa líquida precisa ser positiva.')
  if (e.violacoesUltimos30Dias > 0) motivos.push('Houve violação de trava nos últimos 30 dias.')
  if (e.ultimaMudancaRisco) {
    const liberado = adicionarMesesNaData(e.ultimaMudancaRisco, 6)
    if (e.hoje < liberado) motivos.push(`Próximo aumento só a partir de ${liberado.split('-').reverse().join('/')}.`)
  }
  if (e.riscoNovoCentavos > riscoMaximoCentavos) motivos.push(`Aumento máximo de 25% por etapa: até ${formatarCentavos(riscoMaximoCentavos)}.`)
  return { permitido: motivos.length === 0, motivos, riscoMaximoCentavos }
}
