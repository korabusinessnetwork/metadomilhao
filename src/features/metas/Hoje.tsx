import { Link } from 'react-router-dom'
import { useSessao } from '../../contexto/SessaoContexto'
import { useCarregar } from '../../lib/useCarregar'
import { carregarDadosDoMes } from '../dadosDoMes'
import { saldos } from '../../lib/services/patrimonioService'
import { historico } from '../../lib/services/fechamentoService'
import { premissasDoPlano } from '../../lib/calculos/plano'
import { mesesAteMeta } from '../../lib/calculos/projecao'
import { metaReserva } from '../../lib/calculos/reserva'
import { resumoCarteira } from '../../lib/calculos/patrimonio'
import { dataEmSaoPaulo, somarMeses } from '../../lib/calculos/datas'
import { ok } from '../../lib/services/resultado'
import { statusHoje } from '../../lib/services/tradeService'
import { revisaoDoDia } from '../../lib/services/noticiasService'
import { TEXTO_MOTIVO } from '../../lib/calculos/travas'
import { Aviso, BarraMeta, Carregando, Dinheiro, ErroComAcao, Prazo, SeloProjecao } from '../../componentes/Basicos'

/** Topo do dia: limite de gasto restante, status do trade, prazo do milhão e reserva (docs/02_DESIGN_SYSTEM). */
export function Hoje() {
  const { perfil, plano } = useSessao()
  const { dados, erro, carregando, recarregar } = useCarregar(async () => {
    const [mes, carteira, fechamentos, trade, revisao] = await Promise.all([carregarDadosDoMes(), saldos(), historico(), statusHoje(), revisaoDoDia(dataEmSaoPaulo())])
    if (mes.erro !== null) return mes
    if (carteira.erro !== null) return carteira
    if (fechamentos.erro !== null) return fechamentos
    if (trade.erro !== null) return trade
    if (revisao.erro !== null) return revisao
    return ok({ mes: mes.dados, carteira: carteira.dados, fechamentos: fechamentos.dados, trade: trade.dados, revisao: revisao.dados })
  }, [])

  if (carregando) return <Carregando />
  if (erro || !dados || !plano) return <ErroComAcao erro={erro ?? 'Plano não encontrado.'} tentarDeNovo={recarregar} />

  const { mes, carteira, fechamentos, trade, revisao } = dados
  const premissas = premissasDoPlano(plano, perfil?.data_mudanca ?? null, mes.hoje)
  const resumo = resumoCarteira(
    carteira.filter((a) => a.ativo),
    metaReserva({ despesasMesesFechadosCentavos: fechamentos.map((f) => f.gasto_real), orcamentoMensalCentavos: mes.orcadoTotal }),
  )
  const prazo = mesesAteMeta({ patrimonioInicialCentavos: resumo.totalCentavos, taxaRealMensal: premissas.taxaRealMensal, aporte: premissas.aporte, metaCentavos: premissas.metaCentavos })
  const mesAnterior = somarMeses(mes.mes, -1)
  const faltaFechar = !fechamentos.some((f) => f.mes === mesAnterior) && fechamentos.length > 0
  const semOrcamento = mes.orcadoTotal === 0

  return (
    <>
      <div className="cabecalho-tela">
        <h1>Hoje</h1>
        <span className="mut pequeno">{new Date(`${mes.hoje}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      </div>

      {faltaFechar && (
        <Aviso>
          O mês anterior ainda não foi fechado. <Link to="/fechamento">Fechar agora</Link>
        </Aviso>
      )}

      <section className="painel" aria-labelledby="t-limite">
        <h2 id="t-limite">Limite de gasto de hoje</h2>
        {semOrcamento ? (
          <p>
            O orçamento deste mês está vazio. <Link to="/orcamento">Definir o orçamento</Link>
          </p>
        ) : (
          <>
            <p className={`destaque num ${mes.limite.estourou ? 'bad' : ''}`}>
              <Dinheiro centavos={mes.limite.restanteHojeCentavos} />
            </p>
            <p className="mut pequeno">
              {mes.limite.estourou ? (
                'Passou do limite de hoje. O excedente reduz o limite dos próximos dias, sem bloquear nada.'
              ) : (
                <>
                  Restam hoje, de um limite de <Dinheiro centavos={mes.limite.limiteHojeCentavos} />. {mes.limite.diasRestantes}{' '}
                  {mes.limite.diasRestantes === 1 ? 'dia' : 'dias'} até o fim do mês, contando hoje. Só gastos variáveis.
                </>
              )}
            </p>
          </>
        )}
      </section>

      <div className="grade">
        <section className="painel" aria-labelledby="t-mes">
          <h2 id="t-mes">Gasto do mês</h2>
          <BarraMeta realCentavos={mes.gastoTotal} metaCentavos={mes.orcadoTotal} rotulo="Gasto do mês contra o orçado" />
          <Link to="/gastos">Ver lançamentos</Link>
        </section>

        <section className="painel" aria-labelledby="t-trade">
          <h2 id="t-trade">Trade de hoje</h2>
          {!trade ? (
            <p className="mut">
              Trade não configurado. <Link to="/trade/configurar">Configurar</Link>
            </p>
          ) : trade.aberto ? (
            <>
              <p className="medio ok">Diário aberto</p>
              <p className="pequeno">
                Resultado <Dinheiro centavos={trade.resultado_dia_centavos} semantico />. Meta <Dinheiro centavos={trade.meta_dia_centavos} />, limite de perda{' '}
                <Dinheiro centavos={trade.perda_dia_centavos} />.
              </p>
            </>
          ) : (
            <>
              <p className="medio bad">Diário fechado</p>
              <p className="pequeno">
                {trade.motivo ? TEXTO_MOTIVO[trade.motivo] : ''} Reabre em {trade.reabre_em?.split('-').reverse().join('/')}.
              </p>
            </>
          )}
          <Link to="/trade">Ir para o trade</Link>
        </section>

        <section className="painel" aria-labelledby="t-noticias">
          <h2 id="t-noticias">Notícias do pregão</h2>
          {!revisao ? (
            <p className="mut">A revisão de hoje sai às 8h30 nos dias de pregão.</p>
          ) : revisao.status === 'ok' ? (
            <p>
              {(revisao.conteudo ?? []).filter((a) => !a.sem_novidades).length} de {(revisao.conteudo ?? []).length} ativos com novidades
              {(revisao.agenda ?? []).length > 0 ? `, ${(revisao.agenda ?? []).length} eventos na agenda` : ''}.
            </p>
          ) : (
            <p className="bad">{revisao.status === 'sem_orcamento' ? 'Teto mensal da IA atingido.' : 'A revisão de hoje falhou.'}</p>
          )}
          <Link to="/noticias">Ver notícias</Link>
        </section>

        <section className="painel" aria-labelledby="t-milhao">
          <h2 id="t-milhao">Prazo até o milhão</h2>
          <p className="medio">
            <SeloProjecao>
              <Prazo meses={prazo} />
            </SeloProjecao>
          </p>
          <p className="mut pequeno">
            Partindo de <Dinheiro centavos={resumo.totalCentavos} /> reais de hoje, {(premissas.taxaRealMensal * 100).toFixed(2).replace('.', ',')}% a.m. real e aporte de{' '}
            <Dinheiro centavos={premissas.aporteDoProximoMes} /> no próximo mês. Sem trade.
          </p>
          <Link to="/plano">Ver o plano</Link>
        </section>

        <section className="painel" aria-labelledby="t-reserva">
          <h2 id="t-reserva">Reserva de emergência</h2>
          <BarraMeta realCentavos={resumo.porClasse.reserva} metaCentavos={resumo.metaReservaCentavos} rotulo="Reserva contra a meta" sentido="objetivo" />
          <p className="mut pequeno">{resumo.reservaCompleta ? 'Reserva completa.' : 'A sobra do mês vai primeiro para a reserva (P-01).'}</p>
          <Link to="/patrimonio">Ver patrimônio</Link>
        </section>
      </div>
    </>
  )
}
