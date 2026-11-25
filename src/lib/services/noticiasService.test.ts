import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))
const { urlSegura } = await import('./noticiasService')

describe('links vindos da IA', () => {
  it('só http e https viram link; o resto fica como texto', () => {
    expect(urlSegura('https://valor.globo.com/x')).toBe('https://valor.globo.com/x')
    expect(urlSegura('javascript:alert(1)')).toBeNull()
    expect(urlSegura('data:text/html,oi')).toBeNull()
    expect(urlSegura('não é url')).toBeNull()
  })
})
