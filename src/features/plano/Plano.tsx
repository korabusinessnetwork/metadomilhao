import { useSessao } from '../../contexto/SessaoContexto'
import { useCarregar } from '../../lib/useCarregar'
import { saldos } from '../../lib/services/patrimonioService'
import { historico } from '../../lib/services/fechamentoService'
import { premissasDoPlano } from '../../lib/calculos/plano'
import { montarCenarios, projetarSerie, taxaAnualEquivalente } from '../../lib/calculos/projecao'
import { metaAnualAporte, metaAnualPatrimonio } from '../../lib/calculos/metas'
import { dataEmSaoPaulo, inicioDoMes, somarMeses } from '../../lib/calculos/datas'
import { ok } from '../../lib/services/resultado'
import { Carregando, Dinheiro, ErroComAcao, Prazo, SeloProjecao } from '../../componentes/Basicos'
import { GraficoPatrimonio, type PontoGrafico } from '../../componentes/GraficoPatrimonio'

const pct = (t: number, casas = 2) => `${(t * 100).toFixed(casas).replace('.', ',')}%`
const rotuloMes = (mes: string) => `${mes.slice(5, 7)}/${mes.slice(2, 4)}`

/** PL-01 a PL-05 e M-01 a M-03: cenários, real × projetado e metas anuais, sempre com as premissas ao lado. */
export function Plano() {
  const { perfil, plano } = useSessao()
  const { dados, erro, carregando, recarregar } = useCarregar(async () => {
    const [s, f] = await Promise.all([saldos(), historico()])
    if (s.erro !== null) return s
    if (f.erro !== null) return f
    return ok({ saldos: s.dados, fechamentos: f.dados })
  }, [])

  if (carregando) return <Carregando />
  if (erro || !dados || !plano) return <ErroComAcao erro={erro ?? 'Plano não encontrado.'} tentarDeNovo={recarregar} />

  const hoje = dataEmSaoPaulo()
  const mesAtual = inicioDoMes(hoje)
  const premissas = premissasDoPlano(plano, perfil?.data_mudanca ?? null, hoje)
  const patrimonioAtual = dados.saldos.filter((a) => a.ativo).reduce((s, a) => s + a.saldo_centavos, 0)
  // T-09: o cenário com trade só aparece quando a regra de aumento de risco (T-08) for atendida, na Fase 2
  const cenarios = montarCenarios(
    { patrimonioInicialCentavos: patrimonioAtual, taxaRealMensal: premissas.taxaRealMensal, aporte: premissas.aporte, metaCentavos: premissas.metaCentavos },
    { tradeHabilitado: false, aporteTradeCentavos: 0 },
  )

  // M-03: a meta do ano parte do patrimônio real mais recente (último fechamento, ou o saldo de hoje)
  const ultimoFechamento = dados.fechamentos[0]
  const metaPatrimonioAno = metaAnualPatrimonio({
    mesDoPatrimonio: ultimoFechamento?.mes ?? mesAtual,
    patrimonioRealCentavos: ultimoFechamento?.patrimonio_real ?? patrimonioAtual,
    taxaRealMensal: premissas.taxaRealMensal,
    aporte: premissas.aporte,
  })
  const aportePlanejadoAno = Array.from({ length: 12 }, (_, i) => premissas.aporteNoMes(`${hoje.slice(0, 4)}-${String(i + 1).padStart(2, '0')}-01`)).reduce((s, v) => s + v, 0)

  const reais: PontoGrafico[] = [...dados.fechamentos].reverse().map((f) => ({ rotulo: rotuloMes(f.mes), centavos: f.patrimonio_real }))
  const serie = projetarSerie({ patrimonioInicialCentavos: patrimonioAtual, taxaRealMensal: premissas.taxaRealMensal, aporte: premissas.aporte, meses: 24 })
  const projetados: PontoGrafico[] = serie.map((p) => ({ rotulo: rotuloMes(somarMeses(mesAtual, p.mes)), centavos: p.patrimonioCentavos }))
  if (reais.length > 0 && reais[reais.length - 1]!.rotulo === projetados[0]!.rotulo) projetados.shift()

  return (
    <>
      <div className="cabecalho-tela">
        <h1>Plano do milhão</h1>
      </div>

      <div className="grade">
        {cenarios.map((c) => (
          <section className="painel" key={c.id}>
            <h2>Cenário {c.nome.toLowerCase()}</h2>
            <p className="medio">
              <SeloProjecao>
                <Prazo meses={c.meses} />
              </SeloProjecao>
            </p>
            <p className="mut pequeno">
              Taxa real {pct(c.taxaRealMensal)} a.m. ({pct(taxaAnualEquivalente(c.taxaRealMensal), 1)} a.a.)
            </p>
          </section>
        ))}
        <section className="painel">
          <h2>Cenário com trade</h2>
          <p className="mut">Só entra quando houver 100 operações, expectativa positiva e zero violações em 30 dias (T-08, T-09). Fase 2.</p>
        </section>
      </div>

      <section className="painel">
        <h2>Premissas</h2>
        <table>
          <tbody>
            <tr>
              <td>Patrimônio de partida (real, hoje)</td>
              <td className="num"><Dinheiro centavos={patrimonioAtual} /></td>
            </tr>
            <tr>
              <td>Meta (em dinheiro de hoje)</td>
              <td className="num"><Dinheiro centavos={premissas.metaCentavos} /></td>
            </tr>
            <tr>
              <td>Taxa real (PL-02)</td>
              <td className="num">{pct(premissas.taxaRealMensal)} a.m., {pct(taxaAnualEquivalente(premissas.taxaRealMensal), 2)} a.a.</td>
            </tr>
            <tr>
              <td>Aporte até a mudança (F-01)</td>
              <td className="num"><Dinheiro centavos={plano.aporte_atual_centavos} /></td>
            </tr>
            <tr>
              <td>Aporte após a mudança (F-02){perfil?.data_mudanca ? `, a partir de ${perfil.data_mudanca.split('-').reverse().join('/')}` : ''}</td>
              <td className="num"><Dinheiro centavos={plano.aporte_pos_mudanca_centavos} /></td>
            </tr>
          </tbody>
        </table>
        <p className="mut pequeno">Valores em dinheiro de hoje, sem inflação. Projeção matemática, não promessa de rendimento. Não é recomendação de investimento.</p>
      </section>

      <section className="painel">
        <h2>Real × projetado</h2>
        {reais.length + projetados.length >= 2 ? (
          <GraficoPatrimonio real={reais} projetado={projetados} />
        ) : (
          <p className="mut">O gráfico aparece depois do primeiro fechamento.</p>
        )}
        {dados.fechamentos.length > 0 && (
          <table style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Mês</th>
                <th className="num">Real</th>
                <th className="num">Projetado</th>
                <th className="num">Desvio</th>
              </tr>
            </thead>
            <tbody>
              {dados.fechamentos.map((f) => (
                <tr key={f.id}>
                  <td>{rotuloMes(f.mes)}</td>
                  <td className="num"><Dinheiro centavos={f.patrimonio_real} /></td>
                  <td className="num warn"><Dinheiro centavos={f.patrimonio_projetado} /></td>
                  <td className="num"><Dinheiro centavos={f.patrimonio_real - f.patrimonio_projetado} semantico /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="painel">
        <h2>Metas de {hoje.slice(0, 4)}</h2>
        <table>
          <tbody>
            <tr>
              <td>Aporte planejado no ano (M-01)</td>
              <td className="num"><Dinheiro centavos={aportePlanejadoAno} /></td>
            </tr>
            <tr>
              <td>Referência: aporte do próximo mês × 12</td>
              <td className="num"><Dinheiro centavos={metaAnualAporte(premissas.aporteDoProximoMes)} /></td>
            </tr>
            <tr>
              <td>Patrimônio em 31/12, cenário base (M-02)</td>
              <td className="num">
                <SeloProjecao><Dinheiro centavos={metaPatrimonioAno} /></SeloProjecao>
              </td>
            </tr>
          </tbody>
        </table>
        <p className="mut pequeno">Na virada do ano a meta é recalculada a partir do patrimônio real, não do projetado (M-03).</p>
      </section>
    </>
  )
}
