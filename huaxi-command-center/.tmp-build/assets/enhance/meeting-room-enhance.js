/**
 * 会诊室 #/room/:token — 仅非 app.html 的占位（app.html 用 React main.meeting，p4）
 */
;(function () {
  if (/\/app\.html$/i.test(location.pathname)) {
    return
  }

  var BADGE = '演示环境 · 音视频为占位，非商用 RTC'
  var STYLE_ID = 'hx-meeting-room-style'
  var HOST_ID = 'hx-consult-room-host'
  var BODY_FLAG = 'hx-consult-room-active'

  function path() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function inRoomPath() {
    var p = path()
    return p.indexOf('/room/') === 0 || p.indexOf('/join/') === 0 || p.indexOf('/consultation/') === 0
  }

  function tokenFromPath() {
    var p = path()
    if (!inRoomPath()) return ''
    return decodeURIComponent(p.split('/')[2] || '')
  }

  function apiBase() {
    var cfg = window.HX_API_CONFIG
    if (cfg && cfg.base) return String(cfg.base).replace(/\/$/, '')
    return '/backend-api'
  }

  function jwt() {
    try {
      return sessionStorage.getItem('huaxi-jwt-token') || localStorage.getItem('huaxi-jwt-token') || ''
    } catch (e) {
      return ''
    }
  }

  function apiGet(pathname) {
    var url = apiBase() + '/v1' + pathname
    var headers = { Accept: 'application/json' }
    var token = jwt()
    if (token) headers.Authorization = 'Bearer ' + token
    return fetch(url, { headers: headers })
      .then(function (res) {
        return res.json().catch(function () {
          return {}
        }).then(function (json) {
          if (!res.ok || (json && json.code && json.code !== 200)) {
            throw new Error((json && json.message) || 'HTTP ' + res.status)
          }
          return json && Object.prototype.hasOwnProperty.call(json, 'data') ? json.data : json
        })
      })
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return
    var s = document.createElement('style')
    s.id = STYLE_ID
    s.textContent =
      'body.' +
      BODY_FLAG +
      '{overflow:hidden}' +
      '#' +
      HOST_ID +
      '{position:fixed;z-index:35;overflow:auto;background:#f0f3f7;padding:10px 12px;box-sizing:border-box}' +
      '.hx-consult-room{margin:0;padding:0}' +
      '.hx-consult-room__head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 10px;flex-wrap:wrap}' +
      '.hx-consult-room__head h3{margin:0;font-size:17px;font-weight:600;color:#1e293b}' +
      '.hx-meeting-demo-badge{font-size:11px;color:#64748b;background:#fff;border:1px solid #e2e8f0;padding:4px 10px;border-radius:999px}'
    document.head.appendChild(s)
  }

  function place(host) {
    host.style.top = '0'
    host.style.left = '0'
    host.style.width = '100vw'
    host.style.height = '100dvh'
    host.style.display = 'block'
  }

  function stageHtml(meta) {
    var tok = tokenFromPath()
    var patient = (meta && meta.patient) || {}
    var name = patient.name || '—'
    return (
      '<div class="hx-consult-room panel"><div class="hx-consult-room__head"><h3>远程会诊室 · ' +
      esc(name) +
      '</h3><span class="hx-meeting-demo-badge">' +
      BADGE +
      '</span></div><p>请使用 app.html 打开以加载完整会诊室 UI。</p></div>'
    )
  }

  function unmount() {
    document.body.classList.remove(BODY_FLAG)
    var el = document.getElementById(HOST_ID)
    if (el) el.remove()
  }

  function tick() {
    if (!inRoomPath()) {
      unmount()
      return
    }
    ensureStyle()
    document.body.classList.add(BODY_FLAG)
    var host = document.getElementById(HOST_ID)
    if (!host) {
      host = document.createElement('div')
      host.id = HOST_ID
      document.body.appendChild(host)
      host.innerHTML = stageHtml(null)
      loadRoomMeta(tokenFromPath()).then(function (meta) {
        if (!document.getElementById(HOST_ID) || !inRoomPath()) return
        host.innerHTML = stageHtml(meta)
      })
    }
    place(host)
  }

  function loadRoomMeta(rawToken) {
    if (!rawToken) return Promise.resolve(null)
    return apiGet('/rooms/' + encodeURIComponent(rawToken)).catch(function () {
      return null
    })
  }

  window.hxEnhance(tick, { wait: 280, afterNav: 80 })
})()
