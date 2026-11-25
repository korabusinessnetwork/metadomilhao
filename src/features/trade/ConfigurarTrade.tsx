import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useCarregar } from '../../lib/useCarregar'
import { alternarSetup, criarSetup, definirConta, listarSetups, listarTodasFechadas, obterConta, salvarParametros } from '../../lib/services/tradeService'
import { saldos } from '../../lib/services/patrimonioService'
import { avaliarAumentoRisco, desempenhoDe } from '../../lib/calculos/risco'
import { dataEmSaoPaulo, somarDias } from '../../lib/calculos/datas'
import { ok } from '../../lib/services/resultado'
import type { ParametrosTrade } from '../../lib/tipos'
import { Aviso, Carregando, Dinheiro, ErroComAcao } from '../../componentes/Basicos'
import { CampoValor } from '../../componentes/Campos'

const vigente = (ps: ParametrosTrade[], hoje: string) => [...ps].reverse().find((p) => p.vigente_desde <= hoje) ?? null

/** Conta de trade, risco por operação, limites (M-10 a M-13) e setups. */
export function ConfigurarTrade() {
  const hoje = dataEmSaoPaulo()
  const { dados, erro, carregando, recarregar } = useCarregar(async () => {
    const [conta, setups, ativos, fechadas] = await Promise.all([obterConta(), listarSetups(), saldos(), listarTodasFechadas()])
    if (conta.erro !== null) return conta
    if (setups.erro !== null) return setups
    if (ativos.erro !== null) return ativos
    if (fechadas.erro !== null) return fechadas
    return ok({ conta: conta.dados, setups: setups.dados, ativos: ativos.dados, fechadas: fechadas.dados })
  }, [])
  const [mensagem, setMensagem] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null)

  if (carregando) return <Carregando />
  if (erro || !dados) return <ErroComAcao erro={erro ?? ''} tentarDeNovo={recarregar} />

  const atual = vigente(dados.conta.parametros, hoje)
  const agendados = dados.conta.parametros.filter((p) => p.vigente_desde > hoje)
  const contas = dados.ativos.filter((a) => a.classe === 'capital_trade' && a.ativo)
  const avisar = (tipo: 'erro' | 'sucesso', texto: string) => {
    setMensagem({ tipo, texto })
    if (tipo === 'sucesso') recarregar()
  }

  return (
    <>
      <div className="cabecalho-tela">
        <h1>Configurar trade</h1>
        <Link to="/trade">Voltar para o trade</Link>
      </div>
      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}

      <div className="grade">
        <section className="painel">
          <h2>1. Conta de capital de trade</h2>
          {contas.length === 0 ? (
            <p>
              Crie um ativo da classe "Capital de trade" em <Link to="/patrimonio">Patrimônio</Link>. O dinheiro só entra nele com a reserva completa (P-02) e até 10% do patrimônio (P-04).
            </p>
          ) : (
            <div className="campo">
              <label htmlFor="conta-ativo">Ativo onde fica o capital de trade</label>
              <select
                id="conta-ativo"
                value={dados.conta.ativoId ?? ''}
                onChange={async (e) => {
                  const r = await definirConta(e.target.value)
                  avisar(r.erro !== null ? 'erro' : 'sucesso', r.erro ?? 'Conta definida.')
                }}
              >
                <option value="">Escolha</option>
                {contas.map((a) => (
                  <option key={a.ativo_id} value={a.ativo_id}>
                    {a.nome} ({(a.saldo_centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                  </option>
                ))}
              </select>
              <p className="pequeno mut">O resultado das operações entra no saldo deste ativo.</p>
            </div>
          )}
        </section>

        {dados.conta.ativoId && (
          <Parametros
            atual={atual}
            agendados={agendados}
            hoje={hoje}
            desempenho={desempenhoDe(
              dados.fechadas.map((o) => ({ data: o.data, resultadoLiquidoCentavos: o.resultado_liquido_centavos ?? 0, violacaoTrava: o.violacao_trava })),
              hoje,
            )}
            ultimoAumento={[...dados.conta.parametros].reverse().find((p) => p.aumento_risco)?.vigente_desde ?? null}
            avisar={avisar}
          />
        )}

        <section className="painel">
          <h2>3. Setups</h2>
          {dados.setups.length > 0 && (
            <table>
              <tbody>
                {dados.setups.map((s) => (
                  <tr key={s.id} className={s.ativo ? '' : 'mut'}>
                    <td>
                      {s.nome}
                      {s.descricao && <div className="pequeno mut">{s.descricao}</div>}
                    </td>
                    <td className="direita">
                      <button
                        type="button"
                        className="botao secundario"
                        onClick={async () => {
                          const r = await alternarSetup(s.id, !s.ativo)
                          avisar(r.erro !== null ? 'erro' : 'sucesso', r.erro ?? 'Setup atualizado.')
                        }}
                      >
                        {s.ativo ? 'Arquivar' : 'Reativar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <NovoSetup avisar={avisar} />
        </section>
      </div>
    </>
  )
}

function Parametros({
  atual,
  agendados,
  hoje,
  desempenho,
  ultimoAumento,
  avisar,
}: {
  atual: ParametrosTrade | null
  agendados: ParametrosTrade[]
  hoje: string
  desempenho: ReturnType<typeof desempenhoDe>
  ultimoAumento: string | null
  avisar: (tipo: 'erro' | 'sucesso', texto: string) => void
}) {
  const [risco, setRisco] = useState<number | null>(atual?.risco_operacao_centavos ?? null)
  const [gainR, setGainR] = useState(String(atual?.stop_gain_r ?? 2))
  const [lossR, setLossR] = useState(String(atual?.stop_loss_dia_r ?? 2))
  const [pctDia, setPctDia] = useState(String(atual?.pct_perda_dia ?? 2))
  const [pctSemana, setPctSemana] = useState(String(atual?.pct_perda_semana ?? 3))
  const [pctMes, setPctMes] = useState(String(atual?.pct_perda_mes ?? 8))
  const [vigencia, setVigencia] = useState(somarDias(hoje, 1))

  const aumento =
    atual && risco !== null
      ? avaliarAumentoRisco({ ...desempenho, ultimaMudancaRisco: ultimoAumento, hoje: vigencia, riscoAtualCentavos: atual.risco_operacao_centavos, riscoNovoCentavos: risco })
      : null
  const num = (t: string) => Number(t.replace(',', '.'))

  async function aoSalvar(e: FormEvent) {
    e.preventDefault()
    if (risco === null || risco <= 0) return avisar('erro', 'Informe o risco por operação.')
    if (aumento && !aumento.permitido) return avisar('erro', aumento.motivos.join(' '))
    const r = await salvarParametros({
      vigente_desde: atual ? vigencia : hoje,
      risco_operacao_centavos: risco,
      stop_gain_r: num(gainR),
      stop_loss_dia_r: num(lossR),
      pct_perda_dia: num(pctDia),
      pct_perda_semana: num(pctSemana),
      pct_perda_mes: num(pctMes),
    })
    avisar(r.erro !== null ? 'erro' : 'sucesso', r.erro ?? (atual ? `Limites novos agendados para ${vigencia.split('-').reverse().join('/')}.` : 'Limites definidos.'))
  }

  const campo = (id: string, rotulo: string, v: string, set: (t: string) => void) => (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      <input id={id} inputMode="decimal" value={v} onChange={(e) => set(e.target.value.replace(/[^\d.,]/g, ''))} />
    </div>
  )

  return (
    <form className="painel" onSubmit={aoSalvar}>
      <h2>2. Risco e limites</h2>
      {atual && (
        <p className="pequeno">
          Vigente desde {atual.vigente_desde.split('-').reverse().join('/')}: R = <Dinheiro centavos={atual.risco_operacao_centavos} />, meta {atual.stop_gain_r}R, perda do dia {atual.stop_loss_dia_r}R
          ou {atual.pct_perda_dia}%, semana {atual.pct_perda_semana}%, mês {atual.pct_perda_mes}%.
        </p>
      )}
      {agendados.map((p) => (
        <Aviso key={p.id}>
          Mudança agendada para {p.vigente_desde.split('-').reverse().join('/')}: R = <Dinheiro centavos={p.risco_operacao_centavos} />.
        </Aviso>
      ))}
      <CampoValor rotulo="Risco por operação (R)" valorCentavos={risco} aoMudar={setRisco} />
      <p className="pequeno mut">Cada operação pode arriscar no máximo 1% do capital de trade (T-04).</p>
      <div className="linha-campos">
        {campo('p-gain', 'Meta do dia (em R)', gainR, setGainR)}
        {campo('p-loss', 'Perda do dia (em R)', lossR, setLossR)}
        {campo('p-dia', 'Perda do dia (% do capital)', pctDia, setPctDia)}
        {campo('p-semana', 'Perda da semana (%)', pctSemana, setPctSemana)}
        {campo('p-mes', 'Perda do mês (%)', pctMes, setPctMes)}
      </div>
      {atual && (
        <div className="campo">
          <label htmlFor="p-vigencia">Vale a partir de</label>
          <input id="p-vigencia" type="date" min={somarDias(hoje, 1)} value={vigencia} onChange={(e) => setVigencia(e.target.value)} />
          <p className="pequeno mut">Limites nunca mudam no meio de um período (ADR-003). A mudança vale do próximo dia em diante.</p>
        </div>
      )}
      {aumento && atual && risco !== null && risco > atual.risco_operacao_centavos && (
        <Aviso tipo={aumento.permitido ? 'sucesso' : 'erro'}>
          {aumento.permitido ? 'Aumento de risco liberado (T-08).' : <>Aumento de risco bloqueado (T-08): {aumento.motivos.join(' ')}</>}
        </Aviso>
      )}
      <button className="botao">{atual ? 'Agendar mudança' : 'Definir limites'}</button>
    </form>
  )
}

function NovoSetup({ avisar }: { avisar: (tipo: 'erro' | 'sucesso', texto: string) => void }) {
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  return (
    <div style={{ marginTop: 12 }}>
      <div className="campo">
        <label htmlFor="setup-nome">Novo setup</label>
        <input id="setup-nome" maxLength={60} placeholder="Ex.: FVG de continuação" value={nome} onChange={(e) => setNome(e.target.value)} />
      </div>
      <div className="campo">
        <label htmlFor="setup-desc">Descrição (opcional)</label>
        <input id="setup-desc" maxLength={500} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </div>
      <button
        type="button"
        className="botao secundario"
        disabled={!nome.trim()}
        onClick={async () => {
          const r = await criarSetup({ nome, descricao })
          if (r.erro === null) {
            setNome('')
            setDescricao('')
          }
          avisar(r.erro !== null ? 'erro' : 'sucesso', r.erro ?? 'Setup criado.')
        }}
      >
        Criar setup
      </button>
    </div>
  )
}
