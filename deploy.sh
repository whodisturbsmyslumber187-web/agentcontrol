#!/bin/bash

# AgentForge-OS Deployment Script
# For Hostinger VPS: srv1195681.hstgr.cloud (72.62.2.208)

set -e

echo "🚀 Deploying AgentForge-OS Dashboard to VPS..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
VPS_HOST="72.62.2.208"
VPS_USER="root"
APP_NAME="agentforge-os"
APP_PORT="5173"
DOMAIN="agentforge.yourdomain.com"  # Update with your domain

# Function to print status
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check if we're on the VPS
if [ "$(hostname)" != "$VPS_HOST" ] && [ "$(hostname -I | grep -o '72\.62\.2\.208')" != "72.62.2.208" ]; then
    print_warning "This script should be run on the VPS. Copying files first..."
    
    # Create deployment package
    cd /home/node/.openclaw/workspace
    tar -czf agentforge-os-deploy.tar.gz agentforge-os/
    
    print_status "Created deployment package: agentforge-os-deploy.tar.gz"
    print_warning "Please copy this file to your VPS and run:"
    echo "  tar -xzf agentforge-os-deploy.tar.gz"
    echo "  cd agentforge-os"
    echo "  chmod +x deploy.sh"
    echo "  ./deploy.sh"
    exit 0
fi

# Update system
print_status "Updating system packages..."
apt-get update
apt-get upgrade -y

# Install Node.js 18+
print_status "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install PM2 for process management
print_status "Installing PM2..."
npm install -g pm2

# Install nginx
print_status "Installing nginx..."
apt-get install -y nginx

# Install build dependencies
print_status "Installing build dependencies..."
apt-get install -y build-essential

# Create application directory
print_status "Setting up application directory..."
mkdir -p /opt/$APP_NAME
cd /opt/$APP_NAME

# Copy application files (assuming we're already in the agentforge-os directory)
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Make sure you're in the agentforge-os directory."
    exit 1
fi

# Install dependencies
print_status "Installing Node.js dependencies..."
npm install

# Build the application
print_status "Building the application..."
npm run build

# Create environment file
print_status "Creating environment configuration..."
cat > .env << EOF
# AgentForge-OS Environment Configuration
VITE_OPENCLAW_API_URL=http://localhost:18789
VITE_TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-your_telegram_bot_token_here}
VITE_EDGE_TTS_ENABLED=true
VITE_MAX_AGENTS=1000
VITE_HEARTBEAT_INTERVAL=30000
VITE_NODE_ENV=production
EOF

print_warning "Please update .env with your actual Telegram bot token!"

# Create PM2 ecosystem file
print_status "Creating PM2 configuration..."
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: '$APP_NAME',
    script: 'node_modules/.bin/vite',
    args: 'preview --port $APP_PORT --host',
    env: {
      NODE_ENV: 'production'
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: '/var/log/$APP_NAME/error.log',
    out_file: '/var/log/$APP_NAME/out.log',
    log_file: '/var/log/$APP_NAME/combined.log',
    time: true
  }]
}
EOF

# Create log directory
mkdir -p /var/log/$APP_NAME

# Configure nginx
print_status "Configuring nginx..."
cat > /etc/nginx/sites-available/$APP_NAME << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    location / {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

# Restart nginx
systemctl restart nginx

# Start application with PM2
print_status "Starting application with PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Configure firewall
print_status "Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Create systemd service for OpenClaw integration
print_status "Creating OpenClaw integration service..."
cat > /etc/systemd/system/openclaw-agentforge.service << EOF
[Unit]
Description=OpenClaw AgentForge Integration
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/$APP_NAME
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /opt/$APP_NAME/integration/openclaw-bridge.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Create OpenClaw bridge script
mkdir -p /opt/$APP_NAME/integration
cat > /opt/$APP_NAME/integration/openclaw-bridge.js << EOF
// OpenClaw Bridge for AgentForge-OS
const WebSocket = require('ws');
const axios = require('axios');

const OPENCLAW_WS_URL = 'ws://localhost:18789/ws';
const DASHBOARD_API_URL = 'http://localhost:$APP_PORT/api';

class OpenClawBridge {
  constructor() {
    this.ws = null;
    this.reconnectInterval = 5000;
    this.isConnected = false;
  }

  connect() {
    console.log('Connecting to OpenClaw WebSocket...');
    
    this.ws = new WebSocket(OPENCLAW_WS_URL);
    
    this.ws.on('open', () => {
      console.log('Connected to OpenClaw');
      this.isConnected = true;
      this.sendHeartbeat();
    });
    
    this.ws.on('message', (data) => {
      this.handleMessage(data);
    });
    
    this.ws.on('close', () => {
      console.log('Disconnected from OpenClaw');
      this.isConnected = false;
      this.scheduleReconnect();
    });
    
    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }
  
  sendHeartbeat() {
    if (this.isConnected) {
      this.ws.send(JSON.stringify({
        type: 'heartbeat',
        timestamp: Date.now()
      }));
      setTimeout(() => this.sendHeartbeat(), 30000);
    }
  }
  
  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      console.log('Received:', message.type);
      
      // Forward relevant messages to dashboard
      if (message.type === 'session_update' || message.type === 'agent_status') {
        this.forwardToDashboard(message);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }
  
  async forwardToDashboard(message) {
    try {
      await axios.post(\`\${DASHBOARD_API_URL}/events\`, message);
    } catch (error) {
      console.error('Error forwarding to dashboard:', error);
    }
  }
  
  scheduleReconnect() {
    setTimeout(() => {
      console.log('Attempting to reconnect...');
      this.connect();
    }, this.reconnectInterval);
  }
}

// Start bridge
const bridge = new OpenClawBridge();
bridge.connect();
EOF

# Install bridge dependencies
cd /opt/$APP_NAME/integration
npm init -y
npm install ws axios

print_status "Installation complete!"
echo ""
echo "📊 AgentForge-OS Dashboard Deployment Summary:"
echo "--------------------------------------------"
echo "Application URL: http://$DOMAIN (or http://$VPS_HOST)"
echo "Application Port: $APP_PORT"
echo "PM2 Status: pm2 status $APP_NAME"
echo "Logs: pm2 logs $APP_NAME"
echo "Nginx Config: /etc/nginx/sites-available/$APP_NAME"
echo ""
echo "⚠️  Next Steps:"
echo "1. Update .env with your Telegram bot token"
echo "2. Configure your domain DNS to point to $VPS_HOST"
echo "3. Install SSL certificate: certbot --nginx -d $DOMAIN"
echo "4. Restart application: pm2 restart $APP_NAME"
echo ""
echo "🎯 OpenClaw Integration:"
echo "Make sure OpenClaw is running on port 18789"
echo "Bridge service: systemctl start openclaw-agentforge"
echo ""
print_status "Deployment completed successfully!"