import { useCallback, useEffect, useState } from 'react'
import { EVENTO_FILA, avisarFilaMudou, fila } from '../lib/offline/aparelho'
import { enviarPendente } from '../lib/services/lancamentoService'
import { formatarCentavos } from '../lib/calculos/dinheiro'

/**
 * Sobe a fila offline ao abrir o app, quando a conexão volta e a cada minuto.
 * Mostra o que aguarda envio e o que foi recusado (nada some em silêncio).
 */
export function Sincronizacao() {
  const [pendentes, setPendentes] = useState(() => fila.pendentes().length)
  const [recusados, setRecusados] = useState(() => fila.recusados())
  const [online, setOnline] = useState(() => navigator.onLine)

  const atualizar = useCallback(() => {
    setPendentes(fila.pendentes().length)
    setRecusados(fila.recusados())
  }, [])

  const sincronizar = useCallback(async () => {
    if (fila.pendentes().length === 0) return
    await fila.sincronizar(enviarPendente)
    avisarFilaMudou()
  }, [])

  useEffect(() => {
    const aoMudarConexao = () => {
      setOnline(navigator.onLine)
      if (navigator.onLine) void sincronizar()
    }
    window.addEventListener('online', aoMudarConexao)
    window.addEventListener('offline', aoMudarConexao)
    window.addEventListener(EVENTO_FILA, atualizar)
    const relogio = window.setInterval(() => void sincronizar(), 60_000)
    void sincronizar()
    return () => {
      window.removeEventListener('online', aoMudarConexao)
      window.removeEventListener('offline', aoMudarConexao)
      window.removeEventListener(EVENTO_FILA, atualizar)
      window.clearInterval(relogio)
    }
  }, [atualizar, sincronizar])

  if (online && pendentes === 0 && recusados.length === 0) return null

  return (
    <div className="aviso-sincronizacao" role="status">
      {!online && <p>Sem conexão. Gastos lançados agora ficam no aparelho e sobem quando a internet voltar.</p>}
      {pendentes > 0 && (
        <p>
          {pendentes === 1 ? '1 gasto aguardando envio.' : `${pendentes} gastos aguardando envio.`}{' '}
          {online && (
            <button type="button" className="botao secundario" onClick={() => void sincronizar()}>
              Enviar agora
            </button>
          )}
        </p>
      )}
      {recusados.map((r) => (
        <p key={r.id} className="bad">
          Gasto de {formatarCentavos(r.valorCentavos)} em {r.data.split('-').reverse().join('/')} foi recusado: {r.motivo}{' '}
          <button
            type="button"
            className="botao secundario"
            onClick={() => {
              fila.descartarRecusado(r.id)
              atualizar()
            }}
          >
            Entendi, descartar
          </button>
        </p>
      ))}
    </div>
  )
}
