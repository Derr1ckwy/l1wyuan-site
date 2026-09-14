// 简单的进程内 TTL 缓存，用于公开只读接口（nav / markdown / assets tree）
// 单实例部署足够；重启即清空，无一致性问题。
// 注意：必须挂在 globalThis 上——Next dev 下各 route 可能拿到 cache 模块的不同副本，
// 普通模块级 Map 会导致"写路由失效缓存、读路由看不到"的灵异问题。

type Entry = { value: unknown; expiresAt: number }

const g = globalThis as unknown as { __adminCacheStore?: Map<string, Entry> }
const store = g.__adminCacheStore ?? (g.__adminCacheStore = new Map<string, Entry>())

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key)
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value as T
  }
  const value = await fn()
  store.set(key, { value, expiresAt: Date.now() + ttlMs })
  return value
}

export function invalidate(prefix: string) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}
