import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { appConfig, hasDatabase } from '../config.js';
import { query } from '../db.js';

export interface ExecutionSpec {
  description: string;
  flow_pattern?: 'sequential' | 'cycle' | 'parallel' | 'conditional' | 'mixed';
  cycle_details?: {
    cycle_steps: string[];
    exit_condition: string;
    max_iterations?: number;
  };
  parallel_details?: {
    parallel_steps: string[];
    merge_strategy?: 'all' | 'any' | 'majority';
    description?: string;
  };
  conditional_branches?: Array<{
    condition: string;
    target_step: string;
    description?: string;
  }>;
  execution_guidance?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  steps: WorkflowStep[];
  execution_spec?: ExecutionSpec;
  metadata?: Record<string, unknown>;
}

export interface WorkflowStep {
  id: string;
  persona_id: string;
  order: number;
  condition?: string;
  handoff_to?: string;
}

export interface WorkflowSummary {
  id: string;
  slug: string;
  name: string;
  updated_at?: string;
}

interface WorkflowRecord {
  slug: string;
  definition: WorkflowDefinition;
  createdAt: string;
  updatedAt: string;
}

const exampleCache: Map<string, WorkflowRecord> = new Map();
const inMemoryWorkflows: Map<string, WorkflowRecord> = new Map();

function loadExamples(): void {
  const exampleWorkflowDir = path.join(process.cwd(), 'examples', 'workflows');
  const files = fs.existsSync(exampleWorkflowDir)
    ? fs.readdirSync(exampleWorkflowDir).filter((file) => file.endsWith('.json'))
    : [];

  files.forEach((file) => {
    try {
      const definition = JSON.parse(fs.readFileSync(path.join(exampleWorkflowDir, file), 'utf-8')) as WorkflowDefinition;
      const slug = definition.id;
      const metadata = (definition.metadata ?? {}) as Record<string, unknown>;
      const createdAt =
        typeof metadata.created_at === 'string' ? (metadata.created_at as string) : new Date().toISOString();
      const updatedAt =
        typeof metadata.updated_at === 'string'
          ? (metadata.updated_at as string)
          : typeof metadata.created_at === 'string'
            ? (metadata.created_at as string)
            : new Date().toISOString();

      exampleCache.set(slug, {
        slug,
        definition,
        createdAt,
        updatedAt
      });
    } catch (error) {
      console.warn(`Failed to load example workflow ${file}:`, error);
    }
  });
}

loadExamples();

export async function listWorkflows(): Promise<WorkflowSummary[]> {
  if (hasDatabase) {
    const result = await query<WorkflowSummary>(
      `
      select
        id::text as id,
        slug,
        name,
        to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') as updated_at
      from workflows
      order by updated_at desc
    `
    );
    if (result.rows.length > 0) {
      return result.rows;
    }
  }

  // Combine in-memory and example workflows
  const allWorkflows = new Map<string, WorkflowRecord>();
  exampleCache.forEach((record) => allWorkflows.set(record.slug, record));
  inMemoryWorkflows.forEach((record) => allWorkflows.set(record.slug, record));

  return Array.from(allWorkflows.values()).map((record) => ({
    id: record.definition.id,
    slug: record.slug,
    name: record.definition.name,
    updated_at: record.updatedAt
  }));
}

export async function getWorkflow(identifier: string): Promise<WorkflowDefinition | null> {
  if (hasDatabase) {
    const result = await query<{ definition: WorkflowDefinition }>(
      `
      select definition
      from workflows
      where slug = $1
         or id::text = $1
      limit 1
    `,
      [identifier]
    );
    if (result.rows.length > 0) {
      return result.rows[0].definition;
    }
  }

  const cached = inMemoryWorkflows.get(identifier) ?? exampleCache.get(identifier);
  if (cached) {
    return cached.definition;
  }
  return null;
}

export async function createWorkflow(definition: WorkflowDefinition): Promise<WorkflowDefinition> {
  const slug = definition.id || randomUUID();
  const now = new Date().toISOString();

  if (hasDatabase) {
    const insertQuery = `
      insert into workflows (id, slug, name, definition)
      values ($1, $2, $3, $4)
      on conflict (slug) do update
      set
        name = excluded.name,
        definition = excluded.definition,
        updated_at = now()
      returning definition;
    `;

    const id = randomUUID();

    const result = await query<{ definition: WorkflowDefinition }>(insertQuery, [
      id,
      slug,
      definition.name,
      definition
    ]);

    return result.rows[0].definition;
  }

  // Ensure metadata has timestamps
  const metadata = (definition.metadata ?? {}) as Record<string, unknown>;
  if (!metadata.created_at) {
    metadata.created_at = now;
  }
  if (!metadata.updated_at) {
    metadata.updated_at = now;
  }
  definition.metadata = metadata;

  const record: WorkflowRecord = {
    slug,
    definition,
    createdAt: typeof metadata.created_at === 'string' ? (metadata.created_at as string) : now,
    updatedAt: typeof metadata.updated_at === 'string' ? (metadata.updated_at as string) : now
  };

  // Save to in-memory store
  inMemoryWorkflows.set(slug, record);

  // ALSO save to file for persistence
  const exampleWorkflowDir = path.join(process.cwd(), 'examples', 'workflows');
  const filePath = path.join(exampleWorkflowDir, `${slug}.json`);
  try {
    // Ensure directory exists
    if (!fs.existsSync(exampleWorkflowDir)) {
      fs.mkdirSync(exampleWorkflowDir, { recursive: true });
    }
    
    // Write to file with pretty formatting
    fs.writeFileSync(filePath, JSON.stringify(definition, null, 2), 'utf-8');
    console.log(`[WorkflowService] Saved workflow "${slug}" to ${filePath}`);
    
    // Also update the example cache so it's immediately available
    exampleCache.set(slug, record);
  } catch (error) {
    console.error(`[WorkflowService] Failed to save workflow "${slug}" to file:`, error);
    // Don't throw - at least it's in memory
  }

  return record.definition;
}

