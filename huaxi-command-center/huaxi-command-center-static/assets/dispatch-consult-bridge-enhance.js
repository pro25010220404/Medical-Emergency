/**
 * 实时出警 · 车内监控弹窗「发起会诊」
 *
 * 需求：在车内监控弹窗发起远程会诊时，不再跳转远程会诊工作台，
 * 而是按救护车页已填写的患者信息直接建单并进入会诊室；患者信息未填写时先提示补填。
 * React 默认 R("/consultations") 无参数，且 register-consult-flow 排除了 .modal 内按钮。
 */
;(function () {
  /** 救护车页没有科室选择，直接进会诊室时用固定接诊科室与兜底医院 */
  var FALLBACK_DEPARTMENT = '急诊科'
  var FALLBACK_HOSPITAL = '威远县人民医院'
  /** 院前「就地登记」草稿（调度壳写入），作为患者信息兜底来源 */
  var DRAFT_KEY = 'huaxi-dispatch-register-draft'

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
        // 仅当院前病历没给出姓名时，才用患者档案链接兜底；
        // 原来把 aside 里任意 button 的文案当姓名，会把「查看连续患者档案」当成患者名写进会诊单。
        const patientLink = aside.querySelector('a[href*="/patient/"]')
        if (!name && patientLink) {
          const label = (patientLink.textContent || '').trim()
          if (/^[\u4e00-\u9fa5]{2,4}$/.test(label)) name = label.slice(0, 20)
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

  // ---------- 弹窗（与咨询启动弹窗同源） ----------

  function dialogHost() {
    return typeof window.__hxConsultDialog === 'function'
      ? window.__hxConsultDialog.bind(window)
      : null
  }

  async function dialog(opts) {
    const host = dialogHost()
    if (host) return host(opts)
    const msg = [opts.body, opts.lead].filter(Boolean).join('\n\n')
    if (opts.variant === 'alert') {
      window.alert(msg)
      return true
    }
    return window.confirm(msg || '确认？')
  }

  // ---------- 车上患者信息 ----------

  /** 车内监控弹窗相关容器（只取当前选中车，避免读到别的车辆卡片） */
  function scopeCandidates() {
    return [
      document.querySelector('.vehicle-monitor'),
      document.querySelector('[role="dialog"]:not([hidden])'),
      document.querySelector('.modal:not([hidden])'),
    ].filter(Boolean)
  }

  /** 在 scope 内按 label/dt/th 文案取字段值：表单取 value，其余取相邻文本 */
  function readField(scope, words) {
    if (!scope) return ''
    const nodes = scope.querySelectorAll('label, dt, th')
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      const text = (node.textContent || '').trim()
      if (!words.some((w) => text.indexOf(w) >= 0)) continue
      const field = node.querySelector('input, textarea, select')
      if (field && 'value' in field) {
        const v = String(field.value || '').trim()
        if (v) return v
      }
      const sib = node.nextElementSibling
      if (sib) {
        const s = (sib.textContent || '').trim()
        if (s) return s
      }
      const row = node.closest('div, tr, li')
      const dd = row ? row.querySelector('dd, td:last-child') : null
      if (dd && dd !== node) {
        const t = (dd.textContent || '').trim()
        if (t) return t
      }
    }
    return ''
  }

  function readDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      return raw ? JSON.parse(raw) : null
    } catch (e) {
      return null
    }
  }

  /**
   * 汇总车上患者信息：弹窗/看板字段 → 院前病历 → 就地登记草稿。
   * ctx.name / ctx.chiefComplaint 已由 readCtxFromDispatchUi 从院前病历取出。
   */
  function readPatientInfo(ctx) {
    const info = {
      name: ctx.name || '',
      gender: '',
      age: '',
      phone: '',
      chiefComplaint: ctx.chiefComplaint || '',
    }
    scopeCandidates().forEach((scope) => {
      if (!info.name) info.name = readField(scope, ['姓名'])
      if (!info.gender) info.gender = readField(scope, ['性别'])
      if (!info.age) info.age = readField(scope, ['年龄'])
      if (!info.phone) info.phone = readField(scope, ['电话']) || readField(scope, ['联系'])
      if (!info.chiefComplaint) info.chiefComplaint = readField(scope, ['主诉'])
    })
    const draft = readDraft()
    if (draft) {
      // 仅在未带任务号、或草稿任务号与当前任务一致时采纳，避免串到别的患者
      const sameTask = !ctx.task120Id || !draft.task120Id || draft.task120Id === ctx.task120Id
      if (sameTask) {
        if (!info.name && draft.name) info.name = draft.name
        if (!info.gender && draft.gender) info.gender = draft.gender
        if (!info.age && draft.age) info.age = draft.age
        if (!info.phone && draft.phone) info.phone = draft.phone
        if (!info.chiefComplaint && draft.chiefComplaint) info.chiefComplaint = draft.chiefComplaint
      }
    }
    return info
  }

  /** 性别编码：MALE / FEMALE / UNKNOWN（未知一律 UNKNOWN，不默认成男） */
  function genderCode(gender) {
    const s = String(gender || '').trim()
    if (s === '男' || s.toUpperCase() === 'MALE') return 'MALE'
    if (s === '女' || s.toUpperCase() === 'FEMALE') return 'FEMALE'
    return 'UNKNOWN'
  }

  // ---------- 接诊医院（救护车页无医院/科室选择，取事件去向 + 兜底） ----------

  async function findEventByTask(task) {
    if (!task) return null
    const urls = ['/api/dispatch-live.json', '/api/dispatch-events-history.json']
    for (let i = 0; i < urls.length; i++) {
      try {
        const res = await fetch(urls[i], { cache: 'no-store' })
        if (!res.ok) continue
        const data = await res.json()
        const hit = (data.events || []).filter((ev) => ev.id === task || ev.task120Id === task)[0]
        if (hit) return hit
      } catch (e) {
        /* 换下一个来源 */
      }
    }
    return null
  }

  async function resolveTargetHospital(ctx) {
    let fromUi = ''
    scopeCandidates().forEach((scope) => {
      if (fromUi) return
      fromUi = readField(scope, ['目标医院', '去向', '送往'])
    })
    if (fromUi) return fromUi
    const ev = await findEventByTask(ctx.task120Id || ctx.eventId)
    if (ev && ev.destination) return ev.destination
    return FALLBACK_HOSPITAL
  }

  // ---------- 后端直连：建单 + 直接进会诊室 ----------

  function backendEnabled() {
    return (
      typeof window.hxBackend !== 'undefined' &&
      typeof window.hxBackend.enabled === 'function' &&
      window.hxBackend.enabled()
    )
  }

  /** 取入会链接并新开标签进入会诊室；_t 破缓存，避免复用过期房主票据 */
  async function openRoom(sessionId) {
    const link = await window.hxBackend.get(
      '/consultations/' + encodeURIComponent(sessionId) + '/join-link',
      { _t: Date.now() },
    )
    const url = link && (link.joinUrl || link.consultLink)
    if (!url) return false
    window.open(url, '_blank', 'noopener')
    return true
  }

  /** 该患者已有待接诊/会诊中会诊单时，直接进它已有的会诊室 */
  async function findExistingSession(name) {
    if (!name) return ''
    try {
      const res = await window.hxBackend.get('/consultations', {
        status: 'WAITING,IN_CALL',
        keyword: name,
        pageNum: 1,
        pageSize: 50,
        _t: Date.now(),
      })
      const list = (res && (res.list || res.data)) || []
      const hit = list.filter((it) => ((it.patient || {}).name || it.patientName) === name)[0]
      return hit ? hit.sessionId : ''
    } catch (e) {
      return ''
    }
  }

  /**
   * 按车上患者信息发起会诊，成功后直接打开会诊室。
   * 返回 true 表示已进入会诊室。
   */
  async function createAndEnterRoom(info, ctx) {
    if (window.hxBackend.ensureAuth) await window.hxBackend.ensureAuth(false)
    const hospital = await resolveTargetHospital(ctx)
    const note = [ctx.task120Id ? '任务 ' + ctx.task120Id : '', ctx.vehiclePlate]
      .filter(Boolean)
      .join(' · ')
    let created
    try {
      created = await window.hxBackend.post('/consultations', {
        patientName: info.name,
        gender: genderCode(info.gender),
        age: info.age ? Number(info.age) : 0,
        chiefComplaint: info.chiefComplaint,
        targetHospital: hospital,
        targetDepartment: FALLBACK_DEPARTMENT,
        note: note,
      })
    } catch (e) {
      // 409：该患者已有待接诊/会诊中会诊单，改走已有会诊室
      if (/\b409\b/.test(String((e && e.message) || ''))) {
        const existing = await findExistingSession(info.name)
        if (existing) return openRoom(existing)
      }
      throw e
    }
    const sessionId = created && created.sessionId
    if (!sessionId) return false
    return openRoom(sessionId)
  }

  /**
   * 车内监控弹窗「发起会诊」：按车上患者信息直连后端建单并进入会诊室。
   *
   * 患者信息（姓名/主诉）未填写先提示补填；建单或取入会链接失败时给出明确提示，
   * 不再跳回主系统远程会诊工作台（该按钮的预期行为是点一下直接进会诊室）。
   */
  async function launchFromVehicleModal(ctx) {
    const info = readPatientInfo(ctx)
    const missing = []
    if (!info.name) missing.push('姓名')
    if (!info.chiefComplaint) missing.push('主诉')
    if (missing.length) {
      await dialog({
        variant: 'alert',
        title: '请先填写患者信息',
        body: '请先在救护车页面填写患者' + missing.join('、') + '，再发起远程会诊。',
        confirmText: '知道了',
      })
      return false
    }

    if (!backendEnabled()) {
      await dialog({
        variant: 'alert',
        title: '暂时无法进入会诊室',
        body: '主系统后端未连接，无法按车上患者信息发起会诊。',
        confirmText: '知道了',
      })
      return false
    }

    // 直连后端：按车上患者信息建单并取入会链接，成功后直接打开会诊室
    try {
      if (await createAndEnterRoom(info, ctx)) return true
      await dialog({
        variant: 'alert',
        title: '暂时无法进入会诊室',
        body: '已发起会诊，但未能获取会诊室入口（音视频服务可能未就绪）。',
        confirmText: '知道了',
      })
    } catch (e) {
      console.warn('[hx-consult] 直接进入会诊室失败', e)
      await dialog({
        variant: 'alert',
        title: '暂时无法进入会诊室',
        body: '按车上患者信息发起会诊未成功，未能获取会诊室入口。',
        lead: '原因：' + ((e && e.message) || '未知错误'),
        confirmText: '知道了',
      })
    }
    return false
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

      const ctx = readCtxFromDispatchUi()

      // 车内监控弹窗：直连后端进入会诊室，不依赖 register-consult-flow
      if (inVehicleModal) {
        event.preventDefault()
        event.stopImmediatePropagation()
        void launchFromVehicleModal(ctx)
        return
      }

      if (typeof window.__hxTryConsultLaunch !== 'function') return
      event.preventDefault()
      event.stopImmediatePropagation()
      void window.__hxTryConsultLaunch(ctx)
    },
    true,
  )
})()
