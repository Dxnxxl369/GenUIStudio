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
  injectReportIntoProject,
  generateReportReactComponent,
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
  const [showInjectModal, setShowInjectModal] = useState(false);
  const [injectedCode, setInjectedCode] = useState('');
  const [isInjecting, setIsInjecting] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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

  // Export CSV
  const handleExportCSV = () => {
    if (!result || result.rows.length === 0) {
      toast.warn('No hay datos para exportar');
      return;
    }
    const headers = result.columns.join(',');
    const rows = result.rows.map((r) =>
      result.columns
        .map((col) => `"${String(r[col] ?? '').replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob([headers + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
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

  // Handle Code Injection into Project
  const handleOpenInjectModal = () => {
    if (!result) return;
    if (!plan.hasCodeInjection) {
      toast.warn('🔒 La inyección de código autónomo requiere el Plan Pro Developer o superior.');
      setIsUpgradeModalOpen(true);
      return;
    }
    const code = generateReportReactComponent(prompt, result.sql, result);
    setInjectedCode(code);
    setShowInjectModal(true);
  };

  const handleConfirmInject = async () => {
    if (!result) return;
    const creditSuccess = saasActions.deductCredits(
      1500,
      'code_injection',
      `Inyección de reporte React en proyecto`,
    );
    if (!creditSuccess) {
      toast.error('❌ Saldo insuficiente de créditos para inyección de código.');
      setIsUpgradeModalOpen(true);
      return;
    }

    setIsInjecting(true);
    const res = await injectReportIntoProject(prompt, result.sql, result);
    setIsInjecting(false);
    if (res.success) {
      toast.success(`🎉 ${res.message}`);
      setShowInjectModal(false);
    } else {
      toast.error(res.message);
    }
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
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Consulta bases de datos, mockData y memoria con lenguaje natural o voz
            </p>
          </div>
        </div>

        {/* Action Buttons & SaaS Quota */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsUpgradeModalOpen(true)}
            className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-[#1a1a17] border border-zinc-200 dark:border-[#2a2a25] text-xs cursor-pointer hover:border-[#ff7a1a]/40 transition"
            title="Cuota de consumo IA del usuario activo - Haz clic para ver planes"
          >
            <span className="i-ph:lightning-fill text-amber-500 text-xs" />
            <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
              {Math.max(user.creditsTotal - user.creditsUsed, 0).toLocaleString()}
            </span>
            <span className="text-[10px] text-zinc-400 hidden lg:inline">créditos</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-[#ff7a1a]/10 text-[#ff7a1a] border border-[#ff7a1a]/25">
              {plan.badge}
            </span>
          </button>

          <button
            onClick={() => {
              setRefreshTrigger((prev) => prev + 1);
              toast.success('Base de datos refrescada');
            }}
            className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-300 dark:bg-[#1a1a17] dark:hover:bg-[#252520] dark:text-zinc-300 dark:border-[#2a2a25] border transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Refrescar datos en vivo de la base de datos"
          >
            <span className="i-ph:arrows-clockwise text-sm text-[#ff7a1a]" />
            <span>Refrescar</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-300 dark:bg-[#1a1a17] dark:hover:bg-[#252520] dark:text-zinc-300 dark:border-[#2a2a25] border transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Descargar datos en formato CSV"
          >
            <span className="i-ph:file-csv text-sm text-[#ff7a1a]" />
            <span>CSV</span>
          </button>
          <button
            onClick={handleExportJSON}
            className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-300 dark:bg-[#1a1a17] dark:hover:bg-[#252520] dark:text-zinc-300 dark:border-[#2a2a25] border transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Descargar datos en formato JSON"
          >
            <span className="i-ph:file-code text-sm text-[#ff7a1a]" />
            <span>JSON</span>
          </button>
          <button
            onClick={handleOpenInjectModal}
            className={classNames(
              'px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-sm',
              plan.hasCodeInjection
                ? 'bg-gradient-to-r from-[#ff7a1a] to-[#ea580c] hover:from-[#f97316] hover:to-[#c2410c] text-white shadow-[#ff7a1a]/20'
                : 'bg-zinc-100 dark:bg-[#1a1a17] text-zinc-600 dark:text-zinc-300 border border-zinc-300 dark:border-[#2a2a25] hover:border-amber-500/50',
            )}
            title={plan.hasCodeInjection ? "Inyectar este reporte generado como un componente React en tu proyecto" : "Requiere Plan Pro Developer"}
          >
            {plan.hasCodeInjection ? (
              <span className="i-ph:rocket-launch text-sm" />
            ) : (
              <span className="i-ph:lock-key-fill text-sm text-amber-500" />
            )}
            <span>Inyectar en Proyecto</span>
            {!plan.hasCodeInjection && (
              <span className="px-1 py-0.2 text-[8px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded uppercase">
                PRO
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col p-4 space-y-4 overflow-y-auto bg-zinc-50 dark:bg-[#0a0a09]">
        {/* Natural Language Prompt & Speech Input Bar */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#131311] border border-zinc-200 dark:border-[#2a2a25] shadow-xs space-y-2.5">
          <div className="flex items-center gap-2">
            {/* Target Table Dropdown Selector */}
            <div className="relative shrink-0">
              <select
                value={selectedTableFilter}
                onChange={(e) => setSelectedTableFilter(e.target.value)}
                className="px-2.5 py-2 text-xs rounded-lg bg-zinc-100 dark:bg-[#1a1a17] border border-zinc-200 dark:border-[#2a2a25] text-zinc-800 dark:text-[#f2f0e9] focus:outline-none focus:border-[#ff7a1a] cursor-pointer shadow-xs transition"
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
                className="w-full pl-9 pr-10 py-2 text-xs rounded-lg bg-zinc-100 dark:bg-[#1a1a17] border border-zinc-200 dark:border-[#2a2a25] text-zinc-900 dark:text-[#f2f0e9] placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#ff7a1a] transition font-sans"
              />
              <span className="i-ph:sparkle absolute left-3 top-2.5 text-zinc-400 text-sm" />
              {prompt && (
                <button
                  onClick={() => setPrompt('')}
                  className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-white"
                >
                  <span className="i-ph:x text-xs" />
                </button>
              )}
            </div>

            {/* Microphone Voice Button */}
            <button
              onClick={toggleSpeech}
              className={classNames(
                'p-2 rounded-lg border text-sm transition flex items-center justify-center cursor-pointer',
                isListening
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 animate-pulse ring-2 ring-rose-500/30'
                  : 'bg-zinc-100 dark:bg-[#1a1a17] border-zinc-200 dark:border-[#2a2a25] text-zinc-600 dark:text-zinc-300 hover:text-[#ff7a1a] dark:hover:text-[#ff7a1a] hover:border-[#ff7a1a]/40',
              )}
              title={isListening ? 'Detener escucha de voz' : 'Hablar por micrófono (Voz a Texto)'}
            >
              <span className={isListening ? 'i-ph:microphone-fill text-rose-500' : 'i-ph:microphone text-current'} />
            </button>

            {/* Run Query Button */}
            <button
              onClick={() => handleRunQuery()}
              disabled={isGenerating || !prompt.trim()}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#ff7a1a] hover:bg-[#ea580c] disabled:opacity-50 text-white transition flex items-center gap-1.5 cursor-pointer shadow-xs shadow-[#ff7a1a]/20"
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

          {/* Quick Suggestions Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mr-1">Sugerencias rápidas:</span>
            {suggestionPills.map((pill, idx) => (
              <button
                key={idx}
                onClick={() => {
                  const cleanText = pill.replace(/^[^\wáéíóúÁÉÍÓÚ]+/, '').trim();
                  setPrompt(cleanText);
                  handleRunQuery(cleanText);
                }}
                className="px-2 py-1 rounded-md text-[11px] font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-[#ff7a1a] border-zinc-200 dark:bg-[#1a1a17] dark:hover:bg-[#22221d] dark:text-zinc-300 dark:hover:text-[#ff7a1a] dark:border-[#2a2a25] border transition cursor-pointer"
              >
                {pill}
              </button>
            ))}
          </div>
        </div>

        {/* Executive KPI Metric Cards */}
        {result && result.kpis.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {result.kpis.map((kpi, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-white dark:bg-[#131311] border border-zinc-200 dark:border-[#2a2a25] shadow-xs flex flex-col justify-between"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  <span>{kpi.label}</span>
                  {kpi.icon && <span className={classNames(kpi.icon, 'text-sm text-[#ff7a1a]')} />}
                </div>
                <div className="text-xl font-bold text-zinc-900 dark:text-[#f2f0e9] mt-1 mb-0.5">{kpi.value}</div>
                {kpi.subtext && <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">{kpi.subtext}</span>}
              </div>
            ))}
          </div>
        )}

        {/* View Tabs & Status Bar */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-[#2a2a25] pb-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('table')}
              className={classNames(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition flex items-center gap-1.5 cursor-pointer',
                activeTab === 'table'
                  ? 'bg-[#ff7a1a]/15 text-[#ff7a1a] border border-[#ff7a1a]/30 font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#1a1a17]',
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
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#1a1a17]',
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
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#1a1a17]',
              )}
            >
              <span className="i-ph:terminal-window text-sm" />
              <span>Consulta SQL</span>
            </button>
          </div>

          {result && (
            <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="font-mono text-[11px]">
                ⚡ {result.executionTimeMs} ms
              </span>
              <span className="text-zinc-400 dark:text-zinc-600">•</span>
              <span className="text-[11px] text-[#ff7a1a] font-semibold">
                {result.rows.length} registros
              </span>
            </div>
          )}
        </div>

        {/* TAB CONTENT: 1. TABLE */}
        {activeTab === 'table' && (
          <div className="flex-1 flex flex-col rounded-xl border border-zinc-200 dark:border-[#2a2a25] bg-white dark:bg-[#131311] overflow-hidden shadow-xs">
            {/* Table Search & Filter Bar */}
            <div className="p-2.5 border-b border-zinc-200 dark:border-[#2a2a25] flex items-center justify-between gap-3 bg-zinc-50 dark:bg-[#181815]">
              <div className="relative flex-1 max-w-xs">
                <input
                  type="text"
                  placeholder="Filtrar en esta tabla..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 text-xs rounded-md bg-white dark:bg-[#1a1a17] border border-zinc-200 dark:border-[#2a2a25] text-zinc-900 dark:text-[#f2f0e9] placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#ff7a1a]"
                />
                <span className="i-ph:magnifying-glass absolute left-2 top-2 text-zinc-400 text-xs" />
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                Mostrando {filteredRows.length} de {result?.rows.length || 0} filas
              </span>
            </div>

            {/* Table Data Grid */}
            <div className="flex-1 overflow-auto max-h-[500px]">
              {result && result.columns.length > 0 ? (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-zinc-100/90 dark:bg-[#1a1a17]/90 backdrop-blur text-zinc-700 dark:text-zinc-300 font-semibold border-b border-zinc-200 dark:border-[#2a2a25] select-none z-10">
                    <tr>
                      {result.columns.map((col) => (
                        <th
                          key={col}
                          onClick={() => handleSort(col)}
                          className="px-4 py-2.5 uppercase tracking-wider text-[11px] font-semibold cursor-pointer hover:text-[#ff7a1a] transition"
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
                  <tbody className="divide-y divide-zinc-200 dark:divide-[#22221d] font-sans">
                    {filteredRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-zinc-50 dark:hover:bg-[#1a1a17]/50 transition">
                        {result.columns.map((col) => {
                          const val = row[col];
                          const isBool = typeof val === 'boolean';
                          return (
                            <td key={col} className="px-4 py-2 text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
                              {isBool ? (
                                <span
                                  className={classNames(
                                    'px-2 py-0.5 rounded-full text-[10px] font-semibold',
                                    val
                                      ? 'bg-[#ff7a1a]/15 text-[#ff7a1a] border border-[#ff7a1a]/30'
                                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700',
                                  )}
                                >
                                  {val ? 'SÍ (True)' : 'NO (False)'}
                                </span>
                              ) : typeof val === 'number' && /price|precio|total/i.test(col) ? (
                                <span className="font-mono text-[#ff7a1a] font-medium">
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
                <div className="p-8 text-center text-zinc-500 dark:text-zinc-400 text-xs">
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
          <div className="flex-1 p-5 rounded-xl border border-zinc-200 dark:border-[#2a2a25] bg-white dark:bg-[#131311] shadow-xs flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-[#2a2a25] pb-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                  Distribución Visual: {result?.chartConfig?.labelColumn || 'Datos'} vs{' '}
                  {result?.chartConfig?.valueColumn || 'Métricas'}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Visualización generativa calculada automáticamente
                </p>
              </div>

              {/* Chart Type Selector */}
              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-[#1a1a17] p-1 rounded-lg border border-zinc-200 dark:border-[#2a2a25]">
                <button
                  onClick={() => setChartType('bar')}
                  className={classNames(
                    'px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer',
                    chartType === 'bar' ? 'bg-[#ff7a1a] text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white',
                  )}
                >
                  Barras
                </button>
                <button
                  onClick={() => setChartType('pie')}
                  className={classNames(
                    'px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer',
                    chartType === 'pie' ? 'bg-[#ff7a1a] text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white',
                  )}
                >
                  Dona / Pie
                </button>
                <button
                  onClick={() => setChartType('line')}
                  className={classNames(
                    'px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer',
                    chartType === 'line' ? 'bg-[#ff7a1a] text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white',
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
                            <span className="w-40 truncate font-medium text-zinc-700 dark:text-zinc-300 text-right">
                              {lbl}
                            </span>
                            <div className="flex-1 bg-zinc-100 dark:bg-[#1a1a17] rounded-full h-5 overflow-hidden relative">
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
                            <span className="text-zinc-700 dark:text-zinc-300 truncate max-w-[200px]">{lbl}</span>
                            <span className="font-mono text-zinc-500 dark:text-zinc-400">
                              ({result.chartConfig!.values[idx]})
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {chartType === 'line' && (
                  <div className="h-64 flex items-end gap-3 pt-8 pb-4 border-b border-zinc-200 dark:border-[#2a2a25]">
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
                            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate max-w-[60px] text-center">
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
              <div className="p-8 text-center text-zinc-500 dark:text-zinc-400 text-xs">
                Esta consulta no contiene columnas categóricas o numéricas adecuadas para graficar directamente.
              </div>
            )}
          </div>
        )}

        {/* TAB CONTENT: 3. SQL QUERY */}
        {activeTab === 'sql' && (
          <div className="flex-1 p-4 rounded-xl border border-zinc-200 dark:border-[#2a2a25] bg-white dark:bg-[#131311] shadow-xs flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="i-ph:terminal text-base text-[#ff7a1a]" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Consulta ANSI SQL Generada</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditingSql(!isEditingSql)}
                  className="px-2.5 py-1 text-xs font-medium rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 dark:bg-[#1a1a17] dark:hover:bg-[#252520] dark:text-zinc-300 dark:border-[#2a2a25] transition cursor-pointer"
                >
                  {isEditingSql ? 'Cancelar Edición' : 'Editar SQL'}
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(customSql || result?.sql || '');
                    toast.success('SQL copiado al portapapeles');
                  }}
                  className="px-2.5 py-1 text-xs font-medium rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 dark:bg-[#1a1a17] dark:hover:bg-[#252520] dark:text-zinc-300 dark:border-[#2a2a25] transition flex items-center gap-1 cursor-pointer"
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
                  className="w-full p-3 font-mono text-xs rounded-lg bg-zinc-900 dark:bg-[#0a0a09] border border-zinc-300 dark:border-[#2a2a25] text-[#ff7a1a] focus:outline-none focus:border-[#ff7a1a]"
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
              <div className="p-4 rounded-lg bg-zinc-900 dark:bg-[#0a0a09] border border-zinc-300 dark:border-[#2a2a25] text-xs font-mono text-[#ff7a1a] overflow-x-auto shadow-inner">
                <code>{customSql || result?.sql || 'SELECT * FROM juegos'}</code>
              </div>
            )}

            <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1 pt-2">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Tablas registradas en alaSQL:</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {tables.map((t) => (
                  <span
                    key={t.table_name}
                    className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-100 dark:bg-[#1a1a17] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-[#2a2a25]"
                  >
                    {t.table_name} ({t.seed_data.length} filas)
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CODE INJECTION MODAL */}
      {showInjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-[#131311] border border-zinc-200 dark:border-[#2a2a25] rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-[#2a2a25] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#ff7a1a]/15 text-[#ff7a1a] flex items-center justify-center">
                  <span className="i-ph:rocket-launch text-base" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">Inyectar Reporte en el Proyecto</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Se creará el componente React autónomo en <code className="text-[#ff7a1a]">src/components/GeneratedReport.jsx</code>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInjectModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white"
              >
                <span className="i-ph:x text-base" />
              </button>
            </div>

            <div className="p-3 bg-zinc-50 dark:bg-[#0a0a09] border border-zinc-200 dark:border-[#2a2a25] rounded-xl max-h-60 overflow-y-auto">
              <pre className="text-[11px] font-mono text-zinc-800 dark:text-zinc-200 leading-relaxed">
                {injectedCode}
              </pre>
            </div>

            <div className="text-xs text-zinc-600 dark:text-zinc-300 bg-orange-500/10 p-3 rounded-lg border border-[#ff7a1a]/20 flex items-start gap-2">
              <span className="i-ph:info text-sm text-[#ff7a1a] shrink-0 mt-0.5" />
              <span>
                Este componente contiene las tarjetas KPI, el gráfico visual SVG, la tabla con filtro reactivo y el botón para exportar a CSV, listo para ser utilizado en cualquier vista de tu aplicación.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowInjectModal(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#1a1a17] transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmInject}
                disabled={isInjecting}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-[#ff7a1a] hover:bg-[#ea580c] text-white transition flex items-center gap-1.5 shadow-md shadow-[#ff7a1a]/20 cursor-pointer"
              >
                {isInjecting ? (
                  <>
                    <span className="i-svg-spinners:90-ring-with-bg text-sm" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <span className="i-ph:check-bold text-xs" />
                    <span>Confirmar e Inyectar en Código</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PLAN UPGRADE MODAL */}
      <PlanUpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />
    </div>
  );
}
