import { useEffect, useRef } from 'react'

type Star = {
  x: number
  y: number
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
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 }

    function seed() {
      stars = []
      chains = []
      meteors = []

      const count = Math.max(90, Math.min(240, Math.floor((w * h) / 8500)))
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: rand(0.4, 1.6),
          base: rand(0.25, 0.75),
          amp: rand(0.1, 0.35),
          speed: rand(0.4, 1.4),
          phase: rand(0, Math.PI * 2),
          tint: TINTS[Math.floor(Math.random() * TINTS.length)],
        })
      }

      // 星链：把空间上相近的星星连成星座状折线
      const used = new Set<Star>()
      const chainCount = Math.max(4, Math.floor(count / 34))
      for (let c = 0; c < chainCount; c++) {
        let current = stars[Math.floor(Math.random() * stars.length)]
        if (used.has(current)) continue
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
      }
    }

    function tick(now: number) {
      draw(now)
      raf = requestAnimationFrame(tick)
    }

    function onMouse(e: MouseEvent) {
      mouse.tx = e.clientX / w - 0.5
      mouse.ty = e.clientY / h - 0.5
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
