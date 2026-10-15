/** src-shell 统一说明：数据来自 Laravel，非 legacy scenario */
export function ApiSourceNotice({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="api-muted" style={{ margin: '0 0 8px' }}>
        数据来自 <strong>/backend-api/v1</strong>，非 index.html 演示 scenario。
      </p>
    )
  }
  return (
    <p className="api-muted api-source-notice" style={{ margin: '8px 12px 0', gridColumn: '1 / -1' }}>
      本入口为 <strong>src-shell</strong>：各页直连 Laravel API。协作三维地图请用{' '}
      <a href="/app.html">app.html</a>。像素级验收请用{' '}
      <a href="/">index.html</a>；若仍见旧演示数，请{' '}
      <a href="/?reset=1">/?reset=1</a> 后强刷。
    </p>
  )
}
