<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { fetchGisCollab, subscribeGisCollab } from './api'
import GisMap from './components/GisMap.vue'
import { resolveMapThemeId } from '../mapTheme'
import { TIER_LABEL } from './constants'
import type { CollabNode, DispatchVehicleMarker, GisCollabResponse, RegionKey } from './types'
import { loadGisUiPrefs, saveGisUiPrefs, type GisUiPrefs } from './uiPrefs'

const REGION_HINT: Record<RegionKey, string> = {
  dafang: '县级牵头 · 乡镇 / 基层节点向上转诊',
  weiyuan: '县级医院 + 乡镇 / 基层 · 叠加 120 在途车辆 GPS',
}

const region = ref<RegionKey>('weiyuan')
const ui = ref<GisUiPrefs>(loadGisUiPrefs())
const selectedId = ref<string | null>('wy-01')
const payload = ref<GisCollabResponse | null>(null)
const loadError = ref('')
const vehicles = ref<DispatchVehicleMarker[]>([])
const updatedAt = ref('')

function toggleUi(key: keyof GisUiPrefs) {
  ui.value = { ...ui.value, [key]: !ui.value[key] }
  saveGisUiPrefs(ui.value)
}

function applyReportLayout() {
  ui.value = { leftPanel: false, legend: true, erCard: true }
  saveGisUiPrefs(ui.value)
}

function resetLayout() {
  ui.value = { leftPanel: true, legend: true, erCard: true }
  saveGisUiPrefs(ui.value)
}

const regionData = computed(() => payload.value?.[region.value])
const nodes = computed(() => regionData.value?.nodes ?? [])
const links = computed(() => regionData.value?.links ?? [])
const erToday = computed(() => regionData.value?.erToday ?? 0)

const selectedNode = computed(() => nodes.value.find((n) => n.id === selectedId.value) ?? null)

const mapVehicles = computed(() => (region.value === 'weiyuan' ? vehicles.value : []))

const isDarkMap = computed(() => resolveMapThemeId('light') !== 'light')

const upstreamLinks = computed(() => {
  if (!selectedId.value) return []
  return links.value.filter((l) => l.from === selectedId.value || l.to === selectedId.value)
})

function tierDotClass(tier: number) {
  return `tier-dot t${tier}`
}

function selectNode(id: string) {
  selectedId.value = id
}

function onTab(next: RegionKey) {
  if (next === region.value) return
  region.value = next
  selectedId.value = next === 'weiyuan' ? 'wy-01' : 'df-01'
}

async function loadVehicles() {
  try {
    const data = await fetch('/api/vehicles-gps.json', { cache: 'no-store' }).then((r) => r.json())
    updatedAt.value = data.updatedAt || ''
    vehicles.value = (data.vehicles || []).map(
      (v: { id: string; plate: string; lng: number; lat: number; status: string; etaMinutes: number | null }) => ({
        id: v.id,
        plate: v.plate,
        lng: v.lng,
        lat: v.lat,
        status: v.status,
        etaMinutes: v.etaMinutes,
      }),
    )
  } catch {
    vehicles.value = []
  }
}

function nodeLabel(id: string) {
  return nodes.value.find((n) => n.id === id)?.name ?? id
}

function describeNode(n: CollabNode) {
  if (n.tier === 0) return '县域牵头 / 上级接收转诊'
  if (n.tier === 1) return '乡镇协作 · 可向上发起会诊'
  return '基层网点 · 采集与转运起点'
}

let unsub: (() => void) | null = null
let vehicleTimer: ReturnType<typeof setInterval> | null = null

function applyDeepLink() {
  const params = new URLSearchParams(location.search)
  const r = params.get('region')
  if (r === 'dafang' || r === 'weiyuan') {
    region.value = r
    const focus = params.get('focus')
    if (focus) selectedId.value = focus
    else selectedId.value = r === 'weiyuan' ? 'wy-01' : 'df-01'
  }
}

onMounted(async () => {
  applyDeepLink()
  try {
    payload.value = await fetchGisCollab()
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : '加载失败'
  }
  unsub = subscribeGisCollab((data) => {
    payload.value = data
  })
  await loadVehicles()
  vehicleTimer = setInterval(loadVehicles, 10000)
})

onUnmounted(() => {
  unsub?.()
  if (vehicleTimer) clearInterval(vehicleTimer)
})

watch(region, () => {
  if (!nodes.value.some((n) => n.id === selectedId.value)) {
    selectedId.value = nodes.value[0]?.id ?? null
  }
})
</script>

<template>
  <div class="gis-viewport" :class="{ 'gis-dark': isDarkMap }">
    <div class="gis-stage">
      <header class="gis-header">
        <div class="gis-header-left">
          <p class="gis-kicker">县域医疗协同</p>
          <h1>GIS 指挥大屏</h1>
          <p class="gis-region-hint">{{ REGION_HINT[region] }}</p>
        </div>
        <div class="gis-header-tools">
          <nav class="gis-tabs" aria-label="区域切换">
            <button type="button" :class="{ active: region === 'dafang' }" @click="onTab('dafang')">
              大方参考
            </button>
            <button type="button" :class="{ active: region === 'weiyuan' }" @click="onTab('weiyuan')">
              威远协作
            </button>
          </nav>
          <div class="gis-header-actions">
            <div class="gis-chip-row">
              <span class="gis-demo-tag">实时数据</span>
              <button type="button" class="gis-pref primary" @click="applyReportLayout">汇报布局</button>
              <button type="button" class="gis-pref" @click="resetLayout">恢复布局</button>
            </div>
            <div class="gis-chip-row">
              <button type="button" class="gis-pref" @click="toggleUi('leftPanel')">
                {{ ui.leftPanel ? '隐藏列表' : '显示列表' }}
              </button>
              <button type="button" class="gis-pref" @click="toggleUi('legend')">
                {{ ui.legend ? '隐藏图例' : '显示图例' }}
              </button>
              <button type="button" class="gis-pref" @click="toggleUi('erCard')">
                {{ ui.erCard ? '隐藏急诊数' : '显示急诊数' }}
              </button>
            </div>
            <div class="gis-chip-row">
              <a class="gis-pref" href="/dispatch.html#live">120 院前</a>
              <a class="gis-pref" :href="`/smart-city.html?theme=${resolveMapThemeId('light')}`">3D 态势</a>
              <a class="gis-pref" href="/#/">返回指挥中枢</a>
            </div>
          </div>
        </div>
      </header>

      <main class="gis-body" :class="{ noPanel: !ui.leftPanel }">
        <aside v-show="ui.leftPanel" class="gis-panel" aria-label="协作节点列表">
          <p class="gis-panel-tip">点击节点与地图联动；连线表示转诊 / 协作流量。</p>
          <p v-if="loadError" class="gis-error">{{ loadError }}</p>
          <ul v-else class="gis-list">
            <li v-for="node in nodes" :key="node.id">
              <button
                type="button"
                class="gis-row"
                :class="{ selected: selectedId === node.id }"
                @click="selectNode(node.id)"
              >
                <span class="gis-row-main">
                  <span :class="tierDotClass(node.tier)" aria-hidden="true" />
                  <span class="gis-name">{{ node.name }}</span>
                  <span class="gis-tier">{{ TIER_LABEL[node.tier] }}协作</span>
                </span>
                <span class="gis-row-sub">
                  急诊 {{ node.er }} ｜ 空床 {{ node.bedsFree }}
                  <em v-if="node.tight" class="tight">床位紧张</em>
                </span>
              </button>
            </li>
          </ul>
          <section v-if="selectedNode" class="gis-detail">
            <h2 class="gis-detail-title">{{ selectedNode.name }}</h2>
            <p class="gis-detail-role">{{ describeNode(selectedNode) }}</p>
            <dl class="gis-detail-dl">
              <div><dt>层级</dt><dd>{{ TIER_LABEL[selectedNode.tier] }}协作节点</dd></div>
              <div><dt>急诊</dt><dd>{{ selectedNode.er }}</dd></div>
              <div><dt>空床</dt><dd>{{ selectedNode.bedsFree }}</dd></div>
              <div><dt>床位</dt><dd>{{ selectedNode.tight ? '紧张' : '正常' }}</dd></div>
            </dl>
            <p v-if="upstreamLinks.length" class="gis-detail-links">
              关联连线：
              <span v-for="(l, i) in upstreamLinks" :key="`${l.from}-${l.to}`">
                {{ i ? '；' : '' }}{{ nodeLabel(l.from) }} → {{ nodeLabel(l.to) }}
              </span>
            </p>
            <a
              v-if="region === 'weiyuan' && selectedNode.tier === 0"
              class="gis-detail-cta"
              href="/dispatch.html#live"
            >
              打开 120 院前工作台
            </a>
          </section>
        </aside>

        <section class="gis-map-wrap">
          <GisMap
            v-if="payload && !loadError"
            :region="region"
            :nodes="nodes"
            :links="links"
            :selected-id="selectedId"
            :vehicles="mapVehicles"
            @select="selectNode"
          />
          <div v-show="ui.legend" class="gis-legend" aria-label="图例">
            <span class="leg"><i class="o t0" />一级 · 县级</span>
            <span class="leg mid">·</span>
            <span class="leg"><i class="o t1" />二级 · 乡镇</span>
            <span class="leg mid">·</span>
            <span class="leg"><i class="o t2" />基层</span>
            <template v-if="region === 'weiyuan' && mapVehicles.length">
              <span class="leg mid">·</span>
              <span class="leg"><i class="o veh" />120 车辆（{{ mapVehicles.length }}）</span>
            </template>
          </div>
          <div v-show="ui.erCard" class="gis-er-today">
            <span class="label">今日急诊数</span>
            <span class="value">{{ erToday }}</span>
          </div>
          <div v-if="region === 'weiyuan' && mapVehicles.length" class="gis-veh-chip">
            院前 {{ mapVehicles.length }} 车 · GPS 实时
            <span v-if="updatedAt" class="muted">更新 {{ updatedAt.slice(11, 16) }}</span>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<style scoped>
.gis-error {
  color: #ef4444;
  font-size: 13px;
  padding: 12px;
}
</style>
