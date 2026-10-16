/**
 * 实时出警 · 车内监控弹窗「发起会诊」→ P3 远程会诊工作台（带 task/plate/complaint&launch=1）
 * React 默认 R("/consultations") 无参数，且 register-consult-flow 排除了 .modal 内按钮。
 */
;(function () {
  function path() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function readCtxFromDispatchUi() {
    const sel = document.querySelector(
      '.dispatch-active article.on, .dispatch-active article.selected, .dispatch-active article[aria-current="true"]',
    )
    const article = sel || document.querySelector('.dispatch-active article')
    let task120Id = new URLSearchParams(location.hash.split('?')[1] || '').get('task') || ''
    let chiefComplaint = ''
    let vehiclePlate = ''
    let name = ''

    if (article) {
      const text = article.textContent || ''
      if (!task120Id) {
        const m = text.match(/120[-\w]+/i)
        if (m) task120Id = m[0]
      }
      chiefComplaint =
        (article.querySelector('p, .complaint, [class*="complaint"]')?.textContent || '').trim().slice(0, 200) ||
        ''
      vehiclePlate =
        (article.querySelector('header button, .hx-dispatch-vehicle-name')?.textContent || '').trim() ||
        ''
    }

    const dialog =
      document.querySelector('.vehicle-monitor')?.closest('.modal, [role="dialog"]') ||
      document.querySelector('.vehicle-monitor') ||
      document.querySelector('[role="dialog"]:not([hidden])') ||
      document.querySelector('.modal:not([hidden])') ||
      document.querySelector('main.workspace [class*="modal"]')
    if (dialog) {
      const vm = dialog.querySelector('.vehicle-monitor') || (dialog.classList.contains('vehicle-monitor') ? dialog : null)
      const head = (dialog.querySelector('h1, h2, header')?.textContent || '').trim()
      const plateFromTitle = head.match(/([川渝][A-Z·]?\d{4,}|[A-Z]{1,2}\d{4,})/)
      if (plateFromTitle) vehiclePlate = plateFromTitle[1].replace(/·.*$/, '').trim()
      if (vm) {
        const asideVm = vm.querySelector('aside')
        if (asideVm) {
          const bodyText = asideVm.textContent || ''
          const plateLine = bodyText.match(/车辆编号[：:]\s*([^\s]+)/)
          if (plateLine) vehiclePlate = plateLine[1].trim()
          asideVm.querySelectorAll('details').forEach(function (det) {
            const sum = (det.querySelector('summary')?.textContent || '').trim()
            if (sum.indexOf('院前病历') < 0) return
            const recordText = (det.querySelector('p')?.textContent || '').trim()
            if (!recordText || recordText.indexOf('暂无关联') >= 0) return
            const parts = recordText.split('·')
            if (parts[0]) name = parts[0].trim().slice(0, 20)
            if (parts[1] && !chiefComplaint) chiefComplaint = parts[1].trim().slice(0, 200)
          })
        }
      }
      const aside = dialog.querySelector('aside, .vehicle-sidebar')
      if (aside) {
        aside.querySelectorAll('dt, dd, p, li').forEach(function (node) {
          const t = (node.textContent || '').trim()
          if (!task120Id && /120[-\w]+/i.test(t)) {
            const m = t.match(/120[-\w]+/i)
            if (m) task120Id = m[0]
          }
          if (!chiefComplaint && (t.includes('主诉') || t.length > 4)) {
            const m2 = t.match(/主诉[：:]\s*(.+)/)
            if (m2) chiefComplaint = m2[1].trim().slice(0, 200)
          }
        })
        const patientLink = aside.querySelector('a[href*="/patient/"], button')
        if (patientLink && /[\u4e00-\u9fa5]{2,4}/.test(patientLink.textContent || '')) {
          name = (patientLink.textContent || '').trim().slice(0, 20)
        }
      }
    }

    if (!vehiclePlate && article) {
      vehiclePlate = (article.querySelector('header > button')?.textContent || '').trim()
    }

    return {
      task120Id,
      eventId: '',
      vehiclePlate,
      vehicleId: '',
      name,
      chiefComplaint,
    }
  }

  function consultHash(ctx) {
    const q = new URLSearchParams()
    if (ctx.task120Id) q.set('task', ctx.task120Id)
    if (ctx.eventId) q.set('event', ctx.eventId)
    if (ctx.vehiclePlate) q.set('plate', ctx.vehiclePlate)
    if (ctx.vehicleId) q.set('vehicle', ctx.vehicleId)
    if (ctx.chiefComplaint) q.set('complaint', ctx.chiefComplaint)
    q.set('launch', '1')
    const s = q.toString()
    return s ? '#/consultations?' + s : '#/consultations?launch=1'
  }

  function navigate(ctx) {
    const hash = consultHash(ctx)
    if (typeof window.__hxNavigateConsult === 'function') {
      window.__hxNavigateConsult('/app.html' + hash)
      return
    }
    location.assign(location.pathname + location.search + hash)
  }

  async function launchFromVehicleModal(ctx) {
    const task = (ctx.task120Id || ctx.eventId || '').trim()
    const complaint = (ctx.chiefComplaint || '').trim()
    const plate = (ctx.vehiclePlate || '').trim()

    if (task && complaint && typeof window.__hxTryConsultLaunch === 'function') {
      return window.__hxTryConsultLaunch(ctx)
    }

    const dialog =
      typeof window.__hxConsultDialog === 'function'
        ? window.__hxConsultDialog.bind(window)
        : null

    if (!plate && !task) {
      if (typeof window.__hxTryConsultLaunch === 'function') {
        return window.__hxTryConsultLaunch(ctx)
      }
      if (dialog) {
        await dialog({
          variant: 'alert',
          title: '暂无法发起远程会诊',
          body: '请先选择出警任务或填写 120 任务号，再发起远程会诊。',
          confirmText: '知道了',
        })
      } else {
        window.alert('请先选择出警任务或填写 120 任务号，再发起远程会诊。')
      }
      return false
    }

    if (!task || !complaint) {
      const ok = dialog
        ? await dialog({
            variant: 'confirm',
            title: '发起远程会诊',
            body: plate
              ? '当前车辆' + (plate ? '（' + plate + '）' : '') + '暂无关联转运任务或未填主诉。'
              : '任务或主诉不完整。',
            lead: '仍进入远程会诊页，选择患者并补全信息后提交？',
            confirmText: '进入远程会诊',
            cancelText: '返回',
          })
        : window.confirm('任务或主诉不完整，仍进入远程会诊页？')
      if (!ok) return false
    }

    navigate(ctx)
    return true
  }

  document.addEventListener(
    'click',
    function (event) {
      if (path() !== '/dispatch') return
      const t = event.target
      if (!(t instanceof Element)) return
      const btn = t.closest('button')
      if (!btn) return
      const label = (btn.textContent || '').replace(/\s+/g, '')
      if (!/发起远程会诊|发起会诊/.test(label)) return

      const inVehicleModal =
        btn.closest('.vehicle-monitor') ||
        btn.closest('[role="dialog"]') ||
        btn.closest('.modal') ||
        btn.closest('.remote-summary') ||
        btn.closest('.vehicle-cameras')
      if (!inVehicleModal && !btn.closest('.dispatch-actions, .huaxi-dispatch-consult')) return

      if (typeof window.__hxTryConsultLaunch !== 'function') return

      event.preventDefault()
      event.stopImmediatePropagation()

      const ctx = readCtxFromDispatchUi()
      if (inVehicleModal) {
        void launchFromVehicleModal(ctx)
        return
      }
      void window.__hxTryConsultLaunch(ctx)
    },
    true,
  )
})()
