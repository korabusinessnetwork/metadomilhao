import { Link } from 'react-router-dom'
import { useCarregar } from '../../lib/useCarregar'
import { listarSetups, listarTodasFechadas } from '../../lib/services/tradeService'
import { estatisticasTrade, AMOSTRA_MINIMA, type Grupo } from '../../lib/calculos/estatisticas'
import { desempenhoDe, tradeValidado } from '../../lib/calculos/risco'
import { dataEmSaoPaulo } from '../../lib/calculos/datas'
import { ok } from '../../lib/services/resultado'
import { Carregando, Dinheiro, ErroComAcao, EstadoVazio } from '../../componentes/Basicos'
import './trade.css'

const pct = (v: number) => `${(v * 100).toFixed(1).replace('.', ',')}%`
const emR = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2).replace('.', ',')}R`

function TabelaGrupos({ titulo, grupos }: { titulo: string; grupos: Record<string, Grupo> }) {
  const linhas = Object.entries(grupos).sort((a, b) => b[1].total - a[1].total)
  return (
    <section className="painel">
      <h2>{titulo}</h2>
      <table>
        <thead>
          <tr>
            <th></th>
            <th className="num">Ops</th>
            <th className="num">Acerto</th>
            <th className="num">Expect.</th>
            <th className="num">Resultado</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(([nome, g]) => (
            <tr key={nome}>
              <td>{nome}</td>
              <td className="num">{g.total}</td>
              <td className="num">{pct(g.taxaAcerto)}</td>
              <td className="num">{emR(g.expectativaR)}</td>
              <td className="num"><Dinheiro centavos={g.resultadoCentavos} semantico /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

/** T-06 e T-07: estatísticas com selo de amostra pequena abaixo de 100 operações. */
export function Estatisticas() {
  const { dados, erro, carregando, recarregar } = useCarregar(async () => {
    const [ops, setups] = await Promise.all([listarTodasFechadas(), listarSetups()])
    if (ops.erro !== null) return ops
    if (setups.erro !== null) return setups
    return ok({ ops: ops.dados, setups: setups.dados })
  }, [])

  if (carregando) return <Carregando />
  if (erro || !dados) return <ErroComAcao erro={erro ?? ''} tentarDeNovo={recarregar} />

  const nomeSetup = (id: string) => dados.setups.find((s) => s.id === id)?.nome ?? 'Sem nome'
  const simples = dados.ops.map((o) => ({
    data: o.data,
    resultadoLiquidoCentavos: o.resultado_liquido_centavos ?? 0,
    riscoCentavos: o.risco_centavos,
    setup: nomeSetup(o.setup_id),
    timeframe: o.timeframe_entrada,
    violacaoTrava: o.violacao_trava,
  }))
  const e = estatisticasTrade(simples)
  const desempenho = desempenhoDe(simples, dataEmSaoPaulo())
  const selo = !e.amostraConfiavel && <span className="selo-amostra">amostra pequena</span>

  return (
    <>
      <div className="cabecalho-tela">
        <h1>Estatísticas</h1>
        <Link to="/trade">Voltar para o trade</Link>
      </div>
      {e.total === 0 ? (
        <EstadoVazio mensagem="As estatísticas aparecem depois da primeira operação encerrada." />
      ) : (
        <>
          <section className="painel">
            <p>
              {e.total} de {AMOSTRA_MINIMA} operações para a expectativa ficar confiável (T-07).
              {tradeValidado(desempenho)
                ? ' Trade validado: entra no plano como cenário com trade (T-09).'
                : ' Até lá, o trade não entra como premissa do plano (T-09).'}
            </p>
          </section>
          <div className="grade">
            <section className="painel">
              <h3>Resultado líquido</h3>
              <p className="medio"><Dinheiro centavos={e.resultadoCentavos} semantico /></p>
            </section>
            <section className="painel">
              <h3>Taxa de acerto {selo}</h3>
              <p className="medio num">{pct(e.taxaAcerto)}</p>
            </section>
            <section className="painel">
              <h3>Payoff médio {selo}</h3>
              <p className="medio num">{e.payoffMedio.toFixed(2).replace('.', ',')}</p>
            </section>
            <section className="painel">
              <h3>Expectativa {selo}</h3>
              <p className="medio num">{emR(e.expectativaR)}</p>
              <p className="num"><Dinheiro centavos={e.expectativaCentavos} semantico /> por operação</p>
            </section>
            <section className="painel">
              <h3>Maior sequência de perdas</h3>
              <p className="medio num">{e.maiorSequenciaPerdas}</p>
            </section>
            <section className="painel">
              <h3>Drawdown máximo</h3>
              <p className="medio num"><Dinheiro centavos={-e.drawdownMaximoCentavos} semantico /></p>
            </section>
            <section className="painel">
              <h3>Violações de trava (TR-06)</h3>
              <p className={`medio num ${e.violacoes.quantidade > 0 ? 'bad' : ''}`}>{e.violacoes.quantidade}</p>
              <p className="num">Resultado: <Dinheiro centavos={e.violacoes.resultadoCentavos} semantico /></p>
            </section>
          </div>
          <div className="grade">
            <TabelaGrupos titulo="Por setup" grupos={e.porSetup} />
            <TabelaGrupos titulo="Por timeframe" grupos={e.porTimeframe} />
          </div>
        </>
      )}
    </>
  )
}
