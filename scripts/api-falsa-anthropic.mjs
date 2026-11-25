// API falsa da Anthropic, só para testar a Edge Function no ambiente local sem gastar dinheiro.
// Uso: node scripts/api-falsa-anthropic.mjs  (porta 8787)
// Modos (POST /modo {"modo": "..."}): ok | invalido_depois_ok | recomendacao | erro401 | pause_turn
import { createServer } from 'node:http'

let modo = 'ok'
let chamadas = []

const revisao = (data, extra = {}) => ({
  data,
  agenda: [{ hora: '09:00', evento: 'IPCA-15', pais: 'BR', relevancia: 'alta' }],
  ativos: [
    {
      ativo: 'PETR4',
      noticias: [{ titulo: 'Petrobras divulga produção', resumo: 'Produção subiu no trimestre.', fonte: 'Fonte de teste', url: 'https://exemplo.test/petr4' }],
      possivel_impacto: 'Possível impacto positivo na abertura.',
      riscos_do_dia: ['Petróleo volátil'],
      sem_novidades: false,
    },
  ],
  contexto_geral: 'Teste local: conteúdo fictício.',
  ...extra,
})

const mensagem = (texto, stop = 'end_turn', buscas = 2) => ({
  id: `msg_falsa_${chamadas.length}`,
  type: 'message',
  role: 'assistant',
  model: 'claude-haiku-5-5',
  content: stop === 'pause_turn' ? [{ type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'PETR4' } }] : [{ type: 'text', text: texto }],
  stop_reason: stop,
  stop_sequence: null,
  usage: { input_tokens: 30000, output_tokens: 2000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: { web_search_requests: buscas } },
})

createServer((req, res) => {
  let corpo = ''
  req.on('data', (c) => (corpo += c))
  req.on('end', () => {
    const json = (status, obj) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(obj))
    }
    if (req.url === '/modo') {
      modo = JSON.parse(corpo).modo
      chamadas = []
      return json(200, { modo })
    }
    if (req.url === '/chamadas') return json(200, chamadas)
    if (req.url !== '/v1/messages') return json(404, { error: { message: 'não existe' } })

    const pedido = JSON.parse(corpo)
    const primeiroUsuario = pedido.messages.find((m) => m.role === 'user')
    const data = /Data: (\d{4}-\d{2}-\d{2})/.exec(typeof primeiroUsuario.content === 'string' ? primeiroUsuario.content : '')?.[1] ?? '2000-01-01'
    chamadas.push({ modelo: pedido.model, ferramentas: pedido.tools?.map((t) => `${t.type}:${t.max_uses}`), mensagens: pedido.messages.length, sistemaProibeRecomendacao: pedido.system.includes('Nunca recomende') })

    if (modo === 'erro401') return json(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } })
    if (modo === 'pause_turn' && chamadas.length === 1) return json(200, mensagem('', 'pause_turn', 1))
    if (modo === 'invalido_depois_ok' && chamadas.length === 1) return json(200, mensagem('Desculpe, segue: {quebrado'))
    if (modo === 'recomendacao') return json(200, mensagem(JSON.stringify(revisao(data, { contexto_geral: 'Compre PETR4 na abertura.' }))))
    return json(200, mensagem('```json\n' + JSON.stringify(revisao(data)) + '\n```'))
  })
}).listen(8787, () => console.log('API falsa em http://localhost:8787'))
