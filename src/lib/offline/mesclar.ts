import { inicioDoMes } from '../calculos/datas'
import type { Lancamento } from '../tipos'
import type { LancamentoPendente } from './fila'

export type LancamentoNaTela = Lancamento & { pendente: boolean }

/** O que está na fila entra nos números do mês (o limite do dia não pode mentir), sem contar duas vezes. */
export function mesclarPendentes(doServidor: Lancamento[], pendentes: LancamentoPendente[], mes: string): LancamentoNaTela[] {
  const ids = new Set(doServidor.map((l) => l.id))
  const daFila: LancamentoNaTela[] = pendentes
    .filter((p) => !ids.has(p.id) && inicioDoMes(p.data) === mes)
    .map((p) => ({
      id: p.id,
      data: p.data,
      categoria_id: p.categoriaId,
      valor_centavos: p.valorCentavos,
      descricao: p.descricao.trim() || null,
      estorno_de: null,
      criado_em: p.criadoEm,
      pendente: true,
    }))
  return [...daFila, ...doServidor.map((l) => ({ ...l, pendente: false }))]
}
