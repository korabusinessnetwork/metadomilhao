// Carrega o que várias telas precisam do mês: orçamento aberto, categorias e lançamentos.
// Sem conexão, usa o último dado bom guardado no aparelho. Os pendentes da fila offline entram nos números.
import { dataEmSaoPaulo, inicioDoMes } from '../lib/calculos/datas'
import { limiteGastoHoje, type LimiteGasto } from '../lib/calculos/limite-gasto-hoje'
import { abrirMes, listarCategorias, type MesOrcado } from '../lib/services/orcamentoService'
import { listarMes } from '../lib/services/lancamentoService'
import { ok, MENSAGEM_SEM_CONEXAO, type Resultado } from '../lib/services/resultado'
import { cache, fila } from '../lib/offline/aparelho'
import { mesclarPendentes, type LancamentoNaTela } from '../lib/offline/mesclar'
import type { Categoria, Lancamento } from '../lib/tipos'

export interface DadosDoMes {
  hoje: string
  mes: string
  orcamento: MesOrcado
  categorias: Categoria[]
  lancamentos: LancamentoNaTela[]
  limite: LimiteGasto
  orcadoTotal: number
  gastoTotal: number
  /** Dados vindos do aparelho porque não havia conexão */
  doAparelho: boolean
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

interface Base {
  orcamento: MesOrcado
  categorias: Categoria[]
  lancamentos: Lancamento[]
}

function montar(hoje: string, mes: string, b: Base, doAparelho: boolean): DadosDoMes {
  const lancamentos = mesclarPendentes(b.lancamentos, fila.pendentes(), mes)
  return {
    hoje,
    mes,
    orcamento: b.orcamento,
    categorias: b.categorias,
    lancamentos,
    limite: calcularLimite(hoje, b.orcamento, b.categorias, lancamentos),
    orcadoTotal: b.orcamento.itens.reduce((s, i) => s + i.valor_centavos, 0),
    gastoTotal: lancamentos.reduce((s, l) => s + l.valor_centavos, 0),
    doAparelho,
  }
}

export async function carregarDadosDoMes(mesEscolhido?: string): Promise<Resultado<DadosDoMes>> {
  const hoje = dataEmSaoPaulo()
  const mes = mesEscolhido ?? inicioDoMes(hoje)
  const chave = `mes:${mes}`
  const [orcamento, categorias, lancamentos] = await Promise.all([abrirMes(mes), listarCategorias(), listarMes(mes)])
  const erro = orcamento.erro ?? categorias.erro ?? lancamentos.erro
  if (erro !== null) {
    const guardado = erro === MENSAGEM_SEM_CONEXAO ? cache.ler<Base>(chave) : null
    if (guardado) return ok(montar(hoje, mes, guardado, true))
    return { dados: null, erro }
  }
  const base: Base = { orcamento: orcamento.dados!, categorias: categorias.dados!, lancamentos: lancamentos.dados! }
  cache.gravar(chave, base)
  return ok(montar(hoje, mes, base, false))
}
