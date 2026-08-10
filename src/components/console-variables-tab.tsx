import React, { useEffect } from 'react';
import { IoRefreshOutline, IoTrashOutline } from 'react-icons/io5';
import { askForVariables, clearVariables } from '../python/python-runtime';
import { usePythonStore } from '../store/pythonStore';

/**
 * What the session is holding.
 *
 * A console keeps everything typed into it, and after a while it is genuinely hard to
 * say what is defined and what it holds — harder still to be sure a name still means
 * what it meant an hour ago. This is that list, and the way to empty it.
 *
 * Emptying is not restarting. The interpreter, its imported modules and the seconds
 * spent starting it all stay; only the names go. Restart is the heavier one, and is what
 * stops something that is still running.
 */

const VariableRow = React.memo(
  ({ name, kind, summary }: { name: string; kind: string; summary: string }) => (
    <div className="variables-row">
      <span className="variables-name">{name}</span>
      <span className="variables-kind">{kind}</span>
      <span className="variables-summary" title={summary}>
        {summary}
      </span>
    </div>
  )
);

VariableRow.displayName = 'VariableRow';

const ConsoleVariablesTab = React.memo(({ active }: { active: boolean }) => {
  const variables = usePythonStore((s) => s.variables);
  const status = usePythonStore((s) => s.status);

  // Asked for when the tab is looked at, and again whenever the interpreter goes idle
  // — running a line can define a dozen names, and a list that is quietly out of date
  // is worse than no list.
  useEffect(() => {
    if (active && status !== 'busy') askForVariables();
  }, [active, status]);

  return (
    <div className="console-variables-tab">
      <div className="console-python-toolbar">
        <span className="variables-count">
          {status === 'off'
            ? 'the interpreter has not started'
            : `${variables.length} name${variables.length === 1 ? '' : 's'}`}
        </span>
        <div className="console-python-actions">
          <button
            type="button"
            className="console-logs-clear"
            onClick={askForVariables}
            title="Look again"
            aria-label="Refresh the list"
          >
            <IoRefreshOutline aria-hidden />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="console-logs-clear"
            onClick={clearVariables}
            disabled={variables.length === 0}
            title="Forget every name defined here. The interpreter and its imports stay up."
            aria-label="Forget every name"
          >
            <IoTrashOutline aria-hidden />
            <span>Forget all</span>
          </button>
        </div>
      </div>

      <div className="variables-list">
        {variables.length === 0 ? (
          <p className="console-logs-empty">
            {status === 'off'
              ? 'Nothing yet — the interpreter starts with the first line you run.'
              : 'Nothing defined yet.'}
          </p>
        ) : (
          variables.map((variable) => <VariableRow key={variable.name} {...variable} />)
        )}
      </div>
    </div>
  );
});

ConsoleVariablesTab.displayName = 'ConsoleVariablesTab';

export default ConsoleVariablesTab;
