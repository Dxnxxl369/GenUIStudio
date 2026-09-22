import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { generateText } from 'ai';
import { getApiKeysFromCookie, getProviderSettingsFromCookie } from '~/lib/api/cookies';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, PROVIDER_LIST } from '~/utils/constants';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.report-query');

export async function action({ context, request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { prompt, schema, model, provider: providerObj } = await request.json<{
      prompt?: string;
      schema: string;
      model?: string;
      provider?: any;
    }>();

    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const cookieHeader = request.headers.get('Cookie');
    const apiKeys = getApiKeysFromCookie(cookieHeader);
    const providerSettings = getProviderSettingsFromCookie(cookieHeader);

    // Fallback to process.env if cookies are empty
    if (!apiKeys.Google && process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      apiKeys.Google = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    }
    if (!apiKeys.Groq && process.env.GROQ_API_KEY) {
      apiKeys.Groq = process.env.GROQ_API_KEY;
    }

    let providerName = providerObj?.name || (typeof providerObj === 'string' ? providerObj : '');
    if (!providerName) {
      if (apiKeys.Groq) providerName = 'Groq';
      else if (apiKeys.Google) providerName = 'Google';
      else providerName = DEFAULT_PROVIDER.name;
    }

    const selectedProvider =
      PROVIDER_LIST.find((p) => p.name.toLowerCase() === providerName.toLowerCase()) || DEFAULT_PROVIDER;

    let selectedModel = model;
    if (!selectedModel) {
      if (selectedProvider.name.toLowerCase() === 'groq') {
        selectedModel = 'openai/gpt-oss-120b';
      } else {
        selectedModel = selectedProvider.staticModels?.[0]?.name || DEFAULT_MODEL;
      }
    }

    const systemPrompt = `Eres un Analista de Datos Senior y Especialista en SQL para SQLite y AlaSQL en memoria.
Tu ÚNICA tarea es generar la consulta SQL SELECT óptima para responder a la solicitud del usuario, basándote en el esquema de tablas provisto.

Esquema de la Base de Datos:
${schema || 'Sin esquema explícito'}

PROTOCOLO DE RESPUESTA ESTRICTO:

1. AUTO-EXPLORACIÓN (CONSULTAR):
   Si la solicitud del usuario menciona una categoría, estado, valor textual o término ambiguo (por ejemplo: "categoría deportiva", "estado activo", "marca nike", "aprobados", "urgente") y NO conoces los valores exactos almacenados en esa columna:
   RESPONDE ÚNICAMENTE CON:
   CONSULTAR: SELECT DISTINCT <columna> FROM <tabla> LIMIT 15;

   (El software ejecutará tu consulta de inmediato sobre la base de datos y te devolverá los valores reales para que puedas armar la consulta final con exactitud).

2. CONSULTA FINAL (QUERY):
   Si ya conoces los valores exactos, o ya recibiste los resultados de tu CONSULTAR previo, o la consulta no requiere explorar datos:
   RESPONDE ÚNICAMENTE CON:
   QUERY: SELECT <columnas> FROM <tabla> WHERE ...;

3. REGLAS DE ORO:
   - INTEGRIDAD DE FILTRO: Si el usuario dice "solo nombre y categoría", proyecta únicamente esos campos en el SELECT, pero NUNCA olvides incluir la condición de filtrado en el WHERE.
   - Si el usuario no pide columnas específicas, proyecta todas las columnas necesarias con '*' o las principales.
   - NUNCA uses bloques de código markdown (sin \`\`\`sql ... \`\`\`).
   - NUNCA incluyas explicaciones, saludos ni texto adicional.
   - Tu respuesta DEBE comenzar obligatoriamente con el prefijo "CONSULTAR:" o "QUERY:".`;

    const modelInstance = selectedProvider.getModelInstance({
      model: selectedModel,
      serverEnv: (context as any).cloudflare?.env,
      apiKeys,
      providerSettings,
    });

    const result = await generateText({
      model: modelInstance,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    const fullReply = (result.text || '').trim();

    let cleanReply = fullReply
      .replace(/```(?:sql)?/gi, '')
      .replace(/```/g, '')
      .trim();

    const isConsultar = /^CONSULTAR:?/i.test(cleanReply) || /^CONSULTA:?/i.test(cleanReply);
    const isQuery = /^QUERY:?/i.test(cleanReply);

    let cleanSql = cleanReply;
    if (isConsultar) {
      cleanSql = cleanReply.replace(/^CONSULTAR:?\s*/i, '').replace(/^CONSULTA:?\s*/i, '').trim();
    } else if (isQuery) {
      cleanSql = cleanReply.replace(/^QUERY:?\s*/i, '').trim();
    } else {
      const selectIdx = cleanSql.search(/select\b/i);
      if (selectIdx !== -1) {
        cleanSql = cleanSql.slice(selectIdx);
      }
    }

    return new Response(
      JSON.stringify({
        response: cleanReply,
        action: isConsultar ? 'consultar' : 'query',
        sql: cleanSql,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error: any) {
    logger.error('Report query generation error:', error);
    return new Response(
      JSON.stringify({
        error: error?.message || 'Error generating SQL query from LLM',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
