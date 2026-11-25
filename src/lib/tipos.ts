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
