/**
 * P-03: reserva = 6 × média das despesas dos últimos 3 meses fechados.
 * A lista vem do mais recente para o mais antigo. Sem histórico, usa o orçamento mensal.
 */
export function metaReserva(e: { despesasMesesFechadosCentavos: number[]; orcamentoMensalCentavos: number }): number {
  const ultimos = e.despesasMesesFechadosCentavos.slice(0, 3)
  if (ultimos.length === 0) return 6 * e.orcamentoMensalCentavos
  const media = Math.round(ultimos.reduce((s, v) => s + v, 0) / ultimos.length)
  return 6 * media
}

/** P-01: a sobra vai primeiro para a reserva, depois para o aporte de longo prazo. Capital de trade fica para a Fase 2 (P-02). */
export function distribuirSobra(e: { sobraCentavos: number; faltaReservaCentavos: number }): {
  reservaCentavos: number
  longoPrazoCentavos: number
} {
  const sobra = Math.max(0, e.sobraCentavos)
  const reservaCentavos = Math.min(sobra, Math.max(0, e.faltaReservaCentavos))
  return { reservaCentavos, longoPrazoCentavos: sobra - reservaCentavos }
}
