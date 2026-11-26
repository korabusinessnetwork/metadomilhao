import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCarregar } from '../../lib/useCarregar'
import { encerrarDia, listarOperacoes, listarSetups, obterNotaDoDia, statusHoje } from '../../lib/services/tradeService'
import { dataEmSaoPaulo, inicioDoMes } from '../../lib/calculos/datas'
import { ok } from '../../lib/services/resultado'
import { revisaoDoDia } from '../../lib/services/noticiasService'
import { Aviso, Carregando, Dinheiro, ErroComAcao, EstadoVazio } from '../../componentes/Basicos'
import { FaixaTrava } from './FaixaTrava'
import { FormularioOperacao } from './FormularioOperacao'
import { CalendarioTrade } from './CalendarioTrade'
import { DiaPassado } from './DiaPassado'
import { EncerrarOperacao, NotaDoDia, TabelaOperacoes } from './PartesDoDia'
import './trade.css'

/** Trade (docs/06_COMPONENTES): status das travas de hoje, calendário do mês (T-10) e o dia escolhido. */
export function Trade() {
  const hoje = dataEmSaoPaulo()
  const { dados, erro, carregando, recarregar } = useCarregar(async () => {
    const [status, setups, ops, nota, revisao] = await Promise.all([statusHoje(), listarSetups(), listarOperacoes(hoje, hoje), obterNotaDoDia(hoje), revisaoDoDia(hoje)])
    if (revisao.erro !== null) return revisao
    if (status.erro !== null) return status
    if (setups.erro !== null) return setups
    if (ops.erro !== null) return ops
    if (nota.erro !== null) return nota
    return ok({ status: status.dados, setups: setups.dados, ops: ops.dados, nota: nota.dados, revisaoId: revisao.dados?.status === 'ok' ? revisao.dados.id : null })
  }, [hoje])
  const [mensagem, setMensagem] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null)
  const [mostrarViolacao, setMostrarViolacao] = useState(false)
  const [diaEscolhido, setDiaEscolhido] = useState(hoje)
  const [mesVisivel, setMesVisivel] = useState(() => inicioDoMes(hoje))
  // Sobe a cada registro, para o calendário recarregar o mês
  const [versao, setVersao] = useState(0)

  if (carregando) return <Carregando />
  if (erro || !dados) return <ErroComAcao erro={erro ?? ''} tentarDeNovo={recarregar} />

  if (!dados.status || dados.setups.length === 0)
    return (
      <>
        <h1>Trade</h1>
        <EstadoVazio
          mensagem="Antes da primeira operação: escolha o ativo de capital de trade, o risco por operação e cadastre pelo menos um setup."
          acao={<Link className="botao" to="/trade/configurar">Configurar trade</Link>}
        />
      </>
    )

  const s = dados.status
  const abertas = dados.ops.filter((o) => o.preco_saida === null)
  const fechadas = dados.ops.filter((o) => o.preco_saida !== null)
  const sucesso = (texto: string) => {
    setMensagem({ tipo: 'sucesso', texto })
    setMostrarViolacao(false)
    setVersao((v) => v + 1)
    recarregar()
  }

  async function aoEncerrarDia() {
    if (!window.confirm('Encerrar o dia de trade? Não tem volta: o diário só reabre no próximo dia útil.')) return
    const r = await encerrarDia(dados?.nota ?? '')
    if (r.erro !== null) setMensagem({ tipo: 'erro', texto: r.erro })
    else sucesso('Dia encerrado.')
  }

  return (
    <>
      <div className="cabecalho-tela">
        <h1>Trade</h1>
        <div className="acoes" style={{ marginTop: 0 }}>
          <Link className="botao secundario" to="/noticias">Notícias</Link>
          <Link className="botao secundario" to="/trade/importar">Importar MT5</Link>
          <Link className="botao secundario" to="/trade/estatisticas">Estatísticas</Link>
          <Link className="botao secundario" to="/trade/ir">IR</Link>
          <Link className="botao secundario" to="/trade/configurar">Configurar</Link>
        </div>
      </div>

      {!s.aberto && s.motivo && <FaixaTrava motivo={s.motivo} reabreEm={s.reabre_em} />}
      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}

      <CalendarioTrade
        mes={mesVisivel}
        hoje={hoje}
        escolhido={diaEscolhido}
        versao={versao}
        aoEscolher={(d) => {
          setDiaEscolhido(d)
          setMensagem(null)
        }}
        aoMudarMes={setMesVisivel}
      />

      {diaEscolhido !== hoje ? (
        <>
          <div className="acoes" style={{ marginTop: 0, marginBottom: 16 }}>
            <button type="button" className="botao secundario" onClick={() => { setDiaEscolhido(hoje); setMesVisivel(inicioDoMes(hoje)) }}>
              Voltar para hoje
            </button>
          </div>
          <DiaPassado
            key={diaEscolhido}
            dia={diaEscolhido}
            hoje={hoje}
            setups={dados.setups}
            aoSalvar={sucesso}
            aoErro={(t) => setMensagem({ tipo: 'erro', texto: t })}
          />
        </>
      ) : (
      <>
        <section className="painel">
          <div className="grade" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <div>
              <h3>Resultado de hoje</h3>
              <p className="medio"><Dinheiro centavos={s.resultado_dia_centavos} semantico /></p>
            </div>
            <div>
              <h3>Meta do dia (M-10)</h3>
              <p className="medio num"><Dinheiro centavos={s.meta_dia_centavos} /></p>
            </div>
            <div>
              <h3>Limite de perda do dia (M-11)</h3>
              <p className="medio num"><Dinheiro centavos={s.perda_dia_centavos} /></p>
            </div>
            <div>
              <h3>Semana / limite (M-12)</h3>
              <p style={{ fontVariantNumeric: 'tabular-nums' }}><Dinheiro centavos={s.resultado_semana_centavos} semantico /> de −<Dinheiro centavos={s.perda_semana_centavos} /></p>
            </div>
            <div>
              <h3>Mês / limite (M-13)</h3>
              <p style={{ fontVariantNumeric: 'tabular-nums' }}><Dinheiro centavos={s.resultado_mes_centavos} semantico /> de −<Dinheiro centavos={s.perda_mes_centavos} /></p>
            </div>
            <div>
              <h3>Risco por operação (R)</h3>
              <p className="num"><Dinheiro centavos={s.risco_operacao_centavos} /></p>
            </div>
          </div>
        </section>

      <div className="trade-colunas">
        <div>
          {s.aberto ? (
            <FormularioOperacao modo="planejada" setups={dados.setups} capitalCentavos={s.capital_inicio_dia_centavos} revisaoHojeId={dados.revisaoId} aoSalvar={sucesso} />
          ) : (
            <section className="painel">
              <p>O formulário de operação está bloqueado até a reabertura.</p>
              {!mostrarViolacao && (
                <button type="button" className="botao perigo" onClick={() => setMostrarViolacao(true)}>
                  Registrar operação já executada (violação)
                </button>
              )}
            </section>
          )}
          {!s.aberto && mostrarViolacao && <FormularioOperacao modo="violacao" setups={dados.setups} capitalCentavos={s.capital_inicio_dia_centavos} revisaoHojeId={dados.revisaoId} aoSalvar={sucesso} />}
        </div>

        <div>
          {abertas.map((o) => (
            <EncerrarOperacao key={o.id} op={o} setups={dados.setups} aoSalvar={sucesso} aoErro={(t) => setMensagem({ tipo: 'erro', texto: t })} />
          ))}
          <section className="painel">
            <h2>Operações de hoje</h2>
            {fechadas.length === 0 ? (
              <p className="mut">Nenhuma operação encerrada hoje.</p>
            ) : (
              <TabelaOperacoes ops={fechadas} setups={dados.setups} />
            )}
          </section>
          <NotaDoDia data={hoje} nota={dados.nota} aoErro={(t) => setMensagem({ tipo: 'erro', texto: t })} />
          {s.aberto && (
            <button type="button" className="botao secundario" onClick={aoEncerrarDia}>
              Encerrar o dia
            </button>
          )}
        </div>
      </div>
      </>
      )}
    </>
  )
}

