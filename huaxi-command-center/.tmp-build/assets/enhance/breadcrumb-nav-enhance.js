/**
 * 顶栏页签栏（参考多页签）：打开过的页面横向排列，点击切换，× 关闭。
 * 标题来自 sidebar IA；不含「指挥中枢」一级模块名。
 */
;(function () {
  const HOME = {
    id: 'home',
    title: '指挥中枢',
    home: '/',
    links: [
      ['/', '县域指挥概览'],
      ['/map', '协作三维地图'],
    ],
  }

  const PLATES = [
    {
      id: 'dispatch',
      title: '智慧急救调度',
      home: '/dispatch',
      hub: { link: '/dispatch', label: '实时出警' },
      links: [
        ['/dispatch', '实时出警'],
        ['/dispatch/list', '出警列表'],
        ['/dispatch/events', '事件列表'],
        ['/ambulances', '救护车列表'],
        ['/patients', '患者列表'],
        ['/register', '患者登记'],
        ['/consultations', '远程会诊'],
        ['/consultations?tab=grassroots', '基层会诊'],
        ['/transfers?scope=grassroots', '医院转诊'],
        ['/transfers', '医院转诊'],
        ['/critical?mode=grassroots-remote', '基层远程监护'],
        ['/coordination', '任务协同'],
      ],
    },
    {
      id: 'warning',
      title: '院内早期预警',
      home: '/warning',
      hub: { link: '/warning', label: '预警总览' },
      links: [
        ['/warning', '预警总览'],
        ['/warning?view=departments', '科室监控'],
        ['/patients?focus=1', '重点关注'],
        ['/messages', '预警通知'],
      ],
    },
    {
      id: 'critical',
      title: '县域智慧重症',
      home: '/critical',
      hub: { link: '/critical', label: '重症监护' },
      links: [
        ['/critical', '重症监护'],
        ['/critical?view=wards', '床位全景'],
        ['/critical?mode=town', '乡镇监护'],
        ['/devices', '床旁设备'],
        ['/centers', '五大中心'],
        ['/organizations', '协作机构'],
      ],
    },
    {
      id: 'quality',
      title: '智能医疗质控',
      home: '/medical-quality',
      hub: { link: '/medical-quality', label: '质控整改看板' },
      links: [
        ['/medical-quality', '质控整改看板'],
        ['/medical-quality/reports', '质控统计'],
      ],
    },
    {
      id: 'dr',
      title: '基层医声Dr.',
      home: '/dr?view=videos',
      links: [['/dr?view=videos', '视频展示']],
    },
  ]

  const GROUPS = [HOME, ...PLATES]

  /** 带 query 的二级页：先经过模块 hub 再落到当前菜单 */
  const QUERY_CHILD = [
    { path: '/warning', query: { view: 'departments' }, parentLink: '/warning', parentLabel: '预警总览', label: '科室监控' },
    { path: '/critical', query: { view: 'wards' }, parentLink: '/critical', parentLabel: '重症监护', label: '床位全景' },
    { path: '/critical', query: { mode: 'town' }, parentLink: '/critical', parentLabel: '重症监护', label: '乡镇监护' },
    { path: '/critical', query: { mode: 'grassroots-remote' }, parentLink: '/dispatch', parentLabel: '实时出警', label: '基层远程监护', groupId: 'dispatch' },
    { path: '/medical-quality/reports', query: null, parentLink: '/medical-quality', parentLabel: '质控整改看板', label: '质控统计' },
  ]

  const GROUPS_USE_HUB = { dispatch: true, warning: false, critical: false, quality: false }

  const TAB_STORAGE = 'hx-nav-tab-strip-v2'
  /** 含固定「首页」，最多再保留 5 个最近访问页；新开页自动挤掉最久未点的 */
  const MAX_TABS = 6
  let tabSeq = 0
  let suppressTabRegister = false

  function hashPath() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function hashQuery() {
    const raw = location.hash.replace(/^#/, '')
    const q = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : ''
    return new URLSearchParams(q)
  }

  function isMapPage() {
    return document.body.classList.contains('hx-page-map-only')
  }

  function isGrassrootsConsult() {
    const q = hashQuery()
    return q.get('tab') === 'grassroots' || q.get('scope') === 'grassroots'
  }

  function skipShell() {
    const p = hashPath()
    if (/^\/phone/.test(p)) return true
    if (!document.body.classList.contains('hx-sidebar-shell')) return true
    if (!document.querySelector('.app-shell')) return true
    return false
  }

  function hrefToHash(link) {
    return '#' + (link.startsWith('/') ? link : '/' + link)
  }

  function linkMatches(link) {
    const [pathPart, queryPart] = link.split('?')
    const wantPath = pathPart.startsWith('/') ? pathPart : '/' + pathPart
    const cur = hashPath()
    if (link === '/map') return isMapPage()
    if (link === '/') return (cur === '/' || cur === '') && !isMapPage()
    if (link === '/consultations?tab=grassroots') {
      return isGrassrootsConsult() && (cur === '/consultations' || cur === '/consultations/pick')
    }
    if (wantPath === '/consultations' && !queryPart) {
      if (isGrassrootsConsult()) return false
      return cur === '/consultations' || cur === '/consultations/pick'
    }
    if (wantPath === '/patients' && queryPart && queryPart.indexOf('focus=1') >= 0) {
      return cur === '/patients' && hashQuery().get('focus') === '1'
    }
    if (wantPath === '/transfers' && queryPart && queryPart.indexOf('scope=grassroots') >= 0) {
      return cur === '/transfers' && hashQuery().get('scope') === 'grassroots'
    }
    if (wantPath !== cur) return false
    if (!queryPart) {
      if (wantPath === '/patients' && hashQuery().get('focus') === '1') return false
      if (wantPath === '/transfers' && hashQuery().get('scope') === 'grassroots') return false
      if (wantPath === '/critical' && (hashQuery().get('view') || hashQuery().get('mode'))) return false
      if (wantPath === '/warning' && hashQuery().get('view')) return false
      return !hashQuery().toString() || (wantPath === '/consultations' && hashQuery().get('launch'))
    }
    const want = new URLSearchParams(queryPart)
    for (const [k, v] of want.entries()) {
      if (hashQuery().get(k) !== v) return false
    }
    return true
  }

  function activeGroupId() {
    if (document.body.classList.contains('hx-page-map-only')) return HOME.id
    const path = hashPath()
    const q = hashQuery()
    if (path === '/' || path === '') return HOME.id
    if (path === '/patients' && q.get('focus') === '1') return 'warning'
    if (path.startsWith('/medical-quality')) return 'quality'
    if (path.startsWith('/dr')) return 'dr'
    if (path.startsWith('/warning') || path === '/messages') return 'warning'
    if (path === '/quality' || path.startsWith('/medical-quality')) return 'quality'
    if (path.startsWith('/critical') && q.get('mode') === 'grassroots-remote') return 'dispatch'
    if (
      path.startsWith('/critical') ||
      path.startsWith('/devices') ||
      path.startsWith('/centers') ||
      path.startsWith('/organizations') ||
      path.startsWith('/bed/')
    ) {
      return 'critical'
    }
    if (
      path.startsWith('/dispatch') ||
      path.startsWith('/ambulances') ||
      path === '/patients' ||
      path.startsWith('/register') ||
      path.startsWith('/consultations') ||
      path.startsWith('/transfers') ||
      path.startsWith('/coordination') ||
      path.startsWith('/transport/') ||
      path.startsWith('/patient/') ||
      path.startsWith('/episode/') ||
      path.startsWith('/room/') ||
      path.startsWith('/join/')
    ) {
      return 'dispatch'
    }
    return HOME.id
  }

  function matchNavLink(links) {
    if (!links || !links.length) return null
    const sorted = links.slice().sort(function (a, b) {
      const score = function (x) {
        return (x[0].indexOf('?') >= 0 ? 1000 : 0) + x[0].length
      }
      return score(b) - score(a)
    })
    for (let i = 0; i < sorted.length; i++) {
      if (linkMatches(sorted[i][0])) return { link: sorted[i][0], label: sorted[i][1] }
    }
    return null
  }

  function terminalLabel(fallback) {
    const h1 = document.querySelector('main.workspace h1, main h1.workspace, .workspace-heading h1')
    const t = (h1 && h1.textContent || '').trim().replace(/\s+/g, ' ')
    if (t && t.length <= 36) return t
    if (t && t.length > 36) return t.slice(0, 34) + '…'
    return fallback || '当前页'
  }

  function hasDispatchContext() {
    const q = hashQuery()
    return !!(q.get('task') || q.get('plate') || q.get('event'))
  }

  function queryChildMatch(path, q) {
    for (let i = 0; i < QUERY_CHILD.length; i++) {
      const row = QUERY_CHILD[i]
      if (row.path !== path) continue
      if (!row.query) continue
      let ok = true
      for (const k in row.query) {
        if (q.get(k) !== row.query[k]) ok = false
      }
      if (ok) return row
    }
    if (path === '/medical-quality/reports') {
      return QUERY_CHILD.filter(function (r) { return r.path === '/medical-quality/reports' })[0]
    }
    return null
  }

  function pushLink(trail, link, label) {
    trail.push({ link: link, label: label })
  }

  function pushCurrent(trail, label) {
    trail.push({ label: label, current: true })
  }

  function buildDetailTrail(path, group) {
    const hub = group.hub
    const useHub = GROUPS_USE_HUB[group.id] && hub

    if (path.startsWith('/patient/')) {
      const t = []
      if (useHub) pushLink(t, hub.link, hub.label)
      pushLink(t, '/patients', '患者列表')
      pushCurrent(t, terminalLabel('患者档案'))
      return t
    }
    if (path.startsWith('/episode/')) {
      const t = []
      if (useHub) pushLink(t, hub.link, hub.label)
      pushLink(t, '/patients', '患者列表')
      pushCurrent(t, terminalLabel('连续诊疗'))
      return t
    }
    if (path.startsWith('/room/') || path.startsWith('/join/')) {
      const t = []
      if (hasDispatchContext()) pushLink(t, '/dispatch', '实时出警')
      const consultLink = isGrassrootsConsult() ? '/consultations?tab=grassroots' : '/consultations'
      const consultLabel = isGrassrootsConsult() ? '基层会诊' : '远程会诊'
      pushLink(t, consultLink, consultLabel)
      pushCurrent(t, terminalLabel('会诊室'))
      return t
    }
    if (path === '/consultations/pick') {
      const t = []
      if (useHub) pushLink(t, hub.link, hub.label)
      pushLink(t, '/consultations?tab=grassroots', '基层会诊')
      pushCurrent(t, '选择患者')
      return t
    }
    if (path.startsWith('/bed/')) {
      const t = []
      pushLink(t, '/critical', '重症监护')
      pushLink(t, '/critical?view=wards', '床位全景')
      pushCurrent(t, terminalLabel('床位详情'))
      return t
    }
    if (path.startsWith('/medical-quality/rectify')) {
      const t = []
      pushLink(t, '/medical-quality', '质控整改看板')
      pushCurrent(t, terminalLabel('整改详情'))
      return t
    }
    if (path.startsWith('/transport/')) {
      const t = []
      pushLink(t, '/dispatch', '实时出警')
      pushCurrent(t, terminalLabel('转运任务'))
      return t
    }
    return null
  }

  function buildPlateTrail(group, path, q) {
    const detail = buildDetailTrail(path, group)
    if (detail) return detail

    const child = queryChildMatch(path, q)
    if (child) {
      const t = []
      pushLink(t, child.parentLink, child.parentLabel)
      pushCurrent(t, child.label)
      return t
    }

    const hub = group.hub
    const useHubAll = GROUPS_USE_HUB[group.id] && hub
    const leaf = matchNavLink(group.links)

    const trail = []

    if (!leaf) {
      pushCurrent(trail, terminalLabel('当前页'))
      return trail
    }

    const onHub =
      hub && leaf.link.split('?')[0] === hub.link.split('?')[0] && linkMatches(hub.link)

    if (useHubAll && !onHub) {
      pushLink(trail, hub.link, hub.label)
    }

    if (hasDispatchContext() && group.id === 'dispatch' && (path === '/consultations' || path.startsWith('/consultations') || path === '/transfers')) {
      if (!trail.some(function (x) { return x.link === '/dispatch' })) {
        pushLink(trail, '/dispatch', '实时出警')
      }
    }

    if (linkMatches(leaf.link)) {
      pushCurrent(trail, leaf.label)
    } else {
      pushLink(trail, leaf.link, leaf.label)
      pushCurrent(trail, terminalLabel(leaf.label))
    }

    return trail
  }

  function buildCrumbs() {
    const path = hashPath()
    const q = hashQuery()
    const crumbs = []

    if (path === '/' || path === '') {
      if (isMapPage()) {
        crumbs.push({ label: '协作三维地图', current: true })
      } else {
        crumbs.push({ label: '首页', current: true })
      }
      return crumbs
    }

    const gid = activeGroupId()
    const group = GROUPS.filter(function (g) { return g.id === gid })[0] || PLATES[0]

    if (gid === 'home') {
      crumbs.push({ label: terminalLabel('当前页'), current: true })
      return crumbs
    }

    crumbs.push({
      label: group.title,
      hash: hrefToHash(group.home || (group.links && group.links[0][0]) || '/'),
    })

    const plateTrail = buildPlateTrail(group, path, q)
    plateTrail.forEach(function (item) {
      if (item.current) crumbs.push({ label: item.label, current: true })
      else crumbs.push({ label: item.label, hash: hrefToHash(item.link) })
    })

    return crumbs
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;')
  }

  function currentHash() {
    return location.hash || '#/'
  }

  /** 同一业务页合并为一个页签（忽略 launch、_t 等临时参数） */
  function tabKey(hash) {
    const raw = (hash || '#/').replace(/^#/, '')
    const qix = raw.indexOf('?')
    const path = (qix >= 0 ? raw.slice(0, qix) : raw).replace(/\/$/, '') || '/'
    const q = new URLSearchParams(qix >= 0 ? raw.slice(qix + 1) : '')
    ;['launch', '_t', 'apiOrigin'].forEach(function (k) {
      q.delete(k)
    })
    const qs = q.toString()
    return '#' + path + (qs ? '?' + qs : '')
  }

  function pageTabLabel() {
    const crumbs = buildCrumbs()
    for (let i = crumbs.length - 1; i >= 0; i--) {
      if (crumbs[i].current) return crumbs[i].label
    }
    return crumbs.length ? crumbs[crumbs.length - 1].label : '页面'
  }

  function loadTabState() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(TAB_STORAGE) || 'null')
      if (parsed && Array.isArray(parsed.tabs) && parsed.tabs.length) {
        const now = Date.now()
        parsed.tabs.forEach(function (t, i) {
          if (t.lastAt == null) t.lastAt = now - i
        })
        parsed.tabs = parsed.tabs.filter(function (t) {
          const p = (t.hash || '').replace(/^#/, '').split('?')[0] || '/'
          return p !== '/coordination' && t.label !== '任务协同'
        })
        if (!parsed.tabs.length) {
          parsed.tabs = [{ id: 'tab-home', hash: '#/', label: '首页', pinned: true, lastAt: Date.now() }]
          parsed.active = 'tab-home'
        } else if (!parsed.tabs.some(function (t) { return t.id === parsed.active })) {
          parsed.active = parsed.tabs[parsed.tabs.length - 1].id
        }
        while (parsed.tabs.length > MAX_TABS) {
          evictOneTab(parsed.tabs, parsed.active)
        }
        return parsed
      }
    } catch {
      /* ignore */
    }
    return {
      tabs: [{ id: 'tab-home', hash: '#/', label: '首页', pinned: true, lastAt: Date.now() }],
      active: 'tab-home',
    }
  }

  function saveTabState(state) {
    try {
      sessionStorage.setItem(TAB_STORAGE, JSON.stringify(state))
    } catch {
      /* ignore */
    }
  }

  function evictOneTab(tabs, keepId) {
    let victim = -1
    let oldest = Infinity
    for (let i = 0; i < tabs.length; i++) {
      const t = tabs[i]
      if (t.pinned || t.id === keepId) continue
      const at = typeof t.lastAt === 'number' ? t.lastAt : 0
      if (at < oldest) {
        oldest = at
        victim = i
      }
    }
    if (victim >= 0) {
      tabs.splice(victim, 1)
      return true
    }
    return false
  }

  function registerTabForHash() {
    if (suppressTabRegister) return loadTabState()
    const hash = currentHash()
    const pathOnly = hash.replace(/^#/, '').split('?')[0] || '/'
    if (pathOnly === '/coordination') return loadTabState()
    const key = tabKey(hash)
    const label = pageTabLabel()
    if (label === '任务协同') return loadTabState()
    const state = loadTabState()
    const now = Date.now()
    let hit = null
    for (let i = 0; i < state.tabs.length; i++) {
      if (tabKey(state.tabs[i].hash) === key) {
        hit = state.tabs[i]
        break
      }
    }
    if (hit) {
      hit.hash = hash
      hit.label = label
      hit.lastAt = now
      state.active = hit.id
    } else {
      while (state.tabs.length >= MAX_TABS) {
        if (!evictOneTab(state.tabs, null)) break
      }
      const id = 'tab-' + String(++tabSeq) + '-' + now.toString(36)
      state.tabs.push({ id: id, hash: hash, label: label, lastAt: now })
      state.active = id
    }
    saveTabState(state)
    return state
  }

  function navigateHash(href) {
    if (!href || href.charAt(0) !== '#') return
    if (href.replace(/^#/, '').split('?')[0] === '/map') {
      if (typeof window.hxMapPage?.enter === 'function') {
        window.hxMapPage.enter()
        return
      }
      document.body.classList.add('hx-page-map-only')
      window.dispatchEvent(new CustomEvent('hx-map-page', { detail: { active: true } }))
    }
    if (window.hxIntegratedNav?.spaGo) {
      window.hxIntegratedNav.spaGo(href)
      return
    }
    if (location.hash !== href) location.hash = href
    else window.dispatchEvent(new HashChangeEvent('hashchange'))
  }

  function closeTab(id) {
    const state = loadTabState()
    const idx = state.tabs.findIndex(function (t) {
      return t.id === id
    })
    if (idx < 0) return
    if (state.tabs[idx].pinned) return
    const wasActive = state.active === id
    state.tabs.splice(idx, 1)
    if (!state.tabs.length) {
      state.tabs.push({ id: 'tab-home', hash: '#/', label: '首页', pinned: true })
    }
    if (wasActive) {
      const next = state.tabs[state.tabs.length - 1]
      state.active = next.id
      suppressTabRegister = true
      navigateHash(next.hash)
      suppressTabRegister = false
    }
    saveTabState(state)
    renderTabStrip(state)
  }

  function renderTabStrip(state) {
    const strip = document.getElementById('hx-nav-tabs')
    if (!strip) return
    const html = state.tabs
      .map(function (t) {
        const on = t.id === state.active
        const closeBtn = t.pinned
          ? ''
          : '<span class="hx-nav-tabs__close" role="button" tabindex="-1" data-hx-tab-close="' +
            esc(t.id) +
            '" aria-label="关闭"></span>'
        return (
          '<div class="hx-nav-tabs__item' +
          (on ? ' is-active' : '') +
          (t.pinned ? ' is-pinned' : '') +
          '" role="presentation">' +
          '<button type="button" class="hx-nav-tabs__tab" role="tab" aria-selected="' +
          (on ? 'true' : 'false') +
          '" data-hx-tab="' +
          esc(t.id) +
          '" data-hx-tab-hash="' +
          esc(t.hash) +
          '">' +
          '<span class="hx-nav-tabs__label">' +
          esc(t.label) +
          '</span>' +
          closeBtn +
          '</button>' +
          '</div>'
        )
      })
      .join('')
    const inner = strip.querySelector('.hx-nav-tabs__scroll')
    if (inner && inner.innerHTML !== html) inner.innerHTML = html
  }

  function tabStripHost() {
    return document.querySelector('.app-shell.hx-sidebar-ready .command-header .header-left')
  }

  function placeTabStrip(strip) {
    const host = tabStripHost()
    if (!host || !strip) return false
    const time = host.querySelector('time')
    if (time) {
      if (strip.parentElement !== host || strip.previousElementSibling !== time) {
        time.insertAdjacentElement('afterend', strip)
      }
    } else if (strip.parentElement !== host) {
      host.appendChild(strip)
    }
    return true
  }

  function ensureTabStrip() {
    let strip = document.getElementById('hx-nav-tabs')
    if (strip) {
      placeTabStrip(strip)
      return strip
    }
    strip = document.createElement('div')
    strip.id = 'hx-nav-tabs'
    strip.className = 'hx-nav-tabs'
    strip.setAttribute('role', 'navigation')
    strip.setAttribute('aria-label', '已打开页面')
    strip.innerHTML = '<div class="hx-nav-tabs__scroll"></div>'
    if (!placeTabStrip(strip)) return null
    strip.addEventListener('click', function (e) {
      const t = e.target
      if (!(t instanceof Element)) return
      const closeId = t.closest('[data-hx-tab-close]')?.getAttribute('data-hx-tab-close')
      if (closeId) {
        e.preventDefault()
        e.stopPropagation()
        closeTab(closeId)
        return
      }
      const tabBtn = t.closest('[data-hx-tab]')
      if (!tabBtn) return
      const href = tabBtn.getAttribute('data-hx-tab-hash') || ''
      const state = loadTabState()
      const tabId = tabBtn.getAttribute('data-hx-tab') || state.active
      state.active = tabId
      const tabRec = state.tabs.filter(function (x) {
        return x.id === tabId
      })[0]
      if (tabRec) tabRec.lastAt = Date.now()
      saveTabState(state)
      navigateHash(href)
    })
    return strip
  }

  function mount() {
    document.getElementById('hx-breadcrumb')?.remove()

    if (skipShell()) {
      document.body.classList.remove('hx-nav-tabs-active')
      const strip = document.getElementById('hx-nav-tabs')
      if (strip) strip.hidden = true
      return
    }

    if (!document.querySelector('.app-shell')) return

    const stripEl = ensureTabStrip()
    if (!stripEl) return
    stripEl.hidden = false
    const state = registerTabForHash()
    renderTabStrip(state)
    document.body.classList.add('hx-nav-tabs-active')

    const activeEl = document.querySelector('.hx-nav-tabs__item.is-active')
    if (activeEl && activeEl.scrollIntoView) {
      activeEl.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }

  window.addEventListener('hashchange', function () {
    setTimeout(mount, 0)
  })
  window.hxEnhance(mount, { wait: 280, observeRoot: true, afterNav: 100 })
})()
