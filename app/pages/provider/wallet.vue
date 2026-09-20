<script setup lang="ts">
definePageMeta({ layout: 'default', middleware: ['auth', 'provider-only'] })

const { apiFetch } = useApi()
const goBack = useGoBack('/dashboard')

const loading = ref(true)
const bookings = ref<any[]>([])
const payouts = ref<any[]>([])
const showWithdrawModal = ref(false)
const withdrawMethodId = ref<number | null>(null)
const withdrawAmount = ref<number | ''>('')
const withdrawSuccess = ref(false)
const withdrawLoading = ref(false)

const PLATFORM_FEE_RATE = 0.10 // 10% Platform fee

// ── Payout methods ──────────────────────────────────────────────────────────
const payoutMethods = ref<any[]>([])
const methodBusy = ref<number | 'new' | null>(null)
const showMethodModal = ref(false)
const methodForm = reactive({ preset: 'telebirr', account_name: '', account_number: '', is_default: false })

const METHOD_PRESETS: Record<string, { label: string; method_type: string; bank_name: string; hint: string }> = {
  telebirr:   { label: 'Telebirr',       method_type: 'mobile_money',  bank_name: 'Telebirr',                       hint: 'Telebirr phone number' },
  cbe_birr:   { label: 'CBE Birr',       method_type: 'mobile_money',  bank_name: 'CBE Birr',                       hint: 'CBE Birr phone number' },
  cbe_bank:   { label: 'CBE (Bank)',     method_type: 'bank_transfer', bank_name: 'Commercial Bank of Ethiopia',    hint: 'CBE account number' },
  awash_bank: { label: 'Awash Bank',     method_type: 'bank_transfer', bank_name: 'Awash Bank',                     hint: 'Awash account number' },
  boa_bank:   { label: 'Bank of Abyssinia', method_type: 'bank_transfer', bank_name: 'Bank of Abyssinia',           hint: 'BoA account number' },
}
const presetLabel = (m: any) => m.bank_name || (m.method_type === 'mobile_money' ? 'Mobile money' : 'Bank transfer')
const defaultMethod = computed(() => payoutMethods.value.find(m => m.is_default) || payoutMethods.value[0] || null)

async function loadPayoutMethods() {
  try {
    const res = await apiFetch<any>('/provider/payout-methods')
    payoutMethods.value = res.data ?? []
    withdrawMethodId.value = defaultMethod.value?.id ?? null
  } catch {
    payoutMethods.value = []
  }
}

function openMethodModal() {
  methodForm.preset = 'telebirr'
  methodForm.account_name = ''
  methodForm.account_number = ''
  methodForm.is_default = payoutMethods.value.length === 0
  showMethodModal.value = true
}

async function saveMethod() {
  if (!methodForm.account_name.trim() || !methodForm.account_number.trim()) return
  methodBusy.value = 'new'
  const preset = METHOD_PRESETS[methodForm.preset]
  try {
    await apiFetch('/provider/payout-methods', {
      method: 'POST',
      body: {
        method_type: preset.method_type,
        bank_name: preset.bank_name,
        account_name: methodForm.account_name.trim(),
        account_number: methodForm.account_number.trim(),
        is_default: methodForm.is_default,
      },
    })
    showMethodModal.value = false
    await loadPayoutMethods()
  } finally {
    methodBusy.value = null
  }
}

async function makeDefaultMethod(id: number) {
  methodBusy.value = id
  try {
    await apiFetch(`/provider/payout-methods/${id}/default`, { method: 'POST' })
    await loadPayoutMethods()
  } finally {
    methodBusy.value = null
  }
}

async function removeMethod(id: number) {
  methodBusy.value = id
  try {
    await apiFetch(`/provider/payout-methods/${id}`, { method: 'DELETE' })
    await loadPayoutMethods()
  } finally {
    methodBusy.value = null
  }
}

async function loadData() {
  loading.value = true
  try {
    const res = await apiFetch<any>('/my-bookings/provider')
    bookings.value = res.data ?? []
  } catch {
    bookings.value = []
  } finally {
    loading.value = false
  }
}

// ── Wallet (real server balance) ────────────────────────────────────────────
const wallet = ref<any>({ balance: 0, lifetime_credited: 0, lifetime_withdrawn: 0, pending_escrow: 0, min_withdrawal: 50, transactions: [] })
const withdrawError = ref('')

async function loadWallet() {
  try {
    const [w, p] = await Promise.all([
      apiFetch<any>('/provider/wallet'),
      apiFetch<any>('/provider/payouts'),
    ])
    wallet.value = w.data ?? wallet.value
    payouts.value = (p.data ?? []).map((x: any) => ({
      id: x.reference,
      amount: Number(x.amount),
      method: x.destination || (x.payout_method?.bank_name ?? 'Payout'),
      account: '',
      date: x.processed_at || x.created_at,
      status: x.status,
    }))
  } catch { /* ignore */ }
}

onMounted(() => { loadData(); loadPayoutMethods(); loadWallet() })

// Computed stats
const completedBookings = computed(() => bookings.value.filter(b => b.status === 'completed'))
const totalGrossEarned = computed(() => completedBookings.value.reduce((sum, b) => sum + Number(b.amount ?? b.total_amount ?? 0), 0))
const platformFeeDeducted = computed(() => totalGrossEarned.value * PLATFORM_FEE_RATE)
const netEarnings = computed(() => Number(wallet.value.lifetime_credited || 0))
const availableBalance = computed(() => Number(wallet.value.balance || 0))
const pendingEscrow = computed(() => Number(wallet.value.pending_escrow || 0))

function openWithdrawModal() {
  withdrawAmount.value = availableBalance.value > 0 ? Math.floor(availableBalance.value) : ''
  withdrawMethodId.value = defaultMethod.value?.id ?? null
  withdrawSuccess.value = false
  withdrawError.value = ''
  showWithdrawModal.value = true
}

const selectedWithdrawMethod = computed(() =>
  payoutMethods.value.find(m => m.id === withdrawMethodId.value) || null
)

async function handleWithdraw() {
  if (!selectedWithdrawMethod.value) return
  const amt = Number(withdrawAmount.value)
  if (!amt || amt < (wallet.value.min_withdrawal || 50) || amt > availableBalance.value) return

  withdrawLoading.value = true
  withdrawError.value = ''
  try {
    await apiFetch('/provider/payouts', {
      method: 'POST',
      body: { amount: amt, payout_method_id: withdrawMethodId.value },
    })
    await loadWallet()
    withdrawSuccess.value = true
    setTimeout(() => { showWithdrawModal.value = false }, 1800)
  } catch (e: any) {
    withdrawError.value = e?.data?.message || 'Withdrawal failed. Try again.'
  } finally {
    withdrawLoading.value = false
  }
}

function formatDate(iso: string) {
  if (!iso) return ''
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(iso))
}
</script>

<template>
  <section class="provider-wallet max-w-[1230px] mx-auto px-4 sm:px-6 py-10 sm:py-14">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8 flex-wrap gap-4">
      <div>
        <button @click="goBack" class="text-xs font-medium text-clay hover:underline flex items-center gap-1 mb-2">
          ← Back to dashboard
        </button>
        <h1 class="font-display text-3xl sm:text-4xl font-semibold text-ink dark:text-[#F0EDE6]">
          Provider Wallet & Earnings
        </h1>
        <p class="text-sm text-ink/65 dark:text-white/65 mt-1">
          Track your income, transparent 10% platform fees, and withdraw your funds.
        </p>
      </div>

      <button
        @click="openWithdrawModal"
        :disabled="availableBalance <= 0"
        class="bg-clay hover:bg-clay/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-full transition shadow-md flex items-center gap-2"
      >
        <span>💸</span> Withdraw Balance
      </button>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
      
      <!-- Available Balance -->
      <div class="p-6 rounded-2xl border border-mist dark:border-white/10 bg-white dark:bg-mist-dark shadow-xs flex flex-col justify-between">
        <div class="flex items-center justify-between mb-4">
          <span class="text-xs font-semibold uppercase tracking-wider text-ink/50 dark:text-white/50">Available Balance</span>
          <span class="w-8 h-8 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center text-sm">💰</span>
        </div>
        <p class="font-display text-3xl font-bold text-ink dark:text-[#F0EDE6]">
          ETB {{ availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
        </p>
        <p class="text-xs text-green-700 dark:text-green-400 mt-2 flex items-center gap-1">
          <span>✓</span> Ready for payout
        </p>
      </div>

      <!-- Net Earnings (90%) -->
      <div class="p-6 rounded-2xl border border-mist dark:border-white/10 bg-white dark:bg-mist-dark shadow-xs flex flex-col justify-between">
        <div class="flex items-center justify-between mb-4">
          <span class="text-xs font-semibold uppercase tracking-wider text-ink/50 dark:text-white/50">Net Earned (90%)</span>
          <span class="w-8 h-8 rounded-full bg-clay/10 text-clay flex items-center justify-center text-sm">📈</span>
        </div>
        <p class="font-display text-3xl font-bold text-clay">
          ETB {{ netEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
        </p>
        <p class="text-xs text-ink/50 dark:text-white/50 mt-2">
          From {{ completedBookings.length }} completed job{{ completedBookings.length === 1 ? '' : 's' }}
        </p>
      </div>

      <!-- Platform Fee (10%) -->
      <div class="p-6 rounded-2xl border border-mist dark:border-white/10 bg-white dark:bg-mist-dark shadow-xs flex flex-col justify-between">
        <div class="flex items-center justify-between mb-4">
          <span class="text-xs font-semibold uppercase tracking-wider text-ink/50 dark:text-white/50">Platform Fee (10%)</span>
          <span class="w-8 h-8 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center text-sm">⚡</span>
        </div>
        <p class="font-display text-3xl font-bold text-ink/80 dark:text-white/80">
          ETB {{ platformFeeDeducted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
        </p>
        <p class="text-xs text-ink/50 dark:text-white/50 mt-2">
          Platform maintenance & payment guarantee
        </p>
      </div>

      <!-- In Escrow / Active -->
      <div class="p-6 rounded-2xl border border-mist dark:border-white/10 bg-white dark:bg-mist-dark shadow-xs flex flex-col justify-between">
        <div class="flex items-center justify-between mb-4">
          <span class="text-xs font-semibold uppercase tracking-wider text-ink/50 dark:text-white/50">In Escrow (Active)</span>
          <span class="w-8 h-8 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center text-sm">🔒</span>
        </div>
        <p class="font-display text-3xl font-bold text-ink dark:text-[#F0EDE6]">
          ETB {{ pendingEscrow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
        </p>
        <p class="text-xs text-ink/50 dark:text-white/50 mt-2">
          Released upon customer confirmation
        </p>
      </div>

    </div>

    <!-- Fee Policy Notice -->
    <div class="bg-clay/5 border border-clay/20 rounded-2xl p-5 mb-10 flex items-start gap-4">
      <div class="w-10 h-10 rounded-xl bg-clay/10 text-clay flex items-center justify-center font-display text-lg shrink-0">
        🛡️
      </div>
      <div>
        <h3 class="font-display font-semibold text-base text-ink dark:text-[#F0EDE6] mb-1">
          SkillLink 10% Platform Fee Policy
        </h3>
        <p class="text-xs sm:text-sm text-ink/70 dark:text-white/70 leading-relaxed">
          For every completed booking, SkillLink retains a transparent <strong>10% service commission</strong> to cover secure escrow protection, continuous platform enhancements, 24/7 Ethiopian support, and marketing to bring you more clients. You keep <strong>90% of every transaction</strong>.
        </p>
      </div>
    </div>

    <!-- Payout Methods -->
    <div class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl shadow-xs p-6 mb-10">
      <div class="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h2 class="font-display text-xl font-semibold text-ink dark:text-[#F0EDE6]">Payout Methods</h2>
          <p class="text-xs text-ink/50 dark:text-white/50 mt-0.5">Where SkillLink sends your withdrawals. Your default is used automatically.</p>
        </div>
        <button
          @click="openMethodModal"
          class="text-xs font-bold text-clay border border-clay/40 hover:bg-clay/5 px-4 py-2 rounded-full transition"
        >
          + Add payout method
        </button>
      </div>

      <div v-if="!payoutMethods.length" class="border border-dashed border-mist dark:border-white/15 rounded-xl px-5 py-8 text-center">
        <p class="text-3xl mb-2">🏦</p>
        <p class="font-semibold text-sm text-ink dark:text-white mb-1">No payout method yet</p>
        <p class="text-xs text-ink/50 dark:text-white/50">Add a Telebirr, CBE, or bank account so you can withdraw your earnings.</p>
      </div>

      <ul v-else class="divide-y divide-mist dark:divide-white/10">
        <li v-for="m in payoutMethods" :key="m.id" class="py-3.5 flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-3 min-w-0">
            <span class="w-9 h-9 rounded-xl bg-mist/60 dark:bg-white/5 flex items-center justify-center text-sm shrink-0">
              {{ m.method_type === 'mobile_money' ? '📱' : '🏦' }}
            </span>
            <div class="min-w-0">
              <p class="font-semibold text-sm text-ink dark:text-white truncate">
                {{ presetLabel(m) }}
                <span v-if="m.is_default" class="ml-2 text-[10px] font-bold uppercase tracking-wider bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">Default</span>
              </p>
              <p class="text-xs text-ink/50 dark:text-white/50 truncate">{{ m.account_name }} · {{ m.account_number_masked }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button
              v-if="!m.is_default"
              @click="makeDefaultMethod(m.id)"
              :disabled="methodBusy === m.id"
              class="text-xs font-semibold text-clay hover:underline disabled:opacity-50"
            >
              Set default
            </button>
            <button
              @click="removeMethod(m.id)"
              :disabled="methodBusy === m.id"
              class="text-xs font-semibold text-red-500 hover:underline disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </li>
      </ul>
    </div>

    <!-- Transactions Ledger Table -->
    <div class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
      <div class="p-6 border-b border-mist dark:border-white/10 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 class="font-display text-xl font-semibold text-ink dark:text-[#F0EDE6]">Earnings Breakdown & Ledger</h2>
          <p class="text-xs text-ink/50 dark:text-white/50 mt-0.5">Itemized calculations for each customer order</p>
        </div>
        <span class="text-xs font-semibold bg-mist/60 dark:bg-white/10 text-ink/70 dark:text-white/70 px-3 py-1.5 rounded-full">
          {{ completedBookings.length }} Completed Order{{ completedBookings.length === 1 ? '' : 's' }}
        </span>
      </div>

      <div v-if="loading" class="p-12 text-center text-sm text-ink/50 dark:text-white/50">
        Loading earnings data…
      </div>

      <div v-else-if="!completedBookings.length" class="p-12 text-center text-sm text-ink/50 dark:text-white/50">
        <p class="text-3xl mb-2">📜</p>
        <p class="font-semibold text-ink dark:text-white mb-1">No completed transactions yet</p>
        <p class="text-xs text-ink/50 dark:text-white/50">Once you complete jobs and customers confirm, your earnings will appear here.</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-mist/40 dark:bg-white/5 text-xs text-ink/60 dark:text-white/60 uppercase tracking-wider border-b border-mist dark:border-white/10">
            <tr>
              <th class="py-3.5 px-5">Booking / Service</th>
              <th class="py-3.5 px-5">Customer</th>
              <th class="py-3.5 px-5">Date</th>
              <th class="py-3.5 px-5 text-right">Gross Total</th>
              <th class="py-3.5 px-5 text-right text-amber-600 dark:text-amber-400">Platform Fee (-10%)</th>
              <th class="py-3.5 px-5 text-right font-bold text-clay">Net Payout (90%)</th>
              <th class="py-3.5 px-5 text-center">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-mist dark:divide-white/10">
            <tr v-for="b in completedBookings" :key="b.id" class="hover:bg-mist/20 dark:hover:bg-white/5 transition">
              <td class="py-4 px-5">
                <NuxtLink :to="`/bookings/${b.id}`" class="font-semibold text-ink dark:text-[#F0EDE6] hover:text-clay transition block">
                  {{ b.job?.title || b.service?.title || `Booking #${b.id}` }}
                </NuxtLink>
                <span class="text-[11px] text-ink/45 dark:text-white/45">#{{ b.id }}</span>
              </td>
              <td class="py-4 px-5 text-ink/80 dark:text-white/80">
                {{ b.customer?.first_name }} {{ b.customer?.last_name }}
              </td>
              <td class="py-4 px-5 text-xs text-ink/60 dark:text-white/60">
                {{ formatDate(b.created_at) }}
              </td>
              <td class="py-4 px-5 text-right font-medium text-ink dark:text-white">
                ETB {{ Number(b.amount ?? b.total_amount ?? 0).toLocaleString() }}
              </td>
              <td class="py-4 px-5 text-right text-amber-600 dark:text-amber-400 font-medium">
                -ETB {{ (Number(b.amount ?? b.total_amount ?? 0) * PLATFORM_FEE_RATE).toLocaleString() }}
              </td>
              <td class="py-4 px-5 text-right font-display font-bold text-clay">
                ETB {{ (Number(b.amount ?? b.total_amount ?? 0) * (1 - PLATFORM_FEE_RATE)).toLocaleString() }}
              </td>
              <td class="py-4 px-5 text-center">
                <span class="inline-flex items-center gap-1 text-[11px] font-semibold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-full">
                  ✓ Paid
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Payout / Withdrawal History (Simulated) -->
    <div v-if="payouts.length" class="mt-10 bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 shadow-xs">
      <h3 class="font-display text-lg font-semibold text-ink dark:text-[#F0EDE6] mb-4">Recent Withdrawals</h3>
      <div class="divide-y divide-mist dark:divide-white/10">
        <div v-for="p in payouts" :key="p.id" class="py-3 flex items-center justify-between text-sm">
          <div class="flex items-center gap-3">
            <span class="w-8 h-8 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center text-xs">💸</span>
            <div>
              <p class="font-medium text-ink dark:text-white">{{ p.method }}</p>
              <p class="text-[11px] text-ink/40 dark:text-white/40">{{ formatDate(p.date) }} · Ref: {{ p.id }} · <span class="capitalize">{{ p.status }}</span></p>
            </div>
          </div>
          <span class="font-display font-bold text-ink dark:text-white">ETB {{ p.amount.toLocaleString() }}</span>
        </div>
      </div>
    </div>

    <!-- Withdrawal Modal -->
    <div
      v-if="showWithdrawModal"
      class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
      @click.self="showWithdrawModal = false"
    >
      <div class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="font-display text-lg font-semibold text-ink dark:text-[#F0EDE6] flex items-center gap-2">
            <span>💸</span> Withdraw Funds
          </h3>
          <button @click="showWithdrawModal = false" class="text-ink/40 dark:text-white/40 hover:text-clay text-lg">✕</button>
        </div>

        <div v-if="withdrawSuccess" class="py-6 text-center space-y-2">
          <p class="text-4xl">🎉</p>
          <p class="font-display font-semibold text-lg text-ink dark:text-[#F0EDE6]">Withdrawal Initiated!</p>
          <p class="text-xs text-ink/60 dark:text-white/60">
            ETB {{ Number(withdrawAmount).toLocaleString() }} is being sent via {{ selectedWithdrawMethod ? presetLabel(selectedWithdrawMethod) : 'your payout method' }}.
          </p>
        </div>

        <div v-else class="space-y-4">
          <p class="text-xs text-ink/60 dark:text-white/60">
            Transfer available earnings directly to your Ethiopian mobile wallet or bank account.
          </p>

          <div v-if="!payoutMethods.length" class="rounded-xl bg-amber-500/10 border border-amber-500/25 p-3.5 text-xs text-amber-700 dark:text-amber-400">
            You need a payout method first.
            <button type="button" @click="showWithdrawModal = false; openMethodModal()" class="font-bold underline">Add one now</button>.
          </div>

          <div v-else>
            <label class="block text-xs font-semibold text-ink dark:text-[#F0EDE6] uppercase mb-1.5">
              Payout Method
            </label>
            <select
              v-model.number="withdrawMethodId"
              class="w-full rounded-xl border border-mist dark:border-white/15 bg-white dark:bg-canvas-dark px-4 py-2.5 text-sm text-ink dark:text-[#F0EDE6] outline-none focus:ring-2 focus:ring-clay/40 transition"
            >
              <option v-for="m in payoutMethods" :key="m.id" :value="m.id">
                {{ presetLabel(m) }} · {{ m.account_number_masked }}{{ m.is_default ? ' (default)' : '' }}
              </option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-ink dark:text-[#F0EDE6] uppercase mb-1.5">
              Withdrawal Amount (ETB)
            </label>
            <div class="relative">
              <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink/40 dark:text-white/40">ETB</span>
              <input
                v-model="withdrawAmount"
                type="number"
                :max="availableBalance"
                min="1"
                class="w-full rounded-xl border border-mist dark:border-white/15 bg-white dark:bg-canvas-dark pl-14 pr-4 py-2.5 text-sm text-ink dark:text-[#F0EDE6] font-semibold outline-none focus:ring-2 focus:ring-clay/40 transition"
              />
            </div>
            <p class="text-[11px] text-ink/50 dark:text-white/50 mt-1">
              Max available: ETB {{ availableBalance.toLocaleString() }} · min ETB {{ wallet.min_withdrawal }}
            </p>
          </div>

          <p v-if="withdrawError" class="text-xs text-red-600 dark:text-red-400">{{ withdrawError }}</p>

          <div class="flex gap-3 pt-2">
            <button
              type="button"
              @click="showWithdrawModal = false"
              class="flex-1 border border-mist dark:border-white/15 text-ink/70 dark:text-white/70 font-semibold py-2.5 rounded-xl hover:border-clay/40 transition text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="handleWithdraw"
              :disabled="withdrawLoading || !selectedWithdrawMethod || !withdrawAmount || Number(withdrawAmount) <= 0 || Number(withdrawAmount) > availableBalance"
              class="flex-1 bg-clay hover:bg-clay/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition text-sm shadow-sm"
            >
              {{ withdrawLoading ? 'Processing…' : 'Confirm Payout' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Payout Method Modal -->
    <div
      v-if="showMethodModal"
      class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
      @click.self="showMethodModal = false"
    >
      <div class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="font-display text-lg font-semibold text-ink dark:text-[#F0EDE6] flex items-center gap-2">
            <span>🏦</span> Add Payout Method
          </h3>
          <button @click="showMethodModal = false" class="text-ink/40 dark:text-white/40 hover:text-clay text-lg">✕</button>
        </div>

        <div>
          <label class="block text-xs font-semibold text-ink dark:text-[#F0EDE6] uppercase mb-1.5">Provider</label>
          <select
            v-model="methodForm.preset"
            class="w-full rounded-xl border border-mist dark:border-white/15 bg-white dark:bg-canvas-dark px-4 py-2.5 text-sm text-ink dark:text-[#F0EDE6] outline-none focus:ring-2 focus:ring-clay/40 transition"
          >
            <option v-for="(preset, key) in METHOD_PRESETS" :key="key" :value="key">{{ preset.label }}</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-semibold text-ink dark:text-[#F0EDE6] uppercase mb-1.5">Account holder name</label>
          <input
            v-model="methodForm.account_name"
            type="text"
            placeholder="Name on the account"
            class="w-full rounded-xl border border-mist dark:border-white/15 bg-white dark:bg-canvas-dark px-4 py-2.5 text-sm text-ink dark:text-[#F0EDE6] outline-none focus:ring-2 focus:ring-clay/40 transition"
          >
        </div>

        <div>
          <label class="block text-xs font-semibold text-ink dark:text-[#F0EDE6] uppercase mb-1.5">
            {{ METHOD_PRESETS[methodForm.preset].hint }}
          </label>
          <input
            v-model="methodForm.account_number"
            type="text"
            placeholder="e.g. 0911234567 or 1000123456789"
            class="w-full rounded-xl border border-mist dark:border-white/15 bg-white dark:bg-canvas-dark px-4 py-2.5 text-sm text-ink dark:text-[#F0EDE6] outline-none focus:ring-2 focus:ring-clay/40 transition"
          >
        </div>

        <label class="flex items-center gap-2 text-xs text-ink/70 dark:text-white/70">
          <input v-model="methodForm.is_default" type="checkbox" class="rounded text-clay focus:ring-clay/40">
          Make this my default payout method
        </label>

        <div class="flex gap-3 pt-1">
          <button
            type="button"
            @click="showMethodModal = false"
            class="flex-1 border border-mist dark:border-white/15 text-ink/70 dark:text-white/70 font-semibold py-2.5 rounded-xl hover:border-clay/40 transition text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="saveMethod"
            :disabled="methodBusy === 'new' || !methodForm.account_name.trim() || !methodForm.account_number.trim()"
            class="flex-1 bg-clay hover:bg-clay/90 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition text-sm shadow-sm"
          >
            {{ methodBusy === 'new' ? 'Saving…' : 'Save Method' }}
          </button>
        </div>
      </div>
    </div>

  </section>
</template>

<style scoped>
.provider-wallet :deep(.rounded-2xl) { border-radius: 16px; }
.provider-wallet :deep(.shadow-xs) { box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); }
.provider-wallet :deep(.bg-white) { box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); }
.provider-wallet :deep(.border-mist) { border-color: #E2E8F0; }
.provider-wallet :deep(.bg-clay\/5) { background: linear-gradient(110deg, #F0FDFA, #F8FAFC); }
.provider-wallet :deep(.border-clay\/20) { border-color: #99F6E4; }
.dark .provider-wallet :deep(.bg-white) { background-color: #172033; }
.dark .provider-wallet :deep(.border-mist) { border-color: rgba(255, 255, 255, 0.1); }
</style>
