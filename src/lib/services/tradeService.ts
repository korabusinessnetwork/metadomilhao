import { supabase } from '../supabase'
import { dataEmSaoPaulo } from '../calculos/datas'
import { validarPlanoOperacao, type PlanoOperacao } from '../calculos/trade'
import type { Operacao, PagamentoIR, ParametrosTrade, Setup, StatusTravasBanco } from '../tipos'
import { executar, falha, ok, type Resultado } from './resultado'

const CAMPOS_PARAMETROS = 'id, vigente_desde, risco_operacao_centavos, stop_gain_r, stop_loss_dia_r, pct_perda_dia, pct_perda_semana, pct_perda_mes, aumento_risco'
const CAMPOS_SETUP = 'id, nome, descricao, ativo'
const CAMPOS_OPERACAO = 'id, data, aberta_em, fechada_em, ativo, mercado, direcao, quantidade, preco_entrada, preco_stop, preco_alvo, preco_saida, risco_centavos, resultado_bruto_centavos, custos_centavos, resultado_liquido_centavos, resultado_r, setup_id, tendencia_diario, tendencia_h1, tendencia_h4, timeframe_entrada, teve_noticia, noticia_descricao, seguiu_plano, observacao, violacao_trava, revisao_noticias_id'
const CAMPOS_STATUS = 'data, aberto, motivo, reabre_em, meta_dia_centavos, perda_dia_centavos, perda_semana_centavos, perda_mes_centavos, resultado_dia_centavos, resultado_semana_centavos, resultado_mes_centavos, capital_inicio_dia_centavos, risco_operacao_centavos'

// numeric chega como texto do PostgREST; a lógica usa number
const numeros = <T extends object>(linha: T, campos: (keyof T)[]): T => {
  const copia = { ...linha }
  for (const c of campos) if (copia[c] !== null && copia[c] !== undefined) (copia as Record<keyof T, unknown>)[c] = Number(copia[c])
  return copia
}
const normalizarOperacao = (o: Operacao) => numeros(o, ['preco_entrada', 'preco_stop', 'preco_alvo', 'preco_saida', 'resultado_r'])
const normalizarParametros = (p: ParametrosTrade) => numeros(p, ['stop_gain_r', 'stop_loss_dia_r', 'pct_perda_dia', 'pct_perda_semana', 'pct_perda_mes'])

export interface ContaTrade {
  ativoId: string | null
  parametros: ParametrosTrade[]
}

export async function obterConta(): Promise<Resultado<ContaTrade>> {
  const conta = await executar<{ ativo_id: string } | null>(supabase.from('conta_trade').select('ativo_id').maybeSingle())
  if (conta.erro !== null) return conta
  const params = await executar<ParametrosTrade[]>(supabase.from('parametros_trade').select(CAMPOS_PARAMETROS).order('vigente_desde'))
  if (params.erro !== null) return params
  return ok({ ativoId: conta.dados?.ativo_id ?? null, parametros: params.dados.map(normalizarParametros) })
}

export async function definirConta(ativoId: string): Promise<Resultado<null>> {
  return executar(supabase.from('conta_trade').upsert({ ativo_id: ativoId }, { onConflict: 'user_id' }).then((r) => ({ data: null, error: r.error })))
}

/** A primeira configuração vale hoje; as seguintes, a partir da data informada (ADR-003). O banco aplica T-08. */
export async function salvarParametros(p: Omit<ParametrosTrade, 'id' | 'aumento_risco'>): Promise<Resultado<null>> {
  return executar(supabase.from('parametros_trade').insert(p).then((r) => ({ data: null, error: r.error })))
}

export async function listarSetups(): Promise<Resultado<Setup[]>> {
  return executar(supabase.from('setup').select(CAMPOS_SETUP).order('nome'))
}

export async function criarSetup(s: { nome: string; descricao: string }): Promise<Resultado<null>> {
  if (!s.nome.trim()) return { dados: null, erro: 'Dê um nome ao setup.' }
  return executar(supabase.from('setup').insert({ nome: s.nome.trim(), descricao: s.descricao.trim() || null }).then((r) => ({ data: null, error: r.error })))
}

export async function alternarSetup(id: string, ativo: boolean): Promise<Resultado<null>> {
  return executar(supabase.from('setup').update({ ativo }).eq('id', id).then((r) => ({ data: null, error: r.error })))
}

/** TR-01: status calculado no banco para hoje. null quando a conta ainda não foi configurada. */
export async function statusHoje(): Promise<Resultado<StatusTravasBanco | null>> {
  return executar(supabase.from('v_status_travas').select(CAMPOS_STATUS).maybeSingle())
}

/** Operações com data em [de, ate], na ordem em que foram encerradas (a ordem das travas). */
export async function listarOperacoes(de: string, ate: string): Promise<Resultado<Operacao[]>> {
  const r = await executar<Operacao[]>(
    supabase.from('operacao').select(CAMPOS_OPERACAO).gte('data', de).lte('data', ate).order('data').order('fechada_em', { nullsFirst: false }).order('aberta_em'),
  )
  if (r.erro !== null) return r
  return ok(r.dados.map(normalizarOperacao))
}

export async function listarTodasFechadas(): Promise<Resultado<Operacao[]>> {
  const r = await executar<Operacao[]>(
    supabase.from('operacao').select(CAMPOS_OPERACAO).not('resultado_liquido_centavos', 'is', null).order('data').order('fechada_em'),
  )
  if (r.erro !== null) return r
  return ok(r.dados.map(normalizarOperacao))
}

function linhaDaOperacao(p: Omit<PlanoOperacao, 'capitalCentavos'> & { ativo: string; revisaoNoticiasId?: string | null }) {
  return {
    aberta_em: new Date().toISOString(),
    ativo: p.ativo.trim().toUpperCase(),
    mercado: p.mercado,
    direcao: p.direcao,
    quantidade: p.quantidade,
    preco_entrada: p.entrada,
    preco_stop: p.stop,
    preco_alvo: p.alvo,
    // multiplicador e risco são recalculados pelo banco (T-03); estes valores só cumprem o not null
    multiplicador: 1,
    risco_centavos: 1,
    setup_id: p.setupId,
    tendencia_diario: p.tendenciaDiario,
    tendencia_h1: p.tendenciaH1,
    tendencia_h4: p.tendenciaH4,
    timeframe_entrada: p.timeframeEntrada,
    teve_noticia: p.teveNoticia,
    noticia_descricao: p.teveNoticia ? p.noticiaDescricao.trim() : null,
    revisao_noticias_id: p.revisaoNoticiasId ?? null, // IA-05
  }
}

/** Registro planejado: passa por T-04 e pela trava no banco (TR-02). */
export async function registrarOperacao(p: PlanoOperacao & { ativo: string; revisaoNoticiasId?: string | null }): Promise<Resultado<null>> {
  const erros = validarPlanoOperacao(p)
  if (!/^[A-Z0-9]{4,12}$/.test(p.ativo.trim().toUpperCase())) erros.unshift('Código do ativo inválido (ex.: WINZ26, PETR4).')
  if (erros.length > 0) return { dados: null, erro: erros.join(' ') }
  return executar(supabase.from('operacao').insert(linhaDaOperacao(p)).then((r) => ({ data: null, error: r.error })))
}

/** TR-03: operação já executada com o período fechado. Entra marcada e com a saída. */
export async function registrarViolacao(
  p: PlanoOperacao & { ativo: string; saida: number; custosCentavos: number; observacao: string; revisaoNoticiasId?: string | null },
): Promise<Resultado<null>> {
  const erros = validarPlanoOperacao({ ...p, capitalCentavos: Number.MAX_SAFE_INTEGER }).filter((e) => !e.includes('T-04'))
  if (!(p.saida > 0)) erros.push('Informe o preço de saída.')
  if (erros.length > 0) return { dados: null, erro: erros.join(' ') }
  return executar(
    supabase
      .from('operacao')
      .insert({ ...linhaDaOperacao(p), preco_saida: p.saida, custos_centavos: p.custosCentavos, violacao_trava: true, seguiu_plano: false, observacao: p.observacao.trim() || null })
      .then((r) => ({ data: null, error: r.error })),
  )
}

export async function encerrarOperacao(id: string, e: { saida: number; custosCentavos: number; seguiuPlano: boolean; observacao: string }): Promise<Resultado<null>> {
  if (!(e.saida > 0)) return { dados: null, erro: 'Informe o preço de saída.' }
  if (!Number.isInteger(e.custosCentavos) || e.custosCentavos < 0) return { dados: null, erro: 'Custos inválidos.' }
  return executar(
    supabase
      .from('operacao')
      .update({ preco_saida: e.saida, custos_centavos: e.custosCentavos, seguiu_plano: e.seguiuPlano, observacao: e.observacao.trim() || null })
      .eq('id', id)
      .then((r) => ({ data: null, error: r.error })),
  )
}

/** Encerrar o dia na mão. Não tem volta (TR-05). */
export async function encerrarDia(nota: string): Promise<Resultado<null>> {
  return executar(
    supabase
      .from('dia_trade')
      .upsert({ data: dataEmSaoPaulo(), encerrado_manual_em: new Date().toISOString(), nota_dia: nota.trim() || null }, { onConflict: 'user_id,data' })
      .then((r) => ({ data: null, error: r.error })),
  )
}

export async function obterNotaDoDia(data: string): Promise<Resultado<string>> {
  const r = await executar<{ nota_dia: string | null } | null>(supabase.from('dia_trade').select('nota_dia').eq('data', data).maybeSingle())
  if (r.erro !== null) return r
  return ok(r.dados?.nota_dia ?? '')
}

export async function salvarNotaDoDia(data: string, nota: string): Promise<Resultado<null>> {
  return executar(supabase.from('dia_trade').upsert({ data, nota_dia: nota.trim() || null }, { onConflict: 'user_id,data' }).then((r) => ({ data: null, error: r.error })))
}

export async function listarPagamentosIR(): Promise<Resultado<PagamentoIR[]>> {
  return executar(supabase.from('ir_pagamento').select('id, mes, valor_centavos, pago_em').order('mes'))
}

export async function registrarPagamentoIR(p: { mes: string; valorCentavos: number; pagoEm: string }): Promise<Resultado<null>> {
  if (!Number.isInteger(p.valorCentavos) || p.valorCentavos <= 0) return falha({ code: 'P0001', message: 'Valor do DARF inválido.' })
  return executar(supabase.from('ir_pagamento').insert({ mes: p.mes, valor_centavos: p.valorCentavos, pago_em: p.pagoEm }).then((r) => ({ data: null, error: r.error })))
}

export async function removerPagamentoIR(id: string): Promise<Resultado<null>> {
  return executar(supabase.from('ir_pagamento').delete().eq('id', id).then((r) => ({ data: null, error: r.error })))
}
