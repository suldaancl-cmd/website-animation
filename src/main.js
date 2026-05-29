/* Kaltuun — arctic 3D studio
   Blender-modelled iceberg (GLB) + Three.js + GSAP ScrollTrigger + Lenis + reveal effects
*/

import * as THREE from 'three'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

gsap.registerPlugin(ScrollTrigger)

// ─── Lenis ─────────────────────────────────────────────────────────────
const lenis = new Lenis({
  duration: 1.1,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
})
lenis.on('scroll', ScrollTrigger.update)
gsap.ticker.add((t) => lenis.raf(t * 1000))
gsap.ticker.lagSmoothing(0)
if (import.meta.env.DEV) { window.__lenis = lenis; window.__ST = ScrollTrigger }

// ─── Renderer / scene ──────────────────────────────────────────────────
const canvas = document.querySelector('#webgl')
const sizes = {
  w: window.innerWidth || document.documentElement.clientWidth || 1280,
  h: window.innerHeight || document.documentElement.clientHeight || 800,
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(sizes.w, sizes.h)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.1
renderer.outputColorSpace = THREE.SRGBColorSpace

const scene = new THREE.Scene()
scene.fog = new THREE.Fog(0xdce8ee, 14, 42)

const camera = new THREE.PerspectiveCamera(38, sizes.w / sizes.h, 0.1, 100)
camera.position.set(0, 1.2, 13)
camera.lookAt(0, 0.5, 0)

// ─── Environment (studio IBL → clean ice reflections) ──────────────────
const pmrem = new THREE.PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

// ─── Lighting — arctic key + cool fill ─────────────────────────────────
const key = new THREE.DirectionalLight(0xffffff, 2.6)
key.position.set(5, 8, 6)
scene.add(key)
const rim = new THREE.DirectionalLight(0x9fd0ff, 1.4)   // cool back-rim
rim.position.set(-6, 3, -5)
scene.add(rim)
scene.add(new THREE.HemisphereLight(0xeaf4fa, 0x9fb4c2, 0.7))

// ─── Iceberg group (rotates / rises on scroll) ─────────────────────────
const berg = new THREE.Group()
scene.add(berg)

let icebergMesh = null
const loadMgr = new THREE.LoadingManager()
const loader = new GLTFLoader(loadMgr)

loadMgr.onProgress = (url, loaded, total) => {
  const pct = total ? Math.round((loaded / total) * 100) : 0
  const el = document.getElementById('loadPct')
  const bar = document.querySelector('.preloader__bar span')
  if (el) el.textContent = pct
  if (bar) bar.style.width = pct + '%'
}

loader.load('/models/kaltuun-iceberg.glb', (gltf) => {
  const model = gltf.scene
  // Normalise scale + center
  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const targetH = 6
  const s = targetH / size.y
  model.scale.setScalar(s)
  model.position.sub(center.multiplyScalar(s))

  // Tint/clean the ice material in case GLB import looks flat
  model.traverse((o) => {
    if (o.isMesh) {
      o.material.envMapIntensity = 1.25
      o.material.roughness = Math.min(o.material.roughness ?? 0.2, 0.22)
      o.material.flatShading = true
      o.material.needsUpdate = true
      o.castShadow = o.receiveShadow = false
    }
  })
  berg.add(model)
  icebergMesh = model
}, undefined, (err) => {
  console.error('GLB load failed', err)
})

// ─── Snow particles ────────────────────────────────────────────────────
const SNOW = 600
const snowGeo = new THREE.BufferGeometry()
const sp = new Float32Array(SNOW * 3)
for (let i = 0; i < SNOW; i++) {
  sp[i*3+0] = (Math.random() - 0.5) * 40
  sp[i*3+1] = (Math.random() - 0.5) * 30
  sp[i*3+2] = (Math.random() - 0.5) * 30 - 4
}
snowGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3))
const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({
  color: 0xffffff, size: 0.05, transparent: true, opacity: 0.6, depthWrite: false,
}))
scene.add(snow)

// ─── Camera scroll path ────────────────────────────────────────────────
const keys = [
  { p: new THREE.Vector3(0, 1.2, 13),   l: new THREE.Vector3(0, 0.6, 0),  rot: 0.0 },   // hero
  { p: new THREE.Vector3(6.5, 1.8, 10),  l: new THREE.Vector3(0, 1.0, 0),  rot: 0.5 },   // studio
  { p: new THREE.Vector3(0, 4.2, 9),     l: new THREE.Vector3(0, 1.4, 0),  rot: 1.1 },   // work
  { p: new THREE.Vector3(-7, 1.0, 9),    l: new THREE.Vector3(0, 0.8, 0),  rot: 1.7 },   // process
  { p: new THREE.Vector3(0, 0.2, 7.2),   l: new THREE.Vector3(0, 1.8, 0),  rot: 2.3 },   // end
]
const tA = new THREE.Vector3(), tB = new THREE.Vector3(), look = new THREE.Vector3()
const smooth = (f) => f * f * (3 - 2 * f)
function sampleCamera(progress) {
  const segs = keys.length - 1
  const s = Math.min(progress * segs, segs - 1e-5)
  const i = Math.floor(s)
  const t = smooth(s - i)
  const a = keys[i], b = keys[i + 1]
  camera.position.copy(tA.copy(a.p).lerp(b.p, t))
  look.copy(tB.copy(a.l).lerp(b.l, t))
  camera.lookAt(look)
  berg.rotation.y = a.rot + (b.rot - a.rot) * t
}

const scrollState = { p: 0 }
ScrollTrigger.create({
  trigger: document.documentElement,
  start: 'top top',
  end: () => `+=${document.documentElement.scrollHeight - window.innerHeight}`,
  onUpdate: (self) => { scrollState.p = self.progress },
})
if (import.meta.env.DEV) window.__scrollState = scrollState

// ─── Reveal animations ─────────────────────────────────────────────────
function buildReveals() {
  // Hero line masks (already wrapped in HTML as .line > .r)
  gsap.set('.hero__title .r', { yPercent: 115 })
  gsap.to('.hero__title .r', { yPercent: 0, duration: 1.4, ease: 'expo.out', stagger: 0.09, delay: 0.2 })

  // Generic [data-reveal] fade-up
  gsap.utils.toArray('[data-reveal]').forEach((el) => {
    gsap.from(el, {
      y: 40, opacity: 0, duration: 1.1, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none reverse' },
    })
  })

  // Headline line-mask reveals
  gsap.utils.toArray('.reveal-lines').forEach((h) => {
    const rs = h.querySelectorAll('.r')
    gsap.set(rs, { yPercent: 115 })
    gsap.to(rs, {
      yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1,
      scrollTrigger: { trigger: h, start: 'top 85%', once: true },
    })
  })

  // Cards — clip + rise, batched
  gsap.utils.toArray('[data-reveal-card]').forEach((el, i) => {
    gsap.from(el, {
      y: 70, opacity: 0, duration: 1.0, ease: 'expo.out', delay: (i % 3) * 0.08,
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    })
  })

  // Counters
  gsap.utils.toArray('.stat__num').forEach((el) => {
    const target = parseInt(el.dataset.count, 10)
    const o = { v: 0 }
    gsap.to(o, {
      v: target, duration: 1.8, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 82%', once: true },
      onUpdate: () => { el.textContent = Math.round(o.v) },
    })
  })
}

// ─── Scroll percent rail ───────────────────────────────────────────────
const pctEl = document.getElementById('scrollPct')

// ─── Render loop ───────────────────────────────────────────────────────
const clock = new THREE.Clock()
function tick() {
  const e = clock.getElapsedTime()
  sampleCamera(scrollState.p)

  // idle float on the iceberg + drifting snow
  if (icebergMesh) icebergMesh.position.y = Math.sin(e * 0.5) * 0.08
  snow.rotation.y = e * 0.01
  const pos = snowGeo.attributes.position
  for (let i = 0; i < SNOW; i++) {
    let y = pos.getY(i) - 0.01
    if (y < -15) y = 15
    pos.setY(i, y)
  }
  pos.needsUpdate = true

  if (pctEl) pctEl.textContent = String(Math.round(scrollState.p * 100)).padStart(3, '0')
  renderer.render(scene, camera)
  requestAnimationFrame(tick)
}
tick()

// ─── Resize ────────────────────────────────────────────────────────────
function applySize(w, h) {
  if (w <= 0 || h <= 0) return
  sizes.w = w; sizes.h = h
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(w, h, true)
  ScrollTrigger.refresh()
}
const ro = new ResizeObserver((entries) => {
  for (const e of entries) {
    const { width, height } = e.contentRect
    applySize(Math.max(width, window.innerWidth || 0), Math.max(height, window.innerHeight || 0))
  }
})
ro.observe(document.documentElement)

// ─── Boot ──────────────────────────────────────────────────────────────
let revealed = false
function boot() {
  if (revealed) return
  revealed = true
  document.getElementById('preloader')?.classList.add('hidden')
  buildReveals()
  ScrollTrigger.refresh()
}
// Reveal when both the model and fonts are ready, with a hard cap.
let modelDone = false, fontsDone = false
const maybeBoot = () => { if (modelDone && fontsDone) boot() }
loadMgr.onLoad = () => { modelDone = true; maybeBoot() }
;(document.fonts?.ready ?? Promise.resolve()).then(() => { fontsDone = true; maybeBoot() })
setTimeout(boot, 4000)   // fail-safe so the preloader never strands
