import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const ConfigSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url().optional(),
  AUTH_JWT_SECRET: z.string().min(10, 'AUTH_JWT_SECRET must be at least 10 characters long').optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  AZURE_KEY_VAULT_URI: z.string().url().optional(),
  AZURE_BLOB_URL: z.string().url().optional(),
  ADAPTER_URL: z.string().url().default('http://localhost:8080')
});

const parsed = ConfigSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration');
  console.error(parsed.error.format());
  process.exit(1);
}

const config = parsed.data;

export type AppConfig = typeof config;

export const appConfig: AppConfig = config;

export const hasDatabase = Boolean(appConfig.DATABASE_URL);

