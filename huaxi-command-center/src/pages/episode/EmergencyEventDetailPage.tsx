import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiSourceNotice } from '../../components/ApiSourceNotice'
import { DashboardPanel } from '../../components/home/DashboardPanel'
import { useAuth } from '../../context/AuthContext'
import { apiGet } from '../../lib/apiClient'
import { formatPatientTime, genderBadgeClass, genderLabel } from '../../lib/patientDisplay'
import type {
  ControlRecord,
  CriticalValue,
  EmergencyEventDetail,
  TrendPrediction,
  VitalTrendPoint,
} from '../../types/emergencyEvent'

const METRIC_LABELS: Record<string, string> = {
  heartRate: '心率',
  spo2: '血氧',
  resp: '呼吸',
  temp: '体温',
  systolic: '收缩压',
  diastolic: '舒张压',
}

function metricLabel(key?: string | null) {
  if (!key) return '—'
  return METRIC_LABELS[key] ?? key
}

/** 沿用 original.css 的 .badge.red/.amber/.teal/.muted 色系 */
function severityBadgeClass(severity?: string | null) {
  const s = String(severity || '').toLowerCase()
  if (s === 'critical') return 'badge red'
  if (s === 'severe') return 'badge amber'
  if (s === 'stable') return 'badge teal'
  return 'badge muted'
}

function levelBadgeClass(level?: string | null) {
  const l = String(level || '').toLowerCase()
  if (l === 'urgent') return 'badge red'
  if (l === 'warning') return 'badge amber'
  return 'badge muted'
}

function fmt(v?: number | string | null, unit = '') {
  if (v == null || v === '') return '—'
  return unit ? `${v} ${unit}` : String(v)
}

function VitalCard({ detail }: { detail: EmergencyEventDetail }) {
  const vital = detail.overview?.vital
  if (!vital) return <p className="api-muted">暂无体征数据</p>
  const items: { label: string; value: string }[] = [
    { label: '心率', value: fmt(vital.heartRate, '次/分') },
    { label: '血氧', value: fmt(vital.spo2, '%') },
    { label: '呼吸', value: fmt(vital.resp, '次/分') },
    { label: '体温', value: fmt(vital.temp, '℃') },
    {
      label: '血压',
      value:
        vital.systolic != null && vital.diastolic != null
          ? `${vital.systolic}/${vital.diastolic} mmHg`
          : '—',
    },
    { label: 'NEWS 评分', value: vital.news != null ? `${vital.news}（${vital.newsLabel ?? '—'}）` : '—' },
  ]
  return (
    <>
      <div className="ev-vital-grid">
        {items.map((it) => (
          <div key={it.label} className={`ev-vital-cell${it.label === 'NEWS 评分' && vital.alert ? ' is-alert' : ''}`}>
            <span className="ev-vital-label">{it.label}</span>
            <strong className="ev-vital-value">{it.value}</strong>
          </div>
        ))}
      </div>
      <p className="api-muted" style={{ marginTop: 8 }}>
        测量时间 {formatPatientTime(vital.measuredAt)}
        {vital.alert ? ' · 预警中' : ''}
      </p>
    </>
  )
}

function CriticalValueTable({ rows }: { rows: CriticalValue[] }) {
  if (!rows.length) return <p className="api-muted">暂无危急值</p>
  return (
    <div className="business-table table-scroll">
      <table>
        <thead>
          <tr>
            <th>编号</th>
            <th>项目</th>
            <th>结果</th>
            <th>参考范围</th>
            <th>危急范围</th>
            <th>标本</th>
            <th>级别</th>
            <th>状态</th>
            <th>报告时间</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.criticalNo ?? i}>
              <td>{r.criticalNo ?? '—'}</td>
              <td>{r.itemName ?? '—'}</td>
              <td>{r.resultValue ?? '—'}</td>
              <td>{r.refRange ?? '—'}</td>
              <td>{r.criticalRange ?? '—'}</td>
              <td>{r.specimen ?? '—'}</td>
              <td>
                <span className={levelBadgeClass(r.level)}>{r.levelLabel ?? r.level ?? '—'}</span>
              </td>
              <td>{r.statusLabel ?? r.status ?? '—'}</td>
              <td>{formatPatientTime(r.reportedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ControlRecordList({ rows }: { rows: ControlRecord[] }) {
  if (!rows.length) return <p className="api-muted">暂无管控记录</p>
  return (
    <div className="ev-control-list">
      {rows.map((r, i) => (
        <article key={r.warningNo ?? i} className="ev-control-item">
          <header className="ev-control-head">
            <strong>{r.title ?? '预警'}</strong>
            <span className={levelBadgeClass(r.level)}>{r.levelLabel ?? r.level ?? '—'}</span>
            <span className="api-muted">{r.statusLabel ?? r.status ?? '—'}</span>
          </header>
          <p className="api-muted">
            {metricLabel(r.metric)} 当前值 {fmt(r.currentValue)} · 发生 {formatPatientTime(r.occurredAt)}
          </p>
          {r.records?.length ? (
            <ul className="ev-control-steps">
              {r.records.map((s, j) => (
                <li key={j}>
                  <span className="ev-control-stage">{s.stage ?? '处置'}</span>
                  <span>{s.note ?? '—'}</span>
                  <span className="api-muted">
                    {s.actorName ?? s.actorId ?? ''} {formatPatientTime(s.actedAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      ))}
    </div>
  )
}

function VitalTrendTable({ rows }: { rows: VitalTrendPoint[] }) {
  if (!rows.length) return <p className="api-muted">暂无趋势数据</p>
  return (
    <div className="business-table table-scroll">
      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>心率</th>
            <th>血氧</th>
            <th>呼吸</th>
            <th>体温</th>
            <th>血压</th>
            <th>NEWS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={p.at ?? i}>
              <td>{formatPatientTime(p.at)}</td>
              <td>{fmt(p.heartRate)}</td>
              <td>{fmt(p.spo2)}</td>
              <td>{fmt(p.resp)}</td>
              <td>{fmt(p.temp)}</td>
              <td>
                {p.systolic != null && p.diastolic != null ? `${p.systolic}/${p.diastolic}` : '—'}
              </td>
              <td>{fmt(p.news)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PredictionList({ rows }: { rows: TrendPrediction[] }) {
  if (!rows.length) return <p className="api-muted">暂无预测</p>
  return (
    <ul className="ev-predict-list">
      {rows.map((p, i) => (
        <li key={p.id ?? i}>
          <strong>{metricLabel(p.metric)}</strong> 当前 {fmt(p.currentValue)} → 预测{' '}
          {fmt(p.predictedValue)}
          {p.withinMinutes != null ? `（${p.withinMinutes} 分钟内）` : ''}
          {p.note ? <span className="api-muted"> · {p.note}</span> : null}
        </li>
      ))}
    </ul>
  )
}

export function EmergencyEventDetailPage() {
  const { ready, authenticated } = useAuth()
  const { id } = useParams()
  const [detail, setDetail] = useState<EmergencyEventDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!ready || !authenticated) return
    if (!id) {
      setError('缺少事件 ID')
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const raw = await apiGet<EmergencyEventDetail>(`/emergency-events/${encodeURIComponent(id)}`)
        if (!raw || typeof raw !== 'object') throw new Error('响应格式无效')
        if (!cancelled) setDetail(raw)
      } catch (e) {
        if (!cancelled) {
          setDetail(null)
          setError(e instanceof Error ? e.message : '加载失败')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, ready, authenticated])

  const baseFields: { label: string; value: string }[] = detail
    ? [
        { label: '患者编号', value: detail.patientId ?? '—' },
        { label: '性别', value: detail.genderLabel ?? genderLabel(detail.gender) },
        { label: '年龄', value: detail.age != null ? `${detail.age} 岁` : '—' },
        { label: '身份证号', value: detail.idCard ?? '—' },
        { label: '联系电话', value: detail.phone ?? '—' },
        { label: '机构', value: detail.institutionName ?? '—' },
        { label: '科室', value: detail.departmentName ?? '—' },
        { label: '阶段', value: detail.stageLabel ?? detail.stage ?? '—' },
        { label: '主诉', value: detail.chiefComplaint ?? '—' },
        { label: '症状', value: detail.symptoms?.length ? detail.symptoms.join('、') : '—' },
        { label: '备注', value: detail.notes ?? '—' },
        { label: '来源', value: detail.sourceLabel ?? detail.source ?? '—' },
        { label: '床位', value: detail.bed?.label ?? detail.overview?.bedLabel ?? '—' },
        { label: '入院时间', value: formatPatientTime(detail.admittedAt) },
        { label: '建档时间', value: formatPatientTime(detail.createdAt) },
        { label: '更新时间', value: formatPatientTime(detail.updatedAt) },
      ]
    : []

  const nursing = detail?.nursingRecords ?? []
  const medications = detail?.medicationRecords ?? []
  const labs = detail?.labRecords ?? []
  const courses = detail?.courseRecords ?? []
  const trend = detail?.auxiliaryAnalysis?.vitalTrend ?? []
  const predictions = detail?.auxiliaryAnalysis?.predictions ?? []
  const consultation = detail?.consultation
  const prehospitalEntries = Object.entries(detail?.prehospital ?? {}).filter(
    ([, v]) => v != null && v !== '',
  )

  return (
    <main className="workspace screen">
      <ApiSourceNotice compact />
      <header className="workspace-heading">
        <div>
          <h2>{detail?.name ?? '急救事件详情'}</h2>
          <p className="api-muted">
            GET /emergency-events/{id ?? ''} · {detail?.stageLabel ?? detail?.stage ?? ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {detail?.overview?.severityLabel ? (
            <span className={severityBadgeClass(detail.overview.severity)}>
              {detail.overview.severityLabel}
            </span>
          ) : null}
          {detail ? (
            <span className={genderBadgeClass(detail.gender)}>
              {detail.genderLabel ?? genderLabel(detail.gender)}
            </span>
          ) : null}
        </div>
      </header>

      {loading ? <p className="api-muted">正在加载…</p> : null}
      {error ? (
        <p className="api-muted">
          {error.includes('404') ? '未找到该事件（远程可能无此 ID）。' : error}
        </p>
      ) : null}

      {detail && !loading ? (
        <>
          <DashboardPanel title="基本信息">
            <div className="business-table">
              <table>
                <tbody>
                  {baseFields.map((f) => (
                    <tr key={f.label}>
                      <th style={{ width: '28%' }}>{f.label}</th>
                      <td>{f.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DashboardPanel>

          <DashboardPanel
            title={`床旁体征 · ${detail.overview?.bedLabel ?? detail.bed?.label ?? '—'}`}
          >
            <VitalCard detail={detail} />
          </DashboardPanel>

          <DashboardPanel title="危急值">
            <CriticalValueTable rows={detail.criticalValues ?? []} />
          </DashboardPanel>

          <DashboardPanel title="预警管控">
            <ControlRecordList rows={detail.controlRecords ?? []} />
          </DashboardPanel>

          <DashboardPanel title="护理记录">
            {nursing.length ? (
              <div className="business-table table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>类型</th>
                      <th>标题</th>
                      <th>内容</th>
                      <th>记录人</th>
                      <th>时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nursing.map((n, i) => (
                      <tr key={n.id ?? i}>
                        <td>{n.kind ?? '—'}</td>
                        <td>{n.title ?? '—'}</td>
                        <td>{n.text ?? '—'}</td>
                        <td>{n.actorName ?? n.actorId ?? '—'}</td>
                        <td>{formatPatientTime(n.at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="api-muted">暂无护理记录</p>
            )}
          </DashboardPanel>

          <DashboardPanel title="辅助分析">
            <h3 className="ev-sub-title">体征趋势</h3>
            <VitalTrendTable rows={trend} />
            <h3 className="ev-sub-title" style={{ marginTop: 12 }}>
              趋势预测
            </h3>
            <PredictionList rows={predictions} />
          </DashboardPanel>

          {medications.length || labs.length || courses.length ? (
            <DashboardPanel title="其他记录">
              {medications.length ? (
                <p className="api-muted">用药记录 {medications.length} 条</p>
              ) : null}
              {labs.length ? <p className="api-muted">检验记录 {labs.length} 条</p> : null}
              {courses.length ? <p className="api-muted">病程记录 {courses.length} 条</p> : null}
            </DashboardPanel>
          ) : null}

          {prehospitalEntries.length ? (
            <DashboardPanel title="院前信息">
              <div className="business-table">
                <table>
                  <tbody>
                    {prehospitalEntries.map(([k, v]) => (
                      <tr key={k}>
                        <th style={{ width: '28%' }}>{k}</th>
                        <td>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DashboardPanel>
          ) : null}

          {consultation?.doctorName || consultation?.token ? (
            <DashboardPanel title="会诊信息">
              <div className="business-table">
                <table>
                  <tbody>
                    <tr>
                      <th style={{ width: '28%' }}>会诊医生</th>
                      <td>{consultation.doctorName ?? '—'}</td>
                    </tr>
                    <tr>
                      <th>会诊单号</th>
                      <td>{consultation.requestId ?? '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {consultation.token ? (
                <p style={{ marginTop: 8 }}>
                  <Link className="btn-ghost" to={`/room/${encodeURIComponent(consultation.token)}`}>
                    进入会诊室
                  </Link>
                </p>
              ) : null}
            </DashboardPanel>
          ) : null}
        </>
      ) : null}

      <p className="api-muted" style={{ marginTop: 12 }}>
        <Link to="/patients">返回患者列表</Link>
        {' · '}
        <Link to="/">指挥中心</Link>
      </p>
    </main>
  )
}
