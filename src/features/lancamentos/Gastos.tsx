import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCarregar } from '../../lib/useCarregar'
import { carregarDadosDoMes } from '../dadosDoMes'
import { estornar, listarRendas, registrarRenda, removerRenda } from '../../lib/services/lancamentoService'
import { dataEmSaoPaulo, inicioDoMes, somarMeses } from '../../lib/calculos/datas'
import { ok } from '../../lib/services/resultado'
import { NOMES_FONTE, type FonteRenda, type Lancamento } from '../../lib/tipos'
import { Aviso, BarraMeta, Carregando, Dinheiro, ErroComAcao, EstadoVazio } from '../../componentes/Basicos'
import { CampoValor } from '../../componentes/Campos'

function nomeDoMes(mes: string) {
  return new Date(`${mes}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

/** Lista do mês e realizado × orçado por categoria. */
export function Gastos() {
  const [mes, setMes] = useState(() => inicioDoMes(dataEmSaoPaulo()))
  const { dados, erro, carregando, recarregar } = useCarregar(async () => {
    const [d, rendas] = await Promise.all([carregarDadosDoMes(mes), listarRendas(mes)])
    if (d.erro !== null) return d
    if (rendas.erro !== null) return rendas
    return ok({ ...d.dados, rendas: rendas.dados })
  }, [mes])
  const [mensagem, setMensagem] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null)

  async function aoEstornar(l: Lancamento) {
    if (!window.confirm('Estornar este gasto? Ele continua no histórico, com um lançamento negativo vinculado.')) return
    const r = await estornar(l, dataEmSaoPaulo())
    setMensagem(r.erro ? { tipo: 'erro', texto: r.erro } : { tipo: 'sucesso', texto: 'Estorno registrado.' })
    if (!r.erro) recarregar()
  }

  return (
    <>
      <div className="cabecalho-tela">
        <h1>Gastos</h1>
        <div className="acoes" style={{ marginTop: 0 }}>
          <button type="button" className="botao secundario" onClick={() => setMes(somarMeses(mes, -1))} aria-label="Mês anterior">
            ‹
          </button>
          <span className="medio" style={{ alignSelf: 'center' }}>{nomeDoMes(mes)}</span>
          <button type="button" className="botao secundario" onClick={() => setMes(somarMeses(mes, 1))} aria-label="Próximo mês">
            ›
          </button>
        </div>
      </div>
      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}
      {carregando && <Carregando />}
      {erro && <ErroComAcao erro={erro} tentarDeNovo={recarregar} />}
      {dados && !carregando && (
        <>
          <div className="grade">
            <section className="painel">
              <h2>Realizado × orçado</h2>
              <BarraMeta realCentavos={dados.gastoTotal} metaCentavos={dados.orcadoTotal} rotulo="Total do mês" />
              <table>
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th className="num">Real</th>
                    <th className="num">Orçado</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.categorias
                    .filter((c) => c.ativa || dados.lancamentos.some((l) => l.categoria_id === c.id))
                    .map((c) => {
                      const real = dados.lancamentos.filter((l) => l.categoria_id === c.id).reduce((s, l) => s + l.valor_centavos, 0)
                      const orcado = dados.orcamento.itens.find((i) => i.categoria_id === c.id)?.valor_centavos ?? 0
                      return (
                        <tr key={c.id}>
                          <td>
                            {c.nome}
                            {c.estimativa && <span className="warn pequeno"> (estimativa)</span>}
                          </td>
                          <td className={`num ${real > orcado ? 'bad' : ''}`}>
                            <Dinheiro centavos={real} />
                            {real > orcado && <span className="so-leitor"> acima do orçado</span>}
                          </td>
                          <td className="num">
                            <Dinheiro centavos={orcado} />
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </section>
            <Rendas mes={mes} rendas={dados.rendas} aoMudar={recarregar} />
          </div>

          <section className="painel">
            <div className="cabecalho-tela" style={{ marginBottom: 8 }}>
              <h2 style={{ margin: 0 }}>Lançamentos</h2>
              <Link className="botao" to="/gastos/novo">
                Novo gasto
              </Link>
            </div>
            {dados.lancamentos.length === 0 ? (
              <EstadoVazio mensagem="Nenhum gasto neste mês." />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Categoria</th>
                    <th className="num">Valor</th>
                    <th>
                      <span className="so-leitor">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dados.lancamentos.map((l) => {
                    const estornado = dados.lancamentos.some((x) => x.estorno_de === l.id)
                    return (
                      <tr key={l.id}>
                        <td className="num">{l.data.slice(8, 10)}/{l.data.slice(5, 7)}</td>
                        <td>
                          {dados.categorias.find((c) => c.id === l.categoria_id)?.nome}
                          {l.descricao && <div className="mut pequeno">{l.descricao}</div>}
                          {estornado && <div className="mut pequeno">Estornado</div>}
                        </td>
                        <td className="num">
                          <Dinheiro centavos={l.valor_centavos} semantico={l.valor_centavos < 0} />
                        </td>
                        <td className="direita">
                          {!l.estorno_de && !estornado && (
                            <button type="button" className="botao perigo" onClick={() => aoEstornar(l)}>
                              Estornar
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </>
  )
}

function Rendas({ mes, rendas, aoMudar }: { mes: string; rendas: { id: string; fonte: FonteRenda; valor_centavos: number; recebido_em: string }[]; aoMudar: () => void }) {
  const [valor, setValor] = useState<number | null>(null)
  const [fonte, setFonte] = useState<FonteRenda>('salario')
  const [data, setData] = useState(() => (inicioDoMes(dataEmSaoPaulo()) === mes ? dataEmSaoPaulo() : mes))
  const [erro, setErro] = useState<string | null>(null)
  const [chave, setChave] = useState(0)
  const total = rendas.reduce((s, r) => s + r.valor_centavos, 0)

  async function adicionar() {
    if (valor === null) return setErro('Digite o valor.')
    const r = await registrarRenda({ recebidoEm: data, fonte, valorCentavos: valor })
    if (r.erro !== null) return setErro(r.erro)
    setErro(null)
    setValor(null)
    setChave((c) => c + 1)
    aoMudar()
  }

  async function remover(id: string) {
    if (!window.confirm('Remover esta renda?')) return
    const r = await removerRenda(id)
    if (r.erro !== null) setErro(r.erro)
    else aoMudar()
  }

  return (
    <section className="painel">
      <h2>Renda recebida</h2>
      <p className="medio">
        <Dinheiro centavos={total} />
      </p>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {rendas.length > 0 && (
        <table>
          <tbody>
            {rendas.map((r) => (
              <tr key={r.id}>
                <td>{NOMES_FONTE[r.fonte]}</td>
                <td className="num">{r.recebido_em.slice(8, 10)}/{r.recebido_em.slice(5, 7)}</td>
                <td className="num">
                  <Dinheiro centavos={r.valor_centavos} />
                </td>
                <td className="direita">
                  <button type="button" className="botao secundario" onClick={() => remover(r.id)} aria-label="Remover renda">
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="linha-campos" style={{ marginTop: 12 }}>
        <div className="campo">
          <label htmlFor="fonte">Fonte</label>
          <select id="fonte" value={fonte} onChange={(e) => setFonte(e.target.value as FonteRenda)}>
            {Object.entries(NOMES_FONTE).map(([v, n]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="data-renda">Recebido em</label>
          <input id="data-renda" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
      </div>
      <CampoValor key={chave} rotulo="Valor" valorCentavos={valor} aoMudar={setValor} />
      <button type="button" className="botao secundario" onClick={adicionar}>
        Adicionar renda
      </button>
    </section>
  )
}
