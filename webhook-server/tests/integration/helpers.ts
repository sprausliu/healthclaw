import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Express } from 'express';
import { createApp } from '../../src/index.js';
import { resetBootstrap } from '../../src/persistence/persistence-bootstrap.js';

export interface TestPaths {
  healthDataFile: string;
  configFile: string;
  dedupeDbPath: string;
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface TestResponse {
  status: number;
  body: any;
  headers: Headers;
}

export type RequestFunction = (url: string, options?: RequestOptions) => Promise<TestResponse>;

export interface TestServer {
  request: RequestFunction;
  close: () => Promise<void>;
  paths: TestPaths;
  dataDir: string;
}

/**
 * Create a test server with isolated temporary data directory
 */
export async function createTestServer(): Promise<TestServer> {
  resetBootstrap();

  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'healthclaw-'));

  const app = await createApp({
    dataDir: root,
    repoRoot: root,
    secretBackend: 'file',
  });
  const { dedupeRepository, paths } = app.locals;

  const server = await new Promise<any>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Server address unavailable');
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  /**
   * Make HTTP request to test server
   */
  async function request(url: string, options: RequestOptions = {}): Promise<TestResponse> {
    const response = await fetch(`${baseUrl}${url}`, options);
    const text = await response.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    return { status: response.status, body, headers: response.headers };
  }

  async function close(): Promise<void> {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (dedupeRepository?.close) {
      await dedupeRepository.close();
    }
  }

  return {
    request,
    close,
    paths: {
      healthDataFile: paths.healthDataFile,
      configFile: paths.configFile,
      dedupeDbPath: paths.dedupeDbPath,
    },
    dataDir: root,
  };
}

/**
 * Pair a test device and return permanent token
 */
export async function pairDevice(request: RequestFunction): Promise<string> {
  const generated = await request('/admin/generate-pairing', { method: 'POST' });
  const pairToken = generated.body.pairingToken;
  const paired = await request(`/api/pair?token=${pairToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceInfo: { model: 'test-device' } }),
  });

  return paired.body.permanentToken;
}

/**
 * Read JSONL file and parse lines
 */
export async function readJsonl(filePath: string): Promise<any[]> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return raw.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}
