import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCarregar } from '../../lib/useCarregar'
import { carregarDadosDoMes, calcularLimite } from '../dadosDoMes'
import { registrar } from '../../lib/services/lancamentoService'
import { listarPeriodo } from '../../lib/services/lancamentoService'
import { somarMeses, dataEmSaoPaulo, inicioDoMes } from '../../lib/calculos/datas'
import { ok } from '../../lib/services/resultado'
import { CampoValor, SeletorCategoria } from '../../componentes/Campos'
import { Aviso, Carregando, Dinheiro, ErroComAcao, EstadoVazio } from '../../componentes/Basicos'
import { Link } from 'react-router-dom'

/** Lançar um gasto em menos de 20 segundos: valor, categoria, salvar. Data é hoje por padrão. */
export function NovoLancamento() {
  const navegar = useNavigate()
  const { dados, erro, carregando, recarregar } = useCarregar(async () => {
    const hoje = dataEmSaoPaulo()
    const [mes, recentes] = await Promise.all([carregarDadosDoMes(), listarPeriodo(somarMeses(inicioDoMes(hoje), -2), somarMeses(inicioDoMes(hoje), 1))])
    if (mes.erro !== null) return mes
    if (recentes.erro !== null) return recentes
    return ok({ mes: mes.dados, recentes: recentes.dados })
  }, [])

  const [valor, setValor] = useState<number | null>(null)
  const [categoriaId, setCategoriaId] = useState('')
  const [data, setData] = useState(() => dataEmSaoPaulo())
  const [descricao, setDescricao] = useState('')
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [salvo, setSalvo] = useState<{ restante: number } | null>(null)

  const maisUsadas = useMemo(() => {
    const contagem = new Map<string, number>()
    for (const l of dados?.recentes ?? []) if (!l.estorno_de) contagem.set(l.categoria_id, (contagem.get(l.categoria_id) ?? 0) + 1)
    return [...contagem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id)
  }, [dados])

  if (carregando) return <Carregando />
  if (erro || !dados) return <ErroComAcao erro={erro ?? ''} tentarDeNovo={recarregar} />
  if (dados.mes.categorias.filter((c) => c.ativa).length === 0)
    return <EstadoVazio mensagem="Crie as categorias antes do primeiro gasto." acao={<Link to="/orcamento">Ir para o orçamento</Link>} />

  async function aoEnviar(e: FormEvent) {
    e.preventDefault()
    if (!dados) return
    if (valor === null) {
      setErroEnvio('Digite o valor.')
      return
    }
    setEnviando(true)
    setErroEnvio(null)
    const r = await registrar({ data, categoriaId, valorCentavos: valor, descricao })
    setEnviando(false)
    if (r.erro !== null) {
      setErroEnvio(r.erro)
      return
    }
    // O limite do dia se atualiza na hora
    const lancamentos = r.dados.data.startsWith(dados.mes.mes.slice(0, 7)) ? [r.dados, ...dados.mes.lancamentos] : dados.mes.lancamentos
    const limite = calcularLimite(dados.mes.hoje, dados.mes.orcamento, dados.mes.categorias, lancamentos)
    setSalvo({ restante: limite.restanteHojeCentavos })
    dados.mes.lancamentos = lancamentos
    setValor(null)
    setDescricao('')
    setCategoriaId('')
  }

  if (salvo)
    return (
      <section className="painel">
        <h1>Gasto salvo</h1>
        <p>
          Restante de hoje: <Dinheiro centavos={salvo.restante} className={salvo.restante < 0 ? 'bad' : ''} />
        </p>
        <div className="acoes">
          <button type="button" className="botao" onClick={() => setSalvo(null)}>
            Lançar outro
          </button>
          <button type="button" className="botao secundario" onClick={() => navegar('/')}>
            Voltar para Hoje
          </button>
        </div>
      </section>
    )

  return (
    <form onSubmit={aoEnviar} style={{ maxWidth: 560 }}>
      <h1>Novo gasto</h1>
      {erroEnvio && <Aviso tipo="erro">{erroEnvio}</Aviso>}
      <CampoValor key={salvo === null ? 'novo' : 'salvo'} rotulo="Valor" valorCentavos={valor} aoMudar={setValor} grande autoFocus />
      <SeletorCategoria categorias={dados.mes.categorias} maisUsadas={maisUsadas} selecionada={categoriaId} aoEscolher={setCategoriaId} />
      {mostrarDetalhes ? (
        <div className="linha-campos">
          <div className="campo">
            <label htmlFor="data">Data</label>
            <input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
          </div>
          <div className="campo">
            <label htmlFor="descricao">Descrição (opcional)</label>
            <input id="descricao" maxLength={120} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
        </div>
      ) : (
        <p className="pequeno">
          Data: hoje.{' '}
          <button type="button" className="botao secundario" onClick={() => setMostrarDetalhes(true)}>
            Mudar data ou descrever
          </button>
        </p>
      )}
      <button className="botao bloco" disabled={enviando || valor === null || !categoriaId}>
        {enviando ? 'Salvando...' : 'Salvar gasto'}
      </button>
    </form>
  )
}
