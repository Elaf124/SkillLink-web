<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'admin-finance-only'] })

const { apiFetch } = useApi()
const router = useRouter()
const route = useRoute()

const loading = ref(true)
const transactionsLoading = ref(false)
const stats = ref<any>(null)
const transactions = ref<any[]>([])
const pagination = ref<any>({ current_page: 1, last_page: 1, total: 0 })

// Active Tab state synced with URL query (?tab=overview|transactions|escrow|gateways)
const activeTab = ref<'overview' | 'transactions' | 'escrow' | 'gateways'>('overview')

watch(() => route.query.tab, (tab) => {
  if (tab === 'transactions') activeTab.value = 'transactions'
  else if (tab === 'escrow') activeTab.value = 'escrow'
  else if (tab === 'gateways') activeTab.value = 'gateways'
  else activeTab.value = 'overview'
}, { immediate: true })

function switchTab(tab: 'overview' | 'transactions' | 'escrow' | 'gateways') {
  activeTab.value = tab
  router.replace({ query: { ...route.query, tab } })
}

// Filters & Search
const statusFilter = ref('all')
const methodFilter = ref('')
const searchFilter = ref('')
const currentPage = ref(1)

// Selected Transaction Modal State
const selectedTx = ref<any>(null)
const receiptModalOpen = ref(false)

// Toast notification
const toastMessage = ref('')
function showToast(msg: string) {
  toastMessage.value = msg
  setTimeout(() => {
    toastMessage.value = ''
  }, 4000)
}

const payoutReadiness = ref<any>({ data: [], summary: { ready: 0, not_ready: 0, total_in_wallets: 0 } })
const payoutLoading = ref(false)

async function loadPayoutReadiness() {
  payoutLoading.value = true
  try {
    const res: any = await apiFetch('/admin/finance/payout-readiness')
    payoutReadiness.value = res
  } catch {
    payoutReadiness.value = { data: [], summary: { ready: 0, not_ready: 0, total_in_wallets: 0 } }
  } finally {
    payoutLoading.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadStats(), loadTransactions(), loadPayoutReadiness()])
})

async function loadStats() {
  loading.value = true
  try {
    const res: any = await apiFetch('/admin/finance/stats')
    stats.value = res.data
  } catch (err) {
    stats.value = null
  } finally {
    loading.value = false
  }
}

async function loadTransactions(page = 1) {
  transactionsLoading.value = true
  currentPage.value = page
  try {
    let url = `/admin/finance/transactions?page=${page}`
    if (statusFilter.value && statusFilter.value !== 'all') {
      url += `&status=${statusFilter.value}`
    }
    if (methodFilter.value) {
      url += `&method=${methodFilter.value}`
    }

    const res: any = await apiFetch(url)
    transactions.value = res.data?.data ?? []
    pagination.value = {
      current_page: res.data?.current_page ?? 1,
      last_page: res.data?.last_page ?? 1,
      total: res.data?.total ?? 0,
    }
  } catch (err) {
    transactions.value = []
  } finally {
    transactionsLoading.value = false
  }
}

function handleFilterChange() {
  loadTransactions(1)
}

function formatMoney(amount: number | string | null | undefined) {
  if (amount == null) return '0.00'
  return Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return String(dateStr)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatFullDate(dateStr: string | null | undefined) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return String(dateStr)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getMethodLabel(method: string) {
  const map: Record<string, string> = {
    telebirr_sim: 'Telebirr',
    cbe_birr_sim: 'CBE Birr',
    chapa_sim: 'Chapa',
    cash_sim: 'Direct Cash',
  }
  return map[method] || method
}

function getMethodBadgeClass(method: string) {
  switch (method) {
    case 'telebirr_sim':
      return 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800'
    case 'cbe_birr_sim':
      return 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800'
    case 'chapa_sim':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300 border-gray-200 dark:border-white/15'
  }
}

const maxChartValue = computed(() => {
  if (!stats.value?.daily_revenue?.length) return 1
  const max = Math.max(...stats.value.daily_revenue.map((d: any) => d.total))
  return max > 0 ? max : 1
})

const filteredTransactions = computed(() => {
  let list = transactions.value
  if (searchFilter.value.trim()) {
    const q = searchFilter.value.toLowerCase()
    list = list.filter((t: any) =>
      (t.transaction_reference || '').toLowerCase().includes(q) ||
      (t.customer?.name || '').toLowerCase().includes(q) ||
      (t.provider?.name || '').toLowerCase().includes(q) ||
      String(t.booking_id || '').includes(q)
    )
  }
  return list
})

const pendingEscrowTransactions = computed(() => {
  return transactions.value.filter(t => t.payment_status === 'pending')
})

function openReceiptModal(tx: any) {
  selectedTx.value = tx
  receiptModalOpen.value = true
}

function exportCsv() {
  if (!transactions.value.length) {
    showToast('No transactions available to export.')
    return
  }

  const headers = ['ID', 'Reference', 'Booking ID', 'Customer Name', 'Customer Email', 'Provider Name', 'Provider Email', 'Gross Amount (ETB)', 'Commission (ETB)', 'Provider Net (ETB)', 'Channel', 'Status', 'Date']
  const rows = transactions.value.map(t => [
    t.id,
    `"${t.transaction_reference || ''}"`,
    t.booking_id || '',
    `"${t.customer?.name || ''}"`,
    `"${t.customer?.email || ''}"`,
    `"${t.provider?.name || ''}"`,
    `"${t.provider?.email || ''}"`,
    t.amount || 0,
    t.commission || 0,
    t.provider_amount || 0,
    `"${getMethodLabel(t.payment_method)}"`,
    `"${t.payment_status}"`,
    `"${t.paid_at || t.created_at || ''}"`
  ])

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
  const encodedUri = encodeURI(csvContent)
  const link = document.createElement('a')
  link.setAttribute('href', encodedUri)
  link.setAttribute('download', `SkillLink_Financial_Ledger_${new Date().toISOString().slice(0, 10)}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  showToast('✓ Transaction ledger CSV exported successfully!')
}

function printReceipt() {
  if (import.meta.client) {
    window.print()
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Admin Consoles Navigation Bar -->
    <div class="flex items-center gap-2 border-b border-mist/80 dark:border-white/10 pb-4 overflow-x-auto">
      <NuxtLink
        to="/admin/support"
        class="px-4 py-2 rounded-xl text-xs font-semibold text-ink/70 dark:text-white/70 hover:bg-clay/10 hover:text-clay dark:hover:bg-white/10 dark:hover:text-white transition flex items-center gap-2"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <span>Trust, Safety & Support</span>
      </NuxtLink>
      <NuxtLink
        to="/admin/providers"
        class="px-4 py-2 rounded-xl text-xs font-semibold text-ink/70 dark:text-white/70 hover:bg-clay/10 hover:text-clay dark:hover:bg-white/10 dark:hover:text-white transition flex items-center gap-2"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m9 12 2 2 4-4"/><path d="M12 3a12 12 0 0 0 8.5 3A12 12 0 0 1 12 21 12 12 0 0 1 3.5 6 12 12 0 0 0 12 3z"/>
        </svg>
        <span>Provider Verification</span>
      </NuxtLink>
      <NuxtLink
        to="/admin/finance"
        class="px-4 py-2 rounded-xl text-xs font-bold bg-clay text-white shadow-xs flex items-center gap-2"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>
        </svg>
        <span>Finance & Payouts</span>
      </NuxtLink>
    </div>
    <!-- Top notification toast -->
    <div
      v-if="toastMessage"
      class="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-slate-900 text-white shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom-4 duration-200"
    >
      <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
      <span class="text-xs sm:text-sm font-semibold">{{ toastMessage }}</span>
      <button @click="toastMessage = ''" class="ml-2 text-white/60 hover:text-white text-base">&times;</button>
    </div>

    <!-- ── Page Title Header matching Admin design system ── -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-[#FAF0E6] dark:bg-[#253742] border border-[#EADFD7] dark:border-white/10 flex items-center justify-center text-[#8A5B43] dark:text-[#D4A98A] shadow-xs">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="20" height="14" x="2" y="5" rx="2"/>
              <line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
          </div>
          <div>
            <h1 class="font-display text-2xl sm:text-3xl font-bold text-[#1A1210] dark:text-[#F0EDE6] tracking-tight">
              Finance & Escrow Operations
            </h1>
            <p class="text-xs sm:text-sm text-[#7D6E66] dark:text-white/60 mt-0.5">
              Monitor platform Gross Merchandise Volume (GMV), 10% commission fees, provider payouts, and Telebirr / CBE Birr settlement feeds.
            </p>
          </div>
        </div>
      </div>

      <!-- Action Controls -->
      <div class="flex items-center gap-2 self-start sm:self-auto">
        <!-- Export CSV Button -->
        <button
          @click="exportCsv"
          class="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#FAF0E6] dark:bg-[#253742] border border-[#EADFD7] dark:border-white/10 text-[#8A5B43] dark:text-[#D4A98A] hover:bg-[#F5EDE6] transition flex items-center gap-2 shadow-2xs active:scale-95"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span>Export Ledger</span>
        </button>

        <!-- Refresh Data Button -->
        <button
          @click="loadStats(); loadTransactions(1);"
          :disabled="loading || transactionsLoading"
          class="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-[#1E2D37] border border-[#D9CBC1] dark:border-white/15 text-[#5A3E26] dark:text-[#F0EDE6] hover:bg-[#FAF7F4] dark:hover:bg-white/5 transition flex items-center gap-2 shadow-2xs active:scale-95"
        >
          <svg :class="['w-3.5 h-3.5 text-[#8A5B43] dark:text-[#D4A98A]', (loading || transactionsLoading) ? 'animate-spin' : '']" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
          <span>Refresh Data</span>
        </button>
      </div>
    </div>

    <!-- ── KPI Metric Cards ── -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- 1. Total Platform Volume -->
      <div class="p-5 rounded-2xl bg-white dark:bg-[#1E2D37] border border-[#EADFD7] dark:border-white/10 shadow-xs flex flex-col justify-between">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-[#7D6E66] dark:text-white/50">Gross Volume (GMV)</span>
          <span class="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </span>
        </div>
        <div class="mt-3">
          <p class="text-2xl sm:text-3xl font-display font-extrabold text-[#1A1210] dark:text-white">
            {{ formatMoney(stats?.kpis?.total_revenue) }} <span class="text-xs font-bold text-[#7D6E66]">ETB</span>
          </p>
          <p class="text-xs text-[#7D6E66] dark:text-white/50 mt-0.5">
            Across {{ stats?.kpis?.paid_transactions ?? 0 }} settled transactions
          </p>
        </div>
      </div>

      <!-- 2. Platform Commission -->
      <div class="p-5 rounded-2xl bg-white dark:bg-[#1E2D37] border border-[#EADFD7] dark:border-white/10 shadow-xs flex flex-col justify-between">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-[#7D6E66] dark:text-white/50">Platform Revenue</span>
          <span class="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              <polyline points="17 6 23 6 23 12"/>
            </svg>
          </span>
        </div>
        <div class="mt-3">
          <p class="text-2xl sm:text-3xl font-display font-extrabold text-emerald-700 dark:text-emerald-400">
            {{ formatMoney(stats?.kpis?.total_commission) }} <span class="text-xs font-bold text-[#7D6E66]">ETB</span>
          </p>
          <p class="text-xs text-[#7D6E66] dark:text-white/50 mt-0.5">
            {{ stats?.kpis?.commission_rate ?? 10 }}% platform marketplace fee
          </p>
        </div>
      </div>

      <!-- 3. Provider Net Payouts -->
      <div class="p-5 rounded-2xl bg-white dark:bg-[#1E2D37] border border-[#EADFD7] dark:border-white/10 shadow-xs flex flex-col justify-between">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-[#7D6E66] dark:text-white/50">Provider Earnings</span>
          <span class="w-8 h-8 rounded-xl bg-[#FAF0E6] dark:bg-[#253742] text-[#8A5B43] dark:text-[#D4A98A] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </span>
        </div>
        <div class="mt-3">
          <p class="text-2xl sm:text-3xl font-display font-extrabold text-[#8A5B43] dark:text-[#D4A98A]">
            {{ formatMoney(stats?.kpis?.total_provider_payout) }} <span class="text-xs font-bold text-[#7D6E66]">ETB</span>
          </p>
          <p class="text-xs text-[#7D6E66] dark:text-white/50 mt-0.5">Disbursed to verified talent</p>
        </div>
      </div>

      <!-- 4. Pending Payments -->
      <div class="p-5 rounded-2xl bg-white dark:bg-[#1E2D37] border border-[#EADFD7] dark:border-white/10 shadow-xs flex flex-col justify-between">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-[#7D6E66] dark:text-white/50">Pending Escrow</span>
          <span class="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </span>
        </div>
        <div class="mt-3">
          <p class="text-2xl sm:text-3xl font-display font-extrabold text-amber-700 dark:text-amber-400">
            {{ stats?.kpis?.pending_payments ?? 0 }}
          </p>
          <p class="text-xs text-[#7D6E66] dark:text-white/50 mt-0.5">Awaiting customer release</p>
        </div>
      </div>
    </div>

    <!-- ── Tab Navigation Bar ── -->
    <div class="flex items-center gap-2 p-1.5 bg-[#F5EDE6] dark:bg-[#253742] rounded-2xl border border-[#E8DDD4] dark:border-white/10 overflow-x-auto">
      <button
        @click="switchTab('overview')"
        :class="[
          'px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 whitespace-nowrap',
          activeTab === 'overview'
            ? 'bg-white dark:bg-[#15232D] text-[#8A5B43] dark:text-[#D4A98A] shadow-xs border border-[#E0D3C7] dark:border-white/10'
            : 'text-[#6E5D53] dark:text-white/70 hover:text-[#1A1210] dark:hover:text-white'
        ]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 3v18h18"/>
          <path d="m19 9-5 5-4-4-3 3"/>
        </svg>
        <span>Overview & Volume Analytics</span>
      </button>

      <button
        @click="switchTab('transactions')"
        :class="[
          'px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 whitespace-nowrap',
          activeTab === 'transactions'
            ? 'bg-white dark:bg-[#15232D] text-[#8A5B43] dark:text-[#D4A98A] shadow-xs border border-[#E0D3C7] dark:border-white/10'
            : 'text-[#6E5D53] dark:text-white/70 hover:text-[#1A1210] dark:hover:text-white'
        ]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="8" y1="6" x2="21" y2="6"/>
          <line x1="8" y1="12" x2="21" y2="12"/>
          <line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6" x2="3.01" y2="6"/>
          <line x1="3" y1="12" x2="3.01" y2="12"/>
          <line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
        <span>Transaction Ledger</span>
        <span class="px-2 py-0.5 text-[10px] rounded-full bg-[#FAF0E6] dark:bg-white/10 text-[#8A5B43] dark:text-[#D4A98A] font-extrabold">
          {{ pagination.total }}
        </span>
      </button>

      <button
        @click="switchTab('escrow')"
        :class="[
          'px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 whitespace-nowrap',
          activeTab === 'escrow'
            ? 'bg-white dark:bg-[#15232D] text-[#8A5B43] dark:text-[#D4A98A] shadow-xs border border-[#E0D3C7] dark:border-white/10'
            : 'text-[#6E5D53] dark:text-white/70 hover:text-[#1A1210] dark:hover:text-white'
        ]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <span>Escrow & Settlements</span>
        <span class="px-2 py-0.5 text-[10px] rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-extrabold">
          {{ stats?.kpis?.pending_payments ?? 0 }}
        </span>
      </button>

      <button
        @click="switchTab('gateways')"
        :class="[
          'px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 whitespace-nowrap',
          activeTab === 'gateways'
            ? 'bg-white dark:bg-[#15232D] text-[#8A5B43] dark:text-[#D4A98A] shadow-xs border border-[#E0D3C7] dark:border-white/10'
            : 'text-[#6E5D53] dark:text-white/70 hover:text-[#1A1210] dark:hover:text-white'
        ]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
        <span>Payment Gateways</span>
      </button>
    </div>

    <!-- ── TAB 1: OVERVIEW & ANALYTICS ── -->
    <div v-if="activeTab === 'overview'" class="space-y-6">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- 30-Day Volume Chart -->
        <div class="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-[#1E2D37] border border-[#EADFD7] dark:border-white/10 shadow-xs">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h3 class="font-display font-bold text-base text-[#1A1210] dark:text-white">30-Day Platform Transaction Volume</h3>
              <p class="text-xs text-[#7D6E66] dark:text-white/50">Daily gross payment activity in Ethiopian Birr</p>
            </div>
            <span class="text-xs font-bold text-[#8A5B43] bg-[#FAF0E6] dark:bg-white/10 px-3 py-1 rounded-full border border-[#EADFD7] dark:border-white/10">
              Live Gateway Feed
            </span>
          </div>

          <div v-if="stats?.daily_revenue?.length" class="h-48 flex items-end gap-1 sm:gap-1.5 pt-6 pb-2">
            <div
              v-for="day in stats.daily_revenue"
              :key="day.date"
              class="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end"
            >
              <!-- Tooltip -->
              <div class="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-30 pointer-events-none">
                <div class="bg-slate-900 text-white text-[10px] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-xl border border-slate-700">
                  <p class="font-bold">{{ day.label }}</p>
                  <p>Volume: {{ formatMoney(day.total) }} ETB</p>
                  <p class="text-emerald-400">Commission: {{ formatMoney(day.commission) }} ETB</p>
                </div>
                <div class="w-1.5 h-1.5 bg-slate-900 rotate-45 -mt-1"></div>
              </div>

              <!-- Bar -->
              <div
                class="w-full rounded-t-md transition-all duration-300"
                :class="day.total > 0 ? 'bg-[#8A5B43] hover:bg-[#784E29]' : 'bg-[#F3EBE4] dark:bg-white/5'"
                :style="{ height: `${Math.max((day.total / maxChartValue) * 100, 4)}%` }"
              ></div>
            </div>
          </div>
          <div v-else class="h-48 flex items-center justify-center text-xs text-[#7D6E66]">
            No revenue records logged in the last 30 days.
          </div>

          <div class="flex justify-between items-center text-[10px] font-bold text-[#7D6E66] dark:text-white/50 pt-3 border-t border-[#F0E6DE] dark:border-white/10">
            <span>30 days ago</span>
            <span>15 days ago</span>
            <span>Today</span>
          </div>
        </div>

        <!-- Gateway Distribution Quick Card -->
        <div class="p-6 rounded-3xl bg-white dark:bg-[#1E2D37] border border-[#EADFD7] dark:border-white/10 shadow-xs flex flex-col justify-between">
          <div>
            <h3 class="font-display font-bold text-base text-[#1A1210] dark:text-white mb-1">Gateway Share</h3>
            <p class="text-xs text-[#7D6E66] dark:text-white/50 mb-5">Volume by payment channel</p>

            <div v-if="stats?.by_method?.length" class="space-y-4">
              <div v-for="m in stats.by_method" :key="m.method">
                <div class="flex justify-between items-center text-xs mb-1">
                  <span class="font-bold text-[#1A1210] dark:text-white">{{ getMethodLabel(m.method) }}</span>
                  <span class="font-semibold text-[#7D6E66] dark:text-white/60">{{ formatMoney(m.total) }} ETB</span>
                </div>
                <div class="w-full h-2 rounded-full bg-[#F3EBE4] dark:bg-white/10 overflow-hidden">
                  <div
                    class="h-full bg-[#8A5B43] rounded-full"
                    :style="{ width: `${stats.kpis?.total_revenue ? (m.total / stats.kpis.total_revenue) * 100 : 0}%` }"
                  ></div>
                </div>
              </div>
            </div>
            <div v-else class="py-8 text-center text-xs text-[#7D6E66] dark:text-white/50">
              No gateway transactions logged yet.
            </div>
          </div>

          <div class="pt-4 border-t border-[#F0E6DE] dark:border-white/10 text-xs text-[#7D6E66] dark:text-white/50 flex items-center justify-between">
            <span>Integration Status</span>
            <span class="text-emerald-600 dark:text-emerald-400 font-bold">Telebirr • CBE • Chapa</span>
          </div>
        </div>
      </div>

      <!-- Quick Recent Transactions Preview -->
      <div class="bg-white dark:bg-[#1E2D37] rounded-3xl border border-[#EADFD7] dark:border-white/10 shadow-xs p-6">
        <div class="flex items-center justify-between pb-4 border-b border-[#F0E6DE] dark:border-white/10">
          <div>
            <h3 class="font-display font-bold text-base text-[#1A1210] dark:text-white">Recent Financial Settlements</h3>
            <p class="text-xs text-[#7D6E66] dark:text-white/50">Latest customer payouts and escrow releases</p>
          </div>
          <button @click="switchTab('transactions')" class="text-xs font-bold text-[#8A5B43] dark:text-[#D4A98A] hover:underline">
            View Full Ledger &rarr;
          </button>
        </div>

        <div class="overflow-x-auto pt-2">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="text-[#7D6E66] border-b border-[#F0E6DE] dark:border-white/10">
                <th class="py-3 px-2">Ref</th>
                <th class="py-3 px-2">Customer</th>
                <th class="py-3 px-2">Provider</th>
                <th class="py-3 px-2 text-right">Gross</th>
                <th class="py-3 px-2 text-right">10% Fee</th>
                <th class="py-3 px-2 text-right">90% Payout</th>
                <th class="py-3 px-2">Channel</th>
                <th class="py-3 px-2">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#F0E6DE] dark:divide-white/10">
              <tr v-for="t in transactions.slice(0, 5)" :key="t.id" class="hover:bg-[#FAF6F2] dark:hover:bg-white/[0.02] cursor-pointer" @click="openReceiptModal(t)">
                <td class="py-3 px-2 font-mono font-bold text-[#8A5B43]">{{ t.transaction_reference || `TXN-${t.id}` }}</td>
                <td class="py-3 px-2 font-semibold text-[#1A1210] dark:text-white">{{ t.customer?.name || 'Customer' }}</td>
                <td class="py-3 px-2 font-semibold text-[#1A1210] dark:text-white">{{ t.provider?.name || 'Provider' }}</td>
                <td class="py-3 px-2 text-right font-bold text-[#1A1210] dark:text-white">{{ formatMoney(t.amount) }}</td>
                <td class="py-3 px-2 text-right font-bold text-emerald-600 dark:text-emerald-400">{{ formatMoney(t.commission) }}</td>
                <td class="py-3 px-2 text-right font-bold text-[#8A5B43] dark:text-[#D4A98A]">{{ formatMoney(t.provider_amount) }}</td>
                <td class="py-3 px-2"><span :class="['px-2 py-0.5 rounded-full text-[10px] font-bold border', getMethodBadgeClass(t.payment_method)]">{{ getMethodLabel(t.payment_method) }}</span></td>
                <td class="py-3 px-2"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">{{ t.payment_status }}</span></td>
              </tr>
              <tr v-if="transactions.length === 0">
                <td colspan="8" class="py-8 text-center text-[#7D6E66] dark:text-white/50">No recent transaction records found.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ── TAB 2: TRANSACTION LEDGER ── -->
    <div v-if="activeTab === 'transactions'" class="bg-white dark:bg-[#1E2D37] rounded-3xl border border-[#EADFD7] dark:border-white/10 shadow-xs p-6 sm:p-7 space-y-6">
      <!-- Toolbar -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#F0E6DE] dark:border-white/10">
        <!-- Status Filters -->
        <div class="inline-flex items-center gap-1.5 p-1 bg-[#F5EDE6] dark:bg-[#253742] rounded-full border border-[#E8DDD4] dark:border-white/10 overflow-x-auto">
          <button
            @click="statusFilter = 'all'; handleFilterChange()"
            :class="[
              'px-4 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap',
              statusFilter === 'all' ? 'bg-white dark:bg-[#15232D] text-[#1A1210] dark:text-white shadow-2xs border border-[#E0D3C7] dark:border-white/10' : 'text-[#6E5D53] hover:text-[#1A1210]'
            ]"
          >All</button>
          <button
            @click="statusFilter = 'paid'; handleFilterChange()"
            :class="[
              'px-4 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap',
              statusFilter === 'paid' ? 'bg-white dark:bg-[#15232D] text-[#1A1210] dark:text-white shadow-2xs border border-[#E0D3C7] dark:border-white/10' : 'text-[#6E5D53] hover:text-[#1A1210]'
            ]"
          >Paid / Settled</button>
          <button
            @click="statusFilter = 'pending'; handleFilterChange()"
            :class="[
              'px-4 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap',
              statusFilter === 'pending' ? 'bg-white dark:bg-[#15232D] text-[#1A1210] dark:text-white shadow-2xs border border-[#E0D3C7] dark:border-white/10' : 'text-[#6E5D53] hover:text-[#1A1210]'
            ]"
          >Pending Escrow</button>
        </div>

        <!-- Search & Gateway Filter -->
        <div class="flex items-center gap-3">
          <select
            v-model="methodFilter"
            @change="handleFilterChange()"
            class="rounded-full bg-[#F5EDE6] dark:bg-[#253742] border border-[#EBE0D7] dark:border-white/10 px-4 py-2 text-xs text-[#1A1210] dark:text-white font-bold outline-none focus:border-[#8A5B43]"
          >
            <option value="">All Gateway Channels</option>
            <option value="telebirr_sim">Telebirr</option>
            <option value="cbe_birr_sim">CBE Birr</option>
            <option value="chapa_sim">Chapa</option>
          </select>

          <div class="relative w-64">
            <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A6948B] pointer-events-none">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            <input
              v-model="searchFilter"
              type="text"
              placeholder="Search reference, user..."
              class="w-full rounded-full bg-[#F5EDE6] dark:bg-[#253742] border border-[#EBE0D7] dark:border-white/10 pl-9 pr-4 py-2 text-xs text-ink dark:text-white placeholder-[#A6948B] outline-none focus:border-[#8A5B43] transition"
            />
          </div>
        </div>
      </div>

      <!-- Ledger Table -->
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse min-w-[840px]">
          <thead>
            <tr class="bg-[#F3EBE4] dark:bg-[#253742] text-[#5A483E] dark:text-[#E0D3C7] text-xs font-bold rounded-xl">
              <th class="py-3 px-4 w-14 rounded-l-xl">ID</th>
              <th class="py-3 px-4">Reference</th>
              <th class="py-3 px-4">Customer</th>
              <th class="py-3 px-4">Provider</th>
              <th class="py-3 px-4 text-right">Gross (ETB)</th>
              <th class="py-3 px-4 text-right">Fee (10%)</th>
              <th class="py-3 px-4 text-right">Net Payout</th>
              <th class="py-3 px-4 text-center">Channel</th>
              <th class="py-3 px-4">Status</th>
              <th class="py-3 px-4 rounded-r-xl">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#F0E6DE] dark:divide-white/10 text-sm">
            <tr
              v-for="tx in filteredTransactions"
              :key="tx.id"
              class="hover:bg-[#FAF6F2] dark:hover:bg-white/[0.02] transition-colors"
            >
              <td class="py-4 px-4 text-xs font-bold text-[#8A5B43]">#{{ tx.id }}</td>
              <td class="py-4 px-4 text-xs font-mono text-[#1A1210] dark:text-[#F0EDE6] font-bold">{{ tx.transaction_reference || `TXN-${tx.id}` }}</td>
              <td class="py-4 px-4">
                <p class="font-bold text-[#1A1210] dark:text-white text-xs">{{ tx.customer?.name || 'Customer' }}</p>
                <p class="text-[11px] text-[#8A7A71]">{{ tx.customer?.email }}</p>
              </td>
              <td class="py-4 px-4">
                <p class="font-bold text-[#1A1210] dark:text-white text-xs">{{ tx.provider?.name || 'Provider' }}</p>
                <p class="text-[11px] text-[#8A7A71]">{{ tx.provider?.email }}</p>
              </td>
              <td class="py-4 px-4 text-right font-bold text-[#1A1210] dark:text-white text-xs">{{ formatMoney(tx.amount) }}</td>
              <td class="py-4 px-4 text-right font-bold text-emerald-700 dark:text-emerald-400 text-xs">{{ formatMoney(tx.commission) }}</td>
              <td class="py-4 px-4 text-right font-bold text-[#8A5B43] dark:text-[#D4A98A] text-xs">{{ formatMoney(tx.provider_amount) }}</td>
              <td class="py-4 px-4 text-center">
                <span :class="['inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border', getMethodBadgeClass(tx.payment_method)]">
                  {{ getMethodLabel(tx.payment_method) }}
                </span>
              </td>
              <td class="py-4 px-4">
                <span
                  :class="[
                    'inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider',
                    tx.payment_status === 'paid'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : tx.payment_status === 'pending'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-red-100 text-red-800 border border-red-200'
                  ]"
                >
                  {{ tx.payment_status }}
                </span>
              </td>
              <td class="py-4 px-4">
                <button
                  @click="openReceiptModal(tx)"
                  class="px-3 py-1 rounded-lg text-xs font-bold bg-[#FAF0E6] dark:bg-[#253742] text-[#8A5B43] dark:text-[#D4A98A] hover:bg-[#F5EDE6] transition border border-[#EADFD7] dark:border-white/10"
                >
                  Receipt
                </button>
              </td>
            </tr>
            <tr v-if="filteredTransactions.length === 0">
              <td colspan="10" class="py-16 text-center">
                <div class="w-12 h-12 rounded-2xl bg-[#FAF0E6] text-[#8A5B43] flex items-center justify-center mx-auto mb-3 text-xl">💳</div>
                <h3 class="font-display font-bold text-base text-[#1A1210] dark:text-white">No Financial Transactions Found</h3>
                <p class="text-xs text-[#7D6E66] dark:text-white/60 mt-1 max-w-sm mx-auto">
                  When users process payments via Telebirr, CBE Birr, or Chapa, real-time records will populate this audit ledger.
                </p>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Table Footer / Pagination -->
        <div class="pt-6 flex items-center justify-between text-xs text-[#7D6E66] dark:text-white/60 border-t border-[#F0E6DE] dark:border-white/10">
          <div>Total Records: <strong class="text-[#1A1210] dark:text-white">{{ pagination.total }}</strong></div>
          <div v-if="pagination.last_page > 1" class="flex items-center gap-1.5">
            <button
              :disabled="pagination.current_page <= 1"
              @click="loadTransactions(pagination.current_page - 1)"
              class="px-2.5 py-1 rounded-lg border border-[#EADFD7] text-xs font-semibold disabled:opacity-40"
            >
              &larr; Prev
            </button>
            <span class="px-3 py-1 font-bold text-[#1A1210] dark:text-white">
              Page {{ pagination.current_page }} of {{ pagination.last_page }}
            </span>
            <button
              :disabled="pagination.current_page >= pagination.last_page"
              @click="loadTransactions(pagination.current_page + 1)"
              class="px-2.5 py-1 rounded-lg border border-[#EADFD7] text-xs font-semibold disabled:opacity-40"
            >
              Next &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── TAB 3: ESCROW & SETTLEMENTS ── -->
    <div v-if="activeTab === 'escrow'" class="space-y-6">
      <div class="p-6 rounded-3xl bg-white dark:bg-[#1E2D37] border border-[#EADFD7] dark:border-white/10 shadow-xs">
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 flex items-center justify-center text-lg shrink-0">🔒</div>
          <div>
            <h3 class="font-display font-bold text-base text-[#1A1210] dark:text-white">SkillLink Escrow Vault Safeguard</h3>
            <p class="text-xs text-[#7D6E66] dark:text-white/60 mt-1 max-w-2xl">
              Customer funds are securely captured at booking and held in platform escrow. Funds are automatically split (90% to provider wallet, 10% to platform revenue) upon customer job sign-off or dispute resolution.
            </p>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-[#1E2D37] rounded-3xl border border-[#EADFD7] dark:border-white/10 shadow-xs p-6">
        <h3 class="font-display font-bold text-base text-[#1A1210] dark:text-white mb-4">Pending Escrow Settlements</h3>

        <div v-if="pendingEscrowTransactions.length" class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="bg-[#F3EBE4] dark:bg-[#253742] text-[#5A483E] dark:text-[#E0D3C7]">
                <th class="py-3 px-4">Booking ID</th>
                <th class="py-3 px-4">Reference</th>
                <th class="py-3 px-4">Customer</th>
                <th class="py-3 px-4">Provider</th>
                <th class="py-3 px-4 text-right">Locked Amount</th>
                <th class="py-3 px-4">Status</th>
                <th class="py-3 px-4">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#F0E6DE] dark:divide-white/10">
              <tr v-for="t in pendingEscrowTransactions" :key="t.id">
                <td class="py-3 px-4 font-bold text-[#8A5B43]">#{{ t.booking_id }}</td>
                <td class="py-3 px-4 font-mono">{{ t.transaction_reference }}</td>
                <td class="py-3 px-4 font-semibold">{{ t.customer?.name }}</td>
                <td class="py-3 px-4 font-semibold">{{ t.provider?.name }}</td>
                <td class="py-3 px-4 text-right font-bold text-amber-700 dark:text-amber-400">{{ formatMoney(t.amount) }} ETB</td>
                <td class="py-3 px-4"><span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">In Escrow</span></td>
                <td class="py-3 px-4"><button @click="openReceiptModal(t)" class="text-xs font-bold text-[#8A5B43] underline">Inspect</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="py-12 text-center">
          <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 flex items-center justify-center mx-auto mb-2 font-bold text-lg">✓</div>
          <h4 class="font-display font-bold text-sm text-[#1A1210] dark:text-white">Escrow All Clear</h4>
          <p class="text-xs text-[#7D6E66] dark:text-white/60 mt-0.5">No funds currently locked in pending escrow settlement.</p>
        </div>
      </div>

      <!-- Payout Readiness -->
      <div class="bg-white dark:bg-[#1E2D37] rounded-3xl border border-[#EADFD7] dark:border-white/10 shadow-xs p-6">
        <div class="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <h3 class="font-display font-bold text-base text-[#1A1210] dark:text-white">Provider Payout Readiness</h3>
            <p class="text-xs text-[#7D6E66] dark:text-white/60 mt-1">Providers holding a wallet balance, and whether they have a payout destination on file.</p>
          </div>
          <div class="flex items-center gap-2 text-[11px] font-bold">
            <span class="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{{ payoutReadiness.summary?.ready ?? 0 }} ready</span>
            <span class="px-2.5 py-1 rounded-full bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">{{ payoutReadiness.summary?.not_ready ?? 0 }} missing method</span>
            <span class="px-2.5 py-1 rounded-full bg-[#FAF0E6] dark:bg-white/10 text-[#8A5B43] dark:text-[#D4A98A]">{{ formatMoney(payoutReadiness.summary?.total_in_wallets) }} ETB in wallets</span>
          </div>
        </div>

        <div v-if="payoutLoading" class="py-8 text-center text-xs text-[#7D6E66]">Loading payout readiness…</div>
        <div v-else-if="!payoutReadiness.data?.length" class="py-10 text-center text-xs text-[#7D6E66] dark:text-white/60">No provider wallets hold a balance right now.</div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="bg-[#F3EBE4] dark:bg-[#253742] text-[#5A483E] dark:text-[#E0D3C7]">
                <th class="py-3 px-4">Provider</th>
                <th class="py-3 px-4 text-right">Wallet Balance</th>
                <th class="py-3 px-4">Payout Method</th>
                <th class="py-3 px-4">Readiness</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#F0E6DE] dark:divide-white/10">
              <tr v-for="p in payoutReadiness.data" :key="p.provider_id">
                <td class="py-3 px-4">
                  <p class="font-bold text-[#1A1210] dark:text-white">{{ p.name }}</p>
                  <p class="text-[11px] text-[#8A7A71]">{{ p.professional_title || p.email }}</p>
                </td>
                <td class="py-3 px-4 text-right font-bold text-[#1A1210] dark:text-white">{{ formatMoney(p.wallet_balance) }} ETB</td>
                <td class="py-3 px-4">
                  <span v-if="p.payout_method" class="text-[#1A1210] dark:text-white">
                    {{ p.payout_method.bank_name || p.payout_method.method_type }} · {{ p.payout_method.account_number_masked }}
                  </span>
                  <span v-else class="text-red-500 font-semibold">Not configured</span>
                </td>
                <td class="py-3 px-4">
                  <span
                    :class="['px-2.5 py-1 rounded-full text-[10px] font-bold uppercase', p.has_payout_method ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800']"
                  >
                    {{ p.has_payout_method ? 'Ready' : 'Blocked' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ── TAB 4: PAYMENT GATEWAYS ── -->
    <div v-if="activeTab === 'gateways'" class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Telebirr -->
        <div class="p-6 rounded-3xl bg-white dark:bg-[#1E2D37] border border-[#EADFD7] dark:border-white/10 shadow-xs flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-4">
              <span class="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-extrabold">Telebirr Mobile</span>
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            </div>
            <h3 class="font-display font-bold text-lg text-[#1A1210] dark:text-white">Ethio Telecom Telebirr</h3>
            <p class="text-xs text-[#7D6E66] dark:text-white/60 mt-1">Direct API integration for mobile wallet payments across Ethiopia.</p>
          </div>
          <div class="mt-6 pt-4 border-t border-[#F0E6DE] dark:border-white/10 text-xs text-[#7D6E66]">
            <p>Processing Fee: <strong class="text-[#1A1210] dark:text-white">0% (Integrated)</strong></p>
          </div>
        </div>

        <!-- CBE Birr -->
        <div class="p-6 rounded-3xl bg-white dark:bg-[#1E2D37] border border-[#EADFD7] dark:border-white/10 shadow-xs flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-4">
              <span class="px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-extrabold">CBE Birr</span>
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            </div>
            <h3 class="font-display font-bold text-lg text-[#1A1210] dark:text-white">Commercial Bank of Ethiopia</h3>
            <p class="text-xs text-[#7D6E66] dark:text-white/60 mt-1">CBE Birr core banking settlement & escrow hold connector.</p>
          </div>
          <div class="mt-6 pt-4 border-t border-[#F0E6DE] dark:border-white/10 text-xs text-[#7D6E66]">
            <p>Processing Fee: <strong class="text-[#1A1210] dark:text-white">0% (Bank Partner)</strong></p>
          </div>
        </div>

        <!-- Chapa -->
        <div class="p-6 rounded-3xl bg-white dark:bg-[#1E2D37] border border-[#EADFD7] dark:border-white/10 shadow-xs flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-4">
              <span class="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold">Chapa Gateway</span>
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            </div>
            <h3 class="font-display font-bold text-lg text-[#1A1210] dark:text-white">Chapa Ethiopia</h3>
            <p class="text-xs text-[#7D6E66] dark:text-white/60 mt-1">Card processing and local multi-bank gateway aggregation.</p>
          </div>
          <div class="mt-6 pt-4 border-t border-[#F0E6DE] dark:border-white/10 text-xs text-[#7D6E66]">
            <p>Status: <strong class="text-emerald-600 dark:text-emerald-400 font-bold">Active Gateway</strong></p>
          </div>
        </div>
      </div>
    </div>

    <!-- ── TRANSACTION RECEIPT & AUDIT MODAL ── -->
    <div v-if="receiptModalOpen && selectedTx" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" @click="receiptModalOpen = false">
      <div class="bg-white dark:bg-[#1E2D37] rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-[#EADFD7] dark:border-white/10 space-y-5 animate-in zoom-in-95 duration-150" @click.stop>
        <div class="flex items-center justify-between border-b border-[#F0E6DE] dark:border-white/10 pb-4">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-[#FAF0E6] text-[#8A5B43] dark:bg-white/10 dark:text-white flex items-center justify-center font-bold text-sm">🧾</div>
            <div>
              <h3 class="font-display font-bold text-base text-[#1A1210] dark:text-white">Escrow Receipt & Audit</h3>
              <p class="text-[11px] text-[#7D6E66] dark:text-white/50">Transaction #{{ selectedTx.id }}</p>
            </div>
          </div>
          <button @click="receiptModalOpen = false" class="text-ink/60 hover:text-ink dark:text-white/60 dark:hover:text-white text-xl font-bold">&times;</button>
        </div>

        <!-- Receipt Content -->
        <div class="space-y-4 text-xs">
          <!-- Ref & Date -->
          <div class="p-3.5 rounded-2xl bg-[#FAF7F4] dark:bg-[#253742] border border-[#EADFD7] dark:border-white/10 flex items-center justify-between">
            <div>
              <span class="text-[10px] text-[#7D6E66] dark:text-white/50 font-bold uppercase block">Reference</span>
              <span class="font-mono font-extrabold text-[#1A1210] dark:text-white text-xs">{{ selectedTx.transaction_reference || `TXN-${selectedTx.id}` }}</span>
            </div>
            <div class="text-right">
              <span class="text-[10px] text-[#7D6E66] dark:text-white/50 font-bold uppercase block">Settled At</span>
              <span class="font-semibold text-[#1A1210] dark:text-white">{{ formatFullDate(selectedTx.paid_at || selectedTx.created_at) }}</span>
            </div>
          </div>

          <!-- Customer & Provider -->
          <div class="grid grid-cols-2 gap-3">
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10">
              <span class="text-[10px] font-bold text-[#7D6E66] uppercase block">Customer</span>
              <p class="font-bold text-[#1A1210] dark:text-white mt-0.5">{{ selectedTx.customer?.name || 'Customer' }}</p>
              <p class="text-[11px] text-[#8A7A71] truncate">{{ selectedTx.customer?.email }}</p>
            </div>
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10">
              <span class="text-[10px] font-bold text-[#7D6E66] uppercase block">Provider</span>
              <p class="font-bold text-[#1A1210] dark:text-white mt-0.5">{{ selectedTx.provider?.name || 'Provider' }}</p>
              <p class="text-[11px] text-[#8A7A71] truncate">{{ selectedTx.provider?.email }}</p>
            </div>
          </div>

          <!-- Financial Breakdown Card -->
          <div class="p-4 rounded-2xl bg-[#FAF0E6] dark:bg-[#253742] border border-[#EADFD7] dark:border-white/10 space-y-2">
            <span class="text-[10px] font-extrabold uppercase tracking-wider text-[#8A5B43] dark:text-[#D4A98A] block">Settlement Breakdown</span>
            <div class="flex justify-between items-center text-xs">
              <span class="text-[#7D6E66] dark:text-white/70">Gross Amount Paid:</span>
              <span class="font-bold text-[#1A1210] dark:text-white">{{ formatMoney(selectedTx.amount) }} ETB</span>
            </div>
            <div class="flex justify-between items-center text-xs">
              <span class="text-[#7D6E66] dark:text-white/70">Platform Fee (10% Commission):</span>
              <span class="font-bold text-emerald-700 dark:text-emerald-400">+{{ formatMoney(selectedTx.commission) }} ETB</span>
            </div>
            <div class="pt-2 border-t border-[#EADFD7] dark:border-white/10 flex justify-between items-center text-xs">
              <span class="font-bold text-[#1A1210] dark:text-white">Net Disbursement to Provider:</span>
              <span class="font-extrabold text-[#8A5B43] dark:text-[#D4A98A] text-sm">{{ formatMoney(selectedTx.provider_amount) }} ETB</span>
            </div>
          </div>

          <!-- Gateway & Status -->
          <div class="flex items-center justify-between text-xs pt-1">
            <span class="text-[#7D6E66]">Payment Gateway:</span>
            <span :class="['px-2.5 py-0.5 rounded-full text-[10px] font-bold border', getMethodBadgeClass(selectedTx.payment_method)]">
              {{ getMethodLabel(selectedTx.payment_method) }}
            </span>
          </div>
        </div>

        <!-- Modal Actions -->
        <div class="flex items-center justify-end gap-3 pt-3 border-t border-[#F0E6DE] dark:border-white/10">
          <button @click="printReceipt()" class="px-4 py-2 rounded-xl text-xs font-bold bg-[#FAF0E6] text-[#8A5B43] hover:bg-[#F5EDE6] transition border border-[#EADFD7]">
            Print Receipt
          </button>
          <button @click="receiptModalOpen = false" class="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition">
            Close Audit
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
