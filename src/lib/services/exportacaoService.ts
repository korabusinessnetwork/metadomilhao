import { gerarCsv, type ColunaCsv } from '../calculos/csv'
import { supabase } from '../supabase'
import { executar, ok, type Resultado } from './resultado'

const reais = (v: unknown) => (Number(v) / 100).toFixed(2).replace('.', ',')

interface Tabela {
  arquivo: string
  tabela: string
  campos: string
  colunas: ColunaCsv<Record<string, unknown>>[]
}

const TABELAS: Tabela[] = [
  {
    arquivo: 'lancamentos',
    tabela: 'lancamento',
    campos: 'data, categoria:categoria_id(nome), valor_centavos, descricao, estorno_de',
    colunas: [
      { chave: 'data', titulo: 'Data' },
      { chave: 'categoria', titulo: 'Categoria', formatar: (v) => String((v as { nome?: string } | null)?.nome ?? '') },
      { chave: 'valor_centavos', titulo: 'Valor (R$)', formatar: reais },
      { chave: 'descricao', titulo: 'Descrição' },
      { chave: 'estorno_de', titulo: 'Estorno de' },
    ],
  },
  {
    arquivo: 'rendas',
    tabela: 'renda',
    campos: 'mes, fonte, valor_centavos, recebido_em',
    colunas: [
      { chave: 'mes', titulo: 'Mês' },
      { chave: 'fonte', titulo: 'Fonte' },
      { chave: 'valor_centavos', titulo: 'Valor (R$)', formatar: reais },
      { chave: 'recebido_em', titulo: 'Recebido em' },
    ],
  },
  {
    arquivo: 'movimentos-carteira',
    tabela: 'movimento_carteira',
    campos: 'data, ativo:ativo_id(nome, classe), tipo, valor_centavos',
    colunas: [
      { chave: 'data', titulo: 'Data' },
      { chave: 'ativo', titulo: 'Ativo', formatar: (v) => String((v as { nome?: string } | null)?.nome ?? '') },
      { chave: 'tipo', titulo: 'Tipo' },
      { chave: 'valor_centavos', titulo: 'Valor (R$)', formatar: reais },
    ],
  },
  {
    arquivo: 'fechamentos',
    tabela: 'fechamento_mes',
    campos: 'mes, renda_real, gasto_real, aporte_real, patrimonio_real, patrimonio_projetado, meta_batida, notas, substitui, criado_em',
    colunas: [
      { chave: 'mes', titulo: 'Mês' },
      { chave: 'renda_real', titulo: 'Renda (R$)', formatar: reais },
      { chave: 'gasto_real', titulo: 'Gasto (R$)', formatar: reais },
      { chave: 'aporte_real', titulo: 'Aporte (R$)', formatar: reais },
      { chave: 'patrimonio_real', titulo: 'Patrimônio real (R$)', formatar: reais },
      { chave: 'patrimonio_projetado', titulo: 'Patrimônio projetado (R$)', formatar: reais },
      { chave: 'meta_batida', titulo: 'Meta batida', formatar: (v) => (v ? 'sim' : 'não') },
      { chave: 'notas', titulo: 'Notas' },
      { chave: 'substitui', titulo: 'Substitui' },
      { chave: 'criado_em', titulo: 'Criado em' },
    ],
  },
]

export interface ArquivoCsv {
  nome: string
  conteudo: string
}

/** Backup do dono (docs/11_SEGURANCA): um CSV por tabela, tudo o que foi registrado. */
export async function exportarTudo(): Promise<Resultado<ArquivoCsv[]>> {
  const arquivos: ArquivoCsv[] = []
  for (const t of TABELAS) {
    const r = await executar<Record<string, unknown>[]>(supabase.from(t.tabela).select(t.campos))
    if (r.erro !== null) return r
    arquivos.push({ nome: `rota-do-milhao-${t.arquivo}.csv`, conteudo: gerarCsv(r.dados, t.colunas) })
  }
  return ok(arquivos)
}
