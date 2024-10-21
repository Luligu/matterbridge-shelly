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
        document.getElementById('matterbridge-status').innerText = `Service: ${status.trim().replace('\n', '')}`;
      })
      .catch(function (error) {
        console.error('Error fetching Matterbridge status:', error);
        document.getElementById('matterbridge-status').innerText = 'Error fetching system service status.';
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
        document.getElementById('shelly-current').innerText = `Current version: ${version}`;
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
        document.getElementById('shelly-latest').innerText = `Latest version: ${status.trim()}`;
        showQR();
      })
      .catch(function (error) {
        console.error('Error fetching Shelly plugin latest version:', error);
        document.getElementById('shelly-latest').innerText = 'Error fetching Shelly plugin latest version.';
      });
  }

  // Show the QR code
  function showQR() {
    const qrText = "https://github.com/Luligu/matterbridge.git";

    // Check if the qrcode element exists
    const qrCodeElement = document.getElementById("qrcode");
    if (qrCodeElement) {
      console.log("Generating QR code...");

      // Generate the QR code and insert it into the #qrcode div
      new QRCode(qrCodeElement, {
        text: qrText,
        width: 128,  // Width of the QR code (you can adjust this)
        height: 128,  // Height of the QR code (you can adjust this)
        colorDark: "#000000",  // Dark color of the QR code
        colorLight: "#ffffff",  // Light color of the QR code (background)
        correctLevel: QRCode.CorrectLevel.H  // Error correction level
      });

      console.log("QR code generated successfully!");
    } else {
      console.error("QR code element not found!");
    }
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

  // Open the frontend
  document.getElementById('frontend-button')?.addEventListener('click', function () {
    const hostname = window.location.hostname;
    const newUrl = `http://${hostname}:8283`;
    window.open(newUrl, '_blank');
  });

  // Install matterbridge
  document.getElementById('matterbridge-update')?.addEventListener('click', function () {
    console.log('Updating matterbridge...');
    document.getElementById('matterbridge-current').innerText = `Updating...`;
    cockpit
      .spawn(['sudo', 'npm', 'install', '-g', 'matterbridge', '--omit=dev'])
      .then(function (logs) {
        console.log('Updated matterbridge:', logs);
        fetchMatterbridgeCurrent();
      })
      .catch(function (error) {
        console.error('Error updating matterbridge:', error);
        document.getElementById('matterbridge-current').innerText = `Error updating...`;
      });
  });

  // Install matterbridge-shelly
  document.getElementById('shelly-update')?.addEventListener('click', function () {
    console.log('Updating matterbridge-shelly...');
    document.getElementById('shelly-current').innerText = `Updating...`;
    cockpit
      .spawn(['sudo', 'npm', 'install', '-g', 'matterbridge-shelly', '--omit=dev'])
      .then(function (logs) {
        console.log('Updated matterbridge-shelly:', logs);
        fetchShellyCurrent();
      })
      .catch(function (error) {
        console.error('Error updating matterbridge-shelly:', error);
        document.getElementById('shelly-current').innerText = `Error updating...`;
      });
  });

  // Initial fetch of status and logs
  fetchStatus();
  fetchMatterbridgeCurrent();
  fetchMatterbridgeLatest();
  fetchShellyCurrent();
  fetchShellyLatest();
  // fetchLogs();

});
