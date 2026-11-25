import { useState, type FormEvent } from 'react'
import { useCarregar } from '../../lib/useCarregar'
import {
  TETO_IA_CENTAVOS,
  adicionarWatchlist,
  alternarWatchlist,
  gerarAgora,
  historicoRevisoes,
  listarWatchlist,
  removerWatchlist,
  revisaoDoDia,
  urlSegura,
  usoDoMes,
} from '../../lib/services/noticiasService'
import { dataEmSaoPaulo, inicioDoMes } from '../../lib/calculos/datas'
import { mercadoDoAtivo, type Mercado } from '../../lib/calculos/trade'
import { ok } from '../../lib/services/resultado'
import type { RevisaoNoticias } from '../../lib/tipos'
import { Aviso, BarraMeta, Carregando, Dinheiro, ErroComAcao, EstadoVazio } from '../../componentes/Basicos'
import './noticias.css'

const RELEVANCIA: Record<string, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' }

/** Revisão do dia, histórico, watchlist e uso do teto (docs/06_COMPONENTES, ADR-004). */
export function Noticias() {
  const hoje = dataEmSaoPaulo()
  const [dataEscolhida, setDataEscolhida] = useState(hoje)
  const { dados, erro, carregando, recarregar } = useCarregar(async () => {
    const [revisao, historico, lista, uso] = await Promise.all([revisaoDoDia(dataEscolhida), historicoRevisoes(), listarWatchlist(), usoDoMes(inicioDoMes(hoje))])
    if (revisao.erro !== null) return revisao
    if (historico.erro !== null) return historico
    if (lista.erro !== null) return lista
    if (uso.erro !== null) return uso
    return ok({ revisao: revisao.dados, historico: historico.dados, lista: lista.dados, uso: uso.dados })
  }, [dataEscolhida])
  const [mensagem, setMensagem] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null)
  const [gerando, setGerando] = useState(false)

  if (carregando) return <Carregando />
  if (erro || !dados) return <ErroComAcao erro={erro ?? ''} tentarDeNovo={recarregar} />

  const gasto = dados.uso?.custo_estimado_centavos ?? 0
  const ativos = dados.lista.filter((w) => w.ativa)

  async function aoGerar() {
    if (!window.confirm('Gerar uma revisão agora? A chamada conta para o teto mensal de R$ 30.')) return
    setGerando(true)
    const r = await gerarAgora()
    setGerando(false)
    if (r.erro !== null) return setMensagem({ tipo: 'erro', texto: r.erro })
    const textos: Record<string, string> = {
      ok: 'Revisão gerada.',
      sem_orcamento: 'Teto do mês atingido: a revisão não foi gerada (IA-03).',
      erro: 'A revisão falhou. Veja o motivo abaixo.',
      sem_watchlist: 'Adicione ativos à watchlist antes.',
    }
    setMensagem({ tipo: r.dados.status === 'ok' ? 'sucesso' : 'erro', texto: textos[r.dados.status] ?? 'Pronto.' })
    setDataEscolhida(hoje)
    recarregar()
  }

  return (
    <>
      <div className="cabecalho-tela">
        <h1>Notícias</h1>
        <button type="button" className="botao secundario" onClick={aoGerar} disabled={gerando || ativos.length === 0}>
          {gerando ? 'Gerando...' : 'Gerar agora'}
        </button>
      </div>
      <Aviso>Revisão informativa gerada por IA às 8h30 nos dias de pregão. Não é recomendação de compra ou venda. Confira as fontes.</Aviso>
      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}

      <div className="trade-colunas noticias-colunas">
        <div>
          <ConteudoRevisao revisao={dados.revisao} data={dataEscolhida} ehHoje={dataEscolhida === hoje} />
        </div>
        <div>
          <section className="painel">
            <h2>Uso da IA no mês (IA-03)</h2>
            <BarraMeta realCentavos={gasto} metaCentavos={TETO_IA_CENTAVOS} rotulo="Gasto estimado com IA contra o teto" />
            <p className="pequeno mut">
              {dados.uso?.chamadas ?? 0} chamadas, {dados.uso?.buscas ?? 0} buscas. Com 80% do teto o sistema avisa; com 100%, para de chamar até o mês seguinte.
            </p>
          </section>
          <Watchlist itens={dados.lista} aoMudar={recarregar} aoErro={(t) => setMensagem({ tipo: 'erro', texto: t })} />
          <section className="painel">
            <h2>Histórico</h2>
            {dados.historico.length === 0 ? (
              <p className="mut">Nenhuma revisão ainda.</p>
            ) : (
              <table>
                <tbody>
                  {dados.historico.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <button type="button" className="link" onClick={() => setDataEscolhida(r.data)}>
                          {r.data.split('-').reverse().join('/')}
                        </button>
                        <div className="pequeno mut">{r.origem === 'manual' ? 'manual' : 'agendada'}</div>
                      </td>
                      <td className={r.status === 'ok' ? '' : 'bad'}>{r.status === 'ok' ? 'ok' : r.status === 'sem_orcamento' ? 'sem orçamento' : 'erro'}</td>
                      <td className="num"><Dinheiro centavos={r.custo_estimado_centavos} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </>
  )
}

function ConteudoRevisao({ revisao, data, ehHoje }: { revisao: RevisaoNoticias | null; data: string; ehHoje: boolean }) {
  const titulo = ehHoje ? 'Revisão de hoje' : `Revisão de ${data.split('-').reverse().join('/')}`
  if (!revisao) return <section className="painel"><h2>{titulo}</h2><EstadoVazio mensagem={ehHoje ? 'A revisão de hoje ainda não foi gerada. Ela sai às 8h30 nos dias de pregão.' : 'Sem revisão nesta data.'} /></section>
  if (revisao.status === 'sem_orcamento') return <section className="painel"><h2>{titulo}</h2><Aviso tipo="erro">Teto mensal da IA atingido. A revisão volta no mês que vem (IA-03).</Aviso></section>
  if (revisao.status === 'erro') return <section className="painel"><h2>{titulo}</h2><Aviso tipo="erro">A revisão falhou: {revisao.erro ?? 'motivo não informado'}</Aviso></section>

  return (
    <>
      <section className="painel">
        <h2>{titulo}</h2>
        {revisao.aviso_orcamento && <Aviso>O uso da IA passou de 80% do teto do mês.</Aviso>}
        {revisao.contexto_geral && <p>{revisao.contexto_geral}</p>}
        <p className="pequeno mut">
          Gerada às {new Date(revisao.gerada_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {revisao.modelo} · custo estimado <Dinheiro centavos={revisao.custo_estimado_centavos} />
        </p>
      </section>

      {(revisao.agenda ?? []).length > 0 && (
        <section className="painel">
          <h2>Agenda do dia</h2>
          <table>
            <tbody>
              {revisao.agenda!.map((a, i) => (
                <tr key={i}>
                  <td className="num">{a.hora}</td>
                  <td>{a.evento} <span className="pequeno mut">{a.pais}</span></td>
                  <td className={a.relevancia === 'alta' ? 'warn' : 'mut'}>{RELEVANCIA[a.relevancia] ?? a.relevancia}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {(revisao.conteudo ?? []).map((a) => (
        <section className="painel" key={a.ativo}>
          <h2>{a.ativo}</h2>
          {a.sem_novidades || a.noticias.length === 0 ? (
            <p className="mut">Sem novidades relevantes encontradas.</p>
          ) : (
            <ul className="lista-noticias">
              {a.noticias.map((n, i) => {
                const url = urlSegura(n.url)
                return (
                  <li key={i}>
                    <strong>{n.titulo}</strong>
                    <p>{n.resumo}</p>
                    <span className="pequeno mut">
                      Fonte:{' '}
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          {n.fonte}
                        </a>
                      ) : (
                        n.fonte
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
          {a.possivel_impacto && (
            <p className="interpretacao">
              <span className="rotulo-interpretacao">possível impacto</span> {a.possivel_impacto}
            </p>
          )}
          {a.riscos_do_dia.length > 0 && (
            <>
              <h3>Riscos do dia</h3>
              <ul>
                {a.riscos_do_dia.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      ))}
    </>
  )
}

function Watchlist({ itens, aoMudar, aoErro }: { itens: { id: string; ativo: string; mercado: Mercado; ativa: boolean }[]; aoMudar: () => void; aoErro: (t: string) => void }) {
  const [codigo, setCodigo] = useState('')
  const ativos = itens.filter((i) => i.ativa).length

  async function aoAdicionar(e: FormEvent) {
    e.preventDefault()
    const r = await adicionarWatchlist(codigo, mercadoDoAtivo(codigo))
    if (r.erro !== null) return aoErro(r.erro)
    setCodigo('')
    aoMudar()
  }

  return (
    <section className="painel">
      <h2>Watchlist ({ativos} de 10)</h2>
      {itens.length > 0 && (
        <table>
          <tbody>
            {itens.map((i) => (
              <tr key={i.id} className={i.ativa ? '' : 'mut'}>
                <td>
                  {i.ativo} <span className="pequeno mut">{i.mercado === 'mini_indice' ? 'mini-índice' : 'ações'}</span>
                </td>
                <td className="direita">
                  <button
                    type="button"
                    className="botao secundario"
                    onClick={async () => {
                      const r = await alternarWatchlist(i.id, !i.ativa)
                      if (r.erro !== null) aoErro(r.erro)
                      else aoMudar()
                    }}
                  >
                    {i.ativa ? 'Pausar' : 'Ativar'}
                  </button>{' '}
                  <button
                    type="button"
                    className="botao perigo"
                    aria-label={`Remover ${i.ativo}`}
                    onClick={async () => {
                      const r = await removerWatchlist(i.id)
                      if (r.erro !== null) aoErro(r.erro)
                      else aoMudar()
                    }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form onSubmit={aoAdicionar} className="linha-campos" style={{ marginTop: 12, alignItems: 'end' }}>
        <div className="campo">
          <label htmlFor="wl-ativo">Ativo</label>
          <input id="wl-ativo" maxLength={12} placeholder="PETR4, WIN" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
        </div>
        <div className="campo">
          <button className="botao" disabled={codigo.length < 3 || ativos >= 10}>
            Adicionar
          </button>
        </div>
      </form>
      <p className="pequeno mut">Só os códigos e a data vão para a IA. Nenhum valor seu sai do sistema.</p>
    </section>
  )
}
