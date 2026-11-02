/**
 * Saves an answer from the uninstall survey (bye.html) to D1.
 *
 * deskr.cc itself is static (Coolify on Atlas) behind Cloudflare; this Worker
 * runs on the route deskr.cc/api/uninstall-feedback in front of it.
 * Setup and deploy: see worker/README.md.
 *
 * Anonymous on purpose: no IP address, user agent, email or name is stored.
 */

const REASONS = ['old-tab', 'trying', 'missing', 'bug', 'sync', 'slow', 'cluttered', 'other-extension', 'privacy', 'other']
const LANGS = ['en', 'sk', 'sr']
const MAX_COMMENT = 2000

export async function handleFeedback(request, env) {
  const wantsJson = (request.headers.get('accept') ?? '').includes('application/json')
  const reply = (status, lang) =>
    wantsJson
      ? Response.json({ ok: status < 400 }, { status })
      : Response.redirect(new URL(`/bye?sent=${status < 400 ? 1 : 0}&lang=${lang}`, request.url), 303)

  let form
  try {
    form = await request.formData()
  } catch {
    return reply(400, 'en')
  }

  const field = (name) => String(form.get(name) ?? '').trim()
  const lang = LANGS.includes(field('lang')) ? field('lang') : 'en'

  // Bots fill every field, people never see this one
  if (field('website')) return reply(200, lang)

  const reasons = [...new Set(form.getAll('reason').map(String))].filter((r) => REASONS.includes(r))
  const comment = field('comment').slice(0, MAX_COMMENT)
  if (!reasons.length && !comment) return reply(400, lang)

  const version = /^\d+\.\d+\.\d+$/.test(field('v')) ? field('v') : null
  const installed = /^\d{4}-\d{2}-\d{2}$/.test(field('i')) ? field('i') : null

  if (!env.DB) return reply(503, lang)
  await env.DB.prepare('INSERT INTO uninstall_feedback (reasons, comment, version, lang, installed) VALUES (?, ?, ?, ?, ?)')
    .bind(reasons.join(','), comment || null, version, lang, installed)
    .run()

  return reply(200, lang)
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } })
    return handleFeedback(request, env)
  },
}
