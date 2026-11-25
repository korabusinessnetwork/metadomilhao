import { describe, expect, it } from 'vitest'
import { mesclarPendentes } from './mesclar'

const servidor = [{ id: 'a', data: '2027-03-10', categoria_id: 'c1', valor_centavos: 500, descricao: null, estorno_de: null, criado_em: '2027-03-10T10:00:00Z' }]
const pend = (id: string, data = '2027-03-11') => ({ id, data, categoriaId: 'c1', valorCentavos: 900, descricao: 'pão', criadoEm: '2027-03-11T09:00:00Z' })

describe('pendentes da fila nos números do mês', () => {
  it('entram no mês como lançamentos marcados como pendentes', () => {
    const r = mesclarPendentes(servidor, [pend('b')], '2027-03-01')
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({ id: 'b', valor_centavos: 900, descricao: 'pão', pendente: true })
    expect(r[1]).toMatchObject({ id: 'a', pendente: false })
  })

  it('não conta duas vezes o que já chegou ao servidor', () => {
    expect(mesclarPendentes(servidor, [pend('a', '2027-03-10')], '2027-03-01')).toHaveLength(1)
  })

  it('ignora pendentes de outro mês', () => {
    expect(mesclarPendentes(servidor, [pend('b', '2027-04-01')], '2027-03-01')).toHaveLength(1)
  })
})
