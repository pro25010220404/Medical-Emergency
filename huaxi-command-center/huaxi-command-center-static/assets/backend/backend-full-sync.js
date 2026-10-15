/**
 * 全后端模式：scenario / 质控台账等不再合并演示数据，优先从 Laravel v1 组装
 */
;(function () {
  const DEMO_STATE_KEY = 'huaxi-final-demo-v1'
  const QC_TASKS_KEY = 'huaxi-quality-tasks-v1'

  function fullBackend() {
    try {
      if (new URLSearchParams(location.search).get('api') === 'mock') return false
      if (localStorage.getItem('huaxi-api-mock') === '1') return false
      if (localStorage.getItem('huaxi-full-backend') === '0') return false
    } catch {
      /* ignore */
    }
    return window.HX_API_CONFIG?.fullBackend !== false
  }

  window.hxFullBackend = fullBackend

  function emptyScenario() {
    return {
      schemaVersion: 2,
      notice: '全后端模式：数据来自 Laravel API（62.234.128.72:7824），非本地虚构演示。',
      state: {
        patients: [],
        staff: [],
        beds: [],
        alerts: [],
        events: [],
        clinicalNotes: [],
      },
      mobile: { patients: [], consultationRequests: [] },
      vehicles: [],
      measurements: [],
      trends: [],
    }
  }

  function mapQcStatus(s) {
    const m = {
      QC_OPEN: 'pending',
      QC_RECTIFYING: 'rectifying',
      QC_REVIEW: 'reviewing',
      QC_CLOSED: 'closed',
    }
    return m[s] || 'pending'
  }

  function mapQcLevel(sev) {
    const m = { SEVERITY_HIGH: 1, SEVERITY_MEDIUM: 2, SEVERITY_LOW: 3, HIGH: 1, MEDIUM: 2, LOW: 3 }
    return m[sev] ?? 2
  }

  function mapQcIssuesToTasks(issues) {
    return issues.map((i, idx) => ({
      id: String(i.qc_code || i.id || `QC-${idx + 1}`),
      title: i.issue_title || i.title || '质控问题',
      description: i.issue_desc || i.description || i.issue_title || '',
      standardGap: i.standard_gap || i.standardGap || '',
      source: 'manual',
      level: mapQcLevel(i.severity),
      causeCategory: i.cause_category || '',
      causeAnalysis: i.cause_analysis || '',
      measure: i.rectify_measure || i.measure || '',
      ownerName: i.owner_name || '—',
      ownerOrg: i.owner_org || i.supervise_target || 'weiyuan',
      ownerDept: i.owner_dept || 'icu',
      foundAt: i.found_at || i.created_at || new Date().toISOString(),
      deadline: i.due_at || i.deadline,
      closedAt: i.closed_at || i.closedAt || null,
      status: mapQcStatus(i.qc_status || i.status),
      logs: Array.isArray(i.logs)
        ? i.logs
        : [{ at: i.created_at || new Date().toISOString(), title: '后端同步', operator: i.owner_name || '系统' }],
    }))
  }

  window.hxSyncQualityTasks = async function hxSyncQualityTasks() {
    if (!window.hxBackend?.enabled?.() || !(await window.hxBackend.ensureAuth())) return
    try {
      const issues = await window.hxBackend.list('/qc-issues', { per_page: 200 })
      if (!issues.length) return
      localStorage.setItem(QC_TASKS_KEY, JSON.stringify(mapQcIssuesToTasks(issues)))
    } catch (e) {
      console.warn('[hx-full-sync] qc-issues → localStorage', e)
    }
  }

  window.hxBuildScenarioFromBackend = async function hxBuildScenarioFromBackend() {
    const base = emptyScenario()
    if (!window.hxBackend?.enabled?.()) return base
    await window.hxBackend.ensureAuth(false)

    const get = (p) => window.hxBackend.get(p)
    const list = (p, q) => window.hxBackend.list(p, q)
    const levelMap = { HIGH: 'urgent', MEDIUM: 'warning', LOW: 'info' }

    const mapRow = window.hxMapPatientFromApi
    const patients = await list('/patients', { pageSize: 200, pageNum: 1 })
    base.state.patients = mapRow
      ? patients.map(mapRow).filter(Boolean)
      : []

    const doctors = await list('/doctors', { per_page: 200 })
    base.state.staff = doctors.map((d) => ({
      id: String(d.doctor_code || d.id),
      name: d.real_name || d.name || d.doctor_code,
      profession: d.profession || 'doctor',
      institutionId: d.institution_id || 'weiyuan',
      departmentId: d.department_id || 'emergency',
      workAreas: [],
    }))

    const warn = await get('/warnings', { pageNum: 1, pageSize: 100 })
    const wlist = warn?.list || []
    base.state.alerts = wlist.map((w) => ({
      id: String(w.warningNo || w.id),
      patientId: w.patientId || w.patientLabel,
      title: w.title || w.categoryLabel || '预警',
      level: levelMap[w.level] || 'warning',
      status: w.status || 'new',
      createdAt: w.occurredAt || new Date().toISOString(),
      updatedAt: w.updatedAt || w.occurredAt || new Date().toISOString(),
      records: [],
    }))

    try {
      const bedRaw = await get('/beds/distribution')
      const bedList = bedRaw?.beds || bedRaw?.list || []
      base.state.beds = bedList.map((b) => ({
        id: String(b.bed_id || b.bedId || b.id),
        label: b.bed_label || b.label || '床',
        institutionId: b.institution_id || 'weiyuan',
        departmentId: b.department_id || 'icu',
        status: b.status === 1 || b.status === 'occupied' ? 'occupied' : 'available',
        patientId: b.patient_id || b.patientId,
      }))
    } catch {
      /* optional */
    }

    const ev = await list('/emergency-events', { per_page: 80 })
    base.state.events = ev.map((e) => ({
      id: String(e.event_id || e.eventId || e.id),
      type: 'emergency',
      note: e.chief_complaint || e.chiefComplaint || '急救事件',
      at: e.created_at || new Date().toISOString(),
      patientId: e.patient_id || e.patientId,
      patientName: e.patient_name || e.patientName,
    }))

    const records = await list('/clinical-records', { per_page: 100 })
    base.state.clinicalNotes = records.map((r) => ({
      id: String(r.id || r.record_id),
      patientId: r.patient_id || r.patientId,
      kind: r.record_type || '病程记录',
      title: r.title || '诊疗记录',
      text: r.content || r.summary || '',
      at: r.created_at || new Date().toISOString(),
      actorId: r.doctor_id || r.doctorId,
    }))

    try {
      const gps = await get('/vehicles/gps')
      const STATUS_ZH = {
        STANDBY: '站内待命',
        DISPATCHING: '出警中',
        ON_SCENE: '现场处置',
        RETURNING: '返院途中',
      }
      base.vehicles = (gps?.vehicles || []).map((v, i) => ({
        id: String(v.vehicle_id || v.id || `V-${i}`),
        name: v.vehicle_name || v.plate || '车辆',
        plate: v.plate || '',
        status: STATUS_ZH[v.status] || v.status || '站内待命',
        institutionId: 'weiyuan',
        departmentId: 'emergency',
        position: v.lat != null ? [Number(v.lat), Number(v.lng ?? 104.66)] : [29.53, 104.66],
        deviceOnline: true,
      }))
    } catch {
      /* optional */
    }

    try {
      const vitals = await get('/critical/vitals', { pageNum: 1, pageSize: 50 })
      const vlist = vitals?.list || []
      base.measurements = vlist.map((v) => ({
        patientId: v.patientId || v.patient_id,
        bedId: v.bedId || v.bed_id,
        at: v.recorded_at || v.recordedAt || new Date().toISOString(),
        heartRate: v.heartRate ?? v.heart_rate,
        spo2: v.spo2,
      }))
    } catch {
      /* optional */
    }

    try {
      const consult = await get('/consultations', { pageNum: 1, pageSize: 50 })
      const clist = consult?.list || consult?.data || []
      base.mobile.consultationRequests = clist.map((c, idx) => ({
        id: String(c.sessionId || c.session_id || `CR-${idx}`),
        patientId: c.patient_id || c.patientId || '',
        token: c.room_token || c.roomToken || c.token || '',
        status: c.status === 'COMPLETED' ? 'completed' : c.status === 'ACCEPTED' ? 'accepted' : 'pending',
        institutionId: 'weiyuan',
        departmentId: 'emergency',
        createdAt: c.created_at || new Date().toISOString(),
        opinion: c.opinion || '',
        feedback: [],
      }))
    } catch {
      /* optional */
    }

    base.mobile.patients = base.state.patients.slice(0, 20)

    try {
      const stats = await get('/warnings/statistics')
      if (stats?.series?.length) base.trends = stats.series
    } catch {
      /* keep empty trends */
    }

    return base
  }

  function clearDemoOverrides() {
    try {
      localStorage.removeItem(DEMO_STATE_KEY)
    } catch {
      /* ignore */
    }
  }

  if (fullBackend()) {
    clearDemoOverrides()
    document.documentElement.classList.add('hx-full-backend')
    window.__HX_BOOT_READY__ = (async () => {
      if (!window.hxBackend?.enabled?.()) return false
      const ok = await window.hxBackend.ensureAuth(false)
      if (ok) await window.hxSyncQualityTasks()
      return ok
    })()
  }
})()
