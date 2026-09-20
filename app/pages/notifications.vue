<script setup lang="ts">
definePageMeta({ layout: 'default', middleware: ['auth'] })

const { apiFetch, token } = useApi()
const router = useRouter()
const goBack = useGoBack('/dashboard')
const { items, loadList, markRead, markAllRead: markAllReadApi } = useNotifications()

const loading = ref(true)
const user = ref<any>(null)
const filter = ref<string>('all')

const isProvider = computed(() => user.value?.role?.name === 'provider')

const filterPills = computed(() =>
  isProvider.value
    ? ['all', 'bookings', 'offers', 'payment']
    : ['all', 'offers', 'bookings', 'messages']
)

// type → icon + badge colour (kept on the frontend so the DB stays lean)
const TYPE_META: Record<string, { icon: string; badgeColor: string }> = {
  offer:    { icon: '🏷️', badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  booking:  { icon: '📅', badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  payment:  { icon: '💰', badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  message:  { icon: '💬', badgeColor: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  dispute:  { icon: '⚖️', badgeColor: 'bg-red-500/10 text-red-600 dark:text-red-400' },
  review:   { icon: '⭐', badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  system:   { icon: '📢', badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
}
const metaFor = (type: string) => TYPE_META[type] || TYPE_META.system

const notifications = computed(() =>
  items.value.map(n => ({ ...n, ...metaFor(n.type) }))
)

onMounted(async () => {
  if (!token.value) { router.push('/login'); return }
  loading.value = true
  try {
    user.value = await apiFetch('/user')
    await loadList()
  } catch {
    // ignore
  } finally {
    loading.value = false
  }
})

const filteredNotifications = computed(() => {
  if (filter.value === 'all') return notifications.value
  const f = filter.value
  return notifications.value.filter(n =>
    n.type === f ||
    (f === 'bookings' && n.type === 'booking') ||
    (f === 'offers' && n.type === 'offer') ||
    (f === 'messages' && n.type === 'message')
  )
})

function onNotifClick(id: number) {
  markRead(id)
}

function markAllRead() {
  markAllReadApi()
}

function formatDate(iso: string) {
  if (!iso) return ''
  return new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

function pillLabel(f: string) {
  const map: Record<string, string> = {
    all: 'All Alerts', offers: 'Offers', bookings: 'Bookings',
    messages: 'Messages', payment: 'Payments', reviews: 'Reviews', system: 'Updates'
  }
  return map[f] || f
}
</script>

<template>
  <div class="max-w-4xl mx-auto px-6 py-8 sm:py-12">
    <!-- Back button -->
    <div class="mb-4">
      <button @click="goBack" class="inline-flex items-center gap-1.5 text-xs font-semibold text-clay hover:underline">
        <span>←</span> Back to Dashboard
      </button>
    </div>

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-mist dark:border-white/10">
      <div>
        <p class="text-xs font-bold text-clay uppercase tracking-wider mb-1">Activity Center</p>
        <h1 class="font-display text-3xl font-bold text-ink dark:text-[#F0EDE6]">
          Notifications &amp; Alerts
        </h1>
        <p class="text-sm text-ink/60 dark:text-white/60 mt-1">
          {{ isProvider ? 'Stay updated on accepted offers, new reviews, and platform updates.' : 'Stay updated on job proposals, provider responses, and booking status changes.' }}
        </p>
      </div>

      <button
        v-if="notifications.some(n => !n.isRead)"
        @click="markAllRead"
        class="text-xs font-bold text-clay hover:underline self-start sm:self-auto"
      >
        Mark all as read
      </button>
    </div>

    <!-- Filter Pills -->
    <div class="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-none">
      <button
        v-for="f in filterPills"
        :key="f"
        @click="filter = f"
        :class="[
          'px-4 py-2 rounded-full text-xs font-bold capitalize transition shrink-0',
          filter === f
            ? 'bg-clay text-white shadow-xs'
            : 'bg-white dark:bg-mist-dark border border-mist dark:border-white/10 text-ink/70 dark:text-white/70 hover:bg-mist/40'
        ]"
      >
        {{ pillLabel(f) }}
      </button>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="space-y-4">
      <div v-for="i in 4" :key="i" class="h-24 rounded-2xl bg-mist/50 dark:bg-mist-dark/50 animate-pulse"></div>
    </div>

    <!-- Empty -->
    <div v-else-if="!filteredNotifications.length" class="border border-dashed border-mist dark:border-white/15 rounded-3xl p-16 text-center bg-white dark:bg-mist-dark/30">
      <div class="text-3xl mb-3">🔔</div>
      <p class="font-display font-bold text-lg text-ink dark:text-[#F0EDE6] mb-1">No notifications</p>
      <p class="text-sm text-ink/50 dark:text-white/50">You're completely caught up!</p>
    </div>

    <!-- Notification list -->
    <div v-else class="space-y-3">
      <component
        :is="notif.link ? 'NuxtLink' : 'div'"
        v-for="notif in filteredNotifications"
        :key="notif.id"
        :to="notif.link || undefined"
        @click="onNotifClick(notif.id)"
        class="block rounded-2xl border transition p-4 sm:p-5 relative cursor-pointer"
        :class="[
          notif.isRead
            ? 'bg-white/60 dark:bg-mist-dark/40 border-mist dark:border-white/10 hover:border-clay/40'
            : 'bg-white dark:bg-mist-dark border-clay/30 shadow-xs hover:border-clay'
        ]"
      >
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 rounded-xl bg-mist/60 dark:bg-white/5 flex items-center justify-center text-lg shrink-0">
            {{ notif.icon }}
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2 mb-1">
              <div class="flex items-center gap-2">
                <p class="font-bold text-sm text-ink dark:text-[#F0EDE6] truncate">
                  {{ notif.title }}
                </p>
                <span v-if="!notif.isRead" class="w-2 h-2 rounded-full bg-clay shrink-0"></span>
              </div>
              <span class="text-[11px] text-ink/40 dark:text-white/40 shrink-0">
                {{ formatDate(notif.time) }}
              </span>
            </div>

            <p class="text-xs sm:text-sm text-ink/70 dark:text-white/70 leading-relaxed">
              {{ notif.message }}
            </p>
          </div>
        </div>
      </component>
    </div>
  </div>
</template>
