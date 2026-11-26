import { TEXTO_MOTIVO, type MotivoTrava } from '../../lib/calculos/travas'
import './trade.css'

/** Trava ativa: faixa vermelha com motivo e reabertura. Sem botão de desbloquear (TR-05). */
export function FaixaTrava({ motivo, reabreEm }: { motivo: MotivoTrava; reabreEm: string | null }) {
  return (
    <div className="faixa-trava" role="alert">
      <div className="listras" aria-hidden="true" />
      <div className="corpo-trava">
        <svg className="cadeado" viewBox="0 0 44 44" aria-hidden="true">
          <path className="alca" d="M14 20 V14 a8 8 0 0 1 16 0 V20" />
          <rect className="caixa" x="7" y="19" width="30" height="21" rx="6" />
          <circle className="furo" cx="22" cy="28.5" r="3.5" />
        </svg>
        <div>
          <strong className="titulo-trava">{TEXTO_MOTIVO[motivo]}</strong>
          {reabreEm && <span className="reabre">O diário reabre em {reabreEm.split('-').reverse().join('/')}.</span>}
        </div>
      </div>
    </div>
  )
}
