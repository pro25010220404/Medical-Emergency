import type { ComponentType } from 'react'
import { APP_ROUTES } from '../routes/meta'
import { ConsultRoomPage } from './consult/ConsultRoomPage'
import { createLegacyPage } from './createLegacyPage'
import { createScaffoldPage } from './createScaffoldPage'
import { AmbulancesPage } from './AmbulancesPage'
import { DispatchEventsPage } from './DispatchEventsPage'
import { DispatchListPage } from './DispatchListPage'
import { EmergencyEventDetailPage } from './episode/EmergencyEventDetailPage'
import { HomePage } from './HomePage'
import { PatientDetailPage } from './patients/PatientDetailPage'
import { PatientRegisterPage } from './patients/PatientRegisterPage'
import { PatientsListPage } from './patients/PatientsListPage'

const BUSINESS_PAGES = new Set(['/patients', '/patient/:id', '/register', '/episode/:id'])

/**
 * 仅 src-shell.html + main.tsx 使用本表。
 * 演示入口 app.html 使用 vendor bundle，勿改为加载 src。
 */
/** 有定制实现的路由，不走 createLegacyPage 自动生成 */
const CUSTOM_PAGES = new Set(['/room/:token', '/dispatch/list', '/dispatch/events', '/ambulances'])

const legacyByPath = Object.fromEntries(
  APP_ROUTES.filter(
    (r) =>
      r.path !== '/' &&
      r.path !== '/login' &&
      r.path !== '/phone' &&
      !BUSINESS_PAGES.has(r.path) &&
      !CUSTOM_PAGES.has(r.path),
  ).map((r) => [r.path, createLegacyPage(r)]),
) as Record<string, ComponentType>

const phonePage = createScaffoldPage(APP_ROUTES.find((r) => r.path === '/phone')!)

export const routeElements: Record<string, ComponentType> = {
  '/': HomePage,
  /** 与 command-map-page-enhance 一致：全屏地图仍渲染首页 WebGL，仅 body 样式不同 */
  '/map': HomePage,
  '/phone': phonePage,
  '/patients': PatientsListPage,
  '/patient/:id': PatientDetailPage,
  '/register': PatientRegisterPage,
  '/episode/:id': EmergencyEventDetailPage,
  // 会诊室走定制页：在后端数据面板之上增加远程会诊入会入口
  '/room/:token': ConsultRoomPage,
  // 以下三路由由 enhancement 脚本注入 DOM：返回 null 避免 NotFoundPage
  '/dispatch/list': DispatchListPage,
  '/dispatch/events': DispatchEventsPage,
  '/ambulances': AmbulancesPage,
  ...legacyByPath,
}
