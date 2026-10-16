/**
 * 单床监护页 /bed/:id：
 * 顶部为视频设备区（原 bed-center 的床旁视频 + 监护仪数字），
 * 下方为 tab 栏（患者信息 / 绑定设备 / 护理记录 / 危急值记录 / 体征采集数据），
 * tab 栏样式对齐协作机构页（.tab-row + button.active，active 色 #0284c7）。
 *
 * 数据优先对接后端（window.hxBackend.get/list），未登录 / 失败时回退演示 JSON
 * （scenario.json / api/care-bindings.json / api/device-bindings.json）。
 */
;(function () {
  const HOST_CLASS = 'hx-bd-root'
  const BODY_FLAG = 'hx-bd-active'

  const TABS = [
    ['patient', '患者信息'],
    ['device', '绑定设备'],
    ['nursing', '护理记录'],
    ['critical', '危急值记录'],
    ['vitals', '体征采集数据'],
  ]

  let scenCache = null
  let careCache = null
  let devCache = null
  let loadSeq = 0
  let loadedBedId = ''

  function path() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function fmtTime(s) {
    if (!s) return '—'
    const d = new Date(s)
    if (isNaN(d.getTime())) return String(s)
    const p = (x) => (x < 10 ? '0' : '') + x
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  }

  function toList(v) {
    if (Array.isArray(v)) return v
    if (!v) return []
    if (Array.isArray(v.list)) return v.list
    if (Array.isArray(v.data)) return v.data
    if (Array.isArray(v.items)) return v.items
    return []
  }

  function apiReady() {
    return typeof window.hxBackend?.get === 'function'
  }

  async function withBackend(fn) {
    if (!apiReady()) return null
    try {
      if (window.hxBackend.strict?.() && typeof window.hxBackend.ensureAuth === 'function') {
        await window.hxBackend.ensureAuth()
      }
      return await fn()
    } catch (e) {
      return null
    }
  }

  function fetchJson(url) {
    return fetch(url, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
  }

  async function demoData() {
    if (scenCache && careCache && devCache) return { scen: scenCache, care: careCache, dev: devCache }
    const [scen, care, dev] = await Promise.all([
      scenCache ? Promise.resolve(scenCache) : fetchJson('/scenario.json'),
      careCache ? Promise.resolve(careCache) : fetchJson('/api/care-bindings.json'),
      devCache ? Promise.resolve(devCache) : fetchJson('/api/device-bindings.json'),
    ])
    scenCache = scenCache || scen
    careCache = careCache || care
    devCache = devCache || dev
    return { scen: scen || { state: {} }, care: care || { bindings: [] }, dev: dev || { devices: [] } }
  }

  // —— 床位解析 ——

  function bedIdFromPath() {
    const m = path().match(/^\/bed\/([^/]+)/)
    return m ? decodeURIComponent(m[1]) : ''
  }

  function patientIdFromMain(main) {
    const a = main.querySelector('a.link-button[href*="/patient/"], a[href*="/patient/"]')
    if (!a) return ''
    const m = (a.getAttribute('href') || '').match(/patient\/([^/?#]+)/)
    return m ? decodeURIComponent(m[1]) : ''
  }

  function readFact(main, key) {
    const dt = [...main.querySelectorAll('.patient-facts dt')].find((el) => (el.textContent || '').trim() === key)
    return dt?.nextElementSibling ? (dt.nextElementSibling.textContent || '').trim() : ''
  }

  function resolveBed(main) {
    return {
      bedId: bedIdFromPath(),
      patientId: patientIdFromMain(main),
      label: readFact(main, '床号'),
      institutionName: readFact(main, '所属机构'),
      patientName: '',
      ward: 'icu',
    }
  }

  // —— 各 tab 数据 ——

  async function loadPatient(bed) {
    const patientId = bed.patientId
    const raw = await withBackend(() =>
      patientId ? window.hxBackend.get(`/patients/${encodeURIComponent(patientId)}`) : window.hxBackend.get(`/beds/${encodeURIComponent(bed.bedId)}`),
    )
    if (raw) {
      const p = raw.patient || raw
      return {
        name: p.name || p.patientName || '—',
        gender: p.gender || p.genderLabel || '',
        age: p.age,
        bedId: bed.bedId,
        bedLabel: bed.label || p.bedLabel || p.bed?.label || '—',
        institution: bed.institutionName || p.institutionName || p.hospital || '',
        department: p.departmentName || '重症医学科',
        symptoms: Array.isArray(p.symptoms) ? p.symptoms.join('、') : p.symptoms || p.chiefComplaint || '',
      }
    }
    const { scen, care } = await demoData()
    const c = (care.bindings || []).find((r) => r.bedId === bed.bedId)
    const pat = (scen.state?.patients || []).find((x) => x.id === patientId)
    return {
      name: c?.patientName || pat?.name || '—',
      gender: pat?.gender || '',
      age: pat?.age,
      bedId: bed.bedId,
      bedLabel: c?.bedLabel || bed.label || '—',
      institution: c?.hospital || pat?.institutionId || '威远县人民医院',
      department: '重症医学科',
      symptoms: (pat?.symptoms || []).join('、') || '',
    }
  }

  async function loadDevices(bed) {
    const raw = await withBackend(() => window.hxBackend.list(`/beds/${encodeURIComponent(bed.bedId)}/devices`))
    if (raw != null) {
      return toList(raw).map((d) => ({
        deviceId: d.deviceId || d.id || '—',
        name: d.name || d.deviceName || '监护仪',
        online: d.online !== false,
        alarm: !!d.alarm,
        boundAt: d.boundAt || '',
      }))
    }
    const { dev } = await demoData()
    const rows = (dev.devices || []).filter((d) => d.bedId === bed.bedId)
    if (!rows.length) {
      return [{ deviceId: '—', name: '监护仪', online: true, alarm: false, boundAt: '' }]
    }
    return rows.map((d) => ({
      deviceId: d.deviceId || '—',
      name: d.name || '监护仪',
      online: d.online !== false,
      alarm: !!d.alarm,
      boundAt: d.boundAt || '',
    }))
  }

  async function loadNursing(bed) {
    const patientId = bed.patientId
    if (patientId) {
      const raw = await withBackend(() => window.hxBackend.get(`/patients/${encodeURIComponent(patientId)}/timeline`))
      if (raw != null) {
        return toList(raw)
          .filter((r) => /护理/.test(r.kind || r.type || ''))
          .map((r) => ({ at: r.at || r.createdAt || '', title: r.title || r.name || '护理记录', text: r.text || r.content || r.description || '' }))
      }
    }
    const { scen } = await demoData()
    const notes = (scen.state?.clinicalNotes || []).filter((n) => n.kind === '护理记录' && (!patientId || n.patientId === patientId))
    if (!notes.length) {
      return [{ at: new Date().toISOString(), title: '入科核对与护理观察', text: '演示环境未接入护理文书，正式环境在此展示护理记录。' }]
    }
    return notes.map((n) => ({ at: n.at, title: n.title, text: n.text }))
  }

  async function loadCritical(bed) {
    const patientId = bed.patientId
    const raw = await withBackend(() => window.hxBackend.get('/warnings/critical-values'))
    if (raw != null) {
      return toList(raw)
        .filter((r) => !patientId || r.patientId === patientId)
        .map((r) => ({
          at: r.at || r.createdAt || r.checkedAt || '',
          title: r.title || r.item || r.name || '危急值',
          level: r.level || r.severity || 'warning',
          status: r.status || 'new',
        }))
    }
    const { scen } = await demoData()
    const alerts = (scen.state?.alerts || []).filter((a) => !patientId || a.patientId === patientId)
    if (!alerts.length) return []
    return alerts.map((a) => ({ at: a.createdAt || '', title: a.title || '危急值', level: a.level || 'warning', status: a.status || 'new' }))
  }

  async function loadVitals(bed) {
    const patientId = bed.patientId
    if (patientId) {
      const raw = await withBackend(() => window.hxBackend.get(`/critical/patients/${encodeURIComponent(patientId)}/vitals`))
      if (raw != null) {
        return toList(raw).map((v) => ({
          at: v.at || v.measuredAt || v.timestamp || '',
          heartRate: v.heartRate ?? v.hr,
          spo2: v.spo2,
          resp: v.resp ?? v.respiratoryRate,
          temp: v.temp ?? v.temperature,
          systolic: v.systolic ?? v.systolicPressure ?? v.systolic_bp,
          diastolic: v.diastolic ?? v.diastolicPressure ?? v.diastolic_bp,
          news: v.news,
        }))
      }
    }
    const { scen } = await demoData()
    const live = (scen.state?.measurements || []).filter((m) => m.patientId === patientId)
    const seed = (patientId || bed.bedId).split('').reduce((a, ch) => a + ch.charCodeAt(0), 0)
    const now = Date.now()
    const rows = []
    for (let k = 0; k < 6; k += 1) {
      rows.push({
        at: new Date(now - (5 - k) * 6 * 3600000).toISOString(),
        heartRate: 92 + ((seed + k * 7) % 40),
        spo2: 93 + ((seed + k) % 6),
        resp: 16 + ((seed + k * 3) % 10),
        temp: 36.2 + ((seed + k) % 15) / 10,
        systolic: 118 + ((seed + k * 2) % 30),
        diastolic: 72 + ((seed + k) % 16),
        news: (seed + k) % 8,
      })
    }
    if (live.length) return live.map((m) => ({ at: m.at, heartRate: m.heartRate, spo2: m.spo2, resp: m.resp, temp: m.temp, systolic: m.systolic, diastolic: m.diastolic, news: m.news })).concat(rows).slice(0, 8)
    return rows
  }

  // —— 渲染 ——

  function styleHtml() {
    return `<style>
      main.single-bed.hx-bd-active{display:block;}
      .hx-bd-root{padding:14px 14px 18px;display:flex;flex-direction:column;gap:14px;}
      .hx-bd-root .bed-center{margin:0;flex:none;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px;box-shadow:0 1px 2px rgba(15,23,42,.04);}
      .hx-bd-root .bed-center .monitor{margin-top:12px;}
      .hx-bd-tabs{margin:0;}
      main.single-bed .tab-row{border-bottom:1px solid #e2e8f0;display:flex;gap:4px;}
      main.single-bed .tab-row button{padding:10px 16px;border:0;background:none;color:#64748b;font-size:14px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;}
      main.single-bed .tab-row button:hover{color:#0f172a;}
      main.single-bed .tab-row button.active{color:#0284c7;border-bottom:2px solid #0284c7;font-weight:600;}
      .hx-bd-panels{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;min-height:180px;}
      .hx-bd-panel table{width:100%;border-collapse:collapse;font-size:13px;}
      .hx-bd-panel th,.hx-bd-panel td{padding:8px 10px;border:1px solid #eef2f6;text-align:left;vertical-align:top;color:#334155;line-height:1.5;}
      .hx-bd-panel th{background:#f8fafc;color:#64748b;font-weight:600;white-space:nowrap;}
      .hx-bd-panel .hx-bd-empty{color:#94a3b8;font-size:13px;padding:24px 0;text-align:center;}
      .hx-bd-badge{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;line-height:1.6;}
      .hx-bd-badge.on{background:#dcfce7;color:#166534;}
      .hx-bd-badge.off{background:#fee2e2;color:#b91c1c;}
      .hx-bd-badge.warn{background:#ffedd5;color:#c2410c;}
      .hx-bd-badge.ok{background:#e0f2fe;color:#0369a1;}
      dl.hx-bd-facts{display:grid;grid-template-columns:112px 1fr;gap:10px 0;margin:0;font-size:13px;}
      dl.hx-bd-facts dt{color:#64748b;}
      dl.hx-bd-facts dd{margin:0;color:#0f172a;}
      dl.hx-bd-facts dd.amber-text{color:#c2410c;}
    </style>`
  }

  function tabsHtml(activeTab) {
    return TABS.map(([key, label]) => {
      return `<button type="button" class="${key === activeTab ? 'active' : ''}" data-bd-tab="${key}">${label}</button>`
    }).join('')
  }

  function panelsHtml(activeTab) {
    return TABS.map(([key]) => {
      return `<section class="hx-bd-panel" data-bd-panel="${key}"${key === activeTab ? '' : ' hidden'}></section>`
    }).join('')
  }

  function emptyPanel(text) {
    return `<p class="hx-bd-empty">${esc(text)}</p>`
  }

  function renderPatientPanel(panel, data) {
    if (!data) {
      panel.innerHTML = emptyPanel('暂无患者信息')
      return
    }
    panel.innerHTML = `<dl class="hx-bd-facts">
      <dt>姓名</dt><dd>${esc(data.name)}</dd>
      <dt>性别 / 年龄</dt><dd>${esc(data.gender || '—')}${data.age != null ? ` / ${esc(String(data.age))} 岁` : ''}</dd>
      <dt>床号</dt><dd>${esc(data.bedLabel)}</dd>
      <dt>所属机构</dt><dd>${esc(data.institution || '威远县人民医院')}</dd>
      <dt>所在科室</dt><dd>${esc(data.department || '重症医学科')}</dd>
      <dt>主诉</dt><dd class="${data.symptoms ? 'amber-text' : ''}">${esc(data.symptoms || '待评估')}</dd>
    </dl>`
  }

  function renderDevicePanel(panel, rows) {
    if (!rows?.length) {
      panel.innerHTML = emptyPanel('暂无绑定设备')
      return
    }
    panel.innerHTML = `<table>
      <thead><tr><th>设备名称</th><th>设备编号</th><th>在线状态</th><th>报警</th><th>绑定时间</th></tr></thead>
      <tbody>${rows.map((d) => `<tr>
        <td>${esc(d.name)}</td>
        <td>${esc(d.deviceId)}</td>
        <td><span class="hx-bd-badge ${d.online ? 'on' : 'off'}">${d.online ? '在线' : '离线'}</span></td>
        <td>${d.alarm ? '<span class="hx-bd-badge warn">有报警</span>' : '<span class="hx-bd-badge ok">正常</span>'}</td>
        <td>${esc(fmtTime(d.boundAt))}</td>
      </tr>`).join('')}</tbody>
    </table>`
  }

  function renderNursingPanel(panel, rows) {
    if (!rows?.length) {
      panel.innerHTML = emptyPanel('暂无护理记录')
      return
    }
    panel.innerHTML = `<table>
      <thead><tr><th>时间</th><th>标题</th><th>内容</th></tr></thead>
      <tbody>${rows.map((r) => `<tr>
        <td style="white-space:nowrap">${esc(fmtTime(r.at))}</td>
        <td>${esc(r.title)}</td>
        <td>${esc(r.text || r.title)}</td>
      </tr>`).join('')}</tbody>
    </table>`
  }

  function renderCriticalPanel(panel, rows) {
    if (!rows?.length) {
      panel.innerHTML = emptyPanel('暂无危急值记录')
      return
    }
    panel.innerHTML = `<table>
      <thead><tr><th>时间</th><th>事件</th><th>级别</th><th>状态</th></tr></thead>
      <tbody>${rows.map((r) => {
        const lv = (r.level || 'warning').toLowerCase()
        const lvBadge = lv === 'urgent' ? '<span class="hx-bd-badge warn">危急</span>' : lv === 'info' ? '<span class="hx-bd-badge ok">提示</span>' : '<span class="hx-bd-badge">预警</span>'
        const st = r.status === 'new' || r.status === 'unresolved' ? '<span class="hx-bd-badge warn">待处理</span>' : '<span class="hx-bd-badge on">已处理</span>'
        return `<tr><td style="white-space:nowrap">${esc(fmtTime(r.at))}</td><td>${esc(r.title)}</td><td>${lvBadge}</td><td>${st}</td></tr>`
      }).join('')}</tbody>
    </table>`
  }

  function renderVitalsPanel(panel, rows) {
    if (!rows?.length) {
      panel.innerHTML = emptyPanel('暂无体征采集数据')
      return
    }
    panel.innerHTML = `<table>
      <thead><tr><th>时间</th><th>心率 bpm</th><th>SpO₂ %</th><th>呼吸 次/分</th><th>体温 ℃</th><th>血压 mmHg</th><th>NEWS</th></tr></thead>
      <tbody>${rows.map((v) => `<tr>
        <td style="white-space:nowrap">${esc(fmtTime(v.at))}</td>
        <td>${v.heartRate ?? '—'}</td>
        <td>${v.spo2 ?? '—'}</td>
        <td>${v.resp ?? '—'}</td>
        <td>${v.temp ?? '—'}</td>
        <td>${v.systolic ?? '—'}${v.diastolic != null ? `/${v.diastolic}` : ''}</td>
        <td>${v.news ?? '—'}</td>
      </tr>`).join('')}</tbody>
    </table>`
  }

  // —— 布局 ——

  function bindTabs(host) {
    if (host.dataset.bdBound === '1') return
    host.dataset.bdBound = '1'
    host.addEventListener('click', function (ev) {
      const btn = ev.target.closest('[data-bd-tab]')
      if (!btn || !host.contains(btn)) return
      const tab = btn.getAttribute('data-bd-tab')
      host.querySelectorAll('[data-bd-tab]').forEach((b) => b.classList.toggle('active', b === btn))
      host.querySelectorAll('[data-bd-panel]').forEach((panel) => {
        panel.hidden = panel.getAttribute('data-bd-panel') !== tab
      })
    })
  }

  function buildShell(main) {
    if (!main.querySelector(':scope > style.hx-bd-style')) {
      const style = document.createElement('style')
      style.className = 'hx-bd-style'
      style.textContent = styleHtml().replace(/<style>|<\/style>/g, '')
      main.prepend(style)
    }

    let host = main.querySelector(':scope > .' + HOST_CLASS)
    if (!host) {
      host = document.createElement('div')
      host.className = HOST_CLASS
      host.innerHTML = `<div class="tab-row hx-bd-tabs" role="tablist">${tabsHtml('patient')}</div><div class="hx-bd-panels">${panelsHtml('patient')}</div>`
      main.prepend(host)
    }

    // 把 bed-center（床旁视频 + 监护仪数字）移入 host 顶部，作为视频设备区
    const bedCenter = main.querySelector(':scope > .bed-center')
    if (bedCenter && bedCenter.parentElement !== host) {
      host.prepend(bedCenter)
    }

    const aside = main.querySelector(':scope > aside')
    const bedRight = main.querySelector(':scope > .bed-right')
    if (aside && aside.parentElement === main) aside.hidden = true
    if (bedRight && bedRight.parentElement === main) bedRight.hidden = true

    bindTabs(host)
    if (typeof window.hxVideoPlaceholder?.scan === 'function') window.hxVideoPlaceholder.scan()
    return host
  }

  function loadPanels(host, bed) {
    const seq = ++loadSeq
    Promise.all([loadPatient(bed), loadDevices(bed), loadNursing(bed), loadCritical(bed), loadVitals(bed)]).then(([pat, dev, nur, crit, vit]) => {
      if (seq !== loadSeq || !host.isConnected) return
      const map = { patient: pat, device: dev, nursing: nur, critical: crit, vitals: vit }
      host.querySelectorAll('[data-bd-panel]').forEach((panel) => {
        const key = panel.getAttribute('data-bd-panel')
        if (key === 'patient') renderPatientPanel(panel, map.patient)
        else if (key === 'device') renderDevicePanel(panel, map.device)
        else if (key === 'nursing') renderNursingPanel(panel, map.nursing)
        else if (key === 'critical') renderCriticalPanel(panel, map.critical)
        else renderVitalsPanel(panel, map.vitals)
      })
    })
  }

  // —— 生命周期 ——

  function unmount() {
    document.body.classList.remove(BODY_FLAG)
    document.querySelectorAll('main.single-bed').forEach((main) => {
      main.classList.remove(BODY_FLAG)
      const host = main.querySelector(':scope > .hx-bd-root')
      if (host) {
        const bedCenter = host.querySelector(':scope > .bed-center')
        if (bedCenter) main.appendChild(bedCenter)
        host.remove()
      }
      main.querySelectorAll(':scope > style.hx-bd-style').forEach((s) => s.remove())
      main.querySelectorAll(':scope > aside, :scope > .bed-right').forEach((el) => (el.hidden = false))
    })
    loadSeq += 1
    loadedBedId = ''
  }

  function render() {
    if (!path().startsWith('/bed/')) {
      unmount()
      return
    }
    const main = document.querySelector('main.single-bed')
    if (!main) return

    document.body.classList.add(BODY_FLAG)
    main.classList.add(BODY_FLAG)
    const bed = resolveBed(main)
    const host = buildShell(main)
    const firstPanel = host.querySelector('[data-bd-panel]')
    const panelsEmpty = !firstPanel || firstPanel.childElementCount === 0
    if (panelsEmpty || bed.bedId !== loadedBedId) {
      loadedBedId = bed.bedId
      loadPanels(host, bed)
    }
  }

  let moBound = false
  function bindRootWatch() {
    if (moBound) return
    moBound = true
    const root = document.getElementById('root') || document.body
    let timer = null
    const mo = new MutationObserver(() => {
      if (!path().startsWith('/bed/')) return
      clearTimeout(timer)
      timer = setTimeout(render, 200)
    })
    mo.observe(root, { childList: true, subtree: true })
  }

  function boot() {
    bindRootWatch()
    render()
    let tries = 0
    const retry = setInterval(() => {
      render()
      tries += 1
      if (tries > 30 || document.querySelector('main.single-bed .hx-bd-root .hx-bd-panels')) {
        clearInterval(retry)
      }
    }, 400)
  }

  window.hxEnhance(boot, { wait: 300, afterNav: 120 })
})()
