import { spawn } from 'child_process';

const API_KEY = process.env.INSFORGE_API_KEY || '';
const API_BASE_URL = process.env.INSFORGE_API_BASE_URL || 'https://ijeed7kh.us-west.insforge.app';

if (!API_KEY) {
  console.error('Missing INSFORGE_API_KEY env var.');
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
let initialized = false;

function send(msg) {
  mcp.stdin.write(`${JSON.stringify(msg)}\n`);
}

mcp.stdout.on('data', (data) => {
  const chunk = data.toString();
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (!line.trim()) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }

    if (msg.error) {
      console.error('MCP Error:', JSON.stringify(msg.error, null, 2));
      process.exit(1);
    }

    if (!initialized && msg.id === 0) {
      initialized = true;
      send({ jsonrpc: '2.0', method: 'notifications/initialized' });
      send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
      continue;
    }

    if (msg.id === 1) {
      const tools = msg.result?.tools || [];
      console.log(`Tool count: ${tools.length}`);
      for (const tool of tools) {
        if (
          tool.name === 'create-function' ||
          tool.name === 'update-function' ||
          tool.name === 'delete-function' ||
          tool.name === 'fetch-docs' ||
          tool.name === 'get-backend-metadata'
        ) {
          console.log(`\n=== ${tool.name} ===`);
          console.log(JSON.stringify(tool.inputSchema || {}, null, 2));
        }
      }
      process.exit(0);
    }
  }
});

send({
  jsonrpc: '2.0',
  id: 0,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'insforge-tool-inspector', version: '1.0.0' },
  },
});
