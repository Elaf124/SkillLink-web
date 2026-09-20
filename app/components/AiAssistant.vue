<script setup>
/**
 * AiAssistant.vue
 * Floating AI chat widget — bottom-right corner, visible on every page.
 * Calls the /api/ai-chat server route (Gemini 1.5 Flash, server-side key).
 */

const { apiFetch, token } = useApi()
const router = useRouter()

// The signed-in user's city and role.
const userCity = ref(null)
const userRole = ref('customer')
onMounted(async () => {
  if (!token.value) return
  try {
    const me = await apiFetch('/user')
    userCity.value = me?.city ?? null
    userRole.value = me?.role?.name === 'provider' ? 'provider' : 'customer'
    if (userRole.value === 'provider') {
      messages.value[0].text = "✨ Hi! I'm **SkillLink AI**. Looking for your next job? Tell me your skill or category, and I'll find open client jobs for you to bid on, or ask about fees & payouts!"
    }
  } catch { /* not signed in / offline — fine */ }
})

// ── UI state ──────────────────────────────────────────────────────────────
const isOpen = ref(false)
const isMinimized = ref(false)
const inputText = ref('')
const isThinking = ref(false)
const messagesEl = ref(null)
const inputEl = ref(null)
const hasNewMessage = ref(false)  // badge pulse on button

// ── Conversation history ──────────────────────────────────────────────────
const messages = ref([
  {
    id: 0,
    role: 'ai',
    text: "👋 Hi! I'm **SkillLink AI**. Tell me what kind of service you need and I'll find the best providers for you — by skill, rating, price, or location.",
    providers: [],
    timestamp: new Date(),
  },
])

// ── Quick-prompt chips ────────────────────────────────────────────────────
const quickPrompts = computed(() => {
  if (userRole.value === 'provider') {
    return [
      { icon: '💼', label: 'Latest open jobs' },
      { icon: '💰', label: 'High budget jobs' },
      { icon: '🎨', label: 'Design & Creative jobs' },
      { icon: '🛠️', label: 'Plumbing & Repairs' },
      { icon: '💳', label: 'How platform fee works' },
    ]
  }
  return [
    { icon: '🔧', label: 'Best plumbers near me' },
    { icon: '🎨', label: 'Top designers by rating' },
    { icon: '📚', label: 'Find a tutor' },
    { icon: '💻', label: 'Software developers' },
    { icon: '🏗️', label: 'Construction workers' },
  ]
})

function open() {
  isOpen.value = true
  isMinimized.value = false
  hasNewMessage.value = false
  nextTick(() => {
    scrollToBottom()
    inputEl.value?.focus()
  })
}

function close() {
  isOpen.value = false
}

function toggle() {
  if (isOpen.value) {
    close()
  } else {
    open()
  }
}

// Listen for external open trigger (e.g. dashboard "Ask AI for more" button)
function handleExternalOpen(e) {
  open()
  const query = e.detail?.query
  if (query) {
    nextTick(() => sendMessage(query))
  }
}

onMounted(() => window.addEventListener('skilllink:ai-open', handleExternalOpen))
onUnmounted(() => window.removeEventListener('skilllink:ai-open', handleExternalOpen))


function scrollToBottom() {
  nextTick(() => {
    if (messagesEl.value) {
      messagesEl.value.scrollTop = messagesEl.value.scrollHeight
    }
  })
}

async function sendMessage(text) {
  const msg = (text ?? inputText.value).trim()
  if (!msg || isThinking.value) return

  inputText.value = ''

  // Push user message
  messages.value.push({
    id: Date.now(),
    role: 'user',
    text: msg,
    providers: [],
    timestamp: new Date(),
  })
  scrollToBottom()

  isThinking.value = true

  try {
    // Send the recent turns so the assistant has conversation context and can
    // handle follow-ups instead of answering every message from scratch.
    const history = messages.value
      .filter(m => m.id !== 0)
      .slice(-8)
      .map(m => ({ role: m.role === 'ai' ? 'model' : 'user', text: m.text }))

    const res = await $fetch('/api/ai-chat', {
      method: 'POST',
      body: {
        message: msg,
        token: token.value ?? null,
        userCity: userCity.value ?? null,
        role: userRole.value,
        history,
      },
    })

    messages.value.push({
      id: Date.now() + 1,
      role: 'ai',
      text: res.reply ?? 'No response.',
      providers: res.providers ?? [],
      jobs: res.jobs ?? [],
      timestamp: new Date(),
    })

    if (!isOpen.value) {
      hasNewMessage.value = true
    }
  } catch (err) {
    messages.value.push({
      id: Date.now() + 1,
      role: 'ai',
      text: '⚠️ Something went wrong. Please try again in a moment.',
      providers: [],
      timestamp: new Date(),
    })
  } finally {
    isThinking.value = false
    scrollToBottom()
  }
}

function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

function formatTime(date) {
  return new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(date)
}

// Simple markdown-ish renderer: bold, links, line breaks
function renderText(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="ai-link" data-href="$2">$1</a>')
    .replace(/\n/g, '<br>')
}

// Handle internal link clicks inside AI messages (SPA navigation)
function handleMsgClick(e) {
  const anchor = e.target.closest('a.ai-link')
  if (!anchor) return
  const href = anchor.getAttribute('data-href')
  if (href && href.startsWith('/')) {
    e.preventDefault()
    router.push(href)
    close()
  }
}
</script>

<template>
  <!-- ── Floating button ─────────────────────────────────────────────── -->
  <div class="ai-widget-root">
    <button
      id="ai-assistant-toggle"
      class="ai-fab"
      :class="{ 'ai-fab--open': isOpen }"
      @click="toggle"
      aria-label="Open SkillLink AI assistant"
    >
      <!-- Pulse ring when new message arrived -->
      <span v-if="hasNewMessage && !isOpen" class="ai-fab-badge"></span>

      <!-- Icon: sparkle when closed, X when open -->
      <transition name="ai-icon-flip" mode="out-in">
        <span v-if="!isOpen" key="spark" class="ai-fab-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z"/>
            <path d="M5 5l1.5 1.5M18.5 5L17 6.5M5 19l1.5-1.5M18.5 19L17 17.5"/>
          </svg>
        </span>
        <span v-else key="close" class="ai-fab-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </span>
      </transition>

      <span class="ai-fab-label">SkillLink AI</span>
    </button>

    <!-- ── Chat Panel ────────────────────────────────────────────────── -->
    <transition name="ai-panel">
      <div v-if="isOpen" id="ai-assistant-panel" class="ai-panel" role="dialog" aria-label="SkillLink AI Assistant">

        <!-- Header -->
        <div class="ai-panel-header">
          <div class="ai-panel-header-left">
            <div class="ai-avatar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z"/>
              </svg>
            </div>
            <div>
              <p class="ai-panel-title">SkillLink AI</p>
              <p class="ai-panel-subtitle">
                <span class="ai-online-dot"></span>
                Powered by Gemini
              </p>
            </div>
          </div>
          <button @click="close" class="ai-close-btn" aria-label="Close AI panel">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Messages area -->
        <div ref="messagesEl" class="ai-messages" @click="handleMsgClick">
          <div
            v-for="msg in messages"
            :key="msg.id"
            :class="['ai-msg', msg.role === 'user' ? 'ai-msg--user' : 'ai-msg--ai']"
          >
            <div v-if="msg.role === 'ai'" class="ai-msg-avatar">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z"/>
              </svg>
            </div>
            <div class="ai-msg-content-wrap">
              <div class="ai-msg-bubble" v-html="renderText(msg.text)"></div>

              <!-- Inline provider cards from AI response -->
              <!-- Inline job cards from AI response (for providers) -->
              <div v-if="msg.jobs?.length" class="ai-provider-cards">
                <NuxtLink
                  v-for="j in msg.jobs"
                  :key="j.id"
                  :to="`/jobs/${j.id}`"
                  class="ai-provider-card"
                  @click="close"
                >
                  <div class="ai-provider-avatar" style="background: rgba(16, 185, 129, 0.15); color: #059669;">💼</div>
                  <div class="ai-provider-info">
                    <p class="ai-provider-name">{{ j.title }}</p>
                    <p class="ai-provider-meta">ETB {{ Number(j.budget ?? 0).toLocaleString() }} • {{ j.category?.name || 'General' }}</p>
                  </div>
                  <svg class="ai-provider-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </NuxtLink>
              </div>

              <div v-if="msg.providers?.length" class="ai-provider-cards">
                <NuxtLink
                  v-for="p in msg.providers"
                  :key="p.id"
                  :to="`/providers/${p.id}`"
                  class="ai-provider-card"
                  @click="close"
                >
                  <div class="ai-provider-avatar">{{ p.name?.[0] }}</div>
                  <div class="ai-provider-info">
                    <p class="ai-provider-name">{{ p.name }}</p>
                    <p class="ai-provider-meta">⭐{{ p.rating }} · {{ p.completed_jobs }} jobs</p>
                  </div>
                  <svg class="ai-provider-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </NuxtLink>
              </div>

              <p class="ai-msg-time">{{ formatTime(msg.timestamp) }}</p>
            </div>
          </div>

          <!-- Thinking indicator -->
          <div v-if="isThinking" class="ai-msg ai-msg--ai">
            <div class="ai-msg-avatar">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z"/>
              </svg>
            </div>
            <div class="ai-msg-content-wrap">
              <div class="ai-thinking">
                <span class="ai-dot"></span>
                <span class="ai-dot"></span>
                <span class="ai-dot"></span>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick prompts (shown only when there's just the welcome message) -->
        <div v-if="messages.length === 1" class="ai-chips">
          <button
            v-for="chip in quickPrompts"
            :key="chip.label"
            class="ai-chip"
            @click="sendMessage(chip.label)"
          >
            {{ chip.icon }} {{ chip.label }}
          </button>
        </div>

        <!-- Input bar -->
        <div class="ai-input-bar">
          <textarea
            ref="inputEl"
            v-model="inputText"
            rows="1"
            placeholder="Ask about services, providers, prices…"
            class="ai-input"
            @keydown="handleKeydown"
          ></textarea>
          <button
            id="ai-send-btn"
            class="ai-send-btn"
            :disabled="!inputText.trim() || isThinking"
            @click="sendMessage()"
            aria-label="Send message"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 2 11 13M22 2 15 22l-4-9-9-4 20-7z"/>
            </svg>
          </button>
        </div>

        <p class="ai-footer">AI can make mistakes. Always verify provider details.</p>
      </div>
    </transition>
  </div>
</template>

<style scoped>
/* ── Root container ── */
.ai-widget-root {
  position: fixed;
  bottom: 28px;
  right: 28px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
}

/* ── FAB button ── */
.ai-fab {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px 0 16px;
  height: 52px;
  border-radius: 999px;
  background: linear-gradient(135deg, #c0603f 0%, #B5573C 60%, #9e3f2a 100%);
  color: white;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  border: none;
  box-shadow: 0 8px 28px rgba(181, 87, 60, 0.42), 0 2px 8px rgba(0,0,0,0.15);
  transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease;
  position: relative;
  letter-spacing: -0.01em;
}
.ai-fab:hover {
  transform: translateY(-3px) scale(1.03);
  box-shadow: 0 14px 36px rgba(181, 87, 60, 0.52), 0 4px 12px rgba(0,0,0,0.18);
}
.ai-fab--open {
  transform: none;
  box-shadow: 0 4px 16px rgba(181, 87, 60, 0.35);
}
.ai-fab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}
.ai-fab-label { white-space: nowrap; }

/* badge */
.ai-fab-badge {
  position: absolute;
  top: -3px;
  right: -3px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #22c55e;
  border: 2px solid white;
  animation: ai-badge-pulse 1.4s ease-in-out infinite;
}
@keyframes ai-badge-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.25); opacity: 0.7; }
}

/* ── Panel ── */
.ai-panel {
  width: 380px;
  max-width: calc(100vw - 40px);
  border-radius: 24px;
  border: 1px solid rgba(181, 87, 60, 0.18);
  background: rgba(255, 255, 255, 0.97);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  box-shadow:
    0 32px 80px rgba(0, 0, 0, 0.18),
    0 8px 24px rgba(181, 87, 60, 0.12),
    0 0 0 1px rgba(255,255,255,0.6) inset;
  display: flex;
  flex-direction: column;
  max-height: min(620px, calc(100vh - 120px));
  overflow: hidden;
}
.dark .ai-panel {
  background: rgba(18, 18, 22, 0.96);
  border-color: rgba(181, 87, 60, 0.22);
  box-shadow:
    0 32px 80px rgba(0, 0, 0, 0.5),
    0 8px 24px rgba(181, 87, 60, 0.15),
    0 0 0 1px rgba(255,255,255,0.04) inset;
}

/* ── Panel header ── */
.ai-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px 14px;
  border-bottom: 1px solid rgba(240, 237, 230, 0.8);
  background: linear-gradient(135deg, rgba(181, 87, 60, 0.06) 0%, rgba(181, 87, 60, 0.02) 100%);
  flex-shrink: 0;
}
.dark .ai-panel-header {
  border-bottom-color: rgba(255,255,255,0.08);
  background: linear-gradient(135deg, rgba(181, 87, 60, 0.12) 0%, rgba(181, 87, 60, 0.04) 100%);
}
.ai-panel-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ai-avatar {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: linear-gradient(135deg, #c0603f, #B5573C);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(181, 87, 60, 0.35);
}
.ai-panel-title {
  font-weight: 700;
  font-size: 14px;
  color: #1B1F27;
  letter-spacing: -0.01em;
}
.dark .ai-panel-title { color: #F0EDE6; }
.ai-panel-subtitle {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: rgba(0,0,0,0.4);
  margin-top: 1px;
}
.dark .ai-panel-subtitle { color: rgba(255,255,255,0.4); }
.ai-online-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
  animation: ai-badge-pulse 2s ease-in-out infinite;
}
.ai-close-btn {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(0,0,0,0.4);
  transition: background 0.15s, color 0.15s;
  cursor: pointer;
  border: none;
  background: transparent;
  flex-shrink: 0;
}
.dark .ai-close-btn { color: rgba(255,255,255,0.4); }
.ai-close-btn:hover { background: rgba(181, 87, 60, 0.1); color: #B5573C; }

/* ── Messages ── */
.ai-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  scroll-behavior: smooth;
}
.ai-messages::-webkit-scrollbar { width: 4px; }
.ai-messages::-webkit-scrollbar-track { background: transparent; }
.ai-messages::-webkit-scrollbar-thumb { background: rgba(181, 87, 60, 0.2); border-radius: 2px; }

.ai-msg {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  animation: ai-msg-in 0.22s ease forwards;
}
@keyframes ai-msg-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.ai-msg--user { flex-direction: row-reverse; }

.ai-msg-avatar {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: linear-gradient(135deg, #c0603f, #B5573C);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
}
.ai-msg-content-wrap { max-width: 82%; display: flex; flex-direction: column; gap: 6px; }
.ai-msg--user .ai-msg-content-wrap { align-items: flex-end; }

.ai-msg-bubble {
  padding: 10px 13px;
  border-radius: 16px;
  font-size: 13.5px;
  line-height: 1.55;
  word-break: break-word;
}
.ai-msg--ai .ai-msg-bubble {
  background: rgba(240, 237, 230, 0.6);
  color: #1B1F27;
  border-bottom-left-radius: 4px;
}
.dark .ai-msg--ai .ai-msg-bubble {
  background: rgba(255,255,255,0.07);
  color: #F0EDE6;
}
.ai-msg--user .ai-msg-bubble {
  background: linear-gradient(135deg, #c0603f, #B5573C);
  color: white;
  border-bottom-right-radius: 4px;
}

/* Links inside AI messages */
:deep(.ai-link) {
  color: #B5573C;
  font-weight: 600;
  text-decoration: underline;
  text-decoration-color: rgba(181, 87, 60, 0.4);
  cursor: pointer;
  transition: color 0.15s;
}
:deep(.ai-link:hover) { color: #9e3f2a; }

.ai-msg-time {
  font-size: 10px;
  color: rgba(0,0,0,0.3);
  padding: 0 4px;
}
.dark .ai-msg-time { color: rgba(255,255,255,0.25); }

/* ── Provider mini-cards in AI response ── */
.ai-provider-cards {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}
.ai-provider-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid rgba(181, 87, 60, 0.2);
  background: white;
  transition: border-color 0.15s, transform 0.15s;
  text-decoration: none;
}
.dark .ai-provider-card { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); }
.ai-provider-card:hover { border-color: #B5573C; transform: translateX(2px); }
.ai-provider-avatar {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(181, 87, 60, 0.12);
  color: #B5573C;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 12px;
  flex-shrink: 0;
}
.ai-provider-info { flex: 1; min-width: 0; }
.ai-provider-name { font-size: 12px; font-weight: 600; color: #1B1F27; truncate: overflow; }
.dark .ai-provider-name { color: #F0EDE6; }
.ai-provider-meta { font-size: 11px; color: rgba(0,0,0,0.45); }
.dark .ai-provider-meta { color: rgba(255,255,255,0.4); }
.ai-provider-arrow { color: rgba(181, 87, 60, 0.5); flex-shrink: 0; transition: transform 0.15s; }
.ai-provider-card:hover .ai-provider-arrow { transform: translateX(3px); color: #B5573C; }

/* ── Thinking dots ── */
.ai-thinking {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 12px 16px;
  background: rgba(240, 237, 230, 0.6);
  border-radius: 16px 16px 16px 4px;
}
.dark .ai-thinking { background: rgba(255,255,255,0.07); }
.ai-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #B5573C;
  animation: ai-dot-bounce 1.2s ease-in-out infinite;
}
.ai-dot:nth-child(2) { animation-delay: 0.18s; }
.ai-dot:nth-child(3) { animation-delay: 0.36s; }
@keyframes ai-dot-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
  40% { transform: translateY(-6px); opacity: 1; }
}

/* ── Quick prompt chips ── */
.ai-chips {
  padding: 0 14px 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex-shrink: 0;
}
.ai-chip {
  padding: 5px 11px;
  border-radius: 999px;
  border: 1px solid rgba(181, 87, 60, 0.25);
  background: rgba(181, 87, 60, 0.05);
  color: #B5573C;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.15s;
  white-space: nowrap;
}
.ai-chip:hover {
  background: rgba(181, 87, 60, 0.12);
  border-color: rgba(181, 87, 60, 0.5);
  transform: translateY(-1px);
}

/* ── Input bar ── */
.ai-input-bar {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 12px 14px;
  border-top: 1px solid rgba(240, 237, 230, 0.8);
  background: rgba(250, 249, 247, 0.9);
  flex-shrink: 0;
}
.dark .ai-input-bar {
  border-top-color: rgba(255,255,255,0.08);
  background: rgba(15,15,18,0.8);
}
.ai-input {
  flex: 1;
  min-height: 38px;
  max-height: 100px;
  border: 1px solid rgba(240, 237, 230, 1);
  border-radius: 12px;
  padding: 9px 13px;
  font-size: 13.5px;
  line-height: 1.45;
  color: #1B1F27;
  background: white;
  resize: none;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  font-family: inherit;
}
.dark .ai-input {
  background: rgba(255,255,255,0.06);
  border-color: rgba(255,255,255,0.1);
  color: #F0EDE6;
}
.ai-input:focus {
  border-color: rgba(181, 87, 60, 0.5);
  box-shadow: 0 0 0 3px rgba(181, 87, 60, 0.1);
}
.ai-input::placeholder { color: rgba(0,0,0,0.3); }
.dark .ai-input::placeholder { color: rgba(255,255,255,0.25); }
.ai-send-btn {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: linear-gradient(135deg, #c0603f, #B5573C);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: none;
  transition: transform 0.15s, opacity 0.15s, box-shadow 0.15s;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(181, 87, 60, 0.3);
}
.ai-send-btn:hover:not(:disabled) {
  transform: scale(1.08);
  box-shadow: 0 6px 16px rgba(181, 87, 60, 0.45);
}
.ai-send-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

/* ── Footer disclaimer ── */
.ai-footer {
  font-size: 10px;
  text-align: center;
  color: rgba(0,0,0,0.28);
  padding: 6px 14px 10px;
  flex-shrink: 0;
  background: rgba(250, 249, 247, 0.9);
}
.dark .ai-footer { color: rgba(255,255,255,0.2); background: rgba(15,15,18,0.8); }

/* ── Panel slide-up transition ── */
.ai-panel-enter-active { animation: ai-panel-in 0.3s cubic-bezier(0.34,1.56,0.64,1); }
.ai-panel-leave-active { animation: ai-panel-out 0.2s ease forwards; }
@keyframes ai-panel-in {
  from { opacity: 0; transform: translateY(20px) scale(0.95); transform-origin: bottom right; }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes ai-panel-out {
  from { opacity: 1; transform: translateY(0) scale(1); transform-origin: bottom right; }
  to   { opacity: 0; transform: translateY(12px) scale(0.96); }
}

/* ── FAB icon flip ── */
.ai-icon-flip-enter-active,
.ai-icon-flip-leave-active { transition: opacity 0.15s, transform 0.15s; }
.ai-icon-flip-enter-from { opacity: 0; transform: rotate(-90deg) scale(0.5); }
.ai-icon-flip-leave-to   { opacity: 0; transform: rotate(90deg) scale(0.5); }

/* ── Mobile: smaller panel ── */
@media (max-width: 480px) {
  .ai-widget-root { bottom: 16px; right: 16px; }
  .ai-panel { width: calc(100vw - 32px); max-height: calc(100vh - 100px); }
  .ai-fab-label { display: none; }
  .ai-fab { padding: 0 15px; width: 52px; justify-content: center; }
}
</style>
