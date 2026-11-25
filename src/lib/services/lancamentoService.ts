import { inicioDoMes, somarMeses } from '../calculos/datas'
import { validarLancamento } from '../calculos/orcamento'
import { supabase } from '../supabase'
import type { FonteRenda, Lancamento, Renda } from '../tipos'
import { executar, type Resultado } from './resultado'
import { classificarEnvio } from '../offline/envio'
import type { LancamentoPendente, ResultadoEnvio } from '../offline/fila'

const CAMPOS_LANCAMENTO = 'id, data, categoria_id, valor_centavos, descricao, estorno_de, criado_em'
const CAMPOS_RENDA = 'id, mes, fonte, valor_centavos, recebido_em'

export async function listarMes(mes: string): Promise<Resultado<Lancamento[]>> {
  return listarPeriodo(mes, somarMeses(mes, 1))
}

/** Lançamentos com data em [de, ate). */
export async function listarPeriodo(de: string, ate: string): Promise<Resultado<Lancamento[]>> {
  return executar(
    supabase.from('lancamento').select(CAMPOS_LANCAMENTO).gte('data', de).lt('data', ate).order('data', { ascending: false }).order('criado_em', { ascending: false }),
  )
}

export async function registrar(l: { data: string; categoriaId: string; valorCentavos: number; descricao: string }): Promise<Resultado<Lancamento>> {
  const erros = validarLancamento(l)
  if (erros.length > 0) return { dados: null, erro: erros.join(' ') }
  return executar(
    supabase
      .from('lancamento')
      .insert({ data: l.data, categoria_id: l.categoriaId, valor_centavos: l.valorCentavos, descricao: l.descricao.trim() || null })
      .select(CAMPOS_LANCAMENTO)
      .single(),
  )
}

/** Envio de um lançamento da fila offline. O id vem do aparelho, então reenviar não duplica. */
export async function enviarPendente(l: LancamentoPendente): Promise<ResultadoEnvio> {
  try {
    const { error } = await supabase
      .from('lancamento')
      .insert({ id: l.id, data: l.data, categoria_id: l.categoriaId, valor_centavos: l.valorCentavos, descricao: l.descricao.trim() || null })
    return classificarEnvio(error)
  } catch (e) {
    return classificarEnvio({ message: e instanceof Error ? e.message : 'Failed to fetch' })
  }
}

/** O-05: estorno é um lançamento negativo vinculado, nunca edição do original. */
export async function estornar(original: Lancamento, data: string): Promise<Resultado<Lancamento>> {
  return executar(
    supabase
      .from('lancamento')
      .insert({ data, categoria_id: original.categoria_id, valor_centavos: -original.valor_centavos, descricao: 'Estorno', estorno_de: original.id })
      .select(CAMPOS_LANCAMENTO)
      .single(),
  )
}

export async function listarRendas(mes: string): Promise<Resultado<Renda[]>> {
  return executar(supabase.from('renda').select(CAMPOS_RENDA).eq('mes', inicioDoMes(mes)).order('recebido_em'))
}

export async function registrarRenda(r: { recebidoEm: string; fonte: FonteRenda; valorCentavos: number }): Promise<Resultado<null>> {
  if (!Number.isInteger(r.valorCentavos) || r.valorCentavos <= 0) return { dados: null, erro: 'O valor precisa ser maior que zero.' }
  return executar(
    supabase
      .from('renda')
      .insert({ mes: inicioDoMes(r.recebidoEm), fonte: r.fonte, valor_centavos: r.valorCentavos, recebido_em: r.recebidoEm })
      .then((x) => ({ data: null, error: x.error })),
  )
}

export async function removerRenda(id: string): Promise<Resultado<null>> {
  return executar(supabase.from('renda').delete().eq('id', id).then((x) => ({ data: null, error: x.error })))
}
