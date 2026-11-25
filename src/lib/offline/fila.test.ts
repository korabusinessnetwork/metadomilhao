import { describe, expect, it } from 'vitest'
import { criarFila, type Armazenamento, type LancamentoPendente, type ResultadoEnvio } from './fila'

function memoria(): Armazenamento {
  const m = new Map<string, string>()
  return { ler: (k) => m.get(k) ?? null, gravar: (k, v) => void m.set(k, v), apagar: (k) => void m.delete(k) }
}

const item = (id: string, valor = 1000): LancamentoPendente => ({
  id,
  data: '2027-03-10',
  categoriaId: 'c1',
  valorCentavos: valor,
  descricao: '',
  criadoEm: `2027-03-10T10:00:0${id}Z`,
})

describe('fila offline de lançamentos', () => {
  it('guarda no aparelho e sobrevive a recarregar a página', () => {
    const arm = memoria()
    criarFila(arm).adicionar(item('1'))
    expect(criarFila(arm).pendentes()).toEqual([item('1')])
  })

  it('envia na ordem em que foram lançados e esvazia a fila', async () => {
    const fila = criarFila(memoria())
    fila.adicionar(item('2'))
    fila.adicionar(item('1'))
    const enviados: string[] = []
    const r = await fila.sincronizar(async (l) => {
      enviados.push(l.id)
      return 'enviado'
    })
    expect(enviados).toEqual(['2', '1'])
    expect(r).toEqual({ enviados: 2, recusados: 0, pendentes: 0 })
    expect(fila.pendentes()).toEqual([])
  })

  it('reenvio de um lançamento que já chegou ao banco conta como enviado, sem duplicar', async () => {
    const fila = criarFila(memoria())
    fila.adicionar(item('1'))
    const r = await fila.sincronizar(async () => 'ja_existe' as ResultadoEnvio)
    expect(r.enviados).toBe(1)
    expect(fila.pendentes()).toEqual([])
  })

  it('sem conexão, o item continua na fila e a sincronização para', async () => {
    const fila = criarFila(memoria())
    fila.adicionar(item('1'))
    fila.adicionar(item('2'))
    let tentativas = 0
    const r = await fila.sincronizar(async () => {
      tentativas++
      return 'sem_conexao'
    })
    expect(tentativas).toBe(1)
    expect(r).toEqual({ enviados: 0, recusados: 0, pendentes: 2 })
  })

  it('recusa por regra não some em silêncio: vai para recusados com o motivo', async () => {
    const fila = criarFila(memoria())
    fila.adicionar(item('1'))
    fila.adicionar(item('2'))
    const r = await fila.sincronizar(async (l) => (l.id === '1' ? { recusado: 'Categoria não encontrada.' } : 'enviado'))
    expect(r).toEqual({ enviados: 1, recusados: 1, pendentes: 0 })
    expect(fila.recusados()).toEqual([{ ...item('1'), motivo: 'Categoria não encontrada.' }])
  })

  it('o dono descarta um recusado de propósito', () => {
    const arm = memoria()
    const fila = criarFila(arm)
    arm.gravar('rota:fila:recusados', JSON.stringify([{ ...item('1'), motivo: 'x' }]))
    fila.descartarRecusado('1')
    expect(fila.recusados()).toEqual([])
  })

  it('dado corrompido no aparelho não derruba o app', () => {
    const arm = memoria()
    arm.gravar('rota:fila:pendentes', '{quebrado')
    expect(criarFila(arm).pendentes()).toEqual([])
  })

  it('não sincroniza duas vezes ao mesmo tempo', async () => {
    const fila = criarFila(memoria())
    fila.adicionar(item('1'))
    let chamadas = 0
    const lento = async () => {
      chamadas++
      await new Promise((r) => setTimeout(r, 10))
      return 'enviado' as const
    }
    await Promise.all([fila.sincronizar(lento), fila.sincronizar(lento)])
    expect(chamadas).toBe(1)
  })

  it('limpar apaga tudo (ao sair da conta)', () => {
    const fila = criarFila(memoria())
    fila.adicionar(item('1'))
    fila.limpar()
    expect(fila.pendentes()).toEqual([])
  })
})
