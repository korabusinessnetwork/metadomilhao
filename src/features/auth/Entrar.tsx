import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { Aviso } from '../../componentes/Basicos'

/** Login com e-mail e senha. Cadastro público fica desativado no Supabase (ADR-002). */
export function Entrar() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function aoEnviar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
    setEnviando(false)
    if (error) setErro('E-mail ou senha não conferem.')
  }

  return (
    <main className="tela-centro">
      <form className="cartao-login painel" onSubmit={aoEnviar}>
        <h1>Rota do Milhão</h1>
        <p className="mut pequeno">Entre com a conta do dono.</p>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <div className="campo">
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="senha">Senha</label>
          <input id="senha" type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>
        <button className="botao bloco" disabled={enviando}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
