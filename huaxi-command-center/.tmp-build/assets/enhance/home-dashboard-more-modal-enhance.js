/**
 * 县域指挥概览 · 右侧「更多」→ 大屏弹窗（内容与对应面板列表一致，仅放大展示）
 */
;(function () {
  const PANELS = {
    dispatch: { title: '今日急救调度事件', hash: '#/patients' },
    warning: { title: '24小时院内评分预警', hash: '#/warning' },
    critical: { title: '24小时县域智慧重症事件', hash: '#/critical' },
  }

  let openKind = null
  /** @type {HTMLElement[]} */
  let cloneSourceButtons = []

  function path() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function isHome() {
    if (document.body.classList.contains('hx-page-map-only')) return false
    const p = path()
    return p === '/' || p === ''
  }

  function findPanel(titlePart) {
    return [...document.querySelectorAll('.dashboard .panel')].find((p) => {
      const h2 = p.querySelector('.panel-title h2')
      return h2 && (h2.textContent || '').includes(titlePart)
    })
  }

  /**
   * 从指定面板复制 event-feed 条目（与卡片内展示同源、同文案）
   * @returns {{ html: string, count: number, sources: HTMLElement[] }}
   */
  function scrapePanelFeed(panel) {
    cloneSourceButtons = []
    if (!panel) {
      return { html: '<p class="api-muted">未找到列表面板</p>', count: 0, sources: [] }
    }
    const feed = panel.querySelector('.panel-body .event-feed, .event-feed')
    if (!feed) {
      return { html: '<p class="api-muted">暂无数据</p>', count: 0, sources: [] }
    }

    const directItems = [...feed.querySelectorAll(':scope > button, :scope > a')]
    const emptyEl = feed.querySelector(':scope > .api-muted, :scope > .empty')

    if (!directItems.length) {
      if (emptyEl) return { html: emptyEl.outerHTML, count: 0, sources: [] }
      return { html: feed.innerHTML.trim() || '<p class="api-muted">暂无记录</p>', count: 0, sources: [] }
    }

    const html = directItems
      .map((el, i) => {
        cloneSourceButtons.push(el)
        return (
          `<button type="button" class="event-feed-item hx-home-more-clone" data-src-idx="${i}">` +
          el.innerHTML +
          '</button>'
        )
      })
      .join('')

    return { html, count: directItems.length, sources: directItems }
  }

  function ensureShell() {
    let root = document.getElementById('hx-home-more')
    if (root) return root
    root = document.createElement('div')
    root.id = 'hx-home-more'
    root.className = 'hx-home-more'
    root.hidden = true
    root.innerHTML =
      '<div class="hx-home-more__backdrop" data-act="close" aria-hidden="true"></div>' +
      '<div class="hx-home-more__panel" role="dialog" aria-modal="true" aria-labelledby="hx-home-more-title">' +
      '<header class="hx-home-more__head">' +
      '<h2 id="hx-home-more-title"></h2>' +
      '<p class="hx-home-more__sub" id="hx-home-more-sub">与右侧该模块列表相同，便于大屏查看</p>' +
      '<button type="button" class="hx-home-more__close" data-act="close" aria-label="关闭">×</button>' +
      '</header>' +
      '<div class="hx-home-more__body"><div class="event-feed hx-home-more-feed" id="hx-home-more-feed"></div></div>' +
      '<footer class="hx-home-more__foot">' +
      '<span class="hx-home-more__count" id="hx-home-more-count"></span>' +
      '<a class="hx-home-more__full" id="hx-home-more-full" href="#">进入完整模块 →</a>' +
      '</footer></div>'
    document.body.appendChild(root)

    root.addEventListener('click', (e) => {
      const act = e.target instanceof Element ? e.target.closest('[data-act]') : null
      if (act && act.getAttribute('data-act') === 'close') {
        e.preventDefault()
        closeModal()
        return
      }
      const clone = e.target instanceof Element ? e.target.closest('.hx-home-more-clone') : null
      if (clone && root.contains(clone)) {
        e.preventDefault()
        const idx = Number(clone.getAttribute('data-src-idx'))
        const src = cloneSourceButtons[idx]
        closeModal()
        if (src && typeof src.click === 'function') src.click()
        return
      }
    })

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && openKind) closeModal()
    })

    return root
  }

  function closeModal() {
    const root = document.getElementById('hx-home-more')
    if (!root) return
    root.hidden = true
    document.body.classList.remove('hx-home-more-open')
    openKind = null
    cloneSourceButtons = []
  }

  function openModal(kind, title, panelEl) {
    if (!PANELS[kind]) return
    const root = ensureShell()
    const cfg = PANELS[kind]
    const panel = panelEl || findPanel(cfg.title)
    openKind = kind
    root.hidden = false
    document.body.classList.add('hx-home-more-open')

    const titleEl = document.getElementById('hx-home-more-title')
    const feed = document.getElementById('hx-home-more-feed')
    const countEl = document.getElementById('hx-home-more-count')
    const full = document.getElementById('hx-home-more-full')
    if (titleEl) titleEl.textContent = title || cfg.title
    if (full) full.setAttribute('href', cfg.hash)

    const scraped = scrapePanelFeed(panel)
    if (feed) feed.innerHTML = scraped.html
    if (countEl) {
      countEl.textContent = scraped.count ? `共 ${scraped.count} 条（与右侧列表一致）` : '与右侧空态一致'
    }
  }

  window.__hxHomeMoreOpen = openModal

  function panelTitleFrom(panel) {
    const h2 = panel?.querySelector('.panel-title h2')
    if (h2) return (h2.textContent || '').replace(/\s+/g, ' ').trim()
    const header = panel?.querySelector('.panel-title')
    if (!header) return ''
    const clone = header.cloneNode(true)
    clone.querySelector('.v-mark')?.remove()
    clone.querySelector('.panel-action')?.remove()
    return (clone.textContent || '').replace(/\s+/g, ' ').trim()
  }

  function panelKind(title) {
    if (title.includes('急救调度')) return 'dispatch'
    if (title.includes('预警')) return 'warning'
    if (title.includes('重症')) return 'critical'
    return null
  }

  function isMoreControl(el) {
    const t = (el.textContent || '').replace(/\s+/g, '').trim()
    return t === '更多' || t.includes('更多') || t === '预警中心' || t === '重症监护'
  }

  document.addEventListener(
    'click',
    (event) => {
      if (!isHome()) return
      const target = event.target
      if (!(target instanceof Element)) return
      const right = document.querySelector('.dashboard-right')
      if (!right || !right.contains(target)) return
      const moreBtn = target.closest(
        '.panel-action .link-button, .panel-action a, .panel-action button, .panel-title .link-button, .panel-title a, .panel-title button',
      )
      if (!moreBtn || !isMoreControl(moreBtn)) return
      const panel = moreBtn.closest('.panel')
      const title = panelTitleFrom(panel)
      const kind = panelKind(title)
      if (!kind) return
      event.preventDefault()
      event.stopImmediatePropagation()
      openModal(kind, title, panel)
    },
    true,
  )
})()
