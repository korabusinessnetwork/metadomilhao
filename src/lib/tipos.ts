// Tipos das linhas do banco (supabase/migrations). Dinheiro em centavos.

export type TipoCategoria = 'fixa' | 'variavel'
export type FonteRenda = 'salario' | 'renda_extra' | 'outro'
export type ClasseAtivo = 'reserva' | 'renda_fixa' | 'fii' | 'acoes' | 'capital_trade' | 'outro'
export type TipoMovimento = 'aporte' | 'resgate' | 'rendimento' | 'ajuste_saldo'

export interface Perfil {
  user_id: string
  nome: string
  data_mudanca: string | null
  dia_fechamento: number
}

export interface PlanoMilhao {
  user_id: string
  meta_centavos: number
  taxa_real_mensal: number
  aporte_atual_centavos: number
  aporte_pos_mudanca_centavos: number
  pct_lucro_trade_para_aporte: number
}

export interface Categoria {
  id: string
  nome: string
  tipo: TipoCategoria
  ativa: boolean
  ordem: number
  estimativa: boolean
}

export interface OrcamentoMes {
  id: string
  mes: string
  renda_prevista_centavos: number
  travado_em: string | null
}

export interface OrcamentoItem {
  id: string
  orcamento_mes_id: string
  categoria_id: string
  valor_centavos: number
}

export interface Renda {
  id: string
  mes: string
  fonte: FonteRenda
  valor_centavos: number
  recebido_em: string
}

export interface Lancamento {
  id: string
  data: string
  categoria_id: string
  valor_centavos: number
  descricao: string | null
  estorno_de: string | null
  criado_em: string
}

export interface SaldoAtivo {
  ativo_id: string
  nome: string
  classe: ClasseAtivo
  instituicao: string | null
  ativo: boolean
  saldo_centavos: number
}

export interface Movimento {
  id: string
  ativo_id: string
  data: string
  tipo: TipoMovimento
  valor_centavos: number
}

export interface Fechamento {
  id: string
  mes: string
  renda_real: number
  gasto_real: number
  aporte_real: number
  patrimonio_real: number
  patrimonio_projetado: number
  meta_batida: boolean
  violacoes_trava: number
  notas: string | null
  substitui: string | null
  criado_em: string
}

export const NOMES_CLASSE: Record<ClasseAtivo, string> = {
  reserva: 'Reserva de emergência',
  renda_fixa: 'Renda fixa',
  fii: 'Fundos imobiliários',
  acoes: 'Ações',
  capital_trade: 'Capital de trade',
  outro: 'Outro',
}

export const NOMES_FONTE: Record<FonteRenda, string> = {
  salario: 'Salário',
  renda_extra: 'Renda extra',
  outro: 'Outro',
}

export const NOMES_MOVIMENTO: Record<TipoMovimento, string> = {
  aporte: 'Aporte',
  resgate: 'Resgate',
  rendimento: 'Rendimento',
  ajuste_saldo: 'Ajuste de saldo',
}

// ---------- Fase 2: trade ----------
import type { Direcao, Mercado, Tendencia, Timeframe } from './calculos/trade'
import type { MotivoTrava } from './calculos/travas'

export interface ParametrosTrade {
  id: string
  vigente_desde: string
  risco_operacao_centavos: number
  stop_gain_r: number
  stop_loss_dia_r: number
  pct_perda_dia: number
  pct_perda_semana: number
  pct_perda_mes: number
  aumento_risco: boolean
}

export interface Setup {
  id: string
  nome: string
  descricao: string | null
  ativo: boolean
}

export interface Operacao {
  id: string
  data: string
  aberta_em: string
  fechada_em: string | null
  ativo: string
  mercado: Mercado
  direcao: Direcao
  quantidade: number
  preco_entrada: number
  preco_stop: number
  preco_alvo: number
  preco_saida: number | null
  risco_centavos: number
  resultado_bruto_centavos: number | null
  custos_centavos: number | null
  resultado_liquido_centavos: number | null
  resultado_r: number | null
  setup_id: string
  tendencia_diario: Tendencia
  tendencia_h1: Tendencia
  tendencia_h4: Tendencia
  timeframe_entrada: Timeframe
  teve_noticia: boolean
  noticia_descricao: string | null
  seguiu_plano: boolean | null
  observacao: string | null
  violacao_trava: boolean
  revisao_noticias_id: string | null
  criado_em: string
}

export interface StatusTravasBanco {
  data: string
  aberto: boolean
  motivo: MotivoTrava | null
  reabre_em: string | null
  meta_dia_centavos: number
  perda_dia_centavos: number
  perda_semana_centavos: number
  perda_mes_centavos: number
  resultado_dia_centavos: number
  resultado_semana_centavos: number
  resultado_mes_centavos: number
  capital_inicio_dia_centavos: number
  risco_operacao_centavos: number
}

export interface PagamentoIR {
  id: string
  mes: string
  valor_centavos: number
  pago_em: string
}

// ---------- Fase 3: notícias ----------
export interface ItemWatchlistBanco {
  id: string
  ativo: string
  mercado: Mercado
  ativa: boolean
}

export interface NoticiaRevisao {
  titulo: string
  resumo: string
  fonte: string
  url: string
}

export interface AtivoRevisao {
  ativo: string
  noticias: NoticiaRevisao[]
  possivel_impacto: string
  riscos_do_dia: string[]
  sem_novidades: boolean
}

export interface AgendaRevisao {
  hora: string
  evento: string
  pais: string
  relevancia: string
}

export interface RevisaoNoticias {
  id: string
  data: string
  gerada_em: string
  origem: 'agendada' | 'manual'
  modelo: string | null
  conteudo: AtivoRevisao[] | null
  agenda: AgendaRevisao[] | null
  contexto_geral: string | null
  custo_estimado_centavos: number
  status: 'ok' | 'sem_orcamento' | 'erro'
  aviso_orcamento: boolean
  erro: string | null
}

export interface UsoIA {
  mes: string
  chamadas: number
  buscas: number
  custo_estimado_centavos: number
}
