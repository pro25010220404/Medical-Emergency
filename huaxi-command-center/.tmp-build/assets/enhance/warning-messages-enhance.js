/**
 * 预警通知（#/messages）：顶部四指标可点击筛选，避免「只能看不能点」的展示感
 */
;(function () {
  const STEPS = [
    { key: 'new', label: '待测评' },
    { key: 'acknowledged', label: '待干预' },
    { key: 'treating', label: '待复评' },
    { key: 'resolved', label: '已处置' },
  ]

  function path() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function statusFromUrl() {
    const raw = location.hash.replace(/^#/, '')
    const q = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : ''
    return new URLSearchParams(q).get('status') || ''
  }

  function findStatusSelect() {
    const aside = document.querySelector('.message-workspace aside')
    if (!aside) return null
    return aside.querySelector('select')
  }

  function applyStatus(key) {
    const sel = findStatusSelect()
    if (sel && sel.value !== key) {
      sel.value = key
      sel.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const qs = key && key !== 'all' ? `?status=${encodeURIComponent(key)}` : ''
    const want = `#/messages${qs}`
    if (location.hash !== want) location.hash = want
  }

  function cardLabel(card) {
    const t = (card.textContent || '').replace(/\s+/g, '')
    return STEPS.find((s) => t.includes(s.label))?.key || ''
  }

  function render() {
    if (path() !== '/messages') {
      document.getElementById('hx-messages-hint')?.remove()
      return
    }

    const row = document.querySelector('main.workspace .metric-row')
    if (!row) return

    let hint = document.getElementById('hx-messages-hint')
    if (!hint) {
      hint = document.createElement('p')
      hint.id = 'hx-messages-hint'
      hint.className = 'hx-messages-hint'
      row.insertAdjacentElement('afterend', hint)
    }
    hint.textContent =
      '点击指标按处置阶段筛选通知；再次点击当前项可查看全部。列表内「查看患者与处置」进入闭环。'

    const urlStatus = statusFromUrl()
    const sel = findStatusSelect()
    if (urlStatus && sel && sel.value !== urlStatus) {
      sel.value = urlStatus
      sel.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const active = sel?.value || urlStatus || 'all'

    ;[...row.children].forEach((card) => {
      const key = cardLabel(card)
      if (!key) return
      card.classList.add('hx-alert-metric')
      card.setAttribute('role', 'button')
      card.setAttribute('aria-pressed', active === key ? 'true' : 'false')
      card.classList.toggle('is-active', active === key)

      if (card.dataset.hxMetricBound) return
      card.dataset.hxMetricBound = '1'
      card.tabIndex = 0

      const toggle = () => {
        const cur = findStatusSelect()?.value || 'all'
        applyStatus(cur === key ? 'all' : key)
      }
      card.addEventListener('click', toggle)
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          toggle()
        }
      })
    })
  }

  window.hxEnhance(render, { wait: 280, observeRoot: true, afterNav: 80 })
})()
