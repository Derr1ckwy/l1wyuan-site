import { useEffect, useRef } from 'react'

type Star = {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  r: number
  base: number
  amp: number
  speed: number
  phase: number
  tint: string
  life: number // 剩余寿命 s，耗尽后淡出并从屏幕外重新飘入
  fade: number // 0~1 显隐过渡
  dying: boolean
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

// 相互影响参数：纯切向环绕 + 随机游走 + 近距斥力（没有任何吸引力 → 从构造上不会聚集）
const INTERACT_R = 120 // 只有近邻互相影响 px
const SWIRL_F = 8000 // 近邻环绕强度：让星星相互绕转，但只绕不吸
const WANDER = 18 // 随机游走强度：打散涡旋相干，保持漂移感
const DAMPING = 0.08 // 速度阻尼 /s（很小，保持漂流感）
const VMAX = 40 // 最大速度 px/s
const SOFT = 2600 // 距离软化（防止近距力过大）
const REPEL_R = 12 // 近距斥力半径 px
const REPEL_K = 30 // 近距斥力强度

// 鼠标 = 一股反引力风：靠近的星星被向外推开（蒲公英式），永不聚集
const MOUSE_G = 1500000 // 鼠标推力强度
const MOUSE_SOFT = 5200 // 鼠标推力软化距离²
const MOUSE_R = 240 // 推力作用半径 px
const MOUSE_SWIRL = 0.4 // 切向分量：星星打着旋儿被吹开
const MOUSE_IDLE_T = 3.5 // 鼠标静止时间常数 s：静止后推力指数衰减，星星漂回

// 星星生命周期：死亡后从屏幕外随机一边重新飘入，源源不断
const LIFE_MIN = 45 // 寿命 s
const LIFE_MAX = 100
const FADE_IN = 1.2 // 出生淡入速率 /s
const FADE_OUT = 2 // 死亡淡出速率 /s
const SPAWN_MARGIN = 40 // 出生点藏在屏幕外多远处 px
const IN_SPEED_MIN = 8 // 飘入速度 px/s
const IN_SPEED_MAX = 20
const CHAIN_BREAK = 200 // 星座连线两端星星超过这个距离就断开（被推散后不拉长途直线）

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

      const count = Math.max(400, Math.min(1500, Math.floor((w * h) / 864)))
      for (let i = 0; i < count; i++) {
        stars.push({
          id: i,
          x: Math.random() * w,
          y: Math.random() * h,
          vx: rand(-8, 8),
          vy: rand(-8, 8),
          r: rand(0.3, 1.2),
          base: rand(0.15, 0.55),
          amp: rand(0.08, 0.3),
          speed: rand(0.4, 1.4),
          phase: rand(0, Math.PI * 2),
          tint: TINTS[Math.floor(Math.random() * TINTS.length)],
          life: rand(LIFE_MIN, LIFE_MAX),
          fade: Math.random(), // 首屏星星错开淡入
          dying: false,
        })
      }
      buildChains()
    }

    // 星星从屏幕外随机一条边飘入：随机边、随机位置、随机内向速度
    function spawnStar(s: Star) {
      const edge = Math.floor(Math.random() * 4)
      const speed = rand(IN_SPEED_MIN, IN_SPEED_MAX)
      const tangential = rand(-8, 8)
      if (edge === 0) {
        s.x = rand(0, w)
        s.y = -SPAWN_MARGIN
        s.vx = tangential
        s.vy = speed
      } else if (edge === 1) {
        s.x = w + SPAWN_MARGIN
        s.y = rand(0, h)
        s.vx = -speed
        s.vy = tangential
      } else if (edge === 2) {
        s.x = rand(0, w)
        s.y = h + SPAWN_MARGIN
        s.vx = tangential
        s.vy = -speed
      } else {
        s.x = -SPAWN_MARGIN
        s.y = rand(0, h)
        s.vx = speed
        s.vy = tangential
      }
      s.r = rand(0.3, 1.2)
      s.base = rand(0.15, 0.55)
      s.amp = rand(0.08, 0.3)
      s.speed = rand(0.4, 1.4)
      s.phase = rand(0, Math.PI * 2)
      s.tint = TINTS[Math.floor(Math.random() * TINTS.length)]
      s.life = rand(LIFE_MIN, LIFE_MAX)
      s.fade = 0
      s.dying = false
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
        if (!best || bestDist > Math.min(w, h) * 0.2) break
        points.push(best)
        used.add(best)
        current = best
      }
      if (points.length >= 3) {
        chains.push({ points, width: rand(0.5, 1), speed: rand(0.2, 0.6), phase: rand(0, Math.PI * 2) })
      }
    }

    // 星链只增不减：只为尚未入链的星星补充新链，已有的链永不消失
    // 例外：所有连线都断开的链（星星被推散/换位置）会被移除，腾出星星组成新星座
    function extendChains() {
      chains = chains.filter((ch) => {
        for (let i = 0; i < ch.points.length - 1; i++) {
          const a = ch.points[i]
          const b = ch.points[i + 1]
          if (Math.hypot(b.x - a.x, b.y - a.y) <= CHAIN_BREAK) return true
        }
        return false
      })
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

    // 近邻间的相互影响：空间网格加速（1500 颗时 O(n²) 会卡死，只查 3×3 邻格）
    // 纯切向环绕 + 近距斥力（无吸引力，星星只绕不吸，不会聚集）
    function stepPhysics(dt: number) {
      // 把星星装进网格格子
      const CELL = INTERACT_R
      const cellKey = (cx: number, cy: number) => (cx + 16) * 64 + (cy + 16)
      const grid = new Map<number, Star[]>()
      for (const s of stars) {
        const k = cellKey(Math.floor(s.x / CELL), Math.floor(s.y / CELL))
        const arr = grid.get(k)
        if (arr) arr.push(s)
        else grid.set(k, [s])
      }

      // 每对星星只处理一次（b.id > a.id）
      for (const a of stars) {
        const cx = Math.floor(a.x / CELL)
        const cy = Math.floor(a.y / CELL)
        for (let ix = cx - 1; ix <= cx + 1; ix++) {
          for (let iy = cy - 1; iy <= cy + 1; iy++) {
            const arr = grid.get(cellKey(ix, iy))
            if (!arr) continue
            for (const b of arr) {
              if (b.id <= a.id) continue
              const dx = b.x - a.x
              const dy = b.y - a.y
              const rawD2 = dx * dx + dy * dy
              if (rawD2 > INTERACT_R * INTERACT_R) continue
              const d2 = rawD2 + SOFT
              const d = Math.sqrt(d2)
              const nx = dx / d
              const ny = dy / d
              // 纯切向：星星相互绕转（局部小漩涡），不产生任何吸引
              const sw = (SWIRL_F / d2) * dt
              const ax = -ny * sw
              const ay = nx * sw
              a.vx += ax
              a.vy += ay
              b.vx -= ax
              b.vy -= ay

              // 近距斥力：靠得太近就推开，杜绝坍缩成一个点
              if (rawD2 < REPEL_R * REPEL_R && rawD2 > 0.01) {
                const rd = Math.sqrt(rawD2)
                const push = REPEL_K * (1 - rd / REPEL_R) * dt
                const rx = (dx / rd) * push
                const ry = (dy / rd) * push
                a.vx -= rx
                a.vy -= ry
                b.vx += rx
                b.vy += ry
              }
            }
          }
        }
      }

      const damp = Math.exp(-DAMPING * dt)
      for (const s of stars) {
        // 随机游走：布朗运动式的小幅随机加速，打散相干漩涡、保持漂流感
        let ax = rand(-WANDER, WANDER)
        let ay = rand(-WANDER, WANDER)

        // 鼠标是一股"反引力风"：半径内的星星被向外推开（蒲公英式），永不聚集
        // 推力随静止时间指数衰减：鼠标不动几秒后星星漂回，恢复漫天分布
        const mdx = mouse.px - s.x
        const mdy = mouse.py - s.y
        const md2 = mdx * mdx + mdy * mdy
        if (md2 < MOUSE_R * MOUSE_R) {
          const idleSec = (performance.now() - lastMoveAt) / 1000
          const idleFade = Math.exp(-idleSec / MOUSE_IDLE_T)
          if (idleFade > 0.02) {
            const md = Math.sqrt(md2) || 1
            const fall = 1 - md / MOUSE_R
            const mf = (MOUSE_G / (md2 + MOUSE_SOFT)) * fall * idleFade
            const nx = mdx / md
            const ny = mdy / md
            const sw = MOUSE_SWIRL * mf
            // 径向向外推 + 一点切向：星星打着旋儿被吹开
            ax += -nx * mf - ny * sw
            ay += -ny * mf + nx * sw
          }
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

    // 生命周期：寿命耗尽开始淡出，完全隐去后从屏幕外飘入重生
    function stepLife(dt: number) {
      for (const s of stars) {
        if (!s.dying) {
          s.life -= dt
          if (s.life <= 0) s.dying = true
        }
        const target = s.dying ? 0 : 1
        const rate = s.dying ? FADE_OUT : FADE_IN
        s.fade += (target - s.fade) * (1 - Math.exp(-rate * dt))
        if (s.dying && s.fade <= 0.01) spawnStar(s)
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

      // 星链连线（微弱、缓慢呼吸；两端星星隐去时段同步变淡）
      for (const chain of chains) {
        const breath = 0.05 + 0.045 * (0.5 + 0.5 * Math.sin(t * chain.speed + chain.phase))
        for (let i = 0; i < chain.points.length - 1; i++) {
          const s0 = chain.points[i]
          const s1 = chain.points[i + 1]
          // 两端星星被推得太远就断开这条连线（否则散架的星座会拉出长途直线）
          if (Math.hypot(s1.x - s0.x, s1.y - s0.y) > CHAIN_BREAK) continue
          const alpha = breath * Math.min(s0.fade, s1.fade)
          if (alpha < 0.004) continue
          c.strokeStyle = `rgba(150,175,255,${alpha.toFixed(3)})`
          c.lineWidth = chain.width
          c.beginPath()
          c.moveTo(s0.x + px * 0.6, s0.y + py * 0.6)
          c.lineTo(s1.x + px * 0.6, s1.y + py * 0.6)
          c.stroke()
        }
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
          const alpha = Math.max(0.05, Math.min(1, s.base + tw)) * s.fade
          if (alpha < 0.01) continue
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

      // 被风吹到的星星，与链头连线（像被这股风掀起的星尘）
      let captured = 0
      for (const s of stars) {
        if (captured >= 6) break
        const sx = s.x + px
        const sy = s.y + py
        const d = Math.hypot(sx - head.x, sy - head.y)
        if (d < 160 && d > 14) {
          const k = (1 - d / 160) * s.fade
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
        stepLife(dt)
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
