import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { currentUser, currentPlan, saasActions } from '~/lib/stores/saasStore';
import { PlanUpgradeModal } from '~/components/saas/PlanUpgradeModal';
import {
  extractProjectTables,
  buildCompactSchema,
  generateLocalSemanticSQL,
  executeAlaSQL,
  resolveReportQueryWithExploration,
  type ReportTable,
  type ReportExecutionResult,
} from './reportEngine';

export function ReportsView() {
  const files = useStore(workbenchStore.files);
  const user = useStore(currentUser);
  const plan = useStore(currentPlan);
  const activeDbTable = useStore(workbenchStore.selectedDatabaseTable);

  const [prompt, setPrompt] = useState('');
  const [selectedTableFilter, setSelectedTableFilter] = useState<string>('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeTab, setActiveTab] = useState<'chart' | 'table' | 'sql'>('table');
  const [chartType, setChartType] = useState<'bar' | 'pie' | 'line'>('bar');
  const [tableSearch, setTableSearch] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [customSql, setCustomSql] = useState('');
  const [isEditingSql, setIsEditingSql] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isCompactHeader, setIsCompactHeader] = useState(false);
  const [showKpis, setShowKpis] = useState(true);

  // Extract tables from files and localStorage
  const tables: ReportTable[] = useMemo(() => {
    return extractProjectTables(files);
  }, [files, refreshTrigger]);

  // Listen for storage and live data updates across browser and preview
  useEffect(() => {
    const handleStorageUpdate = () => {
      setRefreshTrigger((prev) => prev + 1);
    };

    window.addEventListener('storage', handleStorageUpdate);
    document.addEventListener('bolt-data-updated', handleStorageUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageUpdate);
      document.removeEventListener('bolt-data-updated', handleStorageUpdate);
    };
  }, []);

  // Initial execution state
  const [result, setResult] = useState<ReportExecutionResult | null>(null);

  // Speech recognition ref
  const recognitionRef = useRef<any>(null);

  // Sync selected table filter with active table from DatabaseView
  useEffect(() => {
    if (activeDbTable && tables.some((t) => t.table_name === activeDbTable)) {
      setSelectedTableFilter(activeDbTable);
    }
  }, [activeDbTable, tables]);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechClass = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const rec = new SpeechClass();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'es-ES';

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setPrompt(transcript);
          toast.info(`🎤 Voz detectada: "${transcript}"`);
          handleRunQuery(transcript);
        }
        setIsListening(false);
      };

      rec.onerror = () => {
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, [tables]);

  // Toggle voice recognition
  const toggleSpeech = () => {
    if (!recognitionRef.current) {
      toast.warn('El reconocimiento de voz no está soportado en este navegador');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        toast.info('🎙️ Escuchando... Di tu consulta de reporte');
      } catch (err) {
        console.error(err);
        setIsListening(false);
      }
    }
  };

  // Run Query Pipeline
  const handleRunQuery = async (queryText?: string) => {
    const textToRun = (queryText || prompt).trim();
    if (!textToRun) return;

    // SaaS Credit Check
    const success = saasActions.deductCredits(
      200,
      'report_query',
      `Consulta de Reporte IA: "${textToRun.slice(0, 30)}..."`,
    );

    if (!success) {
      toast.error('❌ Has alcanzado el límite de créditos de tu plan. Mejora tu suscripción para continuar.');
      setIsUpgradeModalOpen(true);
      return;
    }

    setIsGenerating(true);
    setIsEditingSql(false);

    try {
      // Always re-extract fresh tables at the moment of query execution
      const currentFreshTables = extractProjectTables(files);
      const effectiveTable = selectedTableFilter !== 'all' ? selectedTableFilter : activeDbTable;
      const { sql } = await resolveReportQueryWithExploration(
        textToRun,
        currentFreshTables,
        (statusMsg) => {
          toast.info(statusMsg);
        },
        effectiveTable,
      );

      setCustomSql(sql);

      // Execute SQL in memory using alaSQL with fresh live data
      const queryResult = executeAlaSQL(sql, currentFreshTables);
      setResult(queryResult);

      if (queryResult.chartConfig) {
        setActiveTab('chart');
      } else {
        setActiveTab('table');
      }
    } catch (err: any) {
      toast.error(`Error generando reporte: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Run manually edited SQL
  const handleRunCustomSql = () => {
    if (!customSql.trim()) return;
    const currentFreshTables = extractProjectTables(files);
    const queryResult = executeAlaSQL(customSql, currentFreshTables);
    setResult(queryResult);
    if (queryResult.error) {
      toast.error(`Error SQL: ${queryResult.error}`);
    } else {
      toast.success(`Ejecutado con éxito (${queryResult.rows.length} filas)`);
    }
  };

  // Initial load execution on mount
  useEffect(() => {
    if (!result && tables.length > 0) {
      const effectiveTable = selectedTableFilter !== 'all' ? selectedTableFilter : activeDbTable;
      const targetTbl = tables.find((t) => t.table_name === effectiveTable) || tables[0];
      handleRunQuery(`Mostrar registros de ${targetTbl.name}`);
    }
  }, [tables]);

  // Suggested Prompts dynamically tailored to the active domain table
  const suggestionPills = useMemo(() => {
    const effectiveTable = selectedTableFilter !== 'all' ? selectedTableFilter : activeDbTable;
    const currentTbl = tables.find((t) => t.table_name === effectiveTable) || tables[0];
    if (!currentTbl) return [];

    const colNames = currentTbl.attributes.map((a) => a.name.toLowerCase());
    const pills: string[] = [`📋 Mostrar todos los ${currentTbl.name}`];

    if (colNames.some((c) => /rating|calificacion|score/i.test(c))) {
      pills.push(`⭐ Top mejor calificados en ${currentTbl.name}`);
    }
    if (colNames.some((c) => /status|estado|active|activo/i.test(c))) {
      pills.push(`⚡ Filtrar por estado activo`);
    }
    if (colNames.some((c) => /category|categoria|rubro|tipo/i.test(c))) {
      pills.push(`📊 Agrupado por categoría`);
    }
    if (colNames.some((c) => /price|precio|total|spent|gasto|monto/i.test(c))) {
      pills.push(`💰 Ordenar por mayor monto`);
    }
    if (colNames.some((c) => /stock|cantidad|totalstock/i.test(c))) {
      pills.push(`📦 Ítems con mayor stock`);
    }

    return pills;
  }, [tables, selectedTableFilter, activeDbTable]);

  // Sorting & Filtering for Table
  const filteredRows = useMemo(() => {
    if (!result || !result.rows) return [];
    let rows = [...result.rows];

    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase();
      rows = rows.filter((r) =>
        Object.values(r).some((val) => String(val).toLowerCase().includes(q))
      );
    }

    if (sortCol) {
      rows.sort((a, b) => {
        const valA = a[sortCol];
        const valB = b[sortCol];
        if (valA === valB) return 0;
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortAsc ? valA - valB : valB - valA;
        }
        return sortAsc
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }

    return rows;
  }, [result, tableSearch, sortCol, sortAsc]);

  // Handle column header click for sorting
  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  // Export CSV optimizado para Microsoft Excel y suites ofimáticas (UTF-8 BOM y delimitador para español)
  const handleExportCSV = () => {
    if (!result || result.rows.length === 0) {
      toast.warn('No hay datos para exportar');
      return;
    }

    // En Windows y Excel en español/latinoamérica/Europa, el separador de columnas estándar es ';'
    // ya que la coma ',' se reserva para decimales. Usar ';' asegura que Excel distribuya
    // cada dato en su columna correspondiente (A, B, C...) y no agrupe todo en la columna A.
    const separator = ';';

    const headers = result.columns
      .map((col) => `"${String(col).replace(/"/g, '""')}"`)
      .join(separator);

    const rows = result.rows.map((r) =>
      result.columns
        .map((col) => {
          const val = r[col];
          if (val === null || val === undefined) return '""';
          if (typeof val === 'number') return String(val);
          if (typeof val === 'boolean') return val ? '"SÍ"' : '"NO"';
          if (Array.isArray(val)) {
            const arrStr = val.map((item) => String(item ?? '').replace(/"/g, '""')).join(', ');
            return `"${arrStr}"`;
          }
          if (typeof val === 'object') {
            return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
          }
          // Limpiar saltos de línea para que cada registro ocupe exactamente 1 fila en la hoja de cálculo
          const cleanStr = String(val).replace(/[\r\n]+/g, ' ').replace(/"/g, '""');
          return `"${cleanStr}"`;
        })
        .join(separator)
    );

    // Anteponer el BOM UTF-8 (\ufeff) para que Excel detecte correctamente acentos, eñes y caracteres especiales
    const csvContent = '\ufeff' + [headers, ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Reporte exportado a CSV exitosamente');
  };

  // Export JSON
  const handleExportJSON = () => {
    if (!result || result.rows.length === 0) {
      toast.warn('No hay datos para exportar');
      return;
    }
    const blob = new Blob([JSON.stringify(result.rows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Reporte exportado a JSON exitosamente');
  };

  return (
    <div className="h-full flex flex-col bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary font-sans select-text overflow-hidden">
      {/* Top Header */}
      <div className="px-4 py-3 border-b border-bolt-elements-borderColor flex items-center justify-between gap-3 bg-bolt-elements-background-depth-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#ff7a1a] to-[#ea580c] flex items-center justify-center text-white shadow-md shadow-[#ff7a1a]/20 shrink-0">
            <span className="i-ph:sparkle-fill text-base" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight text-bolt-elements-textPrimary">Reportes IA Generativos</h2>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#ff7a1a]/10 text-[#ff7a1a] rounded-full border border-[#ff7a1a]/25">
                ANSI SQL + alaSQL
              </span>
            </div>
            <p className="text-[11px] text-bolt-elements-textSecondary">
              Consulta bases de datos, mockData y memoria con lenguaje natural o voz
            </p>
          </div>
        </div>

        {/* Action Buttons & SaaS Quota */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsUpgradeModalOpen(true)}
            className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-xs cursor-pointer hover:border-[#ff7a1a]/40 transition"
            title="Cuota de consumo IA del usuario activo - Haz clic para ver planes"
          >
            <span className="i-ph:lightning-fill text-amber-500 text-xs" />
            <span className="font-mono font-bold text-bolt-elements-textPrimary">
              {Math.max(user.creditsTotal - user.creditsUsed, 0).toLocaleString()}
            </span>
            <span className="text-[10px] text-bolt-elements-textTertiary hidden lg:inline">créditos</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-[#ff7a1a]/10 text-[#ff7a1a] border border-[#ff7a1a]/25">
              {plan.badge}
            </span>
          </button>

          <button
            onClick={() => {
              setRefreshTrigger((prev) => prev + 1);
              toast.success('Base de datos refrescada');
            }}
            className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary border border-bolt-elements-borderColor transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Refrescar datos en vivo de la base de datos"
          >
            <span className="i-ph:arrows-clockwise text-sm text-[#ff7a1a]" />
            <span>Refrescar</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary border border-bolt-elements-borderColor transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Descargar datos en formato CSV"
          >
            <span className="i-ph:file-csv text-sm text-[#ff7a1a]" />
            <span>CSV</span>
          </button>
          <button
            onClick={handleExportJSON}
            className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary border border-bolt-elements-borderColor transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Descargar datos en formato JSON"
          >
            <span className="i-ph:file-code text-sm text-[#ff7a1a]" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 min-h-0 flex flex-col p-3 md:p-4 gap-2.5 bg-bolt-elements-background-depth-2 overflow-hidden">
        {/* Natural Language Prompt & Speech Input Bar */}
        <div className="p-3 rounded-xl bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor shadow-xs space-y-2 shrink-0">
          <div className="flex items-center gap-2">
            {/* Target Table Dropdown Selector */}
            <div className="relative shrink-0">
              <select
                value={selectedTableFilter}
                onChange={(e) => setSelectedTableFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:border-[#ff7a1a] cursor-pointer shadow-xs transition"
                title="Selecciona la tabla objetivo para consultar"
              >
                <option value="all">🔍 Auto (Todas las tablas)</option>
                {tables.map((t) => (
                  <option key={t.table_name} value={t.table_name}>
                    🗄️ {t.name} ({t.table_name})
                  </option>
                ))}
              </select>
            </div>

            <div className="relative flex-1">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRunQuery();
                }}
                placeholder="Ej: productos de categoría tela, solo nombre y categoría..."
                className="w-full pl-9 pr-10 py-1.5 text-xs rounded-lg bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:border-[#ff7a1a] transition font-sans"
              />
              <span className="i-ph:sparkle absolute left-3 top-2 text-bolt-elements-textTertiary text-sm" />
              {prompt && (
                <button
                  onClick={() => setPrompt('')}
                  className="absolute right-3 top-2 text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary"
                >
                  <span className="i-ph:x text-xs" />
                </button>
              )}
            </div>

            {/* Microphone Voice Button */}
            <button
              onClick={toggleSpeech}
              className={classNames(
                'p-1.5 rounded-lg border text-sm transition flex items-center justify-center cursor-pointer',
                isListening
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 animate-pulse ring-2 ring-rose-500/30'
                  : 'bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:text-[#ff7a1a] hover:border-[#ff7a1a]/40',
              )}
              title={isListening ? 'Detener escucha de voz' : 'Hablar por micrófono (Voz a Texto)'}
            >
              <span className={isListening ? 'i-ph:microphone-fill text-rose-500' : 'i-ph:microphone text-current'} />
            </button>

            {/* Run Query Button */}
            <button
              onClick={() => handleRunQuery()}
              disabled={isGenerating || !prompt.trim()}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#ff7a1a] hover:bg-[#ea580c] disabled:opacity-50 text-white transition flex items-center gap-1.5 cursor-pointer shadow-xs shadow-[#ff7a1a]/20 shrink-0"
            >
              {isGenerating ? (
                <>
                  <span className="i-svg-spinners:90-ring-with-bg text-sm" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <span className="i-ph:paper-plane-right-fill text-xs" />
                  <span>Generar Reporte</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Suggestions Pills (collapsible when table maximized) */}
          {!isCompactHeader && (
            <div className="flex flex-wrap items-center gap-1 text-xs pt-0.5">
              <span className="text-[11px] text-bolt-elements-textTertiary font-medium mr-1">Sugerencias:</span>
              {suggestionPills.map((pill, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    const cleanText = pill.replace(/^[^\wáéíóúÁÉÍÓÚ]+/, '').trim();
                    setPrompt(cleanText);
                    handleRunQuery(cleanText);
                  }}
                  className="px-2 py-0.5 rounded text-[11px] font-medium bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary hover:text-[#ff7a1a] border border-bolt-elements-borderColor transition cursor-pointer"
                >
                  {pill}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Executive KPI Metric Cards (Colapsable y adaptativo en 1 fila) */}
        {!isCompactHeader && result && result.kpis.length > 0 && (
          <div className="shrink-0 flex flex-col gap-1.5">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5 text-bolt-elements-textSecondary font-semibold text-[11px] uppercase tracking-wider">
                <span className="i-ph:chart-polar text-sm text-[#ff7a1a]" />
                <span>Métricas del Reporte ({result.kpis.length})</span>
              </div>
              <button
                onClick={() => setShowKpis(!showKpis)}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-bolt-elements-textSecondary hover:text-[#ff7a1a] bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor transition cursor-pointer shadow-xs"
                title={showKpis ? "Ocultar tarjetas para dar más espacio a la tabla" : "Mostrar tarjetas de métricas"}
              >
                <span className={showKpis ? "i-ph:caret-up text-xs text-[#ff7a1a]" : "i-ph:caret-down text-xs text-[#ff7a1a]"} />
                <span>{showKpis ? "Ocultar métricas" : "Mostrar métricas"}</span>
              </button>
            </div>

            {showKpis ? (
              <div className={classNames(
                'grid gap-2.5',
                result.kpis.length === 1 ? 'grid-cols-1' :
                result.kpis.length === 2 ? 'grid-cols-2' :
                result.kpis.length === 3 ? 'grid-cols-1 sm:grid-cols-3' :
                'grid-cols-2 sm:grid-cols-4'
              )}>
                {result.kpis.map((kpi, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor shadow-xs flex items-center justify-between gap-3 hover:border-[#ff7a1a]/30 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold text-bolt-elements-textTertiary uppercase tracking-wider truncate mb-0.5">
                        {kpi.label}
                      </div>
                      <div className="text-lg font-extrabold text-bolt-elements-textPrimary leading-tight truncate">
                        {kpi.value}
                      </div>
                      {kpi.subtext && (
                        <div className="text-[10px] text-bolt-elements-textTertiary truncate mt-0.5">
                          {kpi.subtext}
                        </div>
                      )}
                    </div>
                    {kpi.icon && (
                      <div className="w-8 h-8 rounded-lg bg-[#ff7a1a]/10 border border-[#ff7a1a]/20 flex items-center justify-center shrink-0">
                        <span className={classNames(kpi.icon, 'text-base text-[#ff7a1a]')} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-lg bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-xs">
                {result.kpis.map((kpi, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor">
                    <span className="text-[10px] font-semibold text-bolt-elements-textTertiary uppercase">{kpi.label}:</span>
                    <span className="font-bold text-bolt-elements-textPrimary text-xs">{kpi.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* View Tabs & Status Bar */}
        <div className="flex items-center justify-between border-b border-bolt-elements-borderColor pb-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('table')}
              className={classNames(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition flex items-center gap-1.5 cursor-pointer',
                activeTab === 'table'
                  ? 'bg-[#ff7a1a]/15 text-[#ff7a1a] border border-[#ff7a1a]/30 font-semibold'
                  : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2',
              )}
            >
              <span className="i-ph:table text-sm" />
              <span>Tabla ({result?.rows.length || 0})</span>
            </button>
            <button
              onClick={() => setActiveTab('chart')}
              className={classNames(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition flex items-center gap-1.5 cursor-pointer',
                activeTab === 'chart'
                  ? 'bg-[#ff7a1a]/15 text-[#ff7a1a] border border-[#ff7a1a]/30 font-semibold'
                  : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2',
              )}
            >
              <span className="i-ph:chart-bar text-sm" />
              <span>Gráfico Visual</span>
            </button>
            <button
              onClick={() => setActiveTab('sql')}
              className={classNames(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition flex items-center gap-1.5 cursor-pointer',
                activeTab === 'sql'
                  ? 'bg-[#ff7a1a]/15 text-[#ff7a1a] border border-[#ff7a1a]/30 font-semibold'
                  : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2',
              )}
            >
              <span className="i-ph:terminal-window text-sm" />
              <span>Consulta SQL</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {result && (
              <div className="flex items-center gap-2 text-bolt-elements-textSecondary mr-1">
                <span className="font-mono text-[11px]">
                  ⚡ {result.executionTimeMs} ms
                </span>
                <span className="text-bolt-elements-textTertiary">•</span>
                <span className="text-[11px] text-[#ff7a1a] font-semibold">
                  {result.rows.length} registros
                </span>
              </div>
            )}
            <button
              onClick={() => setIsCompactHeader(!isCompactHeader)}
              className="px-2 py-1 rounded-md text-[11px] font-medium text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor flex items-center gap-1 transition cursor-pointer"
              title={isCompactHeader ? "Mostrar barra de sugerencias y tarjetas KPI" : "Maximizar área de tabla y datos"}
            >
              <span className={isCompactHeader ? "i-ph:arrows-out-simple text-xs text-[#ff7a1a]" : "i-ph:arrows-in-simple text-xs text-[#ff7a1a]"} />
              <span className="hidden sm:inline">{isCompactHeader ? "Restaurar" : "Maximizar"}</span>
            </button>
          </div>
        </div>

        {/* TAB CONTENT: 1. TABLE */}
        {activeTab === 'table' && (
          <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 overflow-hidden shadow-xs">
            {/* Table Search & Filter Bar */}
            <div className="p-2.5 border-b border-bolt-elements-borderColor flex items-center justify-between gap-3 bg-bolt-elements-background-depth-2 shrink-0">
              <div className="relative flex-1 max-w-sm">
                <input
                  type="text"
                  placeholder="Filtrar en esta tabla..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-1 focus:ring-[#ff7a1a] focus:border-[#ff7a1a] transition"
                />
                <span className="i-ph:magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-bolt-elements-textTertiary text-xs pointer-events-none" />
              </div>
              <span className="text-xs text-bolt-elements-textSecondary font-medium">
                Mostrando {filteredRows.length} de {result?.rows.length || 0} filas
              </span>
            </div>

            {/* Table Data Grid - Adaptive Full Height with Smooth Scroll */}
            <div className="flex-1 min-h-[220px] overflow-auto modern-scrollbar relative">
              {result && result.columns.length > 0 ? (
                <table className="w-full text-left text-xs border-collapse min-w-full">
                  <thead className="sticky top-0 bg-bolt-elements-background-depth-3 backdrop-blur text-bolt-elements-textSecondary font-semibold border-b border-bolt-elements-borderColor select-none z-10 shadow-xs">
                    <tr>
                      {result.columns.map((col) => (
                        <th
                          key={col}
                          onClick={() => handleSort(col)}
                          className="px-4 py-2.5 uppercase tracking-wider text-[11px] font-semibold cursor-pointer hover:text-[#ff7a1a] transition whitespace-nowrap bg-bolt-elements-background-depth-3"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{col}</span>
                            {sortCol === col && (
                              <span
                                className={classNames(
                                  'text-xs text-[#ff7a1a]',
                                  sortAsc ? 'i-ph:arrow-up' : 'i-ph:arrow-down',
                                )}
                              />
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bolt-elements-borderColor font-sans">
                    {filteredRows.map((row, rIdx) => (
                      <tr key={rIdx} className="even:bg-bolt-elements-background-depth-2/40 hover:bg-bolt-elements-item-backgroundActive transition-colors">
                        {result.columns.map((col) => {
                          const val = row[col];
                          const isBool = typeof val === 'boolean';
                          return (
                            <td key={col} className="px-4 py-2.5 text-bolt-elements-textPrimary whitespace-nowrap font-normal">
                              {isBool ? (
                                <span
                                  className={classNames(
                                    'px-2 py-0.5 rounded-full text-[10px] font-semibold',
                                    val
                                      ? 'bg-[#ff7a1a]/15 text-[#ff7a1a] border border-[#ff7a1a]/30'
                                      : 'bg-bolt-elements-background-depth-2 text-bolt-elements-textTertiary border border-bolt-elements-borderColor',
                                  )}
                                >
                                  {val ? 'SÍ (True)' : 'NO (False)'}
                                </span>
                              ) : typeof val === 'number' && /price|precio|total|spent|monto/i.test(col) ? (
                                <span className="font-mono text-[#ff7a1a] font-semibold">
                                  $ {val.toFixed(2)}
                                </span>
                              ) : (
                                <span>{String(val ?? '-')}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-bolt-elements-textTertiary text-xs">
                  {result?.error ? (
                    <div className="text-rose-500 font-mono">❌ {result.error}</div>
                  ) : (
                    <div>No se encontraron registros para la consulta solicitada</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB CONTENT: 2. CHART */}
        {activeTab === 'chart' && (
          <div className="flex-1 min-h-0 p-4 md:p-5 rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 shadow-xs flex flex-col overflow-y-auto modern-scrollbar space-y-4">
            <div className="flex items-center justify-between border-b border-bolt-elements-borderColor pb-3">
              <div>
                <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">
                  Distribución Visual: {result?.chartConfig?.labelColumn || 'Datos'} vs{' '}
                  {result?.chartConfig?.valueColumn || 'Métricas'}
                </h3>
                <p className="text-xs text-bolt-elements-textTertiary mt-0.5">
                  Visualización generativa calculada automáticamente
                </p>
              </div>

              {/* Chart Type Selector */}
              <div className="flex items-center gap-1 bg-bolt-elements-background-depth-2 p-1 rounded-lg border border-bolt-elements-borderColor">
                <button
                  onClick={() => setChartType('bar')}
                  className={classNames(
                    'px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer',
                    chartType === 'bar' ? 'bg-[#ff7a1a] text-white shadow-xs' : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
                  )}
                >
                  Barras
                </button>
                <button
                  onClick={() => setChartType('pie')}
                  className={classNames(
                    'px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer',
                    chartType === 'pie' ? 'bg-[#ff7a1a] text-white shadow-xs' : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
                  )}
                >
                  Dona / Pie
                </button>
                <button
                  onClick={() => setChartType('line')}
                  className={classNames(
                    'px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer',
                    chartType === 'line' ? 'bg-[#ff7a1a] text-white shadow-xs' : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
                  )}
                >
                  Líneas
                </button>
              </div>
            </div>

            {/* Render Dynamic SVG Chart */}
            {result?.chartConfig && result.chartConfig.labels.length > 0 ? (
              <div className="flex-1 flex flex-col justify-center max-w-3xl mx-auto w-full py-4 space-y-3">
                {chartType === 'bar' && (
                  <div className="space-y-2.5">
                    {(() => {
                      const maxVal = Math.max(...result.chartConfig.values, 1);
                      return result.chartConfig.labels.map((lbl, idx) => {
                        const val = result.chartConfig!.values[idx];
                        const pct = Math.round((val / maxVal) * 100);
                        return (
                          <div key={idx} className="flex items-center gap-3 text-xs">
                            <span className="w-40 truncate font-medium text-bolt-elements-textSecondary text-right">
                              {lbl}
                            </span>
                            <div className="flex-1 bg-bolt-elements-background-depth-2 rounded-full h-5 overflow-hidden relative">
                              <div
                                className="bg-gradient-to-r from-[#ff7a1a] to-[#ea580c] h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-20 font-mono font-semibold text-[#ff7a1a] text-right">
                              {typeof val === 'number' ? val.toLocaleString() : val}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}

                {chartType === 'pie' && (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-8 py-6">
                    <svg className="w-48 h-48 -rotate-90 transform" viewBox="0 0 100 100">
                      {(() => {
                        const total = result.chartConfig.values.reduce((a, b) => a + b, 0) || 1;
                        let accumulatedPercent = 0;
                        const colors = ['#ff7a1a', '#f97316', '#fb923c', '#ea580c', '#c2410c', '#3b82f6', '#10b981'];
                        return result.chartConfig.values.map((val, idx) => {
                          const pct = (val / total) * 100;
                          const strokeDasharray = `${pct} ${100 - pct}`;
                          const strokeDashoffset = -accumulatedPercent;
                          accumulatedPercent += pct;
                          return (
                            <circle
                              key={idx}
                              r="16"
                              cx="50"
                              cy="50"
                              fill="transparent"
                              stroke={colors[idx % colors.length]}
                              strokeWidth="32"
                              strokeDasharray={strokeDasharray}
                              strokeDashoffset={strokeDashoffset}
                              pathLength="100"
                              className="transition-all duration-300 hover:opacity-80"
                            />
                          );
                        });
                      })()}
                    </svg>
                    <div className="space-y-1.5 text-xs">
                      {result.chartConfig.labels.map((lbl, idx) => {
                        const colors = ['#ff7a1a', '#f97316', '#fb923c', '#ea580c', '#c2410c', '#3b82f6', '#10b981'];
                        return (
                          <div key={idx} className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: colors[idx % colors.length] }}
                            />
                            <span className="text-bolt-elements-textSecondary truncate max-w-[200px]">{lbl}</span>
                            <span className="font-mono text-bolt-elements-textTertiary">
                              ({result.chartConfig!.values[idx]})
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {chartType === 'line' && (
                  <div className="h-64 flex items-end gap-3 pt-8 pb-4 border-b border-bolt-elements-borderColor">
                    {(() => {
                      const maxVal = Math.max(...result.chartConfig.values, 1);
                      return result.chartConfig.labels.map((lbl, idx) => {
                        const val = result.chartConfig!.values[idx];
                        const pct = Math.max(Math.round((val / maxVal) * 100), 10);
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                            <span className="text-[10px] font-mono text-[#ff7a1a] font-semibold">
                              {val}
                            </span>
                            <div
                              className="w-full bg-gradient-to-t from-[#ff7a1a] to-[#ea580c] rounded-t-md transition-all duration-500"
                              style={{ height: `${pct}%` }}
                            />
                            <span className="text-[10px] text-bolt-elements-textTertiary truncate max-w-[60px] text-center">
                              {lbl}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-bolt-elements-textTertiary text-xs">
                Esta consulta no contiene columnas categóricas o numéricas adecuadas para graficar directamente.
              </div>
            )}
          </div>
        )}

        {/* TAB CONTENT: 3. SQL QUERY */}
        {activeTab === 'sql' && (
          <div className="flex-1 min-h-0 p-4 rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 shadow-xs flex flex-col overflow-y-auto modern-scrollbar space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="i-ph:terminal text-base text-[#ff7a1a]" />
                <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">Consulta ANSI SQL Generada</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditingSql(!isEditingSql)}
                  className="px-2.5 py-1 text-xs font-medium rounded-md bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary border border-bolt-elements-borderColor transition cursor-pointer"
                >
                  {isEditingSql ? 'Cancelar Edición' : 'Editar SQL'}
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(customSql || result?.sql || '');
                    toast.success('SQL copiado al portapapeles');
                  }}
                  className="px-2.5 py-1 text-xs font-medium rounded-md bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary border border-bolt-elements-borderColor transition flex items-center gap-1 cursor-pointer"
                >
                  <span className="i-ph:copy text-xs" />
                  <span>Copiar</span>
                </button>
              </div>
            </div>

            {isEditingSql ? (
              <div className="space-y-2">
                <textarea
                  value={customSql}
                  onChange={(e) => setCustomSql(e.target.value)}
                  rows={4}
                  className="w-full p-3 font-mono text-xs rounded-lg bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-[#ff7a1a] focus:outline-none focus:border-[#ff7a1a]"
                />
                <button
                  onClick={handleRunCustomSql}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#ff7a1a] hover:bg-[#ea580c] text-white transition flex items-center gap-1.5 cursor-pointer shadow-xs shadow-[#ff7a1a]/20"
                >
                  <span className="i-ph:play-fill text-xs" />
                  <span>Re-ejecutar SQL</span>
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-xs font-mono text-[#ff7a1a] overflow-x-auto shadow-inner">
                <code>{customSql || result?.sql || 'SELECT * FROM juegos'}</code>
              </div>
            )}

            <div className="text-xs text-bolt-elements-textTertiary space-y-1 pt-2">
              <span className="font-semibold text-bolt-elements-textSecondary">Tablas registradas en alaSQL:</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {tables.map((t) => (
                  <span
                    key={t.table_name}
                    className="px-2 py-0.5 rounded text-[11px] font-mono bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary border border-bolt-elements-borderColor"
                  >
                    {t.table_name} ({t.seed_data.length} filas)
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PLAN UPGRADE MODAL */}
      <PlanUpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />
    </div>
  );
}
