/**
 * 实时出警 /#/dispatch：车辆 → 患者 → 会诊室的数据连接
 *
 * 1. 为每辆「出警中」车辆预置一间会诊室——把车辆、随车患者、患者所在会诊室连接起来：
 *    车辆 → 转运任务 → 患者 → 会诊请求；缺患者则补占位患者+转运，缺会诊则补「待接诊」会诊。
 * 2. 出警车辆卡片注入「随车患者 / 会诊号 / 会诊状态 / 参与方」真实数据。
 *
 * 注意：「查看车内画面 / 车内画面」按钮仍按 React 原逻辑直接打开监控弹窗，本脚本不拦截；
 * 弹窗内「发起会诊」由 dispatch-consult-bridge-enhance.js 直连远程会诊系统会议室。
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

  window.hxEnhance(syncCards, { wait: 300, afterNav: 80 })
})()
