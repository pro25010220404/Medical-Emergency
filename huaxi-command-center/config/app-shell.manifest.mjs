/**
 * app.html 装配清单（单一事实来源）
 * 运行: npm run sync:app-html
 */
export const APP_SHELL_VERSION = {
  themeLight: '20261015org1',
  sidebarLayout: '44',
  mapPresentation: '20261015map18',
  reactBundle: 'app-shell-3',
}

export const styles = [
  { href: '/assets/vendor/index-BRuArrdm.css', crossorigin: true },
  { href: `/assets/theme/theme-light.css?v=${APP_SHELL_VERSION.themeLight}` },
  { href: `/assets/theme/sidebar-shell-layout.css?v=${APP_SHELL_VERSION.sidebarLayout}` },
  { href: `/assets/theme/map-presentation.css?v=${APP_SHELL_VERSION.mapPresentation}` },
]

/** 顺序敏感：bridge 前仅 config；boot / hxEnhance 需早于 enhance */
export const backendScripts = [
  { src: '/assets/backend/app-embed-guard.js?v=1' },
  { src: '/assets/backend/startup-loading-enhance.js?v=1' },
  { src: '/assets/backend/boot-recover.js?v=2' },
  { src: '/assets/backend/backend-api-config.js?v=3' },
  { src: '/assets/backend/backend-auth-gate.js?v=3' },
  { src: '/assets/backend/backend-api-bridge.js?v=15' },
  { src: '/assets/backend/backend-api-catalog.js' },
  { src: '/assets/backend/backend-api-catalog-gaps.js' },
  { src: '/assets/backend/backend-api-bindings-merge.js' },
  { src: '/assets/backend/backend-api-samples.js' },
  { src: '/assets/backend/backend-full-sync.js?v=2' },
  { src: '/assets/backend/backend-patient-scenario-map.js?v=1' },
  { src: '/assets/backend/backend-scenario-live-merge.js?v=3' },
  { src: '/assets/backend/backend-write-proxy.js' },
  { src: '/assets/backend/backend-api-write-dock.js', defer: true },
]

export const reactEntry = {
  comment:
    '演示 UI：预编译 React bundle（完整业务页）；API 调试壳见 src-shell.html → /src/main.tsx',
  src: `/assets/vendor/index-BA_IO3dC.js?v=${APP_SHELL_VERSION.reactBundle}`,
  type: 'module',
  crossorigin: true,
}

/** 地图与集成（在 bundle 之后、业务 enhance 之前） */
export const mapScripts = [
  { src: '/assets/enhance/map-threemaps-enhance.js', defer: true },
  { src: '/assets/enhance/map-light-3d-enhance.js', defer: true },
  { src: '/assets/enhance/map-hospital-glb-enhance.js?v=33', type: 'module' },
  { src: '/assets/backend/app-integrated-nav.js?v=3' },
  { src: '/assets/enhance/monitoring-off-enhance.js?v=1', defer: true },
  { src: '/assets/enhance/dispatch-hub-bridge.js?v=6', defer: true },
  { src: '/assets/enhance/nav-ia-enhance.js?v=14', defer: true },
  { src: '/assets/enhance/dispatch-subnav-parity-enhance.js?v=2', defer: true },
  { src: '/assets/enhance/sidebar-shell-enhance.js?v=38', defer: true },
  { src: '/assets/enhance/breadcrumb-nav-enhance.js?v=15', defer: true },
  { src: '/assets/enhance/command-map-page-enhance.js?v=14', defer: true },
]

export const enhanceScripts = [
  { src: '/assets/enhance/ambulances-page-enhance.js?v=1', defer: true },
  { src: '/assets/enhance/patients-list-api-enhance.js?v=5', defer: true },
  { src: '/assets/enhance/dispatch-vue-embed-enhance.js?v=3', defer: true },
  { src: '/assets/enhance/consult-launch-dialog-enhance.js?v=2', defer: true },
  { src: '/assets/enhance/consult-episode-nav.js?v=4', defer: true },
  { src: '/assets/enhance/register-consult-flow-enhance.js?v=8', defer: true },
  { src: '/assets/enhance/register-create-event-enhance.js?v=1', defer: true },
  { src: '/assets/enhance/dispatch-consult-bridge-enhance.js?v=6', defer: true },
  { src: '/assets/enhance/consult-nav-fix-enhance.js?v=3', defer: true },
  { src: '/assets/enhance/dispatch-ui-enhance.js?v=2', defer: true },
  { src: '/assets/enhance/dispatch-camera-room-enhance.js?v=2', defer: true },
  { src: '/assets/enhance/dr-ui-enhance.js', defer: true },
  { src: '/assets/enhance/dr-video-enhance.js', defer: true },
  { src: '/assets/enhance/consult-stage-enhance.js', defer: true },
  { src: '/assets/enhance/consult-admission-enhance.js?v=1', defer: true },
  { src: '/assets/enhance/home-panel-enhance.js?v=2', defer: true },
  { src: '/assets/enhance/home-dashboard-more-modal-enhance.js?v=3', defer: true },
  { src: '/assets/enhance/home-dashboard-nav-enhance.js?v=6', defer: true },
  { src: '/assets/enhance/warning-demo-enhance.js?v=3', defer: true },
  { src: '/assets/enhance/warning-messages-enhance.js?v=1', defer: true },
  { src: '/assets/enhance/device-binding-enhance.js?v=4', defer: true },
  { src: '/assets/enhance/device-bind-modal-enhance.js?v=3', defer: true },
  { src: '/assets/enhance/care-link-enhance.js?v=5', defer: true },
  { src: '/assets/enhance/qc-sla-enhance.js', defer: true },
  { src: '/assets/enhance/qc-task-sla-enhance.js', defer: true },
  { src: '/assets/enhance/video-placeholder-enhance.js?v=1', defer: true },
  // 单床页已由 vendor bundle 直连后端渲染，bed-page-layout-enhance 已停用
  { src: '/assets/enhance/bed-video-fill-enhance.js?v=3', defer: true },
  { src: '/assets/enhance/critical-bed-summary-enhance.js?v=4', defer: true },
  { src: '/assets/enhance/ward-video-enhance.js?v=3', defer: true },
  { src: '/assets/enhance/town-video-fill-enhance.js?v=2', defer: true },
  { src: '/assets/enhance/consult-context-enhance.js?v=10', defer: true },
  { src: '/assets/enhance/consult-list-polish-enhance.js?v=5', defer: true },
  { src: '/assets/enhance/consult-queue-actions-enhance.js?v=1', defer: true },
  { src: '/assets/enhance/consult-workbench-enhance.js?v=38', defer: true },
  { src: '/assets/enhance/consult-patient-pick-enhance.js?v=11', defer: true },
  { src: '/assets/enhance/grassroots-consult-enhance.js?v=11', defer: true },
  { src: '/assets/enhance/nav-back-enhance.js?v=2', defer: true },
  { src: '/assets/enhance/grassroots-demo-enhance.js', defer: true },
  { src: '/assets/enhance/ia-query-views-enhance.js?v=16', defer: true },
  { src: '/assets/enhance/dept-code-cn-enhance.js?v=1', defer: true },
  { src: '/assets/enhance/organizations-flow-enhance.js?v=9', defer: true },
  { src: '/assets/enhance/plate-three-backend-enhance.js?v=6', defer: true },
  { src: '/assets/enhance/medical-quality-backend-enhance.js?v=4', defer: true },
  { src: '/assets/enhance/demo-compliance-enhance.js?v=2', defer: true },
  { src: '/assets/enhance/meeting-room-enhance.js?v=5', defer: true },
  { src: '/assets/enhance/backend-spa-wire-enhance.js', defer: true },
  { src: '/assets/enhance/auth-logout-enhance.js?v=1', defer: true },
  { src: '/assets/enhance/transfer-classify-enhance.js?v=1', defer: true },
  { src: '/assets/enhance/transfer-api-enhance.js?v=2', defer: true },
]
