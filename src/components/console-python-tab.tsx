import React from 'react';

const ConsolePythonTab = React.memo(() => (
  <div className="console-python-tab">
    <p className="console-python-placeholder">
      Python console will be available in a future release. Use the Logs tab for application
      messages in the meantime.
    </p>
  </div>
));

ConsolePythonTab.displayName = 'ConsolePythonTab';

export default ConsolePythonTab;
