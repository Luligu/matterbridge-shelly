/**
 * @file src/shellyUtils.ts
 * @description This file contains utility functions for Shelly devices.
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

/**
 * Normalizes the given hostname to extract the type, MAC address, and ID.
 *
 * @param {string} hostname - The hostname to normalize.
 * @returns {{ type: string; mac: string; id: string }} An object containing the normalized type, MAC address, and ID.
 */
export function normalizeId(hostname: string): { type: string; mac: string; id: string } {
  const parts = hostname.split('-');
  if (parts.length < 2) return { type: '', mac: '', id: hostname };
  const mac = parts.pop(); // Extract the MAC address (last part)
  if (!mac) return { type: '', mac: '', id: hostname };
  const name = parts.join('-'); // Join the remaining parts to form the device name
  return { type: name.toLowerCase(), mac: mac.toUpperCase(), id: name.toLowerCase() + '-' + mac.toUpperCase() };
}
