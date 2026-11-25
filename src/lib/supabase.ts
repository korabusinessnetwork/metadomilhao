import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const chaveAnonima = import.meta.env.VITE_SUPABASE_ANON_KEY

export const configurado = Boolean(url && chaveAnonima)

// Só a URL e a anon key chegam ao navegador. A service_role nunca fica aqui.
export const supabase = createClient(url || 'http://configure-o-env.invalido', chaveAnonima || 'sem-chave', {
  auth: { persistSession: true, autoRefreshToken: true },
})
