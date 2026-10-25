/**
 * 院前（dispatch.html / 出警 embed）：发起远程会诊 — 弹窗走顶层，跳转改顶层 hash
 */
;(function () {
  function readDhForm(form) {
    if (!form) return null
    const labels = [...form.querySelectorAll('label')]
    function field(match) {
      const lab = labels.find((l) => (l.textContent || '').includes(match))
      const el = lab?.querySelector('input, textarea, select')
      return (el && 'value' in el ? String(el.value) : '').trim()
    }
    return {
      task120Id: field('120') || field('任务'),
      eventId: '',
      name: field('姓名'),
      chiefComplaint: field('主诉'),
      vehiclePlate: field('车牌'),
      vehicleId: '',
    }
  }

  function readCtxFromDesk(desk) {
    if (!desk) return null
    const lead = desk.querySelector('.dh-lead')
    const leadText = (lead?.textContent || '').trim()
    const taskFromLead = leadText.match(/任务\s*(120[-\w]+)/i)
    let task120Id = taskFromLead ? taskFromLead[1] : ''
    let chiefComplaint = ''
    desk.querySelectorAll('.dh-desk-meta div').forEach(function (row) {
      const dt = (row.querySelector('dt')?.textContent || '').trim()
      const dd = (row.querySelector('dd')?.textContent || '').trim()
      if (dt.indexOf('主诉') >= 0) chiefComplaint = dd
    })
    if (!task120Id) {
      const m = (desk.textContent || '').match(/120[-\w]+/i)
      if (m) task120Id = m[0]
    }
    return {
      task120Id,
      eventId: '',
      name: '',
      chiefComplaint,
      vehiclePlate: '',
      vehicleId: '',
    }
  }

  function blockReason(ctx) {
    const task = (ctx.task120Id || ctx.eventId || '').trim()
    if (!task) return '请先选择出警任务或填写 120 任务号，再发起远程会诊。'
    if (!(ctx.chiefComplaint || '').trim()) return '请填写主诉（可从左侧任务带入），再发起远程会诊。'
    return null
  }

  function consultUrl(ctx) {
    const q = new URLSearchParams()
    if (ctx.task120Id) q.set('task', ctx.task120Id)
    if (ctx.eventId) q.set('event', ctx.eventId)
    if (ctx.vehiclePlate) q.set('plate', ctx.vehiclePlate)
    if (ctx.vehicleId) q.set('vehicle', ctx.vehicleId)
    if (ctx.chiefComplaint) q.set('complaint', ctx.chiefComplaint)
    const s = q.toString()
    return s ? `/app.html#/consultations?${s}&launch=1` : '/app.html#/consultations?tab=grassroots'
  }

  function dialogHost() {
    try {
      var top = window.top || window
      if (top !== window && typeof top.__hxConsultDialog === 'function') {
        return top.__hxConsultDialog.bind(top)
      }
    } catch (e) {
      /* ignore */
    }
    if (typeof window.__hxConsultDialog === 'function') return window.__hxConsultDialog
    return null
  }

  function dialog(opts) {
    var host = dialogHost()
    if (host) return host(opts)
    if (opts.variant === 'alert') {
      window.alert([opts.body, opts.lead].filter(Boolean).join('\n\n'))
      return Promise.resolve(true)
    }
    return Promise.resolve(window.confirm([opts.body, opts.lead].filter(Boolean).join('\n\n')))
  }

  function normalizeAppHash(href) {
    var h = href || ''
    if (h.indexOf('/#/') === 0) return h.slice(1)
    return h
  }

  function shouldLeaveLinkAlone(link) {
    if (!/\/app\.html$/i.test(location.pathname)) return false
    var href = normalizeAppHash(link.getAttribute('href') || '')
    if (href.charAt(0) !== '#') return false
    if (
      link.closest(
        '.hx-gr-consult, #hx-grassroots-consult-root, #hx-consult-pick-root, .hx-sidebar-menu, nav.subnav, .hx-consult-tabs, .hx-consult-mode, .hx-consult-tab',
      )
    ) {
      return true
    }
    if (/^#\/(episode|room|patient|consultations|transfers|organizations|dr|dispatch)/.test(href)) {
      return true
    }
    return false
  }

  function navigateConsult(href) {
    var raw = normalizeAppHash(href || '/app.html#/consultations')
    if (raw.charAt(0) === '#' && /\/app\.html$/i.test(location.pathname)) {
      location.assign(location.pathname + location.search + raw)
      return
    }
    if (raw.charAt(0) === '#') {
      var topForHash = window.top || window
      try {
        if (/app\.html$/i.test(topForHash.location.pathname)) {
          topForHash.location.assign(topForHash.location.pathname + topForHash.location.search + raw)
          return
        }
      } catch (e) {
        /* ignore */
      }
      raw = '/app.html' + raw
    }
    var path = raw.indexOf('/') === 0 ? raw : '/' + raw
    var hashIdx = path.indexOf('#')
    var hashPart = hashIdx >= 0 ? path.slice(hashIdx) : ''
    var topWin = window.top || window
    if (window.parent !== window && topWin !== window) {
      try {
        var onApp = /app\.html$/i.test(topWin.location.pathname)
        if (hashPart && onApp) {
          topWin.location.assign(topWin.location.pathname + topWin.location.search + hashPart)
          return
        }
      } catch (e) {
        /* ignore */
      }
      topWin.location.href = location.origin + path
      return
    }
    window.location.href = location.origin + path
  }

  async function tryLaunch(ctx) {
    if (!ctx) return false
    const block = blockReason(ctx)
    if (block) {
      await dialog({
        variant: 'alert',
        title: '暂无法发起远程会诊',
        body: block,
        confirmText: '知道了',
      })
      return false
    }
    if (!(ctx.name || '').trim()) {
      const ok = await dialog({
        variant: 'confirm',
        title: '发起远程会诊',
        body: '建议先保存草稿或填写姓名，便于会诊队列关联患者。',
        lead: '仍要现在发起远程会诊吗？',
        confirmText: '仍要发起',
        cancelText: '返回填写',
      })
      if (!ok) return false
    }
    navigateConsult(consultUrl(ctx))
    return true
  }

  window.__hxTryConsultLaunch = tryLaunch
  window.__hxNavigateConsult = navigateConsult

  document.addEventListener(
    'click',
    function (event) {
      var t = event.target
      if (!(t instanceof Element)) return
      if (t.closest('.hx-consult-dialog')) return
      if (t.closest('.hx-sidebar-menu a.hx-nav-l2__link')) return

      var btn = t.closest('button')
      var link = t.closest('a[href*="consultations"], a[href*="#/consultations"]')
      var isConsultBtn =
        btn && /发起远程会诊|发起会诊/.test((btn.textContent || '').trim()) && !btn.closest('.modal')

      if (!isConsultBtn && !link) return

      var inDispatch = (btn || link)?.closest('.dh-app, .dh-desk, .dh-form, .dh-page')
      if (!inDispatch && !link) return

      var form = (btn || link)?.closest('.dh-form, form')
      var desk = btn?.closest('.dh-desk')
      var ctx = form ? readDhForm(form) : readCtxFromDesk(desk)

      if (link && !ctx) {
        if (shouldLeaveLinkAlone(link)) return
        var href = link.getAttribute('href') || ''
        if (!inDispatch && href.indexOf('app.html') < 0 && normalizeAppHash(href).charAt(0) !== '#') return
        event.preventDefault()
        navigateConsult(href || '/app.html#/consultations')
        return
      }

      if (!ctx && isConsultBtn) return

      if (isConsultBtn || (link && form)) {
        event.preventDefault()
        event.stopImmediatePropagation()
        void tryLaunch(ctx)
      }
    },
    true,
  )
})()
