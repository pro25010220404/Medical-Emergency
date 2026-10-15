export type DispatchEvent = {
  id: string
  task120Id: string
  level: string
  chiefComplaint: string
  pickupAddress: string
  destination: string
  vehicleId: string
  vehiclePlate: string
  status: string
  startedAt: string
  etaHospitalMinutes: number
  etaPatientMinutes?: number
  scorePlan?: string
  treatPlan?: string
}

export type PatientForm = {
  eventId: string
  task120Id: string
  vehicleId: string
  vehiclePlate: string
  name: string
  gender: string
  age: string
  phone: string
  chiefComplaint: string
}

export type TabId = 'live' | 'events' | 'ambulances' | 'register'

const DRAFT_KEY = 'huaxi-dispatch-register-draft'

export function emptyForm(): PatientForm {
  return {
    eventId: '',
    task120Id: '',
    vehicleId: '',
    vehiclePlate: '',
    name: '',
    gender: '男',
    age: '',
    phone: '',
    chiefComplaint: '',
  }
}

export function hashQuery(): URLSearchParams {
  const raw = location.hash.replace(/^#/, '')
  const q = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : ''
  return new URLSearchParams(q)
}

export function tabFromHash(): TabId | 'monitor' {
  const id = location.hash.replace(/^#\/?/, '').split('?')[0]
  if (id === 'events' || id === 'ambulances' || id === 'register' || id === 'monitor') return id
  return 'live'
}

export function buildHash(
  tab: TabId,
  ctx: Partial<Pick<PatientForm, 'eventId' | 'task120Id' | 'vehicleId' | 'vehiclePlate' | 'chiefComplaint'>> = {},
) {
  const q = new URLSearchParams()
  if (ctx.eventId) q.set('event', ctx.eventId)
  if (ctx.task120Id) q.set('task', ctx.task120Id)
  if (ctx.vehicleId) q.set('vehicle', ctx.vehicleId)
  if (ctx.vehiclePlate) q.set('plate', ctx.vehiclePlate)
  if (ctx.chiefComplaint) q.set('complaint', ctx.chiefComplaint)
  const s = q.toString()
  return s ? `#${tab}?${s}` : `#${tab}`
}

export function contextFromHash() {
  const q = hashQuery()
  return {
    eventId: q.get('event') || '',
    task120Id: q.get('task') || '',
    vehicleId: q.get('vehicle') || '',
    vehiclePlate: q.get('plate') || '',
    chiefComplaint: q.get('complaint') || '',
  }
}

export function loadDraft(): PatientForm | null {
  const raw = localStorage.getItem(DRAFT_KEY)
  if (!raw) return null
  try {
    return { ...emptyForm(), ...JSON.parse(raw) }
  } catch {
    return null
  }
}

export async function savePatient(form: PatientForm, submit: boolean): Promise<string> {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(form))
  const id = form.task120Id || form.eventId || `DRAFT-${Date.now()}`
  const task = form.task120Id || form.eventId || id
  const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

  if (submit && window.hxBackend?.enabled?.()) {
    try {
      await window.hxBackend.ensureAuth()
      await window.hxBackend.post('/dispatch/patients', {
        name: form.name,
        gender: form.gender === '女' ? 'FEMALE' : 'MALE',
        age: form.age ? Number(form.age) : undefined,
        phone: form.phone,
        chiefComplaint: form.chiefComplaint,
        task120Id: form.task120Id,
        eventId: form.eventId,
        vehicleId: form.vehicleId,
        vehiclePlate: form.vehiclePlate,
        isDraft: 0,
      })
      return `已提交登记 · 后端 POST /dispatch/patients · 任务 ${task}`
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return `后端提交失败：${msg}（草稿仍保留在本地）`
    }
  }

  if (submit) {
    localStorage.setItem(
      `huaxi-dispatch-patient-${id}`,
      JSON.stringify({ ...form, savedAt: new Date().toISOString() }),
    )
  }
  return submit
    ? `已提交登记（本地演示）· 任务 ${task}`
    : `草稿已保存 · ${time} · 任务 ${task || '未填'}`
}

export type ConsultLaunchInput = Partial<
  Pick<PatientForm, 'task120Id' | 'eventId' | 'vehicleId' | 'vehiclePlate' | 'chiefComplaint' | 'name'>
>

/** 缺任务号或主诉时不允许发起会诊 */
export function consultLaunchBlockReason(ctx: ConsultLaunchInput): string | null {
  const task = (ctx.task120Id || ctx.eventId || '').trim()
  if (!task) return '请先选择出警任务或填写 120 任务号，再发起远程会诊。'
  if (!(ctx.chiefComplaint || '').trim()) return '请填写主诉（可从左侧任务带入），再发起远程会诊。'
  return null
}

type ConsultDialogOpts = {
  variant?: 'alert' | 'confirm'
  title?: string
  body?: string
  lead?: string
  confirmText?: string
  cancelText?: string
}

declare global {
  interface Window {
    __hxConsultDialog?: (opts: ConsultDialogOpts) => Promise<boolean>
  }
}

function consultDialogHost(): ((opts: ConsultDialogOpts) => Promise<boolean>) | null {
  try {
    const top = window.top ?? window
    if (top !== window && typeof top.__hxConsultDialog === 'function') {
      return top.__hxConsultDialog.bind(top)
    }
  } catch {
    /* cross-origin */
  }
  if (typeof window.__hxConsultDialog === 'function') return window.__hxConsultDialog
  return null
}

async function consultDialog(opts: ConsultDialogOpts): Promise<boolean> {
  const host = consultDialogHost()
  if (host) return host(opts)
  if (opts.variant === 'alert') {
    window.alert([opts.body, opts.lead].filter(Boolean).join('\n\n'))
    return true
  }
  const msg = [opts.body, opts.lead].filter(Boolean).join('\n\n')
  return window.confirm(msg || '确认？')
}

export async function confirmConsultLaunchAsync(ctx: ConsultLaunchInput): Promise<boolean> {
  const block = consultLaunchBlockReason(ctx)
  if (block) {
    await consultDialog({
      variant: 'alert',
      title: '暂无法发起远程会诊',
      body: block,
      confirmText: '知道了',
    })
    return false
  }
  if (!(ctx.name || '').trim()) {
    return consultDialog({
      variant: 'confirm',
      title: '发起远程会诊',
      body: '建议先保存草稿或填写姓名，便于会诊队列关联患者。',
      lead: '仍要现在发起远程会诊吗？',
      confirmText: '仍要发起',
      cancelText: '返回填写',
    })
  }
  return true
}

/** @deprecated 使用 confirmConsultLaunchAsync */
export function confirmConsultLaunch(ctx: ConsultLaunchInput): boolean {
  const block = consultLaunchBlockReason(ctx)
  if (block) {
    window.alert(block)
    return false
  }
  if (!(ctx.name || '').trim()) {
    return window.confirm('建议先保存草稿或填写姓名。\n\n仍要现在发起远程会诊吗？')
  }
  return true
}

/** 出警列表嵌在 app.html iframe 内时，须在顶层窗口打开主站，避免整页套娃 */
export function isDispatchEmbedded(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const q = new URLSearchParams(location.hash.split('?')[1] || '')
    if (q.get('embed') === '1') return true
    return window.parent !== window
  } catch {
    return false
  }
}

export function navigateToAppHref(href: string) {
  const path = href.startsWith('/') ? href : `/${href}`
  const url = `${location.origin}${path}`
  const hashIdx = path.indexOf('#')
  const hashPart = hashIdx >= 0 ? path.slice(hashIdx) : ''
  const topWin = window.top ?? window

  if (isDispatchEmbedded() && topWin !== window) {
    try {
      const onApp =
        /app\.html$/i.test(topWin.location.pathname) ||
        topWin.location.pathname.endsWith('/app.html')
      if (hashPart && onApp) {
        const target = topWin.location.pathname + topWin.location.search + hashPart
        if (topWin.location.pathname + topWin.location.search + topWin.location.hash !== target) {
          topWin.location.assign(target)
        } else {
          topWin.dispatchEvent(new HashChangeEvent('hashchange'))
        }
        return
      }
    } catch {
      /* fall through */
    }
    topWin.location.href = url
    return
  }
  if (hashPart && /app\.html$/i.test(location.pathname)) {
    location.assign(location.pathname + location.search + hashPart)
    return
  }
  window.location.href = url
}

export async function goConsultationAsync(ctx: ConsultLaunchInput) {
  if (!(await confirmConsultLaunchAsync(ctx))) return
  navigateToAppHref(consultHref(ctx))
}

export function goConsultation(ctx: ConsultLaunchInput) {
  void goConsultationAsync(ctx)
}

export function consultHref(
  ctx: Partial<Pick<PatientForm, 'task120Id' | 'vehicleId' | 'vehiclePlate' | 'chiefComplaint'>> = {},
) {
  const q = new URLSearchParams()
  if (ctx.task120Id) q.set('task', ctx.task120Id)
  if (ctx.vehiclePlate) q.set('plate', ctx.vehiclePlate)
  if (ctx.vehicleId) q.set('vehicle', ctx.vehicleId)
  if (ctx.chiefComplaint) q.set('complaint', ctx.chiefComplaint)
  const s = q.toString()
  return s ? `/app.html#/consultations?${s}&launch=1` : '/app.html#/consultations?tab=grassroots'
}

/** 本地日历日 YYYY-MM-DD（按 startedAt / updatedAt 的本地时区） */
export function eventLocalDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDateLabel(ymd: string) {
  if (!ymd) return '当日'
  const d = new Date(`${ymd}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ymd
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
}

function mergeEventPlates(events: DispatchEvent[], amb: { ambulances?: Array<{ currentEventId?: string; plate?: string }> } | null) {
  const plates = new Map<string, string>()
  for (const a of amb?.ambulances ?? []) {
    if (a?.currentEventId && a?.plate) plates.set(a.currentEventId, a.plate)
  }
  return events.map((ev) => ({
    ...ev,
    vehiclePlate: ev.vehiclePlate || plates.get(ev.id) || '',
  }))
}

export async function loadEvents(): Promise<{ updatedAt: string; activeCount: number; events: DispatchEvent[] }> {
  const [live, history, amb] = await Promise.all([
    fetch('/api/dispatch-live.json', { cache: 'no-store' }).then((r) => r.json()),
    fetch('/api/dispatch-events-history.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .catch(() => ({ events: [] })),
    fetch('/api/dispatch-ambulances.json', { cache: 'no-store' })
      .then((r) => r.json())
      .catch(() => null),
  ])
  const merged = [...((live.events ?? []) as DispatchEvent[]), ...((history.events ?? []) as DispatchEvent[])]
  const byId = new Map<string, DispatchEvent>()
  for (const ev of merged) {
    if (ev?.id) byId.set(ev.id, ev)
  }
  const events = mergeEventPlates([...byId.values()], amb).sort(
    (a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''),
  )
  return { updatedAt: live.updatedAt, activeCount: live.activeCount, events }
}

export function filterEventsByDate(events: DispatchEvent[], ymd: string) {
  if (!ymd) return events
  return events.filter((ev) => eventLocalDate(ev.startedAt) === ymd)
}

export function todayLocalDate() {
  return eventLocalDate(new Date().toISOString())
}

/** 默认选浏览器「今天」；仅 URL 带 date= 时用指定日 */
export function defaultListDate(_events: DispatchEvent[], _updatedAt: string, hashDate: string) {
  if (hashDate && /^\d{4}-\d{2}-\d{2}$/.test(hashDate)) return hashDate
  return todayLocalDate()
}

/** 演示数据里最近一条出警所在日（今天无数据时可点「最近有记录」） */
export function latestEventDate(events: DispatchEvent[], updatedAt: string) {
  const fromUpdate = eventLocalDate(updatedAt)
  if (fromUpdate && events.some((ev) => eventLocalDate(ev.startedAt) === fromUpdate)) return fromUpdate
  return eventLocalDate(events[0]?.startedAt) || todayLocalDate()
}

export function replaceHashQuery(patch: (q: URLSearchParams) => void) {
  const tab = tabFromHash()
  const id = tab === 'monitor' ? 'live' : tab
  const q = hashQuery()
  patch(q)
  const s = q.toString()
  const next = s ? `#${id}?${s}` : `#${id}`
  if (location.hash !== next) history.replaceState(null, '', next)
}

export function formatClock(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function statusTone(status: string) {
  if (status.includes('出警')) return 'run'
  if (status.includes('现场') || status.includes('处置')) return 'scene'
  if (status.includes('待命')) return 'idle'
  if (status.includes('返院')) return 'run'
  return 'run'
}

const LEVEL_LABELS: Record<string, string> = {
  RISK_HIGH: '高风险',
  RISK_MEDIUM: '中风险',
  RISK_LOW: '低风险',
  TRIAGE_I: 'Ⅰ 级',
  TRIAGE_II: 'Ⅱ 级',
  TRIAGE_III: 'Ⅲ 级',
  TRIAGE_IV: 'Ⅳ 级',
}

export function levelLabel(level: string) {
  if (!level) return '—'
  return LEVEL_LABELS[level] ?? level
}

const STATUS_LABELS: Record<string, string> = {
  STAGE_CREATED: '已接警',
  STAGE_ENROUTE: '出警中',
  STAGE_SCENE: '现场处置',
  STAGE_TRANSPORT: '转运中',
  STAGE_CLOSED: '已结束',
  STANDBY: '待命',
  DISPATCHING: '出警中',
  EN_ROUTE: '出警中',
  ON_MISSION: '出警中',
  ON_SCENE: '现场处置',
  RETURNING: '返院途中',
  TRANSPORT: '转运中',
  AVAILABLE: '空闲中',
  IDLE: '空闲中',
  MAINTENANCE: '维护中',
  OFFLINE: '维护中',
  UNAVAILABLE: '不能调用',
  DISABLED: '不能调用',
}

export function statusLabel(status: string) {
  if (!status) return '—'
  return STATUS_LABELS[status] ?? status
}

export function etaText(minutes?: number | null) {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes) || minutes <= 0) return '—'
  return `${minutes} 分钟`
}

const CHANNEL_LABELS: Record<string, string> = {
  CHANNEL_120: '120 接入',
  CHANNEL_NORMAL: '普通接入',
}

export function channelLabel(channel?: string) {
  if (!channel) return ''
  return CHANNEL_LABELS[channel] ?? channel
}

export function vehicleLabel(plate?: string | null) {
  return plate && plate.trim() ? plate : '待派车'
}
