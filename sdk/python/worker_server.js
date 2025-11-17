#!/usr/bin/env node
/**
 * 与 Python SDK 通信的 Node Worker
 * 采用基于 stdin/stdout 的 JSON-RPC 简化协议
 */

import readline from 'node:readline';
import process from 'node:process';

import { CodeIndex } from '../../dist/index.js';

let codeIndex = null;
let initialized = false;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

async function ensureInitialized() {
  if (!initialized || !codeIndex) {
    throw new Error('CodeIndex 未初始化，请先调用 init');
  }
}

async function handleRequest(payload) {
  const { id, method, params = {} } = payload;
  const send = (result, error = null) => {
    process.stdout.write(JSON.stringify({ id, result, error }) + '\n');
  };

  try {
    switch (method) {
      case 'ping':
        return send({ ok: true });
      case 'init': {
        if (codeIndex) {
          codeIndex.close();
        }
        codeIndex = await CodeIndex.create({
          rootDir: params.rootDir,
          dbPath: params.dbPath,
          languages: params.languages,
          include: params.include,
          exclude: params.exclude,
          batchIntervalMinutes: params.batchIntervalMinutes,
          minChangeLines: params.minChangeLines,
        });
        initialized = true;
        return send({ ok: true });
      }
      case 'find_symbols':
        await ensureInitialized();
        return send(await codeIndex.findSymbols(params.query || {}));
      case 'find_symbol':
        await ensureInitialized();
        return send(await codeIndex.findSymbol(params.query || {}));
      case 'object_properties':
        await ensureInitialized();
        return send(
          await codeIndex.objectProperties({
            object: params.object,
            language: params.language,
            inFile: params.inFile,
          })
        );
      case 'call_chain':
        await ensureInitialized();
        return send(await codeIndex.callChain(params));
      case 'definition':
        await ensureInitialized();
        return send(await codeIndex.definition(params.symbolId));
      case 'references':
        await ensureInitialized();
        return send(await codeIndex.references(params.symbolId));
      case 'semantic_search':
        await ensureInitialized();
        return send(await codeIndex.semanticSearch(params));
      case 'shutdown':
        if (codeIndex) {
          codeIndex.close();
        }
        send({ ok: true });
        process.exit(0);
        break;
      default:
        throw new Error(`未知方法: ${method}`);
    }
  } catch (error) {
    send(null, error?.message || String(error));
  }
}

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }
  try {
    const payload = JSON.parse(trimmed);
    handleRequest(payload);
  } catch (error) {
    process.stderr.write(`[Worker] 无法解析消息: ${error.message}\n`);
  }
});

const cleanup = () => {
  if (codeIndex) {
    codeIndex.close();
  }
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

