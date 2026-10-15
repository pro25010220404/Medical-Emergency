import { useEffect, useState } from 'react'

const TIER = ['一级', '二级', '基层'] as const

import { nodesFromCountyPayload, type CountyCollabNode } from '../../lib/countyCollabNodes'

type Node = CountyCollabNode

type Props = {
  loading?: boolean
  error?: string
  payload?: unknown
}

export { nodesFromCountyPayload }

export function MapCollabPanel({ loading, error, payload }: Props) {
  const nodes = payload ? nodesFromCountyPayload(payload) : []
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mapFullPage, setMapFullPage] = useState(() =>
    document.body.classList.contains('hx-page-map-only'),
  )

  useEffect(() => {
    const onSelect = (ev: Event) => {
      const detail = (ev as CustomEvent<{ id?: string } | null>).detail
      setSelectedId(detail?.id ? String(detail.id) : null)
    }
    window.addEventListener('hx-map-node-select', onSelect)
    return () => window.removeEventListener('hx-map-node-select', onSelect)
  }, [])

  useEffect(() => {
    const mainMap = document.querySelector('.dashboard-center .main-map')
    if (!mainMap) return
    mainMap.classList.toggle('map-nodes-open', open)
    return () => mainMap.classList.remove('map-nodes-open')
  }, [open])

  useEffect(() => {
    const onMapPage = (ev: Event) => {
      const active = !!(ev as CustomEvent<{ active?: boolean }>).detail?.active
      if (active) {
        setOpen(false)
        document.querySelector('.dashboard-center .main-map')?.classList.remove('map-nodes-open')
      }
      setMapFullPage((prev) => (prev === active ? prev : active))
    }
    window.addEventListener('hx-map-page', onMapPage)
    return () => window.removeEventListener('hx-map-page', onMapPage)
  }, [])

  return (
    <>
      <button
        type="button"
        className="map-med-tab"
        aria-expanded={open}
        aria-label="协作节点"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        <span className="map-med-tab-label">协作节点</span>
        <span className="map-med-tab-count">{loading ? '…' : nodes.length}</span>
      </button>
      <div
        className="map-med-backdrop"
        role="presentation"
        onClick={() => setOpen(false)}
        onKeyDown={undefined}
      />
      <aside className="map-med-sidepanel" aria-label="协作节点一览">
        <header className="map-med-side-head">
          <strong>协作节点</strong>
          <button type="button" className="map-med-close" aria-label="收起" onClick={() => setOpen(false)}>
            ×
          </button>
        </header>
        <p className="map-med-side-tip">数据来自县域协作 API · 点击地图院区可查看详情</p>
        {error ? (
          <p className="api-muted" style={{ padding: 8 }}>
            {error}
          </p>
        ) : null}
        <div className="map-med-side-list">
          {nodes.map((node) => {
            const tier = Math.min(2, Math.max(0, Number(node.tier ?? 0)))
            return (
              <button
                key={String(node.id ?? node.name)}
                type="button"
                className={`map-med-row map-collab-row${selectedId && String(node.id) === selectedId ? ' active' : ''}`}
                onClick={() => {
                  if (node.id) {
                    window.dispatchEvent(
                      new CustomEvent('hx-map-node-focus', { detail: { id: String(node.id) } }),
                    )
                  }
                }}
              >
                <span className={`map-med-tier t${tier}`}>{TIER[tier]}</span>
                <span className="map-med-row-name" title={node.name}>
                  {node.name ?? '—'}
                </span>
                <span className="map-med-row-stat">
                  <em>急诊</em>
                  <strong className={(node.er ?? 0) >= 5 ? 'warn' : ''}>{node.er ?? '—'}</strong>
                </span>
                <span className="map-med-row-stat">
                  <em>空床</em>
                  <strong>{node.bedsFree ?? '—'}</strong>
                </span>
                <span className={`map-med-row-dot ${node.tight ? 'busy' : ''}`} />
              </button>
            )
          })}
          {!loading && !error && !nodes.length ? (
            <p className="api-muted" style={{ padding: 8 }}>
              暂无带坐标的机构节点
            </p>
          ) : null}
        </div>
      </aside>
    </>
  )
}
