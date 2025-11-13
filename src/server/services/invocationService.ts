import { randomUUID } from 'node:crypto';

import { appConfig, hasDatabase } from '../config.js';
import { query } from '../db.js';

interface InvocationPayload {
  personaId: string;
  methodId: string;
  input: Record<string, unknown>;
  dryRun?: boolean;
  metadata?: Record<string, unknown>;
}

interface InvocationResult {
  id: string;
  personaId: string;
  methodId: string;
  status: 'queued' | 'completed' | 'failed';
  output: Record<string, unknown>;
  dryRun: boolean;
  createdAt: string;
}

const inMemoryInvocations: InvocationResult[] = [];

async function callAdapter(methodId: string, input: Record<string, unknown>) {
  const adapterUrl = appConfig.ADAPTER_URL;
  const response = await fetch(`${adapterUrl}/methods/${methodId}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Adapter invocation failed (${response.status}): ${text}`);
  }

  return (await response.json()) as { data?: Record<string, unknown> };
}

export async function createInvocation(payload: InvocationPayload): Promise<InvocationResult> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const dryRun = Boolean(payload.dryRun);

  let status: InvocationResult['status'] = dryRun ? 'completed' : 'queued';
  let output: Record<string, unknown> = {
    summary: dryRun
      ? 'Dry run executed. No adapter call made.'
      : 'Invocation queued for adapter execution.',
    evaluation: {
      scorecard: {
        overall: dryRun ? 0 : 0.82,
        notes: dryRun ? 'Simulation only.' : 'Mock score for MVP.'
      }
    },
    metadata: payload.metadata ?? {}
  };

  if (!dryRun) {
    try {
      const adapterResponse = await callAdapter(payload.methodId, payload.input);
      output = adapterResponse.data ?? adapterResponse;
      status = 'completed';
    } catch (error) {
      status = 'failed';
      output = {
        error: 'Adapter invocation failed',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  const result: InvocationResult = {
    id,
    personaId: payload.personaId,
    methodId: payload.methodId,
    status,
    dryRun,
    createdAt: now,
    output
  };

  if (hasDatabase) {
    await query(
      `
        insert into invocations (id, persona_id, method_id, dry_run, input, output, status)
        values ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        id,
        payload.personaId,
        payload.methodId,
        dryRun,
        payload.input,
        result.output,
        result.status
      ]
    );
  } else {
    inMemoryInvocations.push(result);
  }

  return result;
}

