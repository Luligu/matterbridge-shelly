/**
 * @file src/shellyComponent.ts
 * @description This file contains the class SwitchComponent.
 * @author Luca Liguori
 * @created 2024-05-01
 * @version 2.2.9
 * @license Apache-2.0
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
 * limitations under the License.
 */

import EventEmitter from 'node:events';

import { BLUE, CYAN, db, debugStringify, er, GREEN, GREY, YELLOW } from 'matterbridge/logger';
import { deepEqual, isValidArray, isValidNumber, isValidObject } from 'matterbridge/utils';

import type { ShellyDevice } from './shellyDevice.js';
import { shellyFetch } from './shellyFetch.js';
import { ShellyProperty } from './shellyProperty.js';
import type { ShellyData, ShellyDataType, ShellyEvent } from './shellyTypes.js';

/** Light control methods for supported Shelly light components. */
interface LightComponent {
  /**
   * Turns the light on.
   *
   * @returns {void} Dispatches the request without waiting for a response.
   */
  On(): void;
  /**
   * Turns the light off.
   *
   * @returns {void} Dispatches the request without waiting for a response.
   */
  Off(): void;
  /**
   * Toggles the light state.
   *
   * @returns {void} Dispatches the request without waiting for a response.
   */
  Toggle(): void;
  /**
   * Sets brightness when the component supports it.
   *
   * @param {number} level - Brightness percentage, rounded and clamped to 0–100.
   * @returns {void} Dispatches the request without waiting for a response.
   */
  Level(level: number): void;
  /**
   * Sets the RGB color when the component supports it.
   *
   * @param {number} red - Red channel, rounded and clamped to 0–255.
   * @param {number} green - Green channel, rounded and clamped to 0–255.
   * @param {number} blue - Blue channel, rounded and clamped to 0–255.
   * @returns {void} Dispatches the request without waiting for a response.
   */
  ColorRGB(red: number, green: number, blue: number): void;
  /**
   * Sets color temperature when the component supports it.
   *
   * @param {number} temperature - Color temperature in kelvin; values outside 2700–6500 are ignored.
   * @returns {void} Dispatches the request without waiting for a response.
   */
  ColorTemp(temperature: number): void;
}

/** A Shelly light component with power, brightness, and color control methods. */
export type ShellyLightComponent = ShellyComponent & LightComponent;

/** On/off control methods for Shelly switch and relay components. */
interface SwitchComponent {
  /**
   * Turns the switch or relay on.
   *
   * @returns {void} Dispatches the request without waiting for a response.
   */
  On(): void;
  /**
   * Turns the switch or relay off.
   *
   * @returns {void} Dispatches the request without waiting for a response.
   */
  Off(): void;
  /**
   * Toggles the switch or relay state.
   *
   * @returns {void} Dispatches the request without waiting for a response.
   */
  Toggle(): void;
}

/** A Shelly switch or relay component with on/off control methods. */
export type ShellySwitchComponent = ShellyComponent & SwitchComponent;

/** Movement control methods for Shelly cover and roller components. */
interface CoverComponent {
  /**
   * Opens the cover or roller.
   *
   * @returns {void} Dispatches the request without waiting for a response.
   */
  Open(): void;
  /**
   * Closes the cover or roller.
   *
   * @returns {void} Dispatches the request without waiting for a response.
   */
  Close(): void;
  /**
   * Stops cover or roller movement.
   *
   * @returns {void} Dispatches the request without waiting for a response.
   */
  Stop(): void;
  /**
   * Moves the cover or roller to the requested position.
   *
   * @param {number} pos - Open percentage, rounded and clamped to 0–100 (0 closed, 100 open).
   * @returns {void} Dispatches the request without waiting for a response.
   */
  GoToPosition(pos: number): void;
}

/** A Shelly cover or roller component with movement and position control methods. */
export type ShellyCoverComponent = ShellyComponent & CoverComponent;

/** Cloud configuration, with Gen 1 enablement normalized and its server set to null. */
export interface CloudConfig {
  enable: boolean;
  server: string | null;
}

/** Cloud connection status returned by the device. */
export interface CloudStatus {
  connected: boolean;
}

/** RPC over UDP configuration for Gen 2+ devices. */
export interface SysRpcUdpConfig {
  dst_addr: string | null;
  listen_port: number | null;
}

/** Supported system configuration for Gen 2+ devices. */
export interface SysConfig {
  rpc_udp: SysRpcUdpConfig;
}

/** Supported system status for all device generations. */
export interface SysStatus {
  mac: string;
  /** Undefined on Gen 1, which does not report whether a restart is required. */
  restart_required: boolean | undefined;
  /** Local time, null when unsynchronized, or undefined when not reported. */
  time: string | null | undefined;
  /** Seconds since the device booted. */
  uptime: number;
  /** Configuration revision, undefined on Gen 1. */
  cfg_rev: number | undefined;
}

interface SysComponent {
  /**
   * Updates only the RPC over UDP settings.
   *
   * @param {{ rpc_udp: Partial<SysRpcUdpConfig> }} config - UDP settings to update; omitted fields remain unchanged.
   * @returns {Promise<ShellyData | null>} The device response, or null on failure or Gen 1.
   */
  SetConfig(config: { rpc_udp: Partial<SysRpcUdpConfig> }): Promise<ShellyData | null>;
  /**
   * Retrieves only the RPC over UDP settings.
   *
   * @returns {Promise<SysConfig | null>} UDP configuration, or null on failure, invalid data, or Gen 1.
   */
  GetConfig(): Promise<SysConfig | null>;
  /**
   * Retrieves system status; the API provides no separate RPC over UDP status.
   *
   * @returns {Promise<SysStatus | null>} System status, or null on failure or invalid data.
   */
  GetStatus(): Promise<SysStatus | null>;
}

/** A Sys component with system status and Gen 2+ UDP configuration methods. */
export type ShellySysComponent = ShellyComponent & SysComponent;

/** Outbound WebSocket configuration for Gen 2+ devices. */
export interface WsConfig {
  enable: boolean;
  /** Null when unset, or undefined when omitted by the device. */
  server: string | null | undefined;
  ssl_ca: '*' | 'user_ca.pem' | 'ca.pem';
}

/** Outbound WebSocket connection status. */
export interface WsStatus {
  connected: boolean;
}

interface WsComponent {
  /**
   * Updates the supplied outbound WebSocket settings.
   *
   * @param {Partial<WsConfig>} config - Settings to update; omitted fields remain unchanged.
   * @returns {Promise<ShellyData | null>} The device response, or null on failure.
   */
  SetConfig(config: Partial<WsConfig>): Promise<ShellyData | null>;
  /**
   * Retrieves the outbound WebSocket configuration.
   *
   * @returns {Promise<WsConfig | null>} Configuration, or null on failure or invalid data.
   */
  GetConfig(): Promise<WsConfig | null>;
  /**
   * Retrieves the outbound WebSocket status.
   *
   * @returns {Promise<WsStatus | null>} Connection status, or null on failure or invalid data.
   */
  GetStatus(): Promise<WsStatus | null>;
}

/** A Gen 2+ Ws component with configuration and status methods. */
export type ShellyWsComponent = ShellyComponent & WsComponent;

/** Native Matter protocol configuration. */
export interface MatterConfig {
  enable: boolean;
}

/** Native Matter commissioning status. */
export interface MatterStatus {
  num_fabrics: number;
  commissionable: boolean;
}

/** Native Matter pairing codes, preserved as strings. */
export interface MatterSetupCode {
  qr_code: string;
  manual_code: string;
}

interface MatterComponent {
  /**
   * Updates native Matter enablement.
   *
   * @param {MatterConfig} config - Whether to enable native Matter.
   * @returns {Promise<ShellyData | null>} The device response, or null on failure.
   */
  SetConfig(config: MatterConfig): Promise<ShellyData | null>;
  /**
   * Retrieves native Matter configuration.
   *
   * @returns {Promise<MatterConfig | null>} Configuration, or null on failure or invalid data.
   */
  GetConfig(): Promise<MatterConfig | null>;
  /**
   * Retrieves native Matter commissioning status.
   *
   * @returns {Promise<MatterStatus | null>} Status, or null on failure or invalid data.
   */
  GetStatus(): Promise<MatterStatus | null>;
  /**
   * Retrieves native Matter pairing codes.
   *
   * @returns {Promise<MatterSetupCode | null>} Pairing codes, or null on failure or invalid data.
   */
  GetSetupCode(): Promise<MatterSetupCode | null>;
  /**
   * Erases native Matter data and fabrics and reboots the device.
   *
   * @returns {Promise<null>} Null on success or fetch failure; the fetch layer does not distinguish these outcomes.
   */
  FactoryReset(): Promise<null>;
}

/** A native Matter component with configuration, status, pairing, and reset methods. */
export type ShellyMatterComponent = ShellyComponent & MatterComponent;

/** WiFi access point configuration returned by the device. */
export interface WifiApConfig {
  ssid?: string | null;
  is_open: boolean;
  enable: boolean;
  range_extender?: { enable: boolean };
}

/** WiFi station configuration returned by the device. */
export interface WifiStaConfig {
  ssid: string | null;
  is_open: boolean;
  enable: boolean;
  ipv4mode: 'dhcp' | 'static';
  ip: string | null;
  netmask: string | null;
  gw: string | null;
  nameserver: string | null;
}

/** Gen 2+ WiFi configuration; some devices expose only the primary station. */
export interface WifiConfig {
  ap?: WifiApConfig;
  sta: WifiStaConfig;
  sta1?: WifiStaConfig;
  roam?: { rssi_thr: number; interval: number };
}

/** Writable WiFi configuration; passwords are write-only and is_open is read-only. */
export interface WifiSetConfig {
  ap?: Partial<Omit<WifiApConfig, 'is_open'>> & { pass?: string | null };
  /** Include pass when setting a password-protected SSID. */
  sta?: Partial<Omit<WifiStaConfig, 'is_open'>> & { pass?: string | null };
  sta1?: Partial<Omit<WifiStaConfig, 'is_open'>> & { pass?: string | null };
  roam?: Partial<NonNullable<WifiConfig['roam']>>;
}

/** Gen 2+ WiFi connection status, including optional firmware-specific fields. */
export interface WifiStatus {
  sta_ip: string | null;
  status: 'disconnected' | 'connecting' | 'connected' | 'got ip';
  ssid: string | null;
  rssi: number;
  bssid?: string;
  channel?: number;
  ap_client_count?: number;
  sta_ip6?: string[];
  mac?: string;
  netmask?: string | null;
  gw?: string | null;
  nameserver?: string | null;
}

/** A WiFi access point discovered by a scan. */
export interface WifiScanResult {
  ssid: string | null;
  bssid: string;
  auth: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  channel: number;
  rssi: number;
}

/** Response from Wifi.Scan. */
export interface WifiScanResponse {
  results: WifiScanResult[];
}

/** A client connected to the device access point. */
export interface WifiAPClient {
  mac: string;
  ip: string;
  ip_static: boolean;
  /** Port on the extender forwarded to the client's HTTP port, or zero when unavailable. */
  mport: number;
  since: number;
}

/** Response from Wifi.ListAPClients. */
export interface WifiAPClients {
  ts: number | null;
  ap_clients: WifiAPClient[];
}

interface WifiComponent {
  /**
   * Retrieves device-wide WiFi configuration.
   *
   * @returns {Promise<WifiConfig | null>} Configuration, or null on failure or invalid data.
   */
  GetConfig(): Promise<WifiConfig | null>;
  /**
   * Updates supplied WiFi settings; station changes may disconnect the device.
   *
   * @param {WifiSetConfig} config - Partial configuration, including pass for a password-protected SSID.
   * @returns {Promise<ShellyData | null>} Device response, or null on failure.
   */
  SetConfig(config: WifiSetConfig): Promise<ShellyData | null>;
  /**
   * Retrieves device-wide WiFi status.
   *
   * @returns {Promise<WifiStatus | null>} Status, or null on failure or invalid data.
   */
  GetStatus(): Promise<WifiStatus | null>;
  /**
   * Scans for nearby access points.
   *
   * @returns {Promise<WifiScanResponse | null>} Scan results, or null on failure or invalid data.
   */
  Scan(): Promise<WifiScanResponse | null>;
  /**
   * Lists AP clients when the device supports and enables AP and range extension.
   *
   * @returns {Promise<WifiAPClients | null>} Client list, or null on failure or invalid data.
   */
  ListAPClients(): Promise<WifiAPClients | null>;
}

/** A Gen 2+ WiFi component exposing device-wide WiFi RPC methods. */
export type ShellyWifiComponent = ShellyComponent & WifiComponent;

interface CloudComponent {
  /**
   * Sets the cloud configuration.
   *
   * @param {{ enable: boolean }} config - Whether to enable the cloud connection.
   * @returns {Promise<ShellyData | null>} The device response, or null on failure.
   */
  SetConfig(config: { enable: boolean }): Promise<ShellyData | null>;
  /**
   * Retrieves the cloud configuration.
   *
   * @returns {Promise<CloudConfig | null>} The normalized cloud configuration, or null on failure or invalid data.
   */
  GetConfig(): Promise<CloudConfig | null>;
  /**
   * Retrieves the cloud connection status.
   *
   * @returns {Promise<CloudStatus | null>} The cloud status, or null on failure or invalid data.
   */
  GetStatus(): Promise<CloudStatus | null>;
}

/** A Shelly Cloud component with cloud configuration and status methods. */
export type ShellyCloudComponent = ShellyComponent & CloudComponent;

/**
 *  Checks if the given component is a light component.
 *
 * @param {ShellyComponent | undefined} component - The component to check.
 * @returns {component is ShellyLightComponent} Returns true if the component is a light component, false otherwise.
 */
export function isLightComponent(component: ShellyComponent | undefined): component is ShellyLightComponent {
  if (component === undefined) return false;
  return ['Light', 'Rgb', 'Rgbw', 'Cct'].includes(component.name);
}

/**
 * Checks if the given component is a switch component.
 *
 * @param {ShellyComponent | undefined} component - The component to check.
 * @returns {component is ShellySwitchComponent} Returns true if the component is a switch component, false otherwise.
 */
export function isSwitchComponent(component: ShellyComponent | undefined): component is ShellySwitchComponent {
  if (component === undefined) return false;
  return ['Relay', 'Switch'].includes(component.name);
}

/**
 * Checks if the given component is a cover component.
 *
 * @param {ShellyComponent | undefined} component - The component to check.
 * @returns {component is ShellyCoverComponent} Returns true if the component is a cover component, false otherwise.
 */
export function isCoverComponent(component: ShellyComponent | undefined): component is ShellyCoverComponent {
  if (component === undefined) return false;
  return ['Cover', 'Roller'].includes(component.name);
}

/**
 * Checks if the given component is a cloud component.
 *
 * @param {ShellyComponent | undefined} component - The component to check.
 * @returns {component is ShellyCloudComponent} True if the component is a cloud component.
 */
export function isCloudComponent(component: ShellyComponent | undefined): component is ShellyCloudComponent {
  return component?.name === 'Cloud';
}

/**
 * Checks if the component is a system component.
 *
 * @param {ShellyComponent | undefined} component - The component to check.
 * @returns {component is ShellySysComponent} True for Sys components.
 */
export function isSysComponent(component: ShellyComponent | undefined): component is ShellySysComponent {
  return component?.name === 'Sys';
}

/**
 * Checks if the component supports outbound WebSocket RPC methods.
 *
 * @param {ShellyComponent | undefined} component - The component to check.
 * @returns {component is ShellyWsComponent} True for Gen 2+ Ws components.
 */
export function isWsComponent(component: ShellyComponent | undefined): component is ShellyWsComponent {
  return component?.name === 'Ws' && component.device.gen >= 2;
}

/**
 * Checks if the component supports native Matter RPC methods.
 *
 * @param {ShellyComponent | undefined} component - The component to check.
 * @returns {component is ShellyMatterComponent} True for Gen 2+ Matter components.
 */
export function isMatterComponent(component: ShellyComponent | undefined): component is ShellyMatterComponent {
  return component?.name === 'Matter' && component.device.gen >= 2;
}

/**
 * Checks whether a component supports Gen 2+ WiFi RPC methods.
 *
 * @param {ShellyComponent | undefined} component - The component to check.
 * @returns {component is ShellyWifiComponent} True for Gen 2+ WiFi components.
 */
export function isWifiComponent(component: ShellyComponent | undefined): component is ShellyWifiComponent {
  return component?.name === 'WiFi' && component.device.gen >= 2;
}

/**
 * Validates a nullable string from a WiFi response.
 *
 * @param {unknown} value - Value to check.
 * @returns {boolean} True for strings or null.
 */
function isWifiString(value: unknown): boolean {
  return value === null || typeof value === 'string';
}

/**
 * Narrows a WiFi response object for property validation.
 *
 * @param {unknown} value - Value to check.
 * @returns {value is Record<string, unknown>} True for objects.
 */
function isWifiObject(value: unknown): value is Record<string, unknown> {
  return isValidObject(value);
}

/**
 * Validates a station configuration.
 *
 * @param {unknown} value - Station response.
 * @returns {value is WifiStaConfig} True for a valid station configuration.
 */
function isWifiStaConfig(value: unknown): value is WifiStaConfig {
  return (
    isWifiObject(value) &&
    typeof value.enable === 'boolean' &&
    typeof value.is_open === 'boolean' &&
    (value.ipv4mode === 'dhcp' || value.ipv4mode === 'static') &&
    ['ssid', 'ip', 'netmask', 'gw', 'nameserver'].every((key) => isWifiString(value[key]))
  );
}

/**
 * Validates WiFi configuration including optional AP, fallback station, and roaming.
 *
 * @param {unknown} value - Configuration response.
 * @returns {value is WifiConfig} True for valid configuration.
 */
function isWifiConfig(value: unknown): value is WifiConfig {
  if (!isWifiObject(value) || !isWifiStaConfig(value.sta)) return false;
  if (value.sta1 !== undefined && !isWifiStaConfig(value.sta1)) return false;
  if (value.ap !== undefined) {
    const ap = value.ap;
    if (!isWifiObject(ap) || typeof ap.enable !== 'boolean' || typeof ap.is_open !== 'boolean') return false;
    if (ap.ssid !== undefined && !isWifiString(ap.ssid)) return false;
    if (ap.range_extender !== undefined && (!isWifiObject(ap.range_extender) || typeof ap.range_extender.enable !== 'boolean')) return false;
  }
  return value.roam === undefined || (isWifiObject(value.roam) && isValidNumber(value.roam.rssi_thr) && isValidNumber(value.roam.interval));
}

/**
 * Validates a WiFi status response, allowing fields absent on older firmware.
 *
 * @param {unknown} value - Status response.
 * @returns {value is WifiStatus} True for valid status.
 */
function isWifiStatus(value: unknown): value is WifiStatus {
  if (!isWifiObject(value) || !isWifiString(value.sta_ip) || !isWifiString(value.ssid) || !isValidNumber(value.rssi)) return false;
  if (typeof value.status !== 'string' || !['disconnected', 'connecting', 'connected', 'got ip'].includes(value.status)) return false;
  if (!['bssid', 'mac'].every((key) => value[key] === undefined || typeof value[key] === 'string')) return false;
  if (!['channel', 'ap_client_count'].every((key) => value[key] === undefined || isValidNumber(value[key], 0))) return false;
  if (!['netmask', 'gw', 'nameserver'].every((key) => value[key] === undefined || isWifiString(value[key]))) return false;
  return value.sta_ip6 === undefined || (Array.isArray(value.sta_ip6) && value.sta_ip6.every((ip: unknown) => typeof ip === 'string'));
}

/**
 * Validates a discovered WiFi network.
 *
 * @param {unknown} value - Scan entry.
 * @returns {value is WifiScanResult} True for a valid entry.
 */
function isWifiScanResult(value: unknown): value is WifiScanResult {
  return (
    isWifiObject(value) &&
    isWifiString(value.ssid) &&
    typeof value.bssid === 'string' &&
    isValidNumber(value.auth, 0, 6) &&
    Number.isInteger(value.auth) &&
    isValidNumber(value.channel, 1) &&
    isValidNumber(value.rssi)
  );
}

/**
 * Validates a range extender client entry.
 *
 * @param {unknown} value - Client entry.
 * @returns {value is WifiAPClient} True for a valid entry.
 */
function isWifiAPClient(value: unknown): value is WifiAPClient {
  return (
    isWifiObject(value) &&
    typeof value.mac === 'string' &&
    typeof value.ip === 'string' &&
    typeof value.ip_static === 'boolean' &&
    isValidNumber(value.mport, 0, 65535) &&
    Number.isInteger(value.mport) &&
    isValidNumber(value.since, 0)
  );
}

interface ShellyComponentEvents {
  update: [component: string, key: string, data: ShellyDataType];
  event: [component: string, event: string, data: ShellyEvent];
}

/**
 * Rappresents the ShellyComponent class.
 */
export class ShellyComponent extends EventEmitter<ShellyComponentEvents> {
  readonly device: ShellyDevice;
  readonly id: string;
  readonly index: number;
  readonly name: string;
  private readonly _properties = new Map<string, ShellyProperty>();

  /**
   * Creates a new instance of the ShellyComponent class.
   *
   * @param {ShellyDevice} device - The Shelly device associated with the component.
   * @param {string} id - The ID of the component.
   * @param {string} name - The name of the component.
   * @param {ShellyData} [data] - The data associated with the component.
   */
  constructor(device: ShellyDevice, id: string, name: string, data?: ShellyData) {
    super();
    this.id = id;
    this.index = id.includes(':') ? Number.parseInt(id.split(':')[1]) : -1;
    this.name = name;
    this.device = device;
    for (const prop in data) {
      this.addProperty(new ShellyProperty(this, prop, data[prop]));

      // Add a state property for Light, Relay, and Switch components
      if ((isSwitchComponent(this) || isLightComponent(this)) && (prop === 'ison' || prop === 'output')) this.addProperty(new ShellyProperty(this, 'state', data[prop]));

      // Add a brightness property for Light components
      if (isLightComponent(this) && prop === 'gain') this.addProperty(new ShellyProperty(this, 'brightness', data[prop]));
    }

    // Add system status methods and Gen 2+ UDP configuration methods.
    if (isSysComponent(this)) {
      this.SetConfig = async function (config): Promise<ShellyData | null> {
        if (device.gen === 1) return null;
        const rpc_udp: Partial<SysRpcUdpConfig> = {};
        if (config.rpc_udp.dst_addr !== undefined) rpc_udp.dst_addr = config.rpc_udp.dst_addr;
        if (config.rpc_udp.listen_port !== undefined) rpc_udp.listen_port = config.rpc_udp.listen_port;
        return shellyFetch(device.shelly, device.log, device.host, device.port, 'Sys.SetConfig', { config: { rpc_udp } });
      };

      this.GetConfig = async function (): Promise<SysConfig | null> {
        if (device.gen === 1) return null;
        const config = await shellyFetch(device.shelly, device.log, device.host, device.port, 'Sys.GetConfig');
        const rpc = config?.rpc_udp;
        if (!isValidObject(rpc) || !('dst_addr' in rpc) || !('listen_port' in rpc)) return null;
        if (rpc.dst_addr !== null && typeof rpc.dst_addr !== 'string') return null;
        if (rpc.listen_port !== null && (!isValidNumber(rpc.listen_port, 1, 65535) || !Number.isInteger(rpc.listen_port))) return null;
        return { rpc_udp: { dst_addr: rpc.dst_addr, listen_port: rpc.listen_port } };
      };

      this.GetStatus = async function (): Promise<SysStatus | null> {
        const status = await shellyFetch(device.shelly, device.log, device.host, device.port, device.gen === 1 ? 'status' : 'Sys.GetStatus');
        if (typeof status?.mac !== 'string' || status.mac.length === 0) return null;
        if (!isValidNumber(status.uptime, 0)) return null;
        if (status.time !== undefined && status.time !== null && typeof status.time !== 'string') return null;
        const restartRequired = device.gen === 1 ? undefined : status.restart_required;
        if (device.gen !== 1 && typeof restartRequired !== 'boolean') return null;
        const cfgRev = device.gen === 1 ? undefined : status.cfg_rev;
        if (device.gen !== 1 && !isValidNumber(cfgRev, 0)) return null;
        return {
          mac: status.mac,
          restart_required: typeof restartRequired === 'boolean' ? restartRequired : undefined,
          time: status.time,
          uptime: status.uptime,
          cfg_rev: typeof cfgRev === 'number' ? cfgRev : undefined,
        };
      };
    }

    // WiFi RPC methods operate on the entire device, including on split WiFi components.
    if (isWifiComponent(this)) {
      this.GetConfig = async function (): Promise<WifiConfig | null> {
        const config = await shellyFetch(device.shelly, device.log, device.host, device.port, 'Wifi.GetConfig');
        return isWifiConfig(config) ? config : null;
      };
      this.SetConfig = async function (config): Promise<ShellyData | null> {
        return shellyFetch(device.shelly, device.log, device.host, device.port, 'Wifi.SetConfig', { config });
      };
      this.GetStatus = async function (): Promise<WifiStatus | null> {
        const status = await shellyFetch(device.shelly, device.log, device.host, device.port, 'Wifi.GetStatus');
        return isWifiStatus(status) ? status : null;
      };
      this.Scan = async function (): Promise<WifiScanResponse | null> {
        const response = await shellyFetch(device.shelly, device.log, device.host, device.port, 'Wifi.Scan');
        if (!Array.isArray(response?.results) || !response.results.every(isWifiScanResult)) return null;
        return { results: response.results };
      };
      this.ListAPClients = async function (): Promise<WifiAPClients | null> {
        const response = await shellyFetch(device.shelly, device.log, device.host, device.port, 'Wifi.ListAPClients');
        if (!response || (response.ts !== null && !isValidNumber(response.ts, 0))) return null;
        if (!Array.isArray(response.ap_clients) || !response.ap_clients.every(isWifiAPClient)) return null;
        return { ts: response.ts, ap_clients: response.ap_clients };
      };
    }

    // Add native Matter methods only when the device exposes the component.
    if (isMatterComponent(this)) {
      this.SetConfig = async function (config): Promise<ShellyData | null> {
        return shellyFetch(device.shelly, device.log, device.host, device.port, 'Matter.SetConfig', { config: { enable: config.enable } });
      };

      this.GetConfig = async function (): Promise<MatterConfig | null> {
        const config = await shellyFetch(device.shelly, device.log, device.host, device.port, 'Matter.GetConfig');
        return typeof config?.enable === 'boolean' ? { enable: config.enable } : null;
      };

      this.GetStatus = async function (): Promise<MatterStatus | null> {
        const status = await shellyFetch(device.shelly, device.log, device.host, device.port, 'Matter.GetStatus');
        if (!isValidNumber(status?.num_fabrics, 0) || !Number.isInteger(status.num_fabrics) || typeof status.commissionable !== 'boolean') return null;
        return { num_fabrics: status.num_fabrics, commissionable: status.commissionable };
      };

      this.GetSetupCode = async function (): Promise<MatterSetupCode | null> {
        const codes = await shellyFetch(device.shelly, device.log, device.host, device.port, 'Matter.GetSetupCode');
        if (typeof codes?.qr_code !== 'string' || typeof codes.manual_code !== 'string') return null;
        return { qr_code: codes.qr_code, manual_code: codes.manual_code };
      };

      this.FactoryReset = async function (): Promise<null> {
        await shellyFetch(device.shelly, device.log, device.host, device.port, 'Matter.FactoryReset');
        return null;
      };
    }

    // Add outbound WebSocket configuration and status methods.
    if (isWsComponent(this)) {
      this.SetConfig = async function (config): Promise<ShellyData | null> {
        const settings: Partial<WsConfig> = {};
        if (config.enable !== undefined) settings.enable = config.enable;
        if (config.server !== undefined) settings.server = config.server;
        if (config.ssl_ca !== undefined) settings.ssl_ca = config.ssl_ca;
        return shellyFetch(device.shelly, device.log, device.host, device.port, 'Ws.SetConfig', { config: settings });
      };

      this.GetConfig = async function (): Promise<WsConfig | null> {
        const config = await shellyFetch(device.shelly, device.log, device.host, device.port, 'Ws.GetConfig');
        if (typeof config?.enable !== 'boolean') return null;
        if (config.server !== undefined && config.server !== null && typeof config.server !== 'string') return null;
        if (config.ssl_ca !== '*' && config.ssl_ca !== 'user_ca.pem' && config.ssl_ca !== 'ca.pem') return null;
        return { enable: config.enable, server: config.server, ssl_ca: config.ssl_ca };
      };

      this.GetStatus = async function (): Promise<WsStatus | null> {
        const status = await shellyFetch(device.shelly, device.log, device.host, device.port, 'Ws.GetStatus');
        return typeof status?.connected === 'boolean' ? { connected: status.connected } : null;
      };
    }

    // Add cloud configuration and status methods dynamically.
    if (isCloudComponent(this)) {
      this.SetConfig = async function (config): Promise<ShellyData | null> {
        if (device.gen === 1) return shellyFetch(device.shelly, device.log, device.host, device.port, 'settings/cloud', { enabled: config.enable });
        return shellyFetch(device.shelly, device.log, device.host, device.port, 'Cloud.SetConfig', { config: { enable: config.enable } });
      };

      this.GetConfig = async function (): Promise<CloudConfig | null> {
        const config = await shellyFetch(device.shelly, device.log, device.host, device.port, device.gen === 1 ? 'settings/cloud' : 'Cloud.GetConfig');
        if (device.gen === 1) return typeof config?.enabled === 'boolean' ? { enable: config.enabled, server: null } : null;
        if (typeof config?.enable !== 'boolean' || (typeof config.server !== 'string' && config.server !== null)) return null;
        return { ...config, enable: config.enable, server: config.server };
      };

      this.GetStatus = async function (): Promise<CloudStatus | null> {
        const response = await shellyFetch(device.shelly, device.log, device.host, device.port, device.gen === 1 ? 'status' : 'Cloud.GetStatus');
        const status = device.gen === 1 ? response?.cloud : response;
        if (!isValidObject(status) || !('connected' in status) || typeof status.connected !== 'boolean') return null;
        return { connected: status.connected };
      };
    }

    // Extend the ShellyComponent class prototype to include the Switch Relay Light methods dynamically
    if (isSwitchComponent(this) || isLightComponent(this)) {
      this.On = function (): void {
        if (device.gen === 1) void shellyFetch(device.shelly, device.log, device.host, device.port, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { turn: 'on' });
        if (device.gen !== 1) void shellyFetch(device.shelly, device.log, device.host, device.port, `${this.name}.Set`, { id: this.index, on: true });
      };

      this.Off = function (): void {
        if (device.gen === 1) void shellyFetch(device.shelly, device.log, device.host, device.port, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { turn: 'off' });
        if (device.gen !== 1) void shellyFetch(device.shelly, device.log, device.host, device.port, `${this.name}.Set`, { id: this.index, on: false });
      };

      this.Toggle = function (): void {
        if (device.gen === 1) void shellyFetch(device.shelly, device.log, device.host, device.port, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { turn: 'toggle' });
        if (device.gen !== 1) void shellyFetch(device.shelly, device.log, device.host, device.port, `${this.name}.Toggle`, { id: this.index });
      };
    }

    // Extend the ShellyComponent class prototype to include the Light methods dynamically
    if (isLightComponent(this)) {
      this.Level = function (level: number): void {
        if (!this.hasProperty('brightness')) return;
        const adjustedLevel = Math.min(Math.max(Math.round(level), 0), 100);
        if (device.gen === 1 && this.hasProperty('brightness'))
          void shellyFetch(device.shelly, device.log, device.host, device.port, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { brightness: adjustedLevel });
        if (device.gen === 1 && this.hasProperty('gain'))
          void shellyFetch(device.shelly, device.log, device.host, device.port, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { gain: adjustedLevel });
        if (device.gen !== 1) void shellyFetch(device.shelly, device.log, device.host, device.port, `${this.name}.Set`, { id: this.index, brightness: adjustedLevel });
      };

      this.ColorRGB = function (red: number, green: number, blue: number): void {
        const normalizedRed = Math.min(Math.max(Math.round(red), 0), 255);
        const normalizedGreen = Math.min(Math.max(Math.round(green), 0), 255);
        const normalizedBlue = Math.min(Math.max(Math.round(blue), 0), 255);

        if (this.hasProperty('red') && this.hasProperty('green') && this.hasProperty('blue')) {
          // SHCB-1
          if (device.gen === 1 && this.hasProperty('mode'))
            void shellyFetch(device.shelly, device.log, device.host, device.port, `${id.slice(0, id.indexOf(':'))}/${this.index}`, {
              red: normalizedRed,
              green: normalizedGreen,
              blue: normalizedBlue,
              mode: 'color',
            });
          // SHBDUO-1
          if (device.gen === 1 && !this.hasProperty('mode'))
            void shellyFetch(device.shelly, device.log, device.host, device.port, `${id.slice(0, id.indexOf(':'))}/${this.index}`, {
              red: normalizedRed,
              green: normalizedGreen,
              blue: normalizedBlue,
            });
          if (device.gen !== 1)
            void shellyFetch(device.shelly, device.log, device.host, device.port, `${this.name}.Set`, {
              id: this.index,
              red: normalizedRed,
              green: normalizedGreen,
              blue: normalizedBlue,
            });
        }
        if (this.hasProperty('rgb') && isValidArray(this.getValue('rgb'), 3, 3)) {
          if (device.gen === 1)
            void shellyFetch(device.shelly, device.log, device.host, device.port, `${id.slice(0, id.indexOf(':'))}/${this.index}`, {
              red: normalizedRed,
              green: normalizedGreen,
              blue: normalizedBlue,
            });
          if (device.gen !== 1)
            void shellyFetch(device.shelly, device.log, device.host, device.port, `${this.name}.Set`, { id: this.index, rgb: [normalizedRed, normalizedGreen, normalizedBlue] });
        }
      };

      this.ColorTemp = function (temperature: number): void {
        if (isValidNumber(temperature, 2700, 6500)) {
          // SHCB-1
          if (device.gen === 1 && this.hasProperty('temp') && this.hasProperty('mode'))
            void shellyFetch(device.shelly, device.log, device.host, device.port, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { temp: temperature, mode: 'white' });
          // SHBDUO-1
          if (device.gen === 1 && this.hasProperty('temp') && !this.hasProperty('mode'))
            void shellyFetch(device.shelly, device.log, device.host, device.port, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { temp: temperature });
          // shellyprorgbwwpm
          if (device.gen !== 1 && this.hasProperty('ct'))
            void shellyFetch(device.shelly, device.log, device.host, device.port, `${this.name}.Set`, { id: this.index, ct: temperature });
        }
      };
    }

    // Extend the ShellyComponent class prototype to include the Cover methods dynamically
    if (isCoverComponent(this)) {
      this.Open = function (): void {
        if (device.gen === 1) void shellyFetch(device.shelly, device.log, device.host, device.port, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { go: 'open' });
        if (device.gen !== 1) void shellyFetch(device.shelly, device.log, device.host, device.port, `${this.name}.Open`, { id: this.index });
      };

      this.Close = function (): void {
        if (device.gen === 1) void shellyFetch(device.shelly, device.log, device.host, device.port, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { go: 'close' });
        if (device.gen !== 1) void shellyFetch(device.shelly, device.log, device.host, device.port, `${this.name}.Close`, { id: this.index });
      };

      this.Stop = function (): void {
        if (device.gen === 1) void shellyFetch(device.shelly, device.log, device.host, device.port, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { go: 'stop' });
        if (device.gen !== 1) void shellyFetch(device.shelly, device.log, device.host, device.port, `${this.name}.Stop`, { id: this.index });
      };

      this.GoToPosition = function (pos: number): void {
        const normalizedPos = Math.min(Math.max(Math.round(pos), 0), 100);
        if (device.gen === 1)
          void shellyFetch(device.shelly, device.log, device.host, device.port, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { go: 'to_pos', roller_pos: normalizedPos });
        if (device.gen !== 1) void shellyFetch(device.shelly, device.log, device.host, device.port, `${this.name}.GoToPosition`, { id: this.index, pos: normalizedPos });
      };
    }
  }

  /**
   * Checks if the component has a property with the specified key.
   *
   * @param {string} key - The key of the property to check.
   * @returns {boolean} true if the component has the property, false otherwise.
   */
  hasProperty(key: string): boolean {
    return this._properties.has(key);
  }

  /**
   * Retrieves the value of a property based on the specified key.
   *
   * @param {string} key - The key of the property to retrieve.
   * @returns {ShellyProperty | undefined} The value of the property, or undefined if the property does not exist.
   */
  getProperty(key: string): ShellyProperty | undefined {
    return this._properties.get(key);
  }

  /**
   * Adds a property to the ShellyComponent.
   *
   * @param {ShellyProperty} property - The property to add.
   * @returns {ShellyComponent} The updated ShellyComponent instance.
   */
  addProperty(property: ShellyProperty): ShellyComponent {
    this._properties.set(property.key, property);
    return this;
  }

  /**
   * Sets the value of a property in the ShellyComponent.
   * If the property already exists, it updates the value.
   * If the property doesn't exist, it adds a new property with the specified value.
   * Emits an 'update' event after updating the value.
   *
   * @param {string} key - The key of the property.
   * @param {ShellyDataType} value - The value to set for the property.
   * @returns {ShellyComponent} The updated ShellyComponent instance.
   */
  setValue(key: string, value: ShellyDataType): ShellyComponent {
    const property = this.getProperty(key);
    if (property) {
      if (deepEqual(property.value, value)) {
        /*
        this.device.log.debug(
          `${CYAN}${this.id}:${key}${GREY} not changed from ${YELLOW}${property.value !== null && typeof property.value === 'object' ? debugStringify(property.value) : property.value}${GREY} in component ${GREEN}${this.id}${GREY} (${BLUE}${this.name}${GREY})`,
        );
        */
      } else {
        this.device.log.debug(
          `*${CYAN}${this.id}:${key}${GREY} updated from ${isValidObject(property.value) ? debugStringify(property.value) : property.value}${GREY} to ${YELLOW}${isValidObject(value) ? debugStringify(value) : value}${GREY} in component ${GREEN}${this.id}${GREY} (${BLUE}${this.name}${GREY})`,
        );
        this.device.emit('update', this.id, key, value);
        this.emit('update', this.id, key, value);
        property.value = value;
      }
    } else {
      this.addProperty(new ShellyProperty(this, key, value));
      this.device.log.debug(
        `*${CYAN}${this.id}:${key}${GREY} added with value ${YELLOW}${value !== null && typeof value === 'object' ? debugStringify(value) : value}${GREY} to component ${GREEN}${this.id}${GREY} (${BLUE}${this.name}${GREY})`,
      );
    }
    return this;
  }

  /**
   * Retrieves the value of a property based on the provided key.
   * If the property is found, its value is returned. Otherwise, an error message is logged and `undefined` is returned.
   *
   * @param {string} key - The key of the property to retrieve.
   * @returns {ShellyDataType} The value of the property if found, otherwise `undefined`.
   */
  getValue(key: string): ShellyDataType {
    const property = this.getProperty(key);
    if (property) return property.value;
    else {
      this.device.log.error(`****Property ${CYAN}${key}${er} not found in component ${GREEN}${this.id}${er} (${BLUE}${this.name}${er})`);
      return undefined;
    }
  }

  /**
   * Retrieves all properties of the ShellyComponent.
   *
   * @returns {ShellyProperty[]} An array of ShellyProperty objects representing the properties of the component.
   */
  get properties(): ShellyProperty[] {
    return Array.from(this._properties.values());
  }

  /**
   * Retrieves an iterator for the key-value pairs of the ShellyComponent's properties.
   *
   * @yields {[string, ShellyProperty]} A key-value pair where the key is the property key and the value is the ShellyProperty.
   */
  *[Symbol.iterator](): IterableIterator<[string, ShellyProperty]> {
    for (const [key, property] of this._properties.entries()) {
      yield [key, property];
    }
  }

  /**
   * Updates the component with the provided data.
   *
   * @param {ShellyData} componentData - The data to update the component with.
   */
  update(componentData: ShellyData): void {
    for (const key in componentData) {
      const property = this.getProperty(key);
      if (property) {
        property.value = componentData[key];
        if (property.key === 'ison') {
          const state = this.getProperty('state');
          if (state) state.value = componentData[key];
        }
        if (property.key === 'output') {
          const state = this.getProperty('state');
          if (state) state.value = componentData[key];
        }
      }
    }
  }

  /**
   * Logs the component details and properties.
   *
   * @returns {number} The number of the properties.
   */
  logComponent(): number {
    this.device.log.debug(`Component ${GREEN}${this.id}${db} (${BLUE}${this.name}${db}) has the following ${this._properties.size} properties:`);
    for (const [key, property] of this) {
      this.device.log.debug(`- ${key}: ${property.value && typeof property.value === 'object' ? debugStringify(property.value) : property.value}`);
    }
    return this._properties.size;
  }
}
