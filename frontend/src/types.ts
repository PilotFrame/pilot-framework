export type PersonaSummary = {
  id: string;
  slug: string;
  name: string;
  updated_at?: string;
};

export type PersonaSpec = {
  id: string;
  name: string;
  tags?: string[];
  specification: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type WorkflowSummary = {
  id: string;
  slug: string;
  name: string;
  updated_at?: string;
};

export type ApiConfig = {
  baseUrl: string;
  token: string;
};

