import { useState, type FormEvent } from 'react'
import { useSessao } from '../../contexto/SessaoContexto'
import { salvarPerfil, salvarPlano } from '../../lib/services/perfilService'
import { exportarTudo } from '../../lib/services/exportacaoService'
import { taxaAnualEquivalente } from '../../lib/calculos/projecao'
import { Aviso } from '../../componentes/Basicos'
import { CampoValor } from '../../componentes/Campos'

/** Perfil, premissas do plano e exportação CSV (backup do dono). Limites de risco e setups chegam na Fase 2. */
export function Configuracoes() {
  const { perfil, plano, atualizar, sair } = useSessao()
  const [nome, setNome] = useState(perfil?.nome ?? '')
  const [dataMudanca, setDataMudanca] = useState(perfil?.data_mudanca ?? '')
  const [taxaTexto, setTaxaTexto] = useState(((plano?.taxa_real_mensal ?? 0.0045) * 100).toFixed(2).replace('.', ','))
  const [meta, setMeta] = useState<number | null>(plano?.meta_centavos ?? 100_000_000)
  const [aporteAtual, setAporteAtual] = useState<number | null>(plano?.aporte_atual_centavos ?? 0)
  const [aportePos, setAportePos] = useState<number | null>(plano?.aporte_pos_mudanca_centavos ?? 0)
  const [mensagem, setMensagem] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null)
  const [exportando, setExportando] = useState(false)

  const taxa = Number(taxaTexto.replace(',', '.')) / 100
  const taxaValida = Number.isFinite(taxa) && taxa >= 0 && taxa < 0.05

  async function aoSalvar(e: FormEvent) {
    e.preventDefault()
    if (!taxaValida) return setMensagem({ tipo: 'erro', texto: 'Taxa real precisa ficar entre 0% e 5% ao mês.' })
    if (meta === null || aporteAtual === null || aportePos === null) return setMensagem({ tipo: 'erro', texto: 'Preencha todos os valores.' })
    const p = await salvarPerfil({ nome: nome.trim(), data_mudanca: dataMudanca || null })
    if (p.erro !== null) return setMensagem({ tipo: 'erro', texto: p.erro })
    const pl = await salvarPlano({ meta_centavos: meta, taxa_real_mensal: Number(taxa.toFixed(4)), aporte_atual_centavos: aporteAtual, aporte_pos_mudanca_centavos: aportePos })
    if (pl.erro !== null) return setMensagem({ tipo: 'erro', texto: pl.erro })
    setMensagem({ tipo: 'sucesso', texto: 'Configurações salvas. O plano foi recalculado.' })
    await atualizar()
  }

  async function aoExportar() {
    setExportando(true)
    const r = await exportarTudo()
    setExportando(false)
    if (r.erro !== null) return setMensagem({ tipo: 'erro', texto: r.erro })
    for (const arquivo of r.dados) {
      const url = URL.createObjectURL(new Blob([arquivo.conteudo], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = arquivo.nome
      a.click()
      URL.revokeObjectURL(url)
    }
    setMensagem({ tipo: 'sucesso', texto: `${r.dados.length} arquivos CSV baixados.` })
  }

  return (
    <>
      <h1>Configurações</h1>
      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}
      <div className="grade">
        <form className="painel" onSubmit={aoSalvar}>
          <h2>Perfil e plano</h2>
          <div className="campo">
            <label htmlFor="cfg-nome">Nome</label>
            <input id="cfg-nome" required maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="cfg-mudanca">Data da mudança de moradia</label>
            <input id="cfg-mudanca" type="date" value={dataMudanca} onChange={(e) => setDataMudanca(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="cfg-taxa">Taxa real ao mês (%)</label>
            <input id="cfg-taxa" inputMode="decimal" value={taxaTexto} onChange={(e) => setTaxaTexto(e.target.value)} aria-invalid={!taxaValida} />
            {taxaValida && <p className="pequeno mut">Equivale a {(taxaAnualEquivalente(taxa) * 100).toFixed(2).replace('.', ',')}% ao ano, já sem inflação.</p>}
          </div>
          <CampoValor rotulo="Meta (em dinheiro de hoje)" valorCentavos={meta} aoMudar={setMeta} />
          <div className="linha-campos">
            <CampoValor rotulo="Aporte até a mudança" valorCentavos={aporteAtual} aoMudar={setAporteAtual} />
            <CampoValor rotulo="Aporte após a mudança" valorCentavos={aportePos} aoMudar={setAportePos} />
          </div>
          <button className="botao">Salvar</button>
        </form>

        <section className="painel">
          <h2>Exportar dados</h2>
          <p className="pequeno">Baixa um CSV por tabela: lançamentos, rendas, movimentos da carteira e fechamentos. Faça uma vez por mês, como backup.</p>
          <button type="button" className="botao secundario" onClick={aoExportar} disabled={exportando}>
            {exportando ? 'Gerando...' : 'Exportar CSV'}
          </button>
        </section>

        <section className="painel">
          <h2>Sessão</h2>
          <button type="button" className="botao perigo" onClick={sair}>
            Sair
          </button>
        </section>
      </div>
    </>
  )
}
