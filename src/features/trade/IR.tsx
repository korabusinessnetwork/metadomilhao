import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCarregar } from '../../lib/useCarregar'
import { listarPagamentosIR, listarTodasFechadas, registrarPagamentoIR, removerPagamentoIR } from '../../lib/services/tradeService'
import { apurarIR, mesesDeDayTrade } from '../../lib/calculos/ir'
import { dataEmSaoPaulo, inicioDoMes } from '../../lib/calculos/datas'
import { ok } from '../../lib/services/resultado'
import { Aviso, Carregando, Dinheiro, ErroComAcao, EstadoVazio } from '../../componentes/Basicos'

const nomeDoMes = (mes: string) => new Date(`${mes}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

/** IR-01 a IR-04: apuração mensal e DARF estimado. Apoio, não declaração oficial. */
export function IR() {
  const { dados, erro, carregando, recarregar } = useCarregar(async () => {
    const [ops, pagos] = await Promise.all([listarTodasFechadas(), listarPagamentosIR()])
    if (ops.erro !== null) return ops
    if (pagos.erro !== null) return pagos
    return ok({ ops: ops.dados, pagos: pagos.dados })
  }, [])
  const [mensagem, setMensagem] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null)

  if (carregando) return <Carregando />
  if (erro || !dados) return <ErroComAcao erro={erro ?? ''} tentarDeNovo={recarregar} />

  const apuracao = apurarIR(mesesDeDayTrade(dados.ops)).reverse()
  const mesAtual = inicioDoMes(dataEmSaoPaulo())

  return (
    <>
      <div className="cabecalho-tela">
        <h1>IR de day trade</h1>
        <Link to="/trade">Voltar para o trade</Link>
      </div>
      <Aviso>
        Estimativa de apoio, não declaração oficial: confira antes de pagar. 20% sobre o lucro líquido do mês, menos o IRRF de 1% e o prejuízo acumulado de day trade.
        DARF código 6015. DARF abaixo de R$ 10 não é emitido: o valor soma no mês seguinte.
      </Aviso>
      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}
      {apuracao.length === 0 ? (
        <EstadoVazio mensagem="Sem operações encerradas ainda." />
      ) : (
        <section className="painel">
          <table>
            <thead>
              <tr>
                <th>Mês</th>
                <th className="num">Lucro líquido</th>
                <th className="num">IRRF</th>
                <th className="num">Prejuízo compensado</th>
                <th className="num">DARF</th>
                <th>Vencimento</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {apuracao.map((m) => {
                const pago = dados.pagos.find((p) => p.mes === m.mes)
                return (
                  <tr key={m.mes}>
                    <td>
                      {nomeDoMes(m.mes)}
                      {m.prejuizoAcumuladoCentavos > 0 && (
                        <div className="pequeno mut">
                          Prejuízo a compensar: <Dinheiro centavos={m.prejuizoAcumuladoCentavos} />
                        </div>
                      )}
                    </td>
                    <td className="num"><Dinheiro centavos={m.lucroLiquidoCentavos} semantico /></td>
                    <td className="num"><Dinheiro centavos={m.irrfCentavos} /></td>
                    <td className="num"><Dinheiro centavos={m.prejuizoCompensadoCentavos} /></td>
                    <td className="num"><strong><Dinheiro centavos={m.impostoDevidoCentavos} /></strong></td>
                    <td className="num">{m.impostoDevidoCentavos > 0 ? m.vencimento.split('-').reverse().join('/') : ''}</td>
                    <td className="direita">
                      {m.impostoDevidoCentavos > 0 && m.mes < mesAtual &&
                        (pago ? (
                          <button
                            type="button"
                            className="botao secundario"
                            onClick={async () => {
                              const r = await removerPagamentoIR(pago.id)
                              if (r.erro !== null) setMensagem({ tipo: 'erro', texto: r.erro })
                              else recarregar()
                            }}
                          >
                            Pago em {pago.pago_em.split('-').reverse().join('/')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="botao"
                            onClick={async () => {
                              const r = await registrarPagamentoIR({ mes: m.mes, valorCentavos: m.impostoDevidoCentavos, pagoEm: dataEmSaoPaulo() })
                              if (r.erro !== null) setMensagem({ tipo: 'erro', texto: r.erro })
                              else recarregar()
                            }}
                          >
                            Marcar pago
                          </button>
                        ))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="pequeno mut">O mês corrente ainda pode mudar. Vencimento no último dia útil do mês seguinte (IR-04); feriados nacionais ainda não são considerados.</p>
        </section>
      )}
    </>
  )
}
