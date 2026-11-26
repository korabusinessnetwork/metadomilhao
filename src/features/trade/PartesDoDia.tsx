import { useState } from 'react'
import { encerrarOperacao, salvarNotaDoDia } from '../../lib/services/tradeService'
import { paraPreco, resultadoBrutoCentavos } from '../../lib/calculos/trade'
import { paraCentavos } from '../../lib/calculos/dinheiro'
import { registradaDepois } from '../../lib/calculos/calendarioTrade'
import type { Operacao, Setup } from '../../lib/tipos'
import { Dinheiro } from '../../componentes/Basicos'

// Peças de um dia de trade, usadas no dia de hoje (Trade) e nos dias passados do calendário (DiaPassado).

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
              {registradaDepois(o) && <div className="pequeno mut">Registrada depois</div>}
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

export function EncerrarOperacao({ op, setups, aoSalvar, aoErro }: { op: Operacao; setups: Setup[]; aoSalvar: (t: string) => void; aoErro: (t: string) => void }) {
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

export function NotaDoDia({ data, nota, aoErro }: { data: string; nota: string; aoErro: (t: string) => void }) {
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
