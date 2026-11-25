import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const chaveAnonima = import.meta.env.VITE_SUPABASE_ANON_KEY

export const configurado = Boolean(url && chaveAnonima)

// Só a URL e a anon key chegam ao navegador. A service_role nunca fica aqui.
export const supabase = createClient(url || 'http://configure-o-env.invalido', chaveAnonima || 'sem-chave', {
  auth: { persistSession: true, autoRefreshToken: true },
  // Sem retentativa automática: sem internet, ela segurava cada leitura por 7 s (1 + 2 + 4) antes de desistir,
  // e a tela de gasto demorava cerca de 10 s para abrir offline. O app trata o erro: leitura mostra
  // "Tentar de novo" e gasto vai para a fila offline (memory/bugs.md, BUG-007).
  db: { retry: false },
})
