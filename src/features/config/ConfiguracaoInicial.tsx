import { useState, type FormEvent } from 'react'
import { useSessao } from '../../contexto/SessaoContexto'
import { configuracaoInicial } from '../../lib/services/perfilService'
import { Aviso } from '../../componentes/Basicos'
import { CampoValor } from '../../componentes/Campos'

/** Primeiro acesso: perfil, plano e categorias de partida. Valores sugeridos vêm do intake (25/11/2026). */
export function ConfiguracaoInicial() {
  const { atualizar, sair } = useSessao()
  const [nome, setNome] = useState('Matheus')
  const [dataMudanca, setDataMudanca] = useState('2027-02-01')
  const [aporteAtual, setAporteAtual] = useState<number | null>(88500)
  const [aportePos, setAportePos] = useState<number | null>(244500)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function aoEnviar(e: FormEvent) {
    e.preventDefault()
    if (aporteAtual === null || aportePos === null) {
      setErro('Preencha os dois aportes.')
      return
    }
    setEnviando(true)
    setErro(null)
    const r = await configuracaoInicial({ nome: nome.trim(), dataMudanca: dataMudanca || null, aporteAtualCentavos: aporteAtual, aportePosMudancaCentavos: aportePos })
    setEnviando(false)
    if (r.erro !== null) setErro(r.erro)
    else await atualizar()
  }

  return (
    <main className="tela-centro">
      <form className="cartao-login painel" onSubmit={aoEnviar} style={{ maxWidth: 460 }}>
        <h1>Configuração inicial</h1>
        <p className="pequeno mut">Dá para mudar tudo depois em Mais, Configurações.</p>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <div className="campo">
          <label htmlFor="nome">Nome</label>
          <input id="nome" required maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="mudanca">Data da mudança de moradia</label>
          <input id="mudanca" type="date" value={dataMudanca} onChange={(e) => setDataMudanca(e.target.value)} />
          <p className="pequeno mut">Até essa data o plano usa o aporte atual. Depois, o aporte pós-mudança (F-01, F-02).</p>
        </div>
        <div className="linha-campos">
          <CampoValor rotulo="Aporte mensal hoje" valorCentavos={aporteAtual} aoMudar={setAporteAtual} />
          <CampoValor rotulo="Aporte após a mudança" valorCentavos={aportePos} aoMudar={setAportePos} />
        </div>
        <button className="botao bloco" disabled={enviando}>
          {enviando ? 'Salvando...' : 'Começar'}
        </button>
        <div className="acoes">
          <button type="button" className="botao secundario" onClick={sair}>
            Sair
          </button>
        </div>
      </form>
    </main>
  )
}
