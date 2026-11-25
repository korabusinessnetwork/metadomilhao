import type { ReactNode } from 'react'
import { formatarCentavos } from '../lib/calculos/dinheiro'
import { formatarPrazo } from '../lib/calculos/prazo'
import './componentes.css'

/** Formata centavos em BRL. Com `semantico`, usa cor e sempre mostra o sinal (nunca só a cor). */
export function Dinheiro({ centavos, semantico = false, className = '' }: { centavos: number; semantico?: boolean; className?: string }) {
  const classe = semantico ? (centavos > 0 ? 'positivo' : centavos < 0 ? 'negativo' : '') : ''
  return <span className={`dinheiro ${classe} ${className}`}>{formatarCentavos(centavos, { sinal: semantico })}</span>
}

export function Prazo({ meses }: { meses: number | null }) {
  return <span className="num">{formatarPrazo(meses)}</span>
}

/** Todo número projetado passa por aqui. Projeção nunca se passa por realizado. */
export function SeloProjecao({ children }: { children: ReactNode }) {
  return (
    <span className="selo-projecao">
      {children}
      <span className="rotulo">projeção</span>
    </span>
  )
}

/**
 * sentido 'limite': passar da meta é ruim (gasto). sentido 'objetivo': passar é bom (reserva, aporte).
 */
export function BarraMeta({
  realCentavos,
  metaCentavos,
  rotulo,
  sentido = 'limite',
}: {
  realCentavos: number
  metaCentavos: number
  rotulo: string
  sentido?: 'limite' | 'objetivo'
}) {
  if (sentido === 'objetivo' && metaCentavos <= 0)
    return <p className="mut pequeno">Sem meta ainda: defina o orçamento do mês para calcular.</p>
  const pct = metaCentavos > 0 ? Math.min(100, (realCentavos / metaCentavos) * 100) : realCentavos > 0 ? 100 : 0
  const passou = realCentavos > metaCentavos
  const estourou = sentido === 'limite' && passou
  return (
    <div className={`barra-meta ${estourou ? 'estourou' : ''}`}>
      <div className="trilho" role="progressbar" aria-label={rotulo} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <div className="preenchido" style={{ width: `${pct}%` }} />
      </div>
      <div className="legenda">
        <span>
          <Dinheiro centavos={realCentavos} /> de <Dinheiro centavos={metaCentavos} />
        </span>
        <span className={estourou ? 'bad' : passou ? 'ok' : ''}>
          {estourou ? (
            <>passou <Dinheiro centavos={realCentavos - metaCentavos} /></>
          ) : passou || (sentido === 'objetivo' && realCentavos === metaCentavos) ? (
            'meta atingida'
          ) : (
            `${Math.round(pct)}%`
          )}
        </span>
      </div>
    </div>
  )
}

export function EstadoVazio({ mensagem, acao }: { mensagem: string; acao?: ReactNode }) {
  return (
    <div className="estado-vazio">
      <p>{mensagem}</p>
      {acao}
    </div>
  )
}

export function Carregando({ texto = 'Carregando...' }: { texto?: string }) {
  return (
    <p className="carregando" role="status">
      {texto}
    </p>
  )
}

export function Aviso({ tipo = 'atencao', children }: { tipo?: 'atencao' | 'erro' | 'sucesso'; children: ReactNode }) {
  const classe = tipo === 'erro' ? 'erro' : tipo === 'sucesso' ? 'sucesso' : ''
  return (
    <div className={`aviso ${classe}`} role={tipo === 'erro' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}

export function ErroComAcao({ erro, tentarDeNovo }: { erro: string; tentarDeNovo?: () => void }) {
  return (
    <Aviso tipo="erro">
      <p>{erro}</p>
      {tentarDeNovo && (
        <button type="button" className="botao secundario" onClick={tentarDeNovo}>
          Tentar de novo
        </button>
      )}
    </Aviso>
  )
}
