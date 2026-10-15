import type { PatientRecord } from '../types/patient'

const GENDER_ZH: Record<string, string> = {
  MALE: '男',
  FEMALE: '女',
  male: '男',
  female: '女',
}

export function genderLabel(g?: string | null) {
  if (!g) return '—'
  return GENDER_ZH[g] ?? g
}

export function genderBadgeClass(g?: string | null) {
  const u = String(g || '').toUpperCase()
  if (u === 'MALE') return 'badge teal'
  if (u === 'FEMALE') return 'badge amber'
  return 'badge muted'
}

export function formatPatientTime(iso?: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false })
  } catch {
    return iso
  }
}

type RawObject = Record<string, unknown>

function pickString(o: RawObject, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = o[key]
    if (value == null) continue
    if (typeof value === 'string') {
      const s = value.trim()
      if (s !== '') return s
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value)
    }
  }
  return undefined
}

function pickNumber(o: RawObject, keys: string[]): number | null {
  for (const key of keys) {
    const value = o[key]
    if (value == null || value === '') continue
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

/**
 * 后端契约（03-患者与床位/02-患者管理接口 §3.2/§3.3）为 camelCase：
 * patientId / name / gender / genderLabel / createdAt；本地页面沿用 snake_case，
 * 这里统一做一次字段归一化，避免编号、姓名、建档时间取值失败显示「— / undefined」。
 */
export function normalizePatient(raw: unknown): PatientRecord {
  const o = (raw && typeof raw === 'object' ? raw : {}) as RawObject
  const code = pickString(o, ['patientId', 'patient_code'])

  return {
    id: code ?? pickString(o, ['id']) ?? '',
    patient_code: code,
    real_name: pickString(o, ['name', 'real_name']),
    gender: pickString(o, ['gender']),
    gender_label: pickString(o, ['genderLabel', 'gender_label']),
    birth_date: pickString(o, ['birthDate', 'birth_date']) ?? null,
    age: pickNumber(o, ['age']),
    id_card: pickString(o, ['idCard', 'id_card']) ?? null,
    phone: pickString(o, ['phone']) ?? null,
    address: pickString(o, ['address']) ?? null,
    medical_history: pickString(o, ['medicalHistory', 'medical_history']) ?? null,
    allergy_history: pickString(o, ['allergyHistory', 'allergy_history']) ?? null,
    created_at: pickString(o, ['createdAt', 'created_at']) ?? null,
    stage: pickString(o, ['stage']) ?? null,
    stage_label: pickString(o, ['stageLabel', 'stage_label']) ?? null,
    institution_id: pickString(o, ['institutionId', 'institution_id']) ?? null,
    institution_name: pickString(o, ['institutionName', 'institution_name']) ?? null,
    department_id: pickString(o, ['departmentId', 'department_id']) ?? null,
    department_name: pickString(o, ['departmentName', 'department_name']) ?? null,
    bed_id: pickString(o, ['bedId', 'bed_id']) ?? null,
    bed_label: pickString(o, ['bedLabel', 'bed_label']) ?? null,
    chief_complaint: pickString(o, ['chiefComplaint', 'chief_complaint']) ?? null,
    source: pickString(o, ['source']) ?? null,
    source_label: pickString(o, ['sourceLabel', 'source_label']) ?? null,
    admitted_at: pickString(o, ['admittedAt', 'admitted_at']) ?? null,
  }
}

export function patientGenderDisplay(p: PatientRecord) {
  if (p.gender_label) return p.gender_label
  return genderLabel(p.gender)
}

export function patientDisplayName(p: PatientRecord) {
  return p.real_name || p.patient_code || String(p.id)
}

export function patientDetailFields(p: PatientRecord): { label: string; value: string }[] {
  return [
    { label: '患者编号', value: p.patient_code ?? '—' },
    { label: '姓名', value: p.real_name ?? '—' },
    { label: '性别', value: genderLabel(p.gender) },
    { label: '年龄', value: p.age != null ? `${p.age} 岁` : '—' },
    { label: '出生日期', value: p.birth_date ?? '—' },
    { label: '联系电话', value: p.phone ?? '—' },
    { label: '身份证号', value: p.id_card ?? '—' },
    { label: '住址', value: p.address ?? '—' },
    { label: '既往史', value: p.medical_history ?? '—' },
    { label: '过敏史', value: p.allergy_history ?? '—' },
    { label: '阶段', value: p.stage_label ?? p.stage ?? '—' },
    { label: '机构', value: p.institution_name ?? '—' },
    { label: '科室', value: p.department_name ?? '—' },
    { label: '床位', value: p.bed_label ?? '—' },
    { label: '主诉', value: p.chief_complaint ?? '—' },
    { label: '来源', value: p.source_label ?? p.source ?? '—' },
    { label: '入院时间', value: formatPatientTime(p.admitted_at) },
    { label: '建档时间', value: formatPatientTime(p.created_at) },
  ]
}

export function parsePatientListPayload(
  raw: unknown,
  pageSize = 20,
): {
  rows: PatientRecord[]
  meta: { current_page: number; last_page: number; total: number }
} {
  let rows: PatientRecord[] = []
  let meta = { current_page: 1, last_page: 1, total: 0 }

  if (Array.isArray(raw)) {
    rows = (raw as unknown[]).map(normalizePatient)
    meta = { current_page: 1, last_page: 1, total: rows.length }
    return { rows, meta }
  }

  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    if (Array.isArray(o.data)) rows = (o.data as unknown[]).map(normalizePatient)
    else if (Array.isArray(o.list)) rows = (o.list as unknown[]).map(normalizePatient)

    // 后端 §3.2 只返回 {total, list}，没有分页元信息，last_page 由 total/pageSize 推算
    const m = o.meta as Record<string, unknown> | undefined
    const totalRaw = m?.total ?? o.total ?? rows.length
    const total = Number(totalRaw)
    const safeTotal = Number.isFinite(total) ? total : rows.length
    const lastPageRaw = m?.last_page ?? m?.lastPage

    meta = {
      current_page: Number(m?.current_page ?? m?.pageNum ?? 1) || 1,
      last_page: Number(lastPageRaw) || Math.max(1, Math.ceil(safeTotal / pageSize)),
      total: safeTotal,
    }
  }

  return { rows, meta }
}

export function patientFromUnknown(raw: unknown): PatientRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if ('data' in o && o.data && typeof o.data === 'object' && !('patientId' in o) && !('id' in o)) {
    return patientFromUnknown(o.data)
  }
  if ('patientId' in o || 'name' in o || 'real_name' in o || 'patient_code' in o || 'id' in o) {
    return normalizePatient(o)
  }
  return null
}
