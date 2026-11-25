import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCarregar } from '../../lib/useCarregar'
import { encerrarDia, encerrarOperacao, listarOperacoes, listarSetups, obterNotaDoDia, salvarNotaDoDia, statusHoje } from '../../lib/services/tradeService'
import { dataEmSaoPaulo } from '../../lib/calculos/datas'
import { paraPreco, resultadoBrutoCentavos } from '../../lib/calculos/trade'
import { paraCentavos } from '../../lib/calculos/dinheiro'
import { ok } from '../../lib/services/resultado'
import { revisaoDoDia } from '../../lib/services/noticiasService'
import type { Operacao, Setup } from '../../lib/tipos'
import { Aviso, Carregando, Dinheiro, ErroComAcao, EstadoVazio } from '../../componentes/Basicos'
import { FaixaTrava } from './FaixaTrava'
import { FormularioOperacao } from './FormularioOperacao'
import './trade.css'

/** Trade, dia (docs/06_COMPONENTES): status das travas, formulário e operações do dia. */
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
  )
}

export function TabelaOperacoes({ ops, setups }: { ops: Operacao[]; setups: Setup[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Ativo</th>
          <th>Setup</th>
          <th className="num">Líquido</th>
          <th className="num">R</th>
        </tr>
      </thead>
      <tbody>
        {ops.map((o) => (
          <tr key={o.id}>
            <td>
              {o.ativo} <span className="mut pequeno">{o.direcao === 'compra' ? 'compra' : 'venda'} × {o.quantidade}</span>
              {o.violacao_trava && <div className="marca-violacao">Violação de trava</div>}
              {o.seguiu_plano === false && !o.violacao_trava && <div className="warn pequeno">Fora do plano</div>}
            </td>
            <td className="pequeno">{setups.find((s) => s.id === o.setup_id)?.nome} · {o.timeframe_entrada}</td>
            <td className="num"><Dinheiro centavos={o.resultado_liquido_centavos ?? 0} semantico /></td>
            <td className="num">{o.resultado_r !== null ? `${o.resultado_r > 0 ? '+' : o.resultado_r < 0 ? '−' : ''}${Math.abs(o.resultado_r).toFixed(2).replace('.', ',')}R` : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function EncerrarOperacao({ op, setups, aoSalvar, aoErro }: { op: Operacao; setups: Setup[]; aoSalvar: (t: string) => void; aoErro: (t: string) => void }) {
  const [saida, setSaida] = useState('')
  const [custos, setCustos] = useState('')
  const [seguiu, setSeguiu] = useState(true)
  const [obs, setObs] = useState('')
  const [enviando, setEnviando] = useState(false)
  const pSaida = paraPreco(saida)
  const custosCentavos = custos ? paraCentavos(custos) : 0
  const previa = pSaida !== null ? resultadoBrutoCentavos({ ...op, entrada: op.preco_entrada, saida: pSaida }) - (custosCentavos ?? 0) : null

  return (
    <form
      className="painel"
      onSubmit={async (e) => {
        e.preventDefault()
        if (pSaida === null) return aoErro('Informe o preço de saída.')
        if (custosCentavos === null) return aoErro('Custos inválidos.')
        setEnviando(true)
        const r = await encerrarOperacao(op.id, { saida: pSaida, custosCentavos, seguiuPlano: seguiu, observacao: obs })
        setEnviando(false)
        if (r.erro !== null) aoErro(r.erro)
        else aoSalvar('Operação encerrada.')
      }}
    >
      <h2>
        Em aberto: {op.ativo} {op.direcao === 'compra' ? 'compra' : 'venda'} × {op.quantidade}
      </h2>
      <p className="pequeno mut" style={{ fontVariantNumeric: 'tabular-nums' }}>
        Entrada {op.preco_entrada.toLocaleString('pt-BR')} · stop {op.preco_stop.toLocaleString('pt-BR')} · alvo {op.preco_alvo.toLocaleString('pt-BR')} · risco <Dinheiro centavos={op.risco_centavos} /> ·{' '}
        {setups.find((s) => s.id === op.setup_id)?.nome}
      </p>
      <div className="linha-campos">
        <div className="campo">
          <label htmlFor={`saida-${op.id}`}>Saída</label>
          <input id={`saida-${op.id}`} inputMode="decimal" value={saida} onChange={(e) => setSaida(e.target.value.replace(/[^\d.,]/g, ''))} />
        </div>
        <div className="campo">
          <label htmlFor={`custos-${op.id}`}>Custos (R$)</label>
          <input id={`custos-${op.id}`} inputMode="decimal" placeholder="0,00" value={custos} onChange={(e) => setCustos(e.target.value.replace(/[^\d.,]/g, ''))} />
        </div>
      </div>
      {previa !== null && (
        <p>
          Resultado líquido: <Dinheiro centavos={previa} semantico />
        </p>
      )}
      <label className="marcar">
        <input type="checkbox" checked={seguiu} onChange={(e) => setSeguiu(e.target.checked)} />
        Seguiu o plano
      </label>
      <div className="campo">
        <label htmlFor={`obs-${op.id}`}>Observação (opcional)</label>
        <input id={`obs-${op.id}`} maxLength={1000} value={obs} onChange={(e) => setObs(e.target.value)} />
      </div>
      <button className="botao" disabled={enviando || pSaida === null}>
        {enviando ? 'Encerrando...' : 'Registrar saída'}
      </button>
    </form>
  )
}

function NotaDoDia({ data, nota, aoErro }: { data: string; nota: string; aoErro: (t: string) => void }) {
  const [texto, setTexto] = useState(nota)
  const [salvo, setSalvo] = useState(false)
  return (
    <form
      className="painel"
      onSubmit={async (e) => {
        e.preventDefault()
        const r = await salvarNotaDoDia(data, texto)
        if (r.erro !== null) aoErro(r.erro)
        else setSalvo(true)
      }}
    >
      <div className="campo">
        <label htmlFor="nota-dia">Nota do dia</label>
        <textarea id="nota-dia" rows={3} maxLength={2000} value={texto} onChange={(e) => { setTexto(e.target.value); setSalvo(false) }} />
      </div>
      <button className="botao secundario" disabled={texto === nota && !salvo}>{salvo ? 'Nota salva' : 'Salvar nota'}</button>
    </form>
  )
}
