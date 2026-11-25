import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useSessao } from '../../contexto/SessaoContexto'
import { Aviso, Carregando } from '../../componentes/Basicos'

interface Cadastro {
  fatorId: string
  qrCode: string
  segredo: string
}

/**
 * MFA TOTP obrigatório (docs/11_SEGURANCA). Sem fator verificado, cadastra um.
 * O banco só libera dados para sessões aal2.
 */
export function SegundoFator() {
  const { atualizar, sair } = useSessao()
  const [fatorId, setFatorId] = useState<string | null>(null)
  const [cadastro, setCadastro] = useState<Cadastro | null>(null)
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let ativo = true
    ;(async () => {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (!ativo) return
      if (error) {
        setErro('Não foi possível ler os fatores de segurança.')
        setCarregando(false)
        return
      }
      const verificado = data.totp.find((f) => f.status === 'verified')
      if (verificado) {
        setFatorId(verificado.id)
      } else {
        // Remove cadastros pela metade antes de começar outro
        for (const f of data.all.filter((f) => f.status === 'unverified')) await supabase.auth.mfa.unenroll({ factorId: f.id })
        const novo = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Rota do Milhão' })
        if (!ativo) return
        if (novo.error) setErro('Não foi possível iniciar o cadastro do segundo fator.')
        else setCadastro({ fatorId: novo.data.id, qrCode: novo.data.totp.qr_code, segredo: novo.data.totp.secret })
      }
      setCarregando(false)
    })()
    return () => {
      ativo = false
    }
  }, [])

  async function aoEnviar(e: FormEvent) {
    e.preventDefault()
    const id = fatorId ?? cadastro?.fatorId
    if (!id) return
    setEnviando(true)
    setErro(null)
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: id, code: codigo.trim() })
    setEnviando(false)
    if (error) {
      setErro('Código inválido ou expirado. Confira o app autenticador.')
      return
    }
    await atualizar()
  }

  return (
    <main className="tela-centro">
      <form className="cartao-login painel" onSubmit={aoEnviar}>
        <h1>Segundo fator</h1>
        {carregando && <Carregando />}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {cadastro && (
          <>
            <p className="pequeno">Escaneie no app autenticador (Google Authenticator, Authy, 1Password) e digite o código de 6 dígitos.</p>
            <img src={cadastro.qrCode} alt="QR code do segundo fator" width={200} height={200} style={{ background: '#fff', borderRadius: 6 }} />
            <p className="pequeno mut">
              Sem câmera? Use a chave: <code style={{ wordBreak: 'break-all' }}>{cadastro.segredo}</code>
            </p>
          </>
        )}
        {fatorId && <p className="pequeno">Digite o código de 6 dígitos do app autenticador.</p>}
        {!carregando && (
          <>
            <div className="campo">
              <label htmlFor="codigo">Código</label>
              <input
                id="codigo"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                autoFocus
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <button className="botao bloco" disabled={enviando || codigo.length !== 6}>
              {enviando ? 'Conferindo...' : 'Confirmar'}
            </button>
          </>
        )}
        <div className="acoes">
          <button type="button" className="botao secundario" onClick={sair}>
            Sair
          </button>
        </div>
      </form>
    </main>
  )
}
