/**
 * This file contains the function Matterbridge Dashboard for Cockpit.
 *
 * @file matterbridge.js
 * @author Luca Liguori
 * @date 2024-10-16
 * @version 1.0.3
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

  // General IDs
  const WS_ID_LOG = 0;
  const WS_ID_REFRESH_REQUIRED = 1;
  const WS_ID_RESTART_REQUIRED = 2;

  // Local IDs
  const WS_ID_PING = 10;
  const WS_ID_SETTINGS = 11;
  const WS_ID_PLUGINS = 12;
  const WS_ID_DEVICES = 13;

  let lastSeen = Date.now();
  let restart = false;

  // Fetch and display the Matterbridge status
  function fetchStatus() {
    cockpit
      .spawn(['systemctl', 'is-active', 'matterbridge'])
      .then(function (status) {
        document.getElementById('matterbridge-status').innerText = `Service: ${status.trim().replace('\n', '')}`;
        connectToWebSocket();
      })
      .catch(function (error) {
        console.error('Error fetching Matterbridge status:', error);
        document.getElementById('matterbridge-status').innerText = 'Service: error';
      });
  }

  // Show the QR code
  function showQR(qrText) {
    console.log(`Generating QR code for ${qrText}...`);
    document.getElementById("qrtitle").innerText = 'Pairing QR Code';
    document.getElementById("qrcode").innerText = '';
    new QRCode(document.getElementById("qrcode"), {
      text: qrText,
      width: 128,
      height: 128,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });
    console.log("QR code generated successfully!");
  }

  // Show the paired fabrics instead of the QR code
  function showFabrics(fabrics) {
    console.log(`Generating ${fabrics.length} fabrics...`);
    document.getElementById("qrtitle").innerText = 'Paired fabrics';
    document.getElementById("qrcode").innerText = '';
    fabrics.forEach(fabric => {
      const fabricElement = document.createElement('div');
      fabricElement.className = 'fabric';
      fabricElement.innerHTML = `
        <p class="fabric-id">Fabric ${fabric.fabricIndex}</p>
        <p class="fabric-vendor">Vendor: ${fabric.rootVendorId} ${fabric.rootVendorName}</p>
        ${fabric.label ? `<p class="fabric-label">Label: ${fabric.label}</p>` : ''}
      `;
      document.getElementById("qrcode").appendChild(fabricElement);
    });
    console.log("Fabrics generated successfully!");
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
        } else if (message.id === WS_ID_REFRESH_REQUIRED && message.method === 'refresh_required') {
          console.log('Received refresh required message');
          ws.send(JSON.stringify({ id: WS_ID_SETTINGS, src: 'MatterbridgeCockpit', dst: 'Matterbridge', method: '/api/settings', params: {} }));
          ws.send(JSON.stringify({ id: WS_ID_PLUGINS, src: 'MatterbridgeCockpit', dst: 'Matterbridge', method: '/api/plugins', params: {} }));
          ws.send(JSON.stringify({ id: WS_ID_DEVICES, src: 'MatterbridgeCockpit', dst: 'Matterbridge', method: '/api/devices', params: {} }));
        } else if (message.id === WS_ID_RESTART_REQUIRED && message.method === 'restart_required') {
          console.log('Received restart required message');
        } else if (message.error) {
          console.error('Received error response:', message.error);
        } else if (message.id === WS_ID_PING) {
          // console.log('Received response to ping:', message.response);
        } else if (message.id === WS_ID_SETTINGS) {
          console.log('Received settings:', message.response);
          // showQR("MT:Y.K90AFN004-JZ59G00");
          if (message.response.matterbridgeInformation.matterbridgeVersion)
            document.getElementById('matterbridge-current').innerText = `Current version: ${message.response.matterbridgeInformation.matterbridgeVersion}`;
          if (message.response.matterbridgeInformation.matterbridgeLatestVersion)
            document.getElementById('matterbridge-latest').innerText = `Latest version: ${message.response.matterbridgeInformation.matterbridgeLatestVersion}`;
          if (message.response.matterbridgeInformation.matterbridgeVersion === message.response.matterbridgeInformation.matterbridgeLatestVersion) {
            document.getElementById('matterbridge-update').style.display = 'none';
          }
          if (message.response.matterbridgeInformation.matterbridgeQrPairingCode)
            showQR(message.response.matterbridgeInformation.matterbridgeQrPairingCode);
          else if (message.response.matterbridgeInformation.matterbridgeFabricInformations)
            showFabrics(message.response.matterbridgeInformation.matterbridgeFabricInformations);
        }
        else if (message.id === WS_ID_PLUGINS) {
          console.log(`Received ${message.response.length} plugins:`, message.response);
          message.response.forEach(plugin => {
            if (plugin.name === 'matterbridge-shelly') {
              if (plugin.version)
                document.getElementById('shelly-current').innerText = `Current version: ${plugin.version}`;
              if (plugin.latestVersion)
                document.getElementById('shelly-latest').innerText = `Latest version: ${plugin.latestVersion}`;
              if (plugin.version === plugin.latestVersion) {
                document.getElementById('shelly-update').style.display = 'none';
              }
            }
          });
        }
        else if (message.id === WS_ID_DEVICES) {
          console.log(`Received ${message.response.length} devices:`, message.response);
          // populateDeviceTable(message.response);
          console.log('Loading devices...');
          const tbody = document.querySelector('.div-devices table tbody');
          tbody.innerHTML = '';
          message.response.forEach(device => {
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
          console.log('Loaded devices successfully!');
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

  // Alternative to DOMContentLoaded event (https://developer.mozilla.org/en-US/docs/Web/API/Document/readyState)
  if (document.readyState === 'complete') {
    console.log('readystate:', document.readyState);
    initialize();
  } else {
    document.onreadystatechange = () => {
      console.log('onreadystatechange:', document.readyState);
      if (document.readyState === 'complete') {
        initialize();
      };
    }
  }

  function initialize() {
    // Fetch service status and connect to the WebSocket and fetch all data
    fetchStatus();

    // Add listener to open the frontend
    document.getElementById('frontend-button').addEventListener('click', function () {
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      const frontendUrl = `${protocol}//${hostname}:8283`;
      console.log(`Opening matterbridge frontend ${frontendUrl} ...`);
      window.open(frontendUrl, '_blank');
    });

    // Add listener to install matterbridge
    document.getElementById('matterbridge-update').addEventListener('click', function () {
      console.log('Updating matterbridge...');
      document.getElementById('matterbridge-current').innerText = `Updating...`;
      cockpit
        .spawn(['npm', 'install', '-g', 'matterbridge', '--omit=dev', '--omit=optional', '--no-fund', '--no-audit'])
        .then(function (logs) {
          console.log('Updated matterbridge:', logs);
          // fetchMatterbridgeCurrent();
          restart = true;
          document.getElementById('matterbridge-update').style.display = 'none';
        })
        .catch(function (error) {
          console.error('Error updating matterbridge:', error);
          document.getElementById('matterbridge-current').innerText = `Error updating...`;
        });
    });

    // Add listener to install matterbridge-shelly
    document.getElementById('shelly-update').addEventListener('click', function () {
      console.log('Updating matterbridge-shelly...');
      document.getElementById('shelly-current').innerText = `Updating...`;
      cockpit
        .spawn(['npm', 'install', '-g', 'matterbridge-shelly', '--omit=dev', '--omit=optional', '--no-fund', '--no-audit'])
        .then(function (logs) {
          console.log('Updated matterbridge-shelly:', logs);
          // fetchShellyCurrent();
          restart = true;
          document.getElementById('shelly-update').style.display = 'none';
        })
        .catch(function (error) {
          console.error('Error updating matterbridge-shelly:', error);
          document.getElementById('shelly-current').innerText = `Error updating...`;
        });
    });
  }

});
