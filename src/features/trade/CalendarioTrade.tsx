import { useCarregar } from '../../lib/useCarregar'
import { feriadosB3, listarOperacoes } from '../../lib/services/tradeService'
import { inicioDoMes, somarMeses, ultimoDiaDoMes } from '../../lib/calculos/datas'
import { montarCalendarioTrade, resultadoCurto, type DiaCalendario } from '../../lib/calculos/calendarioTrade'
import { formatarCentavos } from '../../lib/calculos/dinheiro'
import { ok } from '../../lib/services/resultado'
import { Carregando, Dinheiro, ErroComAcao } from '../../componentes/Basicos'

const SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex']

function nomeDoMes(mes: string) {
  return new Date(`${mes}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}


function descricaoDoDia(d: DiaCalendario) {
  const partes = [new Date(`${d.data}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })]
  if (d.hoje) partes.push('hoje')
  if (d.feriado) partes.push('feriado, sem pregão')
  else if (d.futuro) partes.push('dia futuro')
  if (d.resultadoCentavos !== null) partes.push(`resultado ${formatarCentavos(d.resultadoCentavos, { sinal: true })}`)
  if (d.operacoes > 0) partes.push(`${d.operacoes} ${d.operacoes === 1 ? 'operação' : 'operações'}`)
  else if (!d.futuro && !d.feriado) partes.push('sem operação')
  if (d.teveViolacao) partes.push('com violação de trava')
  return partes.join(', ')
}

/**
 * T-10: calendário do diário de trade. Só segunda a sexta (fim de semana não tem pregão).
 * Tocar num dia abre o detalhe dele; hoje e dias passados de pregão aceitam registro.
 */
export function CalendarioTrade({
  mes,
  hoje,
  escolhido,
  versao,
  aoEscolher,
  aoMudarMes,
}: {
  mes: string
  hoje: string
  escolhido: string
  /** Muda quando uma operação é registrada, para recarregar o mês */
  versao: number
  aoEscolher: (data: string) => void
  aoMudarMes: (mes: string) => void
}) {
  const { dados, erro, carregando, recarregar } = useCarregar(async () => {
    const [ops, feriados] = await Promise.all([listarOperacoes(mes, ultimoDiaDoMes(mes)), feriadosB3()])
    if (ops.erro !== null) return ops
    if (feriados.erro !== null) return feriados
    return ok(montarCalendarioTrade({ mes, hoje, ops: ops.dados, feriados: feriados.dados }))
  }, [mes, hoje, versao])
  const noMesAtual = mes === inicioDoMes(hoje)

  return (
    <section className="painel calendario-trade" aria-labelledby="t-calendario">
      <div className="calendario-topo">
        <h2 id="t-calendario">Diário do mês</h2>
        <div className="calendario-navegacao">
          <button type="button" className="botao secundario" onClick={() => aoMudarMes(somarMeses(mes, -1))} aria-label="Mês anterior">
            ‹
          </button>
          <span className="calendario-mes">{nomeDoMes(mes)}</span>
          <button type="button" className="botao secundario" onClick={() => aoMudarMes(somarMeses(mes, 1))} disabled={noMesAtual} aria-label="Próximo mês">
            ›
          </button>
        </div>
      </div>

      {carregando && !dados ? (
        <Carregando texto="Carregando o mês..." />
      ) : erro || !dados ? (
        <ErroComAcao erro={erro ?? ''} tentarDeNovo={recarregar} />
      ) : (
        <>
          <p className="pequeno mut calendario-resumo">
            Resultado do mês: <Dinheiro centavos={dados.totalCentavos} semantico /> em {dados.diasOperados} {dados.diasOperados === 1 ? 'dia operado' : 'dias operados'}.
          </p>
          <div className="calendario-grade" role="grid" aria-label={`Dias de pregão de ${nomeDoMes(mes)}`}>
            <div className="calendario-linha" role="row">
              {SEMANA.map((s) => (
                <span key={s} className="calendario-cabecalho" role="columnheader">
                  {s}
                </span>
              ))}
            </div>
            {dados.semanas.map((semana, i) => (
              <div key={i} className="calendario-linha" role="row">
                {semana.map((d, j) =>
                  d === null ? (
                    <span key={j} className="calendario-dia vazio" role="gridcell" aria-hidden="true" />
                  ) : (
                    <button
                      key={d.data}
                      type="button"
                      role="gridcell"
                      className={[
                        'calendario-dia',
                        d.hoje ? 'hoje' : '',
                        d.futuro ? 'futuro' : '',
                        d.feriado ? 'feriado' : '',
                        d.resultadoCentavos !== null ? (d.resultadoCentavos > 0 ? 'positivo' : d.resultadoCentavos < 0 ? 'negativo' : 'zero') : '',
                      ].join(' ')}
                      aria-pressed={d.data === escolhido}
                      aria-label={descricaoDoDia(d)}
                      disabled={d.futuro}
                      onClick={() => aoEscolher(d.data)}
                    >
                      <span className="numero-dia">{d.dia}</span>
                      {d.feriado ? (
                        <span className="marca-dia">feriado</span>
                      ) : d.resultadoCentavos !== null ? (
                        <span className="resultado-dia">{resultadoCurto(d.resultadoCentavos)}</span>
                      ) : d.operacoes > 0 ? (
                        <span className="marca-dia">em aberto</span>
                      ) : null}
                      {d.teveViolacao && <span className="violacao-dia">violação</span>}
                    </button>
                  ),
                )}
              </div>
            ))}
          </div>
          <p className="pequeno mut">Toque num dia para ver as operações com centavos ou registrar. No quadrado, o líquido do dia em reais, arredondado.</p>
        </>
      )}
    </section>
  )
}
