import { describe, expect, it } from 'vitest'
import {
  createTemplateWorkflowFromDraft,
  normalizeN8nWorkflowRows,
  normalizeUrl,
  sanitizeBaseUrl,
  webhookPathFromTriggerUrl,
  type WorkflowImportDraft,
} from './Workflows'

describe('Workflows utilities', () => {
  it('normalizes base url and relative webhook paths', () => {
    expect(sanitizeBaseUrl('https://n8n.example.com///')).toBe('https://n8n.example.com')
    expect(normalizeUrl('/webhook/lead-sync', 'https://n8n.example.com/')).toBe(
      'https://n8n.example.com/webhook/lead-sync',
    )
  })

  it('extracts webhook path from trigger url for the same n8n host', () => {
    expect(
      webhookPathFromTriggerUrl(
        'https://n8n.example.com/webhook/sales/inbound',
        'https://n8n.example.com',
      ),
    ).toBe('sales/inbound')

    expect(
      webhookPathFromTriggerUrl(
        'https://other.example.com/webhook/sales/inbound',
        'https://n8n.example.com',
      ),
    ).toBe('')
  })

  it('normalizes n8n workflow rows from API payload', () => {
    const rows = normalizeN8nWorkflowRows({
      data: [
        {
          id: 'wf_1',
          name: 'Sales Intake',
          active: true,
          webhookUrls: ['https://n8n.example.com/webhook/sales-intake'],
          nodes: [
            {
              type: 'n8n-nodes-base.webhook',
              parameters: { path: 'sales-intake' },
            },
          ],
        },
      ],
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('wf_1')
    expect(rows[0].active).toBe(true)
    expect(rows[0].webhookPaths).toContain('sales-intake')
    expect(rows[0].triggerUrls).toContain('https://n8n.example.com/webhook/sales-intake')
  })

  it('creates a fallback n8n template workflow from draft data', () => {
    const draft: WorkflowImportDraft = {
      name: 'Inbound Router',
      description: 'Routes inbound calls',
      trigger_url: 'https://n8n.example.com/webhook/inbound-router',
      is_active: true,
      source: 'line',
    }

    const template = createTemplateWorkflowFromDraft(draft, 'https://n8n.example.com')
    const nodes = Array.isArray(template.nodes) ? template.nodes : []
    const webhook = nodes.find((node) => (node as Record<string, unknown>).name === 'Webhook') as
      | Record<string, unknown>
      | undefined
    const parameters =
      webhook && typeof webhook.parameters === 'object' ? (webhook.parameters as Record<string, unknown>) : {}

    expect(template.name).toBe('Inbound Router')
    expect(parameters.path).toBe('inbound-router')
  })
})
