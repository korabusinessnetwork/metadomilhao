// Gera os ícones PNG do PWA (192 e 512) sem dependências: quadrado cobalto com uma linha de tendência branca.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const tabelaCrc = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = tabelaCrc[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const bloco = (tipo, dados) => {
  const tam = Buffer.alloc(4)
  tam.writeUInt32BE(dados.length)
  const corpo = Buffer.concat([Buffer.from(tipo), dados])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(corpo))
  return Buffer.concat([tam, corpo, crc])
}

// Distância de um ponto a um segmento, para desenhar a linha com espessura
const distancia = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function gerar(tamanho) {
  const s = tamanho / 64
  const pontos = [[14, 46], [28, 32], [36, 38], [50, 18]].map(([x, y]) => [x * s, y * s])
  const espessura = 3.2 * s
  const linhas = []
  for (let y = 0; y < tamanho; y++) {
    const linha = [0]
    for (let x = 0; x < tamanho; x++) {
      let d = Infinity
      for (let i = 0; i < pontos.length - 1; i++) d = Math.min(d, distancia(x + 0.5, y + 0.5, ...pontos[i], ...pontos[i + 1]))
      const branco = Math.max(0, Math.min(1, espessura - d + 0.5))
      const mistura = (fundo, frente) => Math.round(fundo + (frente - fundo) * branco)
      linha.push(mistura(0x12, 0xff), mistura(0x40, 0xff), mistura(0xe0, 0xff))
    }
    linhas.push(Buffer.from(linha))
  }
  const cabecalho = Buffer.alloc(13)
  cabecalho.writeUInt32BE(tamanho, 0)
  cabecalho.writeUInt32BE(tamanho, 4)
  cabecalho[8] = 8 // bits
  cabecalho[9] = 2 // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', cabecalho),
    bloco('IDAT', deflateSync(Buffer.concat(linhas))),
    bloco('IEND', Buffer.alloc(0)),
  ])
}

for (const t of [192, 512]) writeFileSync(new URL(`../public/icone-${t}.png`, import.meta.url), gerar(t))
console.log('ícones gerados')
