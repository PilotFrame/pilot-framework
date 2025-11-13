import { CONTROL_PLANE_URL, requireToken } from './config.js';

export interface InvocationPayload {
  personaId: string;
  methodId: string;
  input: Record<string, unknown>;
}

export interface InvocationResult {
  data: Record<string, unknown> | null;
  status?: string;
  [key: string]: unknown;
}

export async function invokePersonaMethod(payload: InvocationPayload): Promise<InvocationResult> {
  const response = await fetch(new URL('/api/invoke', CONTROL_PLANE_URL).toString(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${requireToken()}`
    },
    body: JSON.stringify({
      personaId: payload.personaId,
      methodId: payload.methodId,
      input: payload.input,
      dryRun: false
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Control plane invoke failed (${response.status}): ${message}`);
  }

  return (await response.json()) as InvocationResult;
}

