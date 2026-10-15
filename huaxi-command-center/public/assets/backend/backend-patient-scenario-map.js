/**
 * Laravel GET /patients list 项 → React scenario.state.patients（#/patients 急救事件表）
 */
;(function () {
  /** 后端 org_code → scenario 机构 slug（yt/ln  lookup） */
  const ORG_SLUG = {
    WY001: 'weiyuan',
    LJ001: 'lianjie',
    XC001: 'xinchang',
    HX001: 'huaxi',
  }

  /** 科室编码 → scenario 科室 slug */
  const DEPT_SLUG = {
    EMERGENCY: 'emergency',
    ICU: 'icu',
    CARDIO: 'cardio',
    NEURO: 'neuro',
    RESP: 'resp',
    GEN: 'general',
  }

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

    const rawOrg = String(p.institutionId ?? p.institution_id ?? 'weiyuan')
    const rawDept = String(p.departmentId ?? p.department_id ?? 'emergency')
    const institutionId = ORG_SLUG[rawOrg] || rawOrg.toLowerCase()
    const departmentId = DEPT_SLUG[rawDept] || rawDept.toLowerCase()

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
