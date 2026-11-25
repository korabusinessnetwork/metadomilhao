import { describe, expect, it } from 'vitest'
import { classificarEnvio } from './envio'

describe('resposta do banco ao enviar um lançamento da fila', () => {
  it('sem erro, enviado', () => {
    expect(classificarEnvio(null)).toBe('enviado')
  })

  it('id repetido (23505) significa que um envio anterior já chegou', () => {
    expect(classificarEnvio({ code: '23505', message: 'duplicate key value violates unique constraint "lancamento_pkey"' })).toBe('ja_existe')
  })

  it('falha de rede mantém na fila', () => {
    expect(classificarEnvio({ message: 'TypeError: Failed to fetch' })).toBe('sem_conexao')
    expect(classificarEnvio({ message: 'NetworkError when attempting to fetch resource.' })).toBe('sem_conexao')
    expect(classificarEnvio({ code: 'PGRST301', message: 'JWT expired' })).toBe('sem_conexao')
  })

  it('recusa por regra vira motivo em português', () => {
    expect(classificarEnvio({ code: 'P0001', message: 'Categoria não encontrada.' })).toEqual({ recusado: 'Categoria não encontrada.' })
    expect(classificarEnvio({ code: '23514', message: 'violates check constraint' })).toEqual({ recusado: 'Algum valor está fora do permitido.' })
  })
})
