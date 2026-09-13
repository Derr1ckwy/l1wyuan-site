import { useEffect, useRef } from 'react'

type Star = {
  x: number
  y: number
  vx: number
  vy: number
  hx: number
  hy: number
  r: number
  base: number
  amp: number
  speed: number
  phase: number
  tint: string
}

type Chain = {
  points: Star[]
  width: number
  speed: number
  phase: number
}

type Meteor = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
}

const TINTS = ['255,255,255', '190,205,255', '255,235,200', '170,220,255']

// 相互牵引的引力参数
const G = 720000 // 引力强度
const SOFT = 2600 // 距离软化（防止近距叠合）
const HOME_K = 0.018 // 回位弹簧（防止整体坍缩/漂走）
const DAMPING = 0.32 // 速度阻尼 /s
const VMAX = 26 // 最大速度 px/s

// 鼠标 = 最大的一颗星
const MOUSE_G = 2600000 // 鼠标引力强度
const MOUSE_SOFT = 5200 // 鼠标引力软化距离²
const MOUSE_R = 300 // 引力作用半径 px

function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}

export function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const cv = canvas
    const c = ctx

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let w = 0
    let h = 0
    let raf = 0
    let stars: Star[] = []
    let chains: Chain[] = []
    let meteors: Meteor[] = []
    let nextMeteorAt = performance.now() + rand(2500, 6000)
    const mouse = { x: 0, y: 0, tx: 0, ty: 0, px: 0, py: 0 }
    let lastMoveAt = 0
    let lastRelinkAt = 0

    // 跟随鼠标的星链
    const CHAIN_NODES = 7
    let pointerChain: { x: number; y: number }[] = []
    let pointerChainAlpha = 0.3

    function initPointerChain() {
      pointerChain = Array.from({ length: CHAIN_NODES }, () => ({ x: w / 2, y: h / 2 }))
      mouse.px = w / 2
      mouse.py = h / 2
    }

    function seed() {
      stars = []
      chains = []
      meteors = []

      const count = Math.max(90, Math.min(240, Math.floor((w * h) / 8500)))
      for (let i = 0; i < count; i++) {
        const x = Math.random() * w
        const y = Math.random() * h
        stars.push({
          x,
          y,
          vx: rand(-4, 4),
          vy: rand(-4, 4),
          hx: x,
          hy: y,
          r: rand(0.4, 1.6),
          base: rand(0.25, 0.75),
          amp: rand(0.1, 0.35),
          speed: rand(0.4, 1.4),
          phase: rand(0, Math.PI * 2),
          tint: TINTS[Math.floor(Math.random() * TINTS.length)],
        })
      }
      buildChains()
    }

    // 星链：把空间上相近的星星连成星座状折线
    function buildChains() {
      chains = []
      const used = new Set<Star>()
      const chainCount = Math.max(4, Math.floor(stars.length / 34))
      for (let c = 0; c < chainCount; c++) {
        growChain(used)
      }
      lastRelinkAt = performance.now()
    }

    // 从某个未使用的星星出发，贪心地就近连成一条链
    function growChain(used: Set<Star>) {
      let current = stars[Math.floor(Math.random() * stars.length)]
      if (used.has(current)) return
      const points: Star[] = [current]
      used.add(current)
      for (let k = 0; k < 4; k++) {
        let best: Star | null = null
        let bestDist = Infinity
        for (const s of stars) {
          if (used.has(s)) continue
          const d = Math.hypot(s.x - current.x, s.y - current.y)
          if (d < bestDist) {
            bestDist = d
            best = s
          }
        }
        if (!best || bestDist > Math.min(w, h) * 0.28) break
        points.push(best)
        used.add(best)
        current = best
      }
      if (points.length >= 3) {
        chains.push({ points, width: rand(0.5, 1), speed: rand(0.2, 0.6), phase: rand(0, Math.PI * 2) })
      }
    }

    // 星链只增不减：只为尚未入链的星星补充新链，已有的链永不消失
    function extendChains() {
      const used = new Set<Star>()
      for (const ch of chains) {
        for (const p of ch.points) used.add(p)
      }
      const desired = Math.max(4, Math.floor(stars.length / 30))
      let guard = 0
      while (chains.length < desired && guard++ < 30) {
        const before = chains.length
        growChain(used)
        if (chains.length === before) break
      }
      lastRelinkAt = performance.now()
    }

    // 星星间的相互引力 + 回位弹簧 + 阻尼
    function stepPhysics(dt: number) {
      const n = stars.length
      for (let i = 0; i < n; i++) {
        const a = stars[i]
        for (let j = i + 1; j < n; j++) {
          const b = stars[j]
          const dx = b.x - a.x
          const dy = b.y - a.y
          const d2 = dx * dx + dy * dy + SOFT
          const d = Math.sqrt(d2)
          const f = (G / d2) * dt
          const nx = dx / d
          const ny = dy / d
          a.vx += nx * f
          a.vy += ny * f
          b.vx -= nx * f
          b.vy -= ny * f
        }
      }

      const damp = Math.exp(-DAMPING * dt)
      for (const s of stars) {
        let ax = (s.hx - s.x) * HOME_K
        let ay = (s.hy - s.y) * HOME_K

        // 鼠标是最大的一颗星：半径内产生向它的引力，越近越强
        const mdx = mouse.px - s.x
        const mdy = mouse.py - s.y
        const md2 = mdx * mdx + mdy * mdy
        if (md2 < MOUSE_R * MOUSE_R) {
          const md = Math.sqrt(md2) || 1
          const fall = 1 - md / MOUSE_R
          const mf = (MOUSE_G / (md2 + MOUSE_SOFT)) * fall
          ax += (mdx / md) * mf
          ay += (mdy / md) * mf
        }

        s.vx = (s.vx + ax * dt) * damp
        s.vy = (s.vy + ay * dt) * damp

        const v = Math.hypot(s.vx, s.vy)
        if (v > VMAX) {
          s.vx = (s.vx / v) * VMAX
          s.vy = (s.vy / v) * VMAX
        }

        s.x += s.vx * dt
        s.y += s.vy * dt
      }
    }

    function resize() {
      w = window.innerWidth
      h = window.innerHeight
      cv.width = Math.floor(w * dpr)
      cv.height = Math.floor(h * dpr)
      cv.style.width = `${w}px`
      cv.style.height = `${h}px`
      c.setTransform(dpr, 0, 0, dpr, 0, 0)
      seed()
      initPointerChain()
      if (reduced) draw(0)
    }

    function spawnMeteor(now: number) {
      const fromLeft = Math.random() > 0.5
      const speed = rand(5, 8)
      const angle = rand(Math.PI * 0.12, Math.PI * 0.22)
      meteors.push({
        x: fromLeft ? rand(-40, w * 0.6) : rand(w * 0.4, w + 40),
        y: rand(-30, h * 0.35),
        vx: Math.cos(angle) * speed * (fromLeft ? 1 : -1),
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: rand(55, 85),
      })
      nextMeteorAt = now + rand(4500, 11000)
    }

    function draw(now: number) {
      const t = now / 1000
      mouse.x += (mouse.tx - mouse.x) * 0.04
      mouse.y += (mouse.ty - mouse.y) * 0.04
      const px = mouse.x * 14
      const py = mouse.y * 10

      c.clearRect(0, 0, w, h)

      // 星链连线（微弱、缓慢呼吸）
      for (const chain of chains) {
        const alpha = 0.05 + 0.045 * (0.5 + 0.5 * Math.sin(t * chain.speed + chain.phase))
        c.strokeStyle = `rgba(150,175,255,${alpha.toFixed(3)})`
        c.lineWidth = chain.width
        c.beginPath()
        chain.points.forEach((s, i) => {
          const x = s.x + px * 0.6
          const y = s.y + py * 0.6
          if (i === 0) c.moveTo(x, y)
          else c.lineTo(x, y)
        })
        c.stroke()
      }

      // 星星（三层视差 + 闪烁）
      const layers = [
        { factor: 0.3, size: 0.8 },
        { factor: 0.65, size: 1 },
        { factor: 1, size: 1.25 },
      ]
      layers.forEach((layer, li) => {
        for (let i = li; i < stars.length; i += layers.length) {
          const s = stars[i]
          const tw = reduced ? 0 : Math.sin(t * s.speed + s.phase) * s.amp
          const alpha = Math.max(0.05, Math.min(1, s.base + tw))
          c.fillStyle = `rgba(${s.tint},${alpha.toFixed(3)})`
          c.beginPath()
          c.arc(s.x + px * layer.factor, s.y + py * layer.factor, s.r * layer.size, 0, Math.PI * 2)
          c.fill()
        }
      })

      // 流星
      if (!reduced) {
        if (now >= nextMeteorAt && meteors.length < 2) spawnMeteor(now)
        meteors = meteors.filter((m) => m.life < m.maxLife)
        for (const m of meteors) {
          m.x += m.vx
          m.y += m.vy
          m.life++
          const p = m.life / m.maxLife
          const fade = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85
          const tail = 12
          const grad = c.createLinearGradient(
            m.x,
            m.y,
            m.x - m.vx * tail,
            m.y - m.vy * tail,
          )
          grad.addColorStop(0, `rgba(220,230,255,${(0.8 * fade).toFixed(3)})`)
          grad.addColorStop(1, 'rgba(220,230,255,0)')
          c.strokeStyle = grad
          c.lineWidth = 1.4
          c.beginPath()
          c.moveTo(m.x, m.y)
          c.lineTo(m.x - m.vx * tail, m.y - m.vy * tail)
          c.stroke()
        }

        // 跟随鼠标的星链（最上层）
        drawPointerChain(px, py)
      }
    }

    function updatePointerChain(now: number) {
      const active = now - lastMoveAt < 2500
      // 常驻最低亮度：星链不消失，鼠标活动时全亮
      const target = active ? 1 : 0.3
      pointerChainAlpha += (target - pointerChainAlpha) * 0.07
      if (pointerChainAlpha < 0.01) return

      const head = pointerChain[0]
      head.x += (mouse.px - head.x) * 0.34
      head.y += (mouse.py - head.y) * 0.34
      for (let i = 1; i < pointerChain.length; i++) {
        const node = pointerChain[i]
        const prev = pointerChain[i - 1]
        node.x += (prev.x - node.x) * 0.27
        node.y += (prev.y - node.y) * 0.27
      }
    }

    function drawPointerChain(px: number, py: number) {
      if (pointerChainAlpha < 0.02) return
      const n = pointerChain.length
      const head = pointerChain[0]

      // 鼠标 = 最大的一颗星：外层光晕
      const haloR = 34
      const halo = c.createRadialGradient(head.x, head.y, 0, head.x, head.y, haloR)
      halo.addColorStop(0, `rgba(205,222,255,${(0.3 * pointerChainAlpha).toFixed(3)})`)
      halo.addColorStop(0.4, `rgba(160,185,255,${(0.12 * pointerChainAlpha).toFixed(3)})`)
      halo.addColorStop(1, 'rgba(160,185,255,0)')
      c.fillStyle = halo
      c.fillRect(head.x - haloR, head.y - haloR, haloR * 2, haloR * 2)

      // 被吸附到鼠标周围的星星，与链头连线（像被这颗大星俘获）
      let captured = 0
      for (const s of stars) {
        if (captured >= 6) break
        const sx = s.x + px
        const sy = s.y + py
        const d = Math.hypot(sx - head.x, sy - head.y)
        if (d < 160 && d > 14) {
          const k = 1 - d / 160
          c.strokeStyle = `rgba(170,196,255,${(pointerChainAlpha * (0.08 + 0.22 * k)).toFixed(3)})`
          c.lineWidth = 0.7
          c.beginPath()
          c.moveTo(head.x, head.y)
          c.lineTo(sx, sy)
          c.stroke()
          captured++
        }
      }

      // 链身：头部亮、尾部渐淡
      for (let i = 0; i < n - 1; i++) {
        const a = pointerChain[i]
        const b = pointerChain[i + 1]
        const p = i / (n - 1)
        const tint = i < 2 ? '152,182,255' : '186,164,255'
        c.strokeStyle = `rgba(${tint},${(pointerChainAlpha * (0.55 - p * 0.32)).toFixed(3)})`
        c.lineWidth = 1.8 - p * 1.15
        c.beginPath()
        c.moveTo(a.x, a.y)
        c.lineTo(b.x, b.y)
        c.stroke()
      }

      // 节点：头部大亮带辉光，尾部渐小
      for (let i = 0; i < n; i++) {
        const node = pointerChain[i]
        const p = i / (n - 1)
        const alpha = pointerChainAlpha * (1 - p * 0.62)
        c.save()
        c.shadowColor = 'rgba(150,185,255,0.9)'
        c.shadowBlur = i === 0 ? 18 : 8
        c.fillStyle = `rgba(236,243,255,${alpha.toFixed(3)})`
        c.beginPath()
        c.arc(node.x, node.y, (i === 0 ? 3.6 : 2.7) * (1 - p * 0.72), 0, Math.PI * 2)
        c.fill()
        c.restore()
      }
    }

    let lastFrame = 0
    function tick(now: number) {
      if (!reduced) {
        const dt = Math.min(0.05, lastFrame ? (now - lastFrame) / 1000 : 0.016)
        lastFrame = now
        stepPhysics(dt)
        if (now - lastRelinkAt > 5000) extendChains()
      }
      updatePointerChain(now)
      draw(now)
      raf = requestAnimationFrame(tick)
    }

    function onMouse(e: MouseEvent) {
      mouse.tx = e.clientX / w - 0.5
      mouse.ty = e.clientY / h - 0.5
      mouse.px = e.clientX
      mouse.py = e.clientY
      lastMoveAt = performance.now()
    }

    resize()
    window.addEventListener('resize', resize)
    if (!reduced) {
      window.addEventListener('mousemove', onMouse)
      raf = requestAnimationFrame(tick)
    }

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouse)
    }
  }, [])

  return <canvas ref={ref} className="starfield" aria-hidden="true" />
}
