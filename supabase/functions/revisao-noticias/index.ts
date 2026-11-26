// Edge Function revisao-noticias (ADR-004). Disparo: pg_cron às 8h30 em dia de pregão, ou POST manual autenticado.
// Secrets: ANTHROPIC_API_KEY, CRON_SEGREDO. Config: MODELO_REVISAO, MAX_TOKENS_SAIDA, MAX_BUSCAS, TETO_MENSAL_CENTAVOS,
// PRECO_ENTRADA_USD_MTOK, PRECO_SAIDA_USD_MTOK, PRECO_BUSCA_USD, COTACAO_USD_BRL, ESFORCO.
// Nunca loga valores, tokens de acesso nem o conteúdo da revisão (docs/11_SEGURANCA).
import Anthropic from 'npm:@anthropic-ai/sdk@1.14.0'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.119.2'
import {
  PROMPT_SISTEMA,
  VERSAO_PROMPT,
  custoEstimadoCentavos,
  extrairJson,
  montarPromptUsuario,
  situacaoDoTeto,
  validarRevisao,
  type ItemWatchlist,
  type Precos,
  type Uso,
} from '../_compartilhado/revisao.ts'

const env = (nome: string, padrao?: string): string => {
  const v = Deno.env.get(nome) ?? padrao
  if (v === undefined || v === '') throw new Error(`Configuração ausente: ${nome}`)
  return v
}
const num = (nome: string, padrao: string) => {
  const v = Number(env(nome, padrao))
  if (!Number.isFinite(v) || v < 0) throw new Error(`Configuração inválida: ${nome}`)
  return v
}

const config = () => ({
  modelo: env('MODELO_REVISAO', 'claude-haiku-5-5'),
  maxTokens: num('MAX_TOKENS_SAIDA', '8000'),
  maxBuscas: num('MAX_BUSCAS', '5'),
  tetoCentavos: num('TETO_MENSAL_CENTAVOS', '3000'),
  esforco: env('ESFORCO', 'low') as 'low' | 'medium' | 'high',
  precos: {
    precoEntradaUsdPorMilhao: num('PRECO_ENTRADA_USD_MTOK', '0.10'),
    precoSaidaUsdPorMilhao: num('PRECO_SAIDA_USD_MTOK', '0.50'),
    precoBuscaUsd: num('PRECO_BUSCA_USD', '0.01'),
    cotacaoUsdBrl: num('COTACAO_USD_BRL', '5.60'),
  } satisfies Precos,
})

// Origem do app (ORIGEM_APP); a chamada manual vem do navegador
const cors = () => ({
  'Access-Control-Allow-Origin': Deno.env.get('ORIGEM_APP') ?? 'http://localhost:5180',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
})
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json', ...cors() } })
const erroHttp = (codigo: string, mensagem: string, status: number) => resposta({ erro: { codigo, mensagem } }, status)

function iguaisEmTempoConstante(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  if (x.length !== y.length) return false
  let d = 0
  for (let i = 0; i < x.length; i++) d |= x[i]! ^ y[i]!
  return d === 0
}

interface ResultadoChamada {
  texto: string
  uso: Uso
  recusada: boolean
}

/** Uma chamada com busca na web. Retoma pause_turn até 3 vezes (o servidor continua de onde parou). */
async function chamarClaude(cliente: Anthropic, cfg: ReturnType<typeof config>, mensagens: Anthropic.MessageParam[]): Promise<ResultadoChamada> {
  const uso: Uso = { tokensEntrada: 0, tokensSaida: 0, buscas: 0 }
  let historico = [...mensagens]
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const r = await cliente.messages.create({
      model: cfg.modelo,
      max_tokens: cfg.maxTokens,
      system: PROMPT_SISTEMA,
      output_config: { effort: cfg.esforco },
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: cfg.maxBuscas,
          user_location: { type: 'approximate', country: 'BR', timezone: 'America/Sao_Paulo' },
        },
      ],
      messages: historico,
    })
    uso.tokensEntrada += r.usage.input_tokens + (r.usage.cache_creation_input_tokens ?? 0) + (r.usage.cache_read_input_tokens ?? 0)
    uso.tokensSaida += r.usage.output_tokens
    uso.buscas += r.usage.server_tool_use?.web_search_requests ?? 0
    if (r.stop_reason === 'refusal') return { texto: '', uso, recusada: true }
    if (r.stop_reason === 'pause_turn') {
      historico = [...mensagens, { role: 'assistant', content: r.content }]
      continue
    }
    const texto = r.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    return { texto, uso, recusada: false }
  }
  return { texto: '', uso, recusada: false }
}

const somar = (a: Uso, b: Uso): Uso => ({ tokensEntrada: a.tokensEntrada + b.tokensEntrada, tokensSaida: a.tokensSaida + b.tokensSaida, buscas: a.buscas + b.buscas })

type Status = 'ok' | 'sem_orcamento' | 'erro' | 'sem_watchlist' | 'ja_gerada'

async function processarUsuario(admin: SupabaseClient, userId: string, hoje: string, origem: 'agendada' | 'manual'): Promise<{ id?: string; status: Status }> {
  const cfg = config()
  const mes = `${hoje.slice(0, 7)}-01`

  const { data: lista, error: erroLista } = await admin.from('watchlist').select('ativo, mercado').eq('user_id', userId).eq('ativa', true).order('ativo')
  if (erroLista) throw new Error('Falha ao ler a watchlist.')
  if (!lista || lista.length === 0) return { status: 'sem_watchlist' }

  if (origem === 'agendada') {
    const { data: existente } = await admin.from('revisao_noticias').select('id').eq('user_id', userId).eq('data', hoje).eq('status', 'ok').limit(1)
    if (existente && existente.length > 0) return { id: existente[0]!.id, status: 'ja_gerada' }
  }

  const { data: usoMes } = await admin.from('uso_ia').select('custo_estimado_centavos').eq('user_id', userId).eq('mes', mes).maybeSingle()
  const gasto = Number(usoMes?.custo_estimado_centavos ?? 0)
  const base = { user_id: userId, data: hoje, origem, versao_prompt: VERSAO_PROMPT }

  // IA-03: com 100% do teto, não chama a API até o mês seguinte
  if (situacaoDoTeto(gasto, cfg.tetoCentavos) === 'bloqueado') {
    const { data, error } = await admin.from('revisao_noticias').insert({ ...base, status: 'sem_orcamento', aviso_orcamento: true }).select('id').single()
    if (error) throw new Error('Falha ao gravar a revisão.')
    return { id: data.id, status: 'sem_orcamento' }
  }

  const cliente = new Anthropic({ apiKey: env('ANTHROPIC_API_KEY'), baseURL: Deno.env.get('ANTHROPIC_BASE_URL') || undefined, maxRetries: 1 })
  const pedido: Anthropic.MessageParam[] = [{ role: 'user', content: montarPromptUsuario(hoje, lista as ItemWatchlist[]) }]

  let uso: Uso = { tokensEntrada: 0, tokensSaida: 0, buscas: 0 }
  let status: 'ok' | 'erro' = 'erro'
  let erro: string | null = null
  let conteudo: { ativos: unknown; agenda: unknown; contexto: string; fontes: unknown } | null = null

  try {
    const primeira = await chamarClaude(cliente, cfg, pedido)
    uso = primeira.uso
    let validacao = primeira.recusada ? null : validarRevisao(extrairJson(primeira.texto), hoje)
    if (primeira.recusada) erro = 'A IA recusou o pedido.'
    // docs/10_PROMPTS: JSON inválido ganha uma nova tentativa com o erro de validação
    else if (validacao && !validacao.ok) {
      const segunda = await chamarClaude(cliente, cfg, [
        ...pedido,
        { role: 'assistant', content: primeira.texto || '{}' },
        { role: 'user', content: `A resposta anterior foi recusada: ${validacao.erro} Responda de novo apenas com o JSON válido no schema, sem recomendação de compra ou venda.` },
      ])
      uso = somar(uso, segunda.uso)
      validacao = segunda.recusada ? null : validarRevisao(extrairJson(segunda.texto), hoje)
      if (segunda.recusada) erro = 'A IA recusou o pedido.'
    }
    if (validacao?.ok) {
      status = 'ok'
      conteudo = { ativos: validacao.revisao.ativos, agenda: validacao.revisao.agenda, contexto: validacao.revisao.contexto_geral, fontes: validacao.fontes }
    } else if (validacao && !validacao.ok) {
      erro = validacao.erro
    }
  } catch (e) {
    erro =
      e instanceof Anthropic.AuthenticationError ? 'Chave da API do Claude inválida.' :
      e instanceof Anthropic.RateLimitError ? 'Limite de uso da API atingido. Tente mais tarde.' :
      e instanceof Anthropic.APIConnectionError ? 'Sem conexão com a API do Claude.' :
      e instanceof Anthropic.APIError ? `A API do Claude respondeu com erro ${e.status}.` :
      'Falha inesperada ao gerar a revisão.'
  }

  // O que foi consumido conta no teto mesmo quando a revisão falha (IA-03, IA-04)
  const custo = custoEstimadoCentavos(uso, cfg.precos)
  let gastoDepois = gasto
  if (uso.tokensEntrada + uso.tokensSaida + uso.buscas > 0) {
    const { data: total, error: erroUso } = await admin.rpc('registrar_uso_ia', {
      p_user: userId, p_mes: mes, p_tokens_entrada: uso.tokensEntrada, p_tokens_saida: uso.tokensSaida, p_buscas: uso.buscas, p_custo: custo,
    })
    if (erroUso) throw new Error('Falha ao registrar o uso da IA.')
    gastoDepois = Number(total)
  }

  const { data, error } = await admin
    .from('revisao_noticias')
    .insert({
      ...base,
      modelo: cfg.modelo,
      status,
      erro,
      conteudo: conteudo?.ativos ?? null,
      agenda: conteudo?.agenda ?? null,
      contexto_geral: conteudo?.contexto ?? null,
      fontes: conteudo?.fontes ?? null,
      custo_estimado_centavos: custo,
      aviso_orcamento: situacaoDoTeto(gastoDepois, cfg.tetoCentavos) !== 'ok',
    })
    .select('id')
    .single()
  if (error) throw new Error('Falha ao gravar a revisão.')
  return { id: data.id, status }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() })
  if (req.method !== 'POST') return erroHttp('metodo', 'Use POST.', 405)
  try {
    const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
    const { data: hojeBanco, error: erroHoje } = await admin.rpc('hoje_sp')
    if (erroHoje) throw new Error('Falha ao ler a data.')
    const hoje = String(hojeBanco)

    const segredo = req.headers.get('x-segredo-cron')
    if (segredo !== null) {
      // Disparo agendado: segredo próprio, nunca o JWT de ninguém
      if (!iguaisEmTempoConstante(segredo, env('CRON_SEGREDO'))) return erroHttp('nao_autorizado', 'Segredo inválido.', 401)
      const { data: pregao } = await admin.rpc('e_dia_pregao', { d: hoje })
      if (pregao !== true) return resposta({ status: 'sem_pregao' })
      const { data: donos, error } = await admin.from('watchlist').select('user_id').eq('ativa', true)
      if (error) throw new Error('Falha ao ler a watchlist.')
      const resultados = []
      for (const userId of [...new Set((donos ?? []).map((d) => d.user_id as string))]) resultados.push(await processarUsuario(admin, userId, hoje, 'agendada'))
      return resposta({ resultados })
    }

    // Disparo manual: JWT do dono (ADR-005: sem exigir segundo fator)
    const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
    if (!jwt) return erroHttp('nao_autorizado', 'Entre de novo.', 401)
    const { data: usuario, error: erroUsuario } = await admin.auth.getUser(jwt)
    if (erroUsuario || !usuario.user) return erroHttp('nao_autorizado', 'Entre de novo.', 401)
    return resposta(await processarUsuario(admin, usuario.user.id, hoje, 'manual'))
  } catch (e) {
    console.error('revisao-noticias falhou:', e instanceof Error ? e.message : 'erro desconhecido')
    return erroHttp('interno', 'Não foi possível gerar a revisão agora.', 500)
  }
})
