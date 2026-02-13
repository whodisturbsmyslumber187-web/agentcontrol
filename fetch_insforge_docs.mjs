import { spawn } from 'child_process';
import fs from 'fs';

const API_KEY = process.env.INSFORGE_API_KEY || '';
const API_BASE_URL = process.env.INSFORGE_API_BASE_URL || 'https://ijeed7kh.us-west.insforge.app';
const DOC_TOPIC = process.argv[2] || 'instructions';

if (!API_KEY) {
  console.error('Missing INSFORGE_API_KEY env var. Export it before running this script.');
  process.exit(1);
}

const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const mcp = spawn(npxCmd, ['-y', '@insforge/mcp', '--api_key', API_KEY, '--api_base_url', API_BASE_URL], {
  env: {
    ...process.env,
    INSFORGE_API_KEY: API_KEY,
    INSFORGE_API_BASE_URL: API_BASE_URL,
  },
  stdio: ['pipe', 'pipe', 'inherit'],
  shell: true,
});

let buffer = '';
let step = 'init';

mcp.stdout.on('data', (data) => {
  const chunk = data.toString();
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      handleMessage(msg);
    } catch {
      // Ignore non-JSON logs from server stdout.
    }
  }
});

function send(msg) {
  mcp.stdin.write(`${JSON.stringify(msg)}\n`);
}

function resolveDocsArgumentKey(fetchDocsTool) {
  const inputSchema = fetchDocsTool?.inputSchema || {};
  const properties = inputSchema.properties || {};
  const required = inputSchema.required || [];

  if (required.includes('documentationType') || properties.documentationType) return 'documentationType';
  if (required.includes('topic') || properties.topic) return 'topic';
  if (required.includes('type') || properties.type) return 'type';
  if (required.includes('docType') || properties.docType) return 'docType';
  return 'topic';
}

function handleMessage(msg) {
  if (msg.error) {
    console.error('MCP Error:', msg.error);
    process.exit(1);
  }

  if (step === 'init' && msg.id === 0) {
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    step = 'list_tools';
    send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    return;
  }

  if (step === 'list_tools' && msg.id === 1) {
    const tools = msg.result?.tools || [];
    const fetchDocsTool = tools.find((t) => t.name === 'fetch-docs');
    if (!fetchDocsTool) {
      console.error('fetch-docs tool not found.');
      process.exit(1);
    }

    const argumentKey = resolveDocsArgumentKey(fetchDocsTool);
    step = 'call_tool';
    send({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'fetch-docs',
        arguments: { [argumentKey]: DOC_TOPIC },
      },
    });
    return;
  }

  if (step === 'call_tool' && msg.id === 2) {
    const content = msg.result?.content?.[0]?.text;
    if (!content) {
      console.error('No documentation content returned by fetch-docs.');
      process.exit(1);
    }
    fs.writeFileSync('INSFORGE_INSTRUCTIONS.md', content);
    process.exit(0);
  }
}

send({
  jsonrpc: '2.0',
  id: 0,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'insforge-docs-client', version: '1.0' },
  },
});
