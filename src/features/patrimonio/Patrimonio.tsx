import { useState, type FormEvent } from 'react'
import { useCarregar } from '../../lib/useCarregar'
import { arquivarAtivo, criarAtivo, listarMovimentos, registrarMovimento, saldos } from '../../lib/services/patrimonioService'
import { historico } from '../../lib/services/fechamentoService'
import { carregarDadosDoMes } from '../dadosDoMes'
import { metaReserva, distribuirSobra } from '../../lib/calculos/reserva'
import { resumoCarteira, LIMITE_CAPITAL_TRADE } from '../../lib/calculos/patrimonio'
import { metaAporteMes } from '../../lib/calculos/metas'
import { dataEmSaoPaulo } from '../../lib/calculos/datas'
import { ok } from '../../lib/services/resultado'
import { NOMES_CLASSE, NOMES_MOVIMENTO, type ClasseAtivo, type TipoMovimento } from '../../lib/tipos'
import { Aviso, BarraMeta, Carregando, Dinheiro, ErroComAcao, EstadoVazio } from '../../componentes/Basicos'
import { CampoValor } from '../../componentes/Campos'

/** P-01 a P-04: carteira por classe, reserva em primeiro lugar, saldo sempre como soma de movimentos. */
export function Patrimonio() {
  const { dados, erro, carregando, recarregar } = useCarregar(async () => {
    const [s, m, f, mes] = await Promise.all([saldos(), listarMovimentos(), historico(), carregarDadosDoMes()])
    if (s.erro !== null) return s
    if (m.erro !== null) return m
    if (f.erro !== null) return f
    if (mes.erro !== null) return mes
    return ok({ saldos: s.dados, movimentos: m.dados, fechamentos: f.dados, mes: mes.dados })
  }, [])
  const [mensagem, setMensagem] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null)

  if (carregando) return <Carregando />
  if (erro || !dados) return <ErroComAcao erro={erro ?? ''} tentarDeNovo={recarregar} />

  const ativos = dados.saldos.filter((a) => a.ativo)
  const meta = metaReserva({ despesasMesesFechadosCentavos: dados.fechamentos.map((f) => f.gasto_real), orcamentoMensalCentavos: dados.mes.orcadoTotal })
  const resumo = resumoCarteira(ativos, meta)
  const sobra = metaAporteMes({ rendaCentavos: dados.mes.orcamento.mes.renda_prevista_centavos, metaGastoCentavos: dados.mes.orcadoTotal })
  const destino = distribuirSobra({ sobraCentavos: sobra, faltaReservaCentavos: resumo.faltaReservaCentavos })
  const classes = (Object.keys(NOMES_CLASSE) as ClasseAtivo[]).filter((c) => resumo.porClasse[c] !== 0)

  return (
    <>
      <div className="cabecalho-tela">
        <h1>Patrimônio</h1>
        <p className="destaque num">
          <Dinheiro centavos={resumo.totalCentavos} />
        </p>
      </div>
      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}
      {resumo.capitalTradeAcimaDoLimite && (
        <Aviso tipo="erro">
          Capital de trade em {(resumo.pctCapitalTrade * 100).toFixed(1).replace('.', ',')}% do patrimônio. O limite é {LIMITE_CAPITAL_TRADE * 100}% (P-04).
        </Aviso>
      )}

      <div className="grade">
        <section className="painel">
          <h2>Reserva de emergência (P-03)</h2>
          <BarraMeta realCentavos={resumo.porClasse.reserva} metaCentavos={meta} rotulo="Reserva contra a meta" sentido="objetivo" />
          <p className="mut pequeno">
            Meta = 6 × média das despesas dos últimos 3 meses fechados
            {dados.fechamentos.length === 0 ? ' (sem fechamento ainda: usa o orçamento do mês)' : ''}.
          </p>
        </section>
        <section className="painel">
          <h2>Para onde vai a sobra deste mês (P-01)</h2>
          <table>
            <tbody>
              <tr>
                <td>Sobra prevista</td>
                <td className="num">
                  <Dinheiro centavos={sobra} />
                </td>
              </tr>
              <tr>
                <td>1. Reserva de emergência</td>
                <td className="num">
                  <Dinheiro centavos={destino.reservaCentavos} />
                </td>
              </tr>
              <tr>
                <td>2. Aporte de longo prazo</td>
                <td className="num">
                  <Dinheiro centavos={destino.longoPrazoCentavos} />
                </td>
              </tr>
              <tr>
                <td>3. Capital de trade</td>
                <td className={resumo.reservaCompleta ? 'num mut' : 'direita mut pequeno'}>{resumo.reservaCompleta ? 'Fase 2' : 'Bloqueado até a reserva completa (P-02)'}</td>
              </tr>
            </tbody>
          </table>
        </section>
        <section className="painel">
          <h2>Por classe</h2>
          {classes.length === 0 ? (
            <p className="mut">Sem saldo ainda.</p>
          ) : (
            <table>
              <tbody>
                {classes.map((c) => (
                  <tr key={c}>
                    <td>{NOMES_CLASSE[c]}</td>
                    <td className="num">
                      <Dinheiro centavos={resumo.porClasse[c]} />
                    </td>
                    <td className="num mut">{resumo.totalCentavos > 0 ? `${Math.round((resumo.porClasse[c] / resumo.totalCentavos) * 100)}%` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <div className="grade">
        <NovoMovimento ativos={ativos} reservaCompleta={resumo.reservaCompleta} aoSalvar={(t) => { setMensagem({ tipo: 'sucesso', texto: t }); recarregar() }} aoErro={(t) => setMensagem({ tipo: 'erro', texto: t })} />
        <NovoAtivo aoSalvar={() => { setMensagem({ tipo: 'sucesso', texto: 'Ativo criado.' }); recarregar() }} aoErro={(t) => setMensagem({ tipo: 'erro', texto: t })} />
      </div>

      <section className="painel">
        <h2>Ativos</h2>
        {dados.saldos.length === 0 ? (
          <EstadoVazio mensagem="Cadastre o primeiro ativo, começando pela reserva de emergência." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Ativo</th>
                <th>Classe</th>
                <th className="num">Saldo</th>
                <th><span className="so-leitor">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {dados.saldos.map((a) => (
                <tr key={a.ativo_id} className={a.ativo ? '' : 'mut'}>
                  <td>
                    {a.nome}
                    {a.instituicao && <div className="mut pequeno">{a.instituicao}</div>}
                  </td>
                  <td>{NOMES_CLASSE[a.classe]}</td>
                  <td className="num">
                    <Dinheiro centavos={a.saldo_centavos} />
                  </td>
                  <td className="direita">
                    <button
                      type="button"
                      className="botao secundario"
                      onClick={async () => {
                        const r = await arquivarAtivo(a.ativo_id, !a.ativo)
                        if (r.erro !== null) setMensagem({ tipo: 'erro', texto: r.erro })
                        else recarregar()
                      }}
                    >
                      {a.ativo ? 'Arquivar' : 'Reativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {dados.movimentos.length > 0 && (
        <section className="painel">
          <h2>Movimentos</h2>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Ativo</th>
                <th>Tipo</th>
                <th className="num">Valor</th>
              </tr>
            </thead>
            <tbody>
              {dados.movimentos.slice(0, 50).map((m) => (
                <tr key={m.id}>
                  <td className="num">{m.data.split('-').reverse().join('/')}</td>
                  <td>{dados.saldos.find((a) => a.ativo_id === m.ativo_id)?.nome}</td>
                  <td>{NOMES_MOVIMENTO[m.tipo]}</td>
                  <td className="num">
                    <Dinheiro centavos={m.valor_centavos} semantico />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mut pequeno">Movimentos não são editados. Para corrigir, registre um ajuste de saldo.</p>
        </section>
      )}
    </>
  )
}

function NovoMovimento({
  ativos,
  reservaCompleta,
  aoSalvar,
  aoErro,
}: {
  ativos: { ativo_id: string; nome: string; classe: ClasseAtivo }[]
  reservaCompleta: boolean
  aoSalvar: (t: string) => void
  aoErro: (t: string) => void
}) {
  const [ativoId, setAtivoId] = useState('')
  const [tipo, setTipo] = useState<TipoMovimento>('aporte')
  const [valor, setValor] = useState<number | null>(null)
  const [negativo, setNegativo] = useState(false)
  const [data, setData] = useState(() => dataEmSaoPaulo())
  const [chave, setChave] = useState(0)

  const ativo = ativos.find((a) => a.ativo_id === ativoId)
  // P-02: dinheiro novo para capital de trade só com a reserva completa
  const bloqueadoP02 = ativo?.classe === 'capital_trade' && tipo === 'aporte' && !reservaCompleta

  async function aoEnviar(e: FormEvent) {
    e.preventDefault()
    if (bloqueadoP02) return aoErro('Complete a reserva de emergência antes de colocar dinheiro no capital de trade (P-02).')
    if (valor === null) return aoErro('Digite o valor.')
    const r = await registrarMovimento({ ativoId, data, tipo, valorCentavos: valor, negativo })
    if (r.erro !== null) return aoErro(r.erro)
    setValor(null)
    setChave((c) => c + 1)
    aoSalvar('Movimento registrado.')
  }

  if (ativos.length === 0) return null

  return (
    <form className="painel" onSubmit={aoEnviar}>
      <h2>Registrar movimento</h2>
      <div className="linha-campos">
        <div className="campo">
          <label htmlFor="mov-ativo">Ativo</label>
          <select id="mov-ativo" required value={ativoId} onChange={(e) => setAtivoId(e.target.value)}>
            <option value="">Escolha</option>
            {ativos.map((a) => (
              <option key={a.ativo_id} value={a.ativo_id}>
                {a.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="mov-tipo">Tipo</label>
          <select id="mov-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovimento)}>
            {Object.entries(NOMES_MOVIMENTO).map(([v, n]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="mov-data">Data</label>
          <input id="mov-data" type="date" required value={data} onChange={(e) => setData(e.target.value)} />
        </div>
      </div>
      <CampoValor key={chave} rotulo="Valor" valorCentavos={valor} aoMudar={setValor} />
      {(tipo === 'rendimento' || tipo === 'ajuste_saldo') && (
        <label className="marcar">
          <input type="checkbox" checked={negativo} onChange={(e) => setNegativo(e.target.checked)} />
          Valor negativo (perda ou correção para baixo)
        </label>
      )}
      {bloqueadoP02 && <Aviso tipo="erro">Complete a reserva antes de colocar dinheiro no capital de trade (P-02).</Aviso>}
      <button className="botao" disabled={!ativoId || valor === null || bloqueadoP02}>
        Registrar
      </button>
    </form>
  )
}

function NovoAtivo({ aoSalvar, aoErro }: { aoSalvar: () => void; aoErro: (t: string) => void }) {
  const [nome, setNome] = useState('')
  const [classe, setClasse] = useState<ClasseAtivo>('reserva')
  const [instituicao, setInstituicao] = useState('')
  return (
    <form
      className="painel"
      onSubmit={async (e) => {
        e.preventDefault()
        const r = await criarAtivo({ nome, classe, instituicao })
        if (r.erro !== null) return aoErro(r.erro)
        setNome('')
        setInstituicao('')
        aoSalvar()
      }}
    >
      <h2>Novo ativo</h2>
      <div className="campo">
        <label htmlFor="ativo-nome">Nome</label>
        <input id="ativo-nome" maxLength={60} required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: CDB liquidez diária" />
      </div>
      <div className="linha-campos">
        <div className="campo">
          <label htmlFor="ativo-classe">Classe</label>
          <select id="ativo-classe" value={classe} onChange={(e) => setClasse(e.target.value as ClasseAtivo)}>
            {Object.entries(NOMES_CLASSE).map(([v, n]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="ativo-inst">Instituição (opcional)</label>
          <input id="ativo-inst" maxLength={60} value={instituicao} onChange={(e) => setInstituicao(e.target.value)} />
        </div>
      </div>
      <p className="mut pequeno">Sem número de conta, senha ou dado bancário. Só o nome para você reconhecer.</p>
      <button className="botao" disabled={!nome.trim()}>
        Criar ativo
      </button>
    </form>
  )
}
