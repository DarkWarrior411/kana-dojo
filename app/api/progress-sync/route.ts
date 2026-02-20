import { NextRequest, NextResponse } from 'next/server';
import { hasRedisConfig, redisGetJson, redisSetJson } from '@/shared/lib/redis';
import type { ApiErrorResponse } from '@/shared/types/api';
import {
  buildProgressSyncStorageKey,
  isProgressSyncRecord,
  normalizeSyncKey,
  PROGRESS_SYNC_TTL_SECONDS,
  shouldAcceptIncomingUpdate,
  validateProgressSyncRequestBody,
  type ProgressSyncRecord,
} from './lib';

const ERROR_CODES = {
  INVALID_SYNC_KEY: 'INVALID_SYNC_KEY',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  CONFLICT: 'CONFLICT',
  NOT_FOUND: 'NOT_FOUND',
  SYNC_UNAVAILABLE: 'SYNC_UNAVAILABLE',
  SERVER_ERROR: 'SERVER_ERROR',
} as const;

function createErrorResponse(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    {
      status,
      code,
      message,
      error: message,
      ...extra,
    } satisfies ApiErrorResponse & Record<string, unknown>,
    { status },
  );
}

function resolveSyncKey(request: Request): string | null {
  return normalizeSyncKey(request.headers.get('x-sync-key'));
}

function ensureSyncAvailable() {
  if (!hasRedisConfig()) {
    return createErrorResponse(
      503,
      ERROR_CODES.SYNC_UNAVAILABLE,
      'Progress sync backend is not configured.',
    );
  }
  return null;
}

export async function GET(request: NextRequest) {
  const unavailableResponse = ensureSyncAvailable();
  if (unavailableResponse) return unavailableResponse;

  const syncKey = resolveSyncKey(request);
  if (!syncKey) {
    return createErrorResponse(
      400,
      ERROR_CODES.INVALID_SYNC_KEY,
      'x-sync-key is missing or invalid.',
    );
  }

  const storageKey = buildProgressSyncStorageKey(syncKey);

  try {
    const stored = await redisGetJson<unknown>(storageKey);
    if (!isProgressSyncRecord(stored)) {
      return createErrorResponse(
        404,
        ERROR_CODES.NOT_FOUND,
        'No synced progress found for this key.',
      );
    }

    return NextResponse.json(
      {
        updatedAt: stored.updatedAt,
        serverUpdatedAt: stored.serverUpdatedAt,
        snapshot: stored.snapshot,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[progress-sync] GET failed:', error);
    return createErrorResponse(
      500,
      ERROR_CODES.SERVER_ERROR,
      'Failed to fetch synced progress.',
    );
  }
}

export async function POST(request: NextRequest) {
  const unavailableResponse = ensureSyncAvailable();
  if (unavailableResponse) return unavailableResponse;

  const syncKey = resolveSyncKey(request);
  if (!syncKey) {
    return createErrorResponse(
      400,
      ERROR_CODES.INVALID_SYNC_KEY,
      'x-sync-key is missing or invalid.',
    );
  }

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return createErrorResponse(
      400,
      ERROR_CODES.INVALID_PAYLOAD,
      'Request body must be valid JSON.',
    );
  }

  const validation = validateProgressSyncRequestBody(requestBody);
  if (!validation.ok) {
    return createErrorResponse(
      validation.error.code === 'PAYLOAD_TOO_LARGE' ? 413 : 400,
      ERROR_CODES[validation.error.code],
      validation.error.message,
    );
  }

  const storageKey = buildProgressSyncStorageKey(syncKey);

  try {
    const existing = await redisGetJson<unknown>(storageKey);
    const existingRecord = isProgressSyncRecord(existing) ? existing : null;

    if (
      existingRecord &&
      !shouldAcceptIncomingUpdate(
        existingRecord.updatedAt,
        validation.value.updatedAt,
      )
    ) {
      return createErrorResponse(409, ERROR_CODES.CONFLICT, 'Sync conflict.', {
        latest: {
          updatedAt: existingRecord.updatedAt,
          serverUpdatedAt: existingRecord.serverUpdatedAt,
          snapshot: existingRecord.snapshot,
        },
      });
    }

    const nextRecord: ProgressSyncRecord = {
      schemaVersion: 1,
      updatedAt: validation.value.updatedAt,
      snapshot: validation.value.snapshot,
      serverUpdatedAt: new Date().toISOString(),
    };

    await redisSetJson(storageKey, nextRecord, PROGRESS_SYNC_TTL_SECONDS);

    return NextResponse.json(
      {
        synced: true,
        updatedAt: nextRecord.updatedAt,
        serverUpdatedAt: nextRecord.serverUpdatedAt,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[progress-sync] POST failed:', error);
    return createErrorResponse(
      500,
      ERROR_CODES.SERVER_ERROR,
      'Failed to sync progress.',
    );
  }
}
