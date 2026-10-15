<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { buildHash, etaText, formatClock, statusTone, vehicleLabel } from '../context'

/** 后端 GET /dispatch/events 列表项（camelCase 契约，见 backend DispatchEventService::item） */
type BackendEvent = {
  eventId: string
  task120Id: string
  level?: string
  levelLabel?: string
  chiefComplaint?: string
  pickupAddress?: string
  destination?: string
  vehicleId?: string | null
  vehiclePlate?: string | null
  status?: string
  statusLabel?: string
  startedAt?: string | null
  etaHospitalMinutes?: number | null
}

type BackendEventsPayload = {
  updatedAt?: string
  activeCount?: number
  total?: number
  list?: BackendEvent[]
  pageNum?: number
  pageSize?: number
}

const STATUS_FILTERS = [
  { value: '', label: '全部' },
  { value: 'DISPATCHING', label: '出警中' },
  { value: 'ON_SCENE', label: '现场处置' },
  { value: 'RETURNING', label: '返院途中' },
] as const

const FALLBACK_LEVEL_LABELS: Record<string, string> = {
  CRITICAL: '重症',
  ACUTE: '急症',
  GENERAL: '一般',
}

const PAGE_SIZE = 20

const events = ref<BackendEvent[]>([])
const total = ref(0)
const activeCount = ref(0)
const updated = ref('')
const page = ref(1)
const status = ref<string>('')
const loading = ref(false)
const error = ref('')

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

function levelText(ev: BackendEvent) {
  if (ev.levelLabel) return ev.levelLabel
  return FALLBACK_LEVEL_LABELS[ev.level ?? ''] ?? ev.level ?? '—'
}

function statusText(ev: BackendEvent) {
  return ev.statusLabel || ev.status || '—'
}

async function fetchPage() {
  loading.value = true
  error.value = ''
  try {
    if (!window.hxBackend?.enabled?.()) throw new Error('后端接口未连接，请检查登录状态')
    await window.hxBackend.ensureAuth()
    const query: Record<string, string | number> = { pageNum: page.value, pageSize: PAGE_SIZE }
    if (status.value) query.status = status.value
    const data = await window.hxBackend.get<BackendEventsPayload>('/dispatch/events', query)
    events.value = Array.isArray(data?.list) ? data.list : []
    total.value = Number(data?.total ?? events.value.length) || 0
    activeCount.value = Number(data?.activeCount ?? 0) || 0
    updated.value = data?.updatedAt ? formatClock(data.updatedAt) : formatClock(new Date().toISOString())
    if (page.value > totalPages.value) page.value = totalPages.value
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
  const target = Math.min(totalPages.value, Math.max(1, next))
  if (target === page.value) return
  page.value = target
  void fetchPage()
}

function liveHref(ev: BackendEvent) {
  return buildHash('live', {
    eventId: ev.eventId,
    task120Id: ev.task120Id,
    vehicleId: ev.vehicleId || '',
    vehiclePlate: ev.vehiclePlate || '',
    chiefComplaint: ev.chiefComplaint || '',
  })
}

function registerHref(ev: BackendEvent) {
  return buildHash('register', {
    eventId: ev.eventId,
    task120Id: ev.task120Id,
    vehicleId: ev.vehicleId || '',
    vehiclePlate: ev.vehiclePlate || '',
    chiefComplaint: ev.chiefComplaint || '',
  })
}

onMounted(fetchPage)
</script>

<template>
  <div class="dh-page">
    <section class="dh-page-head">
      <div>
        <h2 class="dh-h2">事件列表</h2>
        <p class="dh-lead">120 接警急救事件 · 数据来自后端事件接口。</p>
      </div>
      <p class="dh-stats">
        共 {{ total }} 条 · 处置中 {{ activeCount }} · 更新 {{ updated || '—' }}
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
      </div>
    </section>

    <p v-if="error" class="dh-day-empty">
      事件列表加载失败：{{ error }}
      <button class="dh-date-btn" type="button" @click="fetchPage">重试</button>
    </p>
    <p v-else-if="!loading && !events.length" class="dh-day-empty">当日暂无急救事件记录。</p>

    <section v-show="events.length" class="dh-panel dh-table-wrap">
      <table class="dh-table">
        <thead>
          <tr>
            <th>事件编号</th>
            <th class="col-task">任务号</th>
            <th>主诉</th>
            <th>车辆</th>
            <th>状态</th>
            <th>出车时间</th>
            <th>预计到院</th>
            <th class="col-act">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ev in events" :key="ev.eventId || ev.task120Id">
            <td><strong>{{ ev.eventId || '—' }}</strong></td>
            <td>
              <strong>{{ ev.task120Id || '—' }}</strong><br />
              <small>{{ levelText(ev) }} · {{ ev.pickupAddress || '—' }}</small>
            </td>
            <td>{{ ev.chiefComplaint || '—' }}</td>
            <td>{{ vehicleLabel(ev.vehiclePlate) }}</td>
            <td>
              <span class="dh-status" :class="statusTone(statusText(ev))">{{ statusText(ev) }}</span>
            </td>
            <td>{{ ev.startedAt ? formatClock(ev.startedAt) : '—' }}</td>
            <td>{{ etaText(ev.etaHospitalMinutes) }}</td>
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
      <span>第 {{ page }} / {{ totalPages }} 页</span>
      <button
        class="dh-date-btn"
        type="button"
        :disabled="loading || page >= totalPages"
        @click="goPage(page + 1)"
      >
        下一页
      </button>
    </section>
  </div>
</template>
