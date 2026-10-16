/**
 * /dispatch/events — 事件列表
 *
 * 页面内容由 public/assets/enhance/dispatch-vue-embed-enhance.js 注入
 *（监听 hashchange，检测 #/dispatch/events → 挂载 iframe → dispatch.html#events）
 *
 * 本组件仅负责让 React 路由命中 /dispatch/events，避免 NotFoundPage 劫持。
 * 不渲染任何 React 元素，DOM 完全交由增强脚本控制。
 */
export function DispatchEventsPage() {
  return null
}
