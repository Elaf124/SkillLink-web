<script setup lang="ts">
definePageMeta({ layout: 'default', middleware: ['auth'] })

const { apiFetch, token } = useApi()
const router = useRouter()
const goBack = useGoBack('/dashboard')

const bookings = ref<any[]>([])
const loading = ref(true)
const user = ref<any>(null)
const filter = ref<'all' | 'active' | 'completed' | 'cancelled'>('all')

const statusLabel: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  in_progress: 'In Progress',
  awaiting_confirmation: 'Awaiting Confirmation',
  completed: 'Completed',
  cancelled_by_customer: 'Cancelled by Customer',
  cancelled_by_provider: 'Cancelled by Provider',
  rejected: 'Rejected',
  disputed: 'Disputed',
}

onMounted(async () => {
  if (!token.value) {
    router.push('/login')
    return
  }
  await loadBookings()
})

async function loadBookings() {
  loading.value = true
  try {
    user.value = await apiFetch('/user')
    const isCustomer = user.value?.role?.name !== 'provider'
    const res = await apiFetch<any>(isCustomer ? '/my-bookings/customer' : '/my-bookings/provider')
    bookings.value = res.data ?? []
  } catch {
    bookings.value = []
  } finally {
    loading.value = false
  }
}

const filteredBookings = computed(() => {
  if (filter.value === 'active') {
    return bookings.value.filter(b => ['pending', 'accepted', 'in_progress', 'awaiting_confirmation'].includes(b.status))
  }
  if (filter.value === 'completed') {
    return bookings.value.filter(b => b.status === 'completed')
  }
  if (filter.value === 'cancelled') {
    return bookings.value.filter(b => ['cancelled_by_customer', 'cancelled_by_provider', 'rejected'].includes(b.status))
  }
  return bookings.value
})

function formatDate(d: string) {
  if (!d) return ''
  return new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d))
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-6 py-8 sm:py-12">
    <!-- Back button -->
    <div class="mb-4">
      <button @click="goBack" class="inline-flex items-center gap-1.5 text-xs font-semibold text-clay hover:underline">
        <span>←</span> Back to Dashboard
      </button>
    </div>

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-mist dark:border-white/10">
      <div>
        <p class="text-xs font-bold text-clay uppercase tracking-wider mb-1">Orders & Engagements</p>
        <h1 class="font-display text-3xl font-extrabold text-ink dark:text-[#F0EDE6]">
          My Bookings
        </h1>
        <p class="text-sm text-ink/60 dark:text-white/60 mt-1">
          Track service delivery milestones, payment confirmations, and chat with providers.
        </p>
      </div>

      <NuxtLink
        to="/browse"
        class="inline-flex items-center gap-2 bg-clay hover:bg-clay/90 text-white text-xs font-bold px-5 py-3 rounded-full shadow-md transition shrink-0"
      >
        <span>🔍</span> Browse Services
      </NuxtLink>
    </div>

    <!-- Filter Tabs -->
    <div class="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-none">
      <button
        v-for="f in (['all', 'active', 'completed', 'cancelled'] as const)"
        :key="f"
        @click="filter = f"
        :class="[
          'px-4 py-2 rounded-full text-xs font-bold capitalize transition shrink-0',
          filter === f
            ? 'bg-clay text-white shadow-xs'
            : 'bg-white dark:bg-mist-dark border border-mist dark:border-white/10 text-ink/70 dark:text-white/70 hover:bg-mist/40'
        ]"
      >
        {{ f }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="h-32 rounded-2xl bg-mist/50 dark:bg-mist-dark/50 animate-pulse"></div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!filteredBookings.length" class="border border-dashed border-mist dark:border-white/15 rounded-3xl p-16 text-center bg-white dark:bg-mist-dark/30">
      <div class="text-3xl mb-3">📅</div>
      <p class="font-display font-bold text-lg text-ink dark:text-[#F0EDE6] mb-1">No bookings found</p>
      <p class="text-sm text-ink/50 dark:text-white/50 mb-6">You don't have any bookings matching this status.</p>
      <NuxtLink
        to="/browse"
        class="inline-flex items-center gap-2 bg-clay hover:bg-clay/90 text-white text-xs font-bold px-5 py-2.5 rounded-full transition shadow-sm"
      >
        Find a Provider →
      </NuxtLink>
    </div>

    <!-- Bookings List -->
    <div v-else class="space-y-4">
      <div
        v-for="b in filteredBookings"
        :key="b.id"
        class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 shadow-xs hover:border-clay/40 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 mb-2 flex-wrap">
            <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-mist dark:bg-white/10 text-ink/70 dark:text-white/70">
              {{ b.service?.category?.name || 'Service Order' }}
            </span>
            <span
              :class="[
                'text-xs font-bold px-2.5 py-0.5 rounded-full',
                b.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                b.status.includes('cancelled') ? 'bg-mist text-ink/50 dark:text-white/40' :
                'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              ]"
            >
              • {{ statusLabel[b.status] || b.status }}
            </span>
          </div>

          <NuxtLink :to="`/bookings/${b.id}`" class="block group">
            <h2 class="font-display text-lg font-bold text-ink dark:text-[#F0EDE6] group-hover:text-clay transition truncate">
              {{ b.job?.title || b.service?.title || 'Service Booking' }}
            </h2>
          </NuxtLink>

          <p class="text-xs text-ink/60 dark:text-white/60 mt-1">
            Provider: <strong class="text-ink dark:text-white">{{ b.provider?.user?.first_name }} {{ b.provider?.user?.last_name }}</strong>
            · 🗓️ {{ formatDate(b.created_at) }}
          </p>
        </div>

        <div class="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-mist dark:border-white/10">
          <p class="font-display text-xl font-bold text-clay">ETB {{ Number(b.total_amount).toLocaleString() }}</p>
          <NuxtLink
            :to="`/bookings/${b.id}`"
            class="px-4 py-2 rounded-xl bg-clay hover:bg-clay/90 text-white font-bold text-xs transition shadow-xs"
          >
            View Details →
          </NuxtLink>
        </div>
      </div>
    </div>

  </div>
</template>
