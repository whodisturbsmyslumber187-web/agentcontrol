#!/usr/bin/env node

/**
 * VPS Setup Script for AgentForge-OS
 * Run this on your Hostinger VPS to prepare for deployment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log(`
╔══════════════════════════════════════════════════════════════╗
║                AgentForge-OS VPS Setup Script               ║
║                    Brotherhood Empire Edition               ║
╚══════════════════════════════════════════════════════════════╝
`);

async function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function runCommand(cmd, description) {
  console.log(`\n📦 ${description}...`);
  try {
    const output = execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('This script will prepare your VPS for AgentForge-OS deployment.');
  console.log('Requirements:');
  console.log('  • Ubuntu 20.04/22.04/24.04');
  console.log('  • Root/sudo access');
  console.log('  • Minimum 2GB RAM, 20GB disk');
  console.log('');
  
  const proceed = await askQuestion('Continue with setup? (y/N): ');
  if (proceed.toLowerCase() !== 'y') {
    console.log('Setup cancelled.');
    rl.close();
    return;
  }
  
  // 1. Update system
  await runCommand('apt-get update', 'Updating package lists');
  await runCommand('apt-get upgrade -y', 'Upgrading system packages');
  
  // 2. Install Node.js
  await runCommand('curl -fsSL https://deb.nodesource.com/setup_18.x | bash -', 'Adding Node.js repository');
  await runCommand('apt-get install -y nodejs', 'Installing Node.js');
  
  // 3. Install PM2
  await runCommand('npm install -g pm2', 'Installing PM2 process manager');
  
  // 4. Install nginx
  await runCommand('apt-get install -y nginx', 'Installing nginx web server');
  
  // 5. Install OpenClaw dependencies
  await runCommand('apt-get install -y git curl wget build-essential', 'Installing build tools');
  
  // 6. Configure firewall
  console.log('\n🔒 Configuring firewall...');
  try {
    execSync('ufw allow 22/tcp', { stdio: 'inherit' });
    execSync('ufw allow 80/tcp', { stdio: 'inherit' });
    execSync('ufw allow 443/tcp', { stdio: 'inherit' });
    execSync('ufw --force enable', { stdio: 'inherit' });
    console.log('✅ Firewall configured');
  } catch (error) {
    console.log('⚠️  Firewall configuration skipped (ufw may not be installed)');
  }
  
  // 7. Create application directory
  console.log('\n📁 Creating application structure...');
  execSync('mkdir -p /opt/agentforge-os', { stdio: 'inherit' });
  execSync('mkdir -p /var/log/agentforge-os', { stdio: 'inherit' });
  
  // 8. Create deployment instructions
  const instructions = `
# AgentForge-OS Deployment Instructions
# =====================================

## 1. Copy Application Files
# On your local machine:
#   tar -czf agentforge-os.tar.gz agentforge-os/
#   scp agentforge-os.tar.gz root@${await askQuestion('Enter your VPS IP: ')}:/opt/

## 2. On VPS:
#   cd /opt
#   tar -xzf agentforge-os.tar.gz
#   cd agentforge-os
#   npm install
#   npm run build

## 3. Configure Environment
# Edit .env file with your settings:
#   VITE_OPENCLAW_API_URL=http://localhost:18789
#   VITE_TELEGRAM_BOT_TOKEN=your_bot_token_here

## 4. Start Application
#   pm2 start ecosystem.config.js
#   pm2 save
#   pm2 startup

## 5. Configure nginx
#   cp nginx.conf /etc/nginx/sites-available/agentforge-os
#   ln -s /etc/nginx/sites-available/agentforge-os /etc/nginx/sites-enabled/
#   nginx -t
#   systemctl restart nginx

## 6. OpenClaw Integration
# Make sure OpenClaw is running on this machine or accessible via network.
# Default port: 18789

## 7. Access Dashboard
#   http://your-vps-ip:5173
#   or configure domain in nginx.conf

## 8. Monitor
#   pm2 status
#   pm2 logs agentforge-os
#   tail -f /var/log/agentforge-os/*.log
`;
  
  fs.writeFileSync('/opt/agentforge-os/DEPLOYMENT.md', instructions);
  
  // 9. Create nginx config template
  const nginxConfig = `
server {
    listen 80;
    server_name agentforge.local;
    
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`;
  
  fs.writeFileSync('/opt/agentforge-os/nginx.conf', nginxConfig);
  
  // 10. Create PM2 config
  const pm2Config = `
module.exports = {
  apps: [{
    name: 'agentforge-os',
    script: 'node_modules/.bin/vite',
    args: 'preview --port 5173 --host',
    env: {
      NODE_ENV: 'production'
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: '/var/log/agentforge-os/error.log',
    out_file: '/var/log/agentforge-os/out.log',
    log_file: '/var/log/agentforge-os/combined.log',
    time: true
  }]
};
`;
  
  fs.writeFileSync('/opt/agentforge-os/ecosystem.config.js', pm2Config);
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ VPS SETUP COMPLETE!');
  console.log('='.repeat(60));
  console.log('\nNext steps:');
  console.log('1. Copy AgentForge-OS files to /opt/agentforge-os/');
  console.log('2. Run: cd /opt/agentforge-os && npm install');
  console.log('3. Configure .env file with your settings');
  console.log('4. Run: npm run build');
  console.log('5. Start with: pm2 start ecosystem.config.js');
  console.log('6. Configure nginx: cp nginx.conf /etc/nginx/sites-available/');
  console.log('\nDetailed instructions: /opt/agentforge-os/DEPLOYMENT.md');
  console.log('\nFor OpenClaw node pairing:');
  console.log('Run OpenClaw on this machine or ensure it\'s accessible at:');
  console.log('  http://localhost:18789');
  console.log('\n🎯 Brotherhood Empire operational.');
  
  rl.close();
}

// Run setup
main().catch(console.error);