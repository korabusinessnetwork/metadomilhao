import { supabase } from '../supabase'
import type { Categoria, OrcamentoItem, OrcamentoMes, TipoCategoria } from '../tipos'
import { executar, falha, ok, type Resultado } from './resultado'

const CAMPOS_CATEGORIA = 'id, nome, tipo, ativa, ordem, estimativa'
const CAMPOS_MES = 'id, mes, renda_prevista_centavos, travado_em'
const CAMPOS_ITEM = 'id, orcamento_mes_id, categoria_id, valor_centavos'

export async function listarCategorias(): Promise<Resultado<Categoria[]>> {
  return executar(supabase.from('categoria').select(CAMPOS_CATEGORIA).order('ordem').order('nome'))
}

export async function criarCategoria(c: { nome: string; tipo: TipoCategoria; ordem: number }): Promise<Resultado<Categoria>> {
  return executar(supabase.from('categoria').insert(c).select(CAMPOS_CATEGORIA).single())
}

export async function atualizarCategoria(id: string, c: Partial<Pick<Categoria, 'nome' | 'tipo' | 'ativa' | 'ordem' | 'estimativa'>>): Promise<Resultado<null>> {
  return executar(supabase.from('categoria').update(c).eq('id', id).then((r) => ({ data: null, error: r.error })))
}

export interface MesOrcado {
  mes: OrcamentoMes
  itens: OrcamentoItem[]
}

/** O-02: abre o mês copiando o anterior (função no banco) e devolve com os itens. */
export async function abrirMes(mes: string): Promise<Resultado<MesOrcado>> {
  const aberto = await executar<string>(supabase.rpc('abrir_orcamento_mes', { p_mes: mes }))
  if (aberto.erro !== null) return aberto
  return obterMes(mes)
}

export async function obterMes(mes: string): Promise<Resultado<MesOrcado>> {
  const m = await executar<OrcamentoMes | null>(supabase.from('orcamento_mes').select(CAMPOS_MES).eq('mes', mes).maybeSingle())
  if (m.erro !== null) return m
  if (!m.dados) return falha({ code: 'P0001', message: 'Orçamento do mês ainda não foi aberto.' })
  const itens = await executar<OrcamentoItem[]>(supabase.from('orcamento_item').select(CAMPOS_ITEM).eq('orcamento_mes_id', m.dados.id))
  if (itens.erro !== null) return itens
  return ok({ mes: m.dados, itens: itens.dados })
}

/** Cria ou altera o valor orçado de uma categoria. Depois do dia 5 o banco grava o histórico (O-02). */
export async function atualizarItem(orcamentoMesId: string, categoriaId: string, valorCentavos: number): Promise<Resultado<null>> {
  return executar(
    supabase
      .from('orcamento_item')
      .upsert({ orcamento_mes_id: orcamentoMesId, categoria_id: categoriaId, valor_centavos: valorCentavos }, { onConflict: 'orcamento_mes_id,categoria_id' })
      .then((r) => ({ data: null, error: r.error })),
  )
}

export async function atualizarRendaPrevista(orcamentoMesId: string, valorCentavos: number): Promise<Resultado<null>> {
  return executar(
    supabase.from('orcamento_mes').update({ renda_prevista_centavos: valorCentavos }).eq('id', orcamentoMesId).then((r) => ({ data: null, error: r.error })),
  )
}

export async function quantidadeMudancasAposDia5(orcamentoMesId: string): Promise<Resultado<number>> {
  try {
    const { count, error } = await supabase.from('orcamento_historico').select('id', { count: 'exact', head: true }).eq('orcamento_mes_id', orcamentoMesId)
    if (error) return falha(error)
    return ok(count ?? 0)
  } catch (e) {
    return falha({ message: e instanceof Error ? e.message : '' })
  }
}
