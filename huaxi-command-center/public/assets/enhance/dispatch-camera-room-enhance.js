/**
 * 实时出警 /#/dispatch：
 * 1. 为每辆「出警中」车辆预置一间会诊室——把车辆、随车患者、患者所在会诊室连接起来：
 *    车辆 → 转运任务 → 患者 → 会诊请求；缺患者则补占位患者+转运，缺会诊则补「待接诊」会诊。
 * 2. 出警车辆卡片注入「随车患者 / 会诊号 / 会诊状态 / 参与方」真实数据。
 * 3. 「查看车内画面 / 车内画面」不再直接打开监控弹窗，改为确认框——仅两个按钮可跳转：
 *    「进入会诊室」→ #/room/:token，「远程会诊」→ #/consultations（点遮罩 / Esc 不跳转）。
 * 数据读写走本地演示存档（huaxi-final-demo-v1），与 React 主程序共用同一份状态。
 */
;(function () {
  var STORE_KEY = 'huaxi-final-demo-v1'

  function hashPath() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function onDispatch() {
    return hashPath() === '/dispatch'
  }

  var STATUS_LABEL = {
    accepted: '已接诊',
    pending: '待接诊',
    completed: '已完成',
    consulting: '会诊中',
  }

  // ---- 本地演示存档 ----
  function readStore() {
    try {
      var raw = localStorage.getItem(STORE_KEY)
      if (!raw) return null
      var store = JSON.parse(raw)
      if (store.version !== 1 || !Array.isArray(store.state && store.state.patients)) return null
      return store
    } catch (e) {
      return null
    }
  }

  function persistStore(store) {
    try {
      var json = JSON.stringify(store)
      localStorage.setItem(STORE_KEY, json)
      window.dispatchEvent(
        new StorageEvent('storage', { key: STORE_KEY, newValue: json, storageArea: localStorage }),
      )
    } catch (e) {
      /* ignore */
    }
  }

  function uuid() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return globalThis.crypto.randomUUID()
    }
    return String(Date.now()) + Math.random().toString(36).slice(2)
  }

  var DISPATCH_RANK = { transporting: 0, 'at-hospital': 1, accepted: 2, 'on-scene': 3, onboard: 4 }
  var CONSULT_RANK = { accepted: 0, pending: 1, consulting: 2, completed: 3 }
  var ACTIVE_CONSULT = { accepted: 1, pending: 1, consulting: 1 }

  // ---- 演示绑定：川K1201 ↔ 患者李国强 ↔ 会诊室（保证已存在的本地存档也同步到位）----
  var DEMO_BINDING = {
    vehicleId: 'AMB-1',
    vehicleName: '川K1201',
    vehiclePlate: '川K1201',
    patientId: 'FIELD-001',
    patientName: '李国强',
    consultationId: 'CR-F-001B',
    joinUrl:
      'https://chat.augensternchat.cn/#/join/58bbd67c?token=5197e863-cb6a-4440-9ab9-57a45c42735f&name=%E7%B3%BB%E7%BB%9F%E7%AE%A1%E7%90%86%E5%91%98&userId=admin',
  }

  function applyBinding(store) {
    var state = store.state
    var changed = false

    var vehicle = (state.vehicles || []).find(function (v) {
      return v.id === DEMO_BINDING.vehicleId
    })
    if (vehicle) {
      if (vehicle.name !== DEMO_BINDING.vehicleName) {
        vehicle.name = DEMO_BINDING.vehicleName
        changed = true
      }
      if (vehicle.plate !== DEMO_BINDING.vehiclePlate) {
        vehicle.plate = DEMO_BINDING.vehiclePlate
        changed = true
      }
    }

    var patient = (state.patients || []).find(function (p) {
      return p.id === DEMO_BINDING.patientId
    })
    if (patient && patient.name !== DEMO_BINDING.patientName) {
      patient.name = DEMO_BINDING.patientName
      changed = true
    }

    var req = (state.consultationRequests || []).find(function (cr) {
      return cr.id === DEMO_BINDING.consultationId
    })
    if (req && req.joinUrl !== DEMO_BINDING.joinUrl) {
      req.joinUrl = DEMO_BINDING.joinUrl
      changed = true
    }

    return changed
  }

  // ---- 预置会诊室：车辆 → 患者 → 会诊 ----
  function provisionRooms(store) {
    var state = store.state
    var vehicles = state.vehicles || []
    var dispatches = state.dispatches || (state.dispatches = [])
    var requests = state.consultationRequests || (state.consultationRequests = [])
    var patients = state.patients || (state.patients = [])

    var changed = false

    vehicles
      .filter(function (v) {
        return v.status === '出警中'
      })
      .forEach(function (vehicle) {
        var dispatch = dispatches
          .filter(function (d) {
            return d.vehicleId === vehicle.id
          })
          .sort(function (a, b) {
            var ra = DISPATCH_RANK[a.status] != null ? DISPATCH_RANK[a.status] : 99
            var rb = DISPATCH_RANK[b.status] != null ? DISPATCH_RANK[b.status] : 99
            return ra - rb
          })[0]
        var patientId = dispatch && dispatch.patientId
        var now = new Date().toISOString()

        // 缺患者：补占位患者 + 转运任务，让车辆与患者、会诊室串成一条链
        if (!patientId) {
          var pid = 'PT-' + vehicle.id
          var plate = vehicle.plate || vehicle.name || vehicle.id
          if (!patients.some(function (p) {
            return p.id === pid
          })) {
            patients.push({
              id: pid,
              name: '随车患者（' + plate + '）',
              real_name: '',
              patient_code: '',
              stage: 'registered',
              institutionId: vehicle.institutionId,
              departmentId: vehicle.departmentId || 'emergency',
              symptoms: [],
              assignedTo: [],
              consultationToken: '',
              updatedAt: now,
            })
          }
          patientId = pid
          dispatches.push({
            id: 'DISP-AUTO-' + vehicle.id,
            patientId: pid,
            vehicleId: vehicle.id,
            status: 'transporting',
            fromInstitutionId: vehicle.institutionId,
            toInstitutionId: vehicle.institutionId,
            startedAt: now,
            milestones: [],
          })
          changed = true
        }

        // 已有进行中的会诊则跳过
        var hasActive = requests.some(function (cr) {
          return cr.patientId === patientId && ACTIVE_CONSULT[cr.status]
        })
        if (hasActive) return

        // 补一间「待接诊」会诊室
        var token = uuid()
        var reqId = 'CR-AUTO-' + vehicle.id
        requests.push({
          id: reqId,
          patientId: patientId,
          token: token,
          status: 'pending',
          institutionId: vehicle.institutionId,
          departmentId: vehicle.departmentId || 'emergency',
          createdBy: 'admin',
          createdAt: now,
          sourceInstitutionId: vehicle.institutionId,
          sourceDepartmentId: vehicle.departmentId || 'emergency',
          feedback: [],
        })
        var patient = patients.find(function (p) {
          return p.id === patientId
        })
        if (patient) {
          patient.consultationToken = token
          patient.consultationRequestId = reqId
          patient.updatedAt = now
        }
        changed = true
      })

    return changed
  }

  function resolveVehicleLink(ref, store) {
    var name = (ref || '').trim()
    if (!name) return null
    var state = store.state
    var vehicles = state.vehicles || []
    var dispatches = state.dispatches || []
    var requests = state.consultationRequests || []
    var patients = state.patients || []
    var staff = state.staff || []

    var vehicle = vehicles.find(function (v) {
      return (v.name || '').trim() === name || (v.plate || '').trim() === name
    })
    if (!vehicle) return null

    var dispatch = dispatches
      .filter(function (d) {
        return d.vehicleId === vehicle.id
      })
      .sort(function (a, b) {
        var ra = DISPATCH_RANK[a.status] != null ? DISPATCH_RANK[a.status] : 99
        var rb = DISPATCH_RANK[b.status] != null ? DISPATCH_RANK[b.status] : 99
        return ra - rb
      })[0]
    var patientId = dispatch && dispatch.patientId

    var patient = patients.find(function (p) {
      return p.id === patientId
    })
    var patientName = (patient && patient.name) || ''

    var req = requests
      .filter(function (cr) {
        return cr.patientId === patientId
      })
      .sort(function (a, b) {
        var ra = CONSULT_RANK[a.status] != null ? CONSULT_RANK[a.status] : 50
        var rb = CONSULT_RANK[b.status] != null ? CONSULT_RANK[b.status] : 50
        return ra - rb
      })[0]
    var token = (req && req.token) || ''
    var status = req && req.status

    var doctorId = (req && (req.acceptedBy || req.nominatedDoctorId)) || ''
    var doctor = staff.find(function (s) {
      return s.id === doctorId
    })

    return {
      vehicleId: vehicle.id,
      patientId: patientId || '',
      patientName: patientName,
      token: token,
      joinUrl: (req && req.joinUrl) || '',
      status: status || '',
      statusLabel: STATUS_LABEL[status] || '',
      doctorName: (doctor && doctor.name) || '',
    }
  }

  // ---- 卡片连接：车辆 → 患者 → 会诊室 ----
  function setDlValue(dl, dtLabel, value) {
    var dts = dl.querySelectorAll(':scope > dt')
    for (var i = 0; i < dts.length; i++) {
      if ((dts[i].textContent || '').trim() === dtLabel) {
        var dd = dts[i].nextElementSibling
        if (dd && dd.tagName === 'DD') {
          dd.textContent = value
          return dd
        }
      }
    }
    return null
  }

  function ensureDlRow(dl, dtLabel, value) {
    var existing = setDlValue(dl, dtLabel, value)
    if (existing) return existing
    var dt = document.createElement('dt')
    dt.textContent = dtLabel
    var dd = document.createElement('dd')
    dd.textContent = value
    dl.appendChild(dt)
    dl.appendChild(dd)
    return dd
  }

  function updateArticle(article, link) {
    var dl = article.querySelector('dl')
    if (!dl) return
    if (link && link.patientId) {
      ensureDlRow(dl, '随车患者', link.patientName || '未知患者')
      setDlValue(dl, '会诊号', link.token || '—')
      setDlValue(dl, '会诊状态', link.statusLabel || '未连接')
      var parts = []
      if (link.patientName) parts.push(link.patientName)
      if (link.doctorName) parts.push(link.doctorName)
      setDlValue(dl, '参与方', parts.length ? parts.join(' / ') : '—')
    } else {
      ensureDlRow(dl, '随车患者', '无关联任务')
    }
  }

  function updateCardsFromStore(store) {
    var articles = document.querySelectorAll('.dispatch-active article')
    articles.forEach(function (article) {
      var nameBtn = article.querySelector('header > button:first-child')
      var ref = (nameBtn?.textContent || '').trim()
      if (!ref) return
      updateArticle(article, resolveVehicleLink(ref, store))
    })
  }

  var retryCount = 0
  var retryTimer = null
  var refreshTimer = null
  function syncCards() {
    if (!onDispatch()) {
      retryCount = 0
      return
    }
    var store = readStore()
    if (!store) {
      // React 主程序尚未初始化本地存档：稍后重试
      if (retryCount < 20) {
        retryCount++
        clearTimeout(retryTimer)
        retryTimer = setTimeout(syncCards, 600)
      }
      return
    }
    retryCount = 0
    var changed = applyBinding(store)
    if (provisionRooms(store)) changed = true
    if (changed) {
      persistStore(store)
      // storage 事件会触发 React 主程序重绘车牌/车名，稍后重跑一次以正确解析关联信息
      clearTimeout(refreshTimer)
      refreshTimer = setTimeout(syncCards, 250)
    }
    updateCardsFromStore(store)
  }

  // ---- 确认框（仅两个按钮可跳转）----
  var DIALOG_STYLE_ID = 'hx-camera-room-dialog-style'
  function ensureDialogStyle() {
    if (document.getElementById(DIALOG_STYLE_ID)) return
    var s = document.createElement('style')
    s.id = DIALOG_STYLE_ID
    s.textContent =
      '#hx-camera-room-dialog{position:fixed;inset:0;z-index:50000;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;}' +
      '#hx-camera-room-dialog[hidden]{display:none!important;}' +
      '.hx-camera-room-dialog__backdrop{position:absolute;inset:0;background:rgba(15,23,42,0.45);backdrop-filter:blur(3px);}' +
      '.hx-camera-room-dialog__panel{position:relative;z-index:1;width:min(420px,100%);background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 24px 48px rgba(15,23,42,0.18);overflow:hidden;font-family:"Noto Sans SC",system-ui,sans-serif;}' +
      '.hx-camera-room-dialog__head{display:flex;gap:12px;align-items:flex-start;padding:18px 20px 0;}' +
      '.hx-camera-room-dialog__icon{flex-shrink:0;width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;line-height:1;background:#fffbeb;color:#b45309;border:1px solid #fde68a;}' +
      '.hx-camera-room-dialog__head h2{margin:0 0 6px;font-size:17px;font-weight:600;color:#0f172a;line-height:1.35;}' +
      '.hx-camera-room-dialog__head p{margin:0;font-size:14px;line-height:1.6;color:#475569;}' +
      '.hx-camera-room-dialog__lead{margin:12px 20px 0;padding:10px 12px;font-size:13px;line-height:1.55;color:#334155;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;}' +
      '.hx-camera-room-dialog__foot{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:10px;padding:18px 20px 20px;}' +
      '.hx-camera-room-dialog__btn{min-height:38px;padding:8px 18px;font:inherit;font-size:14px;font-weight:500;border-radius:8px;cursor:pointer;border:1px solid #cbd5e1;background:#fff;color:#334155;}' +
      '.hx-camera-room-dialog__btn:hover{background:#f8fafc;border-color:#94a3b8;}' +
      '.hx-camera-room-dialog__btn--primary{background:#1d4ed8;border-color:#1d4ed8;color:#fff;}' +
      '.hx-camera-room-dialog__btn--primary:hover{background:#1e40af;border-color:#1e40af;}'
    document.head.appendChild(s)
  }

  /** resolve('room') → 进入会诊室；resolve('consult') → 远程会诊；resolve(null) → 关闭不跳转 */
  function cameraRoomDialog() {
    ensureDialogStyle()
    return new Promise(function (resolve) {
      var root = document.getElementById('hx-camera-room-dialog')
      if (!root) {
        root = document.createElement('div')
        root.id = 'hx-camera-room-dialog'
        root.hidden = true
        document.body.appendChild(root)
      }
      root.hidden = false
      root.innerHTML =
        '<div class="hx-camera-room-dialog__backdrop" data-act="dismiss"></div>' +
        '<div class="hx-camera-room-dialog__panel" role="dialog" aria-modal="true">' +
        '<div class="hx-camera-room-dialog__head">' +
        '<div class="hx-camera-room-dialog__icon" aria-hidden="true">!</div>' +
        '<div><h2>进入会诊室</h2><p>是否要进入相应的会诊室？</p></div>' +
        '</div>' +
        '<p class="hx-camera-room-dialog__lead">「进入会诊室」打开该车辆关联的远程会诊室；「远程会诊」前往会诊队列。</p>' +
        '<div class="hx-camera-room-dialog__foot">' +
        '<button type="button" class="hx-camera-room-dialog__btn" data-act="consult">远程会诊</button>' +
        '<button type="button" class="hx-camera-room-dialog__btn hx-camera-room-dialog__btn--primary" data-act="room">进入会诊室</button>' +
        '</div></div>'

      function done(action) {
        root.hidden = true
        root.innerHTML = ''
        document.removeEventListener('keydown', onKey)
        resolve(action)
      }
      function onKey(ev) {
        if (ev.key === 'Escape') done(null)
      }
      document.addEventListener('keydown', onKey)
      root.onclick = function (ev) {
        var t = ev.target
        if (!(t instanceof Element)) return
        var hit = t.closest('[data-act]')
        if (!hit) return
        var act = hit.getAttribute('data-act')
        if (act === 'room') done('room')
        else if (act === 'consult') done('consult')
        else if (act === 'dismiss') done(null)
      }
    })
  }

  function goRoom(token) {
    location.hash = '#/room/' + encodeURIComponent(token)
  }
  function goConsultations() {
    location.hash = '#/consultations'
  }

  /** 从按钮所在 DOM 还原车辆标识：优先车名（卡片），其次车牌（底部车辆详情条） */
  function vehicleRefFrom(btn) {
    var article = btn.closest('article')
    if (article) {
      var name = (article.querySelector('header > button:first-child')?.textContent || '').trim()
      if (name) return name
    }
    var bar = btn.closest('.vehicle-detail-bar')
    if (bar) {
      var plate = (bar.querySelector('strong')?.textContent || '').trim()
      if (plate) return plate
    }
    var sel = document.querySelector('.dispatch-active article.selected, .dispatch-active article.on')
    return (sel?.querySelector('header > button:first-child')?.textContent || '').trim()
  }

  document.addEventListener(
    'click',
    function (event) {
      if (!onDispatch()) return
      var t = event.target
      if (!(t instanceof Element)) return
      if (t.closest('#hx-camera-room-dialog')) return
      var btn = t.closest('button')
      if (!btn) return
      var label = (btn.textContent || '').replace(/\s+/g, '')
      if (label !== '查看车内画面' && label !== '车内画面') return

      event.preventDefault()
      event.stopImmediatePropagation()

      var ref = vehicleRefFrom(btn)

      cameraRoomDialog().then(function (action) {
        if (action === 'consult') {
          goConsultations()
          return
        }
        if (action !== 'room') return // 遮罩 / Esc：关闭，不跳转
        var store = readStore()
        var link = store ? resolveVehicleLink(ref, store) : null
        if (link && link.joinUrl) {
          // 有关联会诊室链接（如川K1201 · 李国强）：直接打开外部会诊室
          window.open(link.joinUrl, '_blank', 'noopener')
        } else {
          goRoom(link && link.token ? link.token : uuid())
        }
      })
    },
    true,
  )

  window.hxEnhance(syncCards, { wait: 300, afterNav: 80 })
})()
