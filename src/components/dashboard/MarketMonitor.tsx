import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  DollarSign,
  BarChart3,
  RefreshCw,
  Bell,
  BellOff,
  Zap
} from 'lucide-react'

interface MarketData {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  high: number
  low: number
  volume: number
  lastUpdated: string
  alertThreshold?: number
}

export default function MarketMonitor() {
  const [marketData, setMarketData] = useState<MarketData[]>([
    {
      symbol: 'XAGUSD',
      name: 'Silver',
      price: 24.85,
      change: 0.42,
      changePercent: 1.72,
      high: 25.10,
      low: 24.30,
      volume: 1250000,
      lastUpdated: new Date().toISOString(),
      alertThreshold: 2.0
    },
    {
      symbol: 'XAUUSD',
      name: 'Gold',
      price: 2185.50,
      change: 12.75,
      changePercent: 0.59,
      high: 2190.20,
      low: 2172.80,
      volume: 850000,
      lastUpdated: new Date().toISOString(),
      alertThreshold: 1.5
    },
    {
      symbol: 'BTCUSD',
      name: 'Bitcoin',
      price: 68542.30,
      change: 1245.80,
      changePercent: 1.85,
      high: 69200.50,
      low: 67800.20,
      volume: 32500000000,
      lastUpdated: new Date().toISOString(),
      alertThreshold: 5.0
    },
    {
      symbol: 'SPX',
      name: 'S&P 500',
      price: 5250.75,
      change: -15.25,
      changePercent: -0.29,
      high: 5265.80,
      low: 5235.40,
      volume: 2850000000,
      lastUpdated: new Date().toISOString(),
      alertThreshold: 2.0
    }
  ])

  const [alertsEnabled, setAlertsEnabled] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchMarketData = async () => {
    setIsRefreshing(true)
    try {
      // In production, this would fetch from your silver_monitor.py API
      // For now, we'll simulate with random changes
      const updatedData = marketData.map(item => ({
        ...item,
        price: item.price + (Math.random() - 0.5) * item.price * 0.01,
        change: item.change + (Math.random() - 0.5) * 0.1,
        changePercent: item.changePercent + (Math.random() - 0.5) * 0.05,
        lastUpdated: new Date().toISOString()
      }))
      setMarketData(updatedData)
    } catch (error) {
      console.error('Error fetching market data:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchMarketData, 30000)
    return () => clearInterval(interval)
  }, [])

  const getChangeColor = (change: number) => {
    return change >= 0 ? 'text-cyber-green' : 'text-cyber-red'
  }

  const getChangeIcon = (change: number) => {
    return change >= 0 ? 
      <TrendingUp className="h-4 w-4" /> : 
      <TrendingDown className="h-4 w-4" />
  }

  const shouldAlert = (item: MarketData) => {
    return Math.abs(item.changePercent) >= (item.alertThreshold || 2.0)
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyber-white">Market Watch</h2>
          <p className="text-cyber-gray">Real-time market monitoring with alert system</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            onClick={() => setAlertsEnabled(!alertsEnabled)}
            className={`border ${
              alertsEnabled ? 'border-cyber-green text-cyber-green' : 'border-cyber-gray text-cyber-gray'
            }`}
          >
            {alertsEnabled ? (
              <Bell className="h-4 w-4 mr-2" />
            ) : (
              <BellOff className="h-4 w-4 mr-2" />
            )}
            {alertsEnabled ? 'Alerts On' : 'Alerts Off'}
          </Button>
          <Button
            onClick={fetchMarketData}
            disabled={isRefreshing}
            className="bg-cyber-green hover:bg-cyber-green/80 text-cyber-black"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Market Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {marketData.map((item) => (
          <Card 
            key={item.symbol}
            className={`bg-cyber-card border ${
              shouldAlert(item) && alertsEnabled
                ? 'border-cyber-yellow animate-pulse'
                : 'border-cyber-border'
            }`}
          >
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-cyber-white">{item.symbol}</h3>
                    {shouldAlert(item) && alertsEnabled && (
                      <AlertTriangle className="h-4 w-4 text-cyber-yellow" />
                    )}
                  </div>
                  <p className="text-sm text-cyber-gray">{item.name}</p>
                </div>
                <div className={`flex items-center ${getChangeColor(item.change)}`}>
                  {getChangeIcon(item.change)}
                  <span className="ml-1 font-medium">
                    {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-cyber-gray">Price:</span>
                  <span className="text-2xl font-bold text-cyber-white">
                    {item.symbol.startsWith('X') ? '$' : ''}{item.price.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-cyber-gray">24h Change:</span>
                  <span className={`font-medium ${getChangeColor(item.change)}`}>
                    {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-cyber-gray">24h Range:</span>
                  <span className="text-cyber-white">
                    {item.low.toFixed(2)} - {item.high.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-cyber-gray">Volume:</span>
                  <span className="text-cyber-white">
                    {item.volume >= 1000000 
                      ? `${(item.volume / 1000000).toFixed(1)}M` 
                      : item.volume.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-cyber-gray">Alert Threshold:</span>
                  <span className="text-cyber-yellow">±{item.alertThreshold}%</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-cyber-border">
                <div className="flex items-center justify-between text-xs text-cyber-gray">
                  <span>Last updated:</span>
                  <span>{new Date(item.lastUpdated).toLocaleTimeString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Silver Monitor Integration */}
      <Card className="bg-cyber-card border-cyber-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-cyber-white">Silver Monitor Integration</CardTitle>
              <CardDescription className="text-cyber-gray">
                Connected to your silver monitoring system
              </CardDescription>
            </div>
            <Badge className="bg-cyber-green text-cyber-black">
              <Zap className="h-3 w-3 mr-1" />
              Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-cyber-gray">Current Price:</span>
                <span className="text-2xl font-bold text-cyber-green">
                  ${marketData.find(m => m.symbol === 'XAGUSD')?.price.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-cyber-gray">Daily Change:</span>
                <span className={`text-lg font-medium ${
                  marketData.find(m => m.symbol === 'XAGUSD')?.changePercent! >= 0 
                    ? 'text-cyber-green' 
                    : 'text-cyber-red'
                }`}>
                  {marketData.find(m => m.symbol === 'XAGUSD')?.changePercent.toFixed(2)}%
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-cyber-gray">Alert Threshold:</span>
                <span className="text-cyber-yellow">2.0%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-cyber-gray">Last Alert:</span>
                <span className="text-cyber-white">2 hours ago</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-cyber-gray">Telegram Alerts:</span>
                <Badge className="bg-cyber-green text-cyber-black">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-cyber-gray">Monitoring Frequency:</span>
                <span className="text-cyber-white">Hourly</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-cyber-border">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-cyber-white">Recent Alerts</h4>
                <p className="text-sm text-cyber-gray">Last 24 hours of silver price movements</p>
              </div>
              <Button
                variant="outline"
                className="border-cyber-green text-cyber-green hover:bg-cyber-green/20"
              >
                View All Alerts
              </Button>
            </div>
            
            <div className="mt-4 space-y-3">
              {[
                { time: '14:30', message: 'Silver price increased by 2.3%', type: 'up' },
                { time: '11:15', message: 'Silver price decreased by 1.8%', type: 'down' },
                { time: '09:45', message: 'Silver price increased by 2.1%', type: 'up' },
              ].map((alert, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-cyber-dark/50"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      alert.type === 'up' ? 'bg-cyber-green/20' : 'bg-cyber-red/20'
                    }`}>
                      {alert.type === 'up' ? (
                        <TrendingUp className="h-4 w-4 text-cyber-green" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-cyber-red" />
                      )}
                    </div>
                    <div>
                      <p className="text-cyber-white">{alert.message}</p>
                      <p className="text-sm text-cyber-gray">{alert.time}</p>
                    </div>
                  </div>
                  <Badge className={
                    alert.type === 'up' 
                      ? 'bg-cyber-green text-cyber-black' 
                      : 'bg-cyber-red text-cyber-white'
                  }>
                    {alert.type === 'up' ? 'Bullish' : 'Bearish'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Market Overview Chart */}
      <Card className="bg-cyber-card border-cyber-border">
        <CardHeader>
          <CardTitle className="text-cyber-white">Market Overview</CardTitle>
          <CardDescription className="text-cyber-gray">
            Performance across all monitored assets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center border border-dashed border-cyber-border rounded-lg">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 text-cyber-gray mx-auto mb-4" />
              <p className="text-cyber-gray">Market performance chart</p>
              <p className="text-sm text-cyber-gray/70 mt-2">
                Connect to trading APIs for live visualization
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}