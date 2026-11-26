import { supabase } from '../supabase'
import type { Mercado } from '../calculos/trade'
import type { ItemWatchlistBanco, RevisaoNoticias, UsoIA } from '../tipos'
import { executar, falha, ok, type Resultado } from './resultado'

const CAMPOS_REVISAO = 'id, data, gerada_em, origem, modelo, conteudo, agenda, contexto_geral, custo_estimado_centavos, status, aviso_orcamento, erro'

/** ADR-004: teto mensal da IA. O valor que vale é o TETO_MENSAL_CENTAVOS da Edge Function; aqui é só para exibir. */
export const TETO_IA_CENTAVOS = 3000

export async function listarWatchlist(): Promise<Resultado<ItemWatchlistBanco[]>> {
  return executar(supabase.from('watchlist').select('id, ativo, mercado, ativa').order('ativa', { ascending: false }).order('ativo'))
}

export async function adicionarWatchlist(ativo: string, mercado: Mercado): Promise<Resultado<null>> {
  const codigo = ativo.trim().toUpperCase()
  if (!/^[A-Z0-9]{3,12}$/.test(codigo)) return { dados: null, erro: 'Código do ativo inválido (ex.: PETR4, WIN).' }
  return executar(supabase.from('watchlist').insert({ ativo: codigo, mercado }).then((r) => ({ data: null, error: r.error })))
}

export async function alternarWatchlist(id: string, ativa: boolean): Promise<Resultado<null>> {
  return executar(supabase.from('watchlist').update({ ativa }).eq('id', id).then((r) => ({ data: null, error: r.error })))
}

export async function removerWatchlist(id: string): Promise<Resultado<null>> {
  return executar(supabase.from('watchlist').delete().eq('id', id).then((r) => ({ data: null, error: r.error })))
}

/** A revisão mais recente da data (pode haver mais de uma se foi gerada na mão). */
export async function revisaoDoDia(data: string): Promise<Resultado<RevisaoNoticias | null>> {
  return executar(supabase.from('revisao_noticias').select(CAMPOS_REVISAO).eq('data', data).order('gerada_em', { ascending: false }).limit(1).maybeSingle())
}

export async function historicoRevisoes(): Promise<Resultado<RevisaoNoticias[]>> {
  return executar(supabase.from('revisao_noticias').select(CAMPOS_REVISAO).order('gerada_em', { ascending: false }).limit(30))
}

export async function usoDoMes(mes: string): Promise<Resultado<UsoIA | null>> {
  return executar(supabase.from('uso_ia').select('mes, chamadas, buscas, custo_estimado_centavos').eq('mes', mes).maybeSingle())
}

export async function feriadosNacionais(): Promise<Resultado<string[]>> {
  const r = await executar<{ data: string }[]>(supabase.from('feriado_b3').select('data').eq('nacional', true))
  if (r.erro !== null) return r
  return ok(r.dados.map((f) => f.data))
}

/** Disparo manual (conta para o teto, IA-03). A Edge Function exige o JWT do dono. */
export async function gerarAgora(): Promise<Resultado<{ status: string }>> {
  try {
    const { data, error } = await supabase.functions.invoke('revisao-noticias', { method: 'POST', body: {} })
    if (error) return falha({ message: 'Não foi possível gerar a revisão agora.' })
    return ok(data as { status: string })
  } catch (e) {
    return falha({ message: e instanceof Error ? e.message : '' })
  }
}

/** Só links http(s) vindos da IA viram link clicável. */
export function urlSegura(url: string): string | null {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
  } catch {
    return null
  }
}
