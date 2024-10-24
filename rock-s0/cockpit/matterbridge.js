/**
 * This file contains the function Matterbridge Dashboard for Cockpit.
 *
 * @file matterbridge.js
 * @author Luca Liguori
 * @date 2024-10-16
 * @version 1.0.1
 *
 * Copyright 2024, 2025, 2026 Luca Liguori.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License. *
 */

/* eslint-disable no-control-regex */
/* eslint-disable no-console */

// Wait for Cockpit to fully initialize
cockpit.transport.wait(function () {
  console.log('Matterbridge Cockpit extension loaded');

  const WS_ID_LOG = 0;
  const WS_ID_PING = 1;
  const WS_ID_SETTINGS = 2;
  const WS_ID_PLUGINS = 3;
  const WS_ID_DEVICES = 4;

  let lastSeen = Date.now();
  let restart = false;
  let matterbridgeCurrent = '';
  let matterbridgeLatest = '';
  let shellyCurrent = '';
  let shellyLatest = '';

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
        document.getElementById('matterbridge-status').innerText = 'Service: error';
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
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const hostname = window.location.hostname;
    console.log(`Connecting to Matterbridge WebSocket API at ${protocol}://${hostname}:8283 ...`);
    const ws = new WebSocket(`${protocol}://${hostname}:8283`);

    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ id: WS_ID_PING, src: 'MatterbridgeCockpit', dst: 'Matterbridge', method: 'ping', params: {} }));
        // console.log('Sent ping to Matterbridge');
      }

      const elapsedSeconds = Math.round((Date.now() - lastSeen) / 1000);
      // console.log(`Elapsed seconds: ${elapsedSeconds}`);
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
      ws.send(JSON.stringify({ id: WS_ID_PING, src: 'MatterbridgeCockpit', dst: 'Matterbridge', method: 'ping', params: {} }));
      ws.send(JSON.stringify({ id: WS_ID_SETTINGS, src: 'MatterbridgeCockpit', dst: 'Matterbridge', method: '/api/settings', params: {} }));
      ws.send(JSON.stringify({ id: WS_ID_PLUGINS, src: 'MatterbridgeCockpit', dst: 'Matterbridge', method: '/api/plugins', params: {} }));
      ws.send(JSON.stringify({ id: WS_ID_DEVICES, src: 'MatterbridgeCockpit', dst: 'Matterbridge', method: '/api/devices', params: {} }));
    };

    ws.onmessage = function (event) {
      try {
        const message = JSON.parse(event.data);
        // console.log('Received message', message);
        if (message.id === undefined || message.src !== 'Matterbridge') return;
        if (message.id === WS_ID_LOG) {
          // console.log('Received log message');
        } else if (message.error) {
          console.error('Received error response:', message.error);
        } else if (message.id === WS_ID_PING) {
          // console.log('Received response to ping:', message.response);
        } else if (message.id === WS_ID_SETTINGS) {
          console.log('Received settings:', message.response);
        }
        else if (message.id === WS_ID_PLUGINS) {
          console.log(`Received ${message.response.length} plugins:`, message.response);
        }
        else if (message.id === WS_ID_DEVICES) {
          console.log(`Received ${message.response.length} devices:`, message.response);
          populateDeviceTable(message.response);
        }
        lastSeen = Date.now();
      }
      catch (error) {
        console.error('Error parsing JSON:', error);
      }
    };

    ws.onerror = function (error) {
      console.error('WebSocket error:', error);
      document.getElementById('matterbridge-websocket').innerText = `Websocket: error`;
      document.getElementById('matterbridge-status').innerText = 'Service: unknown';
    };

    ws.onclose = function () {
      console.log('WebSocket connection closed');
      document.getElementById('matterbridge-websocket').innerText = `Websocket: connection closed`;
      document.getElementById('matterbridge-status').innerText = 'Service: unknown';
    };
  }

  // Function to populate the device information table
  function populateDeviceTable(devices) {
    console.log('Loading devices...');
    const tbody = document.querySelector('.div-devices table tbody');
    devices.forEach(device => {
      const row = document.createElement('tr');
      row.innerHTML = `
          <td>${device.pluginName}</td>
          <td>${device.type}</td>
          <td>${device.endpoint}</td>
          <td>${device.name}</td>
          <td>${device.serial}</td>
          <td>${device.cluster}</td>
      `;
      tbody.appendChild(row);
    });
  }

  // Fetch logs
  function fetchLogs() {
    cockpit
      .spawn(['journalctl', '-u', 'matterbridge', '--no-pager', '-n', '100', '-o', 'cat'])
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

  // Fetch all data
  fetchStatus();
  fetchMatterbridgeCurrent();
  fetchMatterbridgeLatest();
  fetchShellyCurrent();
  fetchShellyLatest();
  // fetchLogs();

  // Add listener to open the frontend
  document.getElementById('frontend-button')?.addEventListener('click', function () {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const frontendUrl = `${protocol}//${hostname}:8283`;
    console.log(`Opening matterbridge frontend ${frontendUrl} ...`);
    window.open(frontendUrl, '_blank');
  });

  // Add listener to install matterbridge
  document.getElementById('matterbridge-update')?.addEventListener('click', function () {
    console.log('Updating matterbridge...');
    document.getElementById('matterbridge-current').innerText = `Updating...`;
    cockpit
      .spawn(['npm', 'install', '-g', 'matterbridge', '--omit=dev', '--omit=optional', '--no-fund', '--no-audit'])
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

  // Add listener to install matterbridge-shelly
  document.getElementById('shelly-update')?.addEventListener('click', function () {
    console.log('Updating matterbridge-shelly...');
    document.getElementById('shelly-current').innerText = `Updating...`;
    cockpit
      .spawn(['npm', 'install', '-g', 'matterbridge-shelly', '--omit=dev', '--omit=optional', '--no-fund', '--no-audit'])
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
});
