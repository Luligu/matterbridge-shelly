/* eslint-disable no-console */
// Wait for Cockpit to fully initialize
cockpit.transport.wait(function () {
  console.log('Matterbridge Cockpit extension loaded');

  // Fetch logs
  function fetchLogs() {
    cockpit
      .spawn(['journalctl', '-u', 'matterbridge', '--no-pager', '-n', '20', '-o', 'cat'])
      .then(function (logs) {
        // const filteredLogs = logs.split('\n').filter(line => !line.includes('matterbridge.service')).join('\n');
        // eslint-disable-next-line no-control-regex
        logs = logs.replace(/\x1B\[[0-9;]*[m|s|u|K]/g, '');
        document.getElementById('logs').innerText = logs;
      })
      .catch(function (error) {
        console.error('Error fetching logs:', error);
        document.getElementById('logs').innerText = 'Error fetching logs.';
      });
  }

  // Reload the Matterbridge configuration
  document.getElementById('frontend-button').addEventListener('click', function () {
    const hostname = window.location.hostname;
    const newUrl = `http://${hostname}:8283`;
    window.open(newUrl, '_blank');
  });

  // Initial fetch of status and logs
  fetchLogs();
});
