import { supabase } from '../supabase'
import { decodificarRelatorio, lerRelatorioMt5, type PosicaoMt5 } from '../importacao/mt5'
import type { Tendencia, Timeframe } from '../calculos/trade'
import { executar, falha, ok, type Resultado } from './resultado'

export interface RascunhoMt5 {
  id: string
  ticket: string
  linha: number
  dados: PosicaoMt5
}

export interface ResumoImportacao {
  lidas: number
  novas: number
  jaImportadas: number
  avisos: string[]
}

/** Lê o arquivo do MT5 e guarda as posições como rascunho. O ticket repetido é ignorado pelo banco (não duplica). */
export async function importarArquivo(arquivo: File): Promise<Resultado<ResumoImportacao>> {
  let leitura
  try {
    leitura = lerRelatorioMt5(decodificarRelatorio(new Uint8Array(await arquivo.arrayBuffer())))
  } catch {
    return { dados: null, erro: 'Não consegui ler o arquivo.' }
  }
  if (leitura.posicoes.length === 0) return ok({ lidas: 0, novas: 0, jaImportadas: 0, avisos: leitura.avisos })
  const r = await executar<{ id: string }[]>(
    supabase
      .from('importacao_mt5')
      .upsert(
        leitura.posicoes.map((p) => ({ ticket: p.ticket, linha: p.linha, dados: p })),
        { onConflict: 'user_id,ticket', ignoreDuplicates: true },
      )
      .select('id'),
  )
  if (r.erro !== null) return r
  const novas = r.dados.length
  return ok({ lidas: leitura.posicoes.length, novas, jaImportadas: leitura.posicoes.length - novas, avisos: leitura.avisos })
}

/** Pendentes na ordem em que aconteceram: a confirmação segue essa ordem (as travas dependem dela). */
export async function listarRascunhos(): Promise<Resultado<RascunhoMt5[]>> {
  const r = await executar<RascunhoMt5[]>(supabase.from('importacao_mt5').select('id, ticket, linha, dados').eq('status', 'rascunho'))
  if (r.erro !== null) return r
  return ok([...r.dados].sort((a, b) => a.dados.abertaEm.localeCompare(b.dados.abertaEm) || a.linha - b.linha))
}

export interface ContextoImportacao {
  setup_id: string
  tendencia_diario: Tendencia | ''
  tendencia_h1: Tendencia | ''
  tendencia_h4: Tendencia | ''
  timeframe_entrada: Timeframe | ''
  teve_noticia: boolean
  noticia_descricao: string
  seguiu_plano: boolean
  observacao: string
  stop?: number | null
  alvo?: number | null
}

export function validarContexto(c: ContextoImportacao): string[] {
  const erros: string[] = []
  if (!c.setup_id) erros.push('Escolha o setup (T-02).')
  if (!c.tendencia_diario || !c.tendencia_h1 || !c.tendencia_h4) erros.push('Informe a tendência no diário, H1 e H4 (T-02).')
  if (!c.timeframe_entrada) erros.push('Informe o timeframe de entrada (T-02).')
  if (c.teve_noticia && !c.noticia_descricao.trim()) erros.push('Descreva a notícia (T-02).')
  return erros
}

/** Grava a operação pelo banco (mesmas regras do diário). Devolve se entrou como violação de trava. */
export async function confirmarRascunho(id: string, contexto: ContextoImportacao): Promise<Resultado<{ violacao: boolean }>> {
  const erros = validarContexto(contexto)
  if (erros.length > 0) return { dados: null, erro: erros.join(' ') }
  const r = await executar<string>(supabase.rpc('confirmar_importacao_mt5', { p_id: id, p_contexto: contexto }))
  if (r.erro !== null) return r
  const op = await executar<{ violacao_trava: boolean } | null>(supabase.from('operacao').select('violacao_trava').eq('id', r.dados).maybeSingle())
  if (op.erro !== null) return op
  if (!op.dados) return falha({ message: '' })
  return ok({ violacao: op.dados.violacao_trava })
}

export async function descartarRascunho(id: string): Promise<Resultado<null>> {
  return executar(supabase.from('importacao_mt5').update({ status: 'descartada' }).eq('id', id).then((r) => ({ data: null, error: r.error })))
}
