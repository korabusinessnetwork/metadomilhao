import { useState } from 'react'
import { useCarregar } from '../../lib/useCarregar'
import { carregarDadosDoMes } from '../dadosDoMes'
import { atualizarCategoria, atualizarItem, atualizarRendaPrevista, criarCategoria, quantidadeMudancasAposDia5 } from '../../lib/services/orcamentoService'
import { ajusteLivre } from '../../lib/calculos/orcamento'
import { dataEmSaoPaulo, inicioDoMes, somarMeses } from '../../lib/calculos/datas'
import { metaAporteMes, metaGastoMes } from '../../lib/calculos/metas'
import { ok } from '../../lib/services/resultado'
import type { Categoria, TipoCategoria } from '../../lib/tipos'
import { Aviso, Carregando, Dinheiro, ErroComAcao } from '../../componentes/Basicos'
import { CampoValor } from '../../componentes/Campos'

function nomeDoMes(mes: string) {
  return new Date(`${mes}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

/** O-01 e O-02: valores por categoria e renda prevista do mês. */
export function Orcamento() {
  const [mes, setMes] = useState(() => inicioDoMes(dataEmSaoPaulo()))
  const { dados, erro, carregando, recarregar } = useCarregar(async () => {
    const d = await carregarDadosDoMes(mes)
    if (d.erro !== null) return d
    const mudancas = await quantidadeMudancasAposDia5(d.dados.orcamento.mes.id)
    if (mudancas.erro !== null) return mudancas
    return ok({ ...d.dados, mudancas: mudancas.dados })
  }, [mes])
  const [mensagem, setMensagem] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null)

  if (carregando) return <Carregando />
  if (erro || !dados) return <ErroComAcao erro={erro ?? ''} tentarDeNovo={recarregar} />

  const livre = ajusteLivre(mes, dados.hoje)
  const valorDe = (c: Categoria) => dados.orcamento.itens.find((i) => i.categoria_id === c.id)?.valor_centavos ?? 0
  const metaGasto = metaGastoMes(dados.orcamento.itens.map((i) => i.valor_centavos))
  const sobraPrevista = metaAporteMes({ rendaCentavos: dados.orcamento.mes.renda_prevista_centavos, metaGastoCentavos: metaGasto })
  const ativas = dados.categorias.filter((c) => c.ativa)
  const inativas = dados.categorias.filter((c) => !c.ativa)

  async function salvarValor(c: Categoria, centavos: number | null) {
    if (centavos === null || !dados) return
    const r = await atualizarItem(dados.orcamento.mes.id, c.id, centavos)
    setMensagem(r.erro ? { tipo: 'erro', texto: r.erro } : { tipo: 'sucesso', texto: `${c.nome} atualizado.` })
    if (!r.erro) recarregar()
  }

  async function salvarRenda(centavos: number | null) {
    if (centavos === null || !dados) return
    const r = await atualizarRendaPrevista(dados.orcamento.mes.id, centavos)
    setMensagem(r.erro ? { tipo: 'erro', texto: r.erro } : { tipo: 'sucesso', texto: 'Renda prevista atualizada.' })
    if (!r.erro) recarregar()
  }

  async function alternar(c: Categoria, campo: 'ativa' | 'tipo') {
    const r = await atualizarCategoria(c.id, campo === 'ativa' ? { ativa: !c.ativa } : { tipo: c.tipo === 'fixa' ? 'variavel' : 'fixa' })
    if (r.erro !== null) setMensagem({ tipo: 'erro', texto: r.erro })
    else recarregar()
  }

  return (
    <>
      <div className="cabecalho-tela">
        <h1>Orçamento</h1>
        <div className="acoes" style={{ marginTop: 0 }}>
          <button type="button" className="botao secundario" onClick={() => setMes(somarMeses(mes, -1))} aria-label="Mês anterior">
            ‹
          </button>
          <span className="medio" style={{ alignSelf: 'center' }}>{nomeDoMes(mes)}</span>
          <button type="button" className="botao secundario" onClick={() => setMes(somarMeses(mes, 1))} aria-label="Próximo mês">
            ›
          </button>
        </div>
      </div>

      {!livre && (
        <Aviso>
          Passou do dia 5: mudanças neste mês ficam registradas no histórico (O-02).
          {dados.mudancas > 0 && ` ${dados.mudancas} mudança(s) registrada(s).`}
        </Aviso>
      )}
      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}

      <div className="grade">
        <section className="painel">
          <h2>Resumo</h2>
          <table>
            <tbody>
              <tr>
                <td>Renda prevista</td>
                <td className="num">
                  <Dinheiro centavos={dados.orcamento.mes.renda_prevista_centavos} />
                </td>
              </tr>
              <tr>
                <td>Meta de gasto (M-04)</td>
                <td className="num">
                  <Dinheiro centavos={metaGasto} />
                </td>
              </tr>
              <tr>
                <td>Meta de aporte (M-05)</td>
                <td className="num">
                  <Dinheiro centavos={sobraPrevista} />
                </td>
              </tr>
            </tbody>
          </table>
          <div style={{ marginTop: 12 }}>
            <CampoEditavel rotulo="Renda prevista do mês" centavos={dados.orcamento.mes.renda_prevista_centavos} aoSalvar={salvarRenda} />
          </div>
        </section>
        <NovaCategoria ordem={dados.categorias.length} aoCriar={recarregar} aoErro={(t) => setMensagem({ tipo: 'erro', texto: t })} />
      </div>

      <section className="painel">
        <h2>Categorias</h2>
        <table>
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Tipo</th>
              <th className="num">Orçado</th>
            </tr>
          </thead>
          <tbody>
            {ativas.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.nome}
                  {c.estimativa && <div className="warn pequeno">Estimativa: sem lançamento real em 2 meses (O-03)</div>}
                  <div>
                    <button type="button" className="botao secundario pequeno" onClick={() => alternar(c, 'ativa')}>
                      Desativar
                    </button>
                  </div>
                </td>
                <td>
                  <button type="button" className="botao secundario" onClick={() => alternar(c, 'tipo')} aria-label={`Tipo de ${c.nome}: ${c.tipo === 'fixa' ? 'fixa' : 'variável'}. Trocar`}>
                    {c.tipo === 'fixa' ? 'Fixa' : 'Variável'}
                  </button>
                </td>
                <td style={{ minWidth: 140 }}>
                  <CampoEditavel rotulo={`Orçado para ${c.nome}`} centavos={valorDe(c)} aoSalvar={(v) => salvarValor(c, v)} esconderRotulo />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mut pequeno">Fixas (aluguel, contas) não entram no limite de gasto diário; são lançadas no vencimento (M-08).</p>
        {inativas.length > 0 && (
          <details>
            <summary>Categorias desativadas ({inativas.length})</summary>
            {inativas.map((c) => (
              <p key={c.id}>
                {c.nome}{' '}
                <button type="button" className="botao secundario" onClick={() => alternar(c, 'ativa')}>
                  Reativar
                </button>
              </p>
            ))}
          </details>
        )}
      </section>
    </>
  )
}

function CampoEditavel({ rotulo, centavos, aoSalvar, esconderRotulo = false }: { rotulo: string; centavos: number; aoSalvar: (c: number | null) => void; esconderRotulo?: boolean }) {
  const [valor, setValor] = useState<number | null>(centavos)
  const mudou = valor !== centavos
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        aoSalvar(valor)
      }}
      className={esconderRotulo ? 'rotulo-oculto' : ''}
    >
      <CampoValor rotulo={rotulo} valorCentavos={centavos} aoMudar={setValor} />
      {mudou && valor !== null && <button className="botao">Salvar</button>}
    </form>
  )
}

function NovaCategoria({ ordem, aoCriar, aoErro }: { ordem: number; aoCriar: () => void; aoErro: (t: string) => void }) {
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<TipoCategoria>('variavel')
  return (
    <form
      className="painel"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!nome.trim()) return
        const r = await criarCategoria({ nome: nome.trim(), tipo, ordem })
        if (r.erro !== null) aoErro(r.erro)
        else {
          setNome('')
          aoCriar()
        }
      }}
    >
      <h2>Nova categoria</h2>
      <div className="campo">
        <label htmlFor="nova-cat">Nome</label>
        <input id="nova-cat" maxLength={40} value={nome} onChange={(e) => setNome(e.target.value)} />
      </div>
      <div className="campo">
        <label htmlFor="tipo-cat">Tipo</label>
        <select id="tipo-cat" value={tipo} onChange={(e) => setTipo(e.target.value as TipoCategoria)}>
          <option value="variavel">Variável (entra no limite diário)</option>
          <option value="fixa">Fixa (lançada no vencimento)</option>
        </select>
      </div>
      <button className="botao" disabled={!nome.trim()}>
        Criar
      </button>
    </form>
  )
}
