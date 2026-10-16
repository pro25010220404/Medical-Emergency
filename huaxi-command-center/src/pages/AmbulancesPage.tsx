/**
 * /ambulances — 救护车列表
 *
 * 双轨渲染：
 * 1) 优先让 public/assets/enhance/ambulances-page-enhance.js 注入 DOM（与旧版一致）；
 * 2) 当增强脚本未生效时（本组件也会触发），此 React 组件直接渲染兜底列表，
 *    CSS `body.hx-sidebar-shell.hx-page-ambulances .app-shell.hx-sidebar-ready > main:not(#hx-ambulances-page)`
 *    会隐藏 React 渲染的 <main>，让增强脚本的 #hx-ambulances-page 显示。
 */
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiGet } from '../lib/apiClient'

type AmbulanceRow = {
  id?: string
  vehicle_id?: string
  plate?: string
  status?: string
  statusLabel?: string
  org?: string
  organization?: string
  boundHospital?: string
  bound_hospital?: string
  hospital?: string
  crew?: string
  team?: string
  currentEventId?: string
  current_event_id?: string
}

const VEHICLE_STATUS_LABELS: Record<string, string> = {
  STANDBY: '待命',
  DISPATCHING: '出警中',
  ON_MISSION: '出警中',
  EN_ROUTE: '出警中',
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

function zhStatus(raw?: string, label?: string): string {
  if (label) return label
  const s = String(raw ?? '').trim()
  if (!s) return '—'
  const u = s.toUpperCase()
  if (VEHICLE_STATUS_LABELS[u]) return VEHICLE_STATUS_LABELS[u]
  if (['出警中', '现场处置', '返院途中', '转运中', '空闲中', '维护中', '不能调用'].includes(s)) return s
  return s
}

export function AmbulancesPage() {
  const { ready, authenticated } = useAuth()
  const [rows, setRows] = useState<AmbulanceRow[]>([])
  const [updatedAt, setUpdatedAt] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (!ready || !authenticated) return
    let cancelled = false
    setLoading(true)
    setError('')
    ;(async () => {
      try {
        const data = await apiGet<unknown>('/ambulances')
        if (cancelled) return
        if (Array.isArray(data)) {
          setRows(data as AmbulanceRow[])
          setUpdatedAt(new Date().toISOString())
        } else {
          setRows([])
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ready, authenticated])

  return (
    <main className="workspace screen" aria-label="救护车列表">
      <header className="workspace-heading">
        <div>
          <h2>救护车列表</h2>
          <p className="api-muted">本院绑定车辆、班组与当前出警状态 · GET /api/v1/ambulances</p>
        </div>
        <p className="api-muted">
          {rows.length} 辆 · 更新 {updatedAt ? new Date(updatedAt).toLocaleString('zh-CN', { hour12: false }) : '—'}
        </p>
      </header>

      {loading ? <p className="api-muted">正在加载…</p> : null}
      {error ? <p className="api-muted">加载失败：{error}</p> : null}

      {!loading && !error && !rows.length ? (
        <p className="api-muted">暂无车辆数据</p>
      ) : null}

      {rows.length ? (
        <div className="business-table table-scroll">
          <table>
            <thead>
              <tr>
                <th>车牌 / ID</th>
                <th>所属</th>
                <th>绑定医院</th>
                <th>班组</th>
                <th>状态</th>
                <th>关联事件</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id ?? r.vehicle_id ?? i}>
                  <td>
                    <strong>{r.plate ?? r.vehicle_id ?? r.id ?? '—'}</strong>
                    <br />
                    <small>{r.id ?? r.vehicle_id ?? ''}</small>
                  </td>
                  <td>{r.org ?? r.organization ?? '—'}</td>
                  <td>{r.boundHospital ?? r.bound_hospital ?? r.hospital ?? '—'}</td>
                  <td>{r.crew ?? r.team ?? '—'}</td>
                  <td>{zhStatus(r.status, r.statusLabel)}</td>
                  <td>{r.currentEventId ?? r.current_event_id ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  )
}
