import alasql from 'alasql';
import type { FileMap } from '~/lib/stores/files';
import { workbenchStore } from '~/lib/stores/workbench';
import { isIgnoredInfrastructureFile } from '~/components/workbench/database/DatabaseView';

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

export interface ReportAttribute {
  name: string;
  type: string;
  pk?: boolean;
  fk?: string | null;
  description?: string;
}

export interface ReportTable {
  name: string;
  table_name: string;
  description?: string;
  attributes: ReportAttribute[];
  seed_data: Record<string, any>[];
  source?: string;
}

export interface KPIItem {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: string;
  color?: string;
}

export interface ChartConfig {
  type: 'bar' | 'pie' | 'line';
  labelColumn: string;
  valueColumn: string;
  labels: string[];
  values: number[];
}

export interface ReportExecutionResult {
  sql: string;
  rows: Record<string, any>[];
  columns: string[];
  executionTimeMs: number;
  kpis: KPIItem[];
  chartConfig?: ChartConfig;
  error?: string;
}

// -------------------------------------------------------------
// TABLE & SCHEMA EXTRACTION
// -------------------------------------------------------------

function cleanCodeComments(code: string): string {
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

    if (ch === '/' && next === '/') {
      while (i < len && code[i] !== '\n') {
        result += ' ';
        i++;
      }
      continue;
    }

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

function inferAttributes(records: Record<string, any>[]): ReportAttribute[] {
  if (!records || records.length === 0) {
    return [{ name: 'id', type: 'INTEGER', pk: true, description: 'ID' }];
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
      }
    }

    const lower = key.toLowerCase();
    const isPk = lower === 'id' || lower === '_id';
    return {
      name: key,
      type,
      pk: isPk,
      fk: !isPk && (lower.endsWith('id') || lower.endsWith('_id')) ? `${lower.replace(/_?id$/, '')}s.id` : null,
    };
  });
}

// -------------------------------------------------------------
// INSTANTIATION PARSER FOR DOMAIN CLASSES & MODELS
// -------------------------------------------------------------

/**
 * Parses `new ClassName(arg1, arg2, ...)` instantiations from array datasets
 */
function parseNewInstantiations(
  arrayContent: string,
  targetClass?: ReportTable,
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

function normalizeText(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function getWordStem(word: string): string {
  let w = normalizeText(word);
  if (w.length <= 3) return w;

  // Plurals: -es or -s
  if (w.endsWith('ces')) {
    w = w.slice(0, -3) + 'z';
  } else if (w.endsWith('es') && !w.endsWith('ses')) {
    w = w.slice(0, -2);
  } else if (w.endsWith('s') && !w.endsWith('ss')) {
    w = w.slice(0, -1);
  }

  // Gender: -o or -a
  if (w.length > 3 && (w.endsWith('o') || w.endsWith('a'))) {
    w = w.slice(0, -1);
  }

  return w;
}

// Parser for SQL DDL and DML statements
export function parseSQLScriptToTables(sqlContent: string, sourcePath: string): ReportTable[] {
  const resultTables: ReportTable[] = [];
  if (!sqlContent || typeof sqlContent !== 'string') return resultTables;

  // 1. CREATE TABLE statements
  const createRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?([a-zA-Z0-9_]+)["'`]?\s*\(([\s\S]*?)\);/gi;
  let createMatch;

  while ((createMatch = createRegex.exec(sqlContent)) !== null) {
    const rawTableName = createMatch[1];
    const columnsBody = createMatch[2];
    const tableName = rawTableName.toLowerCase();

    const attributes: ReportAttribute[] = [];
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
        });
      }
    }

    resultTables.push({
      name: rawTableName.charAt(0).toUpperCase() + rawTableName.slice(1),
      table_name: tableName,
      description: `Tabla SQL ${rawTableName} (${sourcePath})`,
      attributes,
      seed_data: [],
      source: sourcePath,
    });
  }

  // 2. INSERT INTO statements
  const insertRegex = /INSERT\s+INTO\s+["'`]?([a-zA-Z0-9_]+)["'`]?\s*(?:\(([\s\S]*?)\))?\s*VALUES\s*([\s\S]*?);/gi;
  let insertMatch;

  while ((insertMatch = insertRegex.exec(sqlContent)) !== null) {
    const targetTableName = insertMatch[1].toLowerCase();
    const explicitCols = insertMatch[2]
      ? insertMatch[2].split(',').map((c) => c.trim().replace(/^["'`]|["'`]$/g, ''))
      : null;
    const valuesPart = insertMatch[3];

    const targetTable = resultTables.find((t) => t.table_name === targetTableName);
    if (!targetTable) continue;

    const tupleRegex = /\(([\s\S]*?)\)/g;
    let tupleMatch;

    while ((tupleMatch = tupleRegex.exec(valuesPart)) !== null) {
      const tupleStr = tupleMatch[1];
      const parsedValues: any[] = [];
      const valRegex = /'((?:''|[^'])*)'|"((?:""|[^"])*)"|([0-9]+(?:\.[0-9]+)?)|(true|false)|(null)/gi;
      let valMatch;

      while ((valMatch = valRegex.exec(tupleStr)) !== null) {
        if (valMatch[1] !== undefined) {
          parsedValues.push(valMatch[1].replace(/''/g, "'"));
        } else if (valMatch[2] !== undefined) {
          parsedValues.push(valMatch[2].replace(/""/g, '"'));
        } else if (valMatch[3] !== undefined) {
          parsedValues.push(Number(valMatch[3]));
        } else if (valMatch[4] !== undefined) {
          parsedValues.push(valMatch[4].toLowerCase() === 'true');
        } else if (valMatch[5] !== undefined) {
          parsedValues.push(null);
        }
      }

      if (parsedValues.length > 0) {
        const row: Record<string, any> = {};
        const colNames = explicitCols || targetTable.attributes.map((a) => a.name);

        colNames.forEach((cName, idx) => {
          if (idx < parsedValues.length) {
            row[cName] = parsedValues[idx];
          }
        });

        targetTable.seed_data.push(row);
      }
    }
  }

  return resultTables;
}

export function extractProjectTables(files: FileMap): ReportTable[] {
  const tables: ReportTable[] = [];

  // Look for SQL files, JSON files, mock data, and ts/jsx files
  for (const [filePath, dirent] of Object.entries(files)) {
    if (!dirent || dirent.type !== 'file' || !dirent.content) continue;
    if (isIgnoredInfrastructureFile(filePath)) continue;
    const code = dirent.content;

    // 0. SQL Files or files containing CREATE TABLE / INSERT INTO
    if (filePath.endsWith('.sql') || /CREATE\s+TABLE/i.test(code)) {
      try {
        const sqlTables = parseSQLScriptToTables(code, filePath);
        sqlTables.forEach((st) => {
          const existIdx = tables.findIndex((t) => t.table_name === st.table_name);
          if (existIdx !== -1) {
            tables[existIdx] = st;
          } else {
            tables.push(st);
          }
        });
      } catch {
        // ignore sql parsing errors
      }
    }

    // 1. JSON files
    if (filePath.endsWith('.json') && !filePath.includes('package') && !filePath.includes('tsconfig')) {
      try {
        const parsed = JSON.parse(code);
        if (parsed && Array.isArray(parsed.classes)) {
          parsed.classes.forEach((c: any) => {
            tables.push({
              name: c.name || c.table_name || 'Item',
              table_name: (c.table_name || c.name || 'items').toLowerCase(),
              description: c.description,
              attributes: c.attributes || inferAttributes(c.seed_data || []),
              seed_data: c.seed_data || [],
              source: filePath,
            });
          });
        } else if (typeof parsed === 'object' && !Array.isArray(parsed)) {
          for (const [key, val] of Object.entries(parsed)) {
            if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
              tables.push({
                name: key.charAt(0).toUpperCase() + key.slice(1),
                table_name: key.toLowerCase(),
                description: `Datos extraídos de ${filePath}`,
                attributes: inferAttributes(val),
                seed_data: val,
                source: filePath,
              });
            }
          }
        }
      } catch {
        // ignore
      }
    }

    // 2. TypeScript Interfaces & Classes
    if (/\.(ts|tsx|d\.ts)$/.test(filePath) && !filePath.includes('node_modules')) {
      const ifaceRegex = /(?:export\s+)?interface\s+([a-zA-Z0-9_$]+)\s*(?:extends\s+[^{]+)?\s*\{([\s\S]*?)\}/g;
      let ifaceMatch;
      while ((ifaceMatch = ifaceRegex.exec(code)) !== null) {
        const ifaceName = ifaceMatch[1];
        const body = ifaceMatch[2];
        if (/Props$|State$|Context$|Config$|Options$|Params$|Event$|Handler$/i.test(ifaceName)) continue;

        const attrRegex = /([a-zA-Z0-9_$]+)\s*(\?)?\s*:\s*([^;,\n]+)/g;
        const attributes: ReportAttribute[] = [];
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
          const isPk = lower === 'id' || lower === '_id';
          attributes.push({ name: attrName, type, pk: isPk, description: isPk ? 'Clave primaria' : `Campo ${attrName}` });
        }

        if (attributes.length > 0) {
          const tableName = ifaceName.toLowerCase() + (ifaceName.toLowerCase().endsWith('s') ? '' : 's');
          const existing = tables.find((t) => t.table_name === tableName || t.name === ifaceName);
          if (!existing) {
            tables.push({
              name: ifaceName,
              table_name: tableName,
              description: `Esquema de interfaz ${ifaceName} (${filePath.split('/').pop()})`,
              attributes,
              seed_data: [],
              source: filePath,
            });
          }
        }
      }

      // Classes
      const classRegex = /(?:export\s+)?class\s+([a-zA-Z0-9_$]+)\s*(?:extends\s+[^{]+)?\s*(?:implements\s+[^{]+)?\s*\{([\s\S]*?)\}/g;
      let classMatch;
      while ((classMatch = classRegex.exec(code)) !== null) {
        const className = classMatch[1];
        const body = classMatch[2];
        if (/Service$|Store$|Controller$|Provider$|Component$|Error$|Exception$/i.test(className)) continue;

        const attributes: ReportAttribute[] = [];
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
            const isPk = lower === 'id' || lower === '_id';
            attributes.push({ name: attrName, type, pk: isPk, description: isPk ? 'Clave primaria' : `Campo ${attrName}` });
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
            const isPk = lower === 'id' || lower === '_id';
            attributes.push({ name: attrName, type, pk: isPk, description: isPk ? 'Clave primaria' : `Campo ${attrName}` });
          }
        }

        if (attributes.length > 0) {
          const tableName = className.toLowerCase() + (className.toLowerCase().endsWith('s') ? '' : 's');
          const existing = tables.find((t) => t.table_name === tableName || t.name === className);
          if (!existing) {
            tables.push({
              name: className,
              table_name: tableName,
              description: `Clase de dominio ${className} (${filePath.split('/').pop()})`,
              attributes,
              seed_data: [],
              source: filePath,
            });
          }
        }
      }
    }

    // 3. TypeScript / JavaScript array constants (mockData, initialData, etc.)
    if (/\.(ts|tsx|js|jsx)$/.test(filePath) && !filePath.includes('node_modules')) {
      const cleaned = cleanCodeComments(code);
      const patterns = [
        { regex: /(?:(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)[^=]*=\s*)\[/g, nameIdx: 1 },
        { regex: /(?:const\s+\[\s*([a-zA-Z0-9_$]+)\s*,\s*set[a-zA-Z0-9_$]+\s*\]\s*=\s*useState(?:<[^>]*>)?[\s\S]*?)\[/g, nameIdx: 1 },
        { regex: /(?:['"]?([a-zA-Z0-9_$]+)['"]?\s*:\s*)\[/g, nameIdx: 1 },
      ];

      for (const { regex, nameIdx } of patterns) {
        let match;
        while ((match = regex.exec(cleaned)) !== null) {
          const rawName = match[nameIdx] || 'items';
          const cleanName = rawName.replace(/^initial_?|^default_?|^mock_?/i, '');
          if (
            /^(styles|actions|routes|options|headers|columns|steps|nav|icons|themes|tabs|middleware|plugins|components|rules|settings|overrides|extends|env|files|parseroptions|ignorepatterns|babel|rollup|vite|allow)/i.test(
              cleanName,
            )
          ) {
            continue;
          }

          const bracketIndex = match.index + match[0].length - 1;
          const block = extractBracketBlock(cleaned, bracketIndex);
          if (!block) continue;

          let matchedTable = tables.find(
            (t) =>
              t.table_name === cleanName.toLowerCase() ||
              t.name.toLowerCase() === cleanName.toLowerCase() ||
              t.table_name === cleanName.toLowerCase() + 's' ||
              t.table_name + 's' === cleanName.toLowerCase(),
          );

          const rawObjects = extractObjectsFromBlock(block.content);
          const records = rawObjects
            .map(parseObjectLiteral)
            .filter((o) => Object.keys(o).length > 0 && !isConfigRecord(o));

          if (records.length > 0) {
            const inferred = inferAttributes(records);
            if (inferred.every((attr) => /^(allowconstantexport|noconsole|react-refresh|semi|quotes)$/i.test(attr.name))) {
              continue;
            }

            const tableName = cleanName.toLowerCase();
            const existingIdx = tables.findIndex((t) => t.table_name === tableName);

            if (existingIdx !== -1) {
              tables[existingIdx].seed_data = records;
              const inferred = inferAttributes(records);
              inferred.forEach((attr) => {
                if (!tables[existingIdx].attributes.some((a) => a.name === attr.name)) {
                  tables[existingIdx].attributes.push(attr);
                }
              });
            } else {
              tables.push({
                name: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
                table_name: tableName,
                description: `Tabla extraída de ${filePath} (${cleanName})`,
                attributes: inferAttributes(records),
                seed_data: records,
                source: filePath,
              });
            }
          } else if (/new\s+[a-zA-Z0-9_$]+\s*\(/.test(block.content)) {
            const instances = parseNewInstantiations(block.content, matchedTable);
            if (instances.length > 0) {
              const rows = instances.map((inst) => inst.row);
              if (matchedTable) {
                matchedTable.seed_data = rows;
              } else {
                const firstInst = instances[0];
                const entityName = firstInst.className || cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
                const tbl = entityName.toLowerCase() + (entityName.toLowerCase().endsWith('s') ? '' : 's');
                tables.push({
                  name: entityName,
                  table_name: tbl,
                  description: `Tabla extraída de ${filePath} (${cleanName})`,
                  attributes: Object.keys(rows[0] || {}).map((k) => ({
                    name: k,
                    type: typeof rows[0][k] === 'number' ? 'DECIMAL' : typeof rows[0][k] === 'boolean' ? 'BOOLEAN' : 'TEXT',
                    pk: k.toLowerCase() === 'id' || k.toLowerCase() === '_id',
                  })),
                  seed_data: rows,
                  source: filePath,
                });
              }
            }
          }
        }
      }
    }
  }

  // 4. Browser localStorage inspection (both existing project tables and newly created live tables)
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
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

      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (
          !key ||
          ignoredKeys.has(key) ||
          key.startsWith('__') ||
          key.startsWith('vite') ||
          key.startsWith('remix') ||
          key.startsWith('bolt-') ||
          key.startsWith('sb-') ||
          key.startsWith('supabase-')
        ) {
          continue;
        }

        try {
          const itemVal = window.localStorage.getItem(key);
          if (!itemVal) continue;
          const parsed = JSON.parse(itemVal);
          if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
            const cleanKey = key.replace(/^db_|data_|local_/i, '').toLowerCase();
            const existing = tables.find(
              (t) =>
                t.table_name === cleanKey ||
                t.name.toLowerCase() === cleanKey ||
                t.table_name === cleanKey + 's' ||
                t.table_name + 's' === cleanKey,
            );
            if (existing) {
              existing.seed_data = parsed;
              const inferred = inferAttributes(parsed);
              inferred.forEach((attr) => {
                if (!existing.attributes.some((a) => a.name === attr.name)) {
                  existing.attributes.push(attr);
                }
              });
            } else {
              tables.push({
                name: cleanKey.charAt(0).toUpperCase() + cleanKey.slice(1),
                table_name: cleanKey,
                description: `Tabla en vivo (${cleanKey})`,
                attributes: inferAttributes(parsed),
                seed_data: parsed,
                source: `localStorage['${key}']`,
              });
            }
          }
        } catch {
          // ignore non-json
        }
      }
    } catch {
      // ignore
    }
  }

  return tables;
}

export function buildCompactSchema(tables: ReportTable[]): string {
  return tables
    .map((table) => {
      const cols = table.attributes
        .map((a) => `${a.name} (${a.type.toLowerCase()}${a.pk ? ', PK' : ''})`)
        .join(', ');
      return `Tabla: "${table.table_name}" (Entidad: ${table.name})\n  Descripción: ${table.description || 'Sin descripción'}\n  Columnas: ${cols}`;
    })
    .join('\n\n');
}

// -------------------------------------------------------------
// LOCAL DETERMINISTIC NLP SQL GENERATOR (FALLBACK & ZERO-LATENCY)
// -------------------------------------------------------------

export function generateLocalSemanticSQL(
  prompt: string,
  tables: ReportTable[],
  activeTableName?: string,
): string {
  const pNorm = normalizeText(prompt);
  const promptTokens = pNorm.split(/[\s,.;:!?()]+/).filter(Boolean);

  if (!tables || tables.length === 0) {
    return 'SELECT 1;';
  }

  // Bilingual column dictionary with common domain typos & variations
  const columnSynonyms: Record<string, string[]> = {
    name: ['nombre', 'nombres', 'razon social', 'empresa', 'name', 'title'],
    status: ['estado', 'estados', 'status', 'situacion', 'condicion'],
    category: ['categoria', 'categorias', 'categorya', 'categoriaa', 'rubro', 'sector', 'category'],
    brand: ['marca', 'marcas', 'brand'],
    price: ['precio', 'precios', 'costo', 'costos', 'price'],
    costPrice: ['precio de costo', 'costo unitario', 'costprice'],
    totalStock: ['stock', 'inventario', 'existencia', 'totalstock', 'cantidad'],
    shoeClass: ['clase', 'publico', 'genero', 'shoeclass'],
    shoeType: ['tipo de calzado', 'tipo', 'modelo', 'shoetype'],
    contactName: ['contacto', 'contactos', 'persona', 'contact'],
    email: ['correo', 'correos', 'email', 'emails', 'mail'],
    phone: ['telefono', 'telefonos', 'celular', 'phone'],
    rating: ['rating', 'calificacion', 'calificaciones', 'puntuacion', 'estrellas', 'score'],
    country: ['pais', 'paises', 'nacion', 'origen', 'country'],
    totalSpent: ['gasto', 'gastado', 'monto', 'total gastado', 'inversion', 'spent'],
    activeOrders: ['ordenes activas', 'pedidos activos', 'compras activas', 'activeorders'],
    leadTimeDays: ['tiempo de entrega', 'dias', 'plazo de entrega', 'lead time', 'leadtimedays'],
    paymentTerm: ['plazo de pago', 'termino de pago', 'condicion de pago', 'paymentterm'],
    code: ['codigo', 'code', 'identificador'],
    sku: ['sku', 'codigo de barra'],
    isFeatured: ['destacado', 'destacados', 'featured'],
  };

  // 1. TARGET TABLE RESOLUTION (Smart Multi-Domain Scoring)
  const domainClusters: string[][] = [
    // Items, products, materials, fabrics, tools, medicines, garments, stock, inventory
    [
      'producto', 'productos', 'product', 'products', 'item', 'items', 'articulo', 'articulos',
      'inventario', 'inventory', 'stock', 'material', 'materiales', 'tela', 'telas',
      'prenda', 'prendas', 'ropa', 'traje', 'trajes', 'camisa', 'camisas', 'pantalon', 'pantalones',
      'calzado', 'calzados', 'zapato', 'zapatos', 'tenis', 'sneaker', 'insumo', 'insumos',
      'herramienta', 'herramientas', 'medicamento', 'medicamentos', 'medicina', 'medicinas',
      'equipo', 'equipos', 'catalogo',
    ],
    // Customers, patients, clients, users
    ['cliente', 'clientes', 'customer', 'customers', 'paciente', 'pacientes', 'usuario', 'usuarios', 'user', 'users'],
    // Appointments, schedules, reservations
    ['cita', 'citas', 'appointment', 'appointments', 'turno', 'turnos', 'reserva', 'reservas', 'agenda', 'horario'],
    // Suppliers, vendors
    ['proveedor', 'proveedores', 'supplier', 'suppliers', 'vendor', 'vendors', 'suplidor', 'suplidores', 'abastecedor'],
    // Orders, sales, purchases
    ['orden', 'ordenes', 'order', 'orders', 'pedido', 'pedidos', 'venta', 'ventas', 'compra', 'compras', 'factura', 'facturas'],
    // Employees, staff, doctors, tailors
    ['empleado', 'empleados', 'employee', 'employees', 'personal', 'doctor', 'doctora', 'dentista', 'odontologo', 'sastre', 'staff'],
    // Games
    ['juego', 'juegos', 'videojuego', 'videojuegos', 'game', 'games'],
  ];

  let bestTable: ReportTable = tables[0];
  let bestScore = -1;

  for (const table of tables) {
    let score = 0;
    const tName = normalizeText(table.table_name);
    const tEntity = normalizeText(table.name);
    const tStem = getWordStem(tName);
    const tEntityStem = getWordStem(tEntity);

    // Context bonus if user actively selected this table
    if (activeTableName && (tName === activeTableName.toLowerCase() || tEntity === activeTableName.toLowerCase())) {
      score += 15;
    }

    // Direct table name or stem match in prompt tokens
    for (const tok of promptTokens) {
      const tokStem = getWordStem(tok);
      if (tok === tName || tok === tEntity || tokStem === tStem || tokStem === tEntityStem) {
        score += 25;
      }
    }

    // Domain cluster match
    for (const cluster of domainClusters) {
      const tableInCluster = cluster.some(
        (word) => word === tName || word === tEntity || getWordStem(word) === tStem || getWordStem(word) === tEntityStem,
      );
      if (tableInCluster) {
        const promptInCluster = promptTokens.some(
          (tok) => cluster.includes(tok) || cluster.some((w) => getWordStem(w) === getWordStem(tok)),
        );
        if (promptInCluster) {
          score += 15;
        }
      }
    }

    // Column name match in prompt
    for (const attr of table.attributes) {
      const attrNorm = normalizeText(attr.name);
      const synonyms = columnSynonyms[attr.name] || [attrNorm];
      const hasColMatch = synonyms.some((syn) => pNorm.includes(syn));
      if (hasColMatch) {
        score += 4;
      }
    }

    // Seed data value match in prompt
    if (table.seed_data && table.seed_data.length > 0) {
      for (const tok of promptTokens) {
        if (tok.length < 3) continue;
        const tokStem = getWordStem(tok);
        const matchesVal = table.seed_data.some((row) =>
          Object.values(row).some((val) => {
            if (typeof val === 'string') {
              const valNorm = normalizeText(val);
              return valNorm === tok || valNorm.includes(tok) || getWordStem(valNorm) === tokStem;
            }
            return false;
          }),
        );
        if (matchesVal) {
          score += 10;
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestTable = table;
    }
  }

  const targetTable = bestTable || tables[0];
  const tableName = targetTable.table_name;
  const colNames = targetTable.attributes.map((a) => a.name);

  // 2. COLUMN PROJECTION (Selective SELECT instead of always SELECT *)
  const selectedColumns: string[] = [];

  const matchedTokensForColumns = new Set<string>();

  const hasExplicitProjection =
    /\b(solo|solamente|unicamente|mostrar\s+solo|ver\s+solo|listar\s+solo|traer\s+solo|columnas?|campos?)\b/i.test(prompt) ||
    /^(?:dame|muestra|muestrame|listar?|obtener)\s+(?:el\s+|la\s+|los\s+|las\s+)?(nombre|precio|marca|categoria|estado|stock|pais|email|correo)\b/i.test(prompt);

  // If user explicitly asks for columns with "solo X y Y"
  const soloPartMatch = prompt.match(/\b(?:solo|solamente|unicamente|columnas?|campos?)\s+([^,;]+)/i);
  const projectionSearchText = soloPartMatch ? normalizeText(soloPartMatch[1]) : (hasExplicitProjection ? pNorm : '');

  if (projectionSearchText) {
    for (const [colName, synonyms] of Object.entries(columnSynonyms)) {
      const matchedCol = colNames.find((c) => c.toLowerCase() === colName.toLowerCase());
      if (matchedCol) {
        for (const s of synonyms) {
          if (projectionSearchText.includes(s)) {
            if (!selectedColumns.includes(matchedCol)) {
              selectedColumns.push(matchedCol);
            }
            promptTokens.forEach((tok) => {
              if (s === tok || tok.startsWith(s) || s.startsWith(tok)) {
                matchedTokensForColumns.add(tok);
              }
            });
          }
        }
      }
    }
  }

  // 3. VALUE MATCHING & FILTER CONDITIONS
  const conditions: string[] = [];

  // Stop words to prevent conversational tokens from accidentally matching data values
  const stopWords = new Set([
    'muestrame', 'muestra', 'listar', 'lista', 'dame', 'obtener', 'ver', 'buscar',
    'los', 'las', 'el', 'la', 'de', 'del', 'al', 'en', 'para', 'con', 'por', 'sin',
    'solo', 'solamente', 'unicamente', 'y', 'o', 'un', 'una', 'unos', 'unas', 'que',
    'son', 'es', 'tabla', 'datos', 'registros', 'filas', 'informacion', 'reporte',
    'categoria', 'categorias', 'categorya', 'categoriaa', 'marca', 'marcas', 'estado', 'estados',
    'pais', 'paises', 'productos', 'producto', 'proveedores', 'proveedor', 'suplidores',
    'zapatos', 'zapato', 'calzado', 'calzados', 'tenis', 'articulos', 'articulo', 'items', 'item',
    'precio', 'costo', 'stock', 'rating', 'estrellas',
  ]);

  const promptKeywords = promptTokens.filter(
    (tok) => !stopWords.has(tok) && !matchedTokensForColumns.has(tok) && tok.length > 2,
  );

  // Dynamic search across text columns in target table seed_data
  const textCols = colNames.filter((c) => {
    return targetTable.seed_data.some((r) => typeof r[c] === 'string');
  });

  // Detect explicit column association in prompt: e.g. "categoria deportiva" -> "deportiva" must be on category
  const explicitColumnForKeyword = new Map<string, string>();
  for (const [colName, synonyms] of Object.entries(columnSynonyms)) {
    const matchedCol = colNames.find((c) => c.toLowerCase() === colName.toLowerCase());
    if (!matchedCol) continue;

    for (const syn of synonyms) {
      const regex = new RegExp(`\\b${syn}\\s+(?:de\\s+|del\\s+|con\\s+|es\\s+|:\\s*)?([a-zA-Záéíóúñ]+)\\b`, 'i');
      const match = pNorm.match(regex);
      if (match && match[1]) {
        const kw = normalizeText(match[1]);
        if (!stopWords.has(kw)) {
          explicitColumnForKeyword.set(kw, matchedCol);
        }
      }
    }
  }

  // Also check direct column names from any generic table/schema
  for (const col of colNames) {
    const colNorm = normalizeText(col);
    if (colNorm.length < 3) continue;
    const regex = new RegExp(`\\b${colNorm}\\s+(?:de\\s+|del\\s+|con\\s+|es\\s+|:\\s*)?([a-zA-Záéíóúñ]+)\\b`, 'i');
    const match = pNorm.match(regex);
    if (match && match[1]) {
      const kw = normalizeText(match[1]);
      if (!stopWords.has(kw)) {
        explicitColumnForKeyword.set(kw, col);
      }
    }
  }

  for (const kw of promptKeywords) {
    const kwStem = getWordStem(kw);
    const targetColExplicit = explicitColumnForKeyword.get(kw);
    const colsToSearch = targetColExplicit ? [targetColExplicit] : textCols;

    const colConditionsForThisKw: string[] = [];

    for (const col of colsToSearch) {
      // Don't accidentally match on SKU or technical IDs if the user gave a general word
      if (!targetColExplicit && (col.toLowerCase() === 'sku' || col.toLowerCase().endsWith('id'))) {
        continue;
      }

      const distinctVals = Array.from(new Set(targetTable.seed_data.map((r) => r[col]).filter(Boolean)));

      let matchedColVal = false;
      let chosenPattern = kwStem;

      for (const val of distinctVals) {
        const valStr = String(val);
        const valNorm = normalizeText(valStr);
        const valWords = valNorm.split(/[\s,./-]+/).filter(Boolean);

        const matchesWord = valWords.some((vw) => {
          if (vw.length < 3 || kw.length < 3) return false;
          if (vw === kw) return true;
          const vwStem = getWordStem(vw);
          if (kwStem.length >= 3 && vwStem.length >= 3) {
            if (kwStem === vwStem) return true;
            if (Math.abs(kwStem.length - vwStem.length) <= 2) {
              return vwStem.startsWith(kwStem) || kwStem.startsWith(vwStem);
            }
          }
          return false;
        });

        if (matchesWord) {
          const origWords = valStr.toLowerCase().split(/[\s,./-]+/).filter(Boolean);
          const matchedOrig = origWords.find((ow) => {
            const owNorm = normalizeText(ow);
            return owNorm === kw || owNorm.startsWith(kwStem) || kwStem.startsWith(owNorm.slice(0, 4));
          }) || valStr.toLowerCase();

          if (matchedOrig && matchedOrig.length >= 3) {
            chosenPattern = matchedOrig.length > 5 ? matchedOrig.slice(0, -2) : matchedOrig.slice(0, -1);
          }
          matchedColVal = true;
          break;
        }
      }

      if (matchedColVal) {
        colConditionsForThisKw.push(`LOWER(${col}) LIKE '%${chosenPattern}%'`);
      }
    }

    if (colConditionsForThisKw.length === 1) {
      if (!conditions.includes(colConditionsForThisKw[0])) {
        conditions.push(colConditionsForThisKw[0]);
      }
    } else if (colConditionsForThisKw.length > 1) {
      const orGroup = `(${colConditionsForThisKw.join(' OR ')})`;
      if (!conditions.includes(orGroup)) {
        conditions.push(orGroup);
      }
    }
  }

  // Numeric and Comparison Filters
  const ratingCol = colNames.find((c) => /rating|calificacion/i.test(c));
  const rateMatch = pNorm.match(/(?:rating|calificacion|estrellas?)\s*(?:>|>=|mayor a|mayor que|mas de|>=)?\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (rateMatch && ratingCol) {
    conditions.push(`${ratingCol} >= ${rateMatch[1]}`);
  }

  const priceCol = colNames.find((c) => /price|precio/i.test(c));
  const priceGtMatch = pNorm.match(/(?:precio|price|costo)\s*(?:>|>=|mayor a|mayor que|mas de|superior a)\s*(\d+)/i);
  if (priceGtMatch && priceCol) {
    conditions.push(`${priceCol} >= ${priceGtMatch[1]}`);
  }
  const priceLtMatch = pNorm.match(/(?:precio|price|costo)\s*(?:<|<=|menor a|menor que|menos de|inferior a)\s*(\d+)/i);
  if (priceLtMatch && priceCol) {
    conditions.push(`${priceCol} <= ${priceLtMatch[1]}`);
  }

  const activeOrdersCol = colNames.find((c) => /activeorders|ordenesactivas/i.test(c));
  if (activeOrdersCol && (pNorm.includes('ordenes activas') || pNorm.includes('pedidos activos') || pNorm.includes('con ordenes') || pNorm.includes('con pedidos'))) {
    conditions.push(`${activeOrdersCol} > 0`);
  }

  const isFeaturedCol = colNames.find((c) => /isfeatured|destacado/i.test(c));
  if (isFeaturedCol && (pNorm.includes('destacado') || pNorm.includes('destacados') || pNorm.includes('featured'))) {
    conditions.push(`${isFeaturedCol} = true`);
  }

  // 4. GROUP BY / AGGREGATION
  const catCol = colNames.find((c) => /category|categoria|rubro/i.test(c));
  const countryCol = colNames.find((c) => /country|pais/i.test(c));
  const statusCol = colNames.find((c) => /status|estado/i.test(c));

  if (pNorm.includes('por pais') || (pNorm.includes('agrup') && pNorm.includes('pais'))) {
    const cCol = countryCol || 'country';
    const sCol = colNames.find((c) => /totalspent|gasto|monto/i.test(c));
    const sumExpr = sCol ? `, SUM(${sCol}) AS gasto_total` : '';
    return `SELECT ${cCol}, COUNT(*) AS total_proveedores${sumExpr} FROM ${tableName} GROUP BY ${cCol} ORDER BY total_proveedores DESC`;
  }

  if (pNorm.includes('por categoria') || (pNorm.includes('agrup') && pNorm.includes('cat'))) {
    const cCol = catCol || 'category';
    const avgPriceCol = priceCol ? `, ROUND(AVG(${priceCol}), 2) AS precio_promedio` : '';
    const rCol = ratingCol ? `, ROUND(AVG(${ratingCol}), 2) AS rating_promedio` : '';
    return `SELECT ${cCol}, COUNT(*) AS total_${tableName}${avgPriceCol}${rCol} FROM ${tableName} GROUP BY ${cCol} ORDER BY total_${tableName} DESC`;
  }

  if (pNorm.includes('por estado') || (pNorm.includes('agrup') && pNorm.includes('estado'))) {
    const sCol = statusCol || 'status';
    return `SELECT ${sCol}, COUNT(*) AS total FROM ${tableName} GROUP BY ${sCol} ORDER BY total DESC`;
  }

  // 5. ORDER BY & LIMIT
  let orderBy = '';
  if (pNorm.includes('mejor calificado') || pNorm.includes('mayor rating') || pNorm.includes('top rating')) {
    if (ratingCol) orderBy = ` ORDER BY ${ratingCol} DESC`;
  } else if (pNorm.includes('mas gasto') || pNorm.includes('mayor gasto')) {
    const spentCol = colNames.find((c) => /totalspent|gasto/i.test(c));
    if (spentCol) orderBy = ` ORDER BY ${spentCol} DESC`;
  } else if (pNorm.includes('mas caro') || pNorm.includes('mayor precio') || pNorm.includes('mas costoso')) {
    if (priceCol) orderBy = ` ORDER BY ${priceCol} DESC`;
  } else if (pNorm.includes('mas barato') || pNorm.includes('menor precio') || pNorm.includes('economico')) {
    if (priceCol) orderBy = ` ORDER BY ${priceCol} ASC`;
  } else if (pNorm.includes('menor tiempo') || pNorm.includes('mas rapido')) {
    const leadCol = colNames.find((c) => /leadtime|tiempo/i.test(c));
    if (leadCol) orderBy = ` ORDER BY ${leadCol} ASC`;
  }

  let limit = '';
  const limitMatch = pNorm.match(/(?:top|primeros|limite|mostrar)\s*(\d+)/i);
  if (limitMatch) {
    limit = ` LIMIT ${limitMatch[1]}`;
  }

  // Projection string
  const projection = selectedColumns.length > 0 ? selectedColumns.join(', ') : '*';
  const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  return `SELECT ${projection} FROM ${tableName}${whereClause}${orderBy}${limit}`;
}

// -------------------------------------------------------------
// ALASQL EXECUTION ENGINE & KPI CALCULATOR
// -------------------------------------------------------------

export function executeAlaSQL(sql: string, tables: ReportTable[]): ReportExecutionResult {
  const startTime = performance.now();

  try {
    // Register tables inside alaSQL memory database
    alasql.tables = alasql.tables || {};
    tables.forEach((t) => {
      // Clone rows so mutation doesn't affect source
      alasql.tables[t.table_name] = { data: JSON.parse(JSON.stringify(t.seed_data)) };
    });

    // Execute query
    const rawResult = alasql(sql);
    const executionTimeMs = Number((performance.now() - startTime).toFixed(2));

    const rows: Record<string, any>[] = Array.isArray(rawResult) ? rawResult : [];
    const columns: string[] = rows.length > 0 ? Object.keys(rows[0]) : [];

    // Calculate Executive KPIs
    const kpis: KPIItem[] = [];

    // 1. Total Records KPI
    kpis.push({
      label: 'Registros Encontrados',
      value: rows.length,
      subtext: `Filtrados en ${executionTimeMs} ms`,
      icon: 'i-ph:database',
      color: 'emerald',
    });

    // 2. Look for numeric columns for financial/stock KPIs
    const numericCols = columns.filter((col) => {
      return rows.some((r) => typeof r[col] === 'number');
    });

    const priceCol = numericCols.find((c) => /price|precio|total|subtotal|amount|monto/i.test(c));
    const stockCol = numericCols.find((c) => /stock|cantidad|quantity/i.test(c));
    const ratingCol = numericCols.find((c) => /rating|score|calificacion/i.test(c));

    if (priceCol && rows.length > 0) {
      const sum = rows.reduce((acc, r) => acc + (Number(r[priceCol]) || 0), 0);
      const avg = sum / rows.length;
      const max = Math.max(...rows.map((r) => Number(r[priceCol]) || 0));

      kpis.push({
        label: `Total ${priceCol.toUpperCase()}`,
        value: `$ ${sum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        subtext: 'Suma acumulada del conjunto',
        icon: 'i-ph:currency-dollar',
        color: 'blue',
      });

      kpis.push({
        label: `Promedio ${priceCol.toUpperCase()}`,
        value: `$ ${avg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        subtext: `Valor máximo: $ ${max.toFixed(2)}`,
        icon: 'i-ph:chart-line-up',
        color: 'teal',
      });
    } else if (stockCol && rows.length > 0) {
      const sumStock = rows.reduce((acc, r) => acc + (Number(r[stockCol]) || 0), 0);
      const avgStock = (sumStock / rows.length).toFixed(1);

      kpis.push({
        label: `Total Unidades (${stockCol})`,
        value: sumStock.toLocaleString(),
        subtext: `Promedio: ${avgStock} un./ítem`,
        icon: 'i-ph:package',
        color: 'purple',
      });
    }

    if (ratingCol && rows.length > 0) {
      const avgRate = (rows.reduce((acc, r) => acc + (Number(r[ratingCol]) || 0), 0) / rows.length).toFixed(2);
      kpis.push({
        label: `Calificación Promedio`,
        value: `⭐ ${avgRate}`,
        subtext: `Base 5 estrellas`,
        icon: 'i-ph:star',
        color: 'amber',
      });
    }

    // 3. Build Chart Data
    let chartConfig: ChartConfig | undefined;
    if (rows.length > 0) {
      const textCol = columns.find((c) => typeof rows[0][c] === 'string' && !c.toLowerCase().includes('id'));
      const valCol = numericCols.find((c) => !c.toLowerCase().includes('id')) || numericCols[0];

      if (textCol && valCol) {
        const labels = rows.slice(0, 15).map((r) => String(r[textCol] || ''));
        const values = rows.slice(0, 15).map((r) => Number(r[valCol]) || 0);

        chartConfig = {
          type: rows.length <= 6 ? 'pie' : 'bar',
          labelColumn: textCol,
          valueColumn: valCol,
          labels,
          values,
        };
      }
    }

    return {
      sql,
      rows,
      columns,
      executionTimeMs,
      kpis,
      chartConfig,
    };
  } catch (err: any) {
    const executionTimeMs = Number((performance.now() - startTime).toFixed(2));
    return {
      sql,
      rows: [],
      columns: [],
      executionTimeMs,
      kpis: [],
      error: err?.message || 'Error al ejecutar consulta SQL en memoria',
    };
  }
}

// -------------------------------------------------------------
// MULTI-TURN AGENTIC SQL EXPLORATION LOOP (CONSULTAR vs QUERY)
// -------------------------------------------------------------

export async function resolveReportQueryWithExploration(
  prompt: string,
  tables: ReportTable[],
  onStatusUpdate?: (status: string) => void,
  activeTableName?: string,
): Promise<{ sql: string; logs: string[] }> {
  const schemaStr = buildCompactSchema(tables);
  const logs: string[] = [];
  const observations: string[] = [];

  let loopCount = 0;
  const MAX_LOOPS = 3;

  while (loopCount < MAX_LOOPS) {
    try {
      let currentPrompt = `Consulta solicitada: "${prompt}"\n\nEsquema de tablas:\n${schemaStr}`;
      if (activeTableName) {
        currentPrompt += `\n\nTabla de contexto activo seleccionada: "${activeTableName}" (si la solicitud del usuario corresponde a esta entidad, enfócate en ella).`;
      }
      if (observations.length > 0) {
        currentPrompt += `\n\nValores reales obtenidos de la base de datos:\n${observations.join('\n')}\n\nCon esta información exacta, genera la consulta SQL definitiva respondiendo con: QUERY: <sql_final>.`;
      }

      const response = await fetch('/api/report-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: currentPrompt,
          schema: schemaStr,
        }),
      });

      if (!response.ok) {
        logs.push(`Servidor respondió con status ${response.status} en turno ${loopCount + 1}`);
        break;
      }

      const data = (await response.json()) as any;
      const rawResponse: string = (data.response || data.sql || '').trim();

      // Check if LLM requested to CONSULTAR
      if (rawResponse.toUpperCase().startsWith('CONSULTAR:') || rawResponse.toUpperCase().startsWith('CONSULTA:')) {
        loopCount++;
        const exploreSql = rawResponse.replace(/^CONSULTAR:?\s*/i, '').replace(/^CONSULTA:?\s*/i, '').trim();

        const statusMsg = `Explorando valores en base de datos: ${exploreSql}`;
        logs.push(statusMsg);
        onStatusUpdate?.(statusMsg);

        // Execute exploratory query in local AlaSQL memory
        let observation = '';
        try {
          const exploreRes = executeAlaSQL(exploreSql, tables);
          if (exploreRes.rows && exploreRes.rows.length > 0) {
            observation = JSON.stringify(exploreRes.rows.slice(0, 15));
          } else {
            observation = 'La consulta no devolvió registros.';
          }
        } catch (err: any) {
          observation = `Error ejecutando consulta exploratoria: ${err.message}`;
        }

        observations.push(`Consulta exploratoria: ${exploreSql} -> Resultado: ${observation}`);
        logs.push(`Valores encontrados: ${observation}`);
        continue;
      }

      // If it's a QUERY response
      let finalSql = rawResponse.replace(/^(?:QUERY:\s*|SQL:\s*)/i, '').trim();
      const selectIdx = finalSql.search(/select\b/i);
      if (selectIdx !== -1) {
        finalSql = finalSql.slice(selectIdx);
      }

      if (finalSql) {
        logs.push(`Consulta SQL generada con éxito: ${finalSql}`);
        return { sql: finalSql, logs };
      }
    } catch (e: any) {
      logs.push(`Excepción en llamada LLM: ${e.message}`);
      break;
    }
  }

  // Fallback to local semantic generator
  const fallbackSql = generateLocalSemanticSQL(prompt, tables, activeTableName);
  logs.push(`Uso de generador semántico local de respaldo: ${fallbackSql}`);
  return { sql: fallbackSql, logs };
}

// -------------------------------------------------------------
// CODE INJECTION: GENERATE REACT COMPONENT CODE & SAVE
// -------------------------------------------------------------

export function generateReportReactComponent(
  title: string,
  sqlQuery: string,
  result: ReportExecutionResult,
): string {
  const componentName = 'GeneratedReport';
  const cleanTitle = title.replace(/"/g, "'") || 'Reporte Dinámico Generativo';
  const columns = result.columns;
  const sampleData = JSON.stringify(result.rows.slice(0, 50), null, 2);
  const kpis = JSON.stringify(result.kpis, null, 2);
  const chartLabels = JSON.stringify(result.chartConfig?.labels || [], null, 2);
  const chartValues = JSON.stringify(result.chartConfig?.values || [], null, 2);
  const valCol = result.chartConfig?.valueColumn || 'valor';
  const labelCol = result.chartConfig?.labelColumn || 'nombre';

  return `import React, { useState, useMemo } from 'react';

/**
 * Componente de Reporte Generativo Autónomo
 * Generado por GenUI Studio - Reportes IA
 * Consulta SQL: "${sqlQuery.replace(/"/g, '\\"')}"
 */
export function ${componentName}() {
  const [search, setSearch] = useState('');
  const [data] = useState(${sampleData});
  const kpis = ${kpis};
  const chartLabels = ${chartLabels};
  const chartValues = ${chartValues};

  // Filtrado reactivo en vivo
  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const s = search.toLowerCase();
    return data.filter((item) =>
      Object.values(item).some((val) =>
        String(val).toLowerCase().includes(s)
      )
    );
  }, [data, search]);

  const maxChartVal = Math.max(...chartValues, 1);

  // Exportar a CSV
  const handleExportCSV = () => {
    if (!filteredData.length) return;
    const headers = Object.keys(filteredData[0]).join(',');
    const rows = filteredData.map((r) =>
      Object.values(r)
        .map((v) => \`"\${String(v).replace(/"/g, '""')}"\`)
        .join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'reporte_generado.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 space-y-6 text-zinc-100 font-sans">
      {/* Encabezado del Reporte */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-1.5">
            <span>⚡ Reporte IA Generado</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">${cleanTitle}</h1>
          <p className="text-xs text-zinc-400 font-mono mt-0.5">
            SQL: <span className="text-emerald-300">${sqlQuery.replace(/"/g, "'")}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition flex items-center gap-1.5 shadow-sm"
          >
            📥 Exportar CSV
          </button>
        </div>
      </div>

      {/* Tarjetas KPI Ejecutivas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi, idx) => (
          <div
            key={idx}
            className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80 shadow-md backdrop-blur flex flex-col justify-between"
          >
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{kpi.label}</span>
            <div className="text-2xl font-black text-white mt-1 mb-0.5">{kpi.value}</div>
            {kpi.subtext && <span className="text-[11px] text-zinc-500 font-medium">{kpi.subtext}</span>}
          </div>
        ))}
      </div>

      {/* Gráfico Visual Reactivo (SVG Bar Chart) */}
      {chartLabels.length > 0 && (
        <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">
              Distribución por ${labelCol} (${valCol})
            </h3>
            <span className="text-xs text-zinc-400">Total ítems graficados: {chartLabels.length}</span>
          </div>
          <div className="space-y-2.5">
            {chartLabels.map((lbl, i) => {
              const val = chartValues[i] || 0;
              const pct = Math.round((val / maxChartVal) * 100);
              return (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <span className="w-36 truncate font-medium text-zinc-300 text-right">{lbl}</span>
                  <div className="flex-1 bg-zinc-800 rounded-full h-4 overflow-hidden relative">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                      style={{ width: \`\${pct}%\` }}
                    />
                  </div>
                  <span className="w-16 font-mono font-semibold text-emerald-400 text-right">{val}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabla Interactiva de Resultados */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 overflow-hidden shadow-lg">
        <div className="p-3.5 border-b border-zinc-800 flex items-center justify-between gap-3 bg-zinc-900/50">
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              placeholder="Buscar en el reporte..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-3 pr-3 py-1.5 text-xs rounded-lg bg-zinc-800/80 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <span className="text-xs text-zinc-400 font-medium">
            Mostrando {filteredData.length} de {data.length} filas
          </span>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-zinc-800 text-zinc-300 font-semibold border-b border-zinc-700 select-none">
              <tr>
                ${columns
                  .map(
                    (col) =>
                      `<th className="px-4 py-3 text-left uppercase tracking-wider font-semibold text-[11px]">${col}</th>`,
                  )
                  .join('\n                ')}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-sans">
              {filteredData.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-zinc-800/40 transition">
                  ${columns
                    .map(
                      (col) =>
                        `<td className="px-4 py-2.5 text-zinc-200 whitespace-nowrap">{String(row['${col}'] ?? '-')}</td>`,
                    )
                    .join('\n                  ')}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ${componentName};
`;
}

export async function injectReportIntoProject(
  reportTitle: string,
  sql: string,
  result: ReportExecutionResult,
): Promise<{ success: boolean; filePath: string; message: string }> {
  try {
    const reportCode = generateReportReactComponent(reportTitle, sql, result);
    const targetPath = '/src/components/GeneratedReport.jsx';

    // 1. Create or overwrite the GeneratedReport.jsx file in workbenchStore
    await workbenchStore.createFile(targetPath, reportCode);

    // 2. Try to integrate with App.jsx if it exists
    const files = workbenchStore.files.get();
    const appEntry = Object.keys(files).find((k) => /src\/App\.(jsx|tsx|js)$/.test(k));

    let integrated = false;
    if (appEntry && files[appEntry]?.type === 'file') {
      const appContent = (files[appEntry] as any).content || '';
      if (!appContent.includes('GeneratedReport')) {
        // Add import at the top
        const importStatement = `import { GeneratedReport } from './components/GeneratedReport';\n`;
        let updatedApp = importStatement + appContent;

        // Try to add a tab or button if there's a navigation or views container
        if (updatedApp.includes('activeTab') || updatedApp.includes('currentTab') || updatedApp.includes('view')) {
          // Just saving the updated import is safe and non-destructive
          await workbenchStore.createFile(appEntry, updatedApp);
          integrated = true;
        }
      }
    }

    return {
      success: true,
      filePath: targetPath,
      message: integrated
        ? `Reporte inyectado en ${targetPath} y vinculado con App.jsx`
        : `Componente creado exitosamente en ${targetPath}. ¡Puedes importarlo en cualquier vista!`,
    };
  } catch (err: any) {
    return {
      success: false,
      filePath: '',
      message: err?.message || 'Error al inyectar el reporte en el proyecto',
    };
  }
}
