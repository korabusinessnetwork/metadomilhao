import { describe, expect, it } from 'vitest'
import { multiplicador, riscoCentavos, resultadoBrutoCentavos, resultadoR, validarPlanoOperacao, paraPreco, mercadoDoAtivo } from './trade'

const contexto = { setupId: 's1', tendenciaDiario: 'alta', tendenciaH1: 'alta', tendenciaH4: 'lateral', timeframeEntrada: '5m', teveNoticia: false, noticiaDescricao: '' } as const

describe('preço digitado', () => {
  it('aceita vírgula decimal e ponto de milhar', () => {
    expect(paraPreco('32,15')).toBe(32.15)
    expect(paraPreco('128.500')).toBe(128500)
    expect(paraPreco('128500')).toBe(128500)
    expect(paraPreco('1.234,5')).toBe(1234.5)
    expect(paraPreco('')).toBeNull()
    expect(paraPreco('abc')).toBeNull()
    expect(paraPreco('0')).toBeNull()
  })

  it('sugere o mercado pelo código do ativo', () => {
    expect(mercadoDoAtivo('WINZ26')).toBe('mini_indice')
    expect(mercadoDoAtivo('petr4')).toBe('acoes')
  })
})

describe('operação de trade', () => {
  it('T-03: multiplicador 1 em ações e R$ 0,20 por ponto por contrato no mini-índice', () => {
    expect(multiplicador('acoes')).toBe(1)
    expect(multiplicador('mini_indice')).toBe(0.2)
  })

  it('T-03: risco = |entrada − stop| × quantidade × multiplicador', () => {
    // WIN: 150 pontos × 2 contratos × 0,20 = R$ 60
    expect(riscoCentavos({ mercado: 'mini_indice', entrada: 128500, stop: 128350, quantidade: 2 })).toBe(6000)
    // Ação: 0,25 × 100 = R$ 25, sem erro de ponto flutuante
    expect(riscoCentavos({ mercado: 'acoes', entrada: 32.15, stop: 31.9, quantidade: 100 })).toBe(2500)
  })

  it('risco conhecido: multiplicador do mini-índice nunca aplicado em ações (memory/bugs.md)', () => {
    expect(riscoCentavos({ mercado: 'acoes', entrada: 10, stop: 9, quantidade: 1 })).toBe(100)
  })

  it('resultado bruto respeita a direção', () => {
    expect(resultadoBrutoCentavos({ mercado: 'mini_indice', direcao: 'compra', entrada: 128500, saida: 128800, quantidade: 2 })).toBe(12000)
    expect(resultadoBrutoCentavos({ mercado: 'mini_indice', direcao: 'venda', entrada: 128500, saida: 128800, quantidade: 2 })).toBe(-12000)
    expect(resultadoBrutoCentavos({ mercado: 'acoes', direcao: 'venda', entrada: 32.15, saida: 31.9, quantidade: 100 })).toBe(2500)
  })

  it('T-05: resultado em R = líquido ÷ risco, com 2 casas', () => {
    expect(resultadoR(11500, 6000)).toBe(1.92)
    expect(resultadoR(-6000, 6000)).toBe(-1)
    expect(resultadoR(100, 0)).toBe(0)
  })

  it('T-04: risco acima de 1% do capital é recusado no registro planejado', () => {
    const base = { mercado: 'mini_indice', direcao: 'compra', entrada: 128500, stop: 128350, alvo: 128800, quantidade: 2, ...contexto } as const
    expect(validarPlanoOperacao({ ...base, capitalCentavos: 600000 })).toEqual([]) // 60 de 6000 = 1%
    expect(validarPlanoOperacao({ ...base, capitalCentavos: 599900 })).toContain('Risco acima de 1% do capital de trade (T-04).')
  })

  it('T-01: stop e alvo precisam estar do lado certo da entrada', () => {
    const base = { mercado: 'acoes', entrada: 10, quantidade: 100, capitalCentavos: 10_000_000, ...contexto } as const
    expect(validarPlanoOperacao({ ...base, direcao: 'compra', stop: 10.5, alvo: 11 })).toContain('Na compra, o stop fica abaixo da entrada e o alvo acima.')
    expect(validarPlanoOperacao({ ...base, direcao: 'venda', stop: 10.5, alvo: 9 })).toEqual([])
    expect(validarPlanoOperacao({ ...base, direcao: 'compra', stop: 9, alvo: 11, quantidade: 0 })).toContain('Quantidade precisa ser um inteiro maior que zero.')
  })

  it('T-02: contexto é obrigatório, e notícia marcada exige descrição', () => {
    const base = { mercado: 'acoes', direcao: 'compra', entrada: 10, stop: 9, alvo: 12, quantidade: 1, capitalCentavos: 10_000_000, ...contexto } as const
    expect(validarPlanoOperacao({ ...base, setupId: '' })).toContain('Escolha o setup (T-02).')
    expect(validarPlanoOperacao({ ...base, teveNoticia: true, noticiaDescricao: '' })).toContain('Descreva a notícia (T-02).')
  })
})
