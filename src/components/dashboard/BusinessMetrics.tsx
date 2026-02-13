import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  ShoppingCart,
  BarChart3,
  Plus,
  MoreVertical
} from 'lucide-react'
import { Business } from '../../stores/business-store'
import { useBusinessStore } from '../../stores/business-store'

interface BusinessMetricsProps {
  businesses: Business[]
}

export default function BusinessMetrics({ businesses }: BusinessMetricsProps) {
  const { metrics } = useBusinessStore()

  const getBusinessTypeColor = (type: string) => {
    switch (type) {
      case 'ecommerce': return 'bg-blue-500/20 text-blue-400'
      case 'saas': return 'bg-purple-500/20 text-purple-400'
      case 'consulting': return 'bg-cyan-500/20 text-cyan-400'
      case 'trading': return 'bg-cyber-green/20 text-cyber-green'
      default: return 'bg-cyber-gray/20 text-cyber-gray'
    }
  }

  const getBusinessIcon = (type: string) => {
    switch (type) {
      case 'ecommerce': return <ShoppingCart className="h-5 w-5" />
      case 'saas': return <BarChart3 className="h-5 w-5" />
      case 'consulting': return <Users className="h-5 w-5" />
      case 'trading': return <TrendingUp className="h-5 w-5" />
      default: return <DollarSign className="h-5 w-5" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-cyber-card border-cyber-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-cyber-gray">Total Revenue</p>
                <p className="text-2xl font-bold text-cyber-white">
                  ${metrics.totalRevenue.toLocaleString()}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-cyber-green/20 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-cyber-green" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <TrendingUp className="h-4 w-4 text-cyber-green mr-1" />
              <span className="text-cyber-green">+12.5%</span>
              <span className="text-cyber-gray ml-2">from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-cyber-card border-cyber-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-cyber-gray">Total Profit</p>
                <p className="text-2xl font-bold text-cyber-white">
                  ${metrics.totalProfit.toLocaleString()}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-cyber-green/20 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-cyber-green" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <TrendingUp className="h-4 w-4 text-cyber-green mr-1" />
              <span className="text-cyber-green">+8.3%</span>
              <span className="text-cyber-gray ml-2">from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-cyber-card border-cyber-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-cyber-gray">Active Businesses</p>
                <p className="text-2xl font-bold text-cyber-white">
                  {metrics.activeBusinesses}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-cyber-green/20 flex items-center justify-center">
                <Users className="h-6 w-6 text-cyber-green" />
              </div>
            </div>
            <div className="mt-4 text-sm text-cyber-gray">
              {metrics.totalAgentsAssigned} agents assigned
            </div>
          </CardContent>
        </Card>

        <Card className="bg-cyber-card border-cyber-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-cyber-gray">Avg Conversion</p>
                <p className="text-2xl font-bold text-cyber-white">
                  {metrics.averageConversionRate.toFixed(1)}%
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-cyber-green/20 flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-cyber-green" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <TrendingUp className="h-4 w-4 text-cyber-green mr-1" />
              <span className="text-cyber-green">+2.1%</span>
              <span className="text-cyber-gray ml-2">from last month</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Business List */}
      <Card className="bg-cyber-card border-cyber-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-cyber-white">Business Operations</CardTitle>
              <CardDescription className="text-cyber-gray">
                Monitor and manage all your business ventures
              </CardDescription>
            </div>
            <Button className="bg-cyber-green hover:bg-cyber-green/80 text-cyber-black">
              <Plus className="h-4 w-4 mr-2" />
              Add Business
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-cyber-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-cyber-gray">Business</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-cyber-gray">Type</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-cyber-gray">Revenue</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-cyber-gray">Profit</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-cyber-gray">Agents</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-cyber-gray">Tasks</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-cyber-gray">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-cyber-gray">Actions</th>
                </tr>
              </thead>
              <tbody>
                {businesses.map((business) => (
                  <tr key={business.id} className="border-b border-cyber-border/50 hover:bg-cyber-dark/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          business.status === 'active' ? 'bg-cyber-green/20' : 'bg-cyber-gray/20'
                        }`}>
                          {getBusinessIcon(business.type)}
                        </div>
                        <div>
                          <p className="font-medium text-cyber-white">{business.name}</p>
                          <p className="text-sm text-cyber-gray">
                            Updated: {new Date(business.lastUpdated).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={getBusinessTypeColor(business.type)}>
                        {business.type}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-cyber-white">
                        ${business.revenue.toLocaleString()}
                      </div>
                      <div className="text-sm text-cyber-gray">
                        ${business.expenses.toLocaleString()} expenses
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className={`font-medium ${
                        business.profit >= 0 ? 'text-cyber-green' : 'text-cyber-red'
                      }`}>
                        ${business.profit.toLocaleString()}
                      </div>
                      <div className="text-sm text-cyber-gray">
                        {business.profit >= 0 ? 'Profit' : 'Loss'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-1">
                        <div className="h-8 w-8 rounded-full bg-cyber-green/20 flex items-center justify-center">
                          <Users className="h-4 w-4 text-cyber-green" />
                        </div>
                        <span className="text-cyber-white">{business.agents.length}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center">
                        <div className="w-24 bg-cyber-dark rounded-full h-2">
                          <div 
                            className="bg-cyber-green h-2 rounded-full"
                            style={{ width: `${Math.min(business.pendingTasks * 10, 100)}%` }}
                          ></div>
                        </div>
                        <span className="ml-2 text-cyber-white">{business.pendingTasks}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={
                        business.status === 'active' 
                          ? 'bg-cyber-green text-cyber-black' 
                          : business.status === 'paused'
                          ? 'bg-cyber-yellow text-cyber-black'
                          : 'bg-cyber-gray text-cyber-white'
                      }>
                        {business.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 hover:bg-cyber-green/20"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {businesses.length === 0 && (
            <div className="text-center py-12">
              <div className="h-16 w-16 rounded-full bg-cyber-green/20 flex items-center justify-center mx-auto mb-4">
                <DollarSign className="h-8 w-8 text-cyber-green" />
              </div>
              <h3 className="text-lg font-semibold text-cyber-white mb-2">No Businesses Found</h3>
              <p className="text-cyber-gray mb-6">
                Start by adding your first business venture
              </p>
              <Button className="bg-cyber-green hover:bg-cyber-green/80 text-cyber-black">
                <Plus className="h-4 w-4 mr-2" />
                Add First Business
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revenue Chart Placeholder */}
      <Card className="bg-cyber-card border-cyber-border">
        <CardHeader>
          <CardTitle className="text-cyber-white">Revenue Trends</CardTitle>
          <CardDescription className="text-cyber-gray">
            Monthly revenue across all businesses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center border border-dashed border-cyber-border rounded-lg">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 text-cyber-gray mx-auto mb-4" />
              <p className="text-cyber-gray">Revenue chart visualization</p>
              <p className="text-sm text-cyber-gray/70 mt-2">
                Connect to your accounting software for live data
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}