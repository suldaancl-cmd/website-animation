/* Kaltuun — arctic 3D studio
   Blender-modelled iceberg (GLB) + Three.js + GSAP ScrollTrigger + Lenis + reveal effects
*/

import * as THREE from 'three'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

gsap.registerPlugin(ScrollTrigger)

// Respect the OS "reduce motion" setting (WCAG 2.3.3 / PRODUCT.md a11y).
// When set: skip Lenis smooth-scroll (native scroll), and the render loop
// freezes parallax / spin / drift to a calm static scene.
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

// ─── Lenis ─────────────────────────────────────────────────────────────
if (!reduceMotion) {
  const lenis = new Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  })
  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add((t) => lenis.raf(t * 1000))
  gsap.ticker.lagSmoothing(0)
  if (import.meta.env.DEV) window.__lenis = lenis
}
if (import.meta.env.DEV) window.__ST = ScrollTrigger

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
renderer.toneMappingExposure = 0.95
renderer.outputColorSpace = THREE.SRGBColorSpace

const scene = new THREE.Scene()
scene.fog = new THREE.Fog(0xdce8ee, 14, 42)

// In-scene backdrop. Arctic gradient base + soft aurora colour blooms so the
// background carries the brand palette without going loud ("cold surface,
// warm signal"). 2D texture so the colour spots can sit off-axis.
function makeGradientTexture() {
  const c = document.createElement('canvas')
  c.width = 512; c.height = 512
  const g = c.getContext('2d')
  // arctic vertical base
  const base = g.createLinearGradient(0, 0, 0, 512)
  base.addColorStop(0.0, '#f3f8fb')
  base.addColorStop(0.42, '#dde9f0')
  base.addColorStop(0.72, '#bcd2de')
  base.addColorStop(1.0, '#9cbccd')
  g.fillStyle = base; g.fillRect(0, 0, 512, 512)
  // aurora blooms — pale, screen-blended so they tint rather than overpower
  g.globalCompositeOperation = 'screen'
  const bloom = (x, y, r, col) => {
    const rg = g.createRadialGradient(x, y, 0, x, y, r)
    rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = rg; g.fillRect(0, 0, 512, 512)
  }
  bloom(120, 130, 240, 'rgba(90,209,200,0.30)')   // teal, upper-left
  bloom(400, 180, 260, 'rgba(106,166,255,0.28)')  // blue, upper-right
  bloom(300, 380, 280, 'rgba(185,140,255,0.26)')  // violet, lower-centre
  bloom(150, 430, 220, 'rgba(255,143,176,0.20)')  // pink, lower-left
  g.globalCompositeOperation = 'source-over'
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
scene.background = makeGradientTexture()

const camera = new THREE.PerspectiveCamera(38, sizes.w / sizes.h, 0.1, 100)
camera.position.set(0, 1.2, 13)
camera.lookAt(0, 0.5, 0)

// ─── Post-processing: bloom (glowing aurora) + subtle depth-of-field ────
const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
const bloom = new UnrealBloomPass(
  new THREE.Vector2(sizes.w, sizes.h),
  0.12,   // strength — very gentle; high bloom was blowing the ice to white
  0.6,    // radius
  1.1,    // threshold — keep ordinary surfaces out of the bloom entirely
)
composer.addPass(bloom)
composer.addPass(new OutputPass())

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
const bergMats = []   // ice materials, emissive cycled through aurora palette
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

  // Colour is BAKED into the mesh in Blender (per-vertex aurora ramp by height).
  // We then FLOW it: onBeforeCompile injects a time-driven hue rotation so the
  // baked aurora drifts across the facets, while PBR lighting still shapes the ice.
  model.traverse((o) => {
    if (o.isMesh) {
      const m = new THREE.MeshStandardMaterial({
        color: 0xffffff,        // white base so baked vertex colours show true
        vertexColors: true,     // <- read COLOR_0 from the Blender GLB
        roughness: 0.5,
        metalness: 0.0,
        flatShading: true,
        envMapIntensity: 0.2,   // cut the white IBL reflection that washed the colour out
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.35, // modest: lit colour leads, no white overexposure
      })
      m.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 }
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying float vFlowY;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlowY = position.y;')
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vFlowY;\nvec3 hueRot(vec3 c, float a){vec3 k=vec3(0.57735);float cs=cos(a),sn=sin(a);return c*cs+cross(k,c)*sn+k*dot(k,c)*(1.0-cs);}\nvec3 sat(vec3 c,float s){float l=dot(c,vec3(0.299,0.587,0.114));return mix(vec3(l),c,s);}')
          .replace('#include <color_fragment>', '#include <color_fragment>\nvec3 aur = sat(hueRot(vColor.rgb, sin(vFlowY*0.9 + uTime*0.6)*0.9 + uTime*0.25), 2.4);\ndiffuseColor.rgb = aur;')
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance = sat(hueRot(vColor.rgb, sin(vFlowY*0.9 + uTime*0.6)*0.9 + uTime*0.25), 2.4) * 0.35;')
        m.userData.shader = shader
      }
      o.material = m
      bergMats.push(m)
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

// ─── Aurora curtain (the "colour to the ice" motif, in 3D) ─────────────
// Custom shader: flowing vertical bands cycling the brand palette. Additive,
// fog-free, behind the iceberg. Intensity grows with scroll progress.
const auroraMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.NormalBlending,   // light background: additive washes out
  side: THREE.DoubleSide,
  uniforms: { uTime: { value: 0 }, uProgress: { value: 0 }, uHue: { value: 0 } },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform float uTime;
    uniform float uProgress;
    uniform float uHue;
    varying vec2 vUv;
    // brand aurora ramp: teal → blue → violet → pink → amber
    vec3 palette(float t) {
      vec3 a = vec3(0.353,0.819,0.784);
      vec3 b = vec3(0.416,0.651,1.000);
      vec3 c = vec3(0.725,0.549,1.000);
      vec3 d = vec3(1.000,0.561,0.690);
      vec3 e = vec3(1.000,0.722,0.420);
      float x = fract(t) * 4.0;
      if (x < 1.0) return mix(a, b, x);
      if (x < 2.0) return mix(b, c, x - 1.0);
      if (x < 3.0) return mix(c, d, x - 2.0);
      return mix(d, e, x - 3.0);
    }
    void main() {
      vec2 uv = vUv;
      float wave = sin(uv.x * 8.0 + uTime * 0.6) * 0.04
                 + sin(uv.x * 17.0 - uTime * 0.9) * 0.02;
      float y = uv.y + wave;
      float curtain = smoothstep(0.0, 0.5, y) * smoothstep(1.0, 0.5, y);
      float streak = 0.5 + 0.5 * sin(uv.x * 40.0 + sin(uv.x * 6.0 + uTime * 0.5) * 3.0 + uTime * 0.8);
      streak = pow(streak, 2.0);
      vec3 col = palette(uv.x * 0.6 + uTime * 0.03 + uProgress * 0.3 + uHue);
      float alpha = curtain * (0.30 + 0.50 * streak) * (0.45 + 0.55 * uProgress);
      gl_FragColor = vec4(col, alpha * 0.8);
    }
  `,
})
const aurora = new THREE.Mesh(new THREE.PlaneGeometry(46, 24, 1, 1), auroraMat)
aurora.position.set(0, 6, -11)
scene.add(aurora)

// Coloured light that cycles the palette → the white ice picks up shifting colour
const auroraLight = new THREE.PointLight(0x6aa6ff, 2.2, 22, 2)
auroraLight.position.set(-3, 5, 4)
scene.add(auroraLight)

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

// pointer parallax + scroll-reactive spin (immersion)
const pointer = { tx: 0, ty: 0, x: 0, y: 0 }
let spinExtra = 0
addEventListener('pointermove', (e) => {
  pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2
  pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2
}, { passive: true })

function sampleCamera(progress) {
  const segs = keys.length - 1
  const s = Math.min(progress * segs, segs - 1e-5)
  const i = Math.floor(s)
  const t = smooth(s - i)
  const a = keys[i], b = keys[i + 1]
  tA.copy(a.p).lerp(b.p, t)
  camera.position.set(tA.x + pointer.x * 0.9, tA.y - pointer.y * 0.55, tA.z)
  look.copy(tB.copy(a.l).lerp(b.l, t))
  camera.lookAt(look)
  berg.rotation.y = a.rot + (b.rot - a.rot) * t + spinExtra
}

// section hues (0..1): hero teal · studio blue · work violet · process pink · end amber
const SECTION_HUES = [0.48, 0.58, 0.74, 0.92, 0.09]
let litHue = SECTION_HUES[0]

const scrollState = { p: 0 }
ScrollTrigger.create({
  trigger: document.documentElement,
  start: 'top top',
  end: () => `+=${document.documentElement.scrollHeight - window.innerHeight}`,
  onUpdate: (self) => {
    scrollState.p = self.progress
    if (!reduceMotion) spinExtra += self.getVelocity() * -0.00006  // flick the berg with scroll speed
  },
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
  const e = reduceMotion ? 0 : clock.getElapsedTime()
  if (!reduceMotion) {
    // ease pointer parallax + decay the scroll-spin back to rest
    pointer.x += (pointer.tx - pointer.x) * 0.05
    pointer.y += (pointer.ty - pointer.y) * 0.05
    spinExtra *= 0.94
  }
  sampleCamera(scrollState.p)

  // aurora curtain + section-synced colour-cycling light on the ice
  auroraMat.uniforms.uTime.value = e
  auroraMat.uniforms.uProgress.value = scrollState.p
  // hue per section: teal → blue → violet → pink → amber (matches brand ramp)
  const segs = SECTION_HUES.length - 1
  const sp = Math.min(scrollState.p * segs, segs - 1e-5)
  const si = Math.floor(sp), sf = sp - si
  const targetHue = SECTION_HUES[si] + (SECTION_HUES[si + 1] - SECTION_HUES[si]) * sf
  litHue += (targetHue - litHue) * 0.04                 // ease toward section hue
  auroraLight.color.setHSL((litHue + 0.04 * Math.sin(e * 0.25) + 1) % 1, 0.78, 0.62)
  auroraMat.uniforms.uHue.value = litHue
  auroraLight.intensity = 2.4 + Math.sin(e * 0.8) * 0.4
  auroraLight.position.x = Math.sin(e * 0.3) * 5
  auroraLight.position.z = 3 + Math.cos(e * 0.3) * 3

  // iceberg emissive glows through the section hue → colour ON the ice
  for (const m of bergMats) {
    if (m.userData.shader) m.userData.shader.uniforms.uTime.value = e  // drive the hue flow
  }

  // idle float on the iceberg + drifting snow (frozen when reduced motion)
  if (icebergMesh) icebergMesh.position.y = Math.sin(e * 0.5) * 0.08
  snow.rotation.y = e * 0.01
  if (!reduceMotion) {
    const pos = snowGeo.attributes.position
    for (let i = 0; i < SNOW; i++) {
      let y = pos.getY(i) - 0.01
      if (y < -15) y = 15
      pos.setY(i, y)
    }
    pos.needsUpdate = true
  }

  if (pctEl) pctEl.textContent = String(Math.round(scrollState.p * 100)).padStart(3, '0')
  composer.render()
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
  composer.setSize(w, h)
  composer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  bloom.setSize(w, h)
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
