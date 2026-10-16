/**
 * 远程会诊 · 基层上转视图：/#/consultations?tab=grassroots（兼容 scope=grassroots）
 */
;(function () {
  const GRASSROOTS_ORG = new Set(['chuanshi', 'lianjie'])
  const ORG_LABEL = {
    chuanshi: '船石村卫生室',
    lianjie: '连界镇卫生院',
    weiyuan: '威远县人民医院',
    huaxi: '华西医院',
    'neijiang-first': '内江一院',
  }

  /** 基层上转可选的接收医院（指挥中心可按院筛选队列） */
  const RECEIVING_HOSPITALS = [
    { id: 'weiyuan', name: '威远县人民医院', tier: '县域' },
    { id: 'neijiang-first', name: '内江一院', tier: '市级' },
    { id: 'huaxi', name: '华西医院', tier: '上级' },
  ]

  const STATUS_LABEL = {
    pending: '待接诊',
    accepted: '会诊中',
    completed: '已完成',
  }

  const API_STATUS = {
    WAITING: 'pending',
    IN_CALL: 'accepted',
    FINISHED: 'completed',
  }

  /** 后端 source_hospital 为中文名，与 scenario 的 institutionId 对齐 */
  const GRASSROOTS_SOURCE_HINTS = ['船石', '连界', '村卫生', '镇卫生', '新场镇', 'chuanshi', 'lianjie']

  let scenarioCache = null
  let scenarioPromise = null
  /** 避免 MutationObserver + DOM 改写导致 render 循环打 /consultations */
  let backendRowsCache = { at: 0, rows: [] }
  const BACKEND_ROWS_TTL_MS = 45_000
  let lastPaintFingerprint = ''
  let renderSerial = 0

  function path() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function query() {
    const raw = location.hash.replace(/^#/, '')
    const q = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : ''
    return new URLSearchParams(q)
  }

  function isGrassrootsPage() {
    if (path() === '/consultations/grassroots') return true
    if (path() !== '/consultations') return false
    const q = query()
    return q.get('tab') === 'grassroots' || q.get('scope') === 'grassroots'
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  function orgLabel(id) {
    return ORG_LABEL[id] || id || '—'
  }

  function fmtTime(iso) {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleString('zh-CN', { hour12: false })
    } catch {
      return iso
    }
  }

  function loadScenario() {
    if (scenarioCache) return Promise.resolve(scenarioCache)
    if (scenarioPromise) return scenarioPromise
    scenarioPromise = fetch('/scenario.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((pack) => {
        scenarioCache = pack?.state || pack || {}
        window.hxConsultEpisodeNav?.indexFromScenario(scenarioCache)
        return scenarioCache
      })
      .catch(() => {
        scenarioCache = {}
        return scenarioCache
      })
    return scenarioPromise
  }

  function isGrassrootsSource(item) {
    const id = item.sourceInstitutionId || item.sourceHospitalId || item.source_institution_id || ''
    if (GRASSROOTS_ORG.has(id)) return true
    const src = [
      item.sourceHospital,
      item.source_hospital,
      item.sourceDepartment,
      item.source_department,
    ]
      .filter(Boolean)
      .join(' ')
    return GRASSROOTS_SOURCE_HINTS.some((k) => src.includes(k))
  }

  function mapApiConsult(c) {
    const p = c.patient || {}
    const apiSt = String(c.status || 'WAITING').toUpperCase()
    const status = API_STATUS[apiSt] || 'pending'
    const targetH = c.targetHospital || c.hospital || ''
    const targetD = c.targetDepartment || c.department || ''
    const sourceH = c.sourceHospital || c.source_hospital || ''
    const sourceD = c.sourceDepartment || c.source_department || ''
    const rawLabel = c.statusLabel || c.status_label || ''
    const statusLabel =
      rawLabel === '已结束'
        ? STATUS_LABEL.completed
        : rawLabel || STATUS_LABEL[status] || apiSt
    const targetInstitutionId =
      c.targetInstitutionId ||
      c.target_institution_id ||
      c.institutionId ||
      c.institution_id ||
      guessInstitutionId(targetH)
    return {
      id: String(c.sessionId || c.session_id || c.id || ''),
      sessionId: c.sessionId || c.session_id || '',
      patientId: p.patientId || p.patient_id || c.patient_id || '',
      patientName: p.name || c.patient_name || '—',
      symptoms: p.chiefComplaint || p.chief_complaint || '—',
      status,
      statusLabel,
      source: sourceD ? `${sourceH || '—'} · ${sourceD}` : sourceH || '—',
      target: targetD ? `${targetH} · ${targetD}` : targetH || '—',
      targetInstitutionId,
      createdAt: c.createdAt || c.created_at || '',
      token: c.token || '',
      createdBy: c.applicantName || c.applicant_name || '—',
      opinion: c.opinionSummary || c.opinion_summary || '',
      _fromApi: true,
    }
  }

  function guessInstitutionId(label) {
    const s = String(label || '')
    if (s.includes('威远') || s.includes('weiyuan')) return 'weiyuan'
    if (s.includes('华西') || s.includes('huaxi')) return 'huaxi'
    if (s.includes('内江') || s.includes('neijiang')) return 'neijiang-first'
    return ''
  }

  function selectedHospitalFilter() {
    const h = query().get('hospital') || ''
    if (!h || h === 'all') return ''
    return RECEIVING_HOSPITALS.some((x) => x.id === h) ? h : ''
  }

  function setHospitalFilter(hospitalId) {
    const base = '#/consultations?tab=grassroots'
    const next =
      hospitalId && hospitalId !== 'all'
        ? `${base}&hospital=${encodeURIComponent(hospitalId)}`
        : base
    if (location.hash.replace(/^#/, '') !== next.replace(/^#/, '')) location.hash = next
  }

  async function loadBackendRows(force) {
    const api = window.hxBackend
    if (!api?.enabled?.()) return []
    const now = Date.now()
    if (
      !force &&
      backendRowsCache.rows.length &&
      now - backendRowsCache.at < BACKEND_ROWS_TTL_MS
    ) {
      return backendRowsCache.rows
    }
    try {
      const ok = await api.ensureAuth()
      if (!ok) return backendRowsCache.rows
      const raw = await api.get('/consultations', {
        pageNum: 1,
        pageSize: 50,
        status: 'WAITING,IN_CALL,FINISHED',
      })
      const list = raw?.list || raw?.data || []
      const rows = list.filter(isGrassrootsSource).map(mapApiConsult)
      backendRowsCache = { at: now, rows }
      return rows
    } catch (e) {
      console.warn('[grassroots-consult] 后端会诊列表失败', e)
      return backendRowsCache.rows
    }
  }

  function rowsFingerprint(rows) {
    return rows
      .map((r) => [r.id, r.status, r.createdAt, r.patientName, r.token].join('|'))
      .join(';')
  }

  function mergeRows(primary, secondary) {
    const out = [...primary]
    const keys = new Set(primary.map((r) => r.sessionId || r.id || r.patientId))
    secondary.forEach((r) => {
      const k = r.sessionId || r.id || r.patientId
      if (k && keys.has(k)) return
      if (!k && primary.some((p) => p.patientName === r.patientName && p.createdAt === r.createdAt)) return
      out.push(r)
      if (k) keys.add(k)
    })
    return out
  }

  function grassrootsRows(state) {
    const patients = state.patients || []
    const staff = state.staff || []
    const reqs = (state.consultationRequests || []).filter((r) =>
      GRASSROOTS_ORG.has(r.sourceInstitutionId),
    )
    return reqs.map((r) => {
      const patient = patients.find((p) => p.id === r.patientId)
      const creator = staff.find((s) => s.id === r.createdBy)
      return {
        id: r.id,
        patientId: r.patientId,
        patientName: patient?.name || r.patientId || '—',
        symptoms: (patient?.symptoms || []).join('、') || '—',
        status: r.status,
        statusLabel: STATUS_LABEL[r.status] || r.status || '—',
        source: orgLabel(r.sourceInstitutionId),
        target: orgLabel(r.institutionId),
        targetInstitutionId: r.institutionId || '',
        createdAt: r.createdAt,
        token: r.token || patient?.consultationToken,
        createdBy: creator?.name || r.createdBy || '—',
        opinion: r.opinion,
      }
    })
  }

  function syncFromDomQueue() {
    const rows = []
    document.querySelectorAll('.consultation-queue article').forEach((art) => {
      const name = art.querySelector('header strong')?.textContent?.trim()
      if (!name) return
      const ps = art.querySelectorAll('p')
      const route = ps[0]?.textContent?.trim() || ''
      if (!/船石|连界|村|镇卫生|chuanshi|lianjie/i.test(route)) return
      rows.push({
        id: `dom-${name}`,
        patientName: name,
        symptoms: ps[1]?.textContent?.trim() || '—',
        status: 'pending',
        statusLabel: '待接诊',
        source: route.split('→')[0]?.trim() || '—',
        target: route.split('→')[1]?.trim() || '—',
        createdAt: '',
        token: '',
        createdBy: art.querySelector('small')?.textContent?.replace('申请人：', '').trim() || '—',
        opinion: '',
        _article: art,
      })
    })
    return rows
  }

  function episodeHref(row) {
    const nav = window.hxConsultEpisodeNav
    if (nav) {
      const h = nav.episodeHash({ patientId: row.patientId, token: row.token })
      if (h) return h
    }
    return row.patientId ? `#/patient/${encodeURIComponent(row.patientId)}` : ''
  }

  function rowAction(row) {
    const parts = []
    const ep = episodeHref(row)
    if (row.status === 'pending' && row.sessionId && row._fromApi) {
      parts.push(
        `<button type="button" class="hx-gr-consult-btn primary" data-hx-gr-api-accept="${esc(row.sessionId)}" data-hx-gr-patient="${esc(row.patientId || '')}" data-hx-gr-token="${esc(row.token || '')}">接诊</button>`,
      )
      if (ep) {
        parts.push(`<a class="hx-gr-consult-btn" href="${esc(ep)}">连续诊疗</a>`)
      }
      return parts.join('')
    }
    if (row._article) {
      return `<button type="button" class="hx-gr-consult-btn primary" data-hx-gr-accept="${esc(row.patientName)}">接诊</button>`
    }
    if (ep) {
      parts.push(`<a class="hx-gr-consult-btn primary" href="${esc(ep)}">连续诊疗</a>`)
    }
    if (row.token && row.status !== 'completed') {
      parts.push(`<a class="hx-gr-consult-btn" href="#/room/${esc(row.token)}">进入视频会诊</a>`)
    } else if (row.patientId && !ep) {
      parts.push(`<a class="hx-gr-consult-btn" href="#/patient/${esc(row.patientId)}">患者档案</a>`)
    }
    return parts.join('')
  }

  function hospitalSidebarHtml(allRows) {
    const filterId = selectedHospitalFilter()
    const countFor = (hid) =>
      allRows.filter((r) => !hid || r.targetInstitutionId === hid).filter((r) => r.status === 'pending')
        .length
    const allPending = countFor('')
    const items = RECEIVING_HOSPITALS.map((h) => {
      const n = countFor(h.id)
      const active = filterId === h.id
      return `<li>
        <button type="button" class="hx-gr-consult-hospital${active ? ' is-active' : ''}" data-hx-gr-hospital="${esc(h.id)}">
          <strong>${esc(h.name)}</strong>
          <span>${esc(h.tier)} · 待接诊 ${n}</span>
        </button>
      </li>`
    }).join('')
    return `<ul class="hx-gr-consult-hospital-list">
      <li>
        <button type="button" class="hx-gr-consult-hospital${!filterId ? ' is-active' : ''}" data-hx-gr-hospital="all">
          <strong>全部接收医院</strong>
          <span>待接诊 ${allPending}</span>
        </button>
      </li>
      ${items}
    </ul>`
  }

  function buildPageHtml(rows, allRows) {
    const viewRows = rows
    const pending = viewRows.filter((r) => r.status === 'pending').length
    const active = viewRows.filter((r) => r.status === 'accepted').length
    const done = viewRows.filter((r) => r.status === 'completed').length

    const tableRows = viewRows.length
      ? viewRows
          .map(
            (r) => `<tr data-id="${esc(r.id)}">
            <td><strong>${esc(r.patientName)}</strong><small>${esc(r.id)}</small></td>
            <td>${esc(r.source)} → ${esc(r.target)}</td>
            <td>${esc(r.symptoms)}</td>
            <td><span class="hx-gr-consult-status hx-gr-consult-status--${esc(r.status)}">${esc(r.statusLabel)}</span></td>
            <td>${fmtTime(r.createdAt)}</td>
            <td class="hx-gr-consult-actions">${rowAction(r)}</td>
          </tr>`,
          )
          .join('')
      : `<tr><td colspan="6" class="hx-gr-consult-empty-cell">暂无基层发起的会诊记录</td></tr>`

    return `<div class="hx-gr-consult">
      <div class="hx-gr-consult-toolbar">
        <p class="hx-gr-consult-lead">乡镇、村卫生室发起会诊时<strong>选择接收医院</strong>（县域 / 市级 / 上级）；各院在本页各自待接诊队列中接诊，指挥中心可按医院筛选。</p>
        <div class="hx-gr-consult-toolbar__links">
          <a href="#/organizations?tier=township">协作机构</a>
          <a href="#/transfers?scope=grassroots">转诊上行</a>
          <a href="#/dr">基层 Dr.</a>
        </div>
      </div>
      <div class="hx-gr-consult-kpis">
        <div><b>${pending}</b><span>待接诊</span></div>
        <div><b>${active}</b><span>会诊中</span></div>
        <div><b>${done}</b><span>已完成</span></div>
        <div><b>${viewRows.length}</b><span>合计</span></div>
      </div>
      <div class="hx-gr-consult-layout">
        <section class="hx-gr-consult-panel">
          <header><h2>基层会诊队列</h2></header>
          <div class="hx-gr-consult-table-wrap">
            <table class="hx-gr-consult-table">
              <thead><tr>
                <th>患者</th><th>上转路径</th><th>主诉 / 症状</th><th>状态</th><th>申请时间</th><th>操作</th>
              </tr></thead>
              <tbody>${tableRows}</tbody>
            </table>
          </div>
        </section>
        <aside class="hx-gr-consult-panel hx-gr-consult-sites">
          <header><h2>接收医院</h2></header>
          ${hospitalSidebarHtml(allRows)}
          <header class="hx-gr-consult-subhead"><h3>基层发起站点</h3></header>
          <ul class="hx-gr-consult-site-list">
            <li><strong>${orgLabel('chuanshi')}</strong><span>全科 / 观察留观</span></li>
            <li><strong>${orgLabel('lianjie')}</strong><span>急诊 / 消化内科</span></li>
          </ul>
          <p class="hx-gr-consult-tip">发起时通过「选择患者发起」指定接收医院与科室；也可在「急救事件」「患者登记」中关联上转。</p>
          <a class="hx-gr-consult-btn block" href="#/consultations/pick?tab=grassroots">选择患者 · 指定接收医院</a>
        </aside>
      </div>
    </div>`
  }

  function bindPageActions(root) {
    if (root.dataset.hxNavBound !== '1') {
      root.dataset.hxNavBound = '1'
      root.addEventListener('click', (e) => {
        const a = e.target instanceof Element ? e.target.closest('a[href]') : null
        if (!a || !root.contains(a)) return
        const raw = a.getAttribute('href') || ''
        const norm = window.hxConsultEpisodeNav?.normalizeHash(raw) || raw
        if (norm !== raw && norm.charAt(0) === '#') {
          e.preventDefault()
          location.hash = norm
        }
      })
    }

    root.querySelectorAll('[data-hx-gr-hospital]').forEach((btn) => {
      btn.addEventListener('click', () => {
        setHospitalFilter(btn.getAttribute('data-hx-gr-hospital') || 'all')
      })
    })

    root.querySelectorAll('[data-hx-gr-accept]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-hx-gr-accept')
        const art = [...document.querySelectorAll('.consultation-queue article')].find(
          (a) => a.querySelector('header strong')?.textContent?.trim() === name,
        )
        art?.querySelector('button.primary')?.click()
      })
    })

    root.querySelectorAll('[data-hx-gr-api-accept]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const sid = btn.getAttribute('data-hx-gr-api-accept')
        if (!sid || !window.hxBackend?.post) return
        btn.disabled = true
        try {
          await window.hxBackend.ensureAuth()
          await window.hxBackend.post(`/consultations/${encodeURIComponent(sid)}/accept`, {})
          backendRowsCache = { at: 0, rows: [] }
          const patientId = btn.getAttribute('data-hx-gr-patient') || ''
          const token = btn.getAttribute('data-hx-gr-token') || ''
          await window.hxConsultEpisodeNav?.loadScenarioIndex()
          if (
            !window.hxConsultEpisodeNav?.goEpisode({ patientId, token }) &&
            token
          ) {
            location.hash = '#/room/' + encodeURIComponent(token)
          } else if (!window.hxConsultEpisodeNav?.goEpisode({ patientId, token })) {
            await render({ force: true })
            return
          }
          await render({ force: true })
        } catch (e) {
          console.warn('[grassroots-consult] 接诊失败', e)
          btn.disabled = false
        }
      })
    })
  }

  function applyPageShell(main) {
    main.classList.add('hx-gr-consult-workspace')
    document.body.classList.add('hx-consult-grassroots-page')

    const h1 = main.querySelector('.workspace-heading h1')
    if (h1 && !/远程会诊/.test(h1.textContent || '')) h1.textContent = '远程会诊'
    const headBtn = main.querySelector('.workspace-heading button')
    if (headBtn && headBtn.textContent.includes('患者')) headBtn.textContent = '选择患者发起'

    main.querySelectorAll(':scope > *').forEach((el) => {
      if (el.classList.contains('workspace-heading')) return
      if (el.id === 'hx-grassroots-consult-root') return
      el.classList.add('hx-consult-bundle-host')
    })
  }

  function renderPage(rows, allRows) {
    const main = document.querySelector('main.workspace')
    if (!main) return

    const html = buildPageHtml(rows, allRows)
    const fp = rowsFingerprint(rows)
    let root = document.getElementById('hx-grassroots-consult-root')
    if (root && root.dataset.body === html && lastPaintFingerprint === fp) return

    applyPageShell(main)

    if (!root) {
      root = document.createElement('div')
      root.id = 'hx-grassroots-consult-root'
      main.appendChild(root)
    }

    if (root.dataset.body === html) {
      lastPaintFingerprint = fp
      return
    }

    root.dataset.body = html
    root.innerHTML = html
    lastPaintFingerprint = fp
    bindPageActions(root)
  }

  function teardown() {
    lastPaintFingerprint = ''
    backendRowsCache = { at: 0, rows: [] }
    document.body.classList.remove('hx-consult-grassroots-page')
    document.getElementById('hx-grassroots-consult-root')?.remove()
    document.querySelector('main.workspace')?.classList.remove('hx-gr-consult-workspace')
    document.querySelectorAll('.hx-consult-bundle-host').forEach((el) => {
      el.classList.remove('hx-consult-bundle-host')
    })
  }

  /** P1：基层上转与全县会诊共用 React 卡片队列 + 页内 Tab，不再用表格覆写 */
  const USE_REACT_P1 = true

  async function render(opts) {
    if (USE_REACT_P1 || document.body.classList.contains('hx-cw-active')) {
      teardown()
      return
    }
    const force = opts && opts.force
    if (!isGrassrootsPage()) {
      teardown()
      return
    }
    const serial = ++renderSerial
    const [apiRows, state] = await Promise.all([loadBackendRows(force), loadScenario()])
    if (serial !== renderSerial) return

    let rows = apiRows.length ? apiRows : grassrootsRows(state)
    if (apiRows.length) rows = mergeRows(apiRows, grassrootsRows(state))
    if (!rows.length) rows = syncFromDomQueue()
    else {
      const domExtra = syncFromDomQueue().filter(
        (d) => !rows.some((r) => r.patientName === d.patientName),
      )
      rows = [...rows, ...domExtra]
    }
    rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

    const filterH = selectedHospitalFilter()
    const allRows = rows
    if (filterH) rows = rows.filter((r) => r.targetInstitutionId === filterH)

    const fp = rowsFingerprint(allRows) + '|h=' + (filterH || 'all')
    if (!force && fp === lastPaintFingerprint) return
    renderPage(rows, allRows)
  }

  window.addEventListener('hashchange', () => {
    if (!isGrassrootsPage()) teardown()
    else render({ force: false })
  })

  window.hxEnhance(render, { wait: 380, afterNav: 120 })
})()
