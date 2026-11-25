import { describe, expect, it } from 'vitest'
import { executar, traduzirErro } from './resultado'

describe('tratamento de erro dos serviços', () => {
  it('repassa a mensagem dos nossos triggers e traduz códigos do Postgres', () => {
    expect(traduzirErro({ code: 'P0001', message: 'Este mês já foi fechado.' })).toBe('Este mês já foi fechado.')
    expect(traduzirErro({ code: '42501', message: 'new row violates row-level security policy' })).toBe('Sem permissão. Entre de novo com o segundo fator.')
    expect(traduzirErro({ code: 'XX000', message: 'saldo 1234 detalhe interno' })).toBe('Algo deu errado. Tente de novo.')
  })

  it('executar devolve { dados, erro } e nunca lança', async () => {
    expect(await executar(Promise.resolve({ data: [1], error: null }))).toEqual({ dados: [1], erro: null })
    expect(await executar(Promise.resolve({ data: null, error: { code: '23505' } }))).toEqual({ dados: null, erro: 'Esse registro já existe.' })
    expect(await executar(Promise.reject(new Error('Failed to fetch')))).toEqual({ dados: null, erro: 'Sem conexão. Confira a internet e tente de novo.' })
  })
})
