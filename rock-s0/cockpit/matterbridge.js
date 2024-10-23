/* eslint-disable no-control-regex */
/* eslint-disable no-console */
// Wait for Cockpit to fully initialize
cockpit.transport.wait(function () {
  console.log('Matterbridge Cockpit extension loaded');

  var lastSeen = 0;
  var restart = false;
  var matterbridgeCurrent = '';
  var matterbridgeLatest = '';
  var shellyCurrent = '';
  var shellyLatest = '';

  // Fetch and display the Matterbridge status
  function fetchStatus() {
    cockpit
      .spawn(['systemctl', '--user', 'is-active', 'matterbridge'])
      .then(function (status) {
        document.getElementById('matterbridge-status').innerText = `Service: ${status.trim().replace('\n', '')}`;
        connectToWebSocket();
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
        matterbridgeCurrent = version;
        document.getElementById('matterbridge-current').innerText = `Current version: ${version}`;
        if (matterbridgeCurrent === matterbridgeLatest) {
          document.getElementById('matterbridge-update').style.display = 'none';
        }
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
        matterbridgeLatest = status.trim();
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
        shellyCurrent = version;
        document.getElementById('shelly-current').innerText = `Current version: ${version}`;
        if (shellyCurrent === shellyLatest) {
          document.getElementById('shelly-update').style.display = 'none';
        }
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
        shellyLatest = status.trim();
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
    const qrText = "MT:Y.K90AFN004-JZ59G00";

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

  // Function to connect to Matterbridge WebSocket API
  function connectToWebSocket() {
    const hostname = window.location.hostname;
    const ws = new WebSocket(`wss://shelly:8283`);

    setInterval(() => {
      const elapsedSeconds = Math.round((Date.now() - lastSeen) / 1000);
      console.log(`Elapsed seconds: ${elapsedSeconds}`);
      if (elapsedSeconds < 10)
        document.getElementById('matterbridge-lastseen').innerText = `Last seen: now`;
      else if (elapsedSeconds < 60)
        document.getElementById('matterbridge-lastseen').innerText = `Last seen: ${elapsedSeconds} seconds ago`;
      else
        document.getElementById('matterbridge-lastseen').innerText = `Last seen: ${Math.round(elapsedSeconds / 60)} minute(s) ago`;
    }, 10000);

    ws.onopen = function () {
      console.log('Connected to Matterbridge WebSocket API');
      document.getElementById('matterbridge-websocket').innerText = `Websocket: connected`;
      document.getElementById('matterbridge-lastseen').innerText = `Last seen: now`;
    };

    ws.onmessage = function (event) {
      const message = event.data;
      console.log('Received message:'/*, message*/);
      lastSeen = Date.now();
    };

    ws.onerror = function (error) {
      console.error('WebSocket error:', error);
      document.getElementById('matterbridge-websocket').innerText = `Websocket: error`;
    };

    ws.onclose = function () {
      console.log('WebSocket connection closed');
      document.getElementById('matterbridge-websocket').innerText = `Websocket: connection closed`;
    };
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
    console.log('Opening matterbridge frontend...');
    const hostname = window.location.hostname;
    const newUrl = `https://${hostname}:8283`;
    window.open(newUrl, '_blank');
  });

  // Install matterbridge
  document.getElementById('matterbridge-update')?.addEventListener('click', function () {
    console.log('Updating matterbridge...');
    document.getElementById('matterbridge-current').innerText = `Updating...`;
    cockpit
      .spawn(['npm', 'install', '-g', 'matterbridge', '--omit=dev'])
      .then(function (logs) {
        console.log('Updated matterbridge:', logs);
        fetchMatterbridgeCurrent();
        restart = true;
        document.getElementById('matterbridge-update').style.display = 'none';
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
      .spawn(['npm', 'install', '-g', 'matterbridge-shelly', '--omit=dev'])
      .then(function (logs) {
        console.log('Updated matterbridge-shelly:', logs);
        fetchShellyCurrent();
        restart = true;
        document.getElementById('shelly-update').style.display = 'none';
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
