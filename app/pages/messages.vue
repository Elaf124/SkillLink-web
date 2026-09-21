<script setup lang="ts">
definePageMeta({ layout: 'default', middleware: ['auth'] })

const route = useRoute()
const router = useRouter()
const { apiFetch } = useApi()
const goBack = useGoBack('/dashboard')
const { resolveMediaUrl } = useProviderAvatar()

const {
  threads,
  messagesByThread,
  activeThreadId,
  loadingThread,
  initializeChat,
  loadMessages,
  startOrGetThread,
  sendMessage,
  sendPriceProposal,
  updateProposalStatus,
  markAsRead,
  startPolling,
  stopPolling,
} = useChat()

const searchQuery = ref('')
const activeFilter = ref<'all' | 'unread' | 'negotiations'>('all')
const newMessageText = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const messageInput = ref<HTMLTextAreaElement | null>(null)

// Proposal modal state
const showProposalModal = ref(false)
const proposalAmount = ref<number | ''>('')
const proposalNote = ref('')

// Find provider modal
const showFindProviderModal = ref(false)
const providerSearchQuery = ref('')
const availableProviders = ref<any[]>([])
const loadingProviders = ref(false)

const activeThread = computed(() => {
  if (!activeThreadId.value) return null
  return threads.value.find(t => t.id === activeThreadId.value) || null
})

const activeMessages = computed(() => {
  if (!activeThreadId.value) return []
  return messagesByThread.value[activeThreadId.value] || []
})

const filteredThreads = computed(() => {
  let list = threads.value

  if (activeFilter.value === 'unread') {
    list = list.filter(t => t.unreadCount > 0)
  } else if (activeFilter.value === 'negotiations') {
    list = list.filter(t => {
      const msgs = messagesByThread.value[t.id] || []
      return msgs.some(m => m.type === 'proposal')
    })
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(t => 
      t.participantName.toLowerCase().includes(q) ||
      (t.lastMessage && t.lastMessage.toLowerCase().includes(q)) ||
      (t.context?.title && t.context.title.toLowerCase().includes(q))
    )
  }

  return list
})

onMounted(async () => {
  await initializeChat()

  // Handle URL query parameters to auto-open or create thread
  const recipientId = route.query.recipient
  const recipientName = route.query.name as string
  const role = (route.query.role as 'customer' | 'provider') || 'provider'
  const contextType = (route.query.context_type as any) || 'general'
  const contextTitle = route.query.context_title as string
  const contextId = route.query.context_id as string
  const contextAmount = route.query.context_amount ? Number(route.query.context_amount) : undefined

  let opened = false
  if (recipientId && recipientName) {
    const threadId = await startOrGetThread({
      participantId: recipientId as string,
      participantName: recipientName,
      participantRole: role,
      context: {
        type: contextType,
        id: contextId,
        title: contextTitle,
        amount: contextAmount,
      }
    })
    if (threadId != null) { await selectThread(threadId); opened = true }
  }
  if (!opened && threads.value.length > 0 && !activeThreadId.value) {
    await selectThread(threads.value[0].id)
  }

  startPolling()
})

onBeforeUnmount(() => {
  stopPolling()
  activeThreadId.value = null
})

async function selectThread(threadId: string | number) {
  activeThreadId.value = threadId
  await loadMessages(threadId)
  markAsRead(threadId)
  scrollToBottom()
  nextTick(() => {
    messageInput.value?.focus()
  })
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

async function handleSendMessage() {
  if (!activeThreadId.value || !newMessageText.value.trim()) return
  const text = newMessageText.value.trim()
  newMessageText.value = ''
  await sendMessage(activeThreadId.value, text)
  scrollToBottom()
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSendMessage()
  }
}

function openProposalModal() {
  proposalAmount.value = activeThread.value?.context?.amount || ''
  proposalNote.value = ''
  showProposalModal.value = true
}

async function handleSendProposal() {
  if (!activeThreadId.value || !proposalAmount.value || Number(proposalAmount.value) <= 0) return
  const amount = Number(proposalAmount.value)
  const note = proposalNote.value.trim()
  showProposalModal.value = false
  proposalAmount.value = ''
  proposalNote.value = ''
  await sendPriceProposal(activeThreadId.value, amount, note, activeThread.value?.context?.title)
  scrollToBottom()
}

async function handleAcceptProposal(msgId: string | number) {
  if (!activeThreadId.value) return
  await updateProposalStatus(activeThreadId.value, msgId, 'accepted')
  scrollToBottom()
}

async function handleDeclineProposal(msgId: string | number) {
  if (!activeThreadId.value) return
  await updateProposalStatus(activeThreadId.value, msgId, 'declined')
}

function formatMsgTime(iso: string) {
  if (!iso) return ''
  const date = new Date(iso)
  return new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(date)
}

function formatThreadDate(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffHours = (now.getTime() - d.getTime()) / (1000 * 3600)
  if (diffHours < 24) {
    return new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(d)
  }
  return new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' }).format(d)
}

// ── Provider Search for Discovery ──
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

async function openFindProviderModal() {
  showFindProviderModal.value = true
  if (!availableProviders.value.length) {
    await searchProviders()
  }
}

async function searchProviders(query?: string) {
  loadingProviders.value = true
  try {
    const q = (query !== undefined ? query : providerSearchQuery.value).trim()
    const endpoint = q ? `/providers?q=${encodeURIComponent(q)}` : '/providers'
    const res = await apiFetch<any>(endpoint)
    const list = res.data ?? res ?? []
    availableProviders.value = (Array.isArray(list) ? list : []).map((p: any) => {
      const firstSvc = p.services?.[0]
      return {
        id: p.id,
        name: `${p.user?.first_name || ''} ${p.user?.last_name || ''}`.trim() || p.business_name || 'Verified Provider',
        title: p.professional_title || firstSvc?.title || 'Verified Specialist',
        rating: Number(p.average_rating || 5.0),
        jobs: p.completed_jobs || 0,
        city: p.user?.city || p.user?.area || 'Addis Ababa',
        price: firstSvc?.price,
        serviceTitle: firstSvc?.title,
        photo: p.user?.profile_photo || null,
        services: p.services || [],
        skills: p.skills || [],
        bio: p.bio || '',
      }
    })
  } catch {
    availableProviders.value = []
  } finally {
    loadingProviders.value = false
  }
}

watch(providerSearchQuery, (newVal) => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    searchProviders(newVal)
  }, 250)
})

const filteredAvailableProviders = computed(() => {
  return availableProviders.value
})

async function startChatWithProvider(p: any) {
  const threadId = await startOrGetThread({
    participantId: String(p.id),
    participantName: p.name,
    participantRole: 'provider',
    context: {
      type: 'service',
      title: p.title,
      amount: Number(p.price) || undefined,
    }
  })
  showFindProviderModal.value = false
  if (threadId != null) await selectThread(threadId)
}
</script>

<template>
  <div class="max-w-[1240px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
    
    <!-- Top breadcrumb & title with Back button -->
    <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
      <div>
        <div class="flex items-center gap-2 text-xs font-medium text-clay mb-1">
          <button @click="goBack" class="hover:underline flex items-center gap-1">← Dashboard</button>
          <span>/</span>
          <span class="text-ink/60 dark:text-white/60">Messages & Direct Chat</span>
        </div>
        <h1 class="font-display text-2xl sm:text-3xl font-semibold text-ink dark:text-[#F0EDE6]">
          Inbox & Direct Chat
        </h1>
      </div>
      <div class="flex items-center gap-3">
        <button
          @click="openFindProviderModal"
          class="text-xs font-bold bg-clay/10 hover:bg-clay/20 text-clay px-3.5 py-2 rounded-full transition flex items-center gap-1.5 border border-clay/30"
        >
          <span>🔍</span> Find New Provider
        </button>
        <span class="text-xs px-3 py-1.5 rounded-full bg-mist/80 dark:bg-white/10 text-ink/70 dark:text-white/70 font-medium hidden sm:inline">
          💬 Escrow-protected chat
        </span>
      </div>
    </div>

    <!-- Main 2-Panel Container — a definite height so each panel scrolls on its own -->
    <div class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-12 h-[calc(100dvh-11rem)] min-h-[540px] max-h-[860px]">

      <!-- ── LEFT PANEL: Threads List (hidden on mobile when chat is open) ── -->
      <aside
        class="md:col-span-4 lg:col-span-4 border-r border-mist dark:border-white/10 flex flex-col min-h-0 bg-mist/20 dark:bg-white/[0.02]"
        :class="{ 'hidden md:flex': activeThreadId }"
      >
        <!-- Header & Search -->
        <div class="p-4 border-b border-mist dark:border-white/10 space-y-3">
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30 dark:text-white/30 text-sm">🔍</span>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search conversations..."
              class="w-full rounded-xl bg-white dark:bg-mist-dark border border-mist dark:border-white/10 pl-9 pr-3 py-2 text-sm text-ink dark:text-[#F0EDE6] placeholder:text-ink/35 dark:placeholder:text-white/35 outline-none focus:ring-2 focus:ring-clay/30 focus:border-clay transition"
            />
          </div>

          <!-- Filter Pills -->
          <div class="flex gap-1 bg-mist/60 dark:bg-white/5 rounded-lg p-1 text-xs font-medium">
            <button
              v-for="f in (['all', 'unread', 'negotiations'] as const)"
              :key="f"
              @click="activeFilter = f"
              :class="[
                'flex-1 py-1.5 rounded-md capitalize transition',
                activeFilter === f ? 'bg-white dark:bg-mist-dark text-clay shadow-sm font-semibold' : 'text-ink/60 dark:text-white/60 hover:text-ink dark:hover:text-white'
              ]"
            >
              {{ f }}
            </button>
          </div>
        </div>

        <!-- Thread List -->
        <div class="flex-1 min-h-0 overflow-y-auto divide-y divide-mist/60 dark:divide-white/5">
          <div v-if="filteredThreads.length === 0" class="p-8 text-center text-sm text-ink/50 dark:text-white/50 space-y-3">
            <p>No conversations found.</p>
            <button
              @click="openFindProviderModal"
              class="text-xs font-bold text-clay underline"
            >
              Search available providers →
            </button>
          </div>

          <button
            v-for="thread in filteredThreads"
            :key="thread.id"
            @click="selectThread(thread.id)"
            class="w-full text-left p-3.5 sm:p-4 flex items-start gap-3 transition relative group"
            :class="[
              activeThreadId === thread.id
                ? 'bg-clay/10 dark:bg-clay/15 text-ink dark:text-white'
                : 'hover:bg-mist/40 dark:hover:bg-white/5 text-ink/80 dark:text-white/80'
            ]"
          >
            <!-- Avatar -->
            <div class="relative shrink-0">
              <div class="w-11 h-11 rounded-full bg-clay/15 text-clay flex items-center justify-center font-display font-semibold text-sm">
                {{ thread.avatarText || thread.participantName.substring(0, 2).toUpperCase() }}
              </div>
              <span class="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-mist-dark"></span>
            </div>

            <!-- Thread Details -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between mb-0.5">
                <p class="font-semibold text-sm text-ink dark:text-[#F0EDE6] truncate">
                  {{ thread.participantName }}
                </p>
                <span class="text-[11px] text-ink/40 dark:text-white/40 shrink-0 ml-2">
                  {{ formatThreadDate(thread.lastMessageTime || thread.updatedAt) }}
                </span>
              </div>

              <!-- Context tag if available -->
              <p v-if="thread.context?.title" class="text-[11px] font-medium text-clay truncate mb-1">
                📌 {{ thread.context.title }}
              </p>

              <!-- Last Message Preview -->
              <p class="text-xs text-ink/55 dark:text-white/55 truncate">
                {{ thread.lastMessage || 'No messages yet' }}
              </p>
            </div>

            <!-- Unread badge -->
            <span
              v-if="thread.unreadCount > 0"
              class="w-5 h-5 rounded-full bg-clay text-white text-[10px] font-bold flex items-center justify-center shrink-0 self-center"
            >
              {{ thread.unreadCount }}
            </span>
          </button>
        </div>

        <!-- Quick Provider Search footer button -->
        <div class="p-3 border-t border-mist dark:border-white/10 bg-white/40 dark:bg-white/[0.01]">
          <button
            @click="openFindProviderModal"
            class="w-full py-2.5 rounded-xl border border-dashed border-clay/40 text-clay hover:bg-clay/5 text-xs font-bold flex items-center justify-center gap-2 transition"
          >
            <span>➕</span> Search & Message Providers
          </button>
        </div>
      </aside>

      <!-- ── RIGHT PANEL: Active Chat Conversation ── -->
      <main
        class="md:col-span-8 lg:col-span-8 flex flex-col h-full min-h-0 bg-white dark:bg-mist-dark"
        :class="{ 'hidden md:flex': !activeThreadId }"
      >
        <template v-if="activeThread">
          
          <!-- Chat Header -->
          <div class="p-3.5 sm:p-4 border-b border-mist dark:border-white/10 flex items-center justify-between gap-3 bg-white dark:bg-mist-dark shrink-0">
            <div class="flex items-center gap-3 min-w-0">
              <!-- Back button on mobile -->
              <button
                @click="activeThreadId = null"
                class="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-ink/60 dark:text-white/60 hover:bg-mist transition"
                aria-label="Back to threads"
              >
                ←
              </button>

              <div class="w-10 h-10 rounded-full bg-clay/15 text-clay flex items-center justify-center font-display font-semibold text-sm shrink-0">
                {{ activeThread.avatarText || activeThread.participantName.substring(0, 2).toUpperCase() }}
              </div>
              
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <p class="font-semibold text-sm text-ink dark:text-[#F0EDE6] truncate">
                    {{ activeThread.participantName }}
                  </p>
                  <span class="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize bg-mist dark:bg-white/10 text-ink/60 dark:text-white/60">
                    {{ activeThread.participantRole }}
                  </span>
                </div>
                <p class="text-xs text-ink/45 dark:text-white/45 truncate">
                  {{ activeThread.participantTitle || 'Active on SkillLink' }}
                </p>
              </div>
            </div>

            <!-- Header Actions: View Profile Button & Proposal -->
            <div class="flex items-center gap-2 shrink-0">
              <!-- Prominent View Profile button that takes customer to provider portfolio -->
              <NuxtLink
                v-if="activeThread.participantRole === 'provider'"
                :to="`/providers/${activeThread.participantId}`"
                class="text-xs font-bold text-clay hover:underline px-3 py-1.5 rounded-lg border border-clay/40 bg-clay/5 hover:bg-clay/10 transition inline-flex items-center gap-1"
              >
                <span>👤</span> View Profile
              </NuxtLink>
              <button
                @click="openProposalModal"
                class="text-xs font-semibold bg-clay text-white px-3.5 py-1.5 rounded-full hover:bg-clay/90 transition shadow-sm flex items-center gap-1.5"
              >
                <span>🏷️</span> Propose Rate
              </button>
            </div>
          </div>

          <!-- Context Banner (Linked Job/Service/Booking) -->
          <div 
            v-if="activeThread.context?.title"
            class="px-4 py-2 bg-clay/5 dark:bg-clay/10 border-b border-clay/15 text-xs text-ink/75 dark:text-white/75 flex items-center justify-between gap-3 shrink-0"
          >
            <div class="flex items-center gap-2 truncate">
              <span class="font-semibold text-clay">Topic:</span>
              <span class="font-medium truncate">{{ activeThread.context.title }}</span>
              <span v-if="activeThread.context.amount" class="text-ink/50 dark:text-white/50 font-normal">
                (Budget: ETB {{ activeThread.context.amount.toLocaleString() }})
              </span>
            </div>
            <NuxtLink 
              v-if="activeThread.context.type === 'booking' && activeThread.context.id"
              :to="`/bookings/${activeThread.context.id}`"
              class="text-clay font-medium hover:underline shrink-0 text-[11px]"
            >
              Open Booking ↗
            </NuxtLink>
            <NuxtLink 
              v-else-if="activeThread.context.type === 'job' && activeThread.context.id"
              :to="`/jobs/${activeThread.context.id}`"
              class="text-clay font-medium hover:underline shrink-0 text-[11px]"
            >
              Open Job ↗
            </NuxtLink>
          </div>

          <!-- Messages Timeline -->
          <div
            ref="messagesContainer"
            class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 bg-mist/10 dark:bg-mist-dark/40"
          >
            <div v-if="activeMessages.length === 0" class="text-center py-12 text-sm text-ink/40 dark:text-white/40">
              <p class="text-3xl mb-2">💬</p>
              <p class="font-medium text-ink dark:text-[#F0EDE6]">Start of conversation with {{ activeThread.participantName }}</p>
              <p class="text-xs text-ink/50 dark:text-white/50">Send a greeting or propose terms to start negotiating.</p>
            </div>

            <div
              v-for="msg in activeMessages"
              :key="msg.id"
              :class="[
                'flex flex-col',
                msg.type === 'system' ? 'items-center my-2' : (msg.isMe ? 'items-end' : 'items-start')
              ]"
            >
              <!-- 1. System Event Message -->
              <div
                v-if="msg.type === 'system'"
                class="px-3.5 py-1.5 rounded-full bg-mist/80 dark:bg-white/10 text-ink/65 dark:text-white/65 text-xs font-medium border border-mist dark:border-white/10 text-center max-w-md"
              >
                {{ msg.text }}
              </div>

              <!-- 2. Interactive Price Proposal Card -->
              <div
                v-else-if="msg.type === 'proposal' && msg.proposalData"
                class="max-w-md w-full rounded-2xl border border-clay/30 bg-white dark:bg-mist-dark shadow-md p-4 mb-1 overflow-hidden"
              >
                <div class="flex items-center justify-between pb-3 mb-3 border-b border-mist dark:border-white/10">
                  <div class="flex items-center gap-1.5 text-xs font-semibold text-clay uppercase tracking-wide">
                    <span>🏷️</span> Price Proposal / Quote
                  </div>
                  <span
                    :class="[
                      'text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase',
                      msg.proposalData.status === 'accepted' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' :
                      msg.proposalData.status === 'declined' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400' :
                      'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300'
                    ]"
                  >
                    {{ msg.proposalData.status }}
                  </span>
                </div>

                <div class="mb-3">
                  <p class="text-xs text-ink/50 dark:text-white/50 mb-0.5">{{ msg.proposalData.serviceTitle || 'Proposed Amount' }}</p>
                  <p class="font-display text-2xl font-bold text-ink dark:text-[#F0EDE6]">
                    ETB {{ Number(msg.proposalData.amount).toLocaleString() }}
                  </p>
                  <p v-if="msg.proposalData.note" class="text-xs text-ink/70 dark:text-white/70 mt-2 bg-mist/40 dark:bg-white/5 p-2.5 rounded-lg">
                    "{{ msg.proposalData.note }}"
                  </p>
                </div>

                <!-- Action buttons when status is pending — only for the recipient -->
                <div v-if="msg.proposalData.status === 'pending' && !msg.isMe" class="flex gap-2 pt-1">
                  <button
                    @click="handleAcceptProposal(msg.id)"
                    class="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold text-xs py-2 rounded-lg transition"
                  >
                    ✓ Accept Rate
                  </button>
                  <button
                    @click="handleDeclineProposal(msg.id)"
                    class="flex-1 border border-mist dark:border-white/15 text-ink/70 dark:text-white/70 font-semibold text-xs py-2 rounded-lg hover:border-red-400 hover:text-red-600 transition"
                  >
                    Decline
                  </button>
                </div>
                <div v-else-if="msg.proposalData.status === 'pending' && msg.isMe" class="text-xs text-ink/45 dark:text-white/45 font-medium">
                  Waiting for a response…
                </div>
                <div v-else-if="msg.proposalData.status === 'accepted'" class="text-xs text-green-700 dark:text-green-400 font-medium flex items-center gap-1">
                  <span>✓</span> Rate accepted. Proceed with service booking on these terms.
                </div>

                <p class="text-[10px] text-ink/35 dark:text-white/35 mt-2 text-right">
                  {{ formatMsgTime(msg.timestamp) }}
                </p>
              </div>

              <!-- 3. Standard Text Bubble -->
              <div
                v-else
                :class="[
                  'max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm',
                  msg.isMe
                    ? 'bg-clay text-white rounded-br-xs'
                    : 'bg-white dark:bg-white/10 text-ink dark:text-[#F0EDE6] border border-mist dark:border-white/10 rounded-bl-xs'
                ]"
              >
                <p class="text-[11px] font-semibold opacity-75 mb-0.5" v-if="!msg.isMe && msg.senderName">
                  {{ msg.senderName }}
                </p>
                <p class="whitespace-pre-wrap break-words">{{ msg.text }}</p>
                <p
                  :class="[
                    'text-[10px] mt-1 text-right',
                    msg.isMe ? 'text-white/60' : 'text-ink/40 dark:text-white/40'
                  ]"
                >
                  {{ formatMsgTime(msg.timestamp) }}
                </p>
              </div>
            </div>
          </div>

          <!-- Chat Input Bar -->
          <div class="p-3 sm:p-4 border-t border-mist dark:border-white/10 bg-white dark:bg-mist-dark shrink-0">
            <div class="flex items-end gap-2">
              <button
                @click="openProposalModal"
                class="w-10 h-10 rounded-xl border border-mist dark:border-white/15 flex items-center justify-center text-clay hover:bg-clay/10 transition shrink-0"
                title="Propose price quotation / negotiation"
              >
                🏷️
              </button>

              <textarea
                ref="messageInput"
                v-model="newMessageText"
                rows="1"
                placeholder="Type your message... (Enter to send)"
                @keydown="handleKeyDown"
                class="flex-1 rounded-xl border border-mist dark:border-white/15 bg-mist/20 dark:bg-white/5 px-4 py-2.5 text-sm text-ink dark:text-[#F0EDE6] placeholder:text-ink/35 dark:placeholder:text-white/35 outline-none focus:ring-2 focus:ring-clay/30 focus:border-clay transition resize-none max-h-32"
              ></textarea>

              <button
                @click="handleSendMessage"
                :disabled="!newMessageText.trim()"
                class="h-10 px-4 rounded-xl bg-clay hover:bg-clay/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition flex items-center justify-center gap-1.5 shrink-0 shadow-sm"
              >
                <span>Send</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 2 11 13M22 2 15 22l-4-9-9-4 20-7z"/>
                </svg>
              </button>
            </div>
          </div>

        </template>

        <!-- No Thread Selected State -->
        <div v-else class="flex-1 flex flex-col items-center justify-center p-8 text-center text-ink/50 dark:text-white/50">
          <div class="w-16 h-16 rounded-2xl bg-clay/10 text-clay flex items-center justify-center text-2xl mb-4 font-display">
            💬
          </div>
          <h3 class="font-display text-lg font-semibold text-ink dark:text-[#F0EDE6] mb-1">
            Select a conversation
          </h3>
          <p class="text-sm max-w-sm text-ink/60 dark:text-white/60 mb-4">
            Choose a contact from the inbox list or search available providers across Ethiopia to start direct negotiation.
          </p>
          <button
            @click="openFindProviderModal"
            class="px-5 py-2.5 rounded-full bg-clay text-white font-bold text-xs shadow-md hover:bg-clay/90 transition"
          >
            Find a Provider to Chat With
          </button>
        </div>
      </main>

    </div>

    <!-- ── Price Proposal Modal ── -->
    <div
      v-if="showProposalModal"
      class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
      @click.self="showProposalModal = false"
    >
      <div class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xl">🏷️</span>
            <h3 class="font-display text-lg font-semibold text-ink dark:text-[#F0EDE6]">
              Propose Custom Price
            </h3>
          </div>
          <button @click="showProposalModal = false" class="text-ink/40 dark:text-white/40 hover:text-clay text-lg">✕</button>
        </div>

        <p class="text-xs text-ink/60 dark:text-white/60">
          Send a formal quote or counter-offer to <strong class="text-ink dark:text-white">{{ activeThread?.participantName }}</strong>.
        </p>

        <div>
          <label class="block text-xs font-semibold text-ink dark:text-[#F0EDE6] uppercase mb-1.5">
            Proposed Price (ETB) <span class="text-clay">*</span>
          </label>
          <div class="relative">
            <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink/40 dark:text-white/40">ETB</span>
            <input
              v-model="proposalAmount"
              type="number"
              min="1"
              placeholder="e.g. 1500"
              class="w-full rounded-xl border border-mist dark:border-white/15 bg-white dark:bg-canvas-dark pl-14 pr-4 py-2.5 text-sm text-ink dark:text-[#F0EDE6] outline-none focus:ring-2 focus:ring-clay/40 transition font-semibold"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-ink dark:text-[#F0EDE6] uppercase mb-1.5">
            Terms & Details (Optional)
          </label>
          <textarea
            v-model="proposalNote"
            rows="3"
            placeholder="e.g. Includes materials and on-site inspection, scheduled for Friday morning..."
            class="w-full rounded-xl border border-mist dark:border-white/15 bg-white dark:bg-canvas-dark px-4 py-2 text-sm text-ink dark:text-[#F0EDE6] outline-none focus:ring-2 focus:ring-clay/40 transition resize-none"
          ></textarea>
        </div>

        <div class="flex gap-3 pt-2">
          <button
            type="button"
            @click="showProposalModal = false"
            class="flex-1 border border-mist dark:border-white/15 text-ink/70 dark:text-white/70 font-semibold py-2.5 rounded-xl hover:border-clay/40 transition text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="handleSendProposal"
            :disabled="!proposalAmount || Number(proposalAmount) <= 0"
            class="flex-1 bg-clay hover:bg-clay/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition text-sm shadow-sm"
          >
            Send Offer
          </button>
        </div>
      </div>
    </div>

    <!-- ── Find Available Provider Modal ── -->
    <div
      v-if="showFindProviderModal"
      class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      @click.self="showFindProviderModal = false"
    >
      <div class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xl">🔍</span>
            <h3 class="font-display text-lg font-bold text-ink dark:text-[#F0EDE6]">
              Find & Message Providers
            </h3>
          </div>
          <button @click="showFindProviderModal = false" class="text-ink/40 dark:text-white/40 hover:text-clay text-lg">✕</button>
        </div>

        <!-- Search Bar -->
        <div class="relative">
          <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/30 dark:text-white/30 text-sm">🔍</span>
          <input
            v-model="providerSearchQuery"
            type="text"
            placeholder="Search by name, skill, trade (e.g. plumber, electrician), or city..."
            class="w-full rounded-xl bg-mist/20 dark:bg-canvas-dark border border-mist dark:border-white/15 pl-10 pr-10 py-2.5 text-sm text-ink dark:text-[#F0EDE6] placeholder:text-ink/35 dark:placeholder:text-white/35 outline-none focus:ring-2 focus:ring-clay/40 transition"
          />
          <button
            v-if="providerSearchQuery"
            @click="providerSearchQuery = ''; searchProviders('')"
            class="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink/40 dark:text-white/40 hover:text-clay text-xs p-1"
            title="Clear search"
          >
            ✕
          </button>
        </div>

        <!-- Providers list -->
        <div class="flex-1 overflow-y-auto divide-y divide-mist dark:divide-white/10 space-y-1 pr-1">
          <div v-if="loadingProviders" class="text-center py-8 text-xs text-ink/50 dark:text-white/50 flex items-center justify-center gap-2">
            <span class="inline-block w-4 h-4 border-2 border-clay border-t-transparent rounded-full animate-spin"></span>
            Searching verified providers…
          </div>
          <div v-else-if="!filteredAvailableProviders.length" class="text-center py-8 text-xs text-ink/50 dark:text-white/50 space-y-1">
            <p class="font-medium text-sm text-ink/70 dark:text-white/70">No providers found matching "{{ providerSearchQuery }}"</p>
            <p>Try searching by trade like "plumber", "electrician", "developer", "cleaner", or location.</p>
          </div>
          <div
            v-for="p in filteredAvailableProviders"
            :key="p.id"
            class="p-3 flex items-center justify-between gap-3 hover:bg-mist/30 dark:hover:bg-white/5 rounded-xl transition"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div v-if="p.photo" class="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-clay/20">
                <img :src="resolveMediaUrl(p.photo)" :alt="p.name" class="w-full h-full object-cover" />
              </div>
              <div v-else class="w-10 h-10 rounded-full bg-clay/15 text-clay font-bold flex items-center justify-center text-sm shrink-0">
                {{ p.name[0] }}
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <p class="font-bold text-sm text-ink dark:text-[#F0EDE6] truncate">{{ p.name }}</p>
                  <span class="text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">✓ Verified</span>
                </div>
                <p class="text-xs text-ink/60 dark:text-white/60 truncate">{{ p.title }} · 📍 {{ p.city }}</p>
                <div class="flex items-center gap-2 text-[11px] text-ink/50 dark:text-white/50">
                  <span class="text-amber-600 font-semibold">★ {{ Number(p.rating).toFixed(1) }} ({{ p.jobs }} jobs)</span>
                  <span v-if="p.price" class="text-clay font-medium">• from ETB {{ Number(p.price).toLocaleString() }}</span>
                </div>
              </div>
            </div>
            <button
              @click="startChatWithProvider(p)"
              class="px-3.5 py-1.5 rounded-full bg-clay hover:bg-clay/90 text-white font-bold text-xs shrink-0 transition shadow-xs"
            >
              Chat →
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>
