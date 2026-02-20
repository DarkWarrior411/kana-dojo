import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';
import { buildProgressSyncStorageKey, PROGRESS_SYNC_TTL_SECONDS } from './lib';

const mockHasRedisConfig = vi.fn();
const mockRedisGetJson = vi.fn();
const mockRedisSetJson = vi.fn();

vi.mock('@/shared/lib/redis', () => ({
  hasRedisConfig: () => mockHasRedisConfig(),
  redisGetJson: (...args: unknown[]) => mockRedisGetJson(...args),
  redisSetJson: (...args: unknown[]) => mockRedisSetJson(...args),
}));

const validSyncKey = 'sync-key-1234567890';
const validBody = {
  updatedAt: '2026-02-20T12:00:00.000Z',
  snapshot: {
    version: '0.1.14',
    createdAt: '2026-02-20T12:00:00.000Z',
    stats: { totalCorrect: 42 },
  },
};

function makeRequest(
  url: string,
  init?: RequestInit & { headers?: Record<string, string> },
) {
  return new Request(url, init) as NextRequest;
}

describe('GET /api/progress-sync', () => {
  beforeEach(() => {
    mockHasRedisConfig.mockReset();
    mockRedisGetJson.mockReset();
    mockRedisSetJson.mockReset();
    mockHasRedisConfig.mockReturnValue(true);
  });

  it('returns 503 when Redis is unavailable', async () => {
    mockHasRedisConfig.mockReturnValue(false);

    const response = await GET(
      makeRequest('http://localhost/api/progress-sync', {
        headers: { 'x-sync-key': validSyncKey },
      }),
    );

    expect(response.status).toBe(503);
    const data = (await response.json()) as { code: string };
    expect(data.code).toBe('SYNC_UNAVAILABLE');
  });

  it('returns 400 for missing sync key', async () => {
    const response = await GET(
      makeRequest('http://localhost/api/progress-sync'),
    );

    expect(response.status).toBe(400);
    const data = (await response.json()) as { code: string };
    expect(data.code).toBe('INVALID_SYNC_KEY');
  });

  it('returns 404 when no synced progress exists', async () => {
    mockRedisGetJson.mockResolvedValue(null);

    const response = await GET(
      makeRequest('http://localhost/api/progress-sync', {
        headers: { 'x-sync-key': validSyncKey },
      }),
    );

    expect(response.status).toBe(404);
    const data = (await response.json()) as { code: string };
    expect(data.code).toBe('NOT_FOUND');
    expect(mockRedisGetJson).toHaveBeenCalledWith(
      buildProgressSyncStorageKey(validSyncKey),
    );
  });

  it('returns stored snapshot when found', async () => {
    const storedRecord = {
      schemaVersion: 1 as const,
      updatedAt: '2026-02-20T12:00:00.000Z',
      serverUpdatedAt: '2026-02-20T12:00:01.000Z',
      snapshot: validBody.snapshot,
    };
    mockRedisGetJson.mockResolvedValue(storedRecord);

    const response = await GET(
      makeRequest('http://localhost/api/progress-sync', {
        headers: { 'x-sync-key': validSyncKey },
      }),
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      updatedAt: string;
      snapshot: unknown;
    };
    expect(data.updatedAt).toBe(storedRecord.updatedAt);
    expect(data.snapshot).toEqual(storedRecord.snapshot);
  });
});

describe('POST /api/progress-sync', () => {
  beforeEach(() => {
    mockHasRedisConfig.mockReset();
    mockRedisGetJson.mockReset();
    mockRedisSetJson.mockReset();
    mockHasRedisConfig.mockReturnValue(true);
  });

  it('returns 400 for invalid JSON body', async () => {
    const response = await POST(
      makeRequest('http://localhost/api/progress-sync', {
        method: 'POST',
        headers: {
          'x-sync-key': validSyncKey,
          'content-type': 'application/json',
        },
        body: '{"invalid"',
      }),
    );

    expect(response.status).toBe(400);
    const data = (await response.json()) as { code: string };
    expect(data.code).toBe('INVALID_PAYLOAD');
  });

  it('returns 409 when incoming payload is older than remote state', async () => {
    mockRedisGetJson.mockResolvedValue({
      schemaVersion: 1,
      updatedAt: '2026-02-20T12:30:00.000Z',
      serverUpdatedAt: '2026-02-20T12:30:01.000Z',
      snapshot: validBody.snapshot,
    });

    const response = await POST(
      makeRequest('http://localhost/api/progress-sync', {
        method: 'POST',
        headers: {
          'x-sync-key': validSyncKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(validBody),
      }),
    );

    expect(response.status).toBe(409);
    const data = (await response.json()) as { code: string; latest?: unknown };
    expect(data.code).toBe('CONFLICT');
    expect(data.latest).toBeTruthy();
    expect(mockRedisSetJson).not.toHaveBeenCalled();
  });

  it('stores payload when incoming data is newer', async () => {
    mockRedisGetJson.mockResolvedValue({
      schemaVersion: 1,
      updatedAt: '2026-02-20T11:59:59.000Z',
      serverUpdatedAt: '2026-02-20T11:59:59.500Z',
      snapshot: validBody.snapshot,
    });
    mockRedisSetJson.mockResolvedValue(undefined);

    const response = await POST(
      makeRequest('http://localhost/api/progress-sync', {
        method: 'POST',
        headers: {
          'x-sync-key': validSyncKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(validBody),
      }),
    );

    expect(response.status).toBe(200);
    expect(mockRedisSetJson).toHaveBeenCalledTimes(1);
    const [key, payload, ttl] = mockRedisSetJson.mock.calls[0] as [
      string,
      { updatedAt: string; schemaVersion: number; snapshot: unknown },
      number,
    ];
    expect(key).toBe(buildProgressSyncStorageKey(validSyncKey));
    expect(payload.updatedAt).toBe(validBody.updatedAt);
    expect(payload.schemaVersion).toBe(1);
    expect(payload.snapshot).toEqual(validBody.snapshot);
    expect(ttl).toBe(PROGRESS_SYNC_TTL_SECONDS);
  });
});
