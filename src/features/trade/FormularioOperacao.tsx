import { useState, type FormEvent } from 'react'
import { mercadoDoAtivo, paraPreco, riscoCentavos, PCT_RISCO_MAXIMO, type Direcao, type Mercado, type Tendencia, type Timeframe, type PlanoOperacao } from '../../lib/calculos/trade'
import { registrarOperacao, registrarViolacao } from '../../lib/services/tradeService'
import { paraCentavos } from '../../lib/calculos/dinheiro'
import type { Setup } from '../../lib/tipos'
import { Aviso, Dinheiro } from '../../componentes/Basicos'

export function Opcoes<T extends string>({ rotulo, valor, opcoes, aoMudar }: { rotulo: string; valor: T | ''; opcoes: [T, string][]; aoMudar: (v: T) => void }) {
  return (
    <div className="grupo-campo" role="group" aria-label={rotulo}>
      <span>{rotulo}</span>
      <div className="opcoes">
        {opcoes.map(([v, n]) => (
          <button key={v} type="button" aria-pressed={valor === v} onClick={() => aoMudar(v)}>
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

export const TENDENCIAS: [Tendencia, string][] = [['alta', 'Alta'], ['baixa', 'Baixa'], ['lateral', 'Lateral']]

export function Preco({ id, rotulo, texto, aoMudar }: { id: string; rotulo: string; texto: string; aoMudar: (t: string) => void }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      <input id={id} inputMode="decimal" autoComplete="off" value={texto} onChange={(e) => aoMudar(e.target.value.replace(/[^\d.,]/g, ''))} aria-invalid={texto !== '' && paraPreco(texto) === null} />
    </div>
  )
}

/**
 * Registro de operação (docs/05_FLUXOS). modo 'planejada' passa pela trava e por T-04;
 * modo 'violacao' registra o que já foi executado com o período fechado (TR-03).
 */
export function FormularioOperacao({
  modo,
  setups,
  capitalCentavos,
  revisaoHojeId,
  aoSalvar,
}: {
  modo: 'planejada' | 'violacao'
  setups: Setup[]
  capitalCentavos: number
  /** IA-05: revisão de notícias ok de hoje, se houver */
  revisaoHojeId: string | null
  aoSalvar: (texto: string) => void
}) {
  const [ativo, setAtivo] = useState('')
  const [mercado, setMercado] = useState<Mercado>('mini_indice')
  const [direcao, setDirecao] = useState<Direcao | ''>('')
  const [quantidade, setQuantidade] = useState('1')
  const [entrada, setEntrada] = useState('')
  const [stop, setStop] = useState('')
  const [alvo, setAlvo] = useState('')
  const [saida, setSaida] = useState('')
  const [custos, setCustos] = useState('')
  const [setupId, setSetupId] = useState('')
  const [tDiario, setTDiario] = useState<Tendencia | ''>('')
  const [tH1, setTH1] = useState<Tendencia | ''>('')
  const [tH4, setTH4] = useState<Tendencia | ''>('')
  const [timeframe, setTimeframe] = useState<Timeframe | ''>('')
  const [teveNoticia, setTeveNoticia] = useState(false)
  const [noticia, setNoticia] = useState('')
  const [observacao, setObservacao] = useState('')
  const [confirmado, setConfirmado] = useState(false)
  const [vincularRevisao, setVincularRevisao] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const pEntrada = paraPreco(entrada)
  const pStop = paraPreco(stop)
  const qtd = Number(quantidade)
  const risco = pEntrada && pStop && Number.isInteger(qtd) && qtd > 0 ? riscoCentavos({ mercado, entrada: pEntrada, stop: pStop, quantidade: qtd }) : null
  const pctCapital = risco !== null && capitalCentavos > 0 ? risco / capitalCentavos : null
  const acimaDoLimite = pctCapital !== null && pctCapital > PCT_RISCO_MAXIMO

  async function aoEnviar(e: FormEvent) {
    e.preventDefault()
    if (!direcao) return setErro('Escolha compra ou venda.')
    const plano: PlanoOperacao & { ativo: string; revisaoNoticiasId: string | null } = {
      ativo,
      mercado,
      direcao,
      entrada: pEntrada ?? NaN,
      stop: pStop ?? NaN,
      alvo: paraPreco(alvo) ?? NaN,
      quantidade: qtd,
      capitalCentavos,
      setupId,
      tendenciaDiario: tDiario,
      tendenciaH1: tH1,
      tendenciaH4: tH4,
      timeframeEntrada: timeframe,
      teveNoticia,
      noticiaDescricao: noticia,
      revisaoNoticiasId: revisaoHojeId && vincularRevisao ? revisaoHojeId : null,
    }
    setEnviando(true)
    setErro(null)
    const r =
      modo === 'planejada'
        ? await registrarOperacao(plano)
        : await registrarViolacao({ ...plano, saida: paraPreco(saida) ?? NaN, custosCentavos: custos ? (paraCentavos(custos) ?? -1) : 0, observacao })
    setEnviando(false)
    if (r.erro !== null) return setErro(r.erro)
    setEntrada('')
    setStop('')
    setAlvo('')
    setSaida('')
    setCustos('')
    setObservacao('')
    setConfirmado(false)
    aoSalvar(modo === 'planejada' ? 'Operação planejada registrada. Ao sair, registre a saída.' : 'Violação registrada. Ela aparece nas estatísticas e no fechamento.')
  }

  const ativos = setups.filter((s) => s.ativo)

  return (
    <form className="painel" onSubmit={aoEnviar}>
      <h2>{modo === 'planejada' ? 'Planejar operação' : 'Registrar operação já executada (violação)'}</h2>
      {modo === 'violacao' && (
        <Aviso tipo="erro">Use só se você operou na corretora com o período fechado. A operação entra marcada como violação de trava e nunca é escondida.</Aviso>
      )}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <div className="linha-campos">
        <div className="campo">
          <label htmlFor={`${modo}-ativo`}>Ativo</label>
          <input
            id={`${modo}-ativo`}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="WINZ26, PETR4"
            maxLength={12}
            value={ativo}
            onChange={(e) => {
              const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
              setAtivo(v)
              if (v.length >= 3) setMercado(mercadoDoAtivo(v))
            }}
          />
        </div>
        <div className="campo">
          <label htmlFor={`${modo}-qtd`}>{mercado === 'mini_indice' ? 'Contratos' : 'Quantidade'}</label>
          <input id={`${modo}-qtd`} inputMode="numeric" value={quantidade} onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, ''))} />
        </div>
      </div>
      <Opcoes rotulo="Mercado" valor={mercado} opcoes={[['mini_indice', 'Mini-índice'], ['acoes', 'Ações']]} aoMudar={setMercado} />
      <Opcoes rotulo="Direção" valor={direcao} opcoes={[['compra', 'Compra'], ['venda', 'Venda']]} aoMudar={setDirecao} />
      <div className="linha-campos">
        <Preco id={`${modo}-entrada`} rotulo="Entrada" texto={entrada} aoMudar={setEntrada} />
        <Preco id={`${modo}-stop`} rotulo="Stop" texto={stop} aoMudar={setStop} />
        <Preco id={`${modo}-alvo`} rotulo="Alvo" texto={alvo} aoMudar={setAlvo} />
      </div>

      {risco !== null && (
        <p className={`risco-ao-vivo ${acimaDoLimite && modo === 'planejada' ? 'bad' : ''}`}>
          Risco: <Dinheiro centavos={risco} /> ({((pctCapital ?? 0) * 100).toFixed(2).replace('.', ',')}% do capital de <Dinheiro centavos={capitalCentavos} />)
          {acimaDoLimite && modo === 'planejada' && <>. Acima de 1%: o registro será recusado (T-04).</>}
          <span className="mut pequeno"> Multiplicador {mercado === 'mini_indice' ? 'R$ 0,20 por ponto por contrato' : '1'} (T-03).</span>
        </p>
      )}

      <div className="campo">
        <label htmlFor={`${modo}-setup`}>Setup</label>
        <select id={`${modo}-setup`} value={setupId} onChange={(e) => setSetupId(e.target.value)}>
          <option value="">Escolha</option>
          {ativos.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
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
      {revisaoHojeId && (
        <label className="marcar">
          <input type="checkbox" checked={vincularRevisao} onChange={(e) => setVincularRevisao(e.target.checked)} />
          Li a revisão de notícias de hoje (vincular à operação)
        </label>
      )}
      {teveNoticia && (
        <div className="campo">
          <label htmlFor={`${modo}-noticia`}>Qual notícia</label>
          <input id={`${modo}-noticia`} maxLength={500} value={noticia} onChange={(e) => setNoticia(e.target.value)} />
        </div>
      )}

      {modo === 'violacao' && (
        <>
          <div className="linha-campos">
            <Preco id="violacao-saida" rotulo="Saída" texto={saida} aoMudar={setSaida} />
            <div className="campo">
              <label htmlFor="violacao-custos">Custos (R$)</label>
              <input id="violacao-custos" inputMode="decimal" placeholder="0,00" value={custos} onChange={(e) => setCustos(e.target.value.replace(/[^\d.,]/g, ''))} />
            </div>
          </div>
          <div className="campo">
            <label htmlFor="violacao-obs">Por que operou com o período fechado</label>
            <input id="violacao-obs" maxLength={1000} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
          <label className="marcar">
            <input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} />
            Confirmo que operei com o período fechado
          </label>
        </>
      )}

      <button className={`botao ${modo === 'violacao' ? 'perigo' : ''}`} disabled={enviando || (modo === 'violacao' && !confirmado)}>
        {enviando ? 'Registrando...' : modo === 'planejada' ? 'Registrar operação' : 'Registrar violação'}
      </button>
    </form>
  )
}
