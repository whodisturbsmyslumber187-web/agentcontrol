import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { useToast } from '../components/ui/use-toast'
import { useAgentStore } from '../stores/agent-store'
import { useBusinessStore } from '../stores/business-store'
import { insforge } from '../lib/insforge'
import { Lightbulb, MessageSquare, RefreshCw, Users, Rocket, Plus, Send, FlaskConical } from 'lucide-react'

interface Channel {
  id: string
  name: string
  slug: string
  description: string
  members: string[]
}

interface ChannelMessage {
  id: string
  channel_id: string
  sender_type: 'user' | 'agent' | 'system'
  sender_id: string | null
  sender_name: string
  message: string
  metadata: Record<string, unknown> | null
  created_at: string
}

interface ForumPost {
  id: string
  title: string
  message: string
  tags: string[]
  status: string
  project: string
  businessId: string
  sender_name: string
  sender_type: 'user' | 'agent' | 'system'
  created_at: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => asString(entry)).filter(Boolean).slice(0, 8)
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 8)
  }
  return []
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export default function AgentForum() {
  const { toast } = useToast()
  const { agents, fetchAgents } = useAgentStore()
  const { businesses, fetchBusinesses } = useBusinessStore()

  const [forumChannel, setForumChannel] = useState<Channel | null>(null)
  const [messages, setMessages] = useState<ChannelMessage[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [posting, setPosting] = useState(false)
  const [commenting, setCommenting] = useState(false)
  const [generatingIdeas, setGeneratingIdeas] = useState(false)
  const [selectedPostId, setSelectedPostId] = useState<string>('')
  const [commentInput, setCommentInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'solved'>('all')

  const [postForm, setPostForm] = useState({
    title: '',
    message: '',
    tags: '',
    project: '',
    businessId: '',
    status: 'open',
  })

  useEffect(() => {
    void initialize()
  }, [])

  useEffect(() => {
    if (!forumChannel) return
    const interval = setInterval(() => {
      void loadMessages(forumChannel.id)
    }, 5000)
    return () => clearInterval(interval)
  }, [forumChannel?.id])

  const initialize = async () => {
    setRefreshing(true)
    try {
      await Promise.all([fetchAgents(), fetchBusinesses()])
      const channel = await ensureForumChannel()
      setForumChannel(channel)
      await loadMessages(channel.id)
    } finally {
      setRefreshing(false)
    }
  }

  const ensureForumChannel = async () => {
    const existing = await insforge.database
      .from('agent_channels')
      .select()
      .eq('slug', 'agent-forum')
      .maybeSingle()

    if (existing.error) {
      throw existing.error
    }

    if (existing.data) {
      return existing.data as Channel
    }

    const created = await insforge.database
      .from('agent_channels')
      .insert({
        name: 'Agent Forum',
        slug: 'agent-forum',
        description: 'Agents share wins, blockers, and strategies.',
        members: [],
        is_private: false,
      })
      .select()
      .single()

    if (created.error || !created.data) {
      throw created.error || new Error('Failed creating forum channel')
    }

    return created.data as Channel
  }

  const loadMessages = async (channelId: string) => {
    const result = await insforge.database
      .from('channel_messages')
      .select()
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(600)

    if (result.error) {
      toast({
        title: 'Forum load failed',
        description: result.error.message,
        variant: 'destructive',
      })
      return
    }

    setMessages((result.data || []) as ChannelMessage[])
  }

  const posts = useMemo<ForumPost[]>(() => {
    return messages
      .filter((message) => {
        const metadata = isRecord(message.metadata) ? message.metadata : {}
        return asString(metadata.kind) === 'forum_post'
      })
      .map((message) => {
        const metadata = isRecord(message.metadata) ? message.metadata : {}
        return {
          id: message.id,
          title: asString(metadata.title, `Update from ${message.sender_name}`),
          message: message.message,
          tags: parseTags(metadata.tags),
          status: asString(metadata.status, 'open'),
          project: asString(metadata.project),
          businessId: asString(metadata.business_id || metadata.businessId),
          sender_name: message.sender_name,
          sender_type: message.sender_type,
          created_at: message.created_at,
        }
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [messages])

  const commentsByPost = useMemo(() => {
    const grouped = new Map<string, ChannelMessage[]>()
    for (const message of messages) {
      const metadata = isRecord(message.metadata) ? message.metadata : {}
      if (asString(metadata.kind) !== 'forum_comment') continue
      const postId = asString(metadata.post_id || metadata.postId)
      if (!postId) continue
      const list = grouped.get(postId) || []
      list.push(message)
      grouped.set(postId, list)
    }
    return grouped
  }, [messages])

  const filteredPosts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return posts.filter((post) => {
      if (statusFilter !== 'all' && post.status !== statusFilter) return false
      if (!query) return true
      const haystack = `${post.title} ${post.message} ${post.tags.join(' ')} ${post.project}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [posts, searchQuery, statusFilter])

  const selectedPost = useMemo(
    () => posts.find((post) => post.id === selectedPostId) || filteredPosts[0] || null,
    [posts, filteredPosts, selectedPostId],
  )

  useEffect(() => {
    if (!selectedPostId && filteredPosts.length > 0) {
      setSelectedPostId(filteredPosts[0].id)
    }
  }, [selectedPostId, filteredPosts])

  const createPost = async () => {
    if (!forumChannel) return
    if (!postForm.title.trim() || !postForm.message.trim()) {
      toast({
        title: 'Title and message required',
        description: 'Provide the project headline and details.',
        variant: 'destructive',
      })
      return
    }

    setPosting(true)
    try {
      const result = await insforge.database
        .from('channel_messages')
        .insert({
          channel_id: forumChannel.id,
          sender_type: 'user',
          sender_name: 'Operator',
          message: postForm.message.trim(),
          metadata: {
            kind: 'forum_post',
            title: postForm.title.trim(),
            tags: parseTags(postForm.tags),
            project: postForm.project.trim() || null,
            business_id: postForm.businessId || null,
            status: postForm.status,
          },
        })
        .select()
        .single()

      if (result.error || !result.data) {
        throw result.error || new Error('Post create failed')
      }

      await insforge.database.from('activity_log').insert({
        agent_name: 'Operator',
        message: `created forum post "${postForm.title.trim()}"`,
        type: 'info',
      })

      setPostForm({
        title: '',
        message: '',
        tags: '',
        project: '',
        businessId: '',
        status: 'open',
      })
      await loadMessages(forumChannel.id)
      setSelectedPostId((result.data as ChannelMessage).id)
      toast({ title: 'Forum post published' })
    } catch (error: any) {
      toast({
        title: 'Post failed',
        description: error.message || 'Could not publish post.',
        variant: 'destructive',
      })
    } finally {
      setPosting(false)
    }
  }

  const addComment = async () => {
    if (!forumChannel || !selectedPost || !commentInput.trim()) return
    setCommenting(true)
    try {
      const result = await insforge.database.from('channel_messages').insert({
        channel_id: forumChannel.id,
        sender_type: 'user',
        sender_name: 'Operator',
        message: commentInput.trim(),
        metadata: {
          kind: 'forum_comment',
          post_id: selectedPost.id,
        },
      })

      if (result.error) throw result.error
      setCommentInput('')
      await loadMessages(forumChannel.id)
    } catch (error: any) {
      toast({
        title: 'Comment failed',
        description: error.message || 'Could not add comment.',
        variant: 'destructive',
      })
    } finally {
      setCommenting(false)
    }
  }

  const askAgentBraintrust = async () => {
    if (!forumChannel || !selectedPost) return
    const activeAgents = agents.filter((agent) => agent.status === 'active' || agent.status === 'idle').slice(0, 6)
    if (activeAgents.length === 0) {
      toast({
        title: 'No active agents',
        description: 'Activate agents first to generate collaboration insights.',
        variant: 'destructive',
      })
      return
    }

    setGeneratingIdeas(true)
    try {
      for (const agent of activeAgents) {
        let responseText = ''
        try {
          const prompt = [
            `Forum post title: ${selectedPost.title}`,
            `Details: ${selectedPost.message}`,
            `Project: ${selectedPost.project || 'n/a'}`,
            'Provide one practical suggestion and one risk in under 120 words.',
          ].join('\n')

          const aiResponse = await (insforge.ai as any).generateText({
            model: 'openai/gpt-4o-mini',
            prompt,
            systemPrompt: `You are ${agent.name}, role: ${agent.role}. Collaborate with peer agents and be concrete.`,
          })

          responseText = asString(aiResponse?.data?.text || aiResponse?.text, '')
        } catch {
          responseText = ''
        }

        const fallback = `I recommend a two-step test rollout, then scale what proves ROI. Risk: unclear owner/accountability may block execution.`
        const text = responseText || fallback

        const insert = await insforge.database.from('channel_messages').insert({
          channel_id: forumChannel.id,
          sender_type: 'agent',
          sender_id: agent.id,
          sender_name: agent.name,
          message: text,
          metadata: {
            kind: 'forum_comment',
            post_id: selectedPost.id,
            role: agent.role,
            emoji: agent.emoji,
          },
        })

        if (insert.error) {
          console.error(insert.error)
        }
      }

      await loadMessages(forumChannel.id)
      toast({
        title: 'Agent insights posted',
        description: `${activeAgents.length} agents contributed suggestions.`,
      })
    } catch (error: any) {
      toast({
        title: 'Insight generation failed',
        description: error.message || 'Could not collect agent suggestions.',
        variant: 'destructive',
      })
    } finally {
      setGeneratingIdeas(false)
    }
  }

  const createWorkflowFromPost = async () => {
    if (!selectedPost) return
    try {
      const fallbackWebhook = `https://n8n.local/webhook/${slugify(selectedPost.title)}-${Date.now().toString().slice(-4)}`
      const result = await insforge.database.from('agent_workflows').insert({
        name: selectedPost.title,
        description: selectedPost.message,
        trigger_url: fallbackWebhook,
        is_active: false,
      })
      if (result.error) throw result.error
      toast({
        title: 'Workflow stub created',
        description: 'Open Workflows to wire the real n8n webhook URL.',
      })
    } catch (error: any) {
      toast({
        title: 'Workflow create failed',
        description: error.message || 'Could not create workflow stub.',
        variant: 'destructive',
      })
    }
  }

  const setPostStatus = async (post: ForumPost, status: 'open' | 'in_progress' | 'solved') => {
    const message = messages.find((entry) => entry.id === post.id)
    if (!message) return
    const metadata = isRecord(message.metadata) ? { ...message.metadata } : {}
    metadata.status = status
    const result = await insforge.database.from('channel_messages').update({ metadata }).eq('id', post.id)
    if (result.error) {
      toast({
        title: 'Status update failed',
        description: result.error.message,
        variant: 'destructive',
      })
      return
    }
    if (forumChannel) {
      await loadMessages(forumChannel.id)
    }
  }

  const selectedComments = selectedPost ? commentsByPost.get(selectedPost.id) || [] : []

  const activeCollaborators = agents.filter((agent) => agent.status === 'active' || agent.status === 'idle').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyber-white flex items-center gap-2">
            <Lightbulb className="h-7 w-7 text-cyber-green" />
            Agent Collaboration Forum
          </h2>
          <p className="text-sm text-cyber-gray">
            Shared battlefield for wins, blockers, experiments, and peer review across your empire.
          </p>
        </div>
        <Button
          onClick={() => void initialize()}
          disabled={refreshing}
          className="bg-cyber-green text-cyber-black hover:bg-cyber-green/80"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Syncing...' : 'Sync Forum'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-cyber-border bg-cyber-card">
          <CardContent className="p-4">
            <p className="text-xs text-cyber-gray">Forum Posts</p>
            <p className="text-2xl font-bold text-cyber-white">{posts.length}</p>
          </CardContent>
        </Card>
        <Card className="border-cyber-border bg-cyber-card">
          <CardContent className="p-4">
            <p className="text-xs text-cyber-gray">Total Comments</p>
            <p className="text-2xl font-bold text-cyber-green">
              {messages.filter((m) => asString(asRecord(m.metadata).kind) === 'forum_comment').length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-cyber-border bg-cyber-card">
          <CardContent className="p-4">
            <p className="text-xs text-cyber-gray">Active Collaborators</p>
            <p className="text-2xl font-bold text-cyber-white">{activeCollaborators}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="border-cyber-border bg-cyber-card xl:col-span-3">
          <CardHeader>
            <CardTitle className="text-cyber-white text-base">Publish Update</CardTitle>
            <CardDescription>Post what is working, blocked, or ready to scale.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label className="text-cyber-white">Title</Label>
              <Input
                value={postForm.title}
                onChange={(event) => setPostForm((current) => ({ ...current, title: event.target.value }))}
                className="border-cyber-border bg-cyber-black text-cyber-white"
                placeholder="e.g. Lead funnel +27% conversion"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-cyber-white">Details</Label>
              <textarea
                value={postForm.message}
                onChange={(event) => setPostForm((current) => ({ ...current, message: event.target.value }))}
                rows={5}
                className="w-full resize-none rounded-md border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white"
                placeholder="What changed, what worked, and what should other agents try?"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-cyber-white">Tags (comma separated)</Label>
              <Input
                value={postForm.tags}
                onChange={(event) => setPostForm((current) => ({ ...current, tags: event.target.value }))}
                className="border-cyber-border bg-cyber-black text-cyber-white"
                placeholder="n8n, livekit, sales"
              />
            </div>
            <Input
              value={postForm.project}
              onChange={(event) => setPostForm((current) => ({ ...current, project: event.target.value }))}
              className="border-cyber-border bg-cyber-black text-cyber-white"
              placeholder="Project / initiative"
            />
            <select
              value={postForm.businessId}
              onChange={(event) => setPostForm((current) => ({ ...current, businessId: event.target.value }))}
              className="w-full rounded-md border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white"
            >
              <option value="">No business linkage</option>
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))}
            </select>
            <select
              value={postForm.status}
              onChange={(event) => setPostForm((current) => ({ ...current, status: event.target.value }))}
              className="w-full rounded-md border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white"
            >
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="solved">Solved</option>
            </select>
            <div className="flex gap-2">
              <Button
                onClick={createPost}
                disabled={posting}
                className="flex-1 bg-cyber-green text-cyber-black hover:bg-cyber-green/80"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {posting ? 'Posting...' : 'Publish'}
              </Button>
              <Button
                variant="ghost"
                className="border border-cyber-border text-cyber-gray hover:text-cyber-white"
                onClick={() =>
                  setPostForm({
                    title: '',
                    message: '',
                    tags: '',
                    project: '',
                    businessId: '',
                    status: 'open',
                  })
                }
              >
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyber-border bg-cyber-card xl:col-span-4">
          <CardHeader>
            <CardTitle className="text-cyber-white text-base">Forum Feed</CardTitle>
            <CardDescription>All agent project updates and shared experiments.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_160px]">
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="border-cyber-border bg-cyber-black text-cyber-white"
                placeholder="Search posts, tags, or projects..."
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | 'open' | 'in_progress' | 'solved')}
                className="rounded-md border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white"
              >
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="solved">Solved</option>
              </select>
            </div>

            <div className="max-h-[720px] space-y-2 overflow-y-auto pr-1">
              {filteredPosts.map((post) => {
                const comments = commentsByPost.get(post.id) || []
                const active = selectedPost?.id === post.id
                return (
                  <button
                    key={post.id}
                    onClick={() => setSelectedPostId(post.id)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      active
                        ? 'border-cyber-green/40 bg-cyber-green/10'
                        : 'border-cyber-border bg-cyber-dark hover:border-cyber-green/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-cyber-white">{post.title}</p>
                      <Badge className="bg-cyber-black text-cyber-gray border border-cyber-border text-[10px]">
                        {post.status}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-cyber-gray">{post.message}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge className="bg-cyber-black text-cyber-gray border border-cyber-border text-[10px]">
                        by {post.sender_name}
                      </Badge>
                      <Badge className="bg-cyber-black text-cyan-300 border border-cyber-border text-[10px]">
                        {comments.length} comments
                      </Badge>
                      {post.tags.map((tag) => (
                        <Badge key={`${post.id}-${tag}`} className="bg-cyber-black text-cyber-green border border-cyber-border text-[10px]">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  </button>
                )
              })}

              {filteredPosts.length === 0 && (
                <div className="rounded-lg border border-dashed border-cyber-border bg-cyber-dark/30 p-6 text-center text-sm text-cyber-gray">
                  No posts match this filter.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyber-border bg-cyber-card xl:col-span-5">
          <CardHeader>
            <CardTitle className="text-cyber-white text-base">Discussion Thread</CardTitle>
            <CardDescription>Review comments, ask agents for ideas, and convert to workflows.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedPost && (
              <div className="rounded-lg border border-dashed border-cyber-border bg-cyber-dark/30 p-8 text-center text-sm text-cyber-gray">
                Select a forum post to open the thread.
              </div>
            )}

            {selectedPost && (
              <>
                <div className="rounded-lg border border-cyber-border bg-cyber-dark p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-base font-semibold text-cyber-white">{selectedPost.title}</p>
                    <div className="flex gap-1">
                      {(['open', 'in_progress', 'solved'] as const).map((status) => (
                        <Button
                          key={status}
                          size="sm"
                          variant="ghost"
                          onClick={() => void setPostStatus(selectedPost, status)}
                          className={`h-7 border ${
                            selectedPost.status === status
                              ? 'border-cyber-green/40 bg-cyber-green/15 text-cyber-green'
                              : 'border-cyber-border text-cyber-gray hover:text-cyber-white'
                          }`}
                        >
                          {status}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-cyber-gray">{selectedPost.message}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedPost.tags.map((tag) => (
                      <Badge key={`selected-${tag}`} className="bg-cyber-black text-cyber-green border border-cyber-border text-[10px]">
                        #{tag}
                      </Badge>
                    ))}
                    {selectedPost.project && (
                      <Badge className="bg-cyber-black text-cyan-300 border border-cyber-border text-[10px]">
                        {selectedPost.project}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => void askAgentBraintrust()}
                    disabled={generatingIdeas}
                    className="bg-cyan-500 text-cyan-950 hover:bg-cyan-400"
                  >
                    <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
                    {generatingIdeas ? 'Collecting Ideas...' : 'Ask Agent Braintrust'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => void createWorkflowFromPost()}
                    className="border border-cyber-border text-cyber-gray hover:text-cyber-white"
                  >
                    <Rocket className="mr-1.5 h-3.5 w-3.5" />
                    Create Workflow Stub
                  </Button>
                </div>

                <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
                  {selectedComments.map((comment) => {
                    const metadata = isRecord(comment.metadata) ? comment.metadata : {}
                    return (
                      <div key={comment.id} className="rounded-lg border border-cyber-border bg-cyber-dark/60 p-3">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-cyber-white">{comment.sender_name}</p>
                          {asString(metadata.role) && (
                            <Badge className="bg-cyber-black text-cyber-gray border border-cyber-border text-[10px]">
                              {asString(metadata.role)}
                            </Badge>
                          )}
                          <span className="ml-auto text-[10px] text-cyber-gray">
                            {new Date(comment.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-cyber-gray">{comment.message}</p>
                      </div>
                    )
                  })}

                  {selectedComments.length === 0 && (
                    <div className="rounded-lg border border-dashed border-cyber-border bg-cyber-dark/30 p-4 text-center text-sm text-cyber-gray">
                      No comments yet. Start the discussion.
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <textarea
                    value={commentInput}
                    onChange={(event) => setCommentInput(event.target.value)}
                    rows={2}
                    className="flex-1 resize-none rounded-md border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white"
                    placeholder="Comment with next step, improvement idea, or blocker fix..."
                  />
                  <Button
                    onClick={() => void addComment()}
                    disabled={commenting || !commentInput.trim()}
                    className="bg-cyber-green text-cyber-black hover:bg-cyber-green/80"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
