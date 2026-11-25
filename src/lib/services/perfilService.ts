import { supabase } from '../supabase'
import type { Categoria, Perfil, PlanoMilhao, TipoCategoria } from '../tipos'
import { executar, falha, ok, type Resultado } from './resultado'

const CAMPOS_PERFIL = 'user_id, nome, data_mudanca, dia_fechamento'
const CAMPOS_PLANO = 'user_id, meta_centavos, taxa_real_mensal, aporte_atual_centavos, aporte_pos_mudanca_centavos, pct_lucro_trade_para_aporte'

export async function obterPerfil(): Promise<Resultado<Perfil | null>> {
  return executar(supabase.from('perfil').select(CAMPOS_PERFIL).maybeSingle())
}

export async function obterPlano(): Promise<Resultado<PlanoMilhao | null>> {
  const r = await executar<PlanoMilhao | null>(supabase.from('plano_milhao').select(CAMPOS_PLANO).maybeSingle())
  if (r.erro !== null) return r
  if (!r.dados) return ok(null)
  // numeric chega como texto ou número conforme o driver; a lógica usa sempre number
  return ok({ ...r.dados, taxa_real_mensal: Number(r.dados.taxa_real_mensal) })
}

export async function salvarPerfil(p: Pick<Perfil, 'nome' | 'data_mudanca'>): Promise<Resultado<null>> {
  return executar(supabase.from('perfil').upsert({ nome: p.nome, data_mudanca: p.data_mudanca }, { onConflict: 'user_id' }).then((r) => ({ data: null, error: r.error })))
}

export async function salvarPlano(
  p: Pick<PlanoMilhao, 'meta_centavos' | 'taxa_real_mensal' | 'aporte_atual_centavos' | 'aporte_pos_mudanca_centavos'>,
): Promise<Resultado<null>> {
  return executar(
    supabase
      .from('plano_milhao')
      .upsert({ ...p, atualizado_em: new Date().toISOString() }, { onConflict: 'user_id' })
      .then((r) => ({ data: null, error: r.error })),
  )
}

/** Categorias de partida. O dono ajusta na tela de orçamento. */
export const CATEGORIAS_INICIAIS: { nome: string; tipo: TipoCategoria; estimativa?: boolean }[] = [
  { nome: 'Moradia', tipo: 'fixa' },
  { nome: 'Contas da casa', tipo: 'fixa' },
  { nome: 'Cartão de crédito', tipo: 'fixa' },
  { nome: 'Mercado', tipo: 'variavel' },
  { nome: 'Transporte', tipo: 'variavel' },
  { nome: 'Lazer', tipo: 'variavel' },
  { nome: 'Diversos', tipo: 'variavel', estimativa: true },
]

export async function configuracaoInicial(e: {
  nome: string
  dataMudanca: string | null
  aporteAtualCentavos: number
  aportePosMudancaCentavos: number
}): Promise<Resultado<null>> {
  const perfil = await salvarPerfil({ nome: e.nome, data_mudanca: e.dataMudanca })
  if (perfil.erro !== null) return perfil
  const plano = await salvarPlano({
    meta_centavos: 100_000_000,
    taxa_real_mensal: 0.0045,
    aporte_atual_centavos: e.aporteAtualCentavos,
    aporte_pos_mudanca_centavos: e.aportePosMudancaCentavos,
  })
  if (plano.erro !== null) return plano
  const existentes = await executar<Pick<Categoria, 'id'>[]>(supabase.from('categoria').select('id').limit(1))
  if (existentes.erro !== null) return falha({ message: '' })
  if (existentes.dados.length === 0) {
    const { error } = await supabase
      .from('categoria')
      .insert(CATEGORIAS_INICIAIS.map((c, i) => ({ nome: c.nome, tipo: c.tipo, ordem: i, estimativa: c.estimativa ?? false })))
    if (error) return falha(error)
  }
  return ok(null)
}
