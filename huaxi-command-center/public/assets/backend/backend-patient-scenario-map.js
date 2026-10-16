/**
 * Laravel GET /patients list 项 → React scenario.state.patients（#/patients 急救事件表）
 */
;(function () {
  /**
   * 后端 org_code → scenario 机构 slug（yt/ln lookup）。
   * 只映射前端机构目录（BH）里存在的机构；未收录的机构会退化为原 code。
   */
  const ORG_SLUG = {
    WY001: 'weiyuan',
    LJ001: 'lianjie',
    XC001: 'xinchang',
    HX001: 'huaxi',
    NJ001: 'neijiang-first',
  }

  /**
   * 后端 dept_code → scenario 科室 slug。
   * 值必须与前端 BH 里该机构的 departments[].id 一致，否则 ln() 会退化显示英文编码。
   */
  const DEPT_SLUG = {
    EMERGENCY: 'emergency',
    ICU: 'icu',
    CARDIO: 'cardiology',
    NEURO: 'neurology',
    RESP: 'respiratory',
    SURGERY: 'general-surgery',
    GASTRO: 'gastroenterology',
    GEN: 'general',
  }

  /** 后端 beds.status（0空床1占用2预留3维护）→ scenario 床位状态 */
  const BED_STATUS_SLUG = {
    0: 'available',
    1: 'occupied',
    2: 'reserved',
    3: 'maintenance',
    free: 'available',
    available: 'available',
    occupied: 'occupied',
    reserved: 'reserved',
    maintenance: 'maintenance',
  }

  function orgSlug(code) {
    const raw = String(code ?? 'weiyuan')
    return ORG_SLUG[raw] || raw.toLowerCase()
  }

  function deptSlug(code) {
    const raw = String(code ?? 'emergency')
    return DEPT_SLUG[raw.toUpperCase()] || raw.toLowerCase()
  }

  function bedStatusSlug(status) {
    return BED_STATUS_SLUG[status] || 'available'
  }

  window.hxOrgSlug = orgSlug
  window.hxDeptSlug = deptSlug
  window.hxBedStatusSlug = bedStatusSlug

  function mapPatientFromApi(p) {
    if (!p || typeof p !== 'object') return null
    const pid = p.patientId ?? p.patient_id ?? p.patient_code ?? p.id
    const id = pid != null && String(pid) !== '' ? String(pid) : ''
    if (!id) return null

    const cc = p.chiefComplaint ?? p.chief_complaint
    const symptoms =
      Array.isArray(p.symptoms) && p.symptoms.length
        ? p.symptoms.map(String)
        : cc
          ? [String(cc)]
          : []

    let gender = p.genderLabel
    if (!gender) {
      const g = p.gender
      if (g === 'MALE' || g === 0 || g === '0') gender = '男'
      else if (g === 'FEMALE' || g === 1 || g === '1') gender = '女'
      else if (g === 'UNKNOWN' || g === 2 || g === '2') gender = '未知'
      else gender = g || '—'
    }

    const rawSource = p.source
    const source =
      rawSource === '120' || rawSource === 'SOURCE_120' || String(rawSource || '').includes('120')
        ? '120'
        : rawSource || 'manual'

    const name = String(p.name ?? p.real_name ?? p.patientName ?? '').trim()

    const institutionId = orgSlug(p.institutionId ?? p.institution_id ?? 'weiyuan')
    const departmentId = deptSlug(p.departmentId ?? p.department_id ?? 'emergency')

    return {
      id,
      patientId: id,
      name: name || '未命名患者',
      gender,
      age: p.age ?? 0,
      institutionId,
      institutionName: p.institutionName ?? p.institution_name ?? '',
      departmentId,
      departmentName: p.departmentName ?? p.department_name ?? '',
      bedLabel: p.bedLabel ?? p.bed_label ?? '',
      stage: p.stage ?? 'admitted',
      stageLabel: p.stageLabel ?? p.stage_label ?? '',
      sourceLabel: p.sourceLabel ?? p.source_label ?? '',
      assignedTo: Array.isArray(p.assignedTo) ? p.assignedTo : [],
      symptoms,
      notes: p.notes || cc || '后端 /patients',
      createdAt: p.createdAt ?? p.created_at ?? new Date().toISOString(),
      updatedAt: p.updatedAt ?? p.updated_at ?? new Date().toISOString(),
      source,
    }
  }

  window.hxMapPatientFromApi = mapPatientFromApi
})()
