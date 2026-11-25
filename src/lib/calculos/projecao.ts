// Plano do milhão (PL-01 a PL-05). Valores em dinheiro de hoje (taxa real).

/** Aporte do mês `m` da projeção, começando em 1 (o primeiro mês projetado). */
export type FuncaoAporte = (m: number) => number

export interface EntradaProjecao {
  patrimonioInicialCentavos: number
  taxaRealMensal: number
  aporte: FuncaoAporte
}

export interface PontoProjecao {
  mes: number
  patrimonioCentavos: number
}

/** Limite de segurança: 100 anos. Passou disso, o prazo é tratado como fora do alcance. */
export const HORIZONTE_MAXIMO_MESES = 1200

function proximoMes(patrimonio: number, taxa: number, aporte: number): number {
  // PL-01: patrimônio × (1 + taxa real) + aporte do mês
  return Math.round(patrimonio * (1 + taxa) + aporte)
}

export function projetarSerie(e: EntradaProjecao & { meses: number }): PontoProjecao[] {
  const serie: PontoProjecao[] = [{ mes: 0, patrimonioCentavos: e.patrimonioInicialCentavos }]
  let patrimonio = e.patrimonioInicialCentavos
  for (let m = 1; m <= e.meses; m++) {
    patrimonio = proximoMes(patrimonio, e.taxaRealMensal, e.aporte(m))
    serie.push({ mes: m, patrimonioCentavos: patrimonio })
  }
  return serie
}

/** PL-05: meses até atingir a meta. null quando não chega dentro do horizonte máximo. */
export function mesesAteMeta(e: EntradaProjecao & { metaCentavos: number }): number | null {
  let patrimonio = e.patrimonioInicialCentavos
  if (patrimonio >= e.metaCentavos) return 0
  for (let m = 1; m <= HORIZONTE_MAXIMO_MESES; m++) {
    patrimonio = proximoMes(patrimonio, e.taxaRealMensal, e.aporte(m))
    if (patrimonio >= e.metaCentavos) return m
  }
  return null
}

/** PL-02 */
export function taxaAnualEquivalente(taxaMensal: number): number {
  return (1 + taxaMensal) ** 12 - 1
}

export type IdCenario = 'base' | 'conservador' | 'com_trade'

export interface Cenario {
  id: IdCenario
  nome: string
  taxaRealMensal: number
  aporte: FuncaoAporte
  meses: number | null
}

/** PL-03: Base, Conservador (taxa − 0,15 p.p.) e Com trade (só quando T-09 for atendida). */
export function montarCenarios(
  base: EntradaProjecao & { metaCentavos: number },
  trade: { tradeHabilitado: boolean; aporteTradeCentavos: number },
): Cenario[] {
  const conservadorTaxa = Math.max(0, base.taxaRealMensal - 0.0015)
  const cenarios: Cenario[] = [
    { id: 'base', nome: 'Base', taxaRealMensal: base.taxaRealMensal, aporte: base.aporte, meses: mesesAteMeta(base) },
    {
      id: 'conservador',
      nome: 'Conservador',
      taxaRealMensal: conservadorTaxa,
      aporte: base.aporte,
      meses: mesesAteMeta({ ...base, taxaRealMensal: conservadorTaxa }),
    },
  ]
  if (trade.tradeHabilitado) {
    const aporteComTrade: FuncaoAporte = (m) => base.aporte(m) + trade.aporteTradeCentavos
    cenarios.push({
      id: 'com_trade',
      nome: 'Com trade',
      taxaRealMensal: base.taxaRealMensal,
      aporte: aporteComTrade,
      meses: mesesAteMeta({ ...base, aporte: aporteComTrade }),
    })
  }
  return cenarios
}

/**
 * F-01/F-02: aporte atual até o mês da mudança (inclusive) e aporte pós-mudança depois.
 * `mesesAteMudanca` é contado a partir do mês do patrimônio inicial.
 */
export function aportePorFase(aporteAtualCentavos: number, aportePosMudancaCentavos: number, mesesAteMudanca: number): FuncaoAporte {
  return (m) => (m <= mesesAteMudanca ? aporteAtualCentavos : aportePosMudancaCentavos)
}
