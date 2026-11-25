import type { ClasseAtivo, TipoMovimento } from '../tipos'

/** O valor chega positivo da tela. Resgate é gravado negativo; rendimento e ajuste seguem o sinal escolhido. */
export function valorComSinal(tipo: TipoMovimento, valorCentavos: number, negativo: boolean): number {
  const v = Math.abs(valorCentavos)
  if (tipo === 'aporte') return v
  if (tipo === 'resgate') return -v
  return negativo ? -v : v
}

/** P-04: capital de trade nunca passa de 10% do patrimônio total. */
export const LIMITE_CAPITAL_TRADE = 0.1

export interface ResumoCarteira {
  totalCentavos: number
  porClasse: Record<ClasseAtivo, number>
  metaReservaCentavos: number
  faltaReservaCentavos: number
  reservaCompleta: boolean
  pctCapitalTrade: number
  capitalTradeAcimaDoLimite: boolean
}

export function resumoCarteira(saldos: { classe: ClasseAtivo; saldo_centavos: number }[], metaReservaCentavos: number): ResumoCarteira {
  const porClasse: Record<ClasseAtivo, number> = { reserva: 0, renda_fixa: 0, fii: 0, acoes: 0, capital_trade: 0, outro: 0 }
  for (const s of saldos) porClasse[s.classe] += s.saldo_centavos
  const totalCentavos = Object.values(porClasse).reduce((a, b) => a + b, 0)
  const faltaReservaCentavos = Math.max(0, metaReservaCentavos - porClasse.reserva)
  const pctCapitalTrade = totalCentavos > 0 ? porClasse.capital_trade / totalCentavos : 0
  return {
    totalCentavos,
    porClasse,
    metaReservaCentavos,
    faltaReservaCentavos,
    // Sem meta (orçamento ainda vazio) não dá para dizer que a reserva está completa
    reservaCompleta: metaReservaCentavos > 0 && faltaReservaCentavos === 0,
    pctCapitalTrade,
    capitalTradeAcimaDoLimite: pctCapitalTrade > LIMITE_CAPITAL_TRADE,
  }
}
