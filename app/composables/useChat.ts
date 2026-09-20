export interface ChatMessage {
  id: string | number
  threadId: string | number
  senderId: string | number
  senderName: string
  senderRole: 'customer' | 'provider' | 'system'
  text: string
  type: 'text' | 'proposal' | 'system'
  proposalData?: {
    id: string
    amount: number
    note?: string
    status: 'pending' | 'accepted' | 'declined'
    serviceTitle?: string
  } | null
  timestamp: string
  isMe?: boolean
}

export interface ChatThread {
  id: string | number
  participantId: string | number
  participantName: string
  participantRole: 'customer' | 'provider'
  participantTitle?: string
  avatarText?: string
  lastMessage?: string
  lastMessageTime?: string
  unreadCount: number
  context?: {
    type: 'service' | 'job' | 'booking' | 'general'
    id?: string | number
    title?: string
    amount?: number
  }
  createdAt: string
  updatedAt: string
}

/**
 * Server-backed customer <-> provider chat. Conversations and messages live in
 * the database (`/conversations` API) so they persist across devices and
 * sessions. A light poll keeps the open thread and the thread list fresh.
 */
export const useChat = () => {
  const { apiFetch, token } = useApi()
  const currentUser = useState<any>('chat_current_user', () => null)

  const threads = useState<ChatThread[]>('chat_threads', () => [])
  const messagesByThread = useState<Record<string, ChatMessage[]>>('chat_messages', () => ({}))
  const activeThreadId = useState<string | number | null>('chat_active_thread_id', () => null)
  const isInitialized = useState<boolean>('chat_is_initialized', () => false)
  const loadingThread = useState<boolean>('chat_loading_thread', () => false)

  let pollTimer: ReturnType<typeof setInterval> | null = null

  const ensureUser = async () => {
    if (!currentUser.value && token.value) {
      try { currentUser.value = await apiFetch('/user') } catch { currentUser.value = null }
    }
    return currentUser.value
  }

  const loadThreads = async () => {
    if (!token.value) { threads.value = []; return }
    try {
      const res: any = await apiFetch('/conversations')
      threads.value = res?.data ?? []
    } catch {
      // leave whatever we had
    }
  }

  const initializeChat = async () => {
    await ensureUser()
    if (!isInitialized.value) {
      await loadThreads()
      isInitialized.value = true
    }
  }

  const loadMessages = async (threadId: string | number) => {
    if (!token.value || threadId == null) return
    loadingThread.value = true
    try {
      const res: any = await apiFetch(`/conversations/${threadId}/messages`)
      messagesByThread.value = { ...messagesByThread.value, [threadId]: res?.data ?? [] }
    } catch {
      if (!messagesByThread.value[threadId]) {
        messagesByThread.value = { ...messagesByThread.value, [threadId]: [] }
      }
    } finally {
      loadingThread.value = false
    }
  }

  /**
   * Customer opens (or re-opens) a conversation with a provider.
   * `participantId` is the provider profile id. Returns the conversation id,
   * or null if it couldn't be created (e.g. a provider called this).
   */
  const startOrGetThread = async (options: {
    participantId: string | number
    participantName?: string
    participantRole?: 'customer' | 'provider'
    participantTitle?: string
    context?: ChatThread['context']
    initialMessage?: string
  }): Promise<string | number | null> => {
    await ensureUser()

    // If we already track a thread for this participant, reuse it.
    const existing = threads.value.find(t => String(t.participantId) === String(options.participantId))
    if (existing) {
      if (options.initialMessage) await sendMessage(existing.id, options.initialMessage)
      return existing.id
    }

    if (!token.value) return null

    try {
      const body: Record<string, any> = { provider_id: options.participantId }
      if (options.context?.type === 'booking' && options.context.id) {
        body.booking_id = options.context.id
      }
      const res: any = await apiFetch('/conversations', { method: 'POST', body })
      const thread: ChatThread = res.data
      if (thread) {
        threads.value = [thread, ...threads.value.filter(t => t.id !== thread.id)]
        if (!messagesByThread.value[thread.id]) {
          messagesByThread.value = { ...messagesByThread.value, [thread.id]: [] }
        }
        if (options.initialMessage) await sendMessage(thread.id, options.initialMessage)
        return thread.id
      }
    } catch {
      // provider hitting this, or bad id
    }
    return null
  }

  const bumpThread = (threadId: string | number, lastMessage: string, time: string) => {
    const t = threads.value.find(x => x.id === threadId)
    if (!t) return
    t.lastMessage = lastMessage
    t.lastMessageTime = time
    t.updatedAt = time
    threads.value = [t, ...threads.value.filter(x => x.id !== threadId)]
  }

  const sendMessage = async (
    threadId: string | number,
    text: string,
    type: 'text' | 'proposal' | 'system' = 'text',
    proposalData?: ChatMessage['proposalData'],
  ): Promise<ChatMessage | null> => {
    if (!text.trim() && type === 'text') return null
    if (!token.value) return null

    const body: Record<string, any> = { message: text.trim() }
    if (type === 'proposal' && proposalData) {
      body.type = 'proposal'
      body.meta = {
        amount: proposalData.amount,
        note: proposalData.note ?? '',
        serviceTitle: proposalData.serviceTitle ?? null,
      }
    }

    try {
      const res: any = await apiFetch(`/conversations/${threadId}/messages`, { method: 'POST', body })
      const msg: ChatMessage = res.data
      const list = messagesByThread.value[threadId] ?? []
      messagesByThread.value = { ...messagesByThread.value, [threadId]: [...list, msg] }
      bumpThread(
        threadId,
        msg.type === 'proposal' ? `Price offer: ETB ${Number(msg.proposalData?.amount || 0).toLocaleString()}` : msg.text,
        msg.timestamp,
      )
      return msg
    } catch {
      return null
    }
  }

  const sendPriceProposal = async (threadId: string | number, amount: number, note?: string, serviceTitle?: string) => {
    return sendMessage(threadId, `Price proposal: ETB ${amount.toLocaleString()}`, 'proposal', {
      id: '', amount, note: note || '', status: 'pending', serviceTitle,
    })
  }

  const updateProposalStatus = async (threadId: string | number, messageId: string | number, status: 'accepted' | 'declined') => {
    if (!token.value) return
    try {
      const res: any = await apiFetch(`/conversations/${threadId}/messages/${messageId}/respond`, {
        method: 'POST', body: { status },
      })
      messagesByThread.value = { ...messagesByThread.value, [threadId]: res?.data ?? [] }
      const list = messagesByThread.value[threadId]
      const last = list?.[list.length - 1]
      if (last) bumpThread(threadId, last.text, last.timestamp)
    } catch {
      // ignore
    }
  }

  const markAsRead = async (threadId: string | number) => {
    const t = threads.value.find(x => x.id === threadId)
    if (t) t.unreadCount = 0
    if (!token.value) return
    try { await apiFetch(`/conversations/${threadId}/read`, { method: 'POST' }) } catch {}
  }

  const startPolling = () => {
    if (pollTimer || !import.meta.client) return
    pollTimer = setInterval(async () => {
      if (!token.value) return
      const active = activeThreadId.value
      if (active != null) {
        await loadMessages(active)
        await markAsRead(active) // user is looking at this thread — keep it read
      }
      await loadThreads()
    }, 8000)
  }

  const stopPolling = () => {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  }

  const totalUnreadCount = computed(() =>
    threads.value.reduce((sum, t) => sum + (t.unreadCount || 0), 0),
  )

  return {
    threads,
    messagesByThread,
    activeThreadId,
    loadingThread,
    totalUnreadCount,
    initializeChat,
    loadThreads,
    loadMessages,
    startOrGetThread,
    sendMessage,
    sendPriceProposal,
    updateProposalStatus,
    markAsRead,
    startPolling,
    stopPolling,
  }
}
