/* eslint-disable no-control-regex */
/* eslint-disable no-console */
// Wait for Cockpit to fully initialize
cockpit.transport.wait(function () {
  console.log('Matterbridge Cockpit extension loaded');

  // Fetch and display the Matterbridge status
  function fetchStatus() {
    cockpit
      .spawn(['systemctl', 'is-active', 'matterbridge'])
      .then(function (status) {
        document.getElementById('status').innerText = `Status: ${status.trim().replace('\n', '')}`;
      })
      .catch(function (error) {
        console.error('Error fetching Matterbridge status:', error);
        document.getElementById('status').innerText = 'Error fetching status.';
      });
  }

  // Fetch and display the Matterbridge current version
  function fetchMatterbridgeCurrent() {
    cockpit
      .spawn(['npm', 'list', '-g', 'matterbridge'])
      .then(function (status) {
        // Extract the version number using a regular expression
        const versionMatch = status.match(/matterbridge@(\d+\.\d+\.\d+)/);
        const version = versionMatch ? versionMatch[1] : 'Unknown';
        document.getElementById('matterbridge-current').innerText = `Current version: ${version}`;
      })
      .catch(function (error) {
        console.error('Error fetching Matterbridge current version:', error);
        document.getElementById('matterbridge-current').innerText = 'Error fetching Matterbridge current version.';
      });
  }

  // Fetch and display the Matterbridge latest version
  function fetchMatterbridgeLatest() {
    cockpit
      .spawn(['npm', 'show', 'matterbridge', 'version'])
      // cockpit.spawn(["whoami"])
      .then(function (status) {
        document.getElementById('matterbridge-latest').innerText = `Latest version: ${status.trim()}`;
      })
      .catch(function (error) {
        console.error('Error fetching Matterbridge latest version:', error);
        document.getElementById('matterbridge-latest').innerText = 'Error fetching Matterbridge latest version.';
      });
  }

  // Fetch and display the Shelly plugin current version
  function fetchShellyCurrent() {
    cockpit
      .spawn(['npm', 'list', '-g', 'matterbridge-shelly'])
      .then(function (status) {
        // Extract the version number using a regular expression
        const versionMatch = status.match(/matterbridge-shelly@(\d+\.\d+\.\d+)/);
        const version = versionMatch ? versionMatch[1] : 'Unknown';
        document.getElementById('shelly-current').innerText = `Shelly plugin current version: ${version}`;
      })
      .catch(function (error) {
        console.error('Error fetching Shelly plugin current version:', error);
        document.getElementById('shelly-current').innerText = 'Error fetching Shelly plugin current version.';
      });
  }

  // Fetch and display the Shelly plugin latest version
  function fetchShellyLatest() {
    cockpit
      .spawn(['npm', 'show', 'matterbridge-shelly', 'version'])
      // cockpit.spawn(["whoami"])
      .then(function (status) {
        document.getElementById('shelly-latest').innerText = `Shelly plugin latest version: ${status.trim()}`;
      })
      .catch(function (error) {
        console.error('Error fetching Shelly plugin latest version:', error);
        document.getElementById('shelly-latest').innerText = 'Error fetching Shelly plugin latest version.';
      });
  }

  // Fetch logs
  function fetchLogs() {
    cockpit
      .spawn(['journalctl', '-u', 'matterbridge', '--no-pager', '-n', '20', '-o', 'cat'])
      .then(function (logs) {
        // const filteredLogs = logs.split('\n').filter(line => !line.includes('matterbridge.service')).join('\n');
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
  fetchStatus();
  fetchMatterbridgeCurrent();
  fetchMatterbridgeLatest();
  fetchShellyCurrent();
  fetchShellyLatest();
  fetchLogs();
});
