import { spawn } from 'child_process';

const API_KEY = process.env.INSFORGE_API_KEY || '';
const API_BASE_URL = process.env.INSFORGE_API_BASE_URL || 'https://ijeed7kh.us-west.insforge.app';
const TOOL_NAME = process.argv[2] || '';
const RAW_ARGS = process.argv[3] || '{}';

if (!API_KEY) {
  console.error('Missing INSFORGE_API_KEY env var.');
  process.exit(1);
}

if (!TOOL_NAME) {
  console.error('Usage: node scripts/insforge-call-tool.mjs <tool-name> \'<json-args>\'');
  process.exit(1);
}

let args;
try {
  args = JSON.parse(RAW_ARGS);
} catch (error) {
  console.error('Invalid JSON args:', error instanceof Error ? error.message : String(error));
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

function send(msg) {
  mcp.stdin.write(`${JSON.stringify(msg)}\n`);
}

function exitWithError(message) {
  console.error(message);
  process.exit(1);
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
      exitWithError(`MCP Error: ${JSON.stringify(msg.error)}`);
    }

    if (step === 'init' && msg.id === 0) {
      send({ jsonrpc: '2.0', method: 'notifications/initialized' });
      step = 'list_tools';
      send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
      continue;
    }

    if (step === 'list_tools' && msg.id === 1) {
      const tools = msg.result?.tools || [];
      const found = tools.find((tool) => tool.name === TOOL_NAME);
      if (!found) {
        exitWithError(`Tool "${TOOL_NAME}" not found.`);
      }
      step = 'call_tool';
      send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: TOOL_NAME,
          arguments: args,
        },
      });
      continue;
    }

    if (step === 'call_tool' && msg.id === 2) {
      console.log(JSON.stringify(msg.result || {}, null, 2));
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
    clientInfo: { name: 'insforge-tool-client', version: '1.0.0' },
  },
});
