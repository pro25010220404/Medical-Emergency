import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import type { MapThemeId } from '../mapTheme'
import { getMapTheme } from '../mapTheme'
import {
  addCampusBasePlate,
  attachCampusGlb,
  loadCampusTemplates,
} from '../lib/hospitalCampusOnMap'
import { createCampusInfoPanel, type CollabNodeDetail } from '../lib/campusMapInfoPanel'
import {
  campusUnifiedColor,
  campusUnifiedHex,
  TIER_LEGEND_HEX,
} from '../lib/hospitalCampusStyle'
import type { GeoJson } from './geo'
import {
  buildShapeFromPoints,
  getRings,
  pointInLngLatRing,
  projectLngLat,
  projectRing,
  ringBounds,
} from './geo'

type CollabNode = CollabNodeDetail

type CollabLink = { from: string; to: string }

const MARKER = {
  tierHeight: [1.18, 0.96, 0.82] as const,
  diamondRadius: 0.145,
  beamTopR: 0.018,
  beamBottomR: 0.044,
  flowArcLift: 0.48,
  flowOpacity: 0.72,
  pulseRadius: 0.042,
  curveSegments: 36,
} as const

function tierIndex(tier: number) {
  return Math.min(2, Math.max(0, tier))
}

/** 浅色底图上更醒目的节点色（仍对应图例三级） */
const MARKER_TIER_BRIGHT: [number, number, number] = [
  0x7dd3fc,
  0x38bdf8,
  0xfbbf24,
]

function tierMarkerHeight(tier: number) {
  return MARKER.tierHeight[Math.min(2, Math.max(0, tier))] ?? 0.7
}

const INITIAL_VIEW = {
  geoScale: 13.6,
  fov: 34,
  camX: 0.26,
  camY: 0.44,
  camZ: 0.98,
  minDistRatio: 0.62,
  maxDistRatio: 2.1,
  mapScale: 1.06,
} as const

export type MountMapSceneOptions = {
  themeId: MapThemeId
  region?: 'weiyuan' | 'dafang'
  variant?: 'default' | 'command'
  layout?: 'dashboard' | 'fullscreen'
  /** 为 false 时使用菱形节点 + 飞线粒子，不加载 GLB 院区模型 */
  useCampusGlb?: boolean
  /** 院区在模板尺寸上再放大（仅 useCampusGlb 时有效） */
  campusDisplayScale?: number
  /** 优先于 /api/gis-collab.json（如 /dashboard/county-map） */
  collabPack?: { nodes: CollabNode[]; links?: CollabLink[] }
}

function shortNodeName(name: string) {
  const part = name.split('·')[0]?.split('—')[0]?.trim() ?? name
  if (part.length <= 12) return part
  return `${part.slice(0, 11)}…`
}

/** 纯 Three 挂载（供 app.html 叠加，避免与旧 bundle 双 React） */
export function mountMapScene(mount: HTMLDivElement, options: MountMapSceneOptions): () => void {
  const {
    themeId,
    region = 'weiyuan',
    variant = 'default',
    useCampusGlb = false,
    campusDisplayScale = variant === 'command' ? 1.18 : 1,
    layout = 'dashboard',
    collabPack: collabPackIn,
  } = options
  const view =
    variant === 'command'
      ? layout === 'fullscreen'
        ? { ...INITIAL_VIEW, fov: 32, camX: 0, camY: 0.44, camZ: 1.12, mapScale: 1.12, minDistRatio: 0.52 }
        : { ...INITIAL_VIEW, camX: 0, camY: 0.44, camZ: 1.12, mapScale: 1.0, minDistRatio: 0.62 }
      : INITIAL_VIEW
  const theme = getMapTheme(themeId)
  const t = theme.three

  let disposed = false
  let frame = 0
  const cleanups: (() => void)[] = []

  void (async () => {
    try {
      const geoRes = await fetch(`/maps/${region}.json`)
      if (!geoRes.ok) throw new Error('地图加载失败')
      const geo = (await geoRes.json()) as GeoJson
      if (disposed) return

      let nodes: CollabNode[]
      let links: CollabLink[]

      const loadCollabPack = async () => {
        const collabRes = await fetch('/api/gis-collab.json', { cache: 'no-store' })
        if (!collabRes.ok) throw new Error('协同数据加载失败')
        const collab = (await collabRes.json()) as Record<
          string,
          { nodes: CollabNode[]; links: CollabLink[] }
        >
        return collab[region] ?? collab.weiyuan
      }

      const pack =
        collabPackIn?.nodes?.length ?
          { nodes: collabPackIn.nodes, links: collabPackIn.links ?? [] }
        : await loadCollabPack()
      nodes = pack.nodes
      links = pack.links
      if (disposed) return

      const ring = getRings(geo)[0]
      const bounds = ringBounds(ring)
      const lngLatRing = ring
      const scale = view.geoScale / (bounds.maxLat - bounds.minLat)
      const cosLat = Math.cos(bounds.centerLat * (Math.PI / 180))
      const center = { lng: bounds.centerLng, lat: bounds.centerLat }
      const flat = projectRing(ring, center, scale, cosLat)
      const widthSpan = (bounds.maxLng - bounds.minLng) * scale * cosLat

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      const w0 = Math.max(mount.clientWidth, 320)
      const h0 = Math.max(mount.clientHeight, 240)
      renderer.setSize(w0, h0)
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.15
      mount.appendChild(renderer.domElement)

      const labelRenderer = new CSS2DRenderer()
      labelRenderer.setSize(w0, h0)
      labelRenderer.domElement.className = 'sc-map-label-layer'
      labelRenderer.domElement.style.pointerEvents = 'none'
      mount.appendChild(labelRenderer.domElement)

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(view.fov, w0 / h0, 0.1, 200)
      camera.position.set(
        -widthSpan * view.camX,
        -widthSpan * view.camY,
        widthSpan * view.camZ,
      )
      camera.lookAt(0, 0, 0)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.enablePan = false
      controls.minDistance = widthSpan * view.minDistRatio
      controls.maxDistance = widthSpan * view.maxDistRatio
      controls.minPolarAngle = 0.35
      controls.maxPolarAngle = Math.PI * 0.48
      controls.target.set(0, 0, 0.25)
      if (variant === 'command') {
        const home = new THREE.Spherical(controls.maxDistance, 0.82, 0)
        camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(home))
      }
      controls.update()

      const onMapZoom = (ev: Event) => {
        const dir = (ev as CustomEvent<{ dir?: string }>).detail?.dir
        if (dir !== 'in' && dir !== 'out') return
        const offset = new THREE.Vector3().subVectors(camera.position, controls.target)
        const len = offset.length()
        if (!Number.isFinite(len) || len <= 0) return
        const factor = dir === 'in' ? 0.88 : 1.14
        const next = Math.max(controls.minDistance, Math.min(controls.maxDistance, len * factor))
        offset.setLength(next)
        camera.position.copy(controls.target).add(offset)
        controls.update()
      }
      window.addEventListener('hx-map-camera-zoom', onMapZoom)
      cleanups.push(() => window.removeEventListener('hx-map-camera-zoom', onMapZoom))

      scene.add(new THREE.AmbientLight(t.ambient, 0.55))
      const key = new THREE.DirectionalLight(t.keyLight, 1.1)
      key.position.set(-6, -8, 14)
      scene.add(key)
      const rim = new THREE.PointLight(t.rimLight, 1.4, 80)
      rim.position.set(8, 6, 10)
      scene.add(rim)

      const mapGroup = new THREE.Group()
      scene.add(mapGroup)

      const shape = buildShapeFromPoints(flat, THREE)
      const extrude = new THREE.ExtrudeGeometry(shape, {
        depth: 0.55,
        bevelEnabled: true,
        bevelThickness: 0.06,
        bevelSize: 0.045,
        bevelSegments: 2,
        steps: 1,
      })
      mapGroup.add(
        new THREE.Mesh(extrude, [
          new THREE.MeshPhongMaterial({
            color: t.terrainTop,
            emissive: t.terrainEmissiveTop,
            shininess: 48,
          }),
          new THREE.MeshPhongMaterial({
            color: t.terrainSide,
            emissive: t.terrainEmissiveSide,
            shininess: 30,
          }),
        ]),
      )

      mapGroup.add(
        new THREE.LineLoop(
          new THREE.BufferGeometry().setFromPoints(flat.map((p) => new THREE.Vector3(p.x, p.y, 0.56))),
          new THREE.LineBasicMaterial({ color: t.edgeGlow, transparent: true, opacity: 0.95 }),
        ),
      )

      if (variant !== 'command') {
        const grid = new THREE.GridHelper(widthSpan * 1.6, 24, t.gridPrimary, t.gridSecondary)
        grid.rotation.x = Math.PI / 2
        grid.position.z = -0.02
        mapGroup.add(grid)
      }

      const campusTemplates = useCampusGlb ? await loadCampusTemplates() : null
      if (disposed) return
      if (campusTemplates) {
        console.info('[MapScene] GLB 院区模板已加载', campusTemplates.size)
      }

      const posById = new Map<string, THREE.Vector3>()
      const nodeById = new Map<string, CollabNode>()
      const markerByNodeId = new Map<string, THREE.Group>()
      const diamondSpinners: THREE.Mesh[] = []
      const pickables: THREE.Object3D[] = []
      let selectedNodeId: string | null = null

      let infoPanel: ReturnType<typeof createCampusInfoPanel> | null = null

      function tagPickables(root: THREE.Object3D, nodeId: string) {
        root.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh)) return
          obj.userData.nodeId = nodeId
          pickables.push(obj)
        })
      }

      function setNodeSelected(nodeId: string | null) {
        selectedNodeId = nodeId
        for (const [id, grp] of markerByNodeId) {
          const on = id === nodeId
          grp.scale.setScalar(on ? 1.06 : 1)
          const label = grp.userData.labelEl as HTMLElement | undefined
          label?.classList.toggle('hx-campus-map-label--selected', on)
          label?.classList.toggle('hx-command-map-label--selected', on)
          grp.traverse((obj) => {
            if (!(obj instanceof THREE.Mesh) || !obj.material) return
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
            for (const m of mats) {
              if (!(m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshPhongMaterial)) continue
              if (m.userData.baseEmissiveIntensity == null) {
                m.userData.baseEmissiveIntensity = m.emissiveIntensity
              }
              const base = m.userData.baseEmissiveIntensity as number
              m.emissiveIntensity = on ? base + 0.35 : base
            }
          })
        }
        if (nodeId) {
          const node = nodeById.get(nodeId)
          if (node && infoPanel) {
            infoPanel.show(node)
            window.dispatchEvent(
              new CustomEvent('hx-map-node-select', {
                detail: { id: node.id, name: node.name, region },
              }),
            )
          }
        } else {
          infoPanel?.hide()
          window.dispatchEvent(new CustomEvent('hx-map-node-select', { detail: null }))
        }
      }

      if (variant === 'command') {
        infoPanel = createCampusInfoPanel(mount, { onClose: () => setNodeSelected(null) })
      }

      for (const node of nodes) {
        let lng = Number(node.lng)
        let lat = Number(node.lat)
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
        if (!pointInLngLatRing(lng, lat, lngLatRing)) {
          console.warn('[MapScene] 节点不在县界内，已跳过', node.id, node.name)
          continue
        }
        nodeById.set(node.id, node)
        const pt = projectLngLat(lng, lat, center, scale, cosLat)
        let h: number = tierMarkerHeight(node.tier)
        const ti = tierIndex(node.tier ?? 0)
        const markerColor =
          useCampusGlb ? campusUnifiedColor() : (MARKER_TIER_BRIGHT[ti] ?? t.markerByTier[ti])
        const markerHex = useCampusGlb ? campusUnifiedHex() : TIER_LEGEND_HEX[ti]
        const g = new THREE.Group()
        g.position.set(pt.x, pt.y, 0.72)

        addCampusBasePlate(g, t, node.tier, markerColor)

        let usedCampus = false
        if (campusTemplates) {
          const top = attachCampusGlb(g, node.tier, campusTemplates, t, campusDisplayScale)
          if (top > 0) {
            h = top
            usedCampus = true
            const pin = new THREE.Mesh(
              new THREE.OctahedronGeometry(MARKER.diamondRadius * 0.75, 0),
              new THREE.MeshPhongMaterial({
                color: markerColor,
                emissive: markerColor,
                emissiveIntensity: 0.4,
                shininess: 80,
                transparent: true,
                opacity: 0.92,
              }),
            )
            pin.position.z = h + 0.03
            g.add(pin)
          }
        }

        if (!usedCampus) {
          const beam = new THREE.Mesh(
            new THREE.CylinderGeometry(MARKER.beamTopR, MARKER.beamBottomR, h * 0.75, 10, 1, true),
            new THREE.MeshBasicMaterial({
              color: markerColor,
              transparent: true,
              opacity: 0.42,
              side: THREE.DoubleSide,
            }),
          )
          beam.position.z = h * 0.42
          g.add(beam)

          const glow = new THREE.Mesh(
            new THREE.OctahedronGeometry(MARKER.diamondRadius * 1.65, 0),
            new THREE.MeshBasicMaterial({
              color: 0xffffff,
              transparent: true,
              opacity: 0.22,
              depthWrite: false,
            }),
          )
          glow.position.z = h
          g.add(glow)

          const diamondMat = new THREE.MeshStandardMaterial({
            color: markerColor,
            emissive: markerColor,
            emissiveIntensity: 1.45,
            metalness: 0.2,
            roughness: 0.18,
          })
          diamondMat.userData.baseEmissiveIntensity = 1.45
          const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(MARKER.diamondRadius, 0), diamondMat)
          diamond.position.z = h
          diamond.renderOrder = 10
          g.add(diamond)

          const core = new THREE.Mesh(
            new THREE.OctahedronGeometry(MARKER.diamondRadius * 0.42, 0),
            new THREE.MeshBasicMaterial({ color: 0xffffff }),
          )
          core.position.z = h
          core.renderOrder = 11
          g.add(core)

          diamondSpinners.push(diamond)
        }

        const labelEl = document.createElement('div')
        if (variant === 'command') {
          labelEl.className = usedCampus ? 'hx-campus-map-label' : 'hx-command-map-label'
          labelEl.dataset.nodeId = node.id
          if (usedCampus) {
            labelEl.textContent = shortNodeName(node.name)
            labelEl.style.color = markerHex
            labelEl.style.borderColor = `${markerHex}55`
          } else {
            labelEl.innerHTML = `<span class="hx-command-map-pin" aria-hidden="true"></span><span class="hx-command-map-name">${node.name}</span>`
          }
        } else {
          labelEl.className = 'sc-map-label'
          labelEl.textContent = node.name
          labelEl.style.color = t.labelCss
          labelEl.style.borderColor = t.accentCss
        }
        const label = new CSS2DObject(labelEl)
        label.position.set(0, 0, h + (usedCampus ? 0.2 : 0.08))
        g.add(label)

        g.userData.labelEl = labelEl
        tagPickables(g, node.id)
        markerByNodeId.set(node.id, g)
        mapGroup.add(g)
        const linkZ = 0.58 + Math.min(h, 0.45)
        posById.set(node.id, new THREE.Vector3(pt.x, pt.y, linkZ))
      }

      const flowMat = new THREE.LineBasicMaterial({
        color: t.flowLine,
        transparent: true,
        opacity: MARKER.flowOpacity,
        depthTest: true,
        linewidth: 1,
      })
      const pulses: { mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3; phase: number }[] = []

      for (const link of links) {
        const start = posById.get(link.from)
        const end = posById.get(link.to)
        if (!start || !end) continue
        const mid = start.clone().add(end).multiplyScalar(0.5)
        mid.z += MARKER.flowArcLift
        const curve = new THREE.CatmullRomCurve3([start, mid, end])
        mapGroup.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(curve.getPoints(MARKER.curveSegments)),
            flowMat,
          ),
        )
        const pulse = new THREE.Mesh(
          new THREE.SphereGeometry(MARKER.pulseRadius, 12, 12),
          new THREE.MeshBasicMaterial({ color: t.pulse }),
        )
        mapGroup.add(pulse)
        pulses.push({ mesh: pulse, curve, phase: Math.random() })
      }

      mapGroup.rotation.x = -Math.PI / 2
      mapGroup.position.z = 0.15
      mapGroup.scale.setScalar(view.mapScale)

      if (variant === 'command' && infoPanel) {
        const raycaster = new THREE.Raycaster()
        const pointer = new THREE.Vector2()
        let dragStart: { x: number; y: number } | null = null

        const pickNodeId = (clientX: number, clientY: number) => {
          const rect = renderer.domElement.getBoundingClientRect()
          if (rect.width < 1 || rect.height < 1) return null
          pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
          pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
          raycaster.setFromCamera(pointer, camera)
          mapGroup.updateMatrixWorld(true)
          const hits = raycaster.intersectObjects(mapGroup.children, true)
          for (const hit of hits) {
            let o: THREE.Object3D | null = hit.object
            while (o) {
              const id = o.userData.nodeId as string | undefined
              if (id) return id
              o = o.parent
            }
          }
          return null
        }

        const onPointerDown = (ev: PointerEvent) => {
          dragStart = { x: ev.clientX, y: ev.clientY }
        }
        const onPointerUp = (ev: PointerEvent) => {
          if (!dragStart) return
          const dx = ev.clientX - dragStart.x
          const dy = ev.clientY - dragStart.y
          dragStart = null
          if (dx * dx + dy * dy > 64) return
          const id = pickNodeId(ev.clientX, ev.clientY)
          if (!id) {
            setNodeSelected(null)
            return
          }
          setNodeSelected(id === selectedNodeId ? null : id)
        }
        const onKeyDown = (ev: KeyboardEvent) => {
          if (ev.key === 'Escape') setNodeSelected(null)
        }
        const onNodeFocus = (ev: Event) => {
          const id = (ev as CustomEvent<{ id?: string }>).detail?.id
          if (id) setNodeSelected(String(id))
        }

        renderer.domElement.style.cursor = 'grab'
        renderer.domElement.style.touchAction = 'none'
        renderer.domElement.addEventListener('pointerdown', onPointerDown)
        renderer.domElement.addEventListener('pointerup', onPointerUp)
        window.addEventListener('keydown', onKeyDown)
        window.addEventListener('hx-map-node-focus', onNodeFocus)
        cleanups.push(() => {
          renderer.domElement.removeEventListener('pointerdown', onPointerDown)
          renderer.domElement.removeEventListener('pointerup', onPointerUp)
          window.removeEventListener('keydown', onKeyDown)
          window.removeEventListener('hx-map-node-focus', onNodeFocus)
          infoPanel?.panel.remove()
        })
      }

      const t0 = performance.now()
      const animate = (now: number) => {
        if (disposed) return
        frame = requestAnimationFrame(animate)
        const elapsed = (now - t0) / 1000
        mapGroup.rotation.z = Math.sin(elapsed * 0.08) * 0.02
        for (let i = 0; i < diamondSpinners.length; i++) {
          const d = diamondSpinners[i]
          d.rotation.y = elapsed * 0.85 + i * 0.4
          d.rotation.x = 0.35 + Math.sin(elapsed * 0.5 + i) * 0.08
        }
        for (const p of pulses) {
          p.mesh.position.copy(p.curve.getPoint((elapsed * 0.35 + p.phase) % 1))
        }
        controls.update()
        renderer.render(scene, camera)
        labelRenderer.render(scene, camera)
      }
      frame = requestAnimationFrame(animate)

      const onResize = () => {
        const w = Math.max(mount.clientWidth, 320)
        const h = Math.max(mount.clientHeight, 240)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
        labelRenderer.setSize(w, h)
      }
      window.addEventListener('resize', onResize)
      cleanups.push(() => window.removeEventListener('resize', onResize))
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => onResize())
        ro.observe(mount)
        cleanups.push(() => ro.disconnect())
      }
      cleanups.push(() => {
        cancelAnimationFrame(frame)
        controls.dispose()
        renderer.dispose()
        extrude.dispose()
        if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
        if (labelRenderer.domElement.parentNode === mount) mount.removeChild(labelRenderer.domElement)
      })

      requestAnimationFrame(onResize)
      ;[80, 200, 450, 800].forEach((ms) => {
        const t = window.setTimeout(onResize, ms)
        cleanups.push(() => clearTimeout(t))
      })
      console.info('[MapScene] 地图已挂载', {
        region,
        nodes: nodes.length,
        glb: useCampusGlb && !!campusTemplates,
      })
    } catch (err) {
      console.error('[MapScene] 挂载失败', err)
    }
  })()

  return () => {
    disposed = true
    cleanups.forEach((fn) => fn())
  }
}
