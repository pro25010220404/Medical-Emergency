/**
 * 从后端拉取首条记录，供 GET 占位符、路由绑定、全量探测使用
 */
;(function () {
  let cache = null
  let loading = null

  function pickId(row) {
    if (!row || typeof row !== 'object') return '1'
    return String(
      row.transfer_code ||
        row.sessionId ||
        row.session_id ||
        row.patient_code ||
        row.event_id ||
        row.eventId ||
        row.device_id ||
        row.deviceId ||
        row.stream_id ||
        row.streamId ||
        row.vehicle_id ||
        row.vehicleId ||
        row.id ||
        '1',
    )
  }

  async function buildSamples() {
    const api = window.hxBackend
    if (!api?.enabled?.()) return {}
    await api.ensureAuth()
    const s = {}
    try {
      const transfers = await api.list('/transfers', { per_page: 5 })
      const t0 = transfers[0]
      s.transferId = t0?.id != null ? String(t0.id) : '1'
      s.transferNo = t0?.transfer_code || t0?.transferNo || 'T20250101001'
    } catch {
      s.transferId = '1'
      s.transferNo = 'T20250101001'
    }
    try {
      const consult = await api.get('/consultations', { pageNum: 1, pageSize: 5 })
      const list = consult?.list || consult?.data || []
      const c0 = list[0]
      s.sessionId = pickId(c0)
      s.token = c0?.room_token || c0?.roomToken || c0?.token || 'demo-room'
    } catch {
      s.sessionId = '1'
      s.token = 'demo-room'
    }
    try {
      const patients = await api.list('/patients', { per_page: 1 })
      s.patientId = pickId(patients[0])
    } catch {
      s.patientId = '1'
    }
    try {
      const warnings = await api.get('/warnings', { pageNum: 1, pageSize: 1 })
      const wlist = warnings?.list || []
      s.warningId = pickId(wlist[0])
    } catch {
      s.warningId = '1'
    }
    try {
      const events = await api.list('/dispatch/events', { per_page: 1 })
      s.eventId = pickId(events[0])
    } catch {
      s.eventId = 'EVT001'
    }
    try {
      const ev = await api.list('/emergency-events', { per_page: 1 })
      s.emergencyEventId = pickId(ev[0])
    } catch {
      s.emergencyEventId = '1'
    }
    try {
      const dev = await api.list('/devices', { per_page: 1 })
      s.deviceId = pickId(dev[0])
      s.device_id = s.deviceId
    } catch {
      s.deviceId = '1'
    }
    try {
      const streams = await api.list('/monitoring/streams', {})
      s.streamId = pickId(streams[0])
    } catch {
      s.streamId = '1'
    }
    try {
      const amb = await api.list('/ambulances', {})
      s.vehicleId = pickId(amb[0])
    } catch {
      s.vehicleId = '1'
    }
    try {
      const orgs = await api.list('/organizations', { per_page: 1 })
      s.orgId = pickId(orgs[0])
    } catch {
      s.orgId = '1'
    }
    try {
      const beds = await api.get('/beds/overview')
      const first = beds?.beds?.[0] || beds?.list?.[0]
      s.bedId = pickId(first)
    } catch {
      s.bedId = '1'
    }
    try {
      const qc = await api.list('/qc-issues', { per_page: 1 })
      s.qcIssueId = pickId(qc[0])
    } catch {
      s.qcIssueId = '1'
    }
    try {
      const centers = await api.list('/centers', {})
      s.centerId = pickId(centers[0])
    } catch {
      s.centerId = '1'
    }
    s.id = s.patientId
    return s
  }

  window.hxEnsureApiSamples = async function hxEnsureApiSamples(force) {
    if (cache && !force) return cache
    if (loading) return loading
    loading = (async () => {
      const s = await buildSamples()
      cache = s
      window.__HX_API_SAMPLES__ = s
      return s
    })()
    try {
      return await loading
    } finally {
      loading = null
    }
  }

  /** 将 catalog 路径中的 {param} 替换为样本值 */
  window.hxResolveApiPath = function hxResolveApiPath(template, routeParams) {
    const s = window.__HX_API_SAMPLES__ || {}
    const map = {
      transferNo: routeParams?.transferNo || s.transferNo,
      transfer: routeParams?.transferId || s.transferId,
      id: routeParams?.id || s.id,
      eventId: routeParams?.eventId || s.eventId,
      sessionId: routeParams?.sessionId || s.sessionId,
      token: routeParams?.token || s.token,
      deviceId: routeParams?.deviceId || s.deviceId,
      streamId: routeParams?.streamId || s.streamId,
      vehicleId: routeParams?.vehicleId || s.vehicleId,
      qc_issue: routeParams?.id || s.qcIssueId,
      emergency_event: routeParams?.id || s.emergencyEventId,
      vehicle: routeParams?.id || s.vehicleId,
    }
    return template.replace(/\{(\w+)\}/g, (_, key) => {
      if (map[key] != null) return encodeURIComponent(map[key])
      if (routeParams?.[key] != null) return encodeURIComponent(routeParams[key])
      if (s[key] != null) return encodeURIComponent(s[key])
      return '1'
    })
  }

})()
