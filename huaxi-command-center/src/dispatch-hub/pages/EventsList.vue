<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { buildHash, formatClock } from '../context'

/** GET /api/v1/emergency-events 列表项（snake_case，Laravel 分页 Style B） */
type AcceptOrg = {
  orgId?: string
  name?: string
  shortName?: string
  levelLabel?: string
}

type EmergencyEventRow = {
  id?: number
  event_code?: string
  event_source?: string
  occurred_at?: string | null
  eta?: string | null
  scene_address?: string | null
  scene_phone?: string | null
  chief?: string | null
  provisional_dx?: string | null
  triage_level?: string | null
  target_dept_name?: string | null
  patient_id?: string | null
  patient_name?: string | null
  patient_mode?: string | null
  temp_gender?: string | null
  temp_summary?: string | null
  patient?: { patientId?: string; name?: string; genderLabel?: string; age?: number } | null
  risk_level?: string | null
  event_stage?: string | null
  event_status?: string | null
  accept_org?: AcceptOrg | null
}

type PaginatedEvents = {
  data?: EmergencyEventRow[]
  meta?: { total?: number; current_page?: number; last_page?: number; per_page?: number }
}

const STATUS_FILTERS = [
  { value: '', label: '全部', query: {} as Record<string, string | number> },
  { value: 'active', label: '进行中', query: { active: 1 } },
  { value: 'STAGE_SCENE', label: '现场处置', query: { event_stage: 'STAGE_SCENE' } },
  { value: 'STAGE_ENROUTE', label: '转运途中', query: { event_stage: 'STAGE_ENROUTE' } },
] as const

const TRIAGE_LABELS: Record<string, string> = {
  TRIAGE_I: 'I级',
  TRIAGE_II: 'II级',
  TRIAGE_III: 'III级',
  TRIAGE_IV: 'IV级',
  TRIAGE_V: 'V级',
}

const STAGE_LABELS: Record<string, string> = {
  STAGE_CREATED: '已创建',
  STAGE_SCENE: '现场',
  STAGE_ENROUTE: '途中',
  STAGE_ARRIVAL: '到院',
  STAGE_CLOSED: '已关闭',
}

const RISK_LABELS: Record<string, string> = {
  RISK_HIGH: '高风险',
  RISK_MEDIUM: '中风险',
  RISK_LOW: '低风险',
}

const STATUS_LABELS: Record<string, string> = {
  EVENT_ACTIVE: '进行中',
  EVENT_CLOSED: '已关闭',
}

const PAGE_SIZE = 15

/** 列表行无 patient_name 时，按 patient_id 调 /patients/{id} 解析出的姓名缓存 */
const patientNames = ref<Record<string, string>>({})

const events = ref<EmergencyEventRow[]>([])
const total = ref(0)
const lastPage = ref(1)
const updated = ref('')
const page = ref(1)
const status = ref<string>('')
const loading = ref(false)
const error = ref('')

// 新增急救事件
const showCreate = ref(false)
const createSubmitting = ref(false)
const createError = ref('')
const createForm = ref({
  task120Id: '',
  level: 'CRITICAL',
  chiefComplaint: '',
  pickupAddress: '',
  destination: '',
  startedAt: '',
})

function resetCreateForm() {
  createForm.value = {
    task120Id: '',
    level: 'CRITICAL',
    chiefComplaint: '',
    pickupAddress: '',
    destination: '',
    startedAt: new Date().toISOString().slice(0, 16),
  }
  createError.value = ''
}

function openCreate() {
  resetCreateForm()
  showCreate.value = true
}

function closeCreate() {
  showCreate.value = false
}

async function submitCreate() {
  const f = createForm.value
  if (!f.task120Id.trim() || !f.chiefComplaint.trim()) {
    createError.value = '请填写 120 任务号和主诉'
    return
  }
  createSubmitting.value = true
  createError.value = ''
  try {
    if (!window.hxBackend?.enabled?.()) throw new Error('后端接口未连接')
    await window.hxBackend.ensureAuth()
    await window.hxBackend.post('/dispatch/events', {
      task120Id: f.task120Id.trim(),
      level: f.level,
      chiefComplaint: f.chiefComplaint.trim(),
      pickupAddress: f.pickupAddress.trim() || undefined,
      destination: f.destination.trim() || undefined,
      startedAt: f.startedAt ? new Date(f.startedAt).toISOString() : undefined,
    })
    showCreate.value = false
    page.value = 1
    await fetchPage()
  } catch (e) {
    createError.value = e instanceof Error ? e.message : String(e)
  } finally {
    createSubmitting.value = false
  }
}

const activeOnPage = computed(
  () => events.value.filter((e) => e.event_status === 'EVENT_ACTIVE').length,
)

function label(map: Record<string, string>, key?: string | null) {
  if (!key) return '—'
  return map[key] ?? key.replace(/^TRIAGE_|^STAGE_|^RISK_|^EVENT_/, '')
}

function orgName(ev: EmergencyEventRow) {
  const o = ev.accept_org
  return o?.shortName || o?.name || '—'
}

const TEMP_GENDER_LABELS: Record<string, string> = {
  GENDER_MALE: '男',
  GENDER_FEMALE: '女',
  GENDER_UNKNOWN: '未知',
}

function isTempPatient(ev: EmergencyEventRow) {
  if (ev.patient_mode === 'PATIENT_MODE_TEMP') return true
  if (ev.patient_mode === 'PATIENT_MODE_REGISTERED') return false
  return !patientBizId(ev) && !(ev.patient_name || ev.patient?.name)
}

function patientBizId(ev: EmergencyEventRow) {
  const fromNested = ev.patient?.patientId
  const fromRow = ev.patient_id != null ? String(ev.patient_id) : ''
  const id = (fromNested || fromRow).trim()
  if (!id || id === 'null' || id === 'undefined') return ''
  return id
}

function resolvedName(ev: EmergencyEventRow) {
  const biz = patientBizId(ev)
  return (biz && patientNames.value[biz]) || ''
}

function patientPrimary(ev: EmergencyEventRow) {
  if (isTempPatient(ev)) {
    return ev.temp_summary || TEMP_GENDER_LABELS[ev.temp_gender || ''] || '临时患者'
  }
  if (ev.patient_name) return ev.patient_name
  if (ev.patient?.name) return ev.patient.name
  return resolvedName(ev) || patientBizId(ev) || '已登记患者'
}

function patientSecondary(ev: EmergencyEventRow) {
  if (isTempPatient(ev)) return '临时 · 待登记'
  const biz = patientBizId(ev)
  const name = ev.patient_name || ev.patient?.name || resolvedName(ev)
  if (name && biz) return biz
  return biz || ''
}

function canLinkPatient(ev: EmergencyEventRow) {
  return !isTempPatient(ev) && !!patientBizId(ev)
}

function statusTone(text: string) {
  if (/进行|现场|途中/.test(text)) return 'dh-status--warn'
  if (/关闭/.test(text)) return 'dh-status--muted'
  return 'dh-status--ok'
}

/** 列表行缺 patient_name 时按 patient_id 逐个解析（结果缓存，换页不重复请求） */
async function resolvePatientNames(rows: EmergencyEventRow[]) {
  const ids = [
    ...new Set(
      rows
        .filter((r) => !isTempPatient(r) && !r.patient_name && !r.patient?.name)
        .map((r) => patientBizId(r))
        .filter((pid) => pid && !(pid in patientNames.value)),
    ),
  ]
  await Promise.all(
    ids.map(async (pid) => {
      try {
        // hxBackend.get 已拆 {code,data} 信封，返回的即患者对象本身
        const res = await window.hxBackend!.get<{ name?: string | null }>(
          `/patients/${encodeURIComponent(pid)}`,
        )
        patientNames.value = { ...patientNames.value, [pid]: res?.name || '' }
      } catch {
        patientNames.value = { ...patientNames.value, [pid]: '' }
      }
    }),
  )
}

async function fetchPage() {
  loading.value = true
  error.value = ''
  try {
    if (!window.hxBackend?.enabled?.()) throw new Error('后端接口未连接，请检查登录状态')
    const authed = window.hxBackend.ensureSession
      ? (await window.hxBackend.ensureSession()).ok
      : await window.hxBackend.ensureAuth(false)
    if (!authed) throw new Error('未登录或无法连接 API')

    const filter = STATUS_FILTERS.find((f) => f.value === status.value) ?? STATUS_FILTERS[0]
    const query: Record<string, string | number> = {
      page: page.value,
      per_page: PAGE_SIZE,
      ...filter.query,
    }

    const payload = await window.hxBackend.get<PaginatedEvents>('/emergency-events', query)
    const rows = Array.isArray(payload?.data) ? payload.data : []
    events.value = rows
    total.value = Number(payload?.meta?.total ?? rows.length) || 0
    lastPage.value = Number(payload?.meta?.last_page ?? 1) || 1
    if (page.value > lastPage.value) page.value = lastPage.value
    updated.value = formatClock(new Date().toISOString())
    // 列表行不携带姓名：后台异步按 patient_id 解析，不阻塞表格渲染
    void resolvePatientNames(rows)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    events.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function pickStatus(value: string) {
  if (status.value === value) return
  status.value = value
  page.value = 1
  void fetchPage()
}

function goPage(next: number) {
  const target = Math.min(lastPage.value, Math.max(1, next))
  if (target === page.value) return
  page.value = target
  void fetchPage()
}

function liveHref(ev: EmergencyEventRow) {
  const code = ev.event_code || String(ev.id ?? '')
  return buildHash('live', {
    eventId: code,
    task120Id: code,
    chiefComplaint: ev.chief || '',
  })
}

function registerHref(ev: EmergencyEventRow) {
  const code = ev.event_code || String(ev.id ?? '')
  return buildHash('register', {
    eventId: code,
    task120Id: code,
    chiefComplaint: ev.chief || '',
  })
}

function patientAppHref(ev: EmergencyEventRow) {
  const id = patientBizId(ev)
  if (!id) return ''
  return `/app.html#/patient/${encodeURIComponent(id)}`
}

onMounted(fetchPage)
</script>

<template>
  <div class="dh-page">
    <section class="dh-page-head">
      <div>
        <h2 class="dh-h2">事件列表</h2>
      </div>
      <p class="dh-stats">
        共 {{ total }} 条 · 本页进行中 {{ activeOnPage }} · 更新 {{ updated || '—' }}
        <button class="dh-date-btn" type="button" :disabled="loading" @click="fetchPage">刷新</button>
      </p>
    </section>

    <section class="dh-panel">
      <div class="dh-date-toolbar" role="tablist" aria-label="事件状态筛选">
        <button
          v-for="f in STATUS_FILTERS"
          :key="f.value"
          class="dh-date-btn"
          :class="{ 'dh-date-btn--active': status === f.value }"
          type="button"
          :disabled="loading"
          @click="pickStatus(f.value)"
        >
          {{ f.label }}
        </button>
        <span style="flex: 1"></span>
        <button class="dh-date-btn dh-date-btn--primary" type="button" @click="openCreate">
          新增急救事件
        </button>
      </div>
    </section>

    <p v-if="error" class="dh-day-empty">
      事件列表加载失败：{{ error }}
      <button class="dh-date-btn" type="button" @click="fetchPage">重试</button>
    </p>
    <p v-else-if="!loading && !events.length" class="dh-day-empty">暂无急救事件记录。</p>

    <section v-show="events.length" class="dh-panel dh-table-wrap">
      <table class="dh-table">
        <thead>
          <tr>
            <th>事件编号</th>
            <th>主诉 / 拟诊</th>
            <th>现场地址</th>
            <th>受理机构</th>
            <th>分诊</th>
            <th>阶段</th>
            <th>风险</th>
            <th>发生时间</th>
            <th>预计到院</th>
            <th>患者</th>
            <th class="col-act">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ev in events" :key="ev.event_code || ev.id">
            <td>
              <strong>{{ ev.event_code || '—' }}</strong>
              <br />
              <small>{{ label(STATUS_LABELS, ev.event_status) }}</small>
            </td>
            <td>
              {{ ev.chief || '—' }}
              <br v-if="ev.provisional_dx" />
              <small v-if="ev.provisional_dx">{{ ev.provisional_dx }}</small>
            </td>
            <td>{{ ev.scene_address || '—' }}</td>
            <td>
              {{ orgName(ev) }}
              <br v-if="ev.target_dept_name" />
              <small v-if="ev.target_dept_name">{{ ev.target_dept_name }}</small>
            </td>
            <td>{{ label(TRIAGE_LABELS, ev.triage_level) }}</td>
            <td>
              <span class="dh-status" :class="statusTone(label(STAGE_LABELS, ev.event_stage))">
                {{ label(STAGE_LABELS, ev.event_stage) }}
              </span>
            </td>
            <td>{{ label(RISK_LABELS, ev.risk_level) }}</td>
            <td>{{ ev.occurred_at ? formatClock(ev.occurred_at) : '—' }}</td>
            <td>{{ ev.eta ? formatClock(ev.eta) : '—' }}</td>
            <td class="dh-patient-cell">
              <template v-if="canLinkPatient(ev)">
                <a :href="patientAppHref(ev)" target="_top" class="dh-patient-link">
                  <strong>{{ patientPrimary(ev) }}</strong>
                </a>
                <small v-if="patientSecondary(ev)">{{ patientSecondary(ev) }}</small>
              </template>
              <template v-else>
                <span class="dh-patient-temp">{{ patientPrimary(ev) }}</span>
                <small>{{ patientSecondary(ev) }}</small>
              </template>
            </td>
            <td class="dh-row-actions">
              <a :href="liveHref(ev)">出警处理</a>
              <a :href="registerHref(ev)">登记</a>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="dh-panel dh-date-toolbar" aria-label="分页">
      <button class="dh-date-btn" type="button" :disabled="loading || page <= 1" @click="goPage(page - 1)">
        上一页
      </button>
      <span>第 {{ page }} / {{ lastPage }} 页</span>
      <button
        class="dh-date-btn"
        type="button"
        :disabled="loading || page >= lastPage"
        @click="goPage(page + 1)"
      >
        下一页
      </button>
    </section>

    <!-- 新增急救事件对话框 -->
    <Teleport to="body">
      <div v-if="showCreate" class="dh-modal-mask" @click.self="closeCreate">
        <div class="dh-modal" role="dialog" aria-modal="true" aria-labelledby="create-event-title">
          <header class="dh-modal-head">
            <h3 id="create-event-title">新增急救事件</h3>
            <button class="dh-modal-close" type="button" @click="closeCreate">×</button>
          </header>
          <div class="dh-modal-body">
            <label class="dh-field">
              <span class="dh-field-label">120 任务号 *</span>
              <input v-model="createForm.task120Id" type="text" placeholder="如 120-20261016-001" />
            </label>
            <label class="dh-field">
              <span class="dh-field-label">事件级别</span>
              <select v-model="createForm.level">
                <option value="CRITICAL">紧急（CRITICAL）</option>
                <option value="URGENT">危重（URGENT）</option>
                <option value="NORMAL">普通（NORMAL）</option>
              </select>
            </label>
            <label class="dh-field">
              <span class="dh-field-label">主诉 *</span>
              <input v-model="createForm.chiefComplaint" type="text" placeholder="如 胸痛伴呼吸急促" />
            </label>
            <label class="dh-field">
              <span class="dh-field-label">接车地址</span>
              <input v-model="createForm.pickupAddress" type="text" placeholder="如 某路某号" />
            </label>
            <label class="dh-field">
              <span class="dh-field-label">目的地</span>
              <input v-model="createForm.destination" type="text" placeholder="如 县人民医院急诊科" />
            </label>
            <label class="dh-field">
              <span class="dh-field-label">开始时间</span>
              <input v-model="createForm.startedAt" type="datetime-local" />
            </label>
            <p v-if="createError" class="dh-form-error">{{ createError }}</p>
          </div>
          <footer class="dh-modal-foot">
            <button class="dh-date-btn" type="button" :disabled="createSubmitting" @click="closeCreate">取消</button>
            <button class="dh-date-btn dh-date-btn--primary" type="button" :disabled="createSubmitting" @click="submitCreate">
              {{ createSubmitting ? '提交中…' : '确认创建' }}
            </button>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>
