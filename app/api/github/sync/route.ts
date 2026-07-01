import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { getGitHubToken, requireUserUid } from "@/lib/server-auth"
import {
  getAllAppInstallationRepos,
  getAppInstallations,
  getInstallationToken,
  getUserInstallationRepos,
  getUserInstallations,
} from "@/lib/integrations/github-app"
import { checkRateLimit } from "@/lib/rate-limit-plan"

export const runtime = "nodejs"

const GITHUB_API = "https://api.github.com"

type GitHubSyncIssue = {
  code: string
  message: string
  action?: string
  detail?: string
  status?: number
}

async function getProject(projectId: string) {
  const snap = await adminDb.collection("projects").doc(projectId).get()
  if (!snap.exists) return null
  const data = snap.data() as {
    name?: string
    files?: { path: string; content: string }[]
    githubRepoFullName?: string
    githubInstallationId?: number
  }
  const files = Array.isArray(data?.files) ? data.files : null
  return { data, files }
}

function slugifyRepoName(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
  return slug || "lotus-build-site"
}

function githubSyncIssueResponse(issue: GitHubSyncIssue) {
  return NextResponse.json(
    {
      ok: false,
      error: issue.code,
      code: issue.code,
      message: issue.message,
      action: issue.action || "Retry sync",
      githubSyncUnavailable: true,
      ...(issue.detail ? { detail: issue.detail.slice(0, 500) } : {}),
    },
    { status: issue.status ?? 409 }
  )
}

function publicGitHubSyncIssue(err: unknown): GitHubSyncIssue {
  const raw = err instanceof Error ? err.message : String(err || "")
  const normalized = raw.toLowerCase()

  if (normalized.includes("bad credentials") || normalized.includes("requires authentication") || normalized.includes("unauthorized")) {
    return {
      code: "github_reconnect_required",
      message: "GitHub needs to be reconnected before this project can sync.",
      action: "Reconnect GitHub",
      status: 401,
    }
  }

  if (normalized.includes("rate limit")) {
    return {
      code: "github_rate_limited",
      message: "GitHub is rate limiting repository sync right now. Please retry in a few minutes.",
      action: "Retry sync",
      status: 429,
    }
  }

  if (normalized.includes("not configured") || normalized.includes("private key") || normalized.includes("installation")) {
    return {
      code: "github_app_access_required",
      message: "GitHub is connected, but repository access is not ready. Install or grant the GitHub App access to a repository, then retry.",
      action: "Manage GitHub access",
      status: 409,
    }
  }

  return {
    code: "github_sync_failed",
    message: "GitHub sync could not complete right now. Your project files are safe; retry the sync in a moment.",
    action: "Retry sync",
    status: 502,
  }
}

function withLotusBuildCiWorkflow(files: { path: string; content: string }[]) {
  const hasWorkflow = files.some((file) => file.path === ".github/workflows/lotus-build-ci.yml")
  if (hasWorkflow) return files

  return [
    ...files,
    {
      path: ".github/workflows/lotus-build-ci.yml",
      content: [
        "name: Lotus Build CI",
        "",
        "on:",
        "  push:",
        "    branches: [main]",
        "  pull_request:",
        "    branches: [main]",
        "",
        "jobs:",
        "  build:",
        "    runs-on: ubuntu-latest",
        "    steps:",
        "      - uses: actions/checkout@v4",
        "      - uses: actions/setup-node@v4",
        "        with:",
        "          node-version: 20",
        "          cache: npm",
        "      - run: npm install --no-audit --no-fund",
        "      - run: npm run build",
        "",
      ].join("\n"),
    },
  ]
}

async function createRepositoryForInstallation(params: {
  userToken: string
  installationId: number
  ownerLogin: string
  ownerType?: string | null
  baseName: string
  description?: string
}): Promise<{ repoFullName: string; installationId: number }> {
  const ownerType = String(params.ownerType || "").toLowerCase()
  const candidateNames = [
    params.baseName,
    `${params.baseName}-${Date.now().toString().slice(-6)}`,
    `${params.baseName}-${Math.random().toString(36).slice(2, 8)}`,
  ]

  for (const name of candidateNames) {
    if (!name) continue

    if (ownerType === "organization") {
      const installationToken = await getInstallationToken(params.installationId)
      const res = await githubRequest(installationToken, "POST", `/orgs/${params.ownerLogin}/repos`, {
        name,
        description: params.description,
        private: true,
        auto_init: true,
      })
      if (res.ok) {
        const json = await res.json()
        return {
          repoFullName: String(json?.full_name || `${params.ownerLogin}/${name}`),
          installationId: params.installationId,
        }
      }
      const errText = await res.text().catch(() => "")
      if (res.status !== 422) {
        throw new Error(`Failed to create GitHub repository: ${res.status} ${errText}`)
      }
      continue
    }

    const res = await githubRequest(params.userToken, "POST", "/user/repos", {
      name,
      description: params.description,
      private: true,
      auto_init: true,
    })
    if (res.ok) {
      const json = await res.json()
      return {
        repoFullName: String(json?.full_name || `${params.ownerLogin}/${name}`),
        installationId: params.installationId,
      }
    }
    const errText = await res.text().catch(() => "")
    if (res.status !== 422) {
      throw new Error(`Failed to create GitHub repository: ${res.status} ${errText}`)
    }
  }

  throw new Error("Could not create a unique GitHub repository name for this project.")
}

async function githubRequest(
  token: string,
  method: string,
  path: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; json: () => Promise<any>; text: () => Promise<string> }> {
  if (!path.startsWith("/")) {
    throw new Error("Invalid GitHub API path.")
  }
  if (path.includes("://") || path.includes("\\") || path.includes("..")) {
    throw new Error("Unsafe GitHub API path.")
  }

  const baseUrl = new URL(GITHUB_API)
  const url = new URL(path, baseUrl)
  if (url.origin !== baseUrl.origin) {
    throw new Error("GitHub API origin mismatch.")
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return res
}

async function writeFilesToRepo(params: {
  installationToken: string
  owner: string
  repoName: string
  files: { path: string; content: string }[]
}) {
  const encodedOwner = encodeURIComponent(params.owner)
  const encodedRepoName = encodeURIComponent(params.repoName)

  for (const file of params.files) {
    const path = file.path
    const content = Buffer.from(file.content, "utf8").toString("base64")
    const encodedPath = path.split("/").map(encodeURIComponent).join("/")

    let sha: string | undefined
    const getRes = await githubRequest(
      params.installationToken,
      "GET",
      `/repos/${encodedOwner}/${encodedRepoName}/contents/${encodedPath}`
    )
    if (getRes.ok) {
      const getJson = await getRes.json()
      sha = getJson?.sha
    }

    const putRes = await githubRequest(
      params.installationToken,
      "PUT",
      `/repos/${encodedOwner}/${encodedRepoName}/contents/${encodedPath}`,
      {
        message: `Sync from Lotus Build: ${path}`,
        content,
        ...(sha ? { sha } : {}),
      }
    )

    if (!putRes.ok) {
      const errText = await putRes.text().catch(() => "")
      throw new Error(`GitHub rejected ${path} (${putRes.status}): ${errText}`)
    }
  }
}

export async function POST(req: Request) {
  const blocked = await checkRateLimit(req, "sync")
  if (blocked) return blocked
  try {
    const uid = await requireUserUid(req)
    const token = await getGitHubToken(uid)
    if (!token) {
      return githubSyncIssueResponse({
        code: "github_not_connected",
        message: "Connect GitHub before syncing this project.",
        action: "Connect GitHub",
        status: 409,
      })
    }

    let projectId: string
    try {
      const body = await req.json()
      projectId = String(body?.projectId ?? "")
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 })
    }

    // Verify the requesting user owns or has edit access to this project
    const { assertProjectCanEdit } = await import("@/lib/project-access")
    await assertProjectCanEdit(projectId, uid)

    const project = await getProject(projectId)
    if (!project || !project.files || project.files.length === 0) {
      return NextResponse.json({ error: "Project not found or has no files" }, { status: 404 })
    }

    const { data: projectData } = project
    const files = withLotusBuildCiWorkflow(project.files)
    const installations = await getUserInstallations(token)
    const appInstallations = await getAppInstallations().catch(() => [])
    if (!installations.length) {
      try {
        const fallbackRepos = await getAllAppInstallationRepos()
        if (fallbackRepos.length) {
          const preferredRepoFullName = String(projectData?.githubRepoFullName || "")
          const selectedRepo =
            (preferredRepoFullName
              ? fallbackRepos.find((repo) => String(repo.full_name) === preferredRepoFullName)
              : null) || fallbackRepos[0]

          if (selectedRepo?.full_name) {
            const installationId = Number(selectedRepo.installationId)
            const [owner, repoName] = String(selectedRepo.full_name).split("/")
            if (!owner || !repoName) {
              return NextResponse.json({ error: "Invalid GitHub repository on project." }, { status: 400 })
            }

            const installationToken = await getInstallationToken(installationId)
            await writeFilesToRepo({ installationToken, owner, repoName, files })

            const repoUrl = `https://github.com/${selectedRepo.full_name}`
            const syncedAt = new Date()

            await adminDb.collection("projects").doc(projectId).set(
              {
                githubRepoUrl: repoUrl,
                githubRepoFullName: selectedRepo.full_name,
                githubInstallationId: installationId,
                githubSyncedAt: syncedAt,
              },
              { merge: true }
            )

            return NextResponse.json({
              ok: true,
              repoUrl,
              repoFullName: selectedRepo.full_name,
              syncedAt: syncedAt.toISOString(),
              filesCount: files.length,
            })
          }
        }
      } catch (fallbackError) {
        console.warn("GitHub app fallback sync failed:", fallbackError)
        return githubSyncIssueResponse(publicGitHubSyncIssue(fallbackError))
      }

      return githubSyncIssueResponse({
        code: "github_app_access_required",
        message: "No repositories are available to the GitHub App yet. Install the app on at least one repository, then retry sync.",
        action: "Manage GitHub access",
        status: 409,
      })
    }

    let installationId = Number(projectData?.githubInstallationId || 0)
    const preferredRepoFullName = String(projectData?.githubRepoFullName || "")
    let repoFullName = preferredRepoFullName

    for (const installation of installations) {
      const iid = Number(installation.id)
      if (!iid) continue
      const repos = await getUserInstallationRepos(token, iid)
      if (!repos.length) continue

      if (preferredRepoFullName) {
        const found = repos.find((r) => String(r.full_name) === preferredRepoFullName)
        if (found) {
          installationId = iid
          repoFullName = preferredRepoFullName
          break
        }
      }

      // Fallback: if the saved repo is no longer accessible, use first installed repo.
      installationId = iid
      repoFullName = String(repos[0]?.full_name || "")
      if (repoFullName) break
    }

    if (!installationId || !repoFullName) {
      try {
        const fallbackRepos = await getAllAppInstallationRepos()
        const preferredRepo =
          (preferredRepoFullName
            ? fallbackRepos.find((repo) => String(repo.full_name) === preferredRepoFullName)
            : null) || fallbackRepos[0]

        if (preferredRepo?.full_name) {
          installationId = Number(preferredRepo.installationId)
          repoFullName = String(preferredRepo.full_name)
        }
      } catch (fallbackError) {
        console.warn("GitHub fallback repo resolution failed:", fallbackError)
      }
    }

    if (!installationId || !repoFullName) {
      const chosenInstallationId =
        Number(projectData?.githubInstallationId || 0) ||
        Number(installations[0]?.id || 0) ||
        Number(appInstallations[0]?.id || 0)

      const chosenInstallation = appInstallations.find((installation) => Number(installation.id) === chosenInstallationId) || appInstallations[0]
      const ownerLogin = String(chosenInstallation?.account?.login || "")
      const ownerType = String(chosenInstallation?.account?.type || "")

      if (!chosenInstallationId || !ownerLogin) {
        return githubSyncIssueResponse({
          code: "github_app_access_required",
          message: "No repository or install target is available for GitHub sync. Grant repository access to the GitHub App, then retry.",
          action: "Manage GitHub access",
          status: 409,
        })
      }

      const created = await createRepositoryForInstallation({
        userToken: token,
        installationId: chosenInstallationId,
        ownerLogin,
        ownerType,
        baseName: slugifyRepoName(String(projectData?.name || `lotus-build-${projectId}`)),
        description: `Generated from Lotus Build project ${projectId}`,
      })

      installationId = created.installationId
      repoFullName = created.repoFullName
    }

    const [owner, repoName] = repoFullName.split("/")
    const repoSegmentRegex = /^[A-Za-z0-9._-]+$/
    if (!owner || !repoName || !repoSegmentRegex.test(owner) || !repoSegmentRegex.test(repoName)) {
      return NextResponse.json({ error: "Invalid GitHub repository on project." }, { status: 400 })
    }

    const installationToken = await getInstallationToken(installationId)
    await writeFilesToRepo({ installationToken, owner, repoName, files })

    const repoUrl = `https://github.com/${repoFullName}`
    const syncedAt = new Date()

    await adminDb.collection("projects").doc(projectId).set(
      {
        githubRepoUrl: repoUrl,
        githubRepoFullName: repoFullName,
        githubInstallationId: installationId,
        githubSyncedAt: syncedAt,
      },
      { merge: true }
    )

    return NextResponse.json({
      ok: true,
      repoUrl,
      repoFullName,
      syncedAt: syncedAt.toISOString(),
      filesCount: files.length,
    })
  } catch (err: unknown) {
    console.error("GitHub sync failed:", err)
    const issue = publicGitHubSyncIssue(err)
    return githubSyncIssueResponse(issue)
  }
}
