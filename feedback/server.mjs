/**
 * Uninstall survey endpoint for deskr.cc/bye: checks an answer and emails it.
 * No database, nothing stored: each answer goes straight to FEEDBACK_TO.
 *
 * Runs as its own small app on Coolify (Atlas), routed at
 * deskr.cc/api/uninstall-feedback. Sends through Amazon SES like Taskr.
 *
 * Env: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, MAIL_FROM,
 * FEEDBACK_TO, PORT (default 3000). Without AWS settings the email is only
 * logged, which is handy locally.
 */

import { createServer } from 'node:http'
import { Readable } from 'node:stream'
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'

const REASONS = {
  'old-tab': 'Wanted the old new tab page back',
  trying: 'Was just trying it out',
  missing: 'A needed feature is missing',
  bug: "Something didn't work",
  sync: "Sync between computers didn't work",
  slow: 'New tabs felt slow',
  cluttered: 'Too much on the page / hard to figure out',
  'other-extension': 'Switched to another new tab extension',
  privacy: 'Unsure about permissions or privacy',
  other: 'Something else',
}
const LANGS = ['en', 'sk', 'sr']
const MAX_COMMENT = 2000
const MAX_BODY = 32 * 1024

// A few answers per visitor per hour is plenty; kept in memory only, never logged
const LIMIT = 5
const WINDOW_MS = 60 * 60 * 1000
const recent = new Map()

function allowed(ip) {
  const now = Date.now()
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (hits.length >= LIMIT) return false
  recent.set(ip, [...hits, now])
  if (recent.size > 10_000) recent.clear()
  return true
}

const ses = process.env.AWS_REGION && process.env.AWS_ACCESS_KEY_ID ? new SESv2Client({ region: process.env.AWS_REGION }) : null

async function sendEmail({ subject, text }) {
  if (!ses) {
    console.log(`[feedback] (no SES configured) ${subject}\n${text}`)
    return
  }
  await ses.send(new SendEmailCommand({
    FromEmailAddress: process.env.MAIL_FROM,
    Destination: { ToAddresses: [process.env.FEEDBACK_TO] },
    Content: { Simple: { Subject: { Data: subject, Charset: 'UTF-8' }, Body: { Text: { Data: text, Charset: 'UTF-8' } } } },
  }))
}

/** One answer as an email: reasons first, then the comment and where it came from */
export function composeEmail({ reasons, comment, version, lang, installed }, now = new Date()) {
  const days = installed ? Math.max(0, Math.round((now - new Date(`${installed}T00:00:00Z`)) / 86_400_000)) : null
  const subject = `Deskr uninstall: ${reasons.join(', ') || 'comment only'}${version ? ` (v${version})` : ''}`
  const text = [
    'Why they removed Deskr:',
    ...(reasons.length ? reasons.map((r) => `  • ${REASONS[r]}`) : ['  (no reason ticked)']),
    '',
    'What would have made them stay:',
    comment ? comment.split('\n').map((line) => `  ${line}`).join('\n') : '  (nothing written)',
    '',
    `Version: ${version ?? 'unknown'}`,
    `Language: ${lang}`,
    `Installed: ${installed ? `${installed} (${days} days before removal)` : 'unknown'}`,
  ].join('\n')
  return { subject, text }
}

/** Reads and checks a survey answer; `send` gets the email */
export async function handleFeedback(request, send, ip = '') {
  const wantsJson = (request.headers.get('accept') ?? '').includes('application/json')
  const reply = (status, lang = 'en') =>
    wantsJson
      ? Response.json({ ok: status < 400 }, { status })
      : Response.redirect(new URL(`/bye?sent=${status < 400 ? 1 : 0}&lang=${lang}`, 'https://deskr.cc'), 303)

  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) return reply(413)

  let form
  try {
    form = await request.formData()
  } catch {
    return reply(400)
  }

  const field = (name) => String(form.get(name) ?? '').trim()
  const lang = LANGS.includes(field('lang')) ? field('lang') : 'en'

  // Bots fill every field, people never see this one
  if (field('website')) return reply(200, lang)

  const reasons = [...new Set(form.getAll('reason').map(String))].filter((r) => r in REASONS)
  const comment = field('comment').slice(0, MAX_COMMENT)
  if (!reasons.length && !comment) return reply(400, lang)
  if (!allowed(ip)) return reply(429, lang)

  const version = /^\d+\.\d+\.\d+$/.test(field('v')) ? field('v') : null
  const installed = /^\d{4}-\d{2}-\d{2}$/.test(field('i')) ? field('i') : null

  try {
    await send(composeEmail({ reasons, comment, version, lang, installed }))
  } catch (error) {
    console.error('[feedback] sending failed:', error.message)
    return reply(502, lang)
  }
  return reply(200, lang)
}

async function respond(req, res) {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok')
    return
  }
  // Any path, so it works whether or not the proxy strips /api/uninstall-feedback
  if (req.method !== 'POST') {
    res.writeHead(405, { Allow: 'POST' }).end()
    return
  }
  const request = new Request(`http://localhost${req.url}`, {
    method: 'POST',
    headers: req.headers,
    body: Readable.toWeb(req),
    duplex: 'half',
  })
  const ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || ''
  const response = await handleFeedback(request, sendEmail, String(ip))
  res.writeHead(response.status, Object.fromEntries(response.headers))
  res.end(Buffer.from(await response.arrayBuffer()))
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('server.mjs')) {
  const port = Number(process.env.PORT) || 3000
  createServer((req, res) => respond(req, res).catch((error) => {
    console.error('[feedback]', error)
    if (!res.headersSent) res.writeHead(500).end()
  })).listen(port, () => console.log(`[feedback] listening on ${port}, SES ${ses ? 'on' : 'off (logging only)'}`))
}
