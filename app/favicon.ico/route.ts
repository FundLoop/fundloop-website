const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="18" fill="#082f2a"/>
  <path d="M18 36c8-18 20-18 28 0" fill="none" stroke="#7dd3fc" stroke-width="6" stroke-linecap="round"/>
  <path d="M20 42c7 8 17 8 24 0" fill="none" stroke="#34d399" stroke-width="6" stroke-linecap="round"/>
  <circle cx="32" cy="29" r="5" fill="#fef3c7"/>
</svg>`

export function GET() {
  return new Response(faviconSvg, {
    headers: {
      "Cache-Control": "public, max-age=86400",
      "Content-Type": "image/svg+xml; charset=utf-8",
    },
  })
}
