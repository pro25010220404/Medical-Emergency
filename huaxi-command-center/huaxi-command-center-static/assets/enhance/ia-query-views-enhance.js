/**
 * 科室监控内嵌科室床位、/beds 与旧 sub-hospitals 链接重定向
 */
;(function () {
  function pathAndQuery() {
    const raw = location.hash.replace(/^#/, '') || '/'
    const [pathname, search = ''] = raw.split('?')
    const p = (pathname || '/').replace(/\/$/, '') || '/'
    return { p, q: new URLSearchParams(search) }
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  function cleanNotice(s) {
    return String(s || '')
      .replace(/演示\s*Mock[^·]*·?\s*/gi, '')
      .replace(/非实时\s*HIS/gi, '')
      .trim()
  }

  function findDeptHost() {
    const main = document.querySelector('main.department-overview.screen')
    if (!main) return null
    return main.querySelector('section') || main
  }

  function mount(host, id, html) {
    if (!host) return false
    let box = document.getElementById(id)
    if (!box) {
      box = document.createElement('div')
      box.id = id
      host.appendChild(box)
    }
    if (box.dataset.html === html) return true
    box.dataset.html = html
    box.innerHTML = html
    return true
  }

  function remove(id) {
    document.getElementById(id)?.remove()
  }

  function syncViewMode() {
    const { p, q } = pathAndQuery()
    const dept = p === '/warning' && q.get('view') === 'departments'
    document.body.classList.remove('hx-ia-sub-hospitals-view')
    document.body.classList.toggle('hx-ia-departments-view', dept)
  }

  /** React 科室监控右栏自带「手机通知」演示块，桌面科室页应走侧栏「手机通知演示」路由 */
  function hidePhoneNoticeOnDepartmentView() {
    const { p, q } = pathAndQuery()
    const dept = p === '/warning' && q.get('view') === 'departments'
    document.querySelectorAll('main.department-overview.screen .panel[data-hx-desktop-hidden]').forEach((panel) => {
      panel.removeAttribute('data-hx-desktop-hidden')
      panel.hidden = false
    })
    if (!dept) return
    const main = document.querySelector('main.department-overview.screen')
    if (!main) return
    main.querySelectorAll('.panel').forEach((panel) => {
      const titleEl = panel.querySelector('.panel-title h2, .panel-title')
      const title = (titleEl?.textContent || '').replace(/\s+/g, '')
      if (!title.includes('手机通知')) return
      panel.setAttribute('data-hx-desktop-hidden', '1')
      panel.hidden = true
    })
  }

  function redirectSubHospitalsRoute() {
    const { p, q } = pathAndQuery()
    if (p !== '/warning' || q.get('view') !== 'sub-hospitals') return
    const qs = new URLSearchParams({ view: 'departments' })
    location.replace(`${location.pathname}${location.search}#/warning?${qs.toString()}`)
  }

  function redirectBedsRoute() {
    const { p, q } = pathAndQuery()
    if (p !== '/beds') return
    const org = q.get('org') || ''
    const dept = q.get('dept') || ''
    const qs = new URLSearchParams({ view: 'departments' })
    if (org) qs.set('org', org)
    if (dept) qs.set('dept', dept)
    location.replace(`${location.pathname}${location.search}#/warning?${qs.toString()}`)
  }

  function renderDeptBeds() {
    const { p, q } = pathAndQuery()
    remove('hx-dept-beds-panel')
    if (p !== '/warning' || q.get('view') !== 'departments') return
    const host = findDeptHost()
    if (!host) return

    const focusDept = q.get('dept') || ''
    host.querySelectorAll('.department-matrix a[href*="/beds"]').forEach((a) => {
      const href = a.getAttribute('href') || ''
      const m = href.match(/org=([^&]+).*dept=([^&]+)/)
      if (!m) return
      a.setAttribute('href', `#/warning?view=departments&org=${decodeURIComponent(m[1])}&dept=${decodeURIComponent(m[2])}`)
    })

    if (focusDept) {
      const card = host.querySelector(
        `.department-matrix [data-dept="${CSS.escape(focusDept)}"], .department-matrix a[href*="dept=${encodeURIComponent(focusDept)}"]`,
      )
      card?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  function renderGrassrootsRemote(data) {
    const { p, q } = pathAndQuery()
    if (p !== '/critical' || q.get('mode') !== 'grassroots-remote') {
      remove('hx-grassroots-remote')
      return
    }
    const host =
      document.querySelector('main.workspace') ||
      document.querySelector('main.critical-screen') ||
      findDeptHost()
    if (!host || !data) return
    const cards = (data.sites || [])
      .map(
        (s) => `<article class="hx-gr-card">
          <h3>${esc(s.name)}</h3>
          <p><span class="muted">患者</span> ${esc(s.patient)}</p>
          <p><span class="muted">体征</span> ${esc(s.vitals)}</p>
          <div class="hx-gr-actions">
            <a class="hx-gr-btn" href="${esc(s.videoHref)}">重症监护</a>
            <a class="hx-gr-btn ghost" href="${esc(s.bedHref)}">床位 / ICU</a>
          </div>
        </article>`,
      )
      .join('')
    const notice = cleanNotice(data.notice)
    const html = `<section class="hx-grassroots-remote" aria-label="${esc(data.title)}">
      <header class="hx-ia-view-head"><strong>${esc(data.title)}</strong>${notice ? `<span>${esc(notice)}</span>` : ''}</header>
      <div class="hx-gr-grid">${cards || '<p class="hx-ia-view-empty">暂无监护点数据</p>'}</div>
    </section>`
    mount(host, 'hx-grassroots-remote', html)
  }

  function buildBedStatsHtml(byDept, reserved) {
    const depts = byDept?.departments || []
    const reservedList = reserved?.list || []
    const updated = fmtMonitorTime(byDept?.updatedAt || reserved?.updatedAt)
    const deptRows = depts
      .map((d) => {
        const total = Number(d.total) || 0
        const occupied = Number(d.occupied) || 0
        const rate = total > 0 ? Math.round((occupied / total) * 100) : 0
        return `<tr><td>${esc(d.name)}</td><td>${total}</td><td>${occupied}</td><td>${Number(d.reserved) || 0}</td><td>${Number(d.free) || 0}</td><td>${rate}%</td></tr>`
      })
      .join('')
    const reservedRows = reservedList
      .map((r) => {
        const until = r.reservedUntil ? fmtMonitorTime(r.reservedUntil) : '—'
        return `<tr><td>${esc(r.label)}</td><td>${esc(r.departmentName || '')}</td><td>${esc(r.reserveReason || '—')}</td><td>${until}</td></tr>`
      })
      .join('')
    return `<section class="hx-beds-live" aria-label="床位实时数据">
      <style>
        .hx-beds-live{margin:16px 0;padding:14px 16px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-sizing:border-box;clear:both;}
        .hx-beds-live .hx-beds-live-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;}
        .hx-beds-live .hx-beds-live-head strong{font-size:15px;color:#111827;font-weight:600;}
        .hx-beds-live .hx-beds-live-head span{font-size:12px;color:#9ca3af;}
        .hx-beds-live .hx-beds-live-title{margin:14px 0 6px;font-size:13px;font-weight:600;color:#374151;}
        .hx-beds-live table{width:100%;border-collapse:collapse;}
        .hx-beds-live th,.hx-beds-live td{padding:6px 10px;border:1px solid #e5e7eb;text-align:left;font-size:13px;line-height:1.5;vertical-align:middle;}
        .hx-beds-live th{background:#f9fafb;color:#6b7280;font-weight:600;white-space:nowrap;}
        .hx-beds-live td{color:#111827;}
        .department-matrix>a{align-items:flex-start;gap:12px;}
        .department-matrix>a>div{min-width:0;flex:1 1 auto;}
        .department-matrix h3{white-space:normal;word-break:break-word;overflow-wrap:anywhere;line-height:1.35;}
      </style>
      <div class="hx-beds-live-head"><strong>科室床位</strong>${updated ? `<span>更新 ${updated}</span>` : ''}</div>
      <div class="hx-beds-live-title">按科室床位</div>
      <table>
        <thead><tr><th>科室</th><th>总床</th><th>占用</th><th>预留</th><th>空床</th><th>占用率</th></tr></thead>
        <tbody>${deptRows || '<tr><td colspan="6">暂无数据</td></tr>'}</tbody>
      </table>
      <div class="hx-beds-live-title">预留床位</div>
      <table>
        <thead><tr><th>床号</th><th>科室</th><th>预留原因</th><th>预留截止</th></tr></thead>
        <tbody>${reservedRows || '<tr><td colspan="4">暂无预留</td></tr>'}</tbody>
      </table>
    </section>`
  }

  function renderBedStats() {
    const { p, q } = pathAndQuery()
    remove('hx-beds-live-panel')
    if (p !== '/warning' || q.get('view') !== 'departments') return
    if (typeof window.hxBackend?.get !== 'function') return
    Promise.all([
      window.hxBackend.get('/beds/by-dept').catch(() => null),
      window.hxBackend.get('/beds/reserved').catch(() => null),
    ]).then(([byDept, reserved]) => {
      const html = buildBedStatsHtml(byDept, reserved)
      let tries = 0
      const tryMount = () => {
        if (pathAndQuery().p !== '/warning' || pathAndQuery().q.get('view') !== 'departments') return
        const host = findDeptHost()
        if (!host) {
          if (++tries < 20) setTimeout(tryMount, 300)
          return
        }
        mount(host, 'hx-beds-live-panel', html)
      }
      tryMount()
    })
  }

  const remoteCache = { value: null, promise: null }
  const bedsCache = { value: null, promise: null }
  const monitorCache = { value: null, promise: null }
  const linkCtxCache = { value: null, promise: null }

  function currentOrg(ctx) {
    const { q } = pathAndQuery()
    return q.get('org') || ctx?.institutionId || 'weiyuan'
  }

  function criticalHash(org, bedId) {
    const qs = new URLSearchParams()
    if (org) qs.set('org', org)
    if (bedId) qs.set('bed', bedId)
    const tail = qs.toString()
    return `#/critical${tail ? `?${tail}` : ''}`
  }

  function deptWarningHash(org, dept) {
    const qs = new URLSearchParams({ view: 'departments' })
    if (org) qs.set('org', org)
    if (dept) qs.set('dept', dept || 'icu')
    return `#/warning?${qs.toString()}`
  }

  function loadLinkCtx() {
    if (linkCtxCache.value) return Promise.resolve(linkCtxCache.value)
    if (linkCtxCache.promise) return linkCtxCache.promise
    linkCtxCache.promise = fetch('/scenario.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : {}))
      .then((pack) => {
        const state = pack.state || pack
        linkCtxCache.value = { beds: state.beds || [], patients: state.patients || [] }
        return linkCtxCache.value
      })
      .catch(() => {
        linkCtxCache.value = { beds: [], patients: [] }
        return linkCtxCache.value
      })
    return linkCtxCache.promise
  }

  function resolveBedId(bedLabel, instId, beds) {
    const raw = String(bedLabel || '').trim()
    if (!raw) return null
    const icu = raw.match(/^ICU[-\s]?0*(\d+)/i)
    if (icu) {
      const id = `${instId}-icu-${icu[1]}`
      if (beds.some((b) => b.id === id)) return id
    }
    const byLabel = beds.find(
      (b) =>
        b.institutionId === instId &&
        (b.label === raw || `${b.label}` === raw.replace(/^ICU[-\s]?/i, '') || raw.includes(b.label)),
    )
    return byLabel?.id || null
  }

  function isIcuBedLabel(bedLabel) {
    return /^ICU/i.test(String(bedLabel || '').trim())
  }

  function bedCellHtml(bedLabel, org, beds) {
    const bedId = resolveBedId(bedLabel, org, beds)
    const label = esc(bedLabel || '—')
    if (!bedId) return label
    return `<a class="hx-dm-bed-link" href="#/bed/${encodeURIComponent(bedId)}" title="床旁监护">${label}</a>`
  }

  function bedRowActions(bedLabel, org, beds) {
    const bedId = resolveBedId(bedLabel, org, beds)
    if (!bedId) return '—'
    return `<span class="hx-dm-row-actions">
      <a href="#/bed/${encodeURIComponent(bedId)}">床旁</a>
      <a href="${esc(criticalHash(org, bedId))}">ICU</a>
    </span>`
  }

  function kpiLinkHref(label, org) {
    const t = String(label || '')
    if (t.includes('NEWS')) return '#hx-dm-panel-news'
    if (t.includes('危急值')) return '#/warning?view=labs'
    if (t.includes('床位占用')) return criticalHash(org)
    if (t.includes('新预警')) return '#hx-dm-pending-panel'
    return null
  }

  function findIcuBedForPatient(patientId, org, beds) {
    if (!patientId) return null
    return (
      beds.find(
        (b) => b.patientId === patientId && b.institutionId === org && b.departmentId === 'icu',
      ) || null
    )
  }

  function panelDataKey(titleRaw) {
    const n = String(titleRaw || '').replace(/\s+/g, '')
    if (n.includes('检验危急')) return 'criticalLabs'
    if (n.includes('血管活性')) return 'vasoactive'
    if (n.includes('NEWS') || n.includes('体征')) return 'newsScores'
    return null
  }

  function fmtMonitorTime(iso) {
    if (!iso) return '—'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return String(iso).slice(11, 16) || '—'
    return d.toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  function toneClass(tone) {
    if (tone === 'danger') return 'hx-dm-kpi--danger'
    if (tone === 'warn') return 'hx-dm-kpi--warn'
    if (tone === 'info') return 'hx-dm-kpi--info'
    return ''
  }

  function statusPill(s) {
    const t = String(s || '')
    let cls = 'hx-dm-pill'
    if (/待|未/.test(t)) cls += ' hx-dm-pill--wait'
    else if (/干预|进行/.test(t)) cls += ' hx-dm-pill--doing'
    else cls += ' hx-dm-pill--ok'
    return `<span class="${cls}">${esc(t || '—')}</span>`
  }

  function compactTable(rows, cols, org, beds) {
    if (!rows.length) return ''
    const head = cols.map((c) => `<th>${esc(c.label)}</th>`).join('') + '<th>联动</th>'
    const body = rows
      .map((row) => {
        const tds = cols
          .map((c) => {
            let raw = typeof c.key === 'function' ? c.key(row) : row[c.key]
            if (c.key === 'bed' && org && beds) raw = bedCellHtml(row.bed, org, beds)
            return `<td>${raw ?? '—'}</td>`
          })
          .join('')
        const actions = org && beds ? bedRowActions(row.bed, org, beds) : '—'
        return `<tr>${tds}<td class="hx-dm-mini-actions">${actions}</td></tr>`
      })
      .join('')
    return `<div class="hx-dm-mini-table business-table"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`
  }

  function renderMonitorBanner(mainEl, ctx, org) {
    if (!mainEl || !ctx) return
    const shift = ctx.shift || {}
    const kpis = ctx.kpis || []
    const links = ctx.quickLinks || []
    const kpiHtml = kpis
      .map((k) => {
        const href = kpiLinkHref(k.label, org)
        const inner =
          `<span class="hx-dm-kpi-label">${esc(k.label)}</span>` +
          `<strong class="hx-dm-kpi-val">${esc(k.value)}</strong>` +
          `<small>${esc(k.hint || '')}</small>`
        if (!href) {
          return `<article class="hx-dm-kpi ${toneClass(k.tone)}">${inner}</article>`
        }
        const isHash = href.startsWith('#/') || href.startsWith('#')
        const cls = `hx-dm-kpi ${toneClass(k.tone)} hx-dm-kpi--link`
        if (isHash && !href.startsWith('#/')) {
          return `<a class="${cls}" href="${esc(href)}" data-hx-dm-scroll="1">${inner}</a>`
        }
        return `<a class="${cls}" href="${esc(href)}">${inner}</a>`
      })
      .join('')
    const linkHtml = links
      .map((l) => `<a class="hx-dm-quick" href="${esc(l.href)}">${esc(l.label)}</a>`)
      .join('')
    const html = `<header id="hx-dept-monitor-banner" class="hx-dept-monitor-banner" aria-label="科室监控概览">
      <div class="hx-dept-monitor-banner-top">
        <div>
          <strong>${esc(ctx.hospitalName || '本院')}</strong>
          <span>${esc(ctx.campus || '')} · 科室早期预警工作台</span>
        </div>
        <div class="hx-dept-monitor-shift">
          <span class="hx-dm-pill hx-dm-pill--shift">${esc(shift.label || '值班')}</span>
          <span>${esc(shift.window || '')}</span>
          <span>总值 ${esc(shift.dutyDoctor || '—')}</span>
          <span>总护 ${esc(shift.chargeNurse || '—')}</span>
        </div>
        <time class="hx-dept-monitor-time">刷新 ${esc(fmtMonitorTime(ctx.updatedAt))}</time>
      </div>
      <div class="hx-dept-monitor-kpis">${kpiHtml}</div>
      <p class="hx-dept-monitor-note">${esc(shift.note || '')}</p>
      <nav class="hx-dept-monitor-links" aria-label="快捷入口">${linkHtml}</nav>
    </header>`
    let box = document.getElementById('hx-dept-monitor-banner')
    if (box && box.dataset.html === html) return
    remove('hx-dept-monitor-banner')
    mainEl.insertAdjacentHTML('afterbegin', html)
    box = document.getElementById('hx-dept-monitor-banner')
    if (box) box.dataset.html = html
  }

  function syncPanelWarningCounts(panel, rows) {
    if (!rows.length) return
    const counts = panel.querySelector('.warning-counts')
    if (!counts) return
    const bs = counts.querySelectorAll('b')
    if (!bs.length) return
    const pending = rows.filter((r) => /待|未/.test(String(r.status || ''))).length
    const done = rows.filter((r) => /干预|已|进行|结案/.test(String(r.status || ''))).length
    const total = rows.length
    const sum = [...bs].reduce((n, b) => n + (Number(b.textContent) || 0), 0)
    if (sum > 0) return
    if (bs[0]) bs[0].textContent = String(total)
    if (bs[1]) bs[1].textContent = String(done)
    if (bs[2]) bs[2].textContent = String(pending)
  }

  function wireCompactTableBedLinks(panel, org, beds) {
    if (!org || !beds?.length) return
    panel.querySelectorAll('table.compact-table tbody tr').forEach((tr) => {
      const bedCell = tr.cells[0]
      if (!bedCell || bedCell.querySelector('a.hx-dm-bed-link')) return
      const bedLabel = (bedCell.textContent || '').trim()
      if (!bedLabel) return
      const linked = bedCellHtml(bedLabel, org, beds)
      if (linked.includes('href')) bedCell.innerHTML = linked
    })
  }

  function renderTodayFocus(section, ctx, org) {
    if (!section || !ctx) return
    const items = ctx.todayFocus || []
    const res = ctx.resources || []
    const focusHtml = items
      .map((f) => {
        const inner = `<b>${esc(f.label)}</b><span>${esc(f.desc)}</span>`
        const icu = String(f.label || '').includes('ICU')
        const body = icu
          ? `<a class="hx-dm-focus-link" href="${esc(criticalHash(org))}">${inner}</a>`
          : inner
        return `<li class="hx-dm-focus hx-dm-focus--${esc(f.tone || 'neutral')}">${body}</li>`
      })
      .join('')
    const resHtml = res
      .map(
        (r) => `<li class="hx-dm-res hx-dm-res--${r.status === '关注' ? 'warn' : 'ok'}">
          <span>${esc(r.name)}</span><strong>${esc(r.value)}</strong>
        </li>`,
      )
      .join('')
    const html = `<section id="hx-dept-today-focus" class="hx-dept-today-focus" aria-label="今日关注与资源">
      <div class="hx-dept-today-col">
        <h4>今日关注</h4>
        <ul>${focusHtml || '<li class="hx-ia-view-empty">暂无</li>'}</ul>
      </div>
      <div class="hx-dept-today-col">
        <h4>关键资源（后勤/设备）</h4>
        <ul class="hx-dept-res-list">${resHtml || '<li class="hx-ia-view-empty">暂无</li>'}</ul>
      </div>
    </section>`
    const matrix = section.querySelector('.department-matrix')
    let box = document.getElementById('hx-dept-today-focus')
    if (box && box.dataset.html === html) return
    remove('hx-dept-today-focus')
    if (matrix) matrix.insertAdjacentHTML('afterend', html)
    else if (document.getElementById('hx-dept-beds-panel')) {
      document.getElementById('hx-dept-beds-panel').insertAdjacentHTML('beforebegin', html)
    } else section.insertAdjacentHTML('beforeend', html)
    box = document.getElementById('hx-dept-today-focus')
    if (box) box.dataset.html = html
  }

  function renderLinkageBar(section, org) {
    if (!section) return
    const wardsQs = new URLSearchParams({ view: 'wards' })
    if (org) wardsQs.set('org', org)
    const html = `<nav id="hx-dept-linkage-bar" class="hx-dept-linkage-bar" aria-label="重症联动">
      <span class="hx-dept-linkage-tag">重症联动</span>
      <a class="hx-dept-linkage-go" href="${esc(criticalHash(org))}">ICU 重症监护</a>
      <a class="hx-dept-linkage-go" href="#/critical?${wardsQs.toString()}">床位全景</a>
      <a class="hx-dept-linkage-go" href="${esc(deptWarningHash(org, 'icu'))}">ICU 预警筛选</a>
      <span class="hx-dept-linkage-tip">左侧 <b>床号</b> 点进床旁 · 待测评行末 <b>重症/床旁</b></span>
    </nav>`
    let box = document.getElementById('hx-dept-linkage-bar')
    if (box && box.dataset.html === html) return
    remove('hx-dept-linkage-bar')
    const totals = section.querySelector('.department-totals')
    if (totals) totals.insertAdjacentHTML('afterend', html)
    else section.querySelector('.department-matrix')?.insertAdjacentHTML('beforebegin', html)
    box = document.getElementById('hx-dept-linkage-bar')
    if (box) box.dataset.html = html
  }

  function wireMatrixIcuLinks(section, org) {
    if (!section || !org) return
    section.querySelectorAll('.department-matrix a, .department-matrix article').forEach((card) => {
      const text = (card.textContent || '').replace(/\s+/g, '')
      if (!text.includes('重症医学科') && !text.includes('ICU')) return
      if (card.querySelector('.hx-dept-matrix-icu')) return
      card.insertAdjacentHTML(
        'beforeend',
        `<p class="hx-dept-matrix-icu"><a href="${esc(criticalHash(org))}">→ ICU 监护</a></p>`,
      )
    })
  }

  function appendPendingLinkage(main, org, linkCtx) {
    const panel = main?.querySelector('section > .panel')
    const body = panel?.querySelector('.panel-body')
    if (!body) return
    panel.id = 'hx-dm-pending-panel'
    const beds = linkCtx?.beds || []
    body.querySelectorAll(':scope > p').forEach((p) => {
      if (p.querySelector('.hx-dm-pending-ops')) return
      const link = p.querySelector('a')
      const href = link ? link.getAttribute('href') || '#' : '#'
      const pidM = href.match(/\/patient\/([^/?#]+)/)
      const patientId = pidM ? decodeURIComponent(pidM[1]) : ''
      const icuBed = findIcuBedForPatient(patientId, org, beds)
      let ops = `<a class="hx-dm-pending-go" href="${esc(href)}">档案</a>`
      ops += ` · <a href="${esc(criticalHash(org))}">重症</a>`
      if (icuBed?.id) {
        ops += ` · <a href="#/bed/${encodeURIComponent(icuBed.id)}">床旁</a>`
      }
      p.insertAdjacentHTML('beforeend', `<span class="hx-dm-pending-ops"> · ${ops}</span>`)
    })
  }

  function enrichLeftPanels(main, ctx, org, linkCtx) {
    if (!main || !ctx) return
    const beds = linkCtx?.beds || []
    const aside = main.querySelector('aside:first-of-type')
    if (!aside) return
    aside.querySelectorAll('.panel').forEach((panel) => {
      const title = panel.querySelector('.panel-title h2, .panel-title')?.textContent || ''
      const key = panelDataKey(title)
      if (!key) return
      const rows = ctx[key] || []
      if (key === 'newsScores') panel.id = 'hx-dm-panel-news'
      if (key === 'criticalLabs') panel.id = 'hx-dm-panel-labs'
      if (key === 'vasoactive') panel.id = 'hx-dm-panel-vaso'
      syncPanelWarningCounts(panel, rows)
      wireCompactTableBedLinks(panel, org, beds)
      const titleEl = panel.querySelector('.panel-title')
      if (titleEl && !titleEl.querySelector('.hx-dm-link-hint')) {
        titleEl.insertAdjacentHTML(
          'beforeend',
          `<span class="hx-dm-link-hint">床号→床旁</span>`,
        )
      }
    })
  }

  function enrichHandHygiene(main, ctx) {
    const hh = ctx?.handHygiene
    if (!main || !hh) return
    main.querySelectorAll('aside:last-of-type .panel').forEach((panel) => {
      const title = (panel.querySelector('.panel-title h2, .panel-title')?.textContent || '').replace(/\s+/g, '')
      if (!title.includes('手卫生')) return
      const body = panel.querySelector('.panel-body')
      if (!body || body.dataset.hxHygiene === '1') return
      body.dataset.hxHygiene = '1'
      if (body.querySelector('.hx-dm-hh')) return
      const wards = (hh.wards || [])
        .map(
          (w) => `<li><span>${esc(w.name)}</span><span class="hx-dm-hh-bar"><i style="width:${Math.min(100, w.rate)}%"></i></span><b>${w.rate}%</b></li>`,
        )
        .join('')
      body.insertAdjacentHTML(
        'beforeend',
        `<div class="hx-dm-hh hx-dm-hh--append">
        <div class="hx-dm-hh-main"><strong>${hh.rate}%</strong><span>${esc(hh.period || '')}</span></div>
        <p class="hx-dm-hh-meta">观察 ${hh.observations ?? '—'} 次 · 依从 ${hh.compliant ?? '—'} 次 · ${esc(hh.source || '')}</p>
        <ul class="hx-dm-hh-wards">${wards}</ul>
      </div>`,
      )
    })
  }

  function enhancePendingPanel(main, org, linkCtx) {
    const panel = main?.querySelector('section > .panel')
    if (!panel) return
    panel.id = 'hx-dm-pending-panel'
    const body = panel.querySelector('.panel-body')
    if (!body || body.querySelector('.hx-dm-pending-table')) return
    if (body.querySelector('table.compact-table, table.business-table, .business-table table')) return
    const ps = [...body.querySelectorAll(':scope > p')]
    if (!ps.length) return
    const beds = linkCtx?.beds || []
    const rows = ps
      .map((p) => {
        const link = p.querySelector('a')
        const name = link ? link.textContent.trim() : '—'
        const href = link ? link.getAttribute('href') || '#' : '#'
        const text = (p.textContent || '').replace(name, '').replace(/^[·\s]+/, '').trim()
        const parts = text.split('·').map((s) => s.trim())
        const title = parts[0] || '—'
        const note = parts.slice(1).join(' · ') || '等待现场核对'
        let tone = 'wait'
        if (/干预|治疗|吸氧|升压/.test(note + title)) tone = 'doing'
        if (/低|下降|异常/.test(title)) tone = 'danger'
        const pidM = href.match(/\/patient\/([^/?#]+)/)
        const patientId = pidM ? decodeURIComponent(pidM[1]) : ''
        const icuBed = findIcuBedForPatient(patientId, org, beds)
        let ops = `<a class="hx-dm-pending-go" href="${esc(href)}">档案</a>`
        if (icuBed?.id) {
          ops += ` · <a href="${esc(criticalHash(org, icuBed.id))}">重症</a>`
          ops += ` · <a href="#/bed/${encodeURIComponent(icuBed.id)}">床旁</a>`
        }
        return `<tr class="hx-dm-pending-row hx-dm-pending-row--${tone}">
          <td><a href="${esc(href)}">${esc(name)}</a></td>
          <td>${esc(title)}</td>
          <td class="hx-dm-pending-note">${esc(note)}</td>
          <td class="hx-dm-pending-ops">${ops}</td>
        </tr>`
      })
      .join('')
    body.innerHTML = `<div class="hx-dm-pending-table business-table table-scroll">
      <table>
        <thead><tr><th>患者</th><th>预警项</th><th>现场说明</th><th>操作</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`
  }

  function clearDeptMonitorEnhance() {
    remove('hx-dept-monitor-banner')
    remove('hx-dept-today-focus')
    remove('hx-dept-linkage-bar')
    remove('hx-dept-beds-panel')
    remove('hx-beds-live-panel')
    const main = document.querySelector('main.department-overview.screen')
    if (!main) return
    main.querySelectorAll('.panel-body .hx-dm-hh--append').forEach((el) => el.remove())
    main.querySelectorAll('[data-hx-hygiene]').forEach((el) => {
      delete el.dataset.hxHygiene
    })
    main.querySelectorAll('.hx-dm-pending-table').forEach((el) => el.remove())
    main.querySelectorAll('.hx-dm-pending-ops').forEach((el) => el.remove())
    main.querySelectorAll('.hx-dept-matrix-icu').forEach((el) => el.remove())
    main.querySelectorAll('.hx-dm-link-hint').forEach((el) => el.remove())
  }

  function renderDeptMonitorContext(ctx) {
    const { p, q } = pathAndQuery()
    if (p !== '/warning' || q.get('view') !== 'departments') {
      clearDeptMonitorEnhance()
      return
    }
    const main = document.querySelector('main.department-overview.screen')
    const section = findDeptHost()
    if (!main || !section || !ctx) return
    const org = currentOrg(ctx)
    loadLinkCtx().then((linkCtx) => {
      if (pathAndQuery().p !== '/warning' || pathAndQuery().q.get('view') !== 'departments') return
      if (!document.querySelector('main.department-overview.screen')) return
      renderLinkageBar(section, org)
      wireMatrixIcuLinks(section, org)
      enrichLeftPanels(main, ctx, org, linkCtx)
      enrichHandHygiene(main, ctx)
      appendPendingLinkage(main, org, linkCtx)
    })
  }

  function loadJson(url, cache) {
    if (cache.value) return Promise.resolve(cache.value)
    if (cache.promise) return cache.promise
    cache.promise = fetch(url, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        cache.value = d
        return d
      })
      .catch(() => null)
    return cache.promise
  }

  function resetCaches() {
    remoteCache.value = null
    remoteCache.promise = null
    bedsCache.value = null
    bedsCache.promise = null
    monitorCache.value = null
    monitorCache.promise = null
    linkCtxCache.value = null
    linkCtxCache.promise = null
  }

  function render() {
    const { p, q } = pathAndQuery()
    if (p !== '/warning' || q.get('view') !== 'departments') clearDeptMonitorEnhance()
    redirectSubHospitalsRoute()
    redirectBedsRoute()
    syncViewMode()
    hidePhoneNoticeOnDepartmentView()
    remove('hx-sub-hospital-monitor')
    loadJson('/api/grassroots-remote-monitor.json', remoteCache).then(renderGrassrootsRemote)
    renderDeptBeds()
    renderBedStats()
    loadJson('/api/dept-monitor-context.json', monitorCache).then(renderDeptMonitorContext)
  }

  document.addEventListener(
    'click',
    (e) => {
      const t = e.target
      if (!(t instanceof Element)) return
      const scrollLink = t.closest('[data-hx-dm-scroll="1"]')
      if (scrollLink) {
        const href = scrollLink.getAttribute('href') || ''
        if (href.startsWith('#') && !href.startsWith('#/')) {
          e.preventDefault()
          const el = document.querySelector(href)
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          return
        }
      }
      const a = t.closest('nav.subnav > a')
      if (!a || (a.textContent || '').trim() !== '科室床位') return
      e.preventDefault()
      e.stopPropagation()
      location.hash = '#/warning?view=departments'
    },
    true,
  )

  window.addEventListener('hashchange', () => {
    clearDeptMonitorEnhance()
    resetCaches()
    redirectSubHospitalsRoute()
    syncViewMode()
    hidePhoneNoticeOnDepartmentView()
    redirectBedsRoute()
  })

  window.hxEnhance(render, { wait: 350, afterNav: 90 })
})()
