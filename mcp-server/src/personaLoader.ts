import { promises as fs } from 'node:fs';
import path from 'path';

export interface PersonaSpec {
  id: string;
  name: string;
  tags?: string[];
  specification: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export async function loadPersonaSpecs(directory: string): Promise<PersonaSpec[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });

  const specs: PersonaSpec[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }
    const fullPath = path.join(directory, entry.name);
    const raw = await fs.readFile(fullPath, 'utf-8');
    try {
      const parsed = JSON.parse(raw) as PersonaSpec;
      if (!parsed.id || !parsed.specification) {
        continue;
      }
      specs.push(parsed);
    } catch (error) {
      console.warn(`Failed to parse persona spec ${entry.name}:`, error);
    }
  }

  return specs;
}
