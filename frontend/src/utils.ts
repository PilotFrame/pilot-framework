import type { ApiConfig, PersonaSpec } from './types';

const CONFIG_KEY = 'pf-ui-config';

export function loadConfig(): ApiConfig {
  if (typeof localStorage === 'undefined') {
    return { baseUrl: '', token: '' };
  }

  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        baseUrl: parsed.baseUrl ?? '',
        token: parsed.token ?? ''
      };
    }
  } catch (error) {
    console.warn('Failed to parse stored config', error);
  }

  return { baseUrl: '', token: '' };
}

export function saveConfig(config: ApiConfig) {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function createDefaultSpec(): PersonaSpec {
  const timestamp = new Date().toISOString();
  return {
    id: '',
    name: '',
    tags: [],
    specification: {},
    metadata: {
      created_at: timestamp
    }
  };
}

export function buildAuthHeaders(config: ApiConfig): HeadersInit {
  const headers: HeadersInit = {
    'content-type': 'application/json'
  };
  if (config.token) {
    headers['authorization'] = `Bearer ${config.token}`;
  }
  return headers;
}

