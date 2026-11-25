import { describe, expect, it } from 'vitest'
import { metaReserva, distribuirSobra } from './reserva'

describe('reserva de emergência e prioridade do dinheiro', () => {
  it('P-03: 6 × média das despesas dos últimos 3 meses fechados (mais recentes primeiro)', () => {
    expect(metaReserva({ despesasMesesFechadosCentavos: [300000, 330000, 315000, 999999], orcamentoMensalCentavos: 1 }))
      .toBe(6 * 315000)
  })

  it('P-03: sem histórico, usa o orçamento', () => {
    expect(metaReserva({ despesasMesesFechadosCentavos: [], orcamentoMensalCentavos: 315500 })).toBe(6 * 315500)
  })

  it('P-03: com menos de 3 meses, usa a média do que existe', () => {
    expect(metaReserva({ despesasMesesFechadosCentavos: [300000, 310000], orcamentoMensalCentavos: 1 })).toBe(6 * 305000)
  })

  it('P-01: sobra vai primeiro para a reserva, depois para o longo prazo', () => {
    expect(distribuirSobra({ sobraCentavos: 244500, faltaReservaCentavos: 100000 }))
      .toEqual({ reservaCentavos: 100000, longoPrazoCentavos: 144500 })
    expect(distribuirSobra({ sobraCentavos: 88500, faltaReservaCentavos: 500000 }))
      .toEqual({ reservaCentavos: 88500, longoPrazoCentavos: 0 })
    expect(distribuirSobra({ sobraCentavos: -1000, faltaReservaCentavos: 500000 }))
      .toEqual({ reservaCentavos: 0, longoPrazoCentavos: 0 })
  })
})
