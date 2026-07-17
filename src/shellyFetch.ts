/**
 * @file src/shellyFetch.ts
 * @description This file contains the shellyFetch function to fetch data from a Shelly device.
 * @author Luca Liguori
 * @created 2026-07-05
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2026 Luca Liguori.
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
 * limitations under the License.
 */

/* oxlint-disable typescript/no-unsafe-type-assertion */

import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';

import { type AnsiLogger, BLUE, CYAN, GREY, RESET } from 'matterbridge/logger';
import { getErrorMessage } from 'matterbridge/utils';

import { createBasicShellyAuth, createDigestShellyAuth, getGen1BodyOptions, getGen2BodyOptions, parseBasicAuthenticateHeader, parseDigestAuthenticateHeader } from './auth.js';
import type { Shelly } from './shelly.js';
import type { ShellyData } from './shellyTypes.js';

/**
 * Fetches device data from the specified host and service.
 * If the host ends with '.json', it fetches the device data from a file.
 * Otherwise, it makes an HTTP request to the specified host and service.
 * Supports both Gen 1 and Gen 2+ devices.
 * Handles authentication for Gen 1 devices using Basic Auth and for Gen 2+ devices using Digest Auth.
 * Features the AbortController to handle request timeouts. The request will be aborted after 20 seconds if no response is received.
 *
 * @param {Shelly} shelly - The Shelly instance.
 * @param {AnsiLogger} log - The logger instance.
 * @param {string} host - The host to fetch the data from. It can be an IP address or the cache JSON file path.
 * @param {string} service - The service to fetch the data from.
 * @param {Record<string, string | number | boolean>} params - Additional parameters for the request (default: {}).
 * @returns {Promise<ShellyData | null>} A promise that resolves to the fetched device data or null if an error occurs.
 */
export async function shellyFetch(
  shelly: Shelly,
  log: AnsiLogger,
  host: string,
  service: string,
  params: Record<string, string | number | boolean | object> = {},
): Promise<ShellyData | null> {
  // Fetch device data from cache file if host is a json file
  if (host.endsWith('.json')) {
    log.debug(`Fetching device payloads from file ${host}: service ${service} params ${JSON.stringify(params)}`);
    try {
      let data = await fs.readFile(host, 'utf8');
      const deviceData = JSON.parse(data);
      data = '';
      if (service === 'shelly') return deviceData.shelly;
      if (service === 'status') return deviceData.status;
      if (service === 'settings') return deviceData.settings;
      if (service === 'Shelly.GetStatus') return deviceData.status;
      if (service === 'Shelly.GetConfig') return deviceData.settings;
      if (service === 'Shelly.GetComponents') return deviceData;
      log.error(`Error fetching device payloads from file ${host}: no service ${service} found`);
      return null;
    } catch (error) {
      log.error(`Error reading device payloads from file ${host}:`, getErrorMessage(error));
      return null;
    }
  }

  const controller = new AbortController();
  const fetchTimeout = setTimeout(() => {
    controller.abort();
    log.debug(`***Aborting fetch device ${host}: service ${service} params ${JSON.stringify(params)}`);
  }, 20000);

  const gen = /^[^A-Z]*$/.test(service) ? 1 : 2;
  const url = gen === 1 ? `http://${host}/${service}` : `http://${host}/rpc`;
  try {
    const options: RequestInit = {
      method: 'POST',
      headers: gen === 1 ? { 'Content-Type': 'application/x-www-form-urlencoded' } : { 'Content-Type': 'application/json' },
      body: gen === 1 ? getGen1BodyOptions(params) : getGen2BodyOptions('2.0', 10, 'Matterbridge', service, params),
      signal: controller.signal,
    };
    const headers = options.headers as Record<string, string>;
    log.debug(
      `${GREY}Fetching shelly gen ${CYAN}${gen}${GREY} host ${CYAN}${host}${GREY} service ${CYAN}${service}${GREY}` +
        `${params ? ` with ${CYAN}` + JSON.stringify(params) + GREY : ''} url ${BLUE}${url}${RESET}`,
    );
    log.debug(`${GREY}options: ${JSON.stringify(options)}${RESET}`);
    let response;
    if (service === 'shelly') response = await fetch(`http://${host}/${service}`, { signal: controller.signal });
    else response = await fetch(url, options);
    clearTimeout(fetchTimeout);
    log.debug(`${GREY}response ok: ${response.ok}${RESET}`);
    if (!response.ok) {
      // Try with authentication
      if (response.status === 401) {
        const authHeader = response.headers.get('www-authenticate');
        log.debug(`${GREY}authHeader: ${authHeader}${RESET}`);
        /* v8 ignore next if */
        if (authHeader === null) throw new Error('No www-authenticate header found');
        if (shelly.username === undefined || shelly.username === '') log.error(`Device at host ${host} requires authentication but no username has been provided in the config`);
        if (shelly.password === undefined || shelly.password === '') log.error(`Device at host ${host} requires authentication but no password has been provided in the config`);
        if (authHeader.startsWith('Basic')) {
          // Gen 1 devices require basic authentication
          const authParams = parseBasicAuthenticateHeader(authHeader); // Get nonce and realm
          log.debug(`${GREY}authparams: ${JSON.stringify(authParams)}${RESET}`);
          /* v8 ignore next if */
          if (!authParams.realm) throw new Error('No authenticate realm parameter found in header');
          const auth = createBasicShellyAuth(shelly.username ?? '', shelly.password ?? '');
          headers.Authorization = `Basic ${auth}`;
        } else if (authHeader.startsWith('Digest')) {
          // Gen 2 and 3 devices require digest authentication
          const authParams = parseDigestAuthenticateHeader(authHeader); // Get nonce and realm
          log.debug(`${GREY}authparams: ${JSON.stringify(authParams)}${RESET}`);
          /* v8 ignore next if */
          if (!authParams.nonce) throw new Error('No authenticate nonce parameter found in header');
          /* v8 ignore next if */
          if (!authParams.realm) throw new Error('No authenticate realm parameter found in header');
          const nonce = /^\d+$/.test(authParams.nonce) ? Number.parseInt(authParams.nonce) : authParams.nonce;
          const auth = createDigestShellyAuth('admin', shelly.password ?? '', nonce, crypto.randomInt(0, 999999999), authParams.realm);
          options.body = getGen2BodyOptions('2.0', 10, 'Matterbridge', service, params, auth);
        }
        log.debug(`${GREY}options: ${JSON.stringify(options)}${RESET}`);
        response = await fetch(url, options);
        log.debug(`${GREY}response ok: ${response.ok}${RESET}`);
        if (response.ok) {
          const data = await response.json();
          const reponse = gen === 1 ? data : (data as ShellyData).result;
          // console.log(`${GREY}Response from shelly gen ${CYAN}${gen}${GREY} host ${CYAN}${host}${GREY} service ${CYAN}${service}${GREY}:${RESET}`, reponse);
          return reponse as ShellyData;
        }
      }
      log.error(
        `Response error fetching shelly gen ${gen} host ${host} service ${service}${params ? ' with ' + JSON.stringify(params) : ''} url ${url}:` +
          ` ${response.status} (${response.statusText})`,
      );
      clearTimeout(fetchTimeout);
      return null;
    }
    const data = await response.json();
    const reponse = gen === 1 ? data : (data as ShellyData).result;
    // console.log(`${GREY}Response from shelly gen ${CYAN}${gen}${GREY} host ${CYAN}${host}${GREY} service ${CYAN}${service}${GREY}:${RESET}`, reponse);
    return reponse as ShellyData;
  } catch (error) {
    log.debug(`Error fetching shelly gen ${gen} host ${host} service ${service}${params ? ' with ' + JSON.stringify(params) : ''} url ${url} error: ${getErrorMessage(error)}`);
    clearTimeout(fetchTimeout);
    return null;
  }
}
