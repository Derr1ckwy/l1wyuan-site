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

export async function readTextFile(params: {
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

export async function upsertTextFile(params: {
  path: string
  contentText: string
  message: string
}) {
  const octokit = getInstallationOctokit()

  const sha = await getFileSha({
    owner: CONTENT_REPO_OWNER,
    repo: CONTENT_REPO_NAME,
    path: params.path,
    branch: CONTENT_REPO_BRANCH,
  })

  const content = Buffer.from(params.contentText, 'utf8').toString('base64')

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
}
