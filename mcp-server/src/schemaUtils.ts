import { z, ZodObject, type ZodTypeAny } from 'zod';

export type JSONSchema = {
  type?: string | string[];
  enum?: unknown[];
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema | JSONSchema[];
  anyOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  allOf?: JSONSchema[];
  description?: string;
  [key: string]: unknown;
};

function withDescription<T extends ZodTypeAny>(schema: T, description?: string): T {
  if (description) {
    return schema.describe(description) as T;
  }
  return schema;
}

export function jsonSchemaToZod(schema: JSONSchema | undefined): ZodTypeAny {
  if (!schema) {
    return z.any();
  }

  if (schema.anyOf && schema.anyOf.length > 0) {
    const subs = schema.anyOf.map((sub) => jsonSchemaToZod(sub));
    if (subs.length === 1) {
      return subs[0];
    }
    return z.union([subs[0], subs[1], ...subs.slice(2)]);
  }

  if (schema.oneOf && schema.oneOf.length > 0) {
    const subs = schema.oneOf.map((sub) => jsonSchemaToZod(sub));
    if (subs.length === 1) {
      return subs[0];
    }
    return z.union([subs[0], subs[1], ...subs.slice(2)]);
  }

  if (schema.allOf && schema.allOf.length > 0) {
    const subs = schema.allOf.map((sub) => jsonSchemaToZod(sub));
    return subs.slice(1).reduce((acc, current) => z.intersection(acc, current), subs[0]);
  }

  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;

  switch (type) {
    case 'string': {
      if (schema.enum && schema.enum.every((value) => typeof value === 'string')) {
        return withDescription(z.enum(schema.enum as [string, ...string[]]), schema.description);
      }
      return withDescription(z.string(), schema.description);
    }
    case 'integer':
    case 'number': {
      return withDescription(z.number(), schema.description);
    }
    case 'boolean': {
      return withDescription(z.boolean(), schema.description);
    }
    case 'array': {
      if (Array.isArray(schema.items)) {
        const itemSchemas = schema.items.map((item) => jsonSchemaToZod(item));
        return withDescription(z.tuple(itemSchemas as [ZodTypeAny, ...ZodTypeAny[]]), schema.description);
      }
      return withDescription(z.array(jsonSchemaToZod(schema.items as JSONSchema)), schema.description);
    }
    case 'object': {
      const properties = schema.properties ?? {};
      const required = new Set(schema.required ?? []);
      const shape: Record<string, ZodTypeAny> = {};
      for (const [key, value] of Object.entries(properties)) {
        let propertySchema = jsonSchemaToZod(value);
        if (!required.has(key)) {
          propertySchema = propertySchema.optional();
        }
        shape[key] = propertySchema;
      }
      let objectSchema = z.object(shape);
      if (schema.description) {
        objectSchema = objectSchema.describe(schema.description);
      }
      return objectSchema.passthrough();
    }
    default: {
      if (schema.enum && schema.enum.length > 0) {
        const values = schema.enum;
        if (values.every((value) => typeof value === 'string')) {
          return withDescription(z.enum(values as [string, ...string[]]), schema.description);
        }
      }
      return withDescription(z.any(), schema.description);
    }
  }
}

export function jsonSchemaToToolShape(schema: JSONSchema | undefined): Record<string, ZodTypeAny> | undefined {
  if (!schema) {
    return undefined;
  }
  const zodSchema = jsonSchemaToZod(schema);
  if (zodSchema instanceof ZodObject) {
    return zodSchema.shape;
  }
  return {
    value: zodSchema
  };
}

