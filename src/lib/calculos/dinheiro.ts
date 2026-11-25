// Dinheiro sempre em centavos inteiros. A formatação acontece só na borda.

const formatador = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatarCentavos(centavos: number, opcoes: { sinal?: boolean } = {}): string {
  const absoluto = formatador.format(Math.abs(centavos) / 100)
  const texto = `R$ ${absoluto}`
  if (centavos < 0) return `−${texto}`
  if (opcoes.sinal && centavos > 0) return `+${texto}`
  return texto
}

/** Converte o texto digitado ("1.234,56", "R$ 10") em centavos. Retorna null se for inválido ou negativo. */
export function paraCentavos(texto: string): number | null {
  const limpo = texto.replace(/R\$/g, '').replace(/\s/g, '')
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(limpo)) return null
  const [inteiro = '0', fracao = ''] = limpo.replace(/\./g, '').split(',')
  return Number(inteiro) * 100 + Number(fracao.padEnd(2, '0'))
}
