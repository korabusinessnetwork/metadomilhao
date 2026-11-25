import { supabase } from '../supabase'
import type { Fechamento } from '../tipos'
import { executar, type Resultado } from './resultado'
import type { RascunhoFechamento } from '../calculos/fechamento'

const CAMPOS = 'id, mes, renda_real, gasto_real, aporte_real, patrimonio_real, patrimonio_projetado, meta_batida, violacoes_trava, notas, substitui, criado_em'

/** Fechamentos vigentes (sem os substituídos), do mais recente para o mais antigo. */
export async function historico(): Promise<Resultado<Fechamento[]>> {
  return executar(supabase.from('v_fechamento_vigente').select(CAMPOS).order('mes', { ascending: false }))
}

/** Grava o fechamento. Se o mês já tem um vigente, entra como substituição (o original fica no histórico). */
export async function confirmar(mes: string, r: RascunhoFechamento, notas: string, substitui: string | null): Promise<Resultado<null>> {
  return executar(
    supabase
      .from('fechamento_mes')
      .insert({
        mes,
        renda_real: r.rendaReal,
        gasto_real: Math.max(0, r.gastoReal),
        aporte_real: r.aporteReal,
        patrimonio_real: r.patrimonioReal,
        patrimonio_projetado: r.patrimonioProjetado,
        meta_batida: r.metaBatida,
        violacoes_trava: 0, // travas de trade entram na Fase 2 (TR-06)
        notas: notas.trim() || null,
        substitui,
      })
      .then((x) => ({ data: null, error: x.error })),
  )
}
