import { Octokit } from '@octokit/rest'
import { createAppAuth } from '@octokit/auth-app'

import {
  CONTENT_REPO_BRANCH,
  CONTENT_REPO_NAME,
  CONTENT_REPO_OWNER,
} from './config'

function mustEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

function getInstallationOctokit() {
  const appId = mustEnv('GITHUB_APP_ID')
  const privateKey = mustEnv('GITHUB_APP_PRIVATE_KEY').replace(/\\n/g, '\n')
  const installationId = Number(mustEnv('GITHUB_APP_INSTALLATION_ID'))

  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey,
      installationId,
    },
  })
}

async function getFileSha(params: {
  owner: string
  repo: string
  path: string
  branch: string
}): Promise<string | undefined> {
  const octokit = getInstallationOctokit()
  try {
    const res = await octokit.repos.getContent({
      owner: params.owner,
      repo: params.repo,
      path: params.path,
      ref: params.branch,
    })

    if (Array.isArray(res.data)) return undefined
    return (res.data as any).sha
  } catch (e: any) {
    if (e?.status === 404) return undefined
    throw new Error(`getContent failed: ${String(e?.status || '')} ${String(e?.message || e)}`)
  }
}

async function fetchContentOnce(params: {
  owner: string
  repo: string
  path: string
  branch: string
}): Promise<{ text: string; sha: string } | null> {
  const octokit = getInstallationOctokit()
  try {
    const res = await octokit.repos.getContent({
      owner: params.owner,
      repo: params.repo,
      path: params.path,
      ref: params.branch,
    })

    if (Array.isArray(res.data)) return null
    const data = res.data as { content?: string; sha?: string; encoding?: string }
    if (data.encoding === 'base64' && data.content) {
      return { text: Buffer.from(data.content, 'base64').toString('utf8'), sha: data.sha || '' }
    }
    return { text: String(data.content || ''), sha: data.sha || '' }
  } catch (e: any) {
    if (e?.status === 404) return null
    throw new Error(`getContent failed: ${String(e?.status || '')} ${String(e?.message || e)}`)
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function readTextFile(params: {
  owner: string
  repo: string
  path: string
  branch: string
}): Promise<{ text: string; sha: string } | null> {
  // GitHub contents API 在写入提交后可能短暂返回 404（副本同步延迟），
  // 对 404 做少量重试，避免“刚创建/改名就读不到”
  let last: { text: string; sha: string } | null = null
  for (let attempt = 0; attempt < 4; attempt++) {
    last = await fetchContentOnce(params)
    if (last !== null) return last
    await delay(600)
  }
  return null
}

export async function upsertTextFile(params: {
  path: string
  contentText: string
  message: string
}) {
  const octokit = getInstallationOctokit()

  const content = Buffer.from(params.contentText, 'utf8').toString('base64')

  // GitHub 副本同步延迟可能让 getFileSha 拿到过期 sha，写入被拒（422 does not match）。
  // 失败时重新取 sha 重试一次。
  let lastErr: unknown = null
  for (let attempt = 0; attempt < 2; attempt++) {
    const sha = await getFileSha({
      owner: CONTENT_REPO_OWNER,
      repo: CONTENT_REPO_NAME,
      path: params.path,
      branch: CONTENT_REPO_BRANCH,
    })
    try {
      const res = await octokit.repos.createOrUpdateFileContents({
        owner: CONTENT_REPO_OWNER,
        repo: CONTENT_REPO_NAME,
        path: params.path,
        branch: CONTENT_REPO_BRANCH,
        message: params.message,
        content,
        sha,
      })
      return res.data
    } catch (e: any) {
      lastErr = e
      if (e?.status === 422 && String(e?.message).includes('does not match')) {
        await delay(700)
        continue
      }
      throw e
    }
  }
  throw lastErr
}

// 递归列出目录下的所有文件（git tree API，一次请求）
export async function listRepoFiles(dir: string): Promise<
  { path: string; size: number; sha: string }[]
> {
  const octokit = getInstallationOctokit()

  // 先拿到分支根 tree sha
  const ref = await octokit.git.getRef({
    owner: CONTENT_REPO_OWNER,
    repo: CONTENT_REPO_NAME,
    ref: `heads/${CONTENT_REPO_BRANCH}`,
  })
  const rootSha = ref.data.object.sha

  const tree = await octokit.git.getTree({
    owner: CONTENT_REPO_OWNER,
    repo: CONTENT_REPO_NAME,
    tree_sha: rootSha,
    recursive: 'true',
  })

  const prefix = dir.endsWith('/') ? dir : `${dir}/`
  return tree.data.tree
    .filter((t) => t.type === 'blob' && t.path?.startsWith(prefix))
    .map((t) => ({ path: t.path as string, size: t.size || 0, sha: t.sha || '' }))
}

export async function deleteFile(params: { path: string; message: string }) {
  const octokit = getInstallationOctokit()

  const sha = await getFileSha({
    owner: CONTENT_REPO_OWNER,
    repo: CONTENT_REPO_NAME,
    path: params.path,
    branch: CONTENT_REPO_BRANCH,
  })
  if (!sha) return null

  const res = await octokit.repos.deleteFile({
    owner: CONTENT_REPO_OWNER,
    repo: CONTENT_REPO_NAME,
    path: params.path,
    branch: CONTENT_REPO_BRANCH,
    message: params.message,
    sha,
  })

  return res.data
}

// 写入二进制文件（图片等），content 已是 base64
export async function upsertBinaryFile(params: {
  path: string
  base64Content: string
  message: string
}) {
  const octokit = getInstallationOctokit()

  // 同 upsertTextFile：sha 过期（副本延迟）时重取重试一次
  let lastErr: unknown = null
  for (let attempt = 0; attempt < 2; attempt++) {
    const sha = await getFileSha({
      owner: CONTENT_REPO_OWNER,
      repo: CONTENT_REPO_NAME,
      path: params.path,
      branch: CONTENT_REPO_BRANCH,
    })
    try {
      const res = await octokit.repos.createOrUpdateFileContents({
        owner: CONTENT_REPO_OWNER,
        repo: CONTENT_REPO_NAME,
        path: params.path,
        branch: CONTENT_REPO_BRANCH,
        message: params.message,
        content: params.base64Content,
        sha,
      })
      return res.data
    } catch (e: any) {
      lastErr = e
      if (e?.status === 422 && String(e?.message).includes('does not match')) {
        await delay(700)
        continue
      }
      throw e
    }
  }
  throw lastErr
}

// 文件的 raw 访问地址（用于 <img src>）
export function rawFileUrl(path: string) {
  return `https://raw.githubusercontent.com/${CONTENT_REPO_OWNER}/${CONTENT_REPO_NAME}/${CONTENT_REPO_BRANCH}/${path}`
}

// 按 blob sha 读取二进制内容（git blob API 无 contents API 的 1MB 限制，适合图片）
export async function getBlobBytes(fileSha: string): Promise<Buffer> {
  const octokit = getInstallationOctokit()
  const res = await octokit.git.getBlob({
    owner: CONTENT_REPO_OWNER,
    repo: CONTENT_REPO_NAME,
    file_sha: fileSha,
  })
  return Buffer.from(res.data.content, 'base64')
}
