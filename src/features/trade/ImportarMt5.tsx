import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useCarregar } from '../../lib/useCarregar'
import { confirmarRascunho, descartarRascunho, importarArquivo, listarRascunhos, type ContextoImportacao, type RascunhoMt5, type ResumoImportacao } from '../../lib/services/importacaoService'
import { listarSetups } from '../../lib/services/tradeService'
import { conferirLucro } from '../../lib/importacao/mt5'
import { paraPreco, type Tendencia, type Timeframe } from '../../lib/calculos/trade'
import { ok } from '../../lib/services/resultado'
import type { Setup } from '../../lib/tipos'
import { Aviso, Carregando, Dinheiro, ErroComAcao, EstadoVazio } from '../../componentes/Basicos'
import { Opcoes, Preco, TENDENCIAS } from './FormularioOperacao'
import './trade.css'

const quando = (iso: string) => {
  const [data = '', hora = ''] = iso.split('T')
  return `${data.split('-').reverse().join('/')} ${hora.slice(0, 5)}`
}

/**
 * Importação do MT5 (specs/mt5-tela.md). A próxima ação é sempre uma só: escolher o relatório,
 * ou completar o contexto da operação mais antiga ainda pendente.
 */
export function ImportarMt5() {
  const { dados, erro, carregando, recarregar } = useCarregar(async () => {
    const [rascunhos, setups] = await Promise.all([listarRascunhos(), listarSetups()])
    if (rascunhos.erro !== null) return rascunhos
    if (setups.erro !== null) return setups
    return ok({ rascunhos: rascunhos.dados, setups: setups.dados })
  }, [])
  const [lendo, setLendo] = useState(false)
  const [resumo, setResumo] = useState<ResumoImportacao | null>(null)
  const [mensagem, setMensagem] = useState<{ tipo: 'erro' | 'sucesso' | 'atencao'; texto: string } | null>(null)

  async function aoEscolher(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return
    setLendo(true)
    setMensagem(null)
    const r = await importarArquivo(arquivo)
    setLendo(false)
    if (r.erro !== null) return setMensagem({ tipo: 'erro', texto: r.erro })
    setResumo(r.dados)
    recarregar()
  }

  if (carregando) return <Carregando />
  if (erro || !dados) return <ErroComAcao erro={erro ?? ''} tentarDeNovo={recarregar} />

  const [primeiro, ...resto] = dados.rascunhos

  return (
    <>
      <div className="cabecalho-tela">
        <h1>Importar do MT5</h1>
        <Link to="/trade">Voltar para o trade</Link>
      </div>

      <section className="painel">
        <div className="campo">
          <label htmlFor="relatorio-mt5">Relatório de histórico do MT5 (HTML)</label>
          <input id="relatorio-mt5" type="file" accept=".htm,.html,text/html" onChange={aoEscolher} disabled={lendo} />
          <p className="pequeno mut">No MT5: aba Histórico, botão direito, Relatório, HTML. Reimportar o mesmo arquivo não duplica nada.</p>
        </div>
        {lendo && <Carregando texto="Lendo o relatório..." />}
        {resumo && (
          <Aviso tipo={resumo.lidas === 0 ? 'erro' : 'sucesso'}>
            {resumo.lidas === 0
              ? 'Nenhuma posição lida.'
              : `${resumo.lidas} posições lidas: ${resumo.novas} novas, ${resumo.jaImportadas} já importadas antes.`}
            {resumo.avisos.map((a) => (
              <div key={a} className="pequeno">{a}</div>
            ))}
          </Aviso>
        )}
      </section>

      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}

      {!primeiro ? (
        <EstadoVazio mensagem="Nenhuma operação aguardando. Escolha o relatório do MT5 para importar." />
      ) : (
        <div className="trade-colunas">
          <CompletarContexto
            key={primeiro.id}
            rascunho={primeiro}
            setups={dados.setups}
            aoConfirmar={(violacao) => {
              setMensagem(
                violacao
                  ? { tipo: 'atencao', texto: 'Operação importada como violação de trava: o período estava fechado naquele momento.' }
                  : { tipo: 'sucesso', texto: 'Operação importada.' },
              )
              recarregar()
            }}
            aoErro={(texto) => setMensagem({ tipo: 'erro', texto })}
            aoDescartar={async () => {
              const r = await descartarRascunho(primeiro.id)
              if (r.erro !== null) setMensagem({ tipo: 'erro', texto: r.erro })
              else recarregar()
            }}
          />
          <section className="painel">
            <h2>Na fila ({resto.length})</h2>
            {resto.length === 0 ? (
              <p className="mut">Esta é a última.</p>
            ) : (
              <table>
                <tbody>
                  {resto.map((r) => (
                    <tr key={r.id}>
                      <td className="num">{quando(r.dados.abertaEm)}</td>
                      <td>
                        {r.dados.ativo} <span className="mut pequeno">{r.dados.direcao} × {r.dados.volume}</span>
                      </td>
                      <td className="num"><Dinheiro centavos={r.dados.lucroBrutoCentavos} semantico /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="pequeno mut">As operações entram na ordem em que aconteceram, porque as travas do dia dependem dessa ordem.</p>
          </section>
        </div>
      )}
    </>
  )
}

function CompletarContexto({
  rascunho,
  setups,
  aoConfirmar,
  aoErro,
  aoDescartar,
}: {
  rascunho: RascunhoMt5
  setups: Setup[]
  aoConfirmar: (violacao: boolean) => void
  aoErro: (texto: string) => void
  aoDescartar: () => void
}) {
  const p = rascunho.dados
  const [setupId, setSetupId] = useState('')
  const [tDiario, setTDiario] = useState<Tendencia | ''>('')
  const [tH1, setTH1] = useState<Tendencia | ''>('')
  const [tH4, setTH4] = useState<Tendencia | ''>('')
  const [timeframe, setTimeframe] = useState<Timeframe | ''>('')
  const [teveNoticia, setTeveNoticia] = useState(false)
  const [noticia, setNoticia] = useState('')
  const [seguiu, setSeguiu] = useState(true)
  const [observacao, setObservacao] = useState('')
  const [stop, setStop] = useState('')
  const [alvo, setAlvo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const conferencia = conferirLucro(p)

  async function aoEnviar(e: FormEvent) {
    e.preventDefault()
    const contexto: ContextoImportacao = {
      setup_id: setupId,
      tendencia_diario: tDiario,
      tendencia_h1: tH1,
      tendencia_h4: tH4,
      timeframe_entrada: timeframe,
      teve_noticia: teveNoticia,
      noticia_descricao: noticia,
      seguiu_plano: seguiu,
      observacao,
      stop: p.stop === null ? paraPreco(stop) : null,
      alvo: p.alvo === null ? paraPreco(alvo) : null,
    }
    setEnviando(true)
    const r = await confirmarRascunho(rascunho.id, contexto)
    setEnviando(false)
    if (r.erro !== null) return aoErro(r.erro)
    aoConfirmar(r.dados.violacao)
  }

  return (
    <form className="painel" onSubmit={aoEnviar}>
      <h2>
        {p.ativo} {p.direcao} × {p.volume}
      </h2>
      <p className="pequeno mut" style={{ fontVariantNumeric: 'tabular-nums' }}>
        Abertura {quando(p.abertaEm)}, entrada {p.precoEntrada.toLocaleString('pt-BR')}; fechamento {quando(p.fechadaEm)}, saída{' '}
        {p.precoSaida.toLocaleString('pt-BR')}. Stop {p.stop?.toLocaleString('pt-BR') ?? 'não informado'}, alvo {p.alvo?.toLocaleString('pt-BR') ?? 'não informado'}.
      </p>
      <p>
        Lucro no MT5: <Dinheiro centavos={p.lucroBrutoCentavos} semantico />, custos <Dinheiro centavos={p.custosCentavos} />.
      </p>
      {conferencia.diferencaCentavos !== 0 && (
        <Aviso>
          O lucro do MT5 difere do calculado pelos preços (<Dinheiro centavos={conferencia.calculadoCentavos} semantico />). O diário usa o calculado pelo multiplicador
          (T-03); confira o contrato antes de confirmar.
        </Aviso>
      )}

      {(p.stop === null || p.alvo === null) && (
        <div className="linha-campos">
          {p.stop === null && <Preco id="imp-stop" rotulo="Stop (o relatório não trouxe)" texto={stop} aoMudar={setStop} />}
          {p.alvo === null && <Preco id="imp-alvo" rotulo="Alvo (o relatório não trouxe)" texto={alvo} aoMudar={setAlvo} />}
        </div>
      )}
      <div className="campo">
        <label htmlFor="imp-setup">Setup</label>
        <select id="imp-setup" value={setupId} onChange={(e) => setSetupId(e.target.value)}>
          <option value="">Escolha</option>
          {setups.filter((s) => s.ativo).map((s) => (
            <option key={s.id} value={s.id}>{s.nome}</option>
          ))}
        </select>
      </div>
      <Opcoes rotulo="Tendência no diário" valor={tDiario} opcoes={TENDENCIAS} aoMudar={setTDiario} />
      <Opcoes rotulo="Tendência no H1" valor={tH1} opcoes={TENDENCIAS} aoMudar={setTH1} />
      <Opcoes rotulo="Tendência no H4" valor={tH4} opcoes={TENDENCIAS} aoMudar={setTH4} />
      <Opcoes rotulo="Timeframe de entrada" valor={timeframe} opcoes={[['15s', '15s'], ['5m', '5m'], ['15m', '15m']]} aoMudar={setTimeframe} />
      <label className="marcar">
        <input type="checkbox" checked={teveNoticia} onChange={(e) => setTeveNoticia(e.target.checked)} />
        Teve notícia relevante
      </label>
      {teveNoticia && (
        <div className="campo">
          <label htmlFor="imp-noticia">Qual notícia</label>
          <input id="imp-noticia" maxLength={500} value={noticia} onChange={(e) => setNoticia(e.target.value)} />
        </div>
      )}
      <label className="marcar">
        <input type="checkbox" checked={seguiu} onChange={(e) => setSeguiu(e.target.checked)} />
        Seguiu o plano
      </label>
      <div className="campo">
        <label htmlFor="imp-obs">Observação (opcional)</label>
        <input id="imp-obs" maxLength={1000} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
      </div>
      <div className="acoes">
        <button className="botao" disabled={enviando}>
          {enviando ? 'Gravando...' : 'Confirmar operação'}
        </button>
        <button type="button" className="botao perigo" onClick={aoDescartar} disabled={enviando}>
          Descartar
        </button>
      </div>
    </form>
  )
}
