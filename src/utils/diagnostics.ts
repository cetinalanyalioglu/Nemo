import { useConsoleStore } from '../store/consoleStore';
import { useGraphStore } from '../store/graphStore';

const MAX_CAPTURED_ERRORS = 50;

interface CapturedError {
  at: string;
  kind: 'error' | 'unhandledrejection' | 'console.error';
  message: string;
  stack?: string;
}

const capturedErrors: CapturedError[] = [];

const pushCapturedError = (entry: CapturedError): void => {
  capturedErrors.push(entry);
  if (capturedErrors.length > MAX_CAPTURED_ERRORS) {
    capturedErrors.splice(0, capturedErrors.length - MAX_CAPTURED_ERRORS);
  }
};

const collectIntegrityIssues = (): string[] => {
  const state = useGraphStore.getState();
  const issues: string[] = [];
  const nodeIds = new Set(state.nodes.map((node) => node.id));

  if (state.pendingLoad) {
    issues.push(
      `pendingLoad is set (target model: ${state.pendingLoad.model.id ?? 'missing'}, active: ${state.model?.id ?? 'none'})`
    );
  }

  if (!state.model && state.nodes.length > 0) {
    issues.push('Canvas has nodes but no active runtime model');
  }

  const duplicateNodeIds = state.nodes
    .map((node) => node.id)
    .filter((id, index, ids) => ids.indexOf(id) !== index);
  if (duplicateNodeIds.length > 0) {
    issues.push(`Duplicate node ids: ${Array.from(new Set(duplicateNodeIds)).join(', ')}`);
  }

  for (const node of state.nodes) {
    if (!state.nodeStates[node.id]) {
      issues.push(`Node "${node.id}" (${node.type ?? 'unknown'}) is missing nodeStates entry`);
    }
    if (!node.type) {
      issues.push(`Node "${node.id}" has no type`);
    } else if (state.model && !state.model.elementInfo[node.type]) {
      issues.push(`Node "${node.id}" has unknown type "${node.type}" for active model`);
    }
  }

  for (const edge of state.edges) {
    if (!state.edgeStates[edge.id]) {
      issues.push(`Edge "${edge.id}" is missing edgeStates entry`);
    }
    if (!nodeIds.has(edge.source)) {
      issues.push(`Edge "${edge.id}" references missing source node "${edge.source}"`);
    }
    if (!nodeIds.has(edge.target)) {
      issues.push(`Edge "${edge.id}" references missing target node "${edge.target}"`);
    }
    if (edge.type && state.model && !state.model.edgeInfo[edge.type]) {
      issues.push(`Edge "${edge.id}" has unknown type "${edge.type}" for active model`);
    }
  }

  for (const nodeId of Object.keys(state.nodeStates)) {
    if (!nodeIds.has(nodeId)) {
      issues.push(`Orphan nodeStates entry for missing node "${nodeId}"`);
    }
  }

  for (const edgeId of Object.keys(state.edgeStates)) {
    if (!state.edges.some((edge) => edge.id === edgeId)) {
      issues.push(`Orphan edgeStates entry for missing edge "${edgeId}"`);
    }
  }

  for (const nodeId of Object.keys(state.editingStates)) {
    if (!nodeIds.has(nodeId)) {
      issues.push(`Orphan editingStates entry for missing node "${nodeId}"`);
    }
  }

  return issues;
};

export interface DiagnosticsReport {
  capturedAt: string;
  url: string;
  userAgent: string;
  graph: {
    modelId: string | null;
    modelName: string | null;
    nodeCount: number;
    edgeCount: number;
    selectedNodeId: string | null;
    selectedEdgeId: string | null;
    pendingLoad: boolean;
    pendingLoadModelId: string | null;
    undoDepth: number;
    redoDepth: number;
    nodes: ReturnType<typeof useGraphStore.getState>['nodes'];
    edges: ReturnType<typeof useGraphStore.getState>['edges'];
    nodeStates: ReturnType<typeof useGraphStore.getState>['nodeStates'];
    edgeStates: ReturnType<typeof useGraphStore.getState>['edgeStates'];
    modelParameters: ReturnType<typeof useGraphStore.getState>['modelParameters'];
    nodeCounters: ReturnType<typeof useGraphStore.getState>['nodeCounters'];
  };
  integrity: {
    issueCount: number;
    issues: string[];
  };
  console: {
    entryCount: number;
    entries: ReturnType<typeof useConsoleStore.getState>['entries'];
  };
  runtime: {
    capturedErrorCount: number;
    capturedErrors: CapturedError[];
    reactRootPresent: boolean;
    reactErrorOverlayPresent: boolean;
  };
}

export const collectDiagnostics = (): DiagnosticsReport => {
  const graph = useGraphStore.getState();
  const consoleState = useConsoleStore.getState();
  const issues = collectIntegrityIssues();

  return {
    capturedAt: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    graph: {
      modelId: graph.model?.id ?? null,
      modelName: graph.model?.name ?? null,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      selectedNodeId: graph.selectedNodeId,
      selectedEdgeId: graph.selectedEdgeId,
      pendingLoad: graph.pendingLoad !== null,
      pendingLoadModelId: graph.pendingLoad?.model.id ?? null,
      undoDepth: graph.past.length,
      redoDepth: graph.future.length,
      nodes: graph.nodes,
      edges: graph.edges,
      nodeStates: graph.nodeStates,
      edgeStates: graph.edgeStates,
      modelParameters: graph.modelParameters,
      nodeCounters: graph.nodeCounters,
    },
    integrity: {
      issueCount: issues.length,
      issues,
    },
    console: {
      entryCount: consoleState.entries.length,
      entries: consoleState.entries,
    },
    runtime: {
      capturedErrorCount: capturedErrors.length,
      capturedErrors: [...capturedErrors],
      reactRootPresent: document.getElementById('root') !== null,
      reactErrorOverlayPresent:
        document.querySelector('vite-error-overlay, #webpack-dev-server-client-overlay') !== null,
    },
  };
};

const serializeDiagnostics = (report: DiagnosticsReport): string => JSON.stringify(report, null, 2);

export const downloadDiagnostics = (report: DiagnosticsReport = collectDiagnostics()): void => {
  const blob = new Blob([serializeDiagnostics(report)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `fnetlib-diagnostics-${report.capturedAt.replace(/[:.]/g, '-')}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const copyDiagnostics = async (
  report: DiagnosticsReport = collectDiagnostics()
): Promise<void> => {
  await navigator.clipboard.writeText(serializeDiagnostics(report));
};

export interface FNetLibDiagnosticsApi {
  collectDiagnostics: typeof collectDiagnostics;
  downloadDiagnostics: typeof downloadDiagnostics;
  copyDiagnostics: typeof copyDiagnostics;
  printDiagnostics: () => DiagnosticsReport;
}

declare global {
  interface Window {
    __FNETLIB__?: FNetLibDiagnosticsApi;
  }
}

export const installDiagnosticsBridge = (): void => {
  if (window.__FNETLIB__) return;

  window.addEventListener('error', (event) => {
    pushCapturedError({
      at: new Date().toISOString(),
      kind: 'error',
      message: event.message,
      stack: event.error instanceof Error ? event.error.stack : undefined,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    pushCapturedError({
      at: new Date().toISOString(),
      kind: 'unhandledrejection',
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });

  const originalConsoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    pushCapturedError({
      at: new Date().toISOString(),
      kind: 'console.error',
      message: args.map((arg) => (typeof arg === 'string' ? arg : String(arg))).join(' '),
    });
    originalConsoleError(...args);
  };

  const printDiagnostics = (): DiagnosticsReport => {
    const report = collectDiagnostics();
    console.group('[FNetLib] Diagnostics');
    console.log('Summary', {
      model: report.graph.modelId,
      nodes: report.graph.nodeCount,
      edges: report.graph.edgeCount,
      integrityIssues: report.integrity.issueCount,
      consoleEntries: report.console.entryCount,
      capturedErrors: report.runtime.capturedErrorCount,
    });
    if (report.integrity.issues.length > 0) {
      console.warn('Integrity issues', report.integrity.issues);
    }
    console.log('Full report', report);
    console.groupEnd();
    return report;
  };

  window.__FNETLIB__ = {
    collectDiagnostics,
    downloadDiagnostics,
    copyDiagnostics,
    printDiagnostics,
  };

  console.info(
    '[FNetLib] Diagnostics ready. Run __FNETLIB__.printDiagnostics(), __FNETLIB__.downloadDiagnostics(), or __FNETLIB__.copyDiagnostics().'
  );
};
