/**
 * 严格模式 + 实时合并：在 scenario.json 基础上顺序拉取后端并合并（非 huaxi-full-backend 全量替换）
 */
;(function () {
  function liveMergeEnabled() {
    try {
      if (localStorage.getItem('huaxi-backend-live') === '0') return false
      if (localStorage.getItem('huaxi-api-mock') === '1') return false
      if (new URLSearchParams(location.search).get('api') === 'mock') return false
    } catch {
      /* ignore */
    }
    if (window.hxFullBackend?.()) return false
    return window.hxBackend?.enabled?.()
  }

  window.hxLiveMergeEnabled = liveMergeEnabled

  window.hxMergeScenarioFromApis = async function hxMergeScenarioFromApis(base) {
    const out = base && typeof base === 'object' ? base : { schemaVersion: 2, state: {} }
    if (!out.state) out.state = {}
    if (!window.hxBackend?.enabled?.()) return out
    const authed = await window.hxBackend.ensureAuth(false)
    if (!authed) {
      console.warn('[hx-scenario-merge] 未登录，跳过 live 合并（仍使用 scenario.json）')
      return out
    }

    const get = (p) => window.hxBackend.get(p)
    const list = (p, q) => window.hxBackend.list(p, q)
    const levelMap = { HIGH: 'urgent', MEDIUM: 'warning', LOW: 'info' }

    let mergedBlocks = 0

    async function step(name, fn) {
      try {
        const n = await fn()
        if (n) mergedBlocks += 1
      } catch (e) {
        console.warn('[hx-scenario-merge]', name, e)
      }
    }

    // 床位与患者必须同源：后端床位合并成功才允许覆盖患者，否则床位的 patientId
    // 会指向 scenario 里已不存在的演示患者，卡片全部退化成「空床」而表头仍按
    // status==='occupied' 计数（两边对不上）。下面按 bedsMerged / patientsMerged 兜底。
    let bedsMerged = 0
    let patientsMerged = 0

    await step('patients', async () => {
      const mapRow = window.hxMapPatientFromApi
      if (typeof mapRow !== 'function') return 0
      const patients = await list('/patients', { pageSize: 100, pageNum: 1 })
      const mapped = patients.map(mapRow).filter(Boolean)
      if (!mapped.length) return 0
      patientsMerged = 1
      out.state.patients = mapped
      try {
        localStorage.removeItem('huaxi-final-demo-v1')
      } catch {
        /* ignore */
      }
      return 1
    })

    await step('doctors', async () => {
      const doctors = await list('/doctors', { per_page: 80 })
      if (!doctors.length) return 0
      out.state.staff = doctors.map((d) => ({
        id: String(d.doctor_code || d.id),
        name: d.real_name || d.name || d.doctor_code,
        profession: String(d.profession || 'doctor').toLowerCase(),
        institutionId: d.institution_id || d.institutionId || 'weiyuan',
        departmentId: d.department_id || d.departmentId || 'emergency',
        workAreas: [],
      }))
      return 1
    })

    await step('warnings', async () => {
      const warn = await get('/warnings', { pageNum: 1, pageSize: 50 })
      const wlist = warn?.list || warn?.data || []
      if (!wlist.length) return 0
      out.state.alerts = wlist.map((w) => ({
        id: String(w.warningNo || w.id),
        patientId: w.patientId || w.patientLabel,
        title: w.title || w.categoryLabel || '预警',
        level: levelMap[w.level] || 'warning',
        status: w.status || 'new',
        createdAt: w.occurredAt || new Date().toISOString(),
        updatedAt: w.updatedAt || w.occurredAt || new Date().toISOString(),
        records: [],
      }))
      return 1
    })

    await step('beds', async () => {
      // GET /beds（床位明细）返回 {list:[{bedId,institutionId,departmentId,status,patient}]}；
      // 早期误用 /beds/distribution（返回 {institutions}）导致床位永远合并不进来。
      const bedRaw = await get('/beds')
      const bedList = bedRaw?.list || bedRaw?.beds || []
      if (!bedList.length) return 0
      const orgSlug = window.hxOrgSlug || ((c) => String(c ?? 'weiyuan').toLowerCase())
      const deptSlug = window.hxDeptSlug || ((c) => String(c ?? 'emergency').toLowerCase())
      const bedStatus = window.hxBedStatusSlug || ((s) => (s === 1 || s === 'occupied' ? 'occupied' : 'available'))
      out.state.beds = bedList.map((b) => ({
        id: String(b.bedId || b.bed_id || b.id),
        label: b.label || b.bed_label || '床',
        institutionId: orgSlug(b.institutionId ?? b.institution_id),
        departmentId: deptSlug(b.departmentId ?? b.department_id),
        status: bedStatus(b.status),
        patientId: b.patient?.patientId || b.patient?.id || b.patientId || b.patient_id || undefined,
      }))
      bedsMerged = 1
      return 1
    })

    // 后端床位不可用（未配置/接口异常）时，回退到 scenario 演示床位；
    // 此时患者也必须回退，否则两套 ID 体系混在一起。
    if (!bedsMerged && patientsMerged) {
      out.state.patients = base?.state?.patients || []
      console.warn('[hx-scenario-merge] 后端无床位数据，患者同步一并回退到 scenario.json，保持床位/患者同源')
    }

    await step('emergency-events', async () => {
      const ev = await list('/emergency-events', { per_page: 40 })
      if (!ev.length) return 0
      out.state.events = ev.map((e) => ({
        id: String(e.event_id || e.eventId || e.id),
        type: 'emergency',
        note: e.chief_complaint || e.chiefComplaint || '急救事件',
        at: e.created_at || new Date().toISOString(),
        patientId: e.patient_id || e.patientId,
        patientName: e.patient_name || e.patientName,
      }))
      return 1
    })

    await step('vehicles', async () => {
      const amb = await list('/ambulances', {})
      const gps = await get('/vehicles/gps').catch(() => null)
      const gpsList = gps?.vehicles || []
      const src = amb.length ? amb : gpsList
      if (!src.length) return 0
      const STATUS_ZH = {
        STANDBY: '站内待命',
        DISPATCHING: '出警中',
        ON_SCENE: '现场处置',
        RETURNING: '返院途中',
      }
      out.vehicles = src.map((v, i) => {
        const g = gpsList.find((x) => (x.vehicle_id || x.id) === (v.vehicle_id || v.id)) || v
        return {
          id: String(v.vehicle_id || v.id || v.plate || `V-${i}`),
          name: v.vehicle_name || v.plate || v.name || '车辆',
          plate: v.plate || '',
          status: STATUS_ZH[v.status] || v.status || '站内待命',
          institutionId: 'weiyuan',
          departmentId: 'emergency',
          position:
            g.lat != null ? [Number(g.lat), Number(g.lng ?? 104.66)] : [29.53, 104.66],
          deviceOnline: true,
        }
      })
      return 1
    })

    await step('organizations', async () => {
      const orgs = await list('/organizations', { per_page: 80 })
      if (!orgs.length) return 0
      out.state.institutions = orgs.map((o) => ({
        id: String(o.org_code || o.id),
        name: o.org_name || o.name || '机构',
        tier: o.tier ?? 0,
        county: o.county_name || '',
        source: 'backend',
      }))
      return 1
    })

    await step('transfers', async () => {
      const transfers = await list('/transfers', { per_page: 60 })
      if (!transfers.length) return 0
      out.state.transfers = transfers.map((t) => ({
        id: String(t.transfer_no || t.transferNo || t.id),
        fromOrg: t.from_org_name || t.fromOrgName,
        toOrg: t.to_org_name || t.toOrgName,
        status: t.status || 'pending',
        patientName: t.patient_name || t.patientName,
        source: 'backend',
      }))
      return 1
    })

    await step('consultations', async () => {
      const rows = await get('/consultations', { pageNum: 1, pageSize: 40 })
      const clist = rows?.list || rows?.data || []
      if (!clist.length) return 0
      out.state.consultations = clist.map((c) => ({
        id: String(c.consultationNo || c.id),
        title: c.title || c.subject || '会诊',
        status: c.status || 'scheduled',
        source: 'backend',
      }))
      return 1
    })

    await step('vitals', async () => {
      const vitals = await get('/critical/vitals', { pageNum: 1, pageSize: 40 })
      const vlist = vitals?.list || vitals?.data || []
      if (!vlist.length) return 0
      // 与 backend-full-sync 保持一致：详情页体征单元需要 resp/temp/systolic/diastolic，
      // 时间取后端 measuredAt（原 recorded_at 字段不存在，会退化成当前时间）
      out.measurements = vlist.map((v) => ({
        patientId: v.patientId || v.patient_id,
        bedId: v.bedId || v.bed_id,
        at: v.measuredAt || v.at || v.recordedAt || v.recorded_at || new Date().toISOString(),
        heartRate: v.heartRate ?? v.heart_rate ?? null,
        spo2: v.spo2 ?? null,
        resp: v.resp ?? null,
        temp: v.temp ?? v.temperature ?? null,
        systolic: v.systolic ?? v.sbp ?? 0,
        diastolic: v.diastolic ?? v.dbp ?? 0,
        news: v.news ?? v.newsScore ?? null,
      }))
      return 1
    })

    if (mergedBlocks > 0) {
      try {
        localStorage.removeItem('huaxi-final-demo-v1')
      } catch {
        /* ignore */
      }
      out.backendLiveMerged = true
      console.info('[hx-scenario-merge] 已用后端数据覆盖 scenario，并清除本地演示存档 huaxi-final-demo-v1')
    }

    out.notice =
      (out.notice || '') +
      (mergedBlocks > 0
        ? ' · 患者/车辆等已来自 Laravel v1（已清本地演示存档，刷新后勿再叠 scenario 虚构数据）。'
        : ' · 后端暂无可用列表，仍使用 scenario.json 演示数据。')
    return out
  }
})()
