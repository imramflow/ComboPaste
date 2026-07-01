const RATE_WINDOW = 60000
const RATE_MAX = 10
const MAX_CONTENT_BYTES = 1_048_576
const rateLimits = new Map()

function isRateLimited(ip) {
  const now = Date.now()
  const entry = rateLimits.get(ip)
  if (!entry || now - entry.start > RATE_WINDOW) {
    rateLimits.set(ip, { count: 1, start: now })
    return false
  }
  entry.count++
  return entry.count > RATE_MAX
}

function getClientIP(request) {
  return request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
    || 'unknown'
}

function esc(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function renderViewer(content, { id, lines, chars, expiresAt, createdAt, error } = {}) {
  const expired = expiresAt && Date.now() > expiresAt

  const body = error || expired
    ? `<div class="glass" style="padding:48px;text-align:center;animation:fadeUp 0.5s ease-out">
        <div style="font-size:56px;margin-bottom:16px">${expired ? '⏳' : '🔍'}</div>
        <h2 style="font-size:22px;font-weight:700;margin-bottom:8px">${expired ? 'Paste Expired' : 'Not Found'}</h2>
        <p style="color:rgba(255,255,255,0.35);font-size:14px">${expired ? 'This paste has passed its expiration date and is no longer available.' : 'The paste you\'re looking for doesn\'t exist or has been removed.'}</p>
        <a href="/" style="display:inline-block;margin-top:20px;padding:10px 24px;border-radius:8px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff;text-decoration:none;font-size:14px;font-weight:600">New Paste</a>
       </div>`
    : `<div class="glass" style="padding:0;overflow:hidden;animation:fadeUp 0.5s ease-out 0.1s both">
        <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div style="display:flex;gap:16px;font-size:12px;color:rgba(255,255,255,0.35)">
            <span><strong style="color:rgba(255,255,255,0.5)">${lines.toLocaleString()}</strong> lines</span>
            <span><strong style="color:rgba(255,255,255,0.5)">${chars.toLocaleString()}</strong> chars</span>
            ${expiresAt ? `<span>Expires <strong style="color:#f472b6">${new Date(expiresAt).toLocaleString()}</strong></span>` : ''}
          </div>
          <div style="display:flex;gap:6px">
            <button onclick="navigator.clipboard.writeText(document.getElementById('pasteContent').textContent);this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',2000)" style="padding:6px 16px;border-radius:6px;border:none;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff;font-size:12px;font-weight:600;cursor:pointer">Copy</button>
            <a href="/raw/${id}" download style="padding:6px 16px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;cursor:pointer;transition:all 0.2s;text-decoration:none" onmouseover="this.style.background='rgba(255,255,255,0.12)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">Download</a>
          </div>
        </div>
        <pre id="pasteContent" style="margin:0;padding:20px;font-family:'JetBrains Mono','Fira Code',monospace;font-size:13px;line-height:1.6;color:#e2e8f0;overflow:auto;max-height:70vh;white-space:pre-wrap;word-break:break-all">${esc(content)}</pre>
       </div>`

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ComboPaste</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',sans-serif;background:#07070d;color:#fff;min-height:100vh;-webkit-font-smoothing:antialiased}
    #particleCanvas{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0}
    .bg-orb-1{position:fixed;width:500px;height:500px;top:-150px;right:-100px;background:radial-gradient(circle,rgba(96,165,250,0.1),transparent);border-radius:50%;filter:blur(100px);pointer-events:none;z-index:0;animation:float1 14s ease-in-out infinite}
    .bg-orb-2{position:fixed;width:400px;height:400px;bottom:-100px;left:-100px;background:radial-gradient(circle,rgba(167,139,250,0.08),transparent);border-radius:50%;filter:blur(100px);pointer-events:none;z-index:0;animation:float2 16s ease-in-out infinite}
    @keyframes float1{0%,100%{transform:translate(0,0) scale(1)}25%{transform:translate(50px,-40px) scale(1.08)}50%{transform:translate(-20px,50px) scale(0.95)}75%{transform:translate(-40px,-20px) scale(1.05)}}
    @keyframes float2{0%,100%{transform:translate(0,0) scale(1)}25%{transform:translate(-40px,40px) scale(1.05)}50%{transform:translate(40px,-30px) scale(0.92)}75%{transform:translate(30px,30px) scale(1.08)}}
    .glass{background:rgba(255,255,255,0.05);-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.08);border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.2),inset 0 1px 0 rgba(255,255,255,0.06);position:relative;overflow:hidden;transition:box-shadow 0.3s}
    .glass:hover{box-shadow:0 8px 48px rgba(96,165,250,0.08),0 8px 32px rgba(0,0,0,0.2)}
    .glass::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)}
    @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
    .gradient-text{color:#a78bfa;background:linear-gradient(135deg,#60a5fa,#a78bfa,#f472b6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;background-size:200% 200%;animation:gradientShift 4s ease-in-out infinite}
    @keyframes gradientShift{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
  </style>
</head>
<body>
  <!-- BEGIN AADS AD UNIT 2446349 - Top Banner -->
  <div style="text-align:center;">
    <div style="padding:4px 0;">
      <div style="width:100%;text-align:center;font-size:0;margin:auto;position:relative;">
        <div style="width:100%;margin:auto;position:relative;"><iframe data-aa=2446349 src=//acceptable.a-ads.com/2446349/?size=Adaptive style='border:0; padding:0; width:70%; height:auto; overflow:hidden; margin: auto'></iframe></div>
      </div>
    </div>
  </div>
  <!-- END AADS AD UNIT 2446349 -->

  <!-- BEGIN AADS AD UNIT 2446351 - Left Sidebar -->
  <div style="position: fixed; top: 96px; bottom: 96px; left: 0; width: 15%; min-width: 100px; text-align: center; font-size: 0; z-index: 99999;">
    <div style="height:100%;display:flex;flex-direction:column;justify-content:center;position:relative;">
      <div style="width:100%;margin:auto;position:relative;height:100%;display:flex;flex-direction:column;justify-content:center;">
        <iframe data-aa=2446351 src=//acceptable.a-ads.com/2446351/?size=Adaptive style='border:0; padding:0; width:70%; height:70%; overflow:hidden; margin: 0 auto'></iframe>
      </div>
    </div>
  </div>
  <!-- END AADS AD UNIT 2446351 -->

  <!-- BEGIN AADS AD UNIT 2446352 - Right Sidebar -->
  <div style="position: fixed; top: 96px; bottom: 96px; right: 0; width: 15%; min-width: 100px; text-align: center; font-size: 0; z-index: 99999;">
    <div style="height:100%;display:flex;flex-direction:column;justify-content:center;position:relative;">
      <div style="width:100%;margin:auto;position:relative;height:100%;display:flex;flex-direction:column;justify-content:center;">
        <iframe data-aa=2446352 src=//acceptable.a-ads.com/2446352/?size=Adaptive style='border:0; padding:0; width:70%; height:70%; overflow:hidden; margin: 0 auto'></iframe>
      </div>
    </div>
  </div>
  <!-- END AADS AD UNIT 2446352 -->

  <canvas id="particleCanvas"></canvas>
  <div class="bg-orb-1"></div>
  <div class="bg-orb-2"></div>
  <div style="position:relative;z-index:10;max-width:800px;margin:0 auto;padding:16px">
    <header style="text-align:center;margin-bottom:32px;animation:fadeUp 0.5s ease-out">
      <a href="/" style="text-decoration:none">
        <h1 class="gradient-text" style="font-size:38px;font-weight:800">ComboPaste</h1>
      </a>
    </header>
    ${body}
    <!-- BEGIN AADS AD UNIT 2446353 - Bottom Banner -->
    <div style="text-align:center;margin-top:12px;">
      <div style="padding:4px 0;">
        <div style="width:100%;text-align:center;font-size:0;margin:auto;position:relative;">
          <div style="width:100%;margin:auto;position:relative;"><iframe data-aa=2446353 src=//acceptable.a-ads.com/2446353/?size=Adaptive style='border:0; padding:0; width:70%; height:auto; overflow:hidden; margin: auto'></iframe></div>
        </div>
      </div>
    </div>
    <!-- END AADS AD UNIT 2446353 -->
  </div>
  <script>
    (function(){const c=document.getElementById('particleCanvas'),x=c.getContext('2d');let p=[],a
    function r(){c.width=window.innerWidth;c.height=window.innerHeight}
    r();window.addEventListener('resize',r)
    class P{constructor(){this.x=Math.random()*c.width;this.y=Math.random()*c.height;this.size=Math.random()*2+.5;this.sx=(Math.random()-.5)*.3;this.sy=(Math.random()-.5)*.3;this.o=Math.random()*.4+.1}
    update(){this.x+=this.sx;this.y+=this.sy;if(this.x<0||this.x>c.width)this.sx*=-1;if(this.y<0||this.y>c.height)this.sy*=-1}
    draw(){x.beginPath();x.arc(this.x,this.y,this.size,0,Math.PI*2);x.fillStyle='rgba(167,139,250,'+this.o+')';x.fill()}}
    !function i(){const n=Math.min(Math.floor(c.width*c.height/8000),80);p=Array.from({length:n},()=>new P)}()
    function d(){for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++){const dx=p[i].x-p[j].x,dy=p[i].y-p[j].y,ds=Math.sqrt(dx*dx+dy*dy);if(ds<150){x.beginPath();x.moveTo(p[i].x,p[i].y);x.lineTo(p[j].x,p[j].y);x.strokeStyle='rgba(167,139,250,'+(0.08*(1-ds/150))+')';x.lineWidth=.5;x.stroke()}}
    !function e(){x.clearRect(0,0,c.width,c.height);p.forEach(q=>{q.update();q.draw()});d();a=requestAnimationFrame(e)}()})()
  </script>
</body>
</html>`
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    // Rate limiting
    const ip = getClientIP(request)
    if (isRateLimited(ip)) {
      return new Response('Too many requests', {
        status: 429,
        headers: { 'Access-Control-Allow-Origin': '*', 'Retry-After': '60' },
      })
    }

    // ---- CREATE PASTE ----
    if (path === '/v/create' && method === 'POST') {
      let body
      try { body = await request.json() }
      catch { return new Response('Invalid JSON', { status: 400 }) }

      const content = body.content
      if (!content || !content.trim()) {
        return new Response('No content', { status: 400 })
      }
      if (new TextEncoder().encode(content).length > MAX_CONTENT_BYTES) {
        return new Response('Too large (max 1MB)', { status: 400 })
      }
      if (content.includes('\0')) {
        return new Response('Binary not allowed', { status: 400 })
      }

      const id = Math.random().toString(36).substring(2, 12)
      const filename = id + '.txt'
      const path = 'pastes/' + filename
      const base64 = btoa(unescape(encodeURIComponent(content)))
      const expiresIn = parseInt(body.expiresIn) || 0
      const expiresAt = expiresIn > 0 ? Date.now() + expiresIn * 1000 : null

      // Write paste file
      const res = await fetch(
        `https://api.github.com/repos/${env.OWNER}/${env.DATA_REPO}/contents/${path}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': 'Bearer ' + env.PAT,
            'Content-Type': 'application/json',
            'User-Agent': 'combo-paste-worker',
          },
          body: JSON.stringify({
            message: 'Add paste ' + id,
            content: base64,
          }),
        }
      )

      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        return new Response(
          JSON.stringify({ error: 'GitHub API error: ' + res.status }),
          { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        )
      }

      // Update meta
      if (expiresAt) {
        const metaRes = await fetch(
          `https://api.github.com/repos/${env.OWNER}/${env.DATA_REPO}/contents/pastes/_meta.json`,
          {
            headers: {
              'Authorization': 'Bearer ' + env.PAT,
              'User-Agent': 'combo-paste-worker',
            },
          }
        )
        let meta = {}
        let metaSha = null
        if (metaRes.ok) {
          const metaData = await metaRes.json()
          meta = JSON.parse(decodeURIComponent(escape(atob(metaData.content))))
          metaSha = metaData.sha
        }
        meta[id] = { expiresAt, createdAt: Date.now() }

        await fetch(
          `https://api.github.com/repos/${env.OWNER}/${env.DATA_REPO}/contents/pastes/_meta.json`,
          {
            method: 'PUT',
            headers: {
              'Authorization': 'Bearer ' + env.PAT,
              'Content-Type': 'application/json',
              'User-Agent': 'combo-paste-worker',
            },
            body: JSON.stringify({
              message: 'Update meta for ' + id,
              content: btoa(unescape(encodeURIComponent(JSON.stringify(meta)))),
              sha: metaSha || undefined,
            }),
          }
        )
      }

      // Dispatch
      fetch(
        `https://api.github.com/repos/${env.OWNER}/${env.SOURCE_REPO}/dispatches`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + env.PAT,
            'Content-Type': 'application/json',
            'User-Agent': 'combo-paste-worker',
          },
          body: JSON.stringify({
            event_type: 'paste-created',
            client_payload: { id, filename },
          }),
        }
      ).catch(() => {})

      return new Response(JSON.stringify({ link: `https://combopaste.site/v/${id}` }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    // ---- VIEW PASTE ----
    const match = path.match(/^\/v\/([a-z0-9]+)$/)
    if (match && method === 'GET') {
      const id = match[1]

      const res = await fetch(
        `https://api.github.com/repos/${env.OWNER}/${env.DATA_REPO}/contents/pastes/${id}.txt`,
        {
          headers: {
            'Authorization': 'Bearer ' + env.PAT,
            'User-Agent': 'combo-paste-worker',
          },
        }
      )

      if (res.status === 404) {
        return new Response(renderViewer(null, { error: true }), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      }

      if (!res.ok) {
        return new Response(renderViewer(null, { error: true }), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      }

      const data = await res.json()
      const content = decodeURIComponent(escape(atob(data.content)))
      const lines = content.split('\n').length
      const chars = content.length

      // Check expiry
      let expiresAt = null
      const metaRes = await fetch(
        `https://api.github.com/repos/${env.OWNER}/${env.DATA_REPO}/contents/pastes/_meta.json`,
        {
          headers: {
            'Authorization': 'Bearer ' + env.PAT,
            'User-Agent': 'combo-paste-worker',
          },
        }
      )

      if (metaRes.ok) {
        const metaData = await metaRes.json()
        const meta = JSON.parse(decodeURIComponent(escape(atob(metaData.content))))
        if (meta[id] && meta[id].expiresAt) {
          expiresAt = meta[id].expiresAt
          if (Date.now() > expiresAt) {
            return new Response(renderViewer(null, { expired: true }), {
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            })
          }
        }
      }

      return new Response(renderViewer(content, { id, lines, chars, expiresAt }), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    // ---- RAW DOWNLOAD ----
    const rawMatch = path.match(/^\/raw\/([a-z0-9]+)$/)
    if (rawMatch && method === 'GET') {
      const id = rawMatch[1]
      const res = await fetch(
        `https://api.github.com/repos/${env.OWNER}/${env.DATA_REPO}/contents/pastes/${id}.txt`,
        {
          headers: {
            'Authorization': 'Bearer ' + env.PAT,
            'User-Agent': 'combo-paste-worker',
          },
        }
      )
      if (res.status === 404 || !res.ok) return new Response('Not found', { status: 404 })
      const data = await res.json()
      const content = decodeURIComponent(escape(atob(data.content)))
      return new Response(content, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': 'attachment; filename="combolist.txt"',
        },
      })
    }

    // ---- WWW → APEX REDIRECT ----
    if (url.hostname === 'www.combopaste.site') {
      return Response.redirect(`https://combopaste.site${path}`, 301)
    }

    // ---- SERVE INDEX ----
    if ((path === '/' || path === '/index.html') && method === 'GET') {
      const res = await fetch(
        `https://api.github.com/repos/${env.OWNER}/${env.SOURCE_REPO}/contents/public/index.html`,
        {
          headers: {
            'Authorization': 'Bearer ' + env.PAT,
            'User-Agent': 'combo-paste-worker',
          },
        }
      )
      if (!res.ok) return new Response('Not found', { status: 404 })
      const data = await res.json()
      const html = decodeURIComponent(escape(atob(data.content)))
      return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    return new Response('Not found', { status: 404 })
  },
}
