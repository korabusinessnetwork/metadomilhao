// Operação de day trade (T-01 a T-05). Preços em reais (numeric); resultados em centavos.

export type Mercado = 'acoes' | 'mini_indice'
export type Direcao = 'compra' | 'venda'
export type Tendencia = 'alta' | 'baixa' | 'lateral'
export type Timeframe = '15s' | '5m' | '15m'

/** Preço digitado ("32,15", "128.500", "1.234,5"). Ponto é milhar, vírgula é decimal. */
export function paraPreco(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, '')
  if (!/^\d{1,3}(\.\d{3})*(,\d+)?$|^\d+(,\d+)?$/.test(limpo)) return null
  const valor = Number(limpo.replace(/\./g, '').replace(',', '.'))
  return valor > 0 ? valor : null
}

/** WIN e WDO são contratos de índice/dólar; aqui o mercado suportado é mini-índice (WIN) ou ações. */
export function mercadoDoAtivo(codigo: string): Mercado {
  return codigo.trim().toUpperCase().startsWith('WIN') ? 'mini_indice' : 'acoes'
}

/** T-03: R$ por ponto por unidade. Ações 1; mini-índice R$ 0,20 por ponto por contrato. */
export function multiplicador(mercado: Mercado): number {
  return mercado === 'mini_indice' ? 0.2 : 1
}

/** Arredonda em centavos depois de converter, para não carregar erro de ponto flutuante. */
function emCentavos(reais: number): number {
  return Math.round(Math.round(reais * 1e6) / 1e4)
}

/** T-03: |entrada − stop| × quantidade × multiplicador */
export function riscoCentavos(o: { mercado: Mercado; entrada: number; stop: number; quantidade: number }): number {
  return emCentavos(Math.abs(o.entrada - o.stop) * o.quantidade * multiplicador(o.mercado))
}

export function resultadoBrutoCentavos(o: { mercado: Mercado; direcao: Direcao; entrada: number; saida: number; quantidade: number }): number {
  const sinal = o.direcao === 'compra' ? 1 : -1
  return emCentavos(sinal * (o.saida - o.entrada) * o.quantidade * multiplicador(o.mercado))
}

/** T-05: resultado líquido ÷ risco, com 2 casas. */
export function resultadoR(liquidoCentavos: number, riscoDaOperacaoCentavos: number): number {
  if (riscoDaOperacaoCentavos <= 0) return 0
  return Math.round((liquidoCentavos / riscoDaOperacaoCentavos) * 100) / 100
}

/** T-04: risco por operação ≤ 1% do capital de trade. */
export const PCT_RISCO_MAXIMO = 0.01

export interface PlanoOperacao {
  mercado: Mercado
  direcao: Direcao
  entrada: number
  stop: number
  alvo: number
  quantidade: number
  capitalCentavos: number
  setupId: string
  tendenciaDiario: Tendencia | ''
  tendenciaH1: Tendencia | ''
  tendenciaH4: Tendencia | ''
  timeframeEntrada: Timeframe | ''
  teveNoticia: boolean
  noticiaDescricao: string
}

export function validarPlanoOperacao(p: PlanoOperacao): string[] {
  const erros: string[] = []
  if (!Number.isInteger(p.quantidade) || p.quantidade <= 0) erros.push('Quantidade precisa ser um inteiro maior que zero.')
  if (![p.entrada, p.stop, p.alvo].every((v) => Number.isFinite(v) && v > 0)) erros.push('Preencha entrada, stop e alvo com valores positivos.')
  else if (p.direcao === 'compra' && !(p.stop < p.entrada && p.entrada < p.alvo)) erros.push('Na compra, o stop fica abaixo da entrada e o alvo acima.')
  else if (p.direcao === 'venda' && !(p.stop > p.entrada && p.entrada > p.alvo)) erros.push('Na venda, o stop fica acima da entrada e o alvo abaixo.')
  if (!p.setupId) erros.push('Escolha o setup (T-02).')
  if (!p.tendenciaDiario || !p.tendenciaH1 || !p.tendenciaH4) erros.push('Informe a tendência no diário, H1 e H4 (T-02).')
  if (!p.timeframeEntrada) erros.push('Informe o timeframe de entrada (T-02).')
  if (p.teveNoticia && !p.noticiaDescricao.trim()) erros.push('Descreva a notícia (T-02).')
  if (erros.length === 0 && riscoCentavos(p) > Math.floor(p.capitalCentavos * PCT_RISCO_MAXIMO)) erros.push('Risco acima de 1% do capital de trade (T-04).')
  return erros
}
