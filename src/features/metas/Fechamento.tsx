import { useState } from 'react'
import { useSessao } from '../../contexto/SessaoContexto'
import { useCarregar } from '../../lib/useCarregar'
import { confirmar, historico } from '../../lib/services/fechamentoService'
import { listarMovimentos } from '../../lib/services/patrimonioService'
import { listarMes, listarRendas } from '../../lib/services/lancamentoService'
import { listarCategorias, obterMes, atualizarCategoria } from '../../lib/services/orcamentoService'
import { prepararFechamento, patrimonioNaData } from '../../lib/calculos/fechamento'
import { categoriasEstimativa } from '../../lib/calculos/orcamento'
import { premissasDoPlano } from '../../lib/calculos/plano'
import { mesesAteMeta } from '../../lib/calculos/projecao'
import { dataEmSaoPaulo, inicioDoMes, somarMeses, ultimoDiaDoMes } from '../../lib/calculos/datas'
import { ok } from '../../lib/services/resultado'
import { Aviso, Carregando, Dinheiro, ErroComAcao, Prazo, SeloProjecao } from '../../componentes/Basicos'

function nomeDoMes(mes: string) {
  return new Date(`${mes}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

/**
 * Fechamento mensal (docs/05_FLUXOS): pré-preenche, o dono confere e confirma.
 * Grava o patrimônio real, compara com o projetado (PL-04) e recalcula o prazo (PL-05). Nunca confirma sozinho.
 */
export function Fechamento() {
  const { perfil, plano } = useSessao()
  const [mes, setMes] = useState(() => somarMeses(inicioDoMes(dataEmSaoPaulo()), -1))
  const [notas, setNotas] = useState('')
  const [mensagem, setMensagem] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null)
  const [enviando, setEnviando] = useState(false)

  const { dados, erro, carregando, recarregar } = useCarregar(async () => {
    const [lanc, rendas, movs, orc, cats, hist] = await Promise.all([listarMes(mes), listarRendas(mes), listarMovimentos(), obterMes(mes), listarCategorias(), historico()])
    if (lanc.erro !== null) return lanc
    if (rendas.erro !== null) return rendas
    if (movs.erro !== null) return movs
    if (cats.erro !== null) return cats
    if (hist.erro !== null) return hist
    // Mês sem orçamento aberto conta como orçado zero
    const itens = orc.dados?.itens ?? []
    return ok({ lancamentos: lanc.dados, rendas: rendas.dados, movimentos: movs.dados, itens, categorias: cats.dados, historico: hist.dados })
  }, [mes])

  if (carregando) return <Carregando />
  if (erro || !dados || !plano) return <ErroComAcao erro={erro ?? 'Plano não encontrado.'} tentarDeNovo={recarregar} />

  const vigente = dados.historico.find((f) => f.mes === mes) ?? null
  const anterior = dados.historico.find((f) => f.mes === somarMeses(mes, -1))
  const movimentos = dados.movimentos.map((m) => ({ data: m.data, tipo: m.tipo, valorCentavos: m.valor_centavos }))
  const patrimonioAnterior = anterior?.patrimonio_real ?? patrimonioNaData(movimentos, ultimoDiaDoMes(somarMeses(mes, -1)))
  const premissas = premissasDoPlano(plano, perfil?.data_mudanca ?? null, dataEmSaoPaulo())
  const orcadoPorCategoria = Object.fromEntries(dados.itens.map((i) => [i.categoria_id, i.valor_centavos]))

  const rascunho = prepararFechamento({
    mes,
    rendasCentavos: dados.rendas.map((r) => r.valor_centavos),
    lancamentosDoMes: dados.lancamentos.map((l) => ({ valorCentavos: l.valor_centavos, categoriaId: l.categoria_id })),
    movimentos,
    orcadoCentavos: dados.itens.reduce((s, i) => s + i.valor_centavos, 0),
    orcadoPorCategoria,
    patrimonioAnteriorCentavos: patrimonioAnterior,
    taxaRealMensal: premissas.taxaRealMensal,
    aportePlanejadoCentavos: premissas.aporteNoMes(mes),
  })
  // PL-05: prazo recalculado a partir do patrimônio real do mês fechado
  const prazo = mesesAteMeta({ patrimonioInicialCentavos: rascunho.patrimonioReal, taxaRealMensal: premissas.taxaRealMensal, aporte: premissas.aporte, metaCentavos: premissas.metaCentavos })
  const nomeCategoria = (id: string) => dados.categorias.find((c) => c.id === id)?.nome ?? ''
  const mesEmAndamento = mes >= inicioDoMes(dataEmSaoPaulo())

  async function aoConfirmar() {
    if (!dados) return
    const texto = vigente
      ? 'Este mês já foi fechado. Confirmar grava uma correção; o fechamento anterior continua no histórico.'
      : 'Confirmar o fechamento? Depois de gravado ele não é editado, só substituído por uma correção.'
    if (!window.confirm(texto)) return
    setEnviando(true)
    const r = await confirmar(mes, rascunho, notas, vigente?.id ?? null)
    if (!r.erro) {
      // O-03: marca como estimativa as categorias sem lançamento nos 2 últimos meses fechados
      const meses = [mes, somarMeses(mes, -1)]
      const porMes = await Promise.all(meses.map((m) => listarMes(m)))
      if (porMes.every((p) => p.dados) && dados.historico.some((f) => f.mes === meses[1]) ) {
        const marcar = categoriasEstimativa({
          categorias: dados.categorias.filter((c) => c.ativa).map((c) => c.id),
          ultimosMesesFechados: porMes.map((p, i) => ({ mes: meses[i]!, categoriasComLancamento: p.dados!.filter((l) => l.valor_centavos > 0).map((l) => l.categoria_id) })),
        })
        await Promise.all(dados.categorias.filter((c) => c.ativa).map((c) => atualizarCategoria(c.id, { estimativa: marcar.includes(c.id) })))
      }
    }
    setEnviando(false)
    setMensagem(r.erro ? { tipo: 'erro', texto: r.erro } : { tipo: 'sucesso', texto: 'Mês fechado. O prazo do milhão foi recalculado com o real.' })
    if (!r.erro) {
      setNotas('')
      recarregar()
    }
  }

  return (
    <>
      <div className="cabecalho-tela">
        <h1>Fechamento</h1>
        <div className="acoes" style={{ marginTop: 0 }}>
          <button type="button" className="botao secundario" onClick={() => setMes(somarMeses(mes, -1))} aria-label="Mês anterior">‹</button>
          <span className="medio" style={{ alignSelf: 'center' }}>{nomeDoMes(mes)}</span>
          <button type="button" className="botao secundario" onClick={() => setMes(somarMeses(mes, 1))} aria-label="Próximo mês">›</button>
        </div>
      </div>
      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}
      {vigente && <Aviso tipo="sucesso">Mês fechado em {new Date(vigente.criado_em).toLocaleDateString('pt-BR')}. {vigente.meta_batida ? 'Meta batida.' : 'Meta não batida.'}</Aviso>}
      {mesEmAndamento && <Aviso>Este mês ainda não terminou. O fechamento fica disponível a partir do dia 1 do mês seguinte.</Aviso>}

      <div className="grade">
        <section className="painel">
          <h2>1. Conferir o mês</h2>
          <table>
            <tbody>
              <tr><td>Renda recebida</td><td className="num"><Dinheiro centavos={rascunho.rendaReal} /></td></tr>
              <tr><td>Gasto real</td><td className="num"><Dinheiro centavos={rascunho.gastoReal} /></td></tr>
              <tr><td>Aporte real (aportes − resgates)</td><td className="num"><Dinheiro centavos={rascunho.aporteReal} /></td></tr>
              <tr><td>Meta de aporte (M-05)</td><td className="num"><Dinheiro centavos={rascunho.metaAporte} /></td></tr>
            </tbody>
          </table>
          <p className="mut pequeno">Algo faltando? Lance o gasto, a renda ou o movimento da carteira com data deste mês e volte aqui.</p>
        </section>

        <section className="painel">
          <h2>2. Patrimônio</h2>
          <table>
            <tbody>
              <tr><td>Real no fim do mês</td><td className="num"><Dinheiro centavos={rascunho.patrimonioReal} /></td></tr>
              <tr><td>Projetado para o mês (PL-04)</td><td className="num"><SeloProjecao><Dinheiro centavos={rascunho.patrimonioProjetado} /></SeloProjecao></td></tr>
              <tr><td>Desvio</td><td className="num"><Dinheiro centavos={rascunho.desvioCentavos} semantico /></td></tr>
            </tbody>
          </table>
          <p className="mut pequeno">Projetado = patrimônio real do mês anterior × (1 + taxa real) + aporte planejado.</p>
        </section>

        <section className="painel">
          <h2>3. Resultado</h2>
          <p className={`medio ${rascunho.metaBatida ? 'ok' : 'bad'}`}>{rascunho.metaBatida ? 'Meta batida' : 'Meta não batida'}</p>
          <p className="pequeno mut">Gasto real ≤ orçado e aporte real ≥ meta (M-06).</p>
          <p>
            Novo prazo até o milhão:{' '}
            <SeloProjecao><Prazo meses={prazo} /></SeloProjecao>
          </p>
          {rascunho.categoriasEstouradas.length > 0 && (
            <>
              <h3>Categorias que estouraram</h3>
              <table>
                <tbody>
                  {rascunho.categoriasEstouradas.map((c) => (
                    <tr key={c.categoriaId}>
                      <td>{nomeCategoria(c.categoriaId)}</td>
                      <td className="num bad"><Dinheiro centavos={c.realCentavos} /></td>
                      <td className="num mut">de <Dinheiro centavos={c.orcadoCentavos} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          <p className="pequeno mut">Violações de trava e IR do trade entram na Fase 2.</p>
        </section>
      </div>

      <section className="painel">
        <div className="campo">
          <label htmlFor="notas">Notas do mês (opcional)</label>
          <textarea id="notas" rows={3} maxLength={2000} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </div>
        <button type="button" className="botao" disabled={enviando || mesEmAndamento} onClick={aoConfirmar}>
          {enviando ? 'Gravando...' : vigente ? 'Gravar correção' : 'Confirmar fechamento'}
        </button>
        <p className="mut pequeno">Depois de confirmar, o orçamento do mês seguinte abre copiado deste (O-02).</p>
      </section>
    </>
  )
}
