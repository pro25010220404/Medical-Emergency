/**
 * GET /v1/emergency-events/{id} 患者 360° 详情契约（camelCase）。
 * 2026-10 后端最新字段：基本信息 + overview 体征 + 护理/用药/检验/病程/危急值/管控记录 + 辅助分析。
 */

export type EmergencyVital = {
  heartRate?: number | null
  spo2?: number | null
  resp?: number | null
  temp?: number | null
  systolic?: number | null
  diastolic?: number | null
  news?: number | null
  newsLabel?: string | null
  alert?: boolean
  measuredAt?: string | null
}

export type EmergencyOverview = {
  bedId?: string | null
  bedLabel?: string | null
  severity?: string | null
  severityLabel?: string | null
  vital?: EmergencyVital | null
}

export type NursingRecord = {
  id?: string | number
  kind?: string | null
  title?: string | null
  text?: string | null
  at?: string | null
  actorId?: string | null
  actorName?: string | null
}

export type MedicationRecord = {
  id?: string | number
  drugName?: string | null
  dose?: string | null
  route?: string | null
  status?: string | null
  statusLabel?: string | null
  at?: string | null
  actorName?: string | null
  [key: string]: unknown
}

export type LabRecord = {
  id?: string | number
  itemName?: string | null
  resultValue?: string | null
  unit?: string | null
  refRange?: string | null
  reportedAt?: string | null
  [key: string]: unknown
}

export type CourseRecord = {
  id?: string | number
  title?: string | null
  text?: string | null
  at?: string | null
  actorName?: string | null
  [key: string]: unknown
}

export type CriticalValue = {
  criticalNo?: string | null
  itemName?: string | null
  resultValue?: string | null
  unit?: string | null
  refRange?: string | null
  criticalRange?: string | null
  specimen?: string | null
  level?: string | null
  levelLabel?: string | null
  status?: string | null
  statusLabel?: string | null
  reportedAt?: string | null
}

export type ControlRecordStep = {
  stage?: string | null
  note?: string | null
  actorId?: string | null
  actorName?: string | null
  actedAt?: string | null
}

export type ControlRecord = {
  warningNo?: string | null
  title?: string | null
  metric?: string | null
  currentValue?: number | null
  level?: string | null
  levelLabel?: string | null
  status?: string | null
  statusLabel?: string | null
  occurredAt?: string | null
  records?: ControlRecordStep[]
}

export type VitalTrendPoint = {
  at?: string | null
  heartRate?: number | null
  spo2?: number | null
  resp?: number | null
  temp?: number | null
  systolic?: number | null
  diastolic?: number | null
  news?: number | null
}

export type TrendPrediction = {
  id?: string | null
  patientLabel?: string | null
  metric?: string | null
  currentValue?: number | null
  predictedValue?: number | null
  withinMinutes?: number | null
  note?: string | null
}

export type AuxiliaryAnalysis = {
  vitalTrend?: VitalTrendPoint[]
  predictions?: TrendPrediction[]
}

export type EmergencyEventDetail = {
  patientId?: string | null
  name?: string | null
  gender?: string | null
  genderLabel?: string | null
  age?: number | null
  idCard?: string | null
  phone?: string | null
  institutionId?: string | null
  institutionName?: string | null
  departmentId?: string | null
  departmentName?: string | null
  assignedTo?: unknown[]
  stage?: string | null
  stageLabel?: string | null
  chiefComplaint?: string | null
  symptoms?: string[]
  notes?: string | null
  source?: string | null
  sourceLabel?: string | null
  admittedAt?: string | null
  bed?: { bedId?: string | null; label?: string | null } | null
  prehospital?: Record<string, unknown>
  consultation?: {
    token?: string | null
    doctorId?: string | null
    doctorName?: string | null
    requestId?: string | null
  } | null
  createdAt?: string | null
  updatedAt?: string | null

  overview?: EmergencyOverview | null
  nursingRecords?: NursingRecord[]
  medicationRecords?: MedicationRecord[]
  criticalValues?: CriticalValue[]
  labRecords?: LabRecord[]
  courseRecords?: CourseRecord[]
  controlRecords?: ControlRecord[]
  auxiliaryAnalysis?: AuxiliaryAnalysis | null
}
