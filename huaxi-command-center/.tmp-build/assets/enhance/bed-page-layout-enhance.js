/**
 * 单床页：P1 左患者信息卡片 + 右床旁视频；P2 圆角 Tab + 分区内容
 */
;(function () {
  const TABS = [
    '概览',
    '护理记录',
    '用药记录',
    '危急值记录',
    '检验记录',
    '检查记录',
    '管路记录',
    '辅助分析',
  ]
  const BODY_FLAG = 'hx-bed-layout-active'
  const LAYOUT_KEY = 'hxBedLayoutVer'
  const LAYOUT_VER = '7'

  const INSTIT_NAMES = {
    weiyuan: '威远县人民医院',
    huaxi: '四川大学华西医院',
    'neijiang-first': '内江市第一人民医院',
  }
  const DEPT_NAMES = { icu: '重症医学科', emergency: '急诊科' }

  let bindIndex = null
  let bindLoad = null

  function path() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function bedIdFromPath() {
    const m = path().match(/^\/bed\/([^/]+)/)
    return m ? decodeURIComponent(m[1]) : ''
  }

  function panelTitle(panel) {
    const el = panel?.querySelector('.panel-title span, .panel-title h2')
    return (el?.textContent || '').trim()
  }

  function panelsIn(root) {
    if (!root) return []
    return [...root.querySelectorAll(':scope > .panel, :scope > section.panel')]
  }

  function takePanel(root, title) {
    const p = panelsIn(root).find((el) => panelTitle(el) === title)
    if (p) p.remove()
    return p || null
  }

  function factsFromPanel(panel) {
    const facts = {}
    if (!panel) return facts
    panel.querySelectorAll('.patient-facts dt').forEach((dt) => {
      const key = (dt.textContent || '').trim()
      const dd = dt.nextElementSibling
      if (key && dd) facts[key] = (dd.textContent || '').trim()
    })
    return facts
  }

  function readPatientSummary(main, panel) {
    const root = panel || main.querySelector('.hx-bed-p1-panel') || main.querySelector(':scope > aside')
    if (!root) return { name: '', facts: {} }
    const h3 = root.querySelector('h3')
    let name = (h3?.textContent || '').replace(/虚构演示病例/g, '').trim()
    const facts = factsFromPanel(root)
    return { name, facts }
  }

  function normalizeBind(row) {
    return {
      scope: row.scope || '本院',
      hospital: row.hospital || row.ward || '',
      bedId: row.bedId,
      bedLabel: row.bedLabel || row.label || '床位',
      patientId: row.patientId,
      patientName: row.patientName || row.patientId || '—',
      deviceName: row.deviceName || '监护仪',
    }
  }

  function loadBindings() {
    if (bindIndex) return Promise.resolve(bindIndex)
    if (bindLoad) return bindLoad
    bindLoad = Promise.all([
      fetch('/api/care-bindings.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { bindings: [] })),
      fetch('/scenario.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { state: {} })),
    ])
      .then(([care, scen]) => {
        const byBed = new Map()
        for (const row of care.bindings || []) {
          if (row.bedId && row.patientId) byBed.set(row.bedId, normalizeBind(row))
        }
        const state = scen.state || scen
        const patients = state.patients || []
        const beds = state.beds || []
        for (const bed of beds) {
          if (bed.status !== 'occupied' || !bed.patientId || byBed.has(bed.id)) continue
          const pat = patients.find((p) => p.id === bed.patientId)
          byBed.set(
            bed.id,
            normalizeBind({
              scope: '本院',
              hospital: INSTIT_NAMES[bed.institutionId] || '',
              bedId: bed.id,
              bedLabel: bed.label || bed.id,
              patientId: bed.patientId,
              patientName: pat?.name || bed.patientId,
            }),
          )
        }
        bindIndex = { byBed, patients, beds }
        return bindIndex
      })
      .catch(() => {
        bindIndex = { byBed: new Map(), patients: [], beds: [] }
        return bindIndex
      })
    return bindLoad
  }

  function patientPanelNeedsFallback(panel) {
    if (!panel) return true
    const t = (panel.textContent || '').replace(/\s+/g, '')
    if (/没有绑定患者|当前床位没有/.test(t)) return true
    return !panel.querySelector('.patient-facts dt')
  }

  function resolvePatient(index, bedId) {
    const bind = index.byBed.get(bedId)
    const bed = index.beds.find((b) => b.id === bedId)
    let pat = null
    if (bind?.patientId) pat = index.patients.find((p) => p.id === bind.patientId)
    if (!pat && bed?.patientId) pat = index.patients.find((p) => p.id === bed.patientId)
    return { bind, bed, pat }
  }

  function buildSyntheticPatientBody(pat, bind, bed) {
    const gender = pat?.gender || '—'
    const age = pat?.age != null ? `${pat.age}` : '—'
    const bedLabel = bind?.bedLabel || (bed?.label ? `${bed.label}` : '—')
    const instId = pat?.institutionId || bed?.institutionId || 'weiyuan'
    const deptId = pat?.departmentId || bed?.departmentId || 'icu'
    const inst = bind?.hospital || INSTIT_NAMES[instId] || '威远县人民医院'
    const dept = DEPT_NAMES[deptId] || '重症医学科'
    const symptoms = (pat?.symptoms || []).join('、') || '待评估'
    const patId = pat?.id || bind?.patientId
    const archive = patId ? `/#/patient/${encodeURIComponent(patId)}` : '#'

    return `<div class="panel-body">
      <dl class="patient-facts">
        <dt>性别 / 年龄</dt><dd>${escapeHtml(gender)} / ${escapeHtml(age)} 岁</dd>
        <dt>床号</dt><dd>${escapeHtml(bedLabel)}</dd>
        <dt>所属机构</dt><dd>${escapeHtml(inst)}</dd>
        <dt>所在科室</dt><dd>${escapeHtml(dept)}</dd>
        <dt>主诉</dt><dd class="amber-text">${escapeHtml(symptoms)}</dd>
      </dl>
      <a class="link-button" href="${escapeAttr(archive)}">查看患者档案</a>
    </div>`
  }

  function ensurePatientBody(body, panel, index, bedId) {
    const { bind, bed, pat } = resolvePatient(index, bedId)
    if (!patientPanelNeedsFallback(panel)) return panel

    const section = document.createElement('section')
    section.className = 'panel hx-bed-p1-panel'
    section.dataset.hxBedP1Prep = '1'
    section.innerHTML = buildSyntheticPatientBody(pat, bind, bed)
    body.replaceChildren(section)
    return section
  }

  function criticalBadgeCount(main) {
    const pane = main.querySelector('.hx-bed-tab-pane[data-tab="危急值记录"]')
    if (!pane) return 0
    return pane.querySelectorAll('.panel-body p').length
  }

  function setActiveTab(main, tab) {
    if (!TABS.includes(tab)) tab = '概览'
    main.dataset.hxBedTab = tab
    main.querySelectorAll('.hx-bed-record-tabs button').forEach((btn) => {
      const on = btn.dataset.tab === tab
      btn.classList.toggle('active', on)
      btn.setAttribute('aria-selected', on ? 'true' : 'false')
    })
    main.querySelectorAll('.hx-bed-tab-pane').forEach((pane) => {
      pane.hidden = pane.dataset.tab !== tab
    })
  }

  function buildTabsNav(main, nav) {
    if (!nav) return
    const active = TABS.includes(main.dataset.hxBedTab) ? main.dataset.hxBedTab : '概览'
    nav.innerHTML = ''
    for (const tab of TABS) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.dataset.tab = tab
      btn.setAttribute('role', 'tab')
      btn.textContent = tab
      if (tab === '危急值记录') {
        const badge = document.createElement('i')
        badge.textContent = String(criticalBadgeCount(main))
        btn.appendChild(badge)
      }
      if (tab === active) btn.classList.add('active')
      nav.appendChild(btn)
    }
    if (!nav.dataset.hxBedTabsWire) {
      nav.dataset.hxBedTabsWire = '1'
      nav.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-tab]')
        if (!btn || !main.contains(btn)) return
        setActiveTab(main, btn.dataset.tab)
      })
    }
    setActiveTab(main, active)
  }

  function ensureVideoSlot(p1Right, bedCenter) {
    let video = p1Right.querySelector('.video-pane, .hx-video-placeholder--block')
    if (video) return video
    const fromCenter = bedCenter?.querySelector('.video-pane')
    if (fromCenter) {
      p1Right.appendChild(fromCenter)
      return fromCenter
    }
    const pane = document.createElement('div')
    pane.className = 'video-pane hx-bed-video-slot'
    p1Right.appendChild(pane)
    return pane
  }

  function tabPlaceholder(text) {
    return `<p class="empty">${text}</p>`
  }

  function fillOverviewVitals(overview, bedCenter) {
    if (!overview) return
    const nums = bedCenter?.querySelector('.monitor-numbers')
    let wrap = overview.querySelector('.hx-bed-overview-vitals')
    if (!wrap) {
      wrap = document.createElement('section')
      wrap.className = 'hx-bed-overview-vitals'
      wrap.innerHTML = '<h3 class="hx-bed-vitals-title">最新体征</h3><div class="hx-bed-vitals-body"></div>'
      overview.appendChild(wrap)
    }
    const body = wrap.querySelector('.hx-bed-vitals-body')
    body.innerHTML = ''
    if (nums) {
      nums.querySelectorAll('span').forEach((span) => {
        const row = document.createElement('div')
        row.className = 'hx-bed-vital-row'
        const labelClone = span.cloneNode(true)
        labelClone.querySelector('strong')?.remove()
        labelClone.querySelector('small')?.remove()
        const label = (labelClone.textContent || '').trim()
        const strong = span.querySelector('strong')
        const small = span.querySelector('small')
        const val = strong ? strong.textContent.trim() : '—'
        const unit = small ? small.textContent.trim() : ''
        row.innerHTML = `<span class="hx-bed-vital-label">${label}</span><span class="hx-bed-vital-dash" aria-hidden="true"></span><span class="hx-bed-vital-val">${val}</span><span class="hx-bed-vital-unit">${unit}</span>`
        body.appendChild(row)
      })
    } else {
      body.innerHTML =
        '<div class="hx-bed-vital-row"><span class="hx-bed-vital-label">ECG</span><span class="hx-bed-vital-dash"></span><span class="hx-bed-vital-val">—</span><span class="hx-bed-vital-unit">bpm</span></div>'
    }
  }

  function obtainPatientPanel(main, aside) {
    const inP1 = main.querySelector('.hx-bed-p1-left .hx-bed-p1-panel')
    if (inP1) return inP1
    return takePanel(aside, '患者信息')
  }

  function preparePatientPanel(panel) {
    if (!panel || panel.dataset.hxBedP1Prep === '1') return panel
    panel.dataset.hxBedP1Prep = '1'
    panel.classList.add('hx-bed-p1-panel')
    panel.querySelector('.panel-title')?.setAttribute('aria-hidden', 'true')
    panel.querySelector('h3')?.remove()
    return panel
  }

  function moveLegacyIntoTabs(main, content) {
    const aside = main.querySelector(':scope > aside')
    const bedCenter = main.querySelector(':scope > .bed-center')
    const bedRight = main.querySelector(':scope > .bed-right')

    const panes = {}
    for (const tab of TABS) panes[tab] = content.querySelector(`.hx-bed-tab-pane[data-tab="${tab}"]`)

    const patientPanel = preparePatientPanel(obtainPatientPanel(main, aside))
    takePanel(aside, '病程记录')
    takePanel(aside, '评估记录')

    fillOverviewVitals(panes['概览'], bedCenter)
    if (panes['概览'] && !panes['概览'].querySelector('.hx-bed-overview-vitals')) {
      panes['概览'].innerHTML = tabPlaceholder('暂无体征数据')
    }

    const med = takePanel(bedRight, '用药记录')
    if (med && panes['用药记录']) {
      panes['用药记录'].appendChild(med)
    } else if (panes['用药记录'] && !panes['用药记录'].children.length) {
      panes['用药记录'].innerHTML = tabPlaceholder('暂无用药记录')
    }

    const crit = takePanel(bedRight, '危急值')
    if (crit && panes['危急值记录']) panes['危急值记录'].appendChild(crit)
    else if (panes['危急值记录'] && !panes['危急值记录'].children.length) {
      panes['危急值记录'].innerHTML = tabPlaceholder('暂无危急值记录')
    }

    takePanel(bedRight, '体征异常')

    const lab = takePanel(bedRight, '检验异常')
    if (lab && panes['检验记录']) panes['检验记录'].appendChild(lab)
    else if (panes['检验记录'] && !panes['检验记录'].children.length) {
      panes['检验记录'].innerHTML = tabPlaceholder('暂无检验记录')
    }

    if (panes['护理记录'] && !panes['护理记录'].children.length) {
      panes['护理记录'].innerHTML = tabPlaceholder('护理文书未接入，正式环境在此展示护理记录。')
    }
    if (panes['检查记录'] && !panes['检查记录'].children.length) {
      panes['检查记录'].innerHTML = tabPlaceholder('检查报告未接入，正式环境在此展示 PACS / 检查结论。')
    }
    if (panes['管路记录'] && !panes['管路记录'].children.length) {
      panes['管路记录'].innerHTML = tabPlaceholder('管路护理记录未接入，正式环境在此展示导管与管路清单。')
    }

    const aux = panes['辅助分析']
    if (aux) {
      const monitor = bedCenter?.querySelector('.monitor')
      const obs = bedCenter?.querySelector('.bed-observation')
      if (monitor && monitor.parentElement !== aux) aux.appendChild(monitor)
      if (obs && obs.parentElement !== aux) aux.appendChild(obs)
      if (!aux.children.length) {
        aux.innerHTML = tabPlaceholder('暂无可展示的波形与辅助分析。')
      }
    }

    if (aside) aside.hidden = true
    if (bedRight) bedRight.hidden = true
    if (bedCenter) bedCenter.hidden = true

    renderP1PatientCard(main, patientPanel)
  }

  function renderP1PatientCard(main, patientPanel) {
    const left = main.querySelector('.hx-bed-p1-left')
    if (!left) return

    document.getElementById('hx-dock-bed')?.remove()

    const bedId = bedIdFromPath()
    const summary = readPatientSummary(main, patientPanel)
    const facts = summary.facts || {}

    let box = left.querySelector('#hx-bed-p1-info')
    if (!box) {
      box = document.createElement('div')
      box.id = 'hx-bed-p1-info'
      box.className = 'hx-bed-p1-info'
      left.appendChild(box)
    }

    let header = box.querySelector('.hx-bed-p1-header')
    if (!header) {
      header = document.createElement('div')
      header.className = 'hx-bed-p1-header'
      box.prepend(header)
    }

    let body = box.querySelector('.hx-bed-p1-body')
    if (!body) {
      body = document.createElement('div')
      body.className = 'hx-bed-p1-body'
      box.appendChild(body)
    }

    let mounted = patientPanel
    if (mounted && patientPanelNeedsFallback(mounted)) {
      mounted = null
    }
    if (mounted && mounted.parentElement !== body) {
      body.replaceChildren(mounted)
    }

    loadBindings().then((index) => {
      const { bind, pat } = resolvePatient(index, bedId)
      const panelInBody = body.querySelector('.hx-bed-p1-panel') || mounted
      ensurePatientBody(body, panelInBody, index, bedId)

      const metaLine = bind
        ? `${bind.scope || '本院'}${bind.hospital ? ` · ${bind.hospital}` : ''}`
        : facts['所属机构'] || '本院 · 威远县人民医院'
      const patientName = bind?.patientName || pat?.name || summary.name || '—'
      const bedLabel = bind?.bedLabel || facts['床号'] || bedId
      const deviceName = bind?.deviceName || '监护仪'
      const patId = pat?.id || bind?.patientId
      const patHref = patId ? `/#/patient/${encodeURIComponent(patId)}` : '#'

      header.innerHTML = `
        <a class="hx-bed-back" href="/#/beds">返回科室床位</a>
        <p class="hx-bed-meta">${escapeHtml(metaLine)}</p>
        <div class="hx-bed-headline">
          <a class="hx-bed-patient" href="${escapeAttr(patHref)}">${escapeHtml(patientName)}</a>
          <span class="hx-bed-chip">${escapeHtml(bedLabel)}</span>
          <span class="hx-bed-chip hx-bed-chip--muted">${escapeHtml(deviceName)}</span>
        </div>
      `
    })
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, '&#39;')
  }

  function needsFullRebuild(main) {
    const p2 = main.querySelector(':scope > .hx-bed-p2')
    const p1InP2 = p2?.querySelector(':scope > .hx-bed-p1')
    const p1Top = main.querySelector(':scope > .hx-bed-p1')
    if (!p2 || !p1InP2 || p1Top || main.dataset[LAYOUT_KEY] !== LAYOUT_VER) return true
    if (main.querySelector(':scope > aside:not([hidden])')) return true
    if (main.querySelector(':scope > .bed-center:not([hidden])')) return true
    if (main.querySelector(':scope > .bed-right:not([hidden])')) return true
    const firstTab = p2.querySelector('.hx-bed-record-tabs button')?.dataset.tab
    if (firstTab && firstTab !== TABS[0]) return true
    return false
  }

  function stripShell(main) {
    main.querySelector(':scope > .hx-bed-p1')?.remove()
    main.querySelector(':scope > .hx-bed-p2')?.remove()
    delete main.dataset[LAYOUT_KEY]
    for (const el of main.querySelectorAll(':scope > aside, :scope > .bed-center, :scope > .bed-right')) {
      el.hidden = false
    }
  }

  function createShell(main) {
    main.dataset[LAYOUT_KEY] = LAYOUT_VER
    main.classList.add('hx-bed-layout')
    document.body.classList.add(BODY_FLAG)

    const p1 = document.createElement('div')
    p1.className = 'hx-bed-p1'
    const p1Left = document.createElement('div')
    p1Left.className = 'hx-bed-p1-left'
    const p1Right = document.createElement('div')
    p1Right.className = 'hx-bed-p1-video'
    p1.append(p1Left, p1Right)

    const p2 = document.createElement('div')
    p2.className = 'hx-bed-p2 patient-detail'

    const nav = document.createElement('nav')
    nav.className = 'record-tabs hx-bed-record-tabs'
    nav.setAttribute('role', 'tablist')

    const content = document.createElement('div')
    content.className = 'record-content hx-bed-record-content'

    for (const tab of TABS) {
      const pane = document.createElement('div')
      pane.className = 'hx-bed-tab-pane'
      pane.dataset.tab = tab
      content.appendChild(pane)
    }

    p2.append(nav, p1, content)
    main.prepend(p2)

    return { p1, p2, nav, content }
  }

  function ensureShell(main) {
    if (needsFullRebuild(main)) {
      stripShell(main)
      createShell(main)
    }

    const p2 = main.querySelector(':scope > .hx-bed-p2')
    const p1 = p2?.querySelector(':scope > .hx-bed-p1')
    if (!p1 || !p2) return { p1: null, p2: null }
    const p1Right = p1.querySelector('.hx-bed-p1-video')
    const content = p2.querySelector('.hx-bed-record-content')
    const bedCenter = main.querySelector(':scope > .bed-center')

    ensureVideoSlot(p1Right, bedCenter)
    moveLegacyIntoTabs(main, content)
    buildTabsNav(main, p2.querySelector('.hx-bed-record-tabs'))

    return { p1, p2 }
  }

  function teardown() {
    document.body.classList.remove(BODY_FLAG)
    document.querySelectorAll('main.single-bed.hx-bed-layout').forEach((main) => {
      stripShell(main)
      main.classList.remove('hx-bed-layout')
      delete main.dataset.hxBedTab
    })
  }

  function render() {
    const p = path()
    if (!p.startsWith('/bed/')) {
      teardown()
      return
    }
    const main = document.querySelector('main.single-bed')
    if (!main) return

    ensureShell(main)

    if (typeof window.hxVideoPlaceholder?.scan === 'function') window.hxVideoPlaceholder.scan()
  }

  window.addEventListener('hashchange', () => {
    bindIndex = null
    bindLoad = null
    document.querySelectorAll('main.single-bed').forEach((main) => {
      stripShell(main)
      main.classList.remove('hx-bed-layout')
      delete main.dataset.hxBedTab
    })
  })

  let watchBound = false
  function bindRootWatch() {
    if (watchBound) return
    watchBound = true
    const root = document.getElementById('root') || document.body
    let moTimer = null
    const mo = new MutationObserver(() => {
      if (!path().startsWith('/bed/')) return
      clearTimeout(moTimer)
      moTimer = setTimeout(render, 180)
    })
    mo.observe(root, { childList: true, subtree: true })
  }

  function boot() {
    bindRootWatch()
    render()
    let tries = 0
    const retry = setInterval(() => {
      render()
      tries += 1
      if (tries > 24 || document.querySelector('main.single-bed.hx-bed-layout #hx-bed-p1-info')) {
        clearInterval(retry)
      }
    }, 350)
  }

  window.__hxBedPageLayout = render
  window.hxEnhance(boot, { wait: 280, afterNav: 120 })
})()
