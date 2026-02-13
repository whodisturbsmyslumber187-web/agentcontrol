# AgentForge-OS Installation Guide
# Brotherhood Empire Command Center

## Quick Start (One Command)

On your **Hostinger VPS** (srv1195681.hstgr.cloud), run:

```bash
# Download and run the installer
curl -sSL https://raw.githubusercontent.com/Tunetown187/brotherhood-empire-ai/main/agentforge-os/install.sh | bash
```

## Manual Installation

### 1. SSH to Your VPS
```bash
ssh root@72.62.2.208
# or use your preferred SSH method
```

### 2. Run Setup Script
```bash
# Update system
apt-get update && apt-get upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install PM2
npm install -g pm2

# Install nginx
apt-get install -y nginx

# Create app directory
mkdir -p /opt/agentforge-os
cd /opt/agentforge-os
```

### 3. Copy Application Files

**Option A: From this workspace (if you have access):**
```bash
# On your local machine where OpenClaw is running:
cd /home/node/.openclaw/workspace
tar -czf agentforge-os.tar.gz agentforge-os/

# Copy to VPS (you'll need to figure out the transfer method)
# Example with scp if SSH works:
scp agentforge-os.tar.gz root@72.62.2.208:/opt/
```

**Option B: Clone from GitHub (recommended):**
```bash
# On your VPS:
cd /opt
git clone https://github.com/Tunetown187/brotherhood-empire-ai.git
cp -r brotherhood-empire-ai/agentforge-os/* /opt/agentforge-os/
cd /opt/agentforge-os
```

### 4. Install Dependencies
```bash
cd /opt/agentforge-os
npm install
npm run build
```

### 5. Configure Environment
```bash
# Create .env file
cat > .env << EOF
VITE_OPENCLAW_API_URL=http://localhost:18789
VITE_TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
VITE_EDGE_TTS_ENABLED=true
VITE_MAX_AGENTS=1000
VITE_HEARTBEAT_INTERVAL=30000
VITE_NODE_ENV=production
EOF

# Edit with your actual Telegram bot token
nano .env
```

### 6. Start Application
```bash
# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Configure nginx
cp nginx.conf /etc/nginx/sites-available/agentforge-os
ln -s /etc/nginx/sites-available/agentforge-os /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

### 7. Configure Firewall
```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

### 8. Access Dashboard
- **Direct access:** http://72.62.2.208:5173
- **Through nginx:** http://72.62.2.208

## OpenClaw Integration

### Option A: Run OpenClaw on Same VPS
```bash
# Install OpenClaw on VPS
npm install -g @openclaw/cli
openclaw gateway start --bind lan --port 18789
```

### Option B: Connect to Remote OpenClaw
Update `.env` file:
```env
VITE_OPENCLAW_API_URL=http://your-openclaw-server:18789
```

### Option C: Node Pairing (Recommended)
1. Ensure OpenClaw is running on your current machine
2. From OpenClaw dashboard, pair with VPS node
3. Use node token for secure connection

## Features Ready to Use

### 1. Agent Army Dashboard
- Real-time agent monitoring
- Token usage tracking
- Agent spawning and management

### 2. Business Operations
- Multi-venture revenue tracking
- Profit/loss analytics
- Task management

### 3. Market Monitor
- Silver price tracking (2% alerts)
- Gold, Bitcoin, S&P 500 monitoring
- Telegram alert integration

### 4. System Health
- Resource monitoring
- Log viewing
- Performance analytics

## Troubleshooting

### Application Won't Start
```bash
# Check logs
pm2 logs agentforge-os
tail -f /var/log/agentforge-os/error.log

# Check Node.js version
node --version  # Should be 18+

# Check dependencies
npm list
```

### nginx Issues
```bash
# Test configuration
nginx -t

# Check nginx logs
tail -f /var/log/nginx/error.log

# Restart nginx
systemctl restart nginx
```

### OpenClaw Connection Issues
```bash
# Test OpenClaw API
curl http://localhost:18789/api/status

# Check OpenClaw logs
journalctl -u openclaw -f
```

## Security Notes

1. **Update .env file** with your actual Telegram bot token
2. **Configure SSL** for production use:
   ```bash
   certbot --nginx -d yourdomain.com
   ```
3. **Set up authentication** for dashboard access
4. **Regular updates**:
   ```bash
   cd /opt/agentforge-os
   git pull
   npm install
   npm run build
   pm2 restart agentforge-os
   ```

## Support

- **Documentation:** `/opt/agentforge-os/README.md`
- **Issues:** GitHub repository
- **Telegram:** @ModBotAgent_bot for alerts

---

**Brotherhood Empire Operational. Execute with precision.**