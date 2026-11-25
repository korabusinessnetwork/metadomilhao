// Serve o build (dist/) com os mesmos cabeçalhos e reescritas do vercel.json, para conferir a CSP antes de publicar.
// Uso: npm run build && node scripts/servir-como-vercel.mjs [porta] [origem extra do connect-src, ex.: http://127.0.0.1:55321]
// A origem extra existe só para o teste local com o Supabase local; em produção a CSP fica como está no vercel.json.
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, extname, normalize } from 'node:path'

const porta = Number(process.argv[2] ?? 5182)
const connectExtra = process.argv[3] ?? ''
const raiz = join(process.cwd(), 'dist')
const config = JSON.parse(readFileSync('vercel.json', 'utf8'))

// As fontes do vercel.json usam a sintaxe path-to-regexp; aqui bastam "/(...)" com regex dentro
const regex = (fonte) => new RegExp(`^${fonte.replace(/^\/\(/, '/(').replace(/\)$/, ')')}$`)
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json' }

createServer((req, res) => {
  let caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  for (const r of config.rewrites ?? []) if (regex(r.source).test(caminho)) caminho = r.destination
  for (const h of config.headers ?? []) {
    if (!regex(h.source).test(caminho)) continue
    for (const { key, value } of h.headers) {
      res.setHeader(key, key === 'Content-Security-Policy' && connectExtra ? value.replace("connect-src 'self'", `connect-src 'self' ${connectExtra}`) : value)
    }
  }
  const arquivo = normalize(join(raiz, caminho))
  if (!arquivo.startsWith(raiz) || !existsSync(arquivo) || statSync(arquivo).isDirectory()) {
    res.statusCode = 404
    return res.end('não encontrado')
  }
  res.setHeader('Content-Type', tipos[extname(arquivo)] ?? 'application/octet-stream')
  res.end(readFileSync(arquivo))
}).listen(porta, () => console.log(`build servido como na Vercel em http://localhost:${porta}`))
