/**
 * #/register · 患者接入登记页：新增「创建事件」入口
 *
 * 背景：登记页由线上打包产物 index-BA_IO3dC.js 渲染（患者接入登记），
 * 页头只有一个「证件识别」按钮。本脚本在页头补一个「创建事件」按钮，
 * 弹窗按事件列表字段（事件编号 / 任务号 / 主诉 / 车辆 / 状态 / 接警出车时间 / 预计到院）
 * 新建一条 120 急救事件：后端可用时 POST /dispatch/events，否则落本地演示台账。
 */
;(function () {
  var ROUTE = '/register'
  var BTN_ID = 'hx-register-create-event-btn'
  var GROUP_ID = 'hx-register-head-actions'
  var DIALOG_ID = 'hx-create-event-dialog'
  var STYLE_ID = 'hx-create-event-style'
  var STORE_KEY = 'huaxi-created-events-v1'

  var STATUS_OPTIONS = [
    { value: 'STAGE_CREATED', label: '已接警' },
    { value: 'DISPATCHING', label: '出警中' },
    { value: 'ON_SCENE', label: '现场处置' },
    { value: 'RETURNING', label: '返院途中' },
  ]

  function path() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function pad(n) {
    return (n < 10 ? '0' : '') + n
  }

  function genEventId() {
    var d = new Date()
    return (
      'EVT' +
      d.getFullYear() +
      pad(d.getMonth() + 1) +
      pad(d.getDate()) +
      pad(d.getHours()) +
      pad(d.getMinutes()) +
      pad(d.getSeconds())
    )
  }

  function nowLocal() {
    var d = new Date()
    return (
      d.getFullYear() +
      '-' +
      pad(d.getMonth() + 1) +
      '-' +
      pad(d.getDate()) +
      ' ' +
      pad(d.getHours()) +
      ':' +
      pad(d.getMinutes())
    )
  }

  var PLUS_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>'
  var CLOSE_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'

  // ---------- 样式（页头按钮组 + 弹窗内表单，自包含不依赖主题加载顺序） ----------
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return
    var style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent =
      '#' + GROUP_ID + '{display:inline-flex;align-items:center;gap:10px;flex-wrap:wrap;}' +
      '#' + GROUP_ID + ' button{display:inline-flex;align-items:center;gap:6px;' +
      'background:#1e4b7b;border:1px solid #1e4b7b;color:#fff;border-radius:4px;' +
      'padding:8px 16px;font-weight:500;font-size:13px;line-height:1;cursor:pointer;}' +
      '#' + GROUP_ID + ' button:hover{background:#163a60;border-color:#163a60;}' +
      '#' + GROUP_ID + ' button svg{color:#fff;stroke:#fff;}' +
      '#' + DIALOG_ID + ' .form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 20px;}' +
      '#' + DIALOG_ID + ' .field{display:flex;flex-direction:column;gap:7px;min-width:0;margin:0 0 14px;}' +
      '#' + DIALOG_ID + ' .field>span{font-size:12px;color:#547793;}' +
      '#' + DIALOG_ID + ' .field input,' +
      '#' + DIALOG_ID + ' .field select,' +
      '#' + DIALOG_ID + ' .field textarea{' +
      'background:#fff;border:1px solid #cbd5e1;color:#1e293b;border-radius:8px;' +
      'padding:9px 12px;font-size:14px;width:100%;box-sizing:border-box;}' +
      '#' + DIALOG_ID + ' .field input[readonly]{background:#f1f5f9;color:#64748b;}' +
      '#' + DIALOG_ID + ' .field.span-2{grid-column:1 / -1;}' +
      '#' + DIALOG_ID + ' .form-lead{grid-column:1 / -1;margin:0 0 6px;color:#64748b;font-size:13px;line-height:1.6;}'
    document.head.appendChild(style)
  }

  // ---------- 创建事件按钮 ----------
  function createButton() {
    var btn = document.createElement('button')
    btn.type = 'button'
    btn.id = BTN_ID
    btn.innerHTML = PLUS_SVG + '创建事件'
    btn.title = '在登记页新建一条 120 急救事件'
    btn.addEventListener('click', openDialog)
    return btn
  }

  function injectButton() {
    if (path() !== ROUTE) return
    ensureStyle()
    var head = document.querySelector('main.workspace.register-page header.workspace-heading')
    if (!head) return
    if (document.getElementById(BTN_ID)) return

    var group = document.getElementById(GROUP_ID) || document.createElement('div')
    if (!group.id) group.id = GROUP_ID

    // 把原有「证件识别」按钮收进右侧按钮组，避免 space-between 把三个子元素摊开
    var existing = head.querySelector('button')
    if (existing && existing.id !== BTN_ID && existing.parentElement !== group) {
      group.appendChild(existing)
    }
    group.appendChild(createButton())
    head.appendChild(group)
  }

  // ---------- 弹窗 ----------
  function buildField(label, inner, opts) {
    opts = opts || {}
    var cls = opts.span2 ? 'field span-2' : 'field'
    return '<label class="' + cls + '"><span>' + esc(label) + '</span>' + inner + '</label>'
  }

  function buildForm() {
    var id = genEventId()
    var now = nowLocal()
    var statusOpts = STATUS_OPTIONS.map(function (s) {
      return '<option value="' + s.value + '"' + (s.value === 'STAGE_CREATED' ? ' selected' : '') + '>' + s.label + '</option>'
    }).join('')

    var html =
      '<form class="form-grid" id="hx-create-event-form">' +
      '<p class="form-lead">新建一条 120 急救事件，保存后进入事件列表。事件编号与接警时间由系统生成。</p>' +
      buildField('事件编号', '<input name="eventId" value="' + esc(id) + '" readonly title="系统自动生成" />') +
      buildField('任务号 *', '<input name="task120Id" required placeholder="如 120-WY-88421" />') +
      buildField('主诉', '<input name="chiefComplaint" placeholder="现场情况、症状描述" />') +
      buildField('车辆', '<input name="vehiclePlate" placeholder="车牌，如 演示001" />') +
      buildField('状态', '<select name="status">' + statusOpts + '</select>') +
      buildField('预计到院（分钟）', '<input name="etaHospitalMinutes" type="number" min="0" placeholder="留空为待定" />') +
      buildField('接警 / 出车时间', '<input name="startedAt" value="' + esc(now) + '" readonly title="系统自动生成" />', { span2: true }) +
      '</form>'

    return html
  }

  function ensureDialog() {
    if (document.getElementById(DIALOG_ID)) return
    var dialog = document.createElement('dialog')
    dialog.id = DIALOG_ID
    dialog.className = 'modal wide'
    dialog.setAttribute('aria-labelledby', DIALOG_ID + '-title')

    dialog.innerHTML =
      '<div class="modal-heading">' +
      '<h2 id="' + DIALOG_ID + '-title">创建急救事件</h2>' +
      '<button type="button" title="关闭窗口" aria-label="关闭">' + CLOSE_SVG + '</button>' +
      '</div>' +
      '<div class="modal-content">' +
      buildForm() +
      '<div class="form-footer">' +
      '<button type="button" class="subtle" id="hx-create-event-cancel">取消</button>' +
      '<button type="submit" class="primary" id="hx-create-event-submit" form="hx-create-event-form">创建事件</button>' +
      '</div>' +
      '</div>'

    document.body.appendChild(dialog)

    dialog.querySelector('#hx-create-event-cancel').addEventListener('click', function () {
      dialog.close()
    })
    dialog.querySelector('.modal-heading button').addEventListener('click', function () {
      dialog.close()
    })
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) dialog.close()
    })
    dialog.addEventListener('cancel', function () {
      dialog.close()
    })

    var form = dialog.querySelector('#hx-create-event-form')
    form.addEventListener('submit', function (e) {
      e.preventDefault()
      void submitFromDialog(dialog, form)
    })
  }

  function openDialog() {
    ensureDialog()
    var dialog = document.getElementById(DIALOG_ID)
    if (!dialog) return
    // 每次打开刷新自动字段（事件编号 / 接警时间）
    var form = dialog.querySelector('#hx-create-event-form')
    if (form) {
      var evId = form.querySelector('[name="eventId"]')
      var st = form.querySelector('[name="startedAt"]')
      if (evId) evId.value = genEventId()
      if (st) st.value = nowLocal()
      form.querySelector('[name="task120Id"]').value = ''
      form.querySelector('[name="chiefComplaint"]').value = ''
      form.querySelector('[name="vehiclePlate"]').value = ''
      form.querySelector('[name="etaHospitalMinutes"]').value = ''
      var status = form.querySelector('[name="status"]')
      if (status) status.value = 'STAGE_CREATED'
    }
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
  }

  // ---------- 提交 ----------
  function toast(msg) {
    var el = document.getElementById('hx-create-event-toast')
    if (!el) {
      el = document.createElement('div')
      el.id = 'hx-create-event-toast'
      el.style.cssText =
        'position:fixed;left:50%;bottom:36px;transform:translateX(-50%);z-index:9999;' +
        'background:#fff;border:1px solid #cbd5e1;color:#334155;border-radius:8px;' +
        'padding:10px 16px;font-size:13px;box-shadow:0 4px 14px rgba(15,23,42,0.12);' +
        'max-width:80vw;transition:opacity .25s;opacity:0;pointer-events:none;'
      document.body.appendChild(el)
    }
    el.textContent = msg
    el.style.opacity = '1'
    clearTimeout(toast._t)
    toast._t = setTimeout(function () {
      el.style.opacity = '0'
    }, 4200)
  }

  function persistLocal(record) {
    var list = []
    try {
      list = JSON.parse(localStorage.getItem(STORE_KEY) || '[]')
      if (!Array.isArray(list)) list = []
    } catch {
      list = []
    }
    list.unshift(record)
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(0, 50)))
    } catch {
      /* ignore */
    }
  }

  async function submitFromDialog(dialog, form) {
    var get = function (name) {
      var el = form.querySelector('[name="' + name + '"]')
      return el ? String(el.value || '').trim() : ''
    }

    var task120Id = get('task120Id')
    if (!task120Id) {
      toast('请填写任务号后再创建事件。')
      return
    }

    var etaRaw = get('etaHospitalMinutes')
    var eta = etaRaw ? Number(etaRaw) : undefined
    var record = {
      eventId: get('eventId') || genEventId(),
      task120Id: task120Id,
      chiefComplaint: get('chiefComplaint'),
      vehiclePlate: get('vehiclePlate'),
      status: get('status') || 'STAGE_CREATED',
      startedAt: new Date().toISOString(),
      etaHospitalMinutes: eta && eta > 0 ? eta : undefined,
      createdAt: new Date().toISOString(),
    }

    var btn = dialog.querySelector('#hx-create-event-submit')
    if (btn) {
      btn.disabled = true
      btn.textContent = '提交中…'
    }

    var posted = false
    try {
      if (window.hxBackend?.enabled?.()) {
        await window.hxBackend.ensureAuth(false)
        var payload = {
          eventId: record.eventId,
          task120Id: record.task120Id,
          chiefComplaint: record.chiefComplaint || undefined,
          vehiclePlate: record.vehiclePlate || undefined,
          status: record.status,
          startedAt: record.startedAt,
          etaHospitalMinutes: record.etaHospitalMinutes,
        }
        await window.hxBackend.post('/dispatch/events', payload)
        posted = true
      }
    } catch (err) {
      console.warn('[hx-create-event] 后端创建失败，回退本地台账', err)
      posted = false
    }

    persistLocal(record)

    if (btn) {
      btn.disabled = false
      btn.textContent = '创建事件'
    }
    dialog.close()
    toast(
      (posted ? '事件已创建 · 后端 POST /dispatch/events' : '事件已创建（本地演示台账）') +
        ' · 任务 ' +
        record.task120Id +
        ' · 编号 ' +
        record.eventId,
    )
  }

  // ---------- 触发（立即 + MutationObserver + hxEnhance，幂等） ----------
  function tick() {
    if (path() !== ROUTE) return
    injectButton()
    ensureDialog()
  }

  tick()

  var mo = new MutationObserver(tick)
  function observe() {
    if (document.body) mo.observe(document.body, { childList: true, subtree: true })
  }
  if (document.body) observe()
  else document.addEventListener('DOMContentLoaded', observe, { once: true })

  if (typeof window.hxEnhance === 'function') {
    window.hxEnhance(tick, { wait: 260, afterNav: 90 })
  }
})()
