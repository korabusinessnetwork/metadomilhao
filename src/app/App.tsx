import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProvedorSessao, useSessao } from '../contexto/SessaoContexto'
import { configurado } from '../lib/supabase'
import { Carregando, ErroComAcao } from '../componentes/Basicos'
import { Entrar } from '../features/auth/Entrar'
import { SegundoFator } from '../features/auth/SegundoFator'
import { ConfiguracaoInicial } from '../features/config/ConfiguracaoInicial'
import { Configuracoes } from '../features/config/Configuracoes'
import { Hoje } from '../features/metas/Hoje'
import { Fechamento } from '../features/metas/Fechamento'
import { Gastos } from '../features/lancamentos/Gastos'
import { NovoLancamento } from '../features/lancamentos/NovoLancamento'
import { Orcamento } from '../features/orcamento/Orcamento'
import { Patrimonio } from '../features/patrimonio/Patrimonio'
import { Plano } from '../features/plano/Plano'
import { Layout, Mais } from './Layout'

/** Rota protegida: só renderiza o app depois da sessão, do segundo fator e do perfil (docs/11_SEGURANCA). */
function Portao() {
  const { estado, erro, atualizar } = useSessao()
  if (estado === 'carregando') return <main className="tela-centro"><Carregando /></main>
  if (estado === 'sem_sessao') return <Entrar />
  if (estado === 'precisa_mfa') return <SegundoFator />
  if (estado === 'erro') return <main className="tela-centro"><ErroComAcao erro={erro ?? ''} tentarDeNovo={atualizar} /></main>
  if (estado === 'sem_perfil') return <ConfiguracaoInicial />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Hoje />} />
        <Route path="gastos" element={<Gastos />} />
        <Route path="gastos/novo" element={<NovoLancamento />} />
        <Route path="plano" element={<Plano />} />
        <Route path="mais" element={<Mais />} />
        <Route path="patrimonio" element={<Patrimonio />} />
        <Route path="orcamento" element={<Orcamento />} />
        <Route path="fechamento" element={<Fechamento />} />
        <Route path="configuracoes" element={<Configuracoes />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export function App() {
  if (!configurado)
    return (
      <main className="tela-centro">
        <div className="painel cartao-login">
          <h1>Falta configurar</h1>
          <p>Copie o arquivo .env.example para .env.local e preencha a URL e a anon key do Supabase.</p>
        </div>
      </main>
    )
  return (
    <BrowserRouter>
      <ProvedorSessao>
        <Portao />
      </ProvedorSessao>
    </BrowserRouter>
  )
}
