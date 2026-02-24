import { NextResponse } from 'next/server';

const WORKFLOW_FILE = 'hourly-community-issue.yml';
const REPO_OWNER = 'lingdojo';
const REPO_NAME = 'kanadojo';

/**
 * POST /api/trigger-community-issue
 *
 * Called by Vercel Cron every 15 minutes.
 * Vercel automatically attaches: Authorization: Bearer <CRON_SECRET>
 *
 * Dispatches the community-issue GitHub Actions workflow via workflow_dispatch,
 * providing a reliable external trigger that bypasses GitHub's unreliable scheduler.
 *
 * Required env vars:
 *   CRON_SECRET  — must match the secret configured in Vercel project settings
 *   GITHUB_PAT   — fine-grained PAT with Actions: Read & Write on this repo
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const githubPat = process.env.GITHUB_PAT;

  if (!githubPat) {
    return NextResponse.json({ error: 'GITHUB_PAT not configured' }, { status: 500 });
  }

  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${githubPat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: 'main' }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`[trigger-community-issue] GitHub API error ${response.status}: ${body}`);
    return NextResponse.json(
      { error: 'GitHub API error', status: response.status },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
