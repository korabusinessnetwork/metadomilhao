// Carrega o que várias telas precisam do mês: orçamento aberto, categorias e lançamentos.
import { dataEmSaoPaulo, inicioDoMes } from '../lib/calculos/datas'
import { limiteGastoHoje, type LimiteGasto } from '../lib/calculos/limite-gasto-hoje'
import { abrirMes, listarCategorias, type MesOrcado } from '../lib/services/orcamentoService'
import { listarMes } from '../lib/services/lancamentoService'
import { ok, type Resultado } from '../lib/services/resultado'
import type { Categoria, Lancamento } from '../lib/tipos'

export interface DadosDoMes {
  hoje: string
  mes: string
  orcamento: MesOrcado
  categorias: Categoria[]
  lancamentos: Lancamento[]
  limite: LimiteGasto
  orcadoTotal: number
  gastoTotal: number
}

export function calcularLimite(hoje: string, orcamento: MesOrcado, categorias: Categoria[], lancamentos: Lancamento[]): LimiteGasto {
  const variaveis = new Set(categorias.filter((c) => c.tipo === 'variavel').map((c) => c.id))
  const orcamentoVariavel = orcamento.itens.filter((i) => variaveis.has(i.categoria_id)).reduce((s, i) => s + i.valor_centavos, 0)
  const doVariavel = lancamentos.filter((l) => variaveis.has(l.categoria_id))
  return limiteGastoHoje({
    hoje,
    orcamentoVariavelCentavos: orcamentoVariavel,
    gastoVariavelAteOntemCentavos: doVariavel.filter((l) => l.data < hoje).reduce((s, l) => s + l.valor_centavos, 0),
    gastoVariavelHojeCentavos: doVariavel.filter((l) => l.data === hoje).reduce((s, l) => s + l.valor_centavos, 0),
  })
}

export async function carregarDadosDoMes(mesEscolhido?: string): Promise<Resultado<DadosDoMes>> {
  const hoje = dataEmSaoPaulo()
  const mes = mesEscolhido ?? inicioDoMes(hoje)
  const [orcamento, categorias, lancamentos] = await Promise.all([abrirMes(mes), listarCategorias(), listarMes(mes)])
  if (orcamento.erro !== null) return orcamento
  if (categorias.erro !== null) return categorias
  if (lancamentos.erro !== null) return lancamentos
  return ok({
    hoje,
    mes,
    orcamento: orcamento.dados,
    categorias: categorias.dados,
    lancamentos: lancamentos.dados,
    limite: calcularLimite(hoje, orcamento.dados, categorias.dados, lancamentos.dados),
    orcadoTotal: orcamento.dados.itens.reduce((s, i) => s + i.valor_centavos, 0),
    gastoTotal: lancamentos.dados.reduce((s, l) => s + l.valor_centavos, 0),
  })
}
