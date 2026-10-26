// Nav background on scroll, mobile menu, scroll reveals, the card spotlight and analytics events.

// Safe wrapper: window.op is a queue stub until assets/openpanel.js loads.
const track = (name, properties) => {
  try { window.op && window.op('track', name, properties) } catch (_) {}
}

// Every Chrome Web Store link is a conversion; record where it was clicked.
document.querySelectorAll('a[href*="chromewebstore.google.com"]').forEach((link) => {
  link.addEventListener('click', () => {
    const section = link.closest('section[id]')?.id
      || (link.closest('nav') ? 'nav' : link.closest('footer') ? 'footer' : 'page')
    track('install_click', { placement: section, label: (link.textContent || '').trim().slice(0, 60) })
  })
})

document.querySelectorAll('#nav-links a, .footer-links a').forEach((link) => {
  link.addEventListener('click', () => {
    track('nav_click', { label: (link.textContent || '').trim().slice(0, 60), href: link.getAttribute('href') })
  })
})

const nav = document.getElementById('nav')
const toggle = document.getElementById('nav-toggle')

const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 16)
onScroll()
window.addEventListener('scroll', onScroll, { passive: true })

const setMenu = (open) => {
  nav.classList.toggle('is-open', open)
  toggle.setAttribute('aria-expanded', String(open))
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu')
}
toggle.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')))
document.querySelectorAll('#nav-links a').forEach((a) => a.addEventListener('click', () => setMenu(false)))
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false) })

const reveals = document.querySelectorAll('.reveal')
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      entry.target.classList.add('is-visible')
      io.unobserve(entry.target)
    }
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' })
  reveals.forEach((el) => io.observe(el))
} else {
  reveals.forEach((el) => el.classList.add('is-visible'))
}

// The light spot follows the cursor; pointer devices only
if (window.matchMedia('(hover: hover)').matches) {
  document.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect()
      card.style.setProperty('--mx', `${e.clientX - r.left}px`)
      card.style.setProperty('--my', `${e.clientY - r.top}px`)
    })
  })
}
