# AgentForge OS

A production-ready AI agent management dashboard inspired by Muddy-OS, built for unlimited scalability and 24/7 autonomous operation.

## Features

### 🚀 Core Capabilities
- **Unlimited Agent Scalability**: Virtualized UI handles thousands of agents
- **24/7 Autonomous Operation**: Heartbeat monitoring with auto-recovery
- **Dynamic Agent Creation**: Agents can spawn sub-agents in real-time
- **Multi-Model Fleet Support**: Primary/backup LLMs with auto-failover
- **Real-time Updates**: WebSocket/polling for live status

### 📊 Dashboard Sections
1. **Task Manager**: Real-time sessions, token usage, cron jobs, logs
2. **Org Chart**: Hierarchical tree with drag-drop reorganization
3. **Voice Standups**: AI meetings with Edge TTS and action tracking
4. **Workspaces**: File-based agent identity/memory management
5. **Documentation**: Living docs auto-updated from agent activities

### 🔧 Technical Stack
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **State**: Zustand for global state management
- **Routing**: React Router v6
- **Real-time**: WebSocket + polling fallback
- **Voice**: Microsoft Edge TTS (free)
- **Scheduling**: node-cron
- **Notifications**: Telegram bot integration
- **Persistence**: SQLite + Markdown/JSON files

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- OpenClaw installed and running locally
- Python 3.8+ (for agent scripts)

### Installation
```bash
# Clone and install
git clone <repo-url>
cd agentforge-os
npm install

# Configure environment
cp .env.example .env
# Edit .env with your OpenClaw API URL and Telegram bot token

# Start development server
npm run dev
```

### OpenClaw Integration
1. Ensure OpenClaw is running with API enabled
2. Update `.env` with your OpenClaw API URL
3. The dashboard will auto-discover agents and sessions

## Architecture

### File Structure
```
agentforge-os/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── agents/         # Agent-specific components
│   │   ├── charts/         # Org chart components
│   │   ├── common/         # Shared components
│   │   └── layout/         # Layout components
│   ├── pages/              # Main dashboard sections
│   │   ├── TaskManager.tsx
│   │   ├── OrgChart.tsx
│   │   ├── VoiceStandups.tsx
│   │   ├── Workspaces.tsx
│   │   └── Documentation.tsx
│   ├── services/           # Backend integrations
│   │   ├── openclaw/       # OpenClaw API client
│   │   ├── agents/         # Agent management
│   │   ├── voice/          # TTS service
│   │   └── persistence/    # Data storage
│   ├── stores/             # Zustand state stores
│   ├── types/              # TypeScript definitions
│   └── utils/              # Utility functions
├── public/                 # Static assets
├── data/                   # Persistent data (Markdown/JSON)
├── scripts/                # Agent scripts and wrappers
└── docs/                   # Auto-generated documentation
```

### Data Flow
1. **Agent Discovery**: OpenClaw API → Dashboard
2. **Real-time Updates**: WebSocket events → UI updates
3. **Agent Spawning**: Dashboard → OpenClaw delegation → New agent
4. **Persistence**: Agent state → SQLite + Markdown files
5. **Voice Generation**: Text → Edge TTS → Audio files

### Scalability Design
- **Virtualization**: react-window for large lists
- **Lazy Loading**: Pagination for logs/transcripts
- **IndexedDB**: Client-side caching for performance
- **Web Workers**: Heavy computations off main thread
- **Connection Pooling**: Efficient API communication

## Configuration

### Environment Variables
```env
VITE_OPENCLAW_API_URL=http://localhost:3000/api
VITE_TELEGRAM_BOT_TOKEN=your_token_here
VITE_EDGE_TTS_ENABLED=true
VITE_MAX_AGENTS=1000
VITE_HEARTBEAT_INTERVAL=30000
```

### Agent Configuration
Each agent has:
- `SOUL.md`: Personality and behavior
- `MEMORY.md`: Persistent context
- `TOOLS.md`: Available capabilities
- `heartbeat.md`: Scheduling instructions

### Model Fleet Configuration
```json
{
  "primary": "ollama/llama3.2:latest",
  "backup": "ollama/qwen2.5:1.5b",
  "fallback": "deepseek/deepseek-chat",
  "cost_tracking": true
}
```

## Usage

### Adding New Agents
1. **Via Dashboard**: Click "Spawn Agent" in Org Chart
2. **Via API**: POST to `/api/agents/spawn`
3. **Via OpenClaw**: Use delegation prompts
4. **Via Script**: Import custom agent scripts

### Monitoring
- **Real-time Status**: Green/red badges in Task Manager
- **Token Usage**: Cost estimation per agent/model
- **Session Logs**: Expandable transcripts
- **Error Tracking**: Automatic alerting

### Voice Standups
1. Schedule meetings via cron or manual trigger
2. Agents debate using chained prompts
3. Edge TTS generates unique voices
4. Action items tracked to completion
5. Telegram notifications with audio links

## Security

### Authentication
- Basic auth for dashboard access
- API key validation for OpenClaw integration
- Rate limiting on agent spawning
- Session timeout for inactive users

### Agent Sandboxing
- Optional Docker containerization
- Resource limits (CPU/RAM)
- Network isolation
- File system restrictions

### Data Protection
- Encrypted credentials storage
- Secure WebSocket connections
- Audit logging for all actions
- Regular backup of agent data

## Deployment

### Local Development
```bash
npm run dev
# Open http://localhost:5173
```

### Production Build
```bash
npm run build
npm run preview
```

### Docker Deployment
```bash
docker build -t agentforge-os .
docker run -p 5173:5173 agentforge-os
```

### VPS Deployment (Ubuntu)
```bash
# Install dependencies
sudo apt update
sudo apt install nodejs npm nginx

# Deploy application
sudo cp nginx.conf /etc/nginx/sites-available/agentforge
sudo ln -s /etc/nginx/sites-available/agentforge /etc/nginx/sites-enabled/
sudo systemctl restart nginx

# Run with PM2 for persistence
npm install -g pm2
pm2 start npm --name "agentforge" -- run start
pm2 save
pm2 startup
```

## Extending

### Custom Agent Types
1. Create wrapper in `scripts/agents/`
2. Define interface in `src/types/agent.ts`
3. Add to import modal in UI
4. Test with sample data

### Adding New LLM Providers
1. Implement provider in `src/services/llm/`
2. Add to model fleet configuration
3. Update cost calculation
4. Test with fallback scenarios

### Plugin System
- **Webhooks**: External system integration
- **Custom Components**: UI extensions
- **Script Hooks**: Pre/post execution
- **Event Listeners**: Real-time triggers

## Troubleshooting

### Common Issues
1. **OpenClaw Connection Failed**: Check API URL and CORS settings
2. **Agent Spawning Fails**: Verify OpenClaw delegation permissions
3. **Voice TTS Not Working**: Ensure Edge TTS is installed
4. **High Memory Usage**: Enable virtualization for large agent lists

### Logs
- Application logs: `logs/app.log`
- Agent logs: `data/agents/*/logs/`
- Error tracking: Sentry integration (optional)

### Performance Tuning
- Adjust `VITE_MAX_AGENTS` for your hardware
- Enable compression in production build
- Use CDN for static assets
- Implement database indexing for large datasets

## Contributing

1. Fork the repository
2. Create feature branch
3. Write tests for new functionality
4. Submit pull request

### Development Guidelines
- TypeScript strict mode enabled
- ESLint + Prettier for code quality
- Jest + React Testing Library for tests
- Storybook for component development

## License

MIT License - see LICENSE file for details.

## Support

- **Documentation**: [docs.agentforge.dev](https://docs.agentforge.dev)
- **Issues**: GitHub Issues
- **Community**: Discord server
- **Commercial Support**: Available for enterprise deployments

---

**Built with ❤️ for the AI agent community. Scale without limits.**