/**
 * 重症监护网格：占用/有视频/有绑定的床不再显示「空床」，补全患者摘要；与科室监控双向联动
 */
;(function () {
  let ctx = null
  let loadPromise = null

  const ORG_BTN = {
    weiyuan: '威远',
    huaxi: '华西',
    'neijiang-first': '内江',
  }

  function path() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function hashQuery() {
    const raw = location.hash.replace(/^#/, '')
    const q = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : ''
    return new URLSearchParams(q)
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  function deptWarningHash(org) {
    const qs = new URLSearchParams({ view: 'departments', dept: 'icu' })
    if (org) qs.set('org', org)
    return `#/warning?${qs.toString()}`
  }

  function selectedInstitutionId() {
    const fromHash = hashQuery().get('org')
    if (fromHash) return fromHash
    const sel = document.querySelector('.critical-toolbar .segmented button.selected')
    const t = (sel?.textContent || '').trim()
    if (!t || t.includes('乡镇')) return 'weiyuan'
    if (t.includes('华西')) return 'huaxi'
    if (t.includes('内江')) return 'neijiang-first'
    if (t.includes('威远')) return 'weiyuan'
    return 'weiyuan'
  }

  function applyOrgFromHash() {
    if (path() !== '/critical') return
    const org = hashQuery().get('org')
    if (!org) return
    const needle = ORG_BTN[org] || org
    document.querySelectorAll('.critical-toolbar .segmented button').forEach((btn) => {
      const label = (btn.textContent || '').trim()
      if (label.includes(needle) && !btn.classList.contains('selected')) {
        btn.click()
      }
    })
  }

  function ensureDeptWarningLink() {
    if (path() !== '/critical') {
      document.getElementById('hx-critical-dept-link')?.remove()
      return
    }
    const bar = document.querySelector('.critical-toolbar')
    if (!bar) return
    let a = document.getElementById('hx-critical-dept-link')
    const org = selectedInstitutionId()
    const href = deptWarningHash(org)
    if (!a) {
      a = document.createElement('a')
      a.id = 'hx-critical-dept-link'
      a.className = 'hx-critical-dept-link'
      const seg = bar.querySelector('.segmented')
      if (seg) seg.insertAdjacentElement('afterend', a)
      else bar.appendChild(a)
    }
    if (a.getAttribute('href') !== href) a.setAttribute('href', href)
    a.textContent = '本科室预警台'
  }

  function highlightBedFromHash() {
    document.querySelectorAll('.critical-bed.hx-critical-bed--focus').forEach((el) => {
      el.classList.remove('hx-critical-bed--focus')
    })
    if (path() !== '/critical') return
    const bedId = hashQuery().get('bed')
    if (!bedId) return
    const card =
      document.querySelector(`.critical-bed[data-hx-bed-id="${CSS.escape(bedId)}"]`) ||
      document.querySelector(`.critical-bed[data-hx-bed-id="${bedId}"]`)
    if (!card) return
    card.classList.add('hx-critical-bed--focus')
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  function loadCtx() {
    if (ctx) return Promise.resolve(ctx)
    if (loadPromise) return loadPromise
    loadPromise = Promise.all([
      fetch('/api/care-bindings.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { bindings: [] })),
      fetch('/scenario.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : {})),
    ])
      .then(([care, scen]) => {
        const state = scen.state || scen
        const patients = state.patients || []
        const beds = state.beds || []
        const byBed = new Map()
        for (const row of care.bindings || []) {
          if (row.bedId) byBed.set(row.bedId, row)
        }
        ctx = { patients, beds, byBed }
        return ctx
      })
      .catch(() => {
        ctx = { patients: [], beds: [], byBed: new Map() }
        return ctx
      })
    return loadPromise
  }

  function bedsForGrid(instId) {
    return ctx.beds.filter((b) => b.institutionId === instId && b.departmentId === 'icu')
  }

  function hasMonitorMedia(card) {
    return !!(
      card.querySelector('video[data-hx-bed-cam], video[data-hx-town-cam], .bed-mini-monitor, .video-pane video')
    )
  }

  function buildSummary(bed, bind, pat) {
    const name = pat?.name || bind?.patientName
    if (!name) return null
    const gender = pat?.gender || '—'
    const age = pat?.age != null ? `${pat.age} 岁` : '—'
    const created = pat?.createdAt
      ? new Date(pat.createdAt).toLocaleString('zh-CN', { hour12: false })
      : '—'
    const symptoms = (pat?.symptoms || []).filter(Boolean).join('、') || '—'
    const patHref = pat?.id ? `/#/patient/${encodeURIComponent(pat.id)}` : bind?.patientId ? `/#/patient/${encodeURIComponent(bind.patientId)}` : ''
    const bedHref = bed?.id ? `/#/bed/${encodeURIComponent(bed.id)}` : ''
    const org = bed?.institutionId || selectedInstitutionId()
    const warnHref = deptWarningHash(org)

    return `<p>患者：<b>${esc(name)}</b>，${esc(gender)}，${esc(age)}</p>
      <p>入区：${esc(created)}</p>
      <p>主诉：${esc(symptoms)}</p>
      <p>预警：暂无</p>
      <p>管床：科室医生（演示账号）</p>
      <p class="hx-bed-card-links">
        ${patHref ? `<a href="${esc(patHref)}">患者档案</a>` : ''}
        ${bedHref ? ` · <a href="${esc(bedHref)}">床旁详情</a>` : ''}
         · <a href="${esc(warnHref)}">预警台</a>
      </p>`
  }

  let syncing = false

  function syncOnce() {
    if (syncing) return
    if (path() !== '/critical') return
    if (document.querySelector('.town-monitor')) return
    syncing = true
    try {
    syncOnceBody()
    } finally {
      syncing = false
    }
  }

  function syncOnceBody() {

    applyOrgFromHash()
    ensureDeptWarningLink()

    const grid = document.querySelector('.critical-grid')
    if (!grid) return

    loadCtx().then(() => {
      const instId = selectedInstitutionId()
      const icuBeds = bedsForGrid(instId)
      const cards = [...grid.querySelectorAll('.critical-bed')]

      cards.forEach((card, idx) => {
        const bed = icuBeds[idx]
        if (bed?.id) {
          card.dataset.hxBedId = bed.id
        } else {
          delete card.dataset.hxBedId
        }

        const free = card.querySelector('.bed-summary .free-bed')
        if (!free) return

        const bind = bed?.id ? ctx.byBed.get(bed.id) : null
        let pat = bed?.patientId ? ctx.patients.find((p) => p.id === bed.patientId) : null
        if (!pat && bind?.patientId) {
          pat = ctx.patients.find((p) => p.id === bind.patientId)
        }

        if (bed?.status === 'available' && !bed?.patientId && !pat && !bind?.patientName) return

        const shouldFill =
          pat ||
          bind?.patientName ||
          bed?.patientId ||
          bed?.status === 'occupied' ||
          bed?.status === 'reserved'
        if (!shouldFill) return

        const html = buildSummary(bed, bind, pat)
        if (!html) {
          if (hasMonitorMedia(card) && bind?.patientName) {
            free.outerHTML = `<div class="hx-bed-summary-patched"><p>患者：<b>${esc(bind.patientName)}</b></p><p>床旁远程监护中</p></div>`
          }
          return
        }

        const wrap = card.querySelector('.bed-summary')
        if (wrap) {
          wrap.innerHTML = html
          wrap.classList.add('hx-bed-summary-patched')
        }
      })

      highlightBedFromHash()
    })
  }

  function boot() {
    syncOnce()
    setInterval(syncOnce, 2000)
    window.addEventListener('hashchange', () => {
      ctx = null
      loadPromise = null
      syncOnce()
    })
  }

  boot()
})()
