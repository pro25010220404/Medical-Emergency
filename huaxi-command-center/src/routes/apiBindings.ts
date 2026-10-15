/** 与 public/assets/backend/backend-api-catalog.js → HX_ROUTE_BINDINGS 同步 */

export type ApiBinding = { method: 'GET' | 'POST' | 'PUT' | 'DELETE'; path: string }

export const ROUTE_API_BINDINGS: Record<string, ApiBinding[]> = {
  '/': [
    { method: 'GET', path: '/auth/me' },
    { method: 'GET', path: '/dispatch-live' },
    { method: 'GET', path: '/ambulances' },
    { method: 'GET', path: '/vehicles/gps' },
    { method: 'GET', path: '/beds/overview' },
    { method: 'GET', path: '/critical/beds?pageNum=1&pageSize=1' },
    { method: 'GET', path: '/warnings/summary' },
    { method: 'GET', path: '/warnings?pageNum=1&pageSize=15' },
    { method: 'GET', path: '/critical/alerts' },
    { method: 'GET', path: '/critical/vitals?pageNum=1&pageSize=15' },
    { method: 'GET', path: '/emergency-events?per_page=15' },
    { method: 'GET', path: '/patients?per_page=20' },
    { method: 'GET', path: '/centers' },
  ],
  '/dispatch': [
    { method: 'GET', path: '/dispatch/events' },
    { method: 'GET', path: '/dispatch/case-push' },
    { method: 'GET', path: '/dispatch-live' },
    { method: 'GET', path: '/ambulances' },
    { method: 'GET', path: '/vehicles/gps' },
  ],
  '/register': [
    { method: 'GET', path: '/dispatch-live' },
    { method: 'GET', path: '/organizations?per_page=20' },
    { method: 'GET', path: '/ambulances' },
  ],
  '/quality': [
    { method: 'GET', path: '/qc-standards/summary' },
    { method: 'GET', path: '/qc-standards' },
    { method: 'GET', path: '/sla-records' },
  ],
  '/warning': [
    { method: 'GET', path: '/warnings/summary' },
    { method: 'GET', path: '/warnings/statistics' },
    { method: 'GET', path: '/warnings/critical-values' },
    { method: 'GET', path: '/warnings/closed-loop' },
    { method: 'GET', path: '/warnings?pageNum=1&pageSize=20' },
  ],
  '/critical': [
    { method: 'GET', path: '/critical/beds' },
    { method: 'GET', path: '/critical/wards' },
    { method: 'GET', path: '/critical/vitals?pageNum=1&pageSize=20' },
    { method: 'GET', path: '/critical/alerts' },
  ],
  '/monitoring': [
    { method: 'GET', path: '/monitoring/streams' },
  ],
  '/patients': [{ method: 'GET', path: '/patients?per_page=30' }],
  '/patient/:id': [{ method: 'GET', path: '/patients/{id}' }],
  '/beds': [
    { method: 'GET', path: '/beds/overview' },
    { method: 'GET', path: '/beds/distribution' },
    { method: 'GET', path: '/beds/reserved' },
  ],
  '/bed/:id': [
    { method: 'GET', path: '/beds/{id}' },
    { method: 'GET', path: '/beds/{id}/devices' },
    { method: 'GET', path: '/beds/{id}/inspections' },
  ],
  '/consultations': [
    { method: 'GET', path: '/consultations?pageNum=1&pageSize=20' },
    { method: 'GET', path: '/consultations/doctors' },
  ],
  '/room/:token': [
    { method: 'GET', path: '/rooms/{token}' },
    { method: 'GET', path: '/rooms/{token}/materials' },
  ],
  '/transfers': [{ method: 'GET', path: '/transfers?per_page=30' }],
  '/transport/:id': [
    { method: 'GET', path: '/transfers/{transferNo}' },
    { method: 'GET', path: '/transfers/{transferNo}/track' },
  ],
  '/organizations': [
    { method: 'GET', path: '/organizations?per_page=50' },
    { method: 'GET', path: '/departments?per_page=50' },
    { method: 'GET', path: '/organizations/1/departments' },
    { method: 'GET', path: '/organizations/1/permissions' },
  ],
  '/centers': [
    { method: 'GET', path: '/centers' },
    { method: 'GET', path: '/centers/1/profile' },
  ],
  '/center/:id': [{ method: 'GET', path: '/centers/{id}/profile' }],
  '/messages': [
    { method: 'GET', path: '/messages' },
    { method: 'GET', path: '/messages/notifications' },
    { method: 'GET', path: '/messages/todos' },
  ],
  '/coordination': [
    { method: 'GET', path: '/coordination/todos' },
    { method: 'GET', path: '/coordination/tasks' },
  ],
  '/medical-quality': [
    { method: 'GET', path: '/sla-records' },
    { method: 'GET', path: '/qc-issues?per_page=30' },
    { method: 'GET', path: '/qc-issues-report' },
  ],
  '/medical-quality/reports': [{ method: 'GET', path: '/qc-issues-report' }],
  '/medical-quality/rectify/:id': [{ method: 'GET', path: '/qc-issues/{id}' }],
  '/dr': [
    { method: 'GET', path: '/doctors?per_page=20' },
    { method: 'GET', path: '/clinical-records?per_page=20' },
  ],
  '/devices': [
    { method: 'GET', path: '/devices' },
    { method: 'GET', path: '/devices/inspections' },
  ],
  '/settings': [
    { method: 'GET', path: '/settings/preferences' },
    { method: 'GET', path: '/settings/notification-channels' },
  ],
  '/episode/:id': [
    { method: 'GET', path: '/dispatch/events/{id}' },
    { method: 'GET', path: '/emergency-events/{id}' },
  ],
  '/mobile-reception/:token': [{ method: 'GET', path: '/mobile-reception/{token}' }],
  '/join/:token': [
    { method: 'GET', path: '/rooms/{token}' },
    { method: 'GET', path: '/rooms/{token}/materials' },
  ],
}

export function resolveApiPath(template: string, params: Record<string, string | undefined>) {
  const map: Record<string, string | undefined> = {
    ...params,
    transferNo: params.transferNo ?? params.id,
    token: params.token ?? params.id,
    sessionId: params.sessionId ?? params.id,
    eventId: params.eventId ?? params.id,
    deviceId: params.deviceId ?? params.id,
  }
  return template.replace(/\{(\w+)\}/g, (_, key) => encodeURIComponent(map[key] || '1'))
}
