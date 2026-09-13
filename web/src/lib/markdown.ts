export async function loadMarkdown(mdPath: string): Promise<string> {
  const res = await fetch(`/content/${mdPath}.md`)
  if (!res.ok) {
    throw new Error(`Failed to load markdown: ${mdPath}`)
  }
  return await res.text()
}
