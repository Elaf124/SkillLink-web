<script setup lang="ts">
definePageMeta({ layout: 'default', middleware: ['auth'] })

const { apiFetch, token } = useApi()
const router = useRouter()
const goBack = useGoBack('/dashboard')

const user = ref<any>(null)
const bookings = ref<any[]>([])
const loading = ref(true)
const filter = ref<'all' | 'completed' | 'in_progress'>('all')

onMounted(async () => {
  if (!token.value) {
    router.push('/login')
    return
  }
  await loadTransactions()
})

async function loadTransactions() {
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

const transactions = computed(() => {
  return bookings.value.map(b => {
    const isComplete = b.status === 'completed'
    const isHeld = ['pending', 'accepted', 'in_progress', 'awaiting_confirmation'].includes(b.status)
    const amount = Number(b.total_amount || b.amount || 0)
    const counterpartName = user.value?.role?.name === 'provider'
      ? `${b.customer?.first_name || ''} ${b.customer?.last_name || ''}`.trim() || 'Customer'
      : `${b.provider?.user?.first_name || ''} ${b.provider?.user?.last_name || ''}`.trim() || 'Provider'

    return {
      id: b.id,
      title: b.job?.title || b.service?.title || 'Service Engagement',
      date: b.created_at,
      counterpart: counterpartName,
      grossAmount: amount,
      serviceFee: amount * 0.10,
      netAmount: user.value?.role?.name === 'provider' ? amount * 0.90 : amount,
      paymentMethod: b.payment_method || 'Telebirr (Mobile Money)',
      status: isComplete ? 'paid' : isHeld ? 'escrow_held' : 'cancelled',
      statusText: isComplete ? 'Payment Released' : isHeld ? 'Held in Escrow' : 'Cancelled / Refunded',
      bookingLink: `/bookings/${b.id}`,
    }
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
})

const totalSpent = computed(() => {
  return transactions.value
    .filter(t => t.status === 'paid')
    .reduce((sum, t) => sum + t.netAmount, 0)
})

const totalInEscrow = computed(() => {
  return transactions.value
    .filter(t => t.status === 'escrow_held')
    .reduce((sum, t) => sum + t.grossAmount, 0)
})

const filteredTransactions = computed(() => {
  if (filter.value === 'completed') return transactions.value.filter(t => t.status === 'paid')
  if (filter.value === 'in_progress') return transactions.value.filter(t => t.status === 'escrow_held')
  return transactions.value
})

function formatDate(d: string) {
  if (!d) return ''
  return new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d))
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-6 py-8 sm:py-12">
    <!-- Back navigation -->
    <div class="mb-4">
      <button @click="goBack" class="inline-flex items-center gap-1.5 text-xs font-semibold text-clay hover:underline">
        <span>←</span> Back to Dashboard
      </button>
    </div>

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-mist dark:border-white/10">
      <div>
        <p class="text-xs font-bold text-clay uppercase tracking-wider mb-1">Financial Ledger</p>
        <h1 class="font-display text-3xl font-extrabold text-ink dark:text-[#F0EDE6]">
          Transactions & Escrow History
        </h1>
        <p class="text-sm text-ink/60 dark:text-white/60 mt-1">
          Review all service payments, escrow deposits, and release receipts.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
          <span>🛡️</span> Escrow Protected
        </span>
      </div>
    </div>

    <!-- Financial Summary Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
      <div class="p-5 rounded-2xl bg-white dark:bg-mist-dark border border-mist dark:border-white/10 shadow-xs">
        <p class="text-xs font-semibold text-ink/50 dark:text-white/50 mb-1">Total Completed Spend</p>
        <p class="font-display text-2xl font-bold text-ink dark:text-[#F0EDE6]">
          ETB {{ totalSpent.toLocaleString() }}
        </p>
        <p class="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">Released to providers</p>
      </div>

      <div class="p-5 rounded-2xl bg-white dark:bg-mist-dark border border-mist dark:border-white/10 shadow-xs">
        <p class="text-xs font-semibold text-ink/50 dark:text-white/50 mb-1">Currently in Escrow</p>
        <p class="font-display text-2xl font-bold text-amber-600 dark:text-amber-400">
          ETB {{ totalInEscrow.toLocaleString() }}
        </p>
        <p class="text-[11px] text-ink/40 dark:text-white/40 mt-1">Held until work confirmation</p>
      </div>

      <div class="p-5 rounded-2xl bg-white dark:bg-mist-dark border border-mist dark:border-white/10 shadow-xs">
        <p class="text-xs font-semibold text-ink/50 dark:text-white/50 mb-1">Total Transactions</p>
        <p class="font-display text-2xl font-bold text-clay">
          {{ transactions.length }}
        </p>
        <p class="text-[11px] text-ink/40 dark:text-white/40 mt-1">Orders & engagements</p>
      </div>
    </div>

    <!-- Filter Pills -->
    <div class="flex gap-2 mb-6">
      <button
        v-for="f in (['all', 'completed', 'in_progress'] as const)"
        :key="f"
        @click="filter = f"
        :class="[
          'px-4 py-2 rounded-full text-xs font-bold capitalize transition',
          filter === f
            ? 'bg-clay text-white shadow-xs'
            : 'bg-white dark:bg-mist-dark border border-mist dark:border-white/10 text-ink/70 dark:text-white/70 hover:bg-mist/40'
        ]"
      >
        {{ f === 'all' ? `All (${transactions.length})` : f === 'completed' ? 'Completed & Paid' : 'In Escrow' }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="h-28 rounded-2xl bg-mist/50 dark:bg-mist-dark/50 animate-pulse"></div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!filteredTransactions.length" class="border border-dashed border-mist dark:border-white/15 rounded-3xl p-16 text-center bg-white dark:bg-mist-dark/30">
      <div class="text-3xl mb-3">💳</div>
      <p class="font-display font-bold text-lg text-ink dark:text-[#F0EDE6] mb-1">No transactions recorded</p>
      <p class="text-sm text-ink/50 dark:text-white/50 mb-6">You have no payment activities under this filter.</p>
      <NuxtLink
        to="/browse"
        class="inline-flex items-center gap-2 bg-clay hover:bg-clay/90 text-white text-xs font-bold px-5 py-2.5 rounded-full transition shadow-sm"
      >
        Browse Services →
      </NuxtLink>
    </div>

    <!-- Transactions List -->
    <div v-else class="space-y-4">
      <div
        v-for="t in filteredTransactions"
        :key="t.id"
        class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-5 sm:p-6 shadow-xs hover:border-clay/40 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div class="flex items-start gap-4 min-w-0 flex-1">
          <div class="w-11 h-11 rounded-xl bg-mist/50 dark:bg-white/5 flex items-center justify-center text-lg shrink-0">
            {{ t.status === 'paid' ? '✅' : t.status === 'escrow_held' ? '🔒' : '↩️' }}
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 mb-1 flex-wrap">
              <span
                :class="[
                  'text-[11px] font-bold px-2.5 py-0.5 rounded-full',
                  t.status === 'paid' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                  t.status === 'escrow_held' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                  'bg-mist text-ink/50 dark:text-white/40'
                ]"
              >
                {{ t.statusText }}
              </span>
              <span class="text-xs text-ink/40 dark:text-white/40">🗓️ {{ formatDate(t.date) }}</span>
            </div>

            <NuxtLink :to="t.bookingLink" class="block group">
              <h2 class="font-display text-base font-bold text-ink dark:text-[#F0EDE6] group-hover:text-clay transition truncate">
                {{ t.title }}
              </h2>
            </NuxtLink>

            <p class="text-xs text-ink/60 dark:text-white/60 mt-0.5">
              Party: <strong class="text-ink dark:text-white">{{ t.counterpart }}</strong> · Method: {{ t.paymentMethod }}
            </p>
          </div>
        </div>

        <div class="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-mist dark:border-white/10">
          <p class="font-display text-xl font-bold text-ink dark:text-white">
            ETB {{ t.grossAmount.toLocaleString() }}
          </p>
          <NuxtLink
            :to="t.bookingLink"
            class="text-xs font-bold text-clay hover:underline"
          >
            View Order Receipt →
          </NuxtLink>
        </div>
      </div>
    </div>

  </div>
</template>
