import { TEXTO_MOTIVO, type MotivoTrava } from '../../lib/calculos/travas'
import './trade.css'

/** Trava ativa: faixa vermelha com motivo e reabertura. Sem botão de desbloquear (TR-05). */
export function FaixaTrava({ motivo, reabreEm }: { motivo: MotivoTrava; reabreEm: string | null }) {
  return (
    <div className="faixa-trava" role="alert">
      <strong>{TEXTO_MOTIVO[motivo]}</strong>
      {reabreEm && <span> O diário reabre em {reabreEm.split('-').reverse().join('/')}.</span>}
    </div>
  )
}
