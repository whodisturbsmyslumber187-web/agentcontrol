import React, { useState } from 'react'
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
  MoreVertical,
  Edit,
  Trash2,
  Pause,
  Play,
  X,
  Save
} from 'lucide-react'
import { Business, useBusinessStore } from '../../stores/business-store'

interface BusinessMetricsProps {
  businesses: Business[]
}

export default function BusinessMetrics({ businesses }: BusinessMetricsProps) {
  const { metrics, addBusiness, updateBusiness, removeBusiness } = useBusinessStore()
  const [showAdd, setShowAdd] = useState(false)
  const [editBiz, setEditBiz] = useState<Business | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [addForm, setAddForm] = useState({ name: '', type: 'ecommerce' as Business['type'], revenue: 0, expenses: 0 })
  const [saving, setSaving] = useState(false)

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

  const handleAddBusiness = async () => {
    if (!addForm.name) return
    setSaving(true)
    await addBusiness({
      name: addForm.name,
      type: addForm.type,
      revenue: addForm.revenue,
      expenses: addForm.expenses,
      profit: addForm.revenue - addForm.expenses,
    })
    setShowAdd(false)
    setAddForm({ name: '', type: 'ecommerce', revenue: 0, expenses: 0 })
    setSaving(false)
  }

  const handleToggleStatus = async (biz: Business) => {
    const newStatus = biz.status === 'active' ? 'paused' : 'active'
    await updateBusiness(biz.id, { status: newStatus })
    setMenuOpen(null)
  }

  const handleDeleteBusiness = async (biz: Business) => {
    if (!window.confirm(`Delete "${biz.name}"? This cannot be undone.`)) return
    await removeBusiness(biz.id)
    setMenuOpen(null)
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
                <p className="text-2xl font-bold text-cyber-white">${metrics.totalRevenue.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-cyber-green/20 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-cyber-green" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-cyber-card border-cyber-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-cyber-gray">Total Profit</p>
                <p className={`text-2xl font-bold ${metrics.totalProfit >= 0 ? 'text-cyber-green' : 'text-red-400'}`}>
                  ${metrics.totalProfit.toLocaleString()}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-cyber-green/20 flex items-center justify-center">
                {metrics.totalProfit >= 0 ? <TrendingUp className="h-6 w-6 text-cyber-green" /> : <TrendingDown className="h-6 w-6 text-red-400" />}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-cyber-card border-cyber-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-cyber-gray">Active Businesses</p>
                <p className="text-2xl font-bold text-cyber-white">{metrics.activeBusinesses}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-cyber-green/20 flex items-center justify-center">
                <Users className="h-6 w-6 text-cyber-green" />
              </div>
            </div>
            <div className="mt-4 text-sm text-cyber-gray">{metrics.totalAgentsAssigned} agents assigned</div>
          </CardContent>
        </Card>

        <Card className="bg-cyber-card border-cyber-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-cyber-gray">Avg Conversion</p>
                <p className="text-2xl font-bold text-cyber-white">{metrics.averageConversionRate.toFixed(1)}%</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-cyber-green/20 flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-cyber-green" />
              </div>
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
              <CardDescription className="text-cyber-gray">Monitor and manage all your business ventures</CardDescription>
            </div>
            <Button onClick={() => setShowAdd(true)} className="bg-cyber-green hover:bg-cyber-green/80 text-cyber-black">
              <Plus className="h-4 w-4 mr-2" />
              Add Business
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Add Business Form */}
          {showAdd && (
            <div className="mb-6 p-4 bg-cyber-dark border border-cyber-green/30 rounded-lg">
              <h4 className="text-sm font-semibold text-cyber-white mb-3">New Business Venture</h4>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-cyber-gray block mb-1">Name *</label>
                  <input
                    type="text"
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    placeholder="Business name..."
                    className="w-full bg-cyber-card border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-cyber-gray block mb-1">Type</label>
                  <select
                    value={addForm.type}
                    onChange={(e) => setAddForm({ ...addForm, type: e.target.value as Business['type'] })}
                    aria-label="Business type"
                    className="w-full bg-cyber-card border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                  >
                    <option value="ecommerce">E-Commerce</option>
                    <option value="saas">SaaS</option>
                    <option value="consulting">Consulting</option>
                    <option value="trading">Trading</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-cyber-gray block mb-1">Revenue ($)</label>
                  <input
                    type="number"
                    value={addForm.revenue}
                    onChange={(e) => setAddForm({ ...addForm, revenue: Number(e.target.value) })}
                    className="w-full bg-cyber-card border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-cyber-gray block mb-1">Expenses ($)</label>
                  <input
                    type="number"
                    value={addForm.expenses}
                    onChange={(e) => setAddForm({ ...addForm, expenses: Number(e.target.value) })}
                    className="w-full bg-cyber-card border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddBusiness} disabled={saving || !addForm.name} className="bg-cyber-green text-cyber-black hover:opacity-90">
                  {saving ? 'Saving...' : <><Save className="h-4 w-4 mr-1" /> Save</>}
                </Button>
                <Button onClick={() => setShowAdd(false)} variant="ghost" className="text-cyber-gray">Cancel</Button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-cyber-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-cyber-gray">Business</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-cyber-gray">Type</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-cyber-gray">Revenue</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-cyber-gray">Profit</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-cyber-gray">Agents</th>
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
                            {business.lastUpdated ? new Date(business.lastUpdated).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={getBusinessTypeColor(business.type)}>{business.type}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-cyber-white">${business.revenue.toLocaleString()}</div>
                      <div className="text-sm text-cyber-gray">${business.expenses.toLocaleString()} expenses</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className={`font-medium ${business.profit >= 0 ? 'text-cyber-green' : 'text-red-400'}`}>
                        ${business.profit.toLocaleString()}
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
                      <button onClick={() => handleToggleStatus(business)}>
                        <Badge className={`cursor-pointer ${
                          business.status === 'active' ? 'bg-cyber-green text-cyber-black' 
                          : business.status === 'paused' ? 'bg-yellow-500/80 text-black'
                          : 'bg-cyber-gray text-cyber-white'
                        }`}>
                          {business.status === 'active' ? '● Active' : business.status === 'paused' ? '⏸ Paused' : business.status}
                        </Badge>
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <div className="relative">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setMenuOpen(menuOpen === business.id ? null : business.id)}
                          className="h-8 w-8 p-0 hover:bg-cyber-green/20"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                        {menuOpen === business.id && (
                          <div className="absolute right-0 top-9 z-10 w-40 bg-cyber-dark border border-cyber-border rounded-lg shadow-xl py-1">
                            <button
                              onClick={() => handleToggleStatus(business)}
                              className="w-full text-left px-3 py-2 text-xs text-cyber-gray hover:text-cyber-white hover:bg-cyber-card flex items-center gap-2"
                            >
                              {business.status === 'active' ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                              {business.status === 'active' ? 'Pause' : 'Activate'}
                            </button>
                            <button
                              onClick={() => handleDeleteBusiness(business)}
                              className="w-full text-left px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-cyber-card flex items-center gap-2"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
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
              <p className="text-cyber-gray mb-6">Start by adding your first business venture</p>
              <Button onClick={() => setShowAdd(true)} className="bg-cyber-green hover:bg-cyber-green/80 text-cyber-black">
                <Plus className="h-4 w-4 mr-2" />
                Add First Business
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}