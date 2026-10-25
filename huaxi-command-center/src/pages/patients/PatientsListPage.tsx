import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiSourceNotice } from '../../components/ApiSourceNotice'
import { DashboardPanel } from '../../components/home/DashboardPanel'
import { useAuth } from '../../context/AuthContext'
import { apiGet } from '../../lib/apiClient'
import {
  formatPatientTime,
  genderBadgeClass,
  parsePatientListPayload,
  patientDisplayName,
  patientGenderDisplay,
} from '../../lib/patientDisplay'
import type { PatientRecord, PatientStageStat } from '../../types/patient'

/** 与后端 §3.2 pageSize 保持一致，用于推算总页数 */
const PAGE_SIZE = 30

export function PatientsListPage() {
  const { ready, authenticated } = useAuth()
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<PatientRecord[]>([])
  const [stages, setStages] = useState<PatientStageStat[]>([])
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadStages = useCallback(async () => {
    try {
      const raw = await apiGet<{ stages?: PatientStageStat[] }>('/patients/stages')
      const list = Array.isArray(raw?.stages) ? raw.stages : []
      setStages(list)
    } catch {
      setStages([])
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams()
      // 后端 §3.2 分页入参为 pageNum / pageSize
      qs.set('pageSize', String(PAGE_SIZE))
      qs.set('pageNum', String(page))
      if (keyword.trim()) qs.set('keyword', keyword.trim())
      if (stageFilter) qs.set('stage', stageFilter)
      const raw = await apiGet<unknown>(`/patients?${qs}`)
      const parsed = parsePatientListPayload(raw, PAGE_SIZE)
      setRows(parsed.rows)
      setLastPage(parsed.meta.last_page)
      setTotal(parsed.meta.total)
      void loadStages()
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [keyword, page, stageFilter, loadStages])

  useEffect(() => {
    if (!ready || !authenticated) return
    void loadStages()
    void load()
  }, [load, loadStages, ready, authenticated])

  function onStageClick(value: string) {
    setStageFilter((cur) => (cur === value ? '' : value))
    setPage(1)
  }

  function onSearch(e: FormEvent) {
    e.preventDefault()
    if (page === 1) void load()
    else setPage(1)
  }

  return (
    <main className="workspace screen">
      <ApiSourceNotice compact />
      <header className="workspace-heading">
        <div>
          <h2>患者列表</h2>
          <p className="api-muted">快速登记（急救医生）· GET /api/v1/patients · 阶段 /patients/stages</p>
        </div>
        <Link to="/register" className="btn-primary">
          院前登记
        </Link>
      </header>

      <form className="filter-bar" onSubmit={onSearch}>
        <label className="field">
          <span>关键词</span>
          <input
            type="search"
            placeholder="姓名 / 编号 / 电话 / 身份证"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </label>
        <button type="submit" className="btn-ghost" disabled={loading}>
          查询
        </button>
        <span className="api-muted">
          共 {total} 条 · 第 {page}/{lastPage} 页
        </span>
      </form>

      {stages.length ? (
        <div className="filter-bar" role="group" aria-label="病程阶段筛选">
          <button
            type="button"
            className={`btn-ghost${stageFilter === '' ? ' active' : ''}`}
            onClick={() => onStageClick('')}
          >
            全部
          </button>
          {stages.map((s) => (
            <button
              key={s.value}
              type="button"
              className={`btn-ghost${stageFilter === s.value ? ' active' : ''}`}
              onClick={() => onStageClick(s.value)}
            >
              {s.label}
              <span className="badge muted" style={{ marginLeft: 6 }}>
                {s.count}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <DashboardPanel title={`患者台账 · 共 ${total} 人`}>
        {loading ? <p className="api-muted">正在加载…</p> : null}
        {error ? <p className="api-muted">{error}</p> : null}
        {!loading && !error && !rows.length ? (
          <p className="api-muted">暂无患者数据，可先通过院前登记创建。</p>
        ) : null}
        {rows.length ? (
          <div className="business-table table-scroll">
            <table>
              <thead>
                <tr>
                  <th>患者编号</th>
                  <th>姓名</th>
                  <th>性别</th>
                  <th>年龄</th>
                  <th>阶段</th>
                  <th>机构</th>
                  <th>科室</th>
                  <th>床位</th>
                  <th>主诉</th>
                  <th>来源</th>
                  <th>电话</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr
                    key={String(p.id)}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/patient/${encodeURIComponent(String(p.id))}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') navigate(`/patient/${encodeURIComponent(String(p.id))}`)
                    }}
                    tabIndex={0}
                    role="link"
                  >
                    <td>{p.patient_code ?? '—'}</td>
                    <td>
                      <strong>{patientDisplayName(p)}</strong>
                    </td>
                    <td>
                      <span className={genderBadgeClass(p.gender)}>{patientGenderDisplay(p)}</span>
                    </td>
                    <td>{p.age != null ? `${p.age}` : '—'}</td>
                    <td>
                      <span className="badge muted">{p.stage_label ?? p.stage ?? '—'}</span>
                    </td>
                    <td>{p.institution_name ?? '—'}</td>
                    <td>{p.department_name ?? '—'}</td>
                    <td>{p.bed_label ?? '—'}</td>
                    <td title={p.chief_complaint ?? undefined}>
                      {p.chief_complaint
                        ? p.chief_complaint.length > 24
                          ? `${p.chief_complaint.slice(0, 24)}…`
                          : p.chief_complaint
                        : '—'}
                    </td>
                    <td>{p.source_label ?? p.source ?? '—'}</td>
                    <td>{p.phone ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {lastPage > 1 ? (
          <div className="form-footer" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn-ghost"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={page >= lastPage || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </button>
          </div>
        ) : null}
      </DashboardPanel>

      <p className="api-muted" style={{ marginTop: 12 }}>
        <Link to="/">返回指挥中心</Link>
      </p>
    </main>
  )
}
