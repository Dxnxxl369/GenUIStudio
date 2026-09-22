import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { toast } from 'react-toastify';
import JSZip from 'jszip';
import { workbenchStore } from '~/lib/stores/workbench';
import { chatId } from '~/lib/persistence/useChatHistory';
import { classNames } from '~/utils/classNames';

export interface ClassAttribute {
  name: string;
  type: string;
  pk?: boolean;
  fk?: string | null;
  description?: string;
}

export interface DomainClass {
  name: string;
  table_name: string;
  description?: string;
  attributes: ClassAttribute[];
  seed_data: Record<string, any>[];
  sourceFile?: string;
  sourceType?: 'file' | 'localStorage' | 'mockData' | 'imported';
}

export interface DomainModel {
  project_title?: string;
  summary?: string;
  classes: DomainClass[];
  sql_ddl?: string;
}

/**
 * Normalizes entity names: e.g. "initial_games" -> "Game", "categories" -> "Category", "orders" -> "Order"
 */
function formatEntityName(key: string): string {
  let clean = key.trim().replace(/^initial_?|^default_?|^mock_?/i, '');
  if (!clean) clean = key;

  // Split words if camelCase or snake_case
  clean = clean.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
  const words = clean.split(/\s+/).filter(Boolean);
  clean = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

  if (clean.endsWith('ies')) {
    clean = clean.slice(0, -3) + 'y';
  } else if (clean.endsWith('es') && !clean.endsWith('ses') && !clean.endsWith('ges') && !clean.endsWith('mes') && !clean.endsWith('nes')) {
    clean = clean.slice(0, -2);
  } else if (clean.endsWith('s') && !clean.endsWith('ss')) {
    clean = clean.slice(0, -1);
  }

  return clean;
}

/**
 * Removes comments while preserving string contents and byte offsets
 */
function cleanComments(code: string): string {
  let result = '';
  let i = 0;
  const len = code.length;
  let inString: string | null = null;

  while (i < len) {
    const ch = code[i];
    const next = code[i + 1];

    if (inString) {
      if (ch === '\\') {
        result += ch + (next || '');
        i += 2;
        continue;
      }
      if (ch === inString) inString = null;
      result += ch;
      i++;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      result += ch;
      i++;
      continue;
    }

    // Single-line comment
    if (ch === '/' && next === '/') {
      while (i < len && code[i] !== '\n') {
        result += ' ';
        i++;
      }
      continue;
    }

    // Multi-line block comment
    if (ch === '/' && next === '*') {
      i += 2;
      result += '  ';
      while (i < len && !(code[i] === '*' && code[i + 1] === '/')) {
        result += code[i] === '\n' ? '\n' : ' ';
        i++;
      }
      if (i < len) {
        result += '  ';
        i += 2;
      }
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}

/**
 * Extracts a bracketed block [ ... ] with exact bracket depth counting
 */
function extractBracketBlock(str: string, startIndex: number): { content: string; endIndex: number } | null {
  let depth = 0;
  let inString: string | null = null;
  let start = -1;

  for (let i = startIndex; i < str.length; i++) {
    const ch = str[i];
    if (inString) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      continue;
    }

    if (ch === '[') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === ']') {
      depth--;
      if (depth === 0 && start !== -1) {
        return { content: str.slice(start + 1, i), endIndex: i };
      }
    }
  }
  return null;
}

/**
 * Extracts all top-level { ... } objects from an array block
 */
function extractObjectsFromBlock(blockContent: string): string[] {
  const objects: string[] = [];
  let depth = 0;
  let inString: string | null = null;
  let start = -1;

  for (let i = 0; i < blockContent.length; i++) {
    const ch = blockContent[i];
    if (inString) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      continue;
    }

    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        objects.push(blockContent.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return objects;
}

/**
 * Robustly parses a JS object literal string into a record
 */
function parseObjectLiteral(objStr: string): Record<string, any> {
  const result: Record<string, any> = {};
  const fieldRegex =
    /([a-zA-Z0-9_$]+)\s*:\s*(?:['"`]([\s\S]*?)['"`]|([0-9]+(?:\.[0-9]+)?)|(true|false)|(null|undefined)|\[([\s\S]*?)\]|([a-zA-Z0-9_$.]+))/g;

  let m;
  while ((m = fieldRegex.exec(objStr)) !== null) {
    const key = m[1];
    if (m[2] !== undefined) {
      result[key] = m[2];
    } else if (m[3] !== undefined) {
      result[key] = Number(m[3]);
    } else if (m[4] !== undefined) {
      result[key] = m[4] === 'true';
    } else if (m[5] !== undefined) {
      result[key] = null;
    } else if (m[6] !== undefined) {
      result[key] = m[6]
        .split(',')
        .map((s) => s.trim().replace(/^['"`]|['"`]$/g, ''))
        .filter(Boolean);
    } else if (m[7] !== undefined) {
      result[key] = m[7];
    }
  }

  return result;
}

/**
 * Parses `new ClassName(arg1, arg2, ...)` instantiations from array datasets
 */
function parseNewInstantiations(
  arrayContent: string,
  targetClass?: DomainClass,
): Array<{ className: string; row: Record<string, any> }> {
  const instances: Array<{ className: string; row: Record<string, any> }> = [];
  const newRegex = /new\s+([a-zA-Z0-9_$]+)\s*\(([\s\S]*?)\)(?=\s*(?:,|\]|$))/g;
  let m;

  while ((m = newRegex.exec(arrayContent)) !== null) {
    const className = m[1];
    const rawArgs = m[2];

    const args: string[] = [];
    let cur = '';
    let inStr: string | null = null;

    for (let i = 0; i < rawArgs.length; i++) {
      const ch = rawArgs[i];
      if (inStr) {
        if (ch === '\\') {
          cur += ch + (rawArgs[i + 1] || '');
          i++;
          continue;
        }
        if (ch === inStr) inStr = null;
        cur += ch;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        inStr = ch;
        cur += ch;
        continue;
      }
      if (ch === ',') {
        args.push(cur.trim());
        cur = '';
        continue;
      }
      cur += ch;
    }
    if (cur.trim()) args.push(cur.trim());

    const parsedArgs = args.map((a) => {
      if (
        (a.startsWith("'") && a.endsWith("'")) ||
        (a.startsWith('"') && a.endsWith('"')) ||
        (a.startsWith('`') && a.endsWith('`'))
      ) {
        return a.slice(1, -1);
      }
      if (a === 'true') return true;
      if (a === 'false') return false;
      if (a === 'null' || a === 'undefined') return null;
      const num = Number(a);
      if (!isNaN(num)) return num;
      return a;
    });

    const row: Record<string, any> = {};
    if (targetClass && targetClass.attributes && targetClass.attributes.length > 0) {
      targetClass.attributes.forEach((attr, idx) => {
        if (idx < parsedArgs.length) {
          row[attr.name] = parsedArgs[idx];
        }
      });
    } else {
      parsedArgs.forEach((val, idx) => {
        row[`col_${idx + 1}`] = val;
      });
    }

    instances.push({ className, row });
  }

  return instances;
}

/**
 * Infer attributes, types, PK and FK automatically from rows
 */
function inferAttributes(records: Record<string, any>[], knownTables: string[] = []): ClassAttribute[] {
  if (!records || records.length === 0) {
    return [{ name: 'id', type: 'INTEGER', pk: true, description: 'Identificador único' }];
  }

  const allKeys = new Set<string>();
  records.forEach((r) => Object.keys(r).forEach((k) => allKeys.add(k)));

  return Array.from(allKeys).map((key) => {
    let type = 'TEXT';
    for (const r of records) {
      const val = r[key];
      if (val === undefined || val === null) continue;

      if (typeof val === 'number') {
        type = Number.isInteger(val) ? 'INTEGER' : 'DECIMAL';
        break;
      } else if (typeof val === 'boolean') {
        type = 'BOOLEAN';
        break;
      } else if (Array.isArray(val)) {
        type = 'ARRAY';
        break;
      } else if (typeof val === 'object') {
        type = 'JSON';
        break;
      } else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
        type = 'TIMESTAMP';
        break;
      }
    }

    const lower = key.toLowerCase();
    const isPk =
      lower === 'id' ||
      lower === '_id' ||
      (lower.endsWith('_id') && lower.split('_')[0] === lower.replace(/_id$/, '')) ||
      (lower.endsWith('id') && lower.length > 2 && records.every((r, idx, arr) => arr.findIndex((x) => x[key] === r[key]) === idx));

    let fkTarget: string | null = null;
    if (!isPk && (lower.endsWith('id') || lower.endsWith('_id'))) {
      const entityPrefix = lower.replace(/_?id$/, '');
      const matched = knownTables.find(
        (t) =>
          t.toLowerCase() === entityPrefix ||
          t.toLowerCase() === entityPrefix + 's' ||
          t.toLowerCase() === entityPrefix + 'es',
      );
      fkTarget = matched ? `${matched}.id` : `${entityPrefix}s.id`;
    }

    return {
      name: key,
      type,
      pk: isPk,
      fk: fkTarget,
      description: isPk ? 'Clave primaria' : fkTarget ? `FK -> ${fkTarget}` : `Campo ${key}`,
    };
  });
}

/**
 * Validates whether a file is a build/linter/infrastructure file rather than a domain source file
 */
export function isIgnoredInfrastructureFile(filePath: string): boolean {
  if (!filePath) return true;
  const lower = filePath.toLowerCase();

  // 1. Technical / build / temporary folders
  if (
    lower.includes('node_modules') ||
    lower.includes('.git/') ||
    lower.includes('.git\\') ||
    lower.includes('dist/') ||
    lower.includes('dist\\') ||
    lower.includes('build/') ||
    lower.includes('build\\') ||
    lower.includes('.cache') ||
    lower.includes('.next') ||
    lower.includes('.remix')
  ) {
    return true;
  }

  // 2. Tooling and config files
  if (
    /\.config\.(js|ts|mjs|cjs|json)$/i.test(lower) ||
    /eslint|prettier|postcss|tailwind|vite|vitest|webpack|rollup|babel|tsconfig/i.test(lower) ||
    /package\.json|package-lock\.json/i.test(lower) ||
    /setup-env|pre-start|env\.d\.ts|\.d\.ts$/i.test(lower) ||
    /\.(test|spec)\.(js|ts|jsx|tsx)$/i.test(lower)
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if a parsed record contains only technical ESLint / Vite config properties
 */
function isConfigRecord(record: Record<string, any>): boolean {
  const keys = Object.keys(record);
  if (keys.length === 0) return true;
  const configKeys = new Set([
    'allowconstantexport',
    'noconsole',
    'react-refresh',
    'semi',
    'quotes',
    'indent',
    'parseroptions',
    'ecmaversion',
    'sourcetype',
    'plugins',
    'rules',
    'extends',
    'env',
  ]);
  return keys.every((k) => configKeys.has(k.toLowerCase()));
}

/**
 * Universal AST-style extractor for datasets, arrays, interfaces and schemas
 */
function extractTablesFromSourceCode(code: string, filePath: string): DomainClass[] {
  const tables: DomainClass[] = [];
  if (!code || typeof code !== 'string' || isIgnoredInfrastructureFile(filePath)) return tables;

  const fileName = filePath.split('/').pop() || filePath;

  // 0. SQL Files or files containing CREATE TABLE / INSERT INTO
  if (filePath.endsWith('.sql') || /CREATE\s+TABLE/i.test(code)) {
    try {
      const createRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?([a-zA-Z0-9_]+)["'`]?\s*\(([\s\S]*?)\);/gi;
      let createMatch;
      while ((createMatch = createRegex.exec(code)) !== null) {
        const rawTableName = createMatch[1];
        const columnsBody = createMatch[2];
        const tableName = rawTableName.toLowerCase();
        const attributes: ClassAttribute[] = [];
        const lines = columnsBody.split(/,\s*\n|,\s*(?=[a-zA-Z0-9_]+\s+[a-zA-Z]+)/);

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || /^PRIMARY\s+KEY|^FOREIGN\s+KEY|^CONSTRAINT|^INDEX/i.test(line)) continue;
          const colMatch = line.match(/^["'`]?([a-zA-Z0-9_]+)["'`]?\s+([a-zA-Z]+(?:\([^)]+\))?)/i);
          if (colMatch) {
            const colName = colMatch[1];
            const rawType = colMatch[2].toUpperCase();
            let type = 'TEXT';
            if (/INT/i.test(rawType)) type = 'INTEGER';
            else if (/DECIMAL|NUMERIC|FLOAT|DOUBLE|REAL/i.test(rawType)) type = 'DECIMAL';
            else if (/BOOL/i.test(rawType)) type = 'BOOLEAN';
            else if (/DATE|TIME/i.test(rawType)) type = 'TIMESTAMP';

            const isPk = /PRIMARY\s+KEY/i.test(line) || colName.toLowerCase() === 'id';
            attributes.push({
              name: colName,
              type,
              pk: isPk,
              description: isPk ? 'Clave primaria' : `Campo ${colName}`,
            });
          }
        }

        tables.push({
          name: formatEntityName(rawTableName),
          table_name: tableName,
          description: `Tabla SQL ${rawTableName} (${fileName})`,
          attributes,
          seed_data: [],
          sourceFile: filePath,
          sourceType: 'file',
        });
      }

      // Parse INSERT statements
      const insertRegex = /INSERT\s+INTO\s+["'`]?([a-zA-Z0-9_]+)["'`]?\s*(?:\(([\s\S]*?)\))?\s*VALUES\s*([\s\S]*?);/gi;
      let insertMatch;
      while ((insertMatch = insertRegex.exec(code)) !== null) {
        const targetTableName = insertMatch[1].toLowerCase();
        const explicitCols = insertMatch[2]
          ? insertMatch[2].split(',').map((c) => c.trim().replace(/^["'`]|["'`]$/g, ''))
          : null;
        const valuesPart = insertMatch[3];
        const targetTable = tables.find((t) => t.table_name === targetTableName);
        if (!targetTable) continue;

        const tupleRegex = /\(([\s\S]*?)\)/g;
        let tupleMatch;
        while ((tupleMatch = tupleRegex.exec(valuesPart)) !== null) {
          const tupleStr = tupleMatch[1];
          const parsedValues: any[] = [];
          const valRegex = /'((?:''|[^'])*)'|"((?:""|[^"])*)"|([0-9]+(?:\.[0-9]+)?)|(true|false)|(null)/gi;
          let valMatch;
          while ((valMatch = valRegex.exec(tupleStr)) !== null) {
            if (valMatch[1] !== undefined) parsedValues.push(valMatch[1].replace(/''/g, "'"));
            else if (valMatch[2] !== undefined) parsedValues.push(valMatch[2].replace(/""/g, '"'));
            else if (valMatch[3] !== undefined) parsedValues.push(Number(valMatch[3]));
            else if (valMatch[4] !== undefined) parsedValues.push(valMatch[4].toLowerCase() === 'true');
            else if (valMatch[5] !== undefined) parsedValues.push(null);
          }

          if (parsedValues.length > 0) {
            const row: Record<string, any> = {};
            const colNames = explicitCols || targetTable.attributes.map((a) => a.name);
            colNames.forEach((cName, idx) => {
              if (idx < parsedValues.length) row[cName] = parsedValues[idx];
            });
            targetTable.seed_data.push(row);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // 1. JSON Schemas (schema.json, db.json, data.json)
  if (filePath.endsWith('.json')) {
    try {
      const parsed = JSON.parse(code);
      if (parsed && Array.isArray(parsed.classes)) {
        return parsed.classes.map((c: any) => ({
          name: c.name || formatEntityName(c.table_name || 'Item'),
          table_name: (c.table_name || c.name || 'items').toLowerCase(),
          description: c.description || `Esquema cargado de ${fileName}`,
          attributes: c.attributes || inferAttributes(c.seed_data || []),
          seed_data: c.seed_data || [],
          sourceFile: filePath,
          sourceType: 'file' as const,
        }));
      }

      if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [key, val] of Object.entries(parsed)) {
          if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
            tables.push({
              name: formatEntityName(key),
              table_name: key.toLowerCase(),
              description: `Tabla extraída de ${fileName} (${key})`,
              attributes: inferAttributes(val),
              seed_data: val,
              sourceFile: filePath,
              sourceType: 'file',
            });
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. TypeScript Interfaces (extract attributes & types even without immediate rows)
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.d.ts')) {
    const ifaceRegex = /(?:export\s+)?interface\s+([a-zA-Z0-9_$]+)\s*(?:extends\s+[^{]+)?\s*\{([\s\S]*?)\}/g;
    let ifaceMatch;
    while ((ifaceMatch = ifaceRegex.exec(code)) !== null) {
      const ifaceName = ifaceMatch[1];
      const body = ifaceMatch[2];
      if (/Props$|State$|Context$|Config$|Options$|Params$|Event$|Handler$/i.test(ifaceName)) {
        continue;
      }

      const attrRegex = /([a-zA-Z0-9_$]+)\s*(\?)?\s*:\s*([^;,\n]+)/g;
      const attributes: ClassAttribute[] = [];
      let attrMatch;
      while ((attrMatch = attrRegex.exec(body)) !== null) {
        const attrName = attrMatch[1];
        const rawType = attrMatch[3].trim();
        let type = 'TEXT';
        if (/number/i.test(rawType)) type = 'DECIMAL';
        else if (/boolean/i.test(rawType)) type = 'BOOLEAN';
        else if (/Date/i.test(rawType)) type = 'TIMESTAMP';
        else if (/\[\]|Array</i.test(rawType)) type = 'ARRAY';
        else if (/Record<|\{/i.test(rawType)) type = 'JSON';

        const lower = attrName.toLowerCase();
        const isPk = lower === 'id' || lower === '_id' || lower === `${ifaceName.toLowerCase()}_id`;
        attributes.push({
          name: attrName,
          type,
          pk: isPk,
          fk: !isPk && (lower.endsWith('id') || lower.endsWith('_id')) ? `${lower.replace(/_?id$/, '')}s.id` : null,
          description: isPk ? 'Clave primaria' : `Campo ${attrName} (${rawType})`,
        });
      }

      if (attributes.length > 0) {
        const tableName = ifaceName.toLowerCase() + (ifaceName.toLowerCase().endsWith('s') ? '' : 's');
        tables.push({
          name: ifaceName,
          table_name: tableName,
          description: `Esquema de interfaz ${ifaceName} en ${fileName}`,
          attributes,
          seed_data: [],
          sourceFile: filePath,
          sourceType: 'file',
        });
      }
    }

    // 2b. TypeScript / JavaScript Classes (extract attributes & types from constructor or properties)
    const classRegex = /(?:export\s+)?class\s+([a-zA-Z0-9_$]+)\s*(?:extends\s+[^{]+)?\s*(?:implements\s+[^{]+)?\s*\{([\s\S]*?)\}/g;
    let classMatch;
    while ((classMatch = classRegex.exec(code)) !== null) {
      const className = classMatch[1];
      const body = classMatch[2];
      if (/Service$|Store$|Controller$|Provider$|Component$|Error$|Exception$/i.test(className)) {
        continue;
      }

      const attributes: ClassAttribute[] = [];
      const ctorRegex = /constructor\s*\(([\s\S]*?)\)/;
      const ctorMatch = body.match(ctorRegex);
      if (ctorMatch && ctorMatch[1].trim()) {
        const paramsStr = ctorMatch[1];
        const paramRegex = /(?:public|private|protected|readonly)?\s*([a-zA-Z0-9_$]+)\s*(\?)?\s*:\s*([^,)=]+)/g;
        let pMatch;
        while ((pMatch = paramRegex.exec(paramsStr)) !== null) {
          const attrName = pMatch[1];
          const rawType = pMatch[3].trim();
          let type = 'TEXT';
          if (/number/i.test(rawType)) type = 'DECIMAL';
          else if (/boolean/i.test(rawType)) type = 'BOOLEAN';
          else if (/Date/i.test(rawType)) type = 'TIMESTAMP';
          else if (/\[\]|Array</i.test(rawType)) type = 'ARRAY';
          else if (/Record<|\{/i.test(rawType)) type = 'JSON';

          const lower = attrName.toLowerCase();
          const isPk = lower === 'id' || lower === '_id' || lower === `${className.toLowerCase()}_id`;
          attributes.push({
            name: attrName,
            type,
            pk: isPk,
            fk: !isPk && (lower.endsWith('id') || lower.endsWith('_id')) ? `${lower.replace(/_?id$/, '')}s.id` : null,
            description: isPk ? 'Clave primaria' : `Campo ${attrName} (${rawType})`,
          });
        }
      }

      if (attributes.length === 0) {
        const fieldRegex = /(?:public|private|protected|readonly)?\s*([a-zA-Z0-9_$]+)\s*(\?)?\s*:\s*([^;=\n]+)/g;
        let fMatch;
        while ((fMatch = fieldRegex.exec(body)) !== null) {
          const attrName = fMatch[1];
          if (attrName === 'constructor') continue;
          const rawType = fMatch[3].trim();
          let type = 'TEXT';
          if (/number/i.test(rawType)) type = 'DECIMAL';
          else if (/boolean/i.test(rawType)) type = 'BOOLEAN';
          else if (/Date/i.test(rawType)) type = 'TIMESTAMP';
          else if (/\[\]|Array</i.test(rawType)) type = 'ARRAY';
          else if (/Record<|\{/i.test(rawType)) type = 'JSON';

          const lower = attrName.toLowerCase();
          const isPk = lower === 'id' || lower === '_id' || lower === `${className.toLowerCase()}_id`;
          attributes.push({
            name: attrName,
            type,
            pk: isPk,
            fk: !isPk && (lower.endsWith('id') || lower.endsWith('_id')) ? `${lower.replace(/_?id$/, '')}s.id` : null,
            description: isPk ? 'Clave primaria' : `Campo ${attrName} (${rawType})`,
          });
        }
      }

      if (attributes.length > 0) {
        const tableName = className.toLowerCase() + (className.toLowerCase().endsWith('s') ? '' : 's');
        const existing = tables.find((t) => t.table_name === tableName || t.name === className);
        if (!existing) {
          tables.push({
            name: className,
            table_name: tableName,
            description: `Clase de dominio ${className} en ${fileName}`,
            attributes,
            seed_data: [],
            sourceFile: filePath,
            sourceType: 'file',
          });
        }
      }
    }
  }

  // 3. JavaScript / TypeScript Array Datasets
  const cleaned = cleanComments(code);

  const patterns = [
    // Variable assignment: const/let/var x = [
    { regex: /(?:(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)[^=]*=\s*)\[/g, nameIdx: 1 },
    // useState hook: const [x, setX] = useState... [
    { regex: /(?:const\s+\[\s*([a-zA-Z0-9_$]+)\s*,\s*set[a-zA-Z0-9_$]+\s*\]\s*=\s*useState(?:<[^>]*>)?[\s\S]*?)\[/g, nameIdx: 1 },
    // Object property: x: [
    { regex: /(?:['"]?([a-zA-Z0-9_$]+)['"]?\s*:\s*)\[/g, nameIdx: 1 },
  ];

  for (const { regex, nameIdx } of patterns) {
    let match;
    while ((match = regex.exec(cleaned)) !== null) {
      const rawName = match[nameIdx] || 'items';
      const cleanName = rawName.replace(/^initial_?|^default_?|^mock_?/i, '');

      if (
        /^(styles|actions|routes|options|headers|columns|steps|nav|icons|themes|tabs|middleware|plugins|components|rules|settings|overrides|extends|env|files|parseroptions|ignorepatterns)$/i.test(
          cleanName,
        )
      ) {
        continue;
      }

      const bracketIndex = match.index + match[0].length - 1;
      const block = extractBracketBlock(cleaned, bracketIndex);
      if (!block) continue;

      const tableName = cleanName.toLowerCase();
      let matchedTable = tables.find(
        (t) =>
          t.table_name === tableName ||
          t.name.toLowerCase() === cleanName.toLowerCase() ||
          t.table_name === tableName + 's' ||
          t.table_name + 's' === tableName ||
          formatEntityName(cleanName).toLowerCase() === t.name.toLowerCase(),
      );

      const rawObjects = extractObjectsFromBlock(block.content);
      const records = rawObjects
        .map(parseObjectLiteral)
        .filter((o) => Object.keys(o).length > 0 && !isConfigRecord(o));

      if (records.length > 0) {
        const inferred = inferAttributes(records);
        // Do not add table if attributes are all config flags
        if (inferred.every((attr) => /^(allowconstantexport|noconsole|react-refresh|semi|quotes)$/i.test(attr.name))) {
          continue;
        }

        if (matchedTable) {
          matchedTable.seed_data = records;
          matchedTable.description = `Tabla detectada en ${fileName} (${cleanName})`;
          inferred.forEach((attr) => {
            if (!matchedTable!.attributes.some((a) => a.name === attr.name)) {
              matchedTable!.attributes.push(attr);
            }
          });
        } else {
          tables.push({
            name: formatEntityName(cleanName),
            table_name: tableName,
            description: `Tabla detectada en ${fileName} (${cleanName})`,
            attributes: inferAttributes(records),
            seed_data: records,
            sourceFile: filePath,
            sourceType: 'file',
          });
        }
      } else if (/new\s+[a-zA-Z0-9_$]+\s*\(/.test(block.content)) {
        const instances = parseNewInstantiations(block.content, matchedTable);
        if (instances.length > 0) {
          const rows = instances.map((inst) => inst.row);
          if (matchedTable) {
            matchedTable.seed_data = rows;
            matchedTable.description = `Tabla detectada en ${fileName} (${cleanName})`;
          } else {
            const firstInst = instances[0];
            const entityName = firstInst.className || formatEntityName(cleanName);
            const tbl = entityName.toLowerCase() + (entityName.toLowerCase().endsWith('s') ? '' : 's');
            tables.push({
              name: entityName,
              table_name: tbl,
              description: `Tabla detectada en ${fileName} (${cleanName})`,
              attributes: Object.keys(rows[0] || {}).map((k) => ({
                name: k,
                type: typeof rows[0][k] === 'number' ? 'DECIMAL' : typeof rows[0][k] === 'boolean' ? 'BOOLEAN' : 'TEXT',
                pk: k.toLowerCase() === 'id' || k.toLowerCase() === '_id',
                description: k.toLowerCase() === 'id' ? 'Clave primaria' : `Campo ${k}`,
              })),
              seed_data: rows,
              sourceFile: filePath,
              sourceType: 'file',
            });
          }
        }
      }
    }
  }

  return tables;
}

export function DatabaseView() {
  const files = useStore(workbenchStore.files);
  const currentChatId = useStore(chatId);
  const [selectedClassIndex, setSelectedClassIndex] = useState<number>(0);
  const [dbSubTab, setDbSubTab] = useState<'data' | 'structure' | 'sql'>('data');
  const [searchTableQuery, setSearchTableQuery] = useState('');
  const [searchDataQuery, setSearchDataQuery] = useState('');

  // Imported / Manually Added Tables
  const [importedTables, setImportedTables] = useState<DomainClass[]>([]);
  const [localStorageTables, setLocalStorageTables] = useState<DomainClass[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Reset state when switching chats to prevent cross-chat data bleeding
  useEffect(() => {
    setImportedTables([]);
    setSelectedClassIndex(0);
  }, [currentChatId]);

  // File Upload Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modals state
  const [isAddRecordModalOpen, setIsAddRecordModalOpen] = useState(false);
  const [newRecordFields, setNewRecordFields] = useState<Record<string, string>>({});
  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);
  const [newTableForm, setNewTableForm] = useState<{
    name: string;
    table_name: string;
    description: string;
  }>({ name: '', table_name: '', description: '' });
  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
  const [newColumnForm, setNewColumnForm] = useState<{
    name: string;
    type: string;
    pk: boolean;
    fk: string;
    description: string;
  }>({ name: '', type: 'TEXT', pk: false, fk: '', description: '' });

  // Scan localStorage for live state
  const scanBrowserStorage = useCallback(() => {
    const detected: DomainClass[] = [];
    const ignoredKeys = new Set([
      'bolt-theme',
      'theme',
      'providers',
      'apiKeys',
      'bolt-current-chat',
      'bolt-model-settings',
      'bolt-deleted-paths',
      'currentChatId',
      'chakra-ui-color-mode',
      'i18nextLng',
      'loglevel',
    ]);

    if (typeof window !== 'undefined' && window.localStorage) {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (!key || ignoredKeys.has(key) || key.startsWith('bolt-') || key.startsWith('sb-') || key.startsWith('supabase-')) {
          continue;
        }

        try {
          const raw = window.localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);

          if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
            detected.push({
              name: formatEntityName(key),
              table_name: key.toLowerCase(),
              description: `Tabla viva en localStorage ('${key}')`,
              attributes: inferAttributes(parsed),
              seed_data: parsed,
              sourceFile: `localStorage['${key}']`,
              sourceType: 'localStorage',
            });
          }
        } catch {
          // not JSON
        }
      }
    }

    setLocalStorageTables(detected);
  }, []);

  useEffect(() => {
    scanBrowserStorage();
    const handleStorageUpdate = () => scanBrowserStorage();

    window.addEventListener('storage', handleStorageUpdate);
    document.addEventListener('bolt-data-updated', handleStorageUpdate);
    const interval = setInterval(scanBrowserStorage, 2500);

    return () => {
      window.removeEventListener('storage', handleStorageUpdate);
      document.removeEventListener('bolt-data-updated', handleStorageUpdate);
      clearInterval(interval);
    };
  }, [scanBrowserStorage]);

  // Main domain model builder
  const domainModel = useMemo<DomainModel>(() => {
    const fileClasses: DomainClass[] = [];
    let detectedSqlDdl = '';

    const entries = Object.entries(files);

    // Prioritize mock, data, schema, database files
    entries.sort(([a], [b]) => {
      const aIsData = /mock|data|schema|database|game|inventory|order/i.test(a);
      const bIsData = /mock|data|schema|database|game|inventory|order/i.test(b);
      if (aIsData && !bIsData) return -1;
      if (!aIsData && bIsData) return 1;
      return 0;
    });

    for (const [filePath, fileDirent] of entries) {
      if (!fileDirent || fileDirent.type !== 'file' || !fileDirent.content) {
        continue;
      }

      if (filePath.endsWith('.sql')) {
        detectedSqlDdl += '\n' + fileDirent.content;
      }

      if (isIgnoredInfrastructureFile(filePath)) {
        continue;
      }

      if (
        filePath.endsWith('.ts') ||
        filePath.endsWith('.tsx') ||
        filePath.endsWith('.js') ||
        filePath.endsWith('.jsx') ||
        filePath.endsWith('.json') ||
        filePath.endsWith('.sql')
      ) {
        const extracted = extractTablesFromSourceCode(fileDirent.content, filePath);
        for (const item of extracted) {
          const existingIdx = fileClasses.findIndex(
            (c) =>
              c.table_name === item.table_name ||
              c.name.toLowerCase() === item.name.toLowerCase() ||
              c.table_name === item.table_name + 's' ||
              c.table_name + 's' === item.table_name,
          );

          if (existingIdx !== -1) {
            if (item.seed_data.length > 0 && fileClasses[existingIdx].seed_data.length === 0) {
              fileClasses[existingIdx].seed_data = item.seed_data;
              fileClasses[existingIdx].description = item.description;
            }
          } else {
            fileClasses.push(item);
          }
        }
      }
    }

    // Merge with manually imported tables
    for (const impTable of importedTables) {
      const idx = fileClasses.findIndex((c) => c.table_name === impTable.table_name);
      if (idx !== -1) {
        fileClasses[idx] = impTable;
      } else {
        fileClasses.push(impTable);
      }
    }

    // Merge with localStorage tables ONLY for tables already present in the project
    for (const lsTable of localStorageTables) {
      const idx = fileClasses.findIndex((c) => c.table_name === lsTable.table_name);
      if (idx !== -1) {
        fileClasses[idx] = {
          ...fileClasses[idx],
          seed_data: lsTable.seed_data,
          description: `${fileClasses[idx].description} • En vivo`,
          sourceType: 'localStorage',
        };
      }
    }

    // Calculate Foreign Keys across all detected tables
    const tableNames = fileClasses.map((c) => c.table_name);
    fileClasses.forEach((cls) => {
      cls.attributes.forEach((attr) => {
        if (!attr.fk && !attr.pk && (attr.name.toLowerCase().endsWith('id') || attr.name.toLowerCase().endsWith('_id'))) {
          const prefix = attr.name.toLowerCase().replace(/_?id$/, '');
          const match = tableNames.find(
            (t) => t.toLowerCase() === prefix || t.toLowerCase() === prefix + 's' || t.toLowerCase() === prefix + 'es',
          );
          if (match && match !== cls.table_name) {
            attr.fk = `${match}.id`;
          }
        }
      });
    });

    return {
      project_title: 'Base de Datos del Sistema',
      summary: `${fileClasses.length} tablas activas`,
      classes: fileClasses,
      sql_ddl: detectedSqlDdl || generateSqlDdl(fileClasses),
    };
  }, [files, localStorageTables, importedTables, refreshTrigger]);

  const currentClass = domainModel.classes[selectedClassIndex] || domainModel.classes[0] || null;

  // Sync selected table to global workbenchStore so ReportsView and LLM know active table context
  useEffect(() => {
    if (currentClass?.table_name) {
      workbenchStore.selectedDatabaseTable.set(currentClass.table_name);
    }
  }, [currentClass?.table_name]);

  // Filter tables in sidebar
  const filteredClasses = useMemo(() => {
    if (!searchTableQuery.trim()) return domainModel.classes;
    const q = searchTableQuery.toLowerCase();
    return domainModel.classes.filter(
      (c) => c.name.toLowerCase().includes(q) || c.table_name.toLowerCase().includes(q),
    );
  }, [domainModel.classes, searchTableQuery]);

  // Filter records in data table
  const filteredSeedData = useMemo(() => {
    if (!currentClass?.seed_data) return [];
    if (!searchDataQuery.trim()) return currentClass.seed_data;

    const query = searchDataQuery.toLowerCase();
    return currentClass.seed_data.filter((row) =>
      Object.values(row).some((val) => String(val).toLowerCase().includes(query)),
    );
  }, [currentClass, searchDataQuery]);

  // Manual refresh & scan
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    scanBrowserStorage();
    setRefreshTrigger((prev) => prev + 1);
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success(`Sincronizado: ${domainModel.classes.length} tablas encontradas`);
    }, 400);
  }, [scanBrowserStorage, domainModel.classes.length]);

  // File Import handler (.ts, .js, .json, .sql, .zip)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsRefreshing(true);
      const newlyDetected: DomainClass[] = [];

      if (file.name.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(file);
        for (const [filename, zipEntry] of Object.entries(zip.files)) {
          if (!zipEntry.dir && (filename.endsWith('.ts') || filename.endsWith('.tsx') || filename.endsWith('.js') || filename.endsWith('.jsx') || filename.endsWith('.json'))) {
            const content = await zipEntry.async('text');
            const extracted = extractTablesFromSourceCode(content, filename);
            for (const t of extracted) {
              if (!newlyDetected.some((x) => x.table_name === t.table_name)) {
                newlyDetected.push({ ...t, sourceType: 'imported' });
              }
            }
          }
        }
      } else {
        const text = await file.text();
        const extracted = extractTablesFromSourceCode(text, file.name);
        for (const t of extracted) {
          if (!newlyDetected.some((x) => x.table_name === t.table_name)) {
            newlyDetected.push({ ...t, sourceType: 'imported' });
          }
        }
      }

      if (newlyDetected.length > 0) {
        setImportedTables((prev) => {
          const merged = [...prev];
          for (const n of newlyDetected) {
            const idx = merged.findIndex((m) => m.table_name === n.table_name);
            if (idx !== -1) merged[idx] = n;
            else merged.push(n);
          }
          return merged;
        });

        // Persist imported tables to schema.json
        const fullSchema = {
          project_title: 'Esquema Importado',
          classes: newlyDetected,
          sql_ddl: generateSqlDdl(newlyDetected),
        };

        await workbenchStore.saveFileContent(
          '/home/project/src/db/schema.json',
          JSON.stringify(fullSchema, null, 2),
        );

        toast.success(`¡Éxito! Se importaron ${newlyDetected.length} tablas de ${file.name}`);
      } else {
        toast.warn(`No se detectaron tablas de datos en ${file.name}`);
      }
    } catch (err: any) {
      console.error('Error importando archivo:', err);
      toast.error('Error al procesar el archivo: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsRefreshing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Persist changes to project files and localStorage
  const persistChanges = async (updatedClasses: DomainClass[], activeClass?: DomainClass) => {
    try {
      // 1. Sync active class to localStorage
      if (activeClass && typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(activeClass.table_name, JSON.stringify(activeClass.seed_data));
          window.dispatchEvent(new Event('storage'));
          document.dispatchEvent(new CustomEvent('bolt-data-updated'));
        } catch {
          // ignore quota
        }
      }

      // 2. Save src/db/schema.json & db/schema.sql
      const fullSchemaJson = {
        project_title: domainModel.project_title || 'Database Schema',
        classes: updatedClasses,
        sql_ddl: generateSqlDdl(updatedClasses),
      };

      await workbenchStore.saveFileContent(
        '/home/project/src/db/schema.json',
        JSON.stringify(fullSchemaJson, null, 2),
      );

      await workbenchStore.saveFileContent(
        '/home/project/db/schema.sql',
        fullSchemaJson.sql_ddl,
      );

      // 3. Update source mockData file if it exists in WebContainer
      if (activeClass?.sourceFile && activeClass.sourceFile.startsWith('/home/project/')) {
        const dirent = files[activeClass.sourceFile];
        const fileContent = dirent && dirent.type === 'file' ? dirent.content : undefined;
        if (fileContent && fileContent.includes(activeClass.table_name)) {
          const regex = new RegExp(
            `((?:export\\s+)?(?:const|let|var)\\s+${activeClass.table_name}\\s*(?::\\s*[^=]+)?=\\s*)\\[[\\s\\S]*?\\];?`,
            'i',
          );
          if (regex.test(fileContent)) {
            const updatedContent = fileContent.replace(
              regex,
              `$1${JSON.stringify(activeClass.seed_data, null, 2)};`,
            );
            await workbenchStore.saveFileContent(activeClass.sourceFile, updatedContent);
          }
        }
      }

      scanBrowserStorage();
      setRefreshTrigger((prev) => prev + 1);
      toast.success('Cambios guardados con éxito');
    } catch (error) {
      console.error('Error guardando cambios:', error);
      toast.error('No se pudo guardar los cambios en el proyecto');
    }
  };

  // Add new row record
  const handleSaveNewRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClass) return;

    const formattedRecord: Record<string, any> = {};
    currentClass.attributes.forEach((attr) => {
      const rawVal = newRecordFields[attr.name] ?? '';
      if (attr.type.includes('INT')) {
        formattedRecord[attr.name] = rawVal === '' ? Date.now() : parseInt(rawVal, 10) || 0;
      } else if (attr.type.includes('DECIMAL') || attr.type.includes('REAL') || attr.type.includes('FLOAT')) {
        formattedRecord[attr.name] = parseFloat(rawVal) || 0;
      } else if (attr.type.includes('BOOL')) {
        formattedRecord[attr.name] = rawVal === 'true' || rawVal === '1';
      } else {
        formattedRecord[attr.name] = rawVal || (attr.pk ? `id-${Date.now()}` : '');
      }
    });

    const updatedCurrentClass = {
      ...currentClass,
      seed_data: [...(currentClass.seed_data || []), formattedRecord],
    };

    const updatedClasses = domainModel.classes.map((c) =>
      c.table_name === currentClass.table_name ? updatedCurrentClass : c,
    );

    await persistChanges(updatedClasses, updatedCurrentClass);
    setIsAddRecordModalOpen(false);
    setNewRecordFields({});
  };

  // Delete row record
  const handleDeleteRecord = async (rowIndex: number) => {
    if (!currentClass) return;
    if (!confirm('¿Seguro que deseas eliminar este registro de la base de datos?')) return;

    const newData = [...currentClass.seed_data];
    newData.splice(rowIndex, 1);

    const updatedCurrentClass = { ...currentClass, seed_data: newData };
    const updatedClasses = domainModel.classes.map((c) =>
      c.table_name === currentClass.table_name ? updatedCurrentClass : c,
    );

    await persistChanges(updatedClasses, updatedCurrentClass);
  };

  // Add new table
  const handleSaveNewTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableForm.name.trim()) return;

    const tableName = newTableForm.table_name.trim().toLowerCase() || newTableForm.name.toLowerCase() + 's';
    const newClass: DomainClass = {
      name: newTableForm.name.trim(),
      table_name: tableName,
      description: newTableForm.description.trim() || `Tabla ${tableName}`,
      attributes: [
        { name: 'id', type: 'INTEGER', pk: true, description: 'Identificador único' },
        { name: 'nombre', type: 'TEXT', description: 'Nombre o título' },
        { name: 'created_at', type: 'TIMESTAMP', description: 'Fecha de creación' },
      ],
      seed_data: [
        { id: 1, nombre: `Ejemplo ${newTableForm.name} 1`, created_at: new Date().toISOString() },
        { id: 2, nombre: `Ejemplo ${newTableForm.name} 2`, created_at: new Date().toISOString() },
      ],
      sourceFile: '/home/project/src/db/schema.json',
      sourceType: 'file',
    };

    const updatedClasses = [...domainModel.classes, newClass];
    await persistChanges(updatedClasses, newClass);
    setIsAddTableModalOpen(false);
    setSelectedClassIndex(updatedClasses.length - 1);
    setNewTableForm({ name: '', table_name: '', description: '' });
  };

  // Add new column to current table
  const handleSaveNewColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClass || !newColumnForm.name.trim()) return;

    const newAttr: ClassAttribute = {
      name: newColumnForm.name.trim(),
      type: newColumnForm.type,
      pk: newColumnForm.pk,
      fk: newColumnForm.fk.trim() || null,
      description: newColumnForm.description.trim() || undefined,
    };

    const updatedCurrentClass = {
      ...currentClass,
      attributes: [...currentClass.attributes, newAttr],
    };

    const updatedClasses = domainModel.classes.map((c) =>
      c.table_name === currentClass.table_name ? updatedCurrentClass : c,
    );

    await persistChanges(updatedClasses, updatedCurrentClass);
    setIsAddColumnModalOpen(false);
    setNewColumnForm({ name: '', type: 'TEXT', pk: false, fk: '', description: '' });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('SQL copiado al portapapeles');
  };

  return (
    <div
      className="h-full flex overflow-hidden bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary tracking-normal select-none"
      style={{
        fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        fontStyle: 'normal',
      }}
    >
      {/* Hidden File Input for Data / Zip Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
        accept=".ts,.tsx,.js,.jsx,.json,.sql,.zip"
      />

      {/* LEFT COLUMN: Tables / Classes Explorer */}
      <div className="w-72 border-r border-bolt-elements-borderColor flex flex-col shrink-0 bg-bolt-elements-background-depth-1">
        {/* Header */}
        <div className="h-11 px-3.5 flex items-center justify-between border-b border-bolt-elements-borderColor">
          <div className="flex items-center gap-2">
            <div className="i-ph:database text-emerald-500 text-base" />
            <span className="text-xs font-semibold text-bolt-elements-textPrimary">Tablas del Sistema</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary font-medium">
              {domainModel.classes.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-7 h-7 rounded-md bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor text-bolt-elements-textPrimary hover:text-emerald-400 transition cursor-pointer flex items-center justify-center shadow-xs"
              title="Cargar archivo de datos (mockData.ts, JSON, SQL, games.zip)"
            >
              <div className="i-ph:folder-open text-sm" />
            </button>
            <button
              onClick={handleRefresh}
              className="w-7 h-7 rounded-md bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor text-bolt-elements-textPrimary hover:text-emerald-400 transition cursor-pointer flex items-center justify-center shadow-xs"
              title="Refrescar y re-escanear tablas del proyecto"
            >
              <div
                className={classNames('i-ph:arrows-clockwise text-sm', {
                  'animate-spin text-emerald-400': isRefreshing,
                })}
              />
            </button>
            <button
              onClick={() => setIsAddTableModalOpen(true)}
              className="w-7 h-7 rounded-md bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor text-bolt-elements-textPrimary hover:text-emerald-400 transition cursor-pointer flex items-center justify-center shadow-xs"
              title="Crear nueva tabla manualmente"
            >
              <div className="i-ph:plus text-sm" />
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="p-2.5 border-b border-bolt-elements-borderColor">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar tabla..."
              value={searchTableQuery}
              onChange={(e) => setSearchTableQuery(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 text-xs rounded-md bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <div className="i-ph:magnifying-glass absolute left-2 top-1/2 -translate-y-1/2 text-bolt-elements-textTertiary text-xs" />
          </div>
        </div>

        {/* Tables List */}
        <div className="p-2 space-y-1 overflow-y-auto flex-1 modern-scrollbar">
          {domainModel.classes.length === 0 ? (
            <div className="p-6 text-center text-xs text-bolt-elements-textTertiary flex flex-col items-center gap-2">
              <div className="i-ph:database text-2xl opacity-40" />
              <span>No se encontraron tablas aún en el proyecto.</span>
              <div className="flex flex-col gap-1.5 w-full mt-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <div className="i-ph:folder-open text-xs" />
                  <span>Importar mockData / ZIP</span>
                </button>
                <button
                  onClick={() => setIsAddTableModalOpen(true)}
                  className="px-3 py-1.5 text-xs rounded-md bg-bolt-elements-background-depth-3 hover:bg-bolt-elements-background-depth-4 text-bolt-elements-textPrimary font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <div className="i-ph:plus text-xs" />
                  <span>Crear Primera Tabla</span>
                </button>
              </div>
            </div>
          ) : (
            filteredClasses.map((cls) => {
              const originalIndex = domainModel.classes.findIndex((c) => c.table_name === cls.table_name);
              const isSelected = selectedClassIndex === originalIndex;

              return (
                <div
                  key={cls.table_name}
                  onClick={() => setSelectedClassIndex(originalIndex)}
                  className={classNames(
                    'p-2.5 rounded-lg border text-xs cursor-pointer transition select-none flex flex-col gap-1',
                    isSelected
                      ? 'bg-bolt-elements-item-backgroundAccent border-emerald-500/40 text-bolt-elements-item-contentAccent shadow-sm'
                      : 'border-transparent text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive hover:text-bolt-elements-textPrimary',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-medium">
                      <div className={classNames('i-ph:table text-sm', isSelected ? 'text-emerald-400' : 'opacity-70')} />
                      <span className="font-semibold text-xs text-bolt-elements-textPrimary">{cls.name}</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary font-medium">
                      {cls.seed_data?.length || 0} filas
                    </span>
                  </div>
                  <div className="text-xs text-bolt-elements-textTertiary truncate font-normal flex items-center justify-between">
                    <span>tbl: {cls.table_name}</span>
                    {cls.sourceFile && (
                      <span className="text-[10px] text-bolt-elements-textTertiary truncate max-w-[95px]" title={cls.sourceFile}>
                        {cls.sourceFile.split('/').pop()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Table Inspector & Data Editor */}
      <div className="flex-1 flex flex-col overflow-hidden bg-bolt-elements-background-depth-2 select-text">
        {currentClass ? (
          <>
            {/* Header Toolbar */}
            <div className="h-12 px-4 flex items-center justify-between border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-1">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                  <div className="i-ph:table text-lg" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">{currentClass.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary font-normal">
                      {currentClass.table_name}
                    </span>
                    {currentClass.sourceType === 'localStorage' && (
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                        Live Storage
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-bolt-elements-textTertiary truncate max-w-md">
                    {currentClass.description || 'Sin descripción'}
                  </p>
                </div>
              </div>

              {/* Subtabs + Actions */}
              <div className="flex items-center gap-2">
                <div className="flex items-center p-1 rounded-lg bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor gap-1">
                  <button
                    onClick={() => setDbSubTab('data')}
                    className={classNames(
                      'px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition cursor-pointer',
                      dbSubTab === 'data'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold shadow-xs'
                        : 'bg-transparent text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3 border border-transparent',
                    )}
                  >
                    <div className="i-ph:database text-xs" />
                    <span>Datos ({currentClass.seed_data?.length || 0})</span>
                  </button>

                  <button
                    onClick={() => setDbSubTab('structure')}
                    className={classNames(
                      'px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition cursor-pointer',
                      dbSubTab === 'structure'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold shadow-xs'
                        : 'bg-transparent text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3 border border-transparent',
                    )}
                  >
                    <div className="i-ph:columns text-xs" />
                    <span>Estructura ({currentClass.attributes?.length || 0})</span>
                  </button>

                  <button
                    onClick={() => setDbSubTab('sql')}
                    className={classNames(
                      'px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition cursor-pointer',
                      dbSubTab === 'sql'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold shadow-xs'
                        : 'bg-transparent text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3 border border-transparent',
                    )}
                  >
                    <div className="i-ph:code text-xs" />
                    <span>SQL DDL</span>
                  </button>
                </div>

                {dbSubTab === 'data' && (
                  <button
                    onClick={() => {
                      const initialFields: Record<string, string> = {};
                      currentClass.attributes.forEach((attr) => {
                        if (attr.pk && attr.type.includes('INT')) {
                          initialFields[attr.name] = String((currentClass.seed_data?.length || 0) + 1);
                        } else {
                          initialFields[attr.name] = '';
                        }
                      });
                      setNewRecordFields(initialFields);
                      setIsAddRecordModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                  >
                    <div className="i-ph:plus text-xs" />
                    <span>Agregar Registro</span>
                  </button>
                )}

                {dbSubTab === 'structure' && (
                  <button
                    onClick={() => setIsAddColumnModalOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                  >
                    <div className="i-ph:plus text-xs" />
                    <span>Agregar Columna</span>
                  </button>
                )}
              </div>
            </div>

            {/* Subtab Content */}
            <div className="flex-1 overflow-auto p-4 modern-scrollbar">
              {/* 1. DATA TAB */}
              {dbSubTab === 'data' && (
                <div className="flex flex-col gap-3 h-full">
                  {/* Filter Toolbar */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="relative w-72">
                      <input
                        type="text"
                        placeholder="Buscar en registros..."
                        value={searchDataQuery}
                        onChange={(e) => setSearchDataQuery(e.target.value)}
                        className="w-full pl-7 pr-3 py-1.5 text-xs rounded-md bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      <div className="i-ph:magnifying-glass absolute left-2 top-1/2 -translate-y-1/2 text-bolt-elements-textTertiary text-xs" />
                    </div>

                    <div className="text-xs text-bolt-elements-textTertiary font-medium">
                      Mostrando {filteredSeedData.length} de {currentClass.seed_data?.length || 0} registros
                    </div>
                  </div>

                  {filteredSeedData.length > 0 ? (
                    <div className="rounded-lg border border-bolt-elements-borderColor overflow-x-auto bg-bolt-elements-background-depth-1 shadow-xs">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-3">
                          <tr>
                            {currentClass.attributes.map((attr) => (
                              <th key={attr.name} className="p-3 text-xs font-semibold text-bolt-elements-textSecondary whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  {attr.pk && <div className="i-ph:key text-amber-400 text-xs" title="Primary Key" />}
                                  <span>{attr.name}</span>
                                </div>
                              </th>
                            ))}
                            <th className="p-3 text-xs font-semibold text-bolt-elements-textSecondary w-14 text-center">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-bolt-elements-borderColor">
                          {filteredSeedData.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-bolt-elements-item-backgroundHover transition-colors">
                              {currentClass.attributes.map((attr) => (
                                <td key={attr.name} className="p-3 text-xs text-bolt-elements-textPrimary whitespace-nowrap font-normal">
                                  {typeof row[attr.name] === 'object'
                                    ? JSON.stringify(row[attr.name])
                                    : String(row[attr.name] ?? '-')}
                                </td>
                              ))}
                              <td className="p-3 text-center">
                                <button
                                  onClick={() => handleDeleteRecord(rIdx)}
                                  className="w-7 h-7 rounded-md bg-bolt-elements-background-depth-2 hover:bg-rose-500/20 border border-bolt-elements-borderColor/70 hover:border-rose-500/40 text-rose-400 hover:text-rose-300 transition cursor-pointer flex items-center justify-center mx-auto shadow-xs"
                                  title="Eliminar fila"
                                >
                                  <div className="i-ph:trash text-sm" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-10 text-center text-xs text-bolt-elements-textTertiary border border-dashed border-bolt-elements-borderColor rounded-lg flex flex-col items-center gap-2">
                      <div className="i-ph:database text-2xl opacity-40" />
                      <span>No hay registros en esta tabla.</span>
                      <button
                        onClick={() => {
                          const initialFields: Record<string, string> = {};
                          currentClass.attributes.forEach((attr) => {
                            initialFields[attr.name] = '';
                          });
                          setNewRecordFields(initialFields);
                          setIsAddRecordModalOpen(true);
                        }}
                        className="mt-2 px-3 py-1.5 text-xs rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium cursor-pointer"
                      >
                        + Agregar Primer Registro
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 2. STRUCTURE TAB */}
              {dbSubTab === 'structure' && (
                <div className="rounded-lg border border-bolt-elements-borderColor overflow-hidden bg-bolt-elements-background-depth-1 shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-3">
                      <tr>
                        <th className="p-3 text-xs font-semibold text-bolt-elements-textSecondary">Atributo</th>
                        <th className="p-3 text-xs font-semibold text-bolt-elements-textSecondary">Tipo de Dato</th>
                        <th className="p-3 text-xs font-semibold text-bolt-elements-textSecondary">Clave</th>
                        <th className="p-3 text-xs font-semibold text-bolt-elements-textSecondary">Descripción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-bolt-elements-borderColor">
                      {currentClass.attributes.map((attr) => (
                        <tr key={attr.name} className="hover:bg-bolt-elements-item-backgroundHover transition-colors">
                          <td className="p-3 font-medium text-emerald-400 flex items-center gap-1.5 text-xs">
                            {attr.pk && <div className="i-ph:key text-amber-400 text-sm" />}
                            <span>{attr.name}</span>
                          </td>
                          <td className="p-3 text-bolt-elements-textSecondary text-xs">{attr.type}</td>
                          <td className="p-3">
                            {attr.pk ? (
                              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-medium">
                                PRIMARY KEY
                              </span>
                            ) : attr.fk ? (
                              <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 text-xs font-medium">
                                FK -&gt; {attr.fk}
                              </span>
                            ) : (
                              <span className="text-bolt-elements-textTertiary text-xs">-</span>
                            )}
                          </td>
                          <td className="p-3 text-bolt-elements-textSecondary text-xs">
                            {attr.description || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 3. SQL DDL TAB */}
              {dbSubTab === 'sql' && (
                <div className="rounded-lg border border-bolt-elements-borderColor p-4 text-xs bg-bolt-elements-background-depth-1 flex flex-col gap-3">
                  <div className="flex items-center justify-between pb-2 border-b border-bolt-elements-borderColor">
                    <span className="text-bolt-elements-textSecondary font-medium">PostgreSQL / SQLite DDL</span>
                    <button
                      onClick={() => copyToClipboard(generateSingleTableSql(currentClass))}
                      className="px-3 py-1.5 rounded-md border border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary flex items-center gap-1.5 transition text-xs cursor-pointer"
                    >
                      <div className="i-ph:copy text-xs" />
                      <span>Copiar SQL</span>
                    </button>
                  </div>
                  <pre className="text-emerald-400 overflow-x-auto p-3.5 rounded bg-bolt-elements-background-depth-3 selection:bg-emerald-600 selection:text-white leading-relaxed font-mono text-xs">
                    <code>{generateSingleTableSql(currentClass)}</code>
                  </pre>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-3">
            <div className="i-ph:database text-4xl text-bolt-elements-textTertiary" />
            <h4 className="text-sm font-semibold text-bolt-elements-textPrimary">Selecciona una tabla en el panel lateral</h4>
            <p className="text-xs text-bolt-elements-textTertiary max-w-sm">
              Podrás explorar sus atributos, claves primarias, foráneas, ejecutar cambios e insertar filas interactivamente.
            </p>
          </div>
        )}
      </div>

      {/* MODAL: Add Record */}
      {isAddRecordModalOpen && currentClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-4 py-3 border-b border-bolt-elements-borderColor flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-bolt-elements-textPrimary">
                <div className="i-ph:plus text-emerald-400" />
                <span>Nuevo Registro en {currentClass.name}</span>
              </h3>
              <button
                onClick={() => setIsAddRecordModalOpen(false)}
                className="text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary p-1 cursor-pointer"
              >
                <div className="i-ph:x text-base" />
              </button>
            </div>

            <form onSubmit={handleSaveNewRecord} className="p-4 overflow-y-auto space-y-3 flex-1">
              {currentClass.attributes.map((attr) => (
                <div key={attr.name} className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-bolt-elements-textSecondary flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      {attr.pk && <div className="i-ph:key text-amber-400 text-xs" />}
                      <span>{attr.name}</span>
                    </span>
                    <span className="text-xs text-bolt-elements-textTertiary font-normal">{attr.type}</span>
                  </label>
                  <input
                    type="text"
                    placeholder={`Valor para ${attr.name}...`}
                    value={newRecordFields[attr.name] ?? ''}
                    onChange={(e) =>
                      setNewRecordFields({
                        ...newRecordFields,
                        [attr.name]: e.target.value,
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-md bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              ))}

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-bolt-elements-borderColor">
                <button
                  type="button"
                  onClick={() => setIsAddRecordModalOpen(false)}
                  className="px-3 py-1.5 text-xs rounded-md hover:bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <div className="i-ph:check text-xs" />
                  <span>Guardar Fila</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Table */}
      {isAddTableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-xl shadow-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-bolt-elements-borderColor pb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-bolt-elements-textPrimary">
                <div className="i-ph:table text-emerald-400" />
                <span>Crear Nueva Tabla</span>
              </h3>
              <button
                onClick={() => setIsAddTableModalOpen(false)}
                className="text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary p-1 cursor-pointer"
              >
                <div className="i-ph:x text-base" />
              </button>
            </div>

            <form onSubmit={handleSaveNewTable} className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-bolt-elements-textSecondary">Nombre de la Clase / Entidad</label>
                <input
                  type="text"
                  placeholder="Ej: Producto, Cliente, Factura"
                  required
                  value={newTableForm.name}
                  onChange={(e) =>
                    setNewTableForm({
                      ...newTableForm,
                      name: e.target.value,
                      table_name: e.target.value.toLowerCase() + 's',
                    })
                  }
                  className="w-full px-3 py-1.5 text-xs rounded-md bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-bolt-elements-textSecondary">Nombre de Tabla en Base de Datos</label>
                <input
                  type="text"
                  placeholder="Ej: productos, clientes"
                  required
                  value={newTableForm.table_name}
                  onChange={(e) => setNewTableForm({ ...newTableForm, table_name: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-md bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-bolt-elements-textSecondary">Descripción</label>
                <input
                  type="text"
                  placeholder="Ej: Catálogo de productos disponibles"
                  value={newTableForm.description}
                  onChange={(e) => setNewTableForm({ ...newTableForm, description: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-md bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-bolt-elements-borderColor">
                <button
                  type="button"
                  onClick={() => setIsAddTableModalOpen(false)}
                  className="px-3 py-1.5 text-xs rounded-md hover:bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <div className="i-ph:check text-xs" />
                  <span>Crear Tabla</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Column */}
      {isAddColumnModalOpen && currentClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-xl shadow-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-bolt-elements-borderColor pb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-bolt-elements-textPrimary">
                <div className="i-ph:columns text-emerald-400" />
                <span>Agregar Columna a {currentClass.name}</span>
              </h3>
              <button
                onClick={() => setIsAddColumnModalOpen(false)}
                className="text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary p-1 cursor-pointer"
              >
                <div className="i-ph:x text-base" />
              </button>
            </div>

            <form onSubmit={handleSaveNewColumn} className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-bolt-elements-textSecondary">Nombre de la Columna</label>
                <input
                  type="text"
                  placeholder="Ej: precio, stock, categoria_id"
                  required
                  value={newColumnForm.name}
                  onChange={(e) => setNewColumnForm({ ...newColumnForm, name: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-md bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-bolt-elements-textSecondary">Tipo de Dato</label>
                  <select
                    value={newColumnForm.type}
                    onChange={(e) => setNewColumnForm({ ...newColumnForm, type: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-md bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="TEXT">TEXT / VARCHAR</option>
                    <option value="INTEGER">INTEGER</option>
                    <option value="DECIMAL">DECIMAL / REAL</option>
                    <option value="BOOLEAN">BOOLEAN</option>
                    <option value="TIMESTAMP">TIMESTAMP / DATE</option>
                    <option value="JSON">JSON / JSONB</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-bolt-elements-textSecondary">Clave Foránea (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej: categorias.id"
                    value={newColumnForm.fk}
                    onChange={(e) => setNewColumnForm({ ...newColumnForm, fk: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-md bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isPk"
                  checked={newColumnForm.pk}
                  onChange={(e) => setNewColumnForm({ ...newColumnForm, pk: e.target.checked })}
                  className="rounded border-bolt-elements-borderColor text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="isPk" className="text-xs text-bolt-elements-textSecondary select-none cursor-pointer">
                  Es Primary Key (PK)
                </label>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-bolt-elements-textSecondary">Descripción</label>
                <input
                  type="text"
                  placeholder="Descripción de la columna"
                  value={newColumnForm.description}
                  onChange={(e) => setNewColumnForm({ ...newColumnForm, description: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-md bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-bolt-elements-borderColor">
                <button
                  type="button"
                  onClick={() => setIsAddColumnModalOpen(false)}
                  className="px-3 py-1.5 text-xs rounded-md hover:bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <div className="i-ph:check text-xs" />
                  <span>Agregar Columna</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function generateSingleTableSql(cls: DomainClass): string {
  const columnDefs = cls.attributes.map((attr) => {
    let def = `  ${attr.name} ${attr.type}`;
    if (attr.pk) def += ' PRIMARY KEY';
    if (attr.fk) def += ` REFERENCES ${attr.fk}`;
    return def;
  });

  let sql = `-- Definición de la tabla: ${cls.table_name}\n`;
  sql += `CREATE TABLE IF NOT EXISTS ${cls.table_name} (\n`;
  sql += columnDefs.join(',\n');
  sql += '\n);\n';

  if (cls.seed_data && cls.seed_data.length > 0) {
    sql += `\n-- Datos iniciales para ${cls.table_name}\n`;
    cls.seed_data.forEach((row) => {
      const keys = Object.keys(row);
      const vals = keys.map((k) => {
        const val = row[k];
        if (typeof val === 'number' || typeof val === 'boolean') return val;
        return `'${String(val).replace(/'/g, "''")}'`;
      });
      sql += `INSERT INTO ${cls.table_name} (${keys.join(', ')}) VALUES (${vals.join(', ')});\n`;
    });
  }

  return sql;
}

function generateSqlDdl(classes: DomainClass[]): string {
  if (!classes || classes.length === 0) return '-- No hay tablas definidas';
  return classes.map((c) => generateSingleTableSql(c)).join('\n\n');
}
