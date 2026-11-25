import { useCallback, useEffect, useState } from 'react'
import type { Resultado } from './services/resultado'

/** Carrega um Resultado e expõe os 4 estados: carregando, erro, vazio (dados vazios) e sucesso. */
export function useCarregar<T>(buscar: () => Promise<Resultado<T>>, dependencias: unknown[]) {
  const [estado, setEstado] = useState<{ dados: T | null; erro: string | null; carregando: boolean }>({ dados: null, erro: null, carregando: true })

  // A função de busca é recriada a cada render; quem chama controla quando recarregar pelas dependências
  const executar = useCallback(buscar, dependencias)

  const recarregar = useCallback(async () => {
    setEstado((e) => ({ ...e, carregando: true, erro: null }))
    const r = await executar()
    setEstado({ dados: r.dados, erro: r.erro, carregando: false })
  }, [executar])

  useEffect(() => {
    let ativo = true
    executar().then((r) => {
      if (ativo) setEstado({ dados: r.dados, erro: r.erro, carregando: false })
    })
    return () => {
      ativo = false
    }
  }, [executar])

  return { ...estado, recarregar }
}
