import { diasRestantesNoMes } from './datas'

export interface EntradaLimiteGasto {
  hoje: string
  /** M-08: só categorias variáveis. Fixas não entram no limite diário. */
  orcamentoVariavelCentavos: number
  gastoVariavelAteOntemCentavos: number
  gastoVariavelHojeCentavos: number
}

export interface LimiteGasto {
  diasRestantes: number
  limiteHojeCentavos: number
  restanteHojeCentavos: number
  /** M-09: estouro só gera aviso, nunca bloqueio. */
  estourou: boolean
}

/**
 * M-07: (orçamento variável do mês − gasto variável até ontem) ÷ dias restantes, contando hoje.
 * M-09 sai da própria fórmula: o que passou ontem já está no gasto até ontem e reduz os dias seguintes.
 */
export function limiteGastoHoje(e: EntradaLimiteGasto): LimiteGasto {
  const diasRestantes = diasRestantesNoMes(e.hoje)
  const disponivel = Math.max(0, e.orcamentoVariavelCentavos - e.gastoVariavelAteOntemCentavos)
  const limiteHojeCentavos = Math.floor(disponivel / diasRestantes)
  const restanteHojeCentavos = limiteHojeCentavos - e.gastoVariavelHojeCentavos
  return { diasRestantes, limiteHojeCentavos, restanteHojeCentavos, estourou: restanteHojeCentavos < 0 }
}
