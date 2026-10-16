/**
 * /#/devices · 设备与床位绑定弹窗：机构 / 科室 / 床位 / 责任人员
 *
 * 注：页面本体已打补丁（scripts/patch-devices-page.mjs，main[data-hx-devices-edit]），
 * 自带「编辑」弹窗与完整字段，本脚本自动让位；仅当页面回退到未打补丁的原始产物时生效。
 */
;(function () {
  const STORAGE_KEY = 'huaxi-demo-device-bindings'
  const META_KEY = 'huaxi-demo-device-bind-meta'

  /** 页面已是补丁版（自带编辑弹窗）时为 true —— 本脚本不再接管弹窗 */
  function patchedPage() {
    return !!document.querySelector('main[data-hx-devices-edit]')
  }

  const ORG_LABEL = {
    weiyuan: '威远县人民医院',
    huaxi: '四川大学华西医院',
    'neijiang-first': '内江市第一人民医院',
    chuanshi: '船石村卫生室',
    lianjie: '连界镇卫生院',
  }

  const DEPT_LABEL = {
    emergency: '急诊科',
    icu: '重症医学科',
    internal: '内科',
    surgery: '外科',
    primary: '全科',
  }

  let scenario = null
  let scenarioPromise = null

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

  function loadBindings() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    } catch {
      return {}
    }
  }

  function loadMeta() {
    try {
      return JSON.parse(localStorage.getItem(META_KEY) || '{}')
    } catch {
      return {}
    }
  }

  function bindingBedId(devId) {
    const b = loadBindings()[devId]
    if (!b) return ''
    return typeof b === 'string' ? b : b.bedId || ''
  }

  function getScenario() {
    if (scenario) return Promise.resolve(scenario)
    if (scenarioPromise) return scenarioPromise
    scenarioPromise = fetch('/scenario.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((pack) => {
        scenario = (pack && pack.state) || pack || {}
        return scenario
      })
      .catch(() => {
        scenario = { beds: [], staff: [], patients: [] }
        return scenario
      })
    return scenarioPromise
  }

  function orgLabel(id) {
    return ORG_LABEL[id] || id || '—'
  }

  function deptLabel(id) {
    return DEPT_LABEL[id] || id || '—'
  }

  function findModal() {
    const dialogs = [...document.querySelectorAll('.modal, [role="dialog"], .modal-panel')]
    return dialogs.find((el) => /设备与床位绑定/.test(el.textContent || ''))
  }

  function guessDeviceContext(devId) {
    const tr = [...document.querySelectorAll('main.workspace .business-table tbody tr')].find(
      (row) => (row.querySelector('td')?.textContent || '').trim() === devId,
    )
    let institutionId = ''
    let departmentId = ''
    if (devId.includes('weiyuan')) {
      institutionId = 'weiyuan'
    } else if (devId.includes('huaxi')) {
      institutionId = 'huaxi'
    } else if (devId.includes('neijiang')) {
      institutionId = 'neijiang-first'
    }
    const deptCell = tr?.querySelectorAll('td')[2]
    const deptText = (deptCell?.textContent || '').trim()
    const small = deptCell?.querySelector('small')?.textContent?.trim() || ''
    if (!institutionId) {
      if (/威远|weiyuan/i.test(deptText)) institutionId = 'weiyuan'
      else if (/华西|huaxi/i.test(deptText)) institutionId = 'huaxi'
      else if (/内江|neijiang/i.test(deptText)) institutionId = 'neijiang-first'
      else if (/船石|chuanshi/i.test(deptText)) institutionId = 'chuanshi'
      else if (/连界|lianjie/i.test(deptText)) institutionId = 'lianjie'
    }
    for (const [id, label] of Object.entries(DEPT_LABEL)) {
      if (deptText.includes(label) || small.includes(label) || deptText.includes(id)) departmentId = id
    }
    if (!departmentId && institutionId === 'weiyuan') departmentId = 'emergency'
    return { devId, institutionId, departmentId, tr }
  }

  function inferOrgDeptFromBed(sc, bedId) {
    const bed = (sc.beds || []).find((b) => b.id === bedId)
    if (!bed) return {}
    return { institutionId: bed.institutionId || '', departmentId: bed.departmentId || '' }
  }

  function staffRole(s) {
    const p = String(s.profession || '').toLowerCase()
    if (p === 'nurse') return '护士'
    if (p === 'doctor') return '医生'
    return s.profession || '人员'
  }

  function buildForm(sc, ctx, prevMeta) {
    const beds = sc.beds || []
    const staff = sc.staff || []
    const patients = sc.patients || []
    const orgs = [...new Set(beds.map((b) => b.institutionId).filter(Boolean))]

    let institutionId = prevMeta.institutionId || ctx.institutionId || orgs[0] || ''
    let departmentId = prevMeta.departmentId || ctx.departmentId || ''
    let bedId = prevMeta.bedId || bindingBedId(ctx.devId) || ''

    const orgOpts = orgs
      .map((id) => `<option value="${esc(id)}"${id === institutionId ? ' selected' : ''}>${esc(orgLabel(id))}</option>`)
      .join('')

    const depts = [
      ...new Set(
        beds.filter((b) => b.institutionId === institutionId).map((b) => b.departmentId).filter(Boolean),
      ),
    ]
    if (!departmentId && depts.length) departmentId = depts[0]

    const deptOpts = depts
      .map(
        (id) =>
          `<option value="${esc(id)}"${id === departmentId ? ' selected' : ''}>${esc(deptLabel(id))}</option>`,
      )
      .join('')

    const bedList = beds.filter(
      (b) => b.institutionId === institutionId && (!departmentId || b.departmentId === departmentId),
    )
    if (!bedId && bedList[0]) bedId = bedList[0].id
    const bedOpts = bedList
      .map((b) => {
        const pt = b.patientId ? patients.find((p) => p.id === b.patientId) : null
        const hint = pt ? ` · ${pt.name}` : b.status === 'occupied' ? ' · 占用' : ' · 空床'
        return `<option value="${esc(b.id)}"${b.id === bedId ? ' selected' : ''}>${esc(b.label)}${esc(hint)}</option>`
      })
      .join('')

    const staffList = staff.filter(
      (s) =>
        s.institutionId === institutionId &&
        (!departmentId || s.departmentId === departmentId) &&
        ['doctor', 'nurse'].includes(String(s.profession || '').toLowerCase()),
    )
    let staffId = prevMeta.staffId || ''
    const staffOpts =
      '<option value="">请选择责任人员</option>' +
      staffList
        .map((s) => {
          const label = `${s.name}（${staffRole(s)}）`
          return `<option value="${esc(s.id)}"${s.id === staffId ? ' selected' : ''}>${esc(label)}</option>`
        })
        .join('')

    const bed = beds.find((b) => b.id === bedId)
    const patient = bed?.patientId ? patients.find((p) => p.id === bed.patientId) : null

    return (
      `<div id="hx-device-bind-form" class="hx-device-bind-form" data-dev="${esc(ctx.devId)}">` +
      `<ol class="hx-device-bind-form__steps" aria-label="绑定步骤">` +
      `<li class="on"><span>1</span> 选机构</li>` +
      `<li class="on"><span>2</span> 选科室</li>` +
      `<li class="on"><span>3</span> 选床位</li>` +
      `<li><span>4</span> 责任医护</li>` +
      `</ol>` +
      `<p class="hx-device-bind-form__lead">本弹窗完成<strong>设备 ↔ 床位</strong>绑定：先选机构与科室，再选具体床位；可选责任医护。保存后「关联床位」列会更新（演示写入本机）。</p>` +
      `<div class="hx-device-bind-form__grid">` +
      `<label class="field"><span>机构</span><select id="hx-bind-org">${orgOpts}</select></label>` +
      `<label class="field"><span>科室</span><select id="hx-bind-dept">${deptOpts || '<option value="">—</option>'}</select></label>` +
      `<label class="field"><span>关联床位</span><select id="hx-bind-bed">${bedOpts || '<option value="">—</option>'}</select></label>` +
      `<label class="field"><span>责任人员</span><select id="hx-bind-staff">${staffOpts}</select></label>` +
      `</div>` +
      `<p class="hx-device-bind-form__patient" id="hx-bind-patient">` +
      (patient
        ? `当前床位患者：<strong>${esc(patient.name)}</strong>（${esc(patient.gender || '')}${patient.age != null ? ` · ${patient.age}岁` : ''}）`
        : '当前床位：<span class="muted">无在院患者 / 空床</span>') +
      `</p>` +
      `<p class="hx-device-bind-form__device">设备编号：<code>${esc(ctx.devId)}</code></p>` +
      `</div>`
    )
  }

  function refreshFormPart(sc, root) {
    const org = root.querySelector('#hx-bind-org')?.value
    const dept = root.querySelector('#hx-bind-dept')?.value
    const bed = root.querySelector('#hx-bind-bed')?.value
    const staff = root.querySelector('#hx-bind-staff')?.value
    const ctx = guessDeviceContext(root.getAttribute('data-dev') || '')
    const html = buildForm(sc, ctx, {
      institutionId: org,
      departmentId: dept,
      bedId: bed,
      staffId: staff,
    })
    const outer = root.parentElement
    root.outerHTML = html
    bindForm(sc, outer.querySelector('#hx-device-bind-form'))
  }

  function bindForm(sc, form) {
    if (!form || form.dataset.bound) return
    form.dataset.bound = '1'
    ;['hx-bind-org', 'hx-bind-dept'].forEach((id) => {
      form.querySelector('#' + id)?.addEventListener('change', () => refreshFormPart(sc, form))
    })
    form.querySelector('#hx-bind-bed')?.addEventListener('change', () => {
      const bedId = form.querySelector('#hx-bind-bed')?.value
      const bed = (sc.beds || []).find((b) => b.id === bedId)
      const patient = bed?.patientId ? (sc.patients || []).find((p) => p.id === bed.patientId) : null
      const el = form.querySelector('#hx-bind-patient')
      if (!el) return
      el.innerHTML = patient
        ? `当前床位患者：<strong>${esc(patient.name)}</strong>（${esc(patient.gender || '')}${patient.age != null ? ` · ${patient.age}岁` : ''}）`
        : '当前床位：<span class="muted">无在院患者 / 空床</span>'
    })
  }

  function patchRow(devId, bedLabel, staffName) {
    document.querySelectorAll('main.workspace .business-table tbody tr').forEach((tr) => {
      if ((tr.querySelector('td')?.textContent || '').trim() !== devId) return
      const cell = tr.querySelectorAll('td')[3]
      if (!cell) return
      cell.textContent = bedLabel + (staffName ? ` · ${staffName}` : '')
    })
  }

  function toast(msg) {
    let el = document.getElementById('hx-device-bind-toast')
    if (!el) {
      el = document.createElement('div')
      el.id = 'hx-device-bind-toast'
      el.className = 'hx-device-bind-toast'
      document.body.appendChild(el)
    }
    el.textContent = msg
    el.classList.add('is-show')
    clearTimeout(toast._t)
    toast._t = setTimeout(() => el.classList.remove('is-show'), 4200)
  }

  function closeModal(modal) {
    const btns = [...modal.querySelectorAll('button')]
    const closeBtn = btns.find((b) => /^[×x✕]$/.test((b.textContent || '').trim()) || b.getAttribute('aria-label') === '关闭')
    if (closeBtn) closeBtn.click()
    else modal.remove()
  }

  function saveFromForm(form, notifyFn) {
    const devId = form.dataset.dev
    const bedId = form.querySelector('#hx-bind-bed')?.value
    const org = form.querySelector('#hx-bind-org')?.value
    const dept = form.querySelector('#hx-bind-dept')?.value
    const staffId = form.querySelector('#hx-bind-staff')?.value
    if (!bedId) return false

    const sc = scenario || { beds: [], staff: [] }
    const bed = (sc.beds || []).find((b) => b.id === bedId)
    const staff = (sc.staff || []).find((s) => s.id === staffId)

    const bindings = loadBindings()
    bindings[devId] = bedId
    const meta = loadMeta()
    meta[devId] = {
      bedId,
      institutionId: org,
      departmentId: dept,
      staffId: staffId || '',
      staffName: staff ? staff.name : '',
      bedLabel: bed ? bed.label : bedId,
      updatedAt: new Date().toISOString(),
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings))
      localStorage.setItem(META_KEY, JSON.stringify(meta))
    } catch {
      if (notifyFn) notifyFn('保存失败。')
      return false
    }

    patchRow(devId, bed?.label || bedId, staff?.name || '')
    if (notifyFn) notifyFn('绑定已保存：' + (bed?.label || bedId) + (staff ? ` · 责任人 ${staff.name}` : '') + '（演示台账）')
    return true
  }

  function hideNativeBindFields(modal) {
    modal.querySelectorAll('label.field, .field').forEach((el) => {
      if (el.closest('#hx-device-bind-form')) return
      if (el.querySelector('select') || /关联床位/.test(el.textContent || '')) {
        el.classList.add('hx-device-bind-native-hidden')
      }
    })
    modal.querySelectorAll('p, small').forEach((el) => {
      if (/从科室|请先选择床位|关联床位/.test(el.textContent || '') && !el.closest('#hx-device-bind-form')) {
        el.classList.add('hx-device-bind-native-hidden')
      }
    })
  }

  function enhanceModal(modal) {
    if (modal.querySelector('#hx-device-bind-form')) return
    const ctx = guessDeviceContext(window.__hxBindDevId || '')
    if (!ctx.devId) return

    getScenario().then((sc) => {
      if (!modal.isConnected) return
      const prev = loadMeta()[ctx.devId] || {}
      const legacyBed = bindingBedId(ctx.devId)
      if (legacyBed && !prev.bedId) prev.bedId = legacyBed
      const qBed = hashQuery().get('bed') || window.__hxBindPrefBed || ''
      if (qBed && !prev.bedId) {
        prev.bedId = qBed
        const inferred = inferOrgDeptFromBed(sc, qBed)
        if (inferred.institutionId) prev.institutionId = inferred.institutionId
        if (inferred.departmentId) prev.departmentId = inferred.departmentId
      }
      if (!prev.institutionId && ctx.institutionId) prev.institutionId = ctx.institutionId
      if (!prev.departmentId && ctx.departmentId) prev.departmentId = ctx.departmentId

      hideNativeBindFields(modal)
      const nativeFooter = modal.querySelector('.form-footer')

      const wrap = document.createElement('div')
      wrap.innerHTML = buildForm(sc, ctx, prev)
      const form = wrap.firstElementChild
      nativeFooter?.insertAdjacentElement('beforebegin', form)
      bindForm(sc, form)

      const saveBtn = nativeFooter?.querySelector('button.primary')
      if (saveBtn) {
        if (saveBtn.textContent?.trim() === '保存绑定') saveBtn.textContent = '保存绑定关系'
        saveBtn.title = '保存机构、科室、床位与责任人至演示台账'
      }
      if (saveBtn && !saveBtn.dataset.hxBindSave) {
        saveBtn.dataset.hxBindSave = '1'
        saveBtn.addEventListener(
          'click',
          (e) => {
            const f = modal.querySelector('#hx-device-bind-form')
            if (!f) return
            e.preventDefault()
            e.stopImmediatePropagation()
            if (saveFromForm(f, toast)) {
              closeModal(modal)
              window.dispatchEvent(new Event('storage'))
            }
          },
          true,
        )
      }
    })
  }

  document.addEventListener(
    'click',
    (e) => {
      if (path() !== '/devices' || patchedPage()) return
      const btn = e.target.closest('button')
      if (!btn || !(btn.textContent || '').includes('绑定床位')) return
      const tr = btn.closest('tr')
      window.__hxBindDevId = (tr?.querySelector('td')?.textContent || '').trim()
      const meta = loadMeta()[window.__hxBindDevId] || {}
      window.__hxBindPrefBed = meta.bedId || hashQuery().get('bed') || ''
    },
    true,
  )

  function tick() {
    if (path() !== '/devices' || patchedPage()) return
    const modal = findModal()
    if (modal) enhanceModal(modal)
  }

  window.hxEnhance(tick, { wait: 200, observeRoot: true, afterNav: 80 })
})()
