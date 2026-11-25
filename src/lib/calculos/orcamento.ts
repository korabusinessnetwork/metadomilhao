import { dataValida, diaDoMes, inicioDoMes } from './datas'

/** O-02: o orçamento de um mês pode ser ajustado livremente até o dia 5 dele. Depois, toda mudança vai para o histórico. */
export function ajusteLivre(mesOrcamento: string, hoje: string): boolean {
  const mesHoje = inicioDoMes(hoje)
  if (mesHoje < mesOrcamento) return true
  if (mesHoje > mesOrcamento) return false
  return diaDoMes(hoje) <= 5
}

/** O-03: categoria sem lançamento nos 2 últimos meses fechados vira "estimativa". Meses do mais recente para o mais antigo. */
export function categoriasEstimativa(e: {
  categorias: string[]
  ultimosMesesFechados: { mes: string; categoriasComLancamento: string[] }[]
}): string[] {
  const dois = e.ultimosMesesFechados.slice(0, 2)
  if (dois.length < 2) return []
  return e.categorias.filter((c) => dois.every((m) => !m.categoriasComLancamento.includes(c)))
}

/** O-04 */
export function validarLancamento(e: { data: string; categoriaId: string; valorCentavos: number }): string[] {
  const erros: string[] = []
  if (!dataValida(e.data)) erros.push('Data inválida.')
  if (!e.categoriaId) erros.push('Escolha uma categoria.')
  if (!Number.isInteger(e.valorCentavos) || e.valorCentavos <= 0) erros.push('O valor precisa ser maior que zero.')
  return erros
}
