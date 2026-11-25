import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { obterPerfil, obterPlano } from '../lib/services/perfilService'
import type { Perfil, PlanoMilhao } from '../lib/tipos'

/**
 * Estados da sessão:
 * - sem_sessao: precisa entrar com e-mail e senha
 * - precisa_mfa: entrou com senha, falta o segundo fator (o banco só libera dados em aal2)
 * - sem_perfil: MFA ok, falta a configuração inicial
 * - pronta: tudo carregado
 */
export type EstadoSessao = 'carregando' | 'sem_sessao' | 'precisa_mfa' | 'sem_perfil' | 'pronta' | 'erro'

interface ValorSessao {
  estado: EstadoSessao
  sessao: Session | null
  perfil: Perfil | null
  plano: PlanoMilhao | null
  erro: string | null
  atualizar: () => Promise<void>
  sair: () => Promise<void>
}

const Contexto = createContext<ValorSessao | null>(null)

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [estado, setEstado] = useState<EstadoSessao>('carregando')
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [plano, setPlano] = useState<PlanoMilhao | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const avaliar = useCallback(async (s: Session | null) => {
    setSessao(s)
    if (!s) {
      setEstado('sem_sessao')
      return
    }
    const { data: nivel, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (error || nivel?.currentLevel !== 'aal2') {
      setEstado('precisa_mfa')
      return
    }
    const [p, pl] = await Promise.all([obterPerfil(), obterPlano()])
    if (p.erro || pl.erro) {
      setErro(p.erro ?? pl.erro)
      setEstado('erro')
      return
    }
    setPerfil(p.dados)
    setPlano(pl.dados)
    setErro(null)
    setEstado(p.dados && pl.dados ? 'pronta' : 'sem_perfil')
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => avaliar(data.session))
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => {
      // Fora do callback para não travar o cliente de auth
      setTimeout(() => avaliar(s), 0)
    })
    return () => data.subscription.unsubscribe()
  }, [avaliar])

  const atualizar = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    await avaliar(data.session)
  }, [avaliar])

  const sair = useCallback(async () => {
    await supabase.auth.signOut()
    setPerfil(null)
    setPlano(null)
  }, [])

  return <Contexto.Provider value={{ estado, sessao, perfil, plano, erro, atualizar, sair }}>{children}</Contexto.Provider>
}

export function useSessao(): ValorSessao {
  const v = useContext(Contexto)
  if (!v) throw new Error('useSessao fora do ProvedorSessao')
  return v
}
