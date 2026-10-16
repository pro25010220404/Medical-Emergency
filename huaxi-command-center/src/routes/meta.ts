export type RouteGroup =
  | '指挥大屏'
  | '预警与重症'
  | '患者与床位'
  | '会诊协同'
  | '质控管理'
  | '机构与配置'
  | '移动端与会诊'
  | '系统'

export type AppRouteMeta = {
  path: string
  title: string
  group: RouteGroup
  /** 是否在开发侧栏展示 */
  showInNav?: boolean
  /** 独立全屏布局（无侧栏） */
  standalone?: boolean
  modules: string[]
}

/** 与线上一致的路由清单（Hash 模式：/#/path） */
export const APP_ROUTES: AppRouteMeta[] = [
  {
    path: '/',
    title: '一体化指挥中心',
    group: '指挥大屏',
    modules: ['县域地图', '急救调度概览', '实时事件流', 'KPI 指标墙'],
  },
  {
    path: '/dispatch',
    title: '院前调度',
    group: '指挥大屏',
    modules: ['车辆定位', '任务分派', '院前病例推送', '到院交接'],
  },
  {
    path: '/dispatch/list',
    title: '出警列表',
    group: '指挥大屏',
    modules: ['实时出警队列', '历史出警记录'],
  },
  {
    path: '/dispatch/events',
    title: '事件列表',
    group: '指挥大屏',
    modules: ['急救事件', '事件归档'],
  },
  {
    path: '/ambulances',
    title: '救护车列表',
    group: '指挥大屏',
    modules: ['车辆状态', '班组配置', '绑定医院'],
  },
  {
    path: '/monitoring',
    title: '视频监控（已下线，重定向重症监护）',
    group: '指挥大屏',
    modules: ['远程 ICU 画面', '云台控制', '多路监控切换'],
  },
  {
    path: '/warning',
    title: '预警中心',
    group: '预警与重症',
    modules: ['NEWS / 体征预警', '检验危急值', '处置闭环', '预警统计'],
  },
  {
    path: '/critical',
    title: '重症监护',
    group: '预警与重症',
    modules: ['ICU 床位', '远程查房', '床旁体征', '智能预警'],
  },
  {
    path: '/transport/:id',
    title: '转运任务详情',
    group: '指挥大屏',
    showInNav: false,
    modules: ['车载监护', '交接清单', '轨迹回放'],
  },
  {
    path: '/beds',
    title: '床位总览',
    group: '患者与床位',
    modules: ['县域床位占用', '预留床位', '机构分布'],
  },
  {
    path: '/bed/:id',
    title: '床位详情',
    group: '患者与床位',
    showInNav: false,
    modules: ['设备绑定', '患者关联', '巡检记录'],
  },
  {
    path: '/patients',
    title: '患者列表',
    group: '患者与床位',
    modules: ['在治患者', '阶段筛选', '检索与导出'],
  },
  {
    path: '/patient/:id',
    title: '患者详情',
    group: '患者与床位',
    showInNav: false,
    modules: ['临床时间轴', '会诊记录', '预警与处置'],
  },
  {
    path: '/register',
    title: '患者登记',
    group: '患者与床位',
    modules: ['证件识别', '基本信息', '院前上报'],
  },
  {
    path: '/transfers',
    title: '转诊协同',
    group: '患者与床位',
    modules: ['上转下转', '华西绿色通道', '响应时长'],
  },
  {
    path: '/consultations',
    title: '远程会诊',
    group: '会诊协同',
    modules: ['会诊队列', '接诊医生', '会诊链接'],
  },
  {
    path: '/room/:token',
    title: '会诊室',
    group: '会诊协同',
    showInNav: false,
    standalone: true,
    modules: ['音视频', '会诊意见', '临床资料'],
  },
  {
    path: '/join/:token',
    title: '患者加入会诊',
    group: '移动端与会诊',
    showInNav: false,
    standalone: true,
    modules: ['手机端入会', '进度同步'],
  },
  {
    path: '/mobile-reception/:token',
    title: '手机重症接收',
    group: '移动端与会诊',
    showInNav: false,
    standalone: true,
    modules: ['机构选择', '科室接收', '到院准备'],
  },
  {
    path: '/coordination',
    title: '现场工作台',
    group: '移动端与会诊',
    modules: ['移动会诊待办', '任务协同', 'Dr. 基层医声入口'],
  },
  {
    path: '/mobile',
    title: '移动入口（重定向）',
    group: '移动端与会诊',
    showInNav: false,
    modules: ['重定向至 /coordination'],
  },
  {
    path: '/episode/:id',
    title: '急救事件详情',
    group: '患者与床位',
    showInNav: false,
    modules: ['事件时间线', '关联车辆与人员'],
  },
  {
    path: '/dr',
    title: '基层医声 Dr.',
    group: '会诊协同',
    modules: ['基层反馈', '问题上报', '协作消息'],
  },
  {
    path: '/medical-quality',
    title: '质控整改看板',
    group: '质控管理',
    modules: ['整改台账', '级别分布', '超期预警'],
  },
  {
    path: '/medical-quality/reports',
    title: '质控统计',
    group: '质控管理',
    modules: ['筛查覆盖', '机构统计', '导出 CSV'],
  },
  {
    path: '/medical-quality/rectify/:id',
    title: '整改单详情',
    group: '质控管理',
    showInNav: false,
    modules: ['差距分析', '原因与措施', '销号流程'],
  },
  {
    path: '/organizations',
    title: '机构管理',
    group: '机构与配置',
    modules: ['医共体成员', '科室结构', '权限范围'],
  },
  {
    path: '/centers',
    title: '救治中心',
    group: '机构与配置',
    modules: ['五大中心', '能力画像'],
  },
  {
    path: '/quality',
    title: '质量指标',
    group: '质控管理',
    modules: ['指标看板', '趋势对比'],
  },
  {
    path: '/devices',
    title: '设备管理',
    group: '机构与配置',
    modules: ['监护设备', '床位绑定', '巡检'],
  },
  {
    path: '/messages',
    title: '消息中心',
    group: '机构与配置',
    modules: ['服务通知', '待办提醒'],
  },
  {
    path: '/settings',
    title: '系统设置',
    group: '系统',
    modules: ['演示数据重置', '通知渠道', '偏好配置'],
  },
  {
    path: '/phone',
    title: '手机通知演示',
    group: '系统',
    standalone: true,
    modules: ['短信 / 微信服务通知 UI'],
  },
  {
    path: '/login',
    title: '登录',
    group: '系统',
    standalone: true,
    modules: ['医护账号登录'],
  },
]

export const NAV_ROUTES = APP_ROUTES.filter((r) => r.showInNav !== false)
