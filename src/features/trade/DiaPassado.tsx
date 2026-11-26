import { useState } from 'react'
import { useCarregar } from '../../lib/useCarregar'
import { feriadosB3, listarOperacoes, obterNotaDoDia, statusDoDia } from '../../lib/services/tradeService'
import { podeRegistrarNoDia } from '../../lib/calculos/calendarioTrade'
import { TEXTO_MOTIVO } from '../../lib/calculos/travas'
import { ok } from '../../lib/services/resultado'
import type { Setup } from '../../lib/tipos'
import { Aviso, Carregando, Dinheiro, ErroComAcao } from '../../componentes/Basicos'
import { FormularioOperacao } from './FormularioOperacao'
import { EncerrarOperacao, NotaDoDia, TabelaOperacoes } from './PartesDoDia'

const dataLonga = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

/**
 * T-10: um dia passado no calendário. Mostra o que foi registrado e permite lançar o que ficou de fora,
 * já com a saída. A trava daquele dia decide: aberto entra normal, fechado só como violação.
 */
export function DiaPassado({
  dia,
  hoje,
  setups,
  aoSalvar,
  aoErro,
}: {
  dia: string
  hoje: string
  setups: Setup[]
  aoSalvar: (texto: string) => void
  aoErro: (texto: string) => void
}) {
  const { dados, erro, carregando, recarregar } = useCarregar(async () => {
    const [status, ops, nota, feriados] = await Promise.all([statusDoDia(dia), listarOperacoes(dia, dia), obterNotaDoDia(dia), feriadosB3()])
    if (status.erro !== null) return status
    if (ops.erro !== null) return ops
    if (nota.erro !== null) return nota
    if (feriados.erro !== null) return feriados
    return ok({ status: status.dados, ops: ops.dados, nota: nota.dados, feriados: feriados.dados })
  }, [dia])
  const [mostrarViolacao, setMostrarViolacao] = useState(false)
  const [mostrarForm, setMostrarForm] = useState(false)

  if (carregando) return <Carregando texto="Carregando o dia..." />
  if (erro || !dados) return <ErroComAcao erro={erro ?? ''} tentarDeNovo={recarregar} />

  const pode = podeRegistrarNoDia(dia, hoje, dados.feriados)
  const s = dados.status
  const encerradas = dados.ops.filter((o) => o.resultado_liquido_centavos !== null)
  const abertas = dados.ops.filter((o) => o.preco_saida === null)
  const salvou = (texto: string) => {
    setMostrarForm(false)
    setMostrarViolacao(false)
    aoSalvar(texto)
    recarregar()
  }

  return (
    <div className="trade-colunas">
      <div>
        <section className="painel">
          <h2 className="titulo-dia">{dataLonga(dia)}</h2>
          {s ? (
            <p>
              Resultado do dia: <Dinheiro centavos={s.resultado_dia_centavos} semantico className="medio" />
              <br />
              <span className="pequeno mut">
                {s.aberto ? 'O dia ficou aberto pelas travas.' : `Dia fechado: ${TEXTO_MOTIVO[s.motivo!]}`} Meta <Dinheiro centavos={s.meta_dia_centavos} />, limite de perda <Dinheiro centavos={s.perda_dia_centavos} />.
              </span>
            </p>
          ) : (
            <p className="mut">Não havia limites de trade configurados nesse dia.</p>
          )}
        </section>

        {!pode.pode ? (
          <Aviso>{pode.motivo}</Aviso>
        ) : !s ? (
          <Aviso>Sem limites vigentes nesse dia, o registro manual não entra. Operações dessa época entram pela importação do MT5.</Aviso>
        ) : s.aberto ? (
          mostrarForm ? (
            <FormularioOperacao modo="posterior" dia={dia} setups={setups} capitalCentavos={s.capital_inicio_dia_centavos} revisaoHojeId={null} aoSalvar={salvou} />
          ) : (
            <button type="button" className="botao bloco" onClick={() => setMostrarForm(true)}>
              Registrar operação deste dia
            </button>
          )
        ) : mostrarViolacao ? (
          <FormularioOperacao modo="violacao" dia={dia} setups={setups} capitalCentavos={s.capital_inicio_dia_centavos} revisaoHojeId={null} aoSalvar={salvou} />
        ) : (
          <section className="painel">
            <p>Nesse dia o diário estava fechado pela trava. O que foi operado depois disso entra como violação.</p>
            <button type="button" className="botao perigo" onClick={() => setMostrarViolacao(true)}>
              Registrar operação já executada (violação)
            </button>
          </section>
        )}
      </div>

      <div>
        {abertas.map((o) => (
          <EncerrarOperacao key={o.id} op={o} setups={setups} aoSalvar={salvou} aoErro={aoErro} />
        ))}
        <section className="painel">
          <h2>Operações do dia</h2>
          {encerradas.length === 0 ? <p className="mut">Nenhuma operação registrada nesse dia.</p> : <TabelaOperacoes ops={encerradas} setups={setups} />}
        </section>
        <NotaDoDia key={dia} data={dia} nota={dados.nota} aoErro={aoErro} />
      </div>
    </div>
  )
}
