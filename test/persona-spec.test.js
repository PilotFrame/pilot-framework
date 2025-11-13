/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(rootDir, '..');
const schemaPath = path.join(projectRoot, 'schemas', 'persona-spec.schema.json');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function main() {
  const schema = loadJson(schemaPath);
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);

  const validate = ajv.compile(schema);

  const examplesDir = path.join(projectRoot, 'examples', 'personas');
  const exampleFiles = fs.readdirSync(examplesDir).filter((name) => name.endsWith('.json'));

  const failures = [];

  for (const file of exampleFiles) {
    const data = loadJson(path.join(examplesDir, file));
    const valid = validate(data);
    if (!valid) {
      failures.push({ file, errors: validate.errors ?? [] });
    } else {
      console.log(`✔ ${file} passed schema validation`);
    }
  }

  if (failures.length > 0) {
    console.error('Schema validation failed for:');
    for (const failure of failures) {
      console.error(`- ${failure.file}`);
      console.error(ajv.errorsText(failure.errors, { separator: '\n  ' }));
    }
    process.exit(1);
  }

  console.log(`Validated ${exampleFiles.length} persona spec(s) successfully.`);
}

main();

