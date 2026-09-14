// 读取 markdown：优先走运行时 API（内容永远最新），API 不可用时回退静态副本
export async function loadMarkdown(mdPath: string): Promise<string> {
  try {
    const res = await fetch(`/api/public/content?path=${encodeURIComponent(mdPath)}`, {
      cache: 'no-store',
    })
    if (res.ok) return await res.text()
  } catch {
    // API 不可达，fall through 到静态副本
  }

  const res = await fetch(`${import.meta.env.BASE_URL}content/${mdPath}.md`)
  if (!res.ok) {
    throw new Error(`Failed to load markdown: ${mdPath}`)
  }
  return await res.text()
}
