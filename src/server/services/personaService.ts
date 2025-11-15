import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

import { appConfig, hasDatabase } from '../config.js';
import { query } from '../db.js';

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

const schemaPath = path.join(process.cwd(), 'schemas', 'persona-spec.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
const validatePersonaSpec = ajv.compile(schema);

type PersonaSpec = Record<string, unknown>;

export interface PersonaSummary {
  id: string;
  slug: string;
  name: string;
  updated_at?: string;
}

interface PersonaRecord {
  slug: string;
  spec: PersonaSpec;
  createdAt: string;
  updatedAt: string;
}

const examplePersonaDir = path.join(process.cwd(), 'examples', 'personas');

const exampleCache: Map<string, PersonaRecord> = new Map();
const inMemoryStore: Map<string, PersonaRecord> = new Map();

function loadExamples(): void {
  const files = fs.existsSync(examplePersonaDir)
    ? fs.readdirSync(examplePersonaDir).filter((file) => file.endsWith('.json'))
    : [];

  files.forEach((file) => {
    const spec = JSON.parse(fs.readFileSync(path.join(examplePersonaDir, file), 'utf-8'));
    const slug = spec.id as string;
    const metadata = (spec.metadata ?? {}) as Record<string, unknown>;
    const createdAt =
      typeof metadata.created_at === 'string' ? (metadata.created_at as string) : new Date().toISOString();
    const updatedAt =
      typeof metadata.updated_at === 'string'
        ? (metadata.updated_at as string)
        : (typeof metadata.created_at === 'string'
            ? (metadata.created_at as string)
            : new Date().toISOString());

    exampleCache.set(slug, {
      slug,
      spec,
      createdAt,
      updatedAt
    });
  });
}

loadExamples();

function ensureValidSpec(spec: PersonaSpec) {
  const isValid = validatePersonaSpec(spec);
  if (!isValid) {
    const message = ajv.errorsText(validatePersonaSpec.errors, { separator: '\n  ' });
    const error = new Error(`Persona spec validation failed:\n  ${message}`);
    throw error;
  }
}

export async function listPersonas(): Promise<PersonaSummary[]> {
  if (hasDatabase) {
    const result = await query<PersonaSummary>(
      `
      select
        id::text as id,
        slug,
        spec->>'name' as name,
        to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') as updated_at
      from personas
      order by updated_at desc
    `
    );
    if (result.rows.length > 0) {
      return result.rows;
    }
  }

  const merged = new Map<string, PersonaRecord>();
  exampleCache.forEach((record, key) => merged.set(key, record));
  inMemoryStore.forEach((record, key) => merged.set(key, record));

  return Array.from(merged.values()).map((record) => {
    const spec = record.spec;
    return {
      id: (spec.id as string) ?? record.slug,
      slug: record.slug,
      name: (spec.name as string) ?? record.slug,
      updated_at: record.updatedAt
    };
  });
}

export async function getPersonaSpec(identifier: string): Promise<PersonaSpec | null> {
  if (hasDatabase) {
    const result = await query<{ spec: PersonaSpec }>(
      `
      select spec
      from personas
      where slug = $1
         or id::text = $1
      limit 1
    `,
      [identifier]
    );
    if (result.rows.length > 0) {
      return result.rows[0].spec;
    }
  }

  const cached = inMemoryStore.get(identifier) ?? exampleCache.get(identifier);
  if (cached) {
    return cached.spec;
  }
  return null;
}

export async function createPersonaSpec(spec: PersonaSpec): Promise<PersonaSpec> {
  ensureValidSpec(spec);

  const slug = (spec.id as string) ?? randomUUID();
  const now = new Date().toISOString();

  if (hasDatabase) {
    const insertQuery = `
      insert into personas (id, slug, spec)
      values ($1, $2, $3)
      on conflict (slug) do update
      set
        spec = excluded.spec,
        updated_at = now()
      returning spec;
    `;

    const id = randomUUID();

    const result = await query<{ spec: PersonaSpec }>(insertQuery, [id, slug, spec]);

    return result.rows[0].spec;
  }

  // Ensure metadata has timestamps
  const metadata = (spec.metadata ?? {}) as Record<string, unknown>;
  if (!metadata.created_at) {
    metadata.created_at = now;
  }
  if (!metadata.updated_at) {
    metadata.updated_at = now;
  }
  spec.metadata = metadata;

  const record: PersonaRecord = {
    slug,
    spec,
    createdAt: typeof metadata.created_at === 'string' ? (metadata.created_at as string) : now,
    updatedAt: typeof metadata.updated_at === 'string' ? (metadata.updated_at as string) : now
  };

  // Save to in-memory store
  inMemoryStore.set(slug, record);

  // ALSO save to file for persistence
  const filePath = path.join(examplePersonaDir, `${slug}.json`);
  try {
    // Ensure directory exists
    if (!fs.existsSync(examplePersonaDir)) {
      fs.mkdirSync(examplePersonaDir, { recursive: true });
    }
    
    // Write to file with pretty formatting
    fs.writeFileSync(filePath, JSON.stringify(spec, null, 2), 'utf-8');
    console.log(`[PersonaService] Saved persona "${slug}" to ${filePath}`);
    
    // Also update the example cache so it's immediately available
    exampleCache.set(slug, record);
  } catch (error) {
    console.error(`[PersonaService] Failed to save persona "${slug}" to file:`, error);
    // Don't throw - at least it's in memory
  }

  return record.spec;
}

