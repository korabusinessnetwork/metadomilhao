import { dataValida } from '../calculos/datas'
import { valorComSinal } from '../calculos/patrimonio'
import { supabase } from '../supabase'
import type { ClasseAtivo, Movimento, SaldoAtivo, TipoMovimento } from '../tipos'
import { executar, type Resultado } from './resultado'

const CAMPOS_SALDO = 'ativo_id, nome, classe, instituicao, ativo, saldo_centavos'
const CAMPOS_MOVIMENTO = 'id, ativo_id, data, tipo, valor_centavos'

export async function saldos(): Promise<Resultado<SaldoAtivo[]>> {
  return executar(supabase.from('v_saldo_ativo').select(CAMPOS_SALDO).order('classe').order('nome'))
}

export async function criarAtivo(a: { nome: string; classe: ClasseAtivo; instituicao: string }): Promise<Resultado<null>> {
  if (!a.nome.trim()) return { dados: null, erro: 'Dê um nome ao ativo.' }
  return executar(
    supabase
      .from('ativo_carteira')
      .insert({ nome: a.nome.trim(), classe: a.classe, instituicao: a.instituicao.trim() || null })
      .then((r) => ({ data: null, error: r.error })),
  )
}

export async function arquivarAtivo(id: string, ativo: boolean): Promise<Resultado<null>> {
  return executar(supabase.from('ativo_carteira').update({ ativo }).eq('id', id).then((r) => ({ data: null, error: r.error })))
}

export async function listarMovimentos(): Promise<Resultado<Movimento[]>> {
  return executar(supabase.from('movimento_carteira').select(CAMPOS_MOVIMENTO).order('data', { ascending: false }))
}

export async function registrarMovimento(m: { ativoId: string; data: string; tipo: TipoMovimento; valorCentavos: number; negativo: boolean }): Promise<Resultado<null>> {
  if (!m.ativoId) return { dados: null, erro: 'Escolha o ativo.' }
  if (!dataValida(m.data)) return { dados: null, erro: 'Data inválida.' }
  if (!Number.isInteger(m.valorCentavos) || m.valorCentavos <= 0) return { dados: null, erro: 'O valor precisa ser maior que zero.' }
  return executar(
    supabase
      .from('movimento_carteira')
      .insert({ ativo_id: m.ativoId, data: m.data, tipo: m.tipo, valor_centavos: valorComSinal(m.tipo, m.valorCentavos, m.negativo) })
      .then((r) => ({ data: null, error: r.error })),
  )
}
