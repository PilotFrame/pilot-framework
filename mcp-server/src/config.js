import path from 'node:path';
import dotenv from 'dotenv';
dotenv.config();
const rootDir = path.resolve(process.cwd(), '..');
export const MCP_SERVER_NAME = process.env.MCP_SERVER_NAME ?? 'pilotframe-mcp';
export const MCP_SERVER_VERSION = process.env.MCP_SERVER_VERSION ?? '0.1.0';
export const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL ?? 'http://localhost:4000';
export const CONTROL_PLANE_TOKEN = process.env.CONTROL_PLANE_TOKEN ?? '';
export const PERSONA_SPEC_DIR = process.env.PERSONA_SPEC_DIR
    ? path.resolve(process.env.PERSONA_SPEC_DIR)
    : path.join(rootDir, 'examples', 'personas');
export function requireToken() {
    if (!CONTROL_PLANE_TOKEN) {
        throw new Error('CONTROL_PLANE_TOKEN must be set for MCP server to call the control plane.');
    }
    return CONTROL_PLANE_TOKEN;
}
