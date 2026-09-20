<script setup>
definePageMeta({ layout: 'default', middleware: ['auth'] })

const route = useRoute()
const router = useRouter()
const { apiFetch } = useApi()
const goBack = useGoBack('/dashboard')

const booking = ref(null)
const currentUser = ref(null)
const loading = ref(true)
const notFound = ref(false)
const actionLoading = ref(false)
const actionError = ref('')

const showCancelForm = ref(false)
const cancelReason = ref('')
const showHistory = ref(false)
const showRejectForm = ref(false)
const rejectReason = ref('')

const payMethod = ref('telebirr_sim')
const paying = ref(false)
const payments = ref([])

const reviewForm = ref({ communication_rating: 5, quality_rating: 5, timeliness_rating: 5, professionalism_rating: 5, comment: '' })
const reviewSubmitted = ref(false)
const submittingReview = ref(false)

const bookingId = route.params.id

const lifecycle = ['pending', 'accepted', 'awaiting_confirmation', 'completed']
const statusLabel = {
  pending: 'Pending', accepted: 'Accepted', in_progress: 'In progress',
  awaiting_confirmation: 'Awaiting confirmation', completed: 'Completed',
  cancelled_by_customer: 'Cancelled', cancelled_by_provider: 'Cancelled',
  rejected: 'Rejected', disputed: 'Disputed',
}

// The provider profile id can arrive under a few different keys depending on
// how the /user payload is serialised — check all of them, then fall back to
// matching the authenticated user against the provider relation on the booking.
const providerProfileId = computed(() =>
  currentUser.value?.providerProfile?.id
  ?? currentUser.value?.provider_profile?.id
  ?? currentUser.value?.provider?.id
  ?? null
)

const isCustomer = computed(() => currentUser.value && booking.value?.customer_id === currentUser.value.id)
const isProvider = computed(() => {
  if (!currentUser.value || !booking.value) return false
  if (providerProfileId.value && booking.value.provider_id === providerProfileId.value) return true
  if (booking.value.provider?.user?.id && booking.value.provider.user.id === currentUser.value.id) return true
  return false
})
const isCancelledOrRejected = computed(() => ['cancelled_by_customer', 'cancelled_by_provider', 'rejected', 'disputed'].includes(booking.value?.status))
const currentStepIndex = computed(() => {
  // 'in_progress' was removed from the lifecycle; map legacy bookings onto 'accepted'
  const status = booking.value?.status === 'in_progress' ? 'accepted' : booking.value?.status
  return lifecycle.indexOf(status)
})
const hasPaid = computed(() => payments.value.some(p => p.payment_status === 'paid'))

const counterpart = computed(() => {
  if (isProvider.value) {
    return {
      id: booking.value?.customer?.id || booking.value?.customer_id,
      name: `${booking.value?.customer?.first_name || ''} ${booking.value?.customer?.last_name || ''}`.trim() || 'Customer',
      role: 'customer',
      phone: booking.value?.customer?.phone || null,
    }
  }
  return {
    id: booking.value?.provider?.id || booking.value?.provider_id,
    name: `${booking.value?.provider?.user?.first_name || ''} ${booking.value?.provider?.user?.last_name || ''}`.trim() || 'Provider',
    role: 'provider',
    phone: booking.value?.provider?.user?.phone || null,
  }
})

// The API only sends the counterpart's phone once the booking is live (accepted+).
const contactUnlocked = computed(() =>
  ['accepted', 'in_progress', 'awaiting_confirmation', 'completed'].includes(booking.value?.status)
)

const chatUrl = computed(() => {
  if (!booking.value || !counterpart.value.id) return '/messages'
  const title = booking.value.job?.title || booking.value.service?.title || 'Service Booking'
  return `/messages?recipient=${counterpart.value.id}&name=${encodeURIComponent(counterpart.value.name)}&role=${counterpart.value.role}&context_type=booking&context_id=${booking.value.id}&context_title=${encodeURIComponent(title)}&context_amount=${booking.value.total_amount || ''}`
})

// ── Milestones & time logs ──────────────────────────────────────────────────
const milestones = ref([])
const timeLogs = ref([])
const timeLogSummary = ref({ is_hourly: false, default_rate: 0, approved_hours: 0, approved_total: 0, pending_hours: 0 })
const msBusy = ref(null)
const tlBusy = ref(null)
const newMilestone = ref({ title: '', amount: '', description: '' })
const newTimeLog = ref({ hours_logged: '', hourly_rate: '', note: '' })
const showMilestoneForm = ref(false)
const showTimeLogForm = ref(false)

const billingActive = computed(() => ['accepted', 'in_progress', 'awaiting_confirmation', 'completed'].includes(booking.value?.status))
const showTimeLogs = computed(() => timeLogSummary.value.is_hourly || timeLogs.value.length > 0)

async function loadBilling() {
  try {
    const [msRes, tlRes] = await Promise.all([
      apiFetch(`/bookings/${bookingId}/milestones`),
      apiFetch(`/bookings/${bookingId}/time-logs`),
    ])
    milestones.value = msRes.data ?? []
    timeLogs.value = tlRes.data ?? []
    timeLogSummary.value = tlRes.summary ?? timeLogSummary.value
    if (!newTimeLog.value.hourly_rate && timeLogSummary.value.default_rate) {
      newTimeLog.value.hourly_rate = timeLogSummary.value.default_rate
    }
  } catch { /* ignore */ }
}

async function msAction(fn, id) {
  msBusy.value = id ?? 'new'
  actionError.value = ''
  try { await fn(); await loadBilling() }
  catch (e) { actionError.value = e?.data?.message || 'Action failed.' }
  finally { msBusy.value = null }
}
const addMilestone = () => msAction(async () => {
  await apiFetch(`/bookings/${bookingId}/milestones`, { method: 'POST', body: {
    title: newMilestone.value.title.trim(),
    amount: Number(newMilestone.value.amount),
    description: newMilestone.value.description.trim() || undefined,
  } })
  newMilestone.value = { title: '', amount: '', description: '' }
  showMilestoneForm.value = false
})
const completeMilestone = (m) => msAction(() => apiFetch(`/milestones/${m.id}/complete`, { method: 'POST' }), m.id)
const approveMilestone = (m) => msAction(() => apiFetch(`/milestones/${m.id}/approve`, { method: 'POST' }), m.id)
const payMilestone = (m) => msAction(() => apiFetch(`/milestones/${m.id}/pay`, { method: 'POST', body: { payment_method: payMethod.value } }), m.id)
const deleteMilestone = (m) => msAction(() => apiFetch(`/milestones/${m.id}`, { method: 'DELETE' }), m.id)

async function tlAction(fn, id) {
  tlBusy.value = id ?? 'new'
  actionError.value = ''
  try { await fn(); await loadBilling() }
  catch (e) { actionError.value = e?.data?.message || 'Action failed.' }
  finally { tlBusy.value = null }
}
const addTimeLog = () => tlAction(async () => {
  await apiFetch(`/bookings/${bookingId}/time-logs`, { method: 'POST', body: {
    hours_logged: Number(newTimeLog.value.hours_logged),
    hourly_rate: newTimeLog.value.hourly_rate ? Number(newTimeLog.value.hourly_rate) : undefined,
    note: newTimeLog.value.note.trim() || undefined,
  } })
  newTimeLog.value = { hours_logged: '', hourly_rate: timeLogSummary.value.default_rate || '', note: '' }
  showTimeLogForm.value = false
})
const approveTimeLog = (l) => tlAction(() => apiFetch(`/time-logs/${l.id}/approve`, { method: 'POST' }), l.id)
const rejectTimeLog = (l) => tlAction(() => apiFetch(`/time-logs/${l.id}/reject`, { method: 'POST' }), l.id)
const deleteTimeLog = (l) => tlAction(() => apiFetch(`/time-logs/${l.id}`, { method: 'DELETE' }), l.id)

const money = (n) => 'ETB ' + Number(n || 0).toLocaleString()
const msStatusClass = (s) => ({
  pending: 'bg-mist/70 text-ink/60 dark:bg-white/10 dark:text-white/60',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  approved: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
}[s] || 'bg-mist/70 text-ink/60')

async function load() {
  try {
    const [bookingRes, userRes] = await Promise.all([
      apiFetch(`/bookings/${bookingId}`),
      apiFetch('/user'),
    ])
    booking.value = bookingRes.data
    currentUser.value = userRes

    if (booking.value.status === 'completed') {
      try {
        const payRes = await apiFetch(`/bookings/${bookingId}/payments`)
        payments.value = payRes.data
      } catch (e) { /* no payments yet */ }
    }
    if (billingActive.value) await loadBilling()
  } catch (err) {
    notFound.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function runAction(endpoint, body = {}) {
  actionError.value = ''
  actionLoading.value = true
  try {
    await apiFetch(`/bookings/${bookingId}/${endpoint}`, { method: 'POST', body })
    await load()
    showCancelForm.value = false
    showRejectForm.value = false
  } catch (err) {
    actionError.value = err?.data?.message || 'Something went wrong.'
  } finally {
    actionLoading.value = false
  }
}

async function submitCancel() {
  const key = isProvider.value ? 'cancel-by-provider' : 'cancel-by-customer'
  await runAction(key, { cancellation_reason: cancelReason.value })
}

async function submitReject() {
  await runAction('reject', { rejection_reason: rejectReason.value })
}

async function handlePay() {
  paying.value = true
  actionError.value = ''
  try {
    await apiFetch(`/bookings/${bookingId}/pay`, { method: 'POST', body: { payment_method: payMethod.value } })
    await load()
  } catch (err) {
    actionError.value = err?.data?.message || 'Payment failed.'
  } finally {
    paying.value = false
  }
}

async function submitReview() {
  submittingReview.value = true
  actionError.value = ''
  try {
    await apiFetch(`/bookings/${bookingId}/review`, { method: 'POST', body: reviewForm.value })
    reviewSubmitted.value = true
  } catch (err) {
    actionError.value = err?.data?.message || 'Failed to submit review.'
  } finally {
    submittingReview.value = false
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-6 py-8 sm:py-12">
    <!-- Back Navigation Arrow -->
    <div class="mb-4">
      <button @click="goBack" class="inline-flex items-center gap-1.5 text-xs font-semibold text-clay hover:underline">
        <span>←</span> Back
      </button>
    </div>

    <div v-if="loading" class="text-ink/40 dark:text-white/40">Loading booking…</div>

    <div v-else-if="notFound" class="border border-dashed border-mist dark:border-white/15 rounded-xl p-16 text-center">
      <p class="font-display text-xl text-ink dark:text-[#F0EDE6] mb-2">Booking not found</p>
      <p class="text-ink/50 dark:text-white/50 mb-4">This booking doesn't exist, or you don't have access to it.</p>
      <button @click="goBack" class="text-clay font-medium hover:underline">← Back to dashboard</button>
    </div>

    <template v-else-if="booking">
      <!-- Header (Booking ID kept implicit) -->
      <div class="mb-8">
        <p class="text-xs font-bold text-clay uppercase tracking-wider mb-1">
          {{ booking.service?.category?.name || 'Service Order' }}
        </p>
        <h1 class="font-display text-3xl font-semibold text-ink dark:text-[#F0EDE6] mb-2">
          {{ booking.job?.title || booking.service?.title || 'Service booking' }}
        </h1>
        <div class="flex items-center justify-between gap-4 text-sm text-ink/50 dark:text-white/50 flex-wrap">
          <div class="flex items-center gap-4 flex-wrap">
            <span>{{ isProvider ? 'Customer' : 'Provider' }}:
              <strong class="text-ink dark:text-[#F0EDE6]">{{ counterpart.name }}</strong>
            </span>
            <a
              v-if="contactUnlocked && counterpart.phone"
              :href="`tel:${counterpart.phone}`"
              class="inline-flex items-center gap-1.5 text-clay hover:underline font-semibold"
            >
              <span>📞</span> {{ counterpart.phone }}
            </a>
            <span class="font-display font-semibold text-clay text-base">{{ Number(booking.total_amount).toLocaleString() }} ETB</span>
          </div>
          <!-- Inquire / Message option directly opens chat with provider's name -->
          <NuxtLink
            :to="chatUrl"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-clay/40 text-clay hover:bg-clay/5 font-semibold text-xs transition shadow-xs"
          >
            <span>💬</span> Message {{ counterpart.name }}
          </NuxtLink>
        </div>
      </div>

      <!-- Lifecycle stepper -->
      <div v-if="!isCancelledOrRejected" class="flex items-center mb-10">
        <template v-for="(step, i) in lifecycle" :key="step">
          <div class="flex flex-col items-center">
            <div
              :class="['w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition',
                i <= currentStepIndex ? 'bg-clay text-white' : 'bg-mist dark:bg-mist-dark text-ink/30 dark:text-white/30']"
            >
              <span v-if="i < currentStepIndex">✓</span>
              <span v-else>{{ i + 1 }}</span>
            </div>
            <span :class="['text-[11px] mt-1.5 text-center w-16', i <= currentStepIndex ? 'text-ink dark:text-[#F0EDE6] font-medium' : 'text-ink/40 dark:text-white/40']">
              {{ statusLabel[step] }}
            </span>
          </div>
          <div v-if="i < lifecycle.length - 1" :class="['flex-1 h-0.5 mb-5', i < currentStepIndex ? 'bg-clay' : 'bg-mist dark:bg-mist-dark']"></div>
        </template>
      </div>

      <!-- Cancelled/rejected banner (Customer view: shows "Booking cancelled successfully") -->
      <div v-else class="bg-mist/50 dark:bg-mist-dark/60 border border-mist dark:border-white/10 rounded-2xl p-6 mb-8 text-center sm:text-left">
        <div class="flex items-center gap-2 mb-1.5">
          <span class="text-lg">ℹ️</span>
          <p class="font-bold text-ink dark:text-[#F0EDE6]">
            {{ isCustomer ? 'Booking cancelled successfully' : statusLabel[booking.status] }}
          </p>
        </div>
        <p v-if="booking.cancellation_reason" class="text-sm text-ink/60 dark:text-white/60">Reason: {{ booking.cancellation_reason }}</p>
        <p v-if="booking.rejection_reason" class="text-sm text-ink/60 dark:text-white/60">Reason: {{ booking.rejection_reason }}</p>
      </div>

      <p v-if="actionError" class="text-clay text-sm mb-4">{{ actionError }}</p>

      <!-- ── Actions by status + role ── -->

      <!-- Provider: pending → accept/reject -->
      <div v-if="booking.status === 'pending' && isProvider" class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-xl p-5 mb-6">
        <p class="font-medium text-ink dark:text-[#F0EDE6] mb-3">This booking is waiting for your response.</p>
        <div v-if="!showRejectForm" class="flex gap-3">
          <button @click="runAction('accept')" :disabled="actionLoading" class="flex-1 bg-clay hover:bg-clay/90 disabled:opacity-50 text-white font-semibold py-2.5 rounded-full transition">
            Accept booking
          </button>
          <button @click="showRejectForm = true" class="flex-1 border border-mist dark:border-white/15 text-ink/70 dark:text-white/70 font-semibold py-2.5 rounded-full hover:border-clay/40 transition">
            Decline
          </button>
        </div>
        <div v-else class="space-y-3">
          <textarea v-model="rejectReason" rows="2" placeholder="Reason for declining (required)…"
            class="w-full rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-transparent px-4 py-2.5 text-ink dark:text-[#F0EDE6] outline-none focus:ring-2 focus:ring-clay/40 transition resize-none"></textarea>
          <div class="flex gap-3">
            <button @click="submitReject" :disabled="!rejectReason.trim() || actionLoading" class="flex-1 bg-clay hover:bg-clay/90 disabled:opacity-40 text-white font-semibold py-2 rounded-full transition">Confirm decline</button>
            <button @click="showRejectForm = false" class="text-ink/50 dark:text-white/50 text-sm px-4">Cancel</button>
          </div>
        </div>
      </div>

      <!-- Provider: accepted (or legacy in_progress) → mark work complete, awaiting customer confirmation -->
      <div v-if="['accepted', 'in_progress'].includes(booking.status) && isProvider" class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-xl p-5 mb-6">
        <p class="font-medium text-ink dark:text-[#F0EDE6] mb-3">Finished the work?</p>
        <button @click="runAction('mark-awaiting-confirmation')" :disabled="actionLoading" class="w-full bg-clay hover:bg-clay/90 disabled:opacity-50 text-white font-semibold py-2.5 rounded-full transition">
          Mark as complete
        </button>
        <p class="text-xs text-ink/40 dark:text-white/40 mt-2">The customer will be asked to confirm before payment is released.</p>
      </div>

      <!-- Customer: awaiting_confirmation → confirm -->
      <div v-if="booking.status === 'awaiting_confirmation' && isCustomer" class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-xl p-5 mb-6">
        <p class="font-medium text-ink dark:text-[#F0EDE6] mb-3">The provider says this work is complete. Confirm to release payment.</p>
        <button @click="runAction('confirm-completion')" :disabled="actionLoading" class="w-full bg-clay hover:bg-clay/90 disabled:opacity-50 text-white font-semibold py-2.5 rounded-full transition">
          Confirm completion
        </button>
      </div>
      <div v-else-if="booking.status === 'awaiting_confirmation' && isProvider" class="bg-mist/40 dark:bg-mist-dark/60 rounded-xl p-5 mb-6 text-sm text-ink/60 dark:text-white/60">
        Waiting for the customer to confirm completion.
      </div>

      <!-- Payment Block -->
      <div v-if="booking.status === 'completed'" class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-xl p-5 mb-6">
        <!-- Customer View -->
        <template v-if="isCustomer">
          <div v-if="hasPaid" class="space-y-3">
            <div class="flex items-center justify-between pb-3 border-b border-mist dark:border-white/10">
              <div class="flex items-center gap-2 text-green-700 dark:text-green-400 font-semibold">
                <span>✓</span> Payment Completed
              </div>
              <span class="text-xs text-ink/40 dark:text-white/40">Secured via SkillLink Escrow</span>
            </div>

            <!-- Receipt Breakdown -->
            <div class="bg-mist/30 dark:bg-white/5 rounded-lg p-3 text-xs space-y-1.5">
              <div class="flex justify-between text-ink/70 dark:text-white/70">
                <span>Provider Service Rate:</span>
                <span>ETB {{ (Number(booking.total_amount) * 0.90).toLocaleString() }}</span>
              </div>
              <div class="flex justify-between text-ink/70 dark:text-white/70">
                <span>Platform Escrow & Service Fee (10%):</span>
                <span>ETB {{ (Number(booking.total_amount) * 0.10).toLocaleString() }}</span>
              </div>
              <div class="flex justify-between font-bold text-ink dark:text-white pt-1.5 border-t border-mist dark:border-white/10 text-sm">
                <span>Total Paid:</span>
                <span class="text-clay">ETB {{ Number(booking.total_amount).toLocaleString() }}</span>
              </div>
            </div>
          </div>

          <div v-else>
            <h3 class="font-display font-semibold text-ink dark:text-[#F0EDE6] mb-2">Service Completed — Payment Due</h3>
            <p class="text-xs text-ink/60 dark:text-white/60 mb-4">
              Please review the itemized breakdown and select your simulated payment method.
            </p>

            <!-- Fee Breakdown Table -->
            <div class="bg-mist/30 dark:bg-white/5 rounded-lg p-3.5 text-xs space-y-2 mb-4">
              <div class="flex justify-between text-ink/70 dark:text-white/70">
                <span>Base Service Amount:</span>
                <span class="font-medium">ETB {{ (Number(booking.total_amount) * 0.90).toLocaleString() }}</span>
              </div>
              <div class="flex justify-between text-ink/70 dark:text-white/70">
                <span>SkillLink Platform Protection (10%):</span>
                <span class="font-medium">ETB {{ (Number(booking.total_amount) * 0.10).toLocaleString() }}</span>
              </div>
              <div class="flex justify-between font-bold text-ink dark:text-white pt-2 border-t border-mist dark:border-white/10 text-sm">
                <span>Total Amount:</span>
                <span class="text-clay font-display text-base font-semibold">ETB {{ Number(booking.total_amount).toLocaleString() }}</span>
              </div>
            </div>

            <label class="block text-xs font-semibold text-ink dark:text-[#F0EDE6] uppercase mb-1.5">Payment Method</label>
            <select v-model="payMethod" class="w-full rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-transparent px-4 py-2.5 text-ink dark:text-[#F0EDE6] mb-3 outline-none focus:ring-2 focus:ring-clay/40 transition">
              <option value="telebirr_sim">Telebirr (Ethiopian Mobile Money)</option>
              <option value="chapa_sim">Chapa Checkout</option>
              <option value="cbe_birr_sim">CBE Birr</option>
              <option value="cash_sim">Cash on Delivery</option>
            </select>
            <button @click="handlePay" :disabled="paying" class="w-full bg-clay hover:bg-clay/90 disabled:opacity-50 text-white font-semibold py-2.5 rounded-full transition shadow-xs">
              {{ paying ? 'Processing Payment…' : `Pay ETB ${Number(booking.total_amount).toLocaleString()}` }}
            </button>
            <p class="text-[11px] text-ink/40 dark:text-white/40 mt-2 text-center">Simulated Ethiopian payment — instant confirmation.</p>
          </div>
        </template>

        <!-- Provider View: Earnings & Fee Breakdown -->
        <template v-else-if="isProvider">
          <h3 class="font-display font-semibold text-ink dark:text-[#F0EDE6] mb-2">Order Payout Summary</h3>
          <div class="bg-mist/30 dark:bg-white/5 rounded-lg p-3.5 text-xs space-y-2 mb-3">
            <div class="flex justify-between text-ink/70 dark:text-white/70">
              <span>Gross Order Value:</span>
              <span class="font-medium">ETB {{ Number(booking.total_amount).toLocaleString() }}</span>
            </div>
            <div class="flex justify-between text-amber-600 dark:text-amber-400">
              <span>SkillLink Platform Commission (-10%):</span>
              <span class="font-medium">-ETB {{ (Number(booking.total_amount) * 0.10).toLocaleString() }}</span>
            </div>
            <div class="flex justify-between font-bold text-green-700 dark:text-green-400 pt-2 border-t border-mist dark:border-white/10 text-sm">
              <span>Your Net Earnings (90%):</span>
              <span class="font-display text-base font-bold">ETB {{ (Number(booking.total_amount) * 0.90).toLocaleString() }}</span>
            </div>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-ink/50 dark:text-white/50">Status: {{ hasPaid ? 'Funds Released to Wallet' : 'Awaiting Payment Release' }}</span>
            <NuxtLink to="/provider/wallet" class="text-clay font-semibold hover:underline">
              View in Wallet →
            </NuxtLink>
          </div>
        </template>
      </div>

      <!-- Review (Customer only, after completion and payment) -->
      <div v-if="booking.status === 'completed' && isCustomer && hasPaid" class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-xl p-5 mb-6">
        <div v-if="reviewSubmitted" class="text-center py-2">
          <p class="text-2xl mb-1">✓</p>
          <p class="font-medium text-ink dark:text-[#F0EDE6]">Thanks for your review!</p>
        </div>
        <div v-else>
          <h3 class="font-display text-lg font-semibold text-ink dark:text-[#F0EDE6] mb-4">Leave a review</h3>
          <div class="space-y-3 mb-4">
            <div v-for="field in ['communication_rating', 'quality_rating', 'timeliness_rating', 'professionalism_rating']" :key="field" class="flex items-center justify-between">
              <span class="text-sm text-ink/60 dark:text-white/60 capitalize">{{ field.replace('_rating', '') }}</span>
              <div class="flex gap-1">
                <button v-for="n in 5" :key="n" @click="reviewForm[field] = n" type="button" class="text-lg leading-none">
                  <span :class="n <= reviewForm[field] ? 'text-gold' : 'text-mist dark:text-white/20'">★</span>
                </button>
              </div>
            </div>
          </div>
          <textarea v-model="reviewForm.comment" rows="3" placeholder="How was your experience with {{ counterpart.name }}?"
            class="w-full rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-transparent px-4 py-2.5 text-ink dark:text-[#F0EDE6] outline-none focus:ring-2 focus:ring-clay/40 transition resize-none mb-3"></textarea>
          <button @click="submitReview" :disabled="submittingReview" class="w-full bg-clay hover:bg-clay/90 disabled:opacity-50 text-white font-semibold py-2.5 rounded-full transition">
            {{ submittingReview ? 'Submitting…' : 'Submit review' }}
          </button>
        </div>
      </div>

      <!-- ── Milestones ── -->
      <div v-if="billingActive && (isCustomer || isProvider)" class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-xl p-5 mb-6">
        <div class="flex items-center justify-between gap-3 mb-1 flex-wrap">
          <h3 class="font-display font-semibold text-ink dark:text-[#F0EDE6]">Milestones</h3>
          <button
            v-if="isProvider && booking.status !== 'completed'"
            @click="showMilestoneForm = !showMilestoneForm"
            class="text-xs font-bold text-clay border border-clay/40 hover:bg-clay/5 px-3 py-1.5 rounded-full transition"
          >
            {{ showMilestoneForm ? 'Cancel' : '+ Add milestone' }}
          </button>
        </div>
        <p class="text-xs text-ink/50 dark:text-white/50 mb-4">
          {{ isProvider ? 'Break the job into stages. The customer approves and pays each one.' : 'Approve and pay each stage as your provider delivers it.' }}
        </p>

        <form v-if="showMilestoneForm" @submit.prevent="addMilestone" class="mb-4 grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-2">
          <input v-model="newMilestone.title" type="text" placeholder="Milestone title" required class="rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-transparent px-3 py-2 text-sm text-ink dark:text-white" >
          <input v-model="newMilestone.amount" type="number" min="1" placeholder="Amount ETB" required class="rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-transparent px-3 py-2 text-sm text-ink dark:text-white" >
          <input v-model="newMilestone.description" type="text" placeholder="Short description (optional)" class="sm:col-span-2 rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-transparent px-3 py-2 text-sm text-ink dark:text-white" >
          <button type="submit" :disabled="msBusy === 'new'" class="sm:col-span-2 bg-clay hover:bg-clay/90 disabled:opacity-40 text-white text-xs font-bold py-2 rounded-lg transition">
            {{ msBusy === 'new' ? 'Adding…' : 'Add milestone' }}
          </button>
        </form>

        <div v-if="!milestones.length" class="text-xs text-ink/40 dark:text-white/40 py-2">No milestones yet.</div>
        <ul v-else class="divide-y divide-mist dark:divide-white/10">
          <li v-for="m in milestones" :key="m.id" class="py-3 flex items-start justify-between gap-3 flex-wrap">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-ink dark:text-white">
                {{ m.sequence_order }}. {{ m.title }}
                <span :class="['ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase', m.is_paid ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300' : msStatusClass(m.status)]">
                  {{ m.is_paid ? 'Paid' : m.status }}
                </span>
              </p>
              <p v-if="m.description" class="text-xs text-ink/55 dark:text-white/55 mt-0.5">{{ m.description }}</p>
              <p class="text-xs text-ink/45 dark:text-white/45 mt-0.5">{{ money(m.amount) }}<span v-if="m.payment_reference"> · {{ m.payment_reference }}</span></p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <template v-if="isProvider">
                <button v-if="['pending','in_progress'].includes(m.status)" @click="completeMilestone(m)" :disabled="msBusy === m.id" class="text-xs font-semibold text-clay hover:underline disabled:opacity-50">Mark delivered</button>
                <button v-if="m.status === 'pending'" @click="deleteMilestone(m)" :disabled="msBusy === m.id" class="text-xs font-semibold text-red-500 hover:underline disabled:opacity-50">Remove</button>
              </template>
              <template v-else>
                <button v-if="m.status === 'completed'" @click="approveMilestone(m)" :disabled="msBusy === m.id" class="text-xs font-bold bg-clay text-white px-3 py-1.5 rounded-full disabled:opacity-50">Approve</button>
                <button v-if="m.status === 'approved' && !m.is_paid" @click="payMilestone(m)" :disabled="msBusy === m.id" class="text-xs font-bold bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-full disabled:opacity-50">Pay {{ money(m.amount) }}</button>
              </template>
            </div>
          </li>
        </ul>
      </div>

      <!-- ── Time logs (hourly work) ── -->
      <div v-if="billingActive && showTimeLogs && (isCustomer || isProvider)" class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-xl p-5 mb-6">
        <div class="flex items-center justify-between gap-3 mb-1 flex-wrap">
          <h3 class="font-display font-semibold text-ink dark:text-[#F0EDE6]">Time Logged</h3>
          <button
            v-if="isProvider && booking.status !== 'completed'"
            @click="showTimeLogForm = !showTimeLogForm"
            class="text-xs font-bold text-clay border border-clay/40 hover:bg-clay/5 px-3 py-1.5 rounded-full transition"
          >
            {{ showTimeLogForm ? 'Cancel' : '+ Log hours' }}
          </button>
        </div>
        <p class="text-xs text-ink/50 dark:text-white/50 mb-3">
          Approved: <strong>{{ timeLogSummary.approved_hours }}h</strong> = {{ money(timeLogSummary.approved_total) }}
          <span v-if="timeLogSummary.pending_hours"> · {{ timeLogSummary.pending_hours }}h awaiting review</span>
        </p>

        <form v-if="showTimeLogForm" @submit.prevent="addTimeLog" class="mb-4 grid grid-cols-2 sm:grid-cols-[100px_120px_1fr] gap-2">
          <input v-model="newTimeLog.hours_logged" type="number" step="0.25" min="0.25" placeholder="Hours" required class="rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-transparent px-3 py-2 text-sm text-ink dark:text-white" >
          <input v-model="newTimeLog.hourly_rate" type="number" min="0" placeholder="Rate/hr" class="rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-transparent px-3 py-2 text-sm text-ink dark:text-white" >
          <input v-model="newTimeLog.note" type="text" placeholder="What did you work on?" class="col-span-2 sm:col-span-1 rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-transparent px-3 py-2 text-sm text-ink dark:text-white" >
          <button type="submit" :disabled="tlBusy === 'new'" class="col-span-2 sm:col-span-3 bg-clay hover:bg-clay/90 disabled:opacity-40 text-white text-xs font-bold py-2 rounded-lg transition">
            {{ tlBusy === 'new' ? 'Saving…' : 'Log time' }}
          </button>
        </form>

        <div v-if="!timeLogs.length" class="text-xs text-ink/40 dark:text-white/40 py-2">No time entries yet.</div>
        <ul v-else class="divide-y divide-mist dark:divide-white/10">
          <li v-for="l in timeLogs" :key="l.id" class="py-2.5 flex items-center justify-between gap-3 flex-wrap">
            <div class="min-w-0">
              <p class="text-sm text-ink dark:text-white">
                <strong>{{ l.hours_logged }}h</strong> × {{ money(l.hourly_rate) }} = {{ money(l.subtotal) }}
                <span :class="['ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase', { 'bg-green-100 text-green-700': l.status === 'approved', 'bg-red-100 text-red-700': l.status === 'rejected', 'bg-mist/70 text-ink/60 dark:bg-white/10 dark:text-white/60': l.status === 'pending' }]">{{ l.status }}</span>
              </p>
              <p v-if="l.note" class="text-xs text-ink/55 dark:text-white/55">{{ l.note }}</p>
              <p class="text-[11px] text-ink/40 dark:text-white/40">{{ new Date(l.logged_at).toLocaleDateString() }}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <template v-if="isCustomer && l.status === 'pending'">
                <button @click="approveTimeLog(l)" :disabled="tlBusy === l.id" class="text-xs font-bold bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-full disabled:opacity-50">Approve</button>
                <button @click="rejectTimeLog(l)" :disabled="tlBusy === l.id" class="text-xs font-semibold text-red-500 hover:underline disabled:opacity-50">Reject</button>
              </template>
              <button v-if="isProvider && l.status === 'pending'" @click="deleteTimeLog(l)" :disabled="tlBusy === l.id" class="text-xs font-semibold text-red-500 hover:underline disabled:opacity-50">Remove</button>
            </div>
          </li>
        </ul>
      </div>

      <!-- Cancel option (while cancellable) -->
      <div v-if="['pending', 'accepted', 'in_progress'].includes(booking.status) && (isCustomer || isProvider)" class="mt-4">
        <button v-if="!showCancelForm" @click="showCancelForm = true" class="text-sm text-ink/40 dark:text-white/40 hover:text-clay transition">
          Cancel this booking
        </button>
        <div v-else class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-xl p-5 mt-2 space-y-3">
          <textarea v-model="cancelReason" rows="2" placeholder="Reason for cancelling (required)…"
            class="w-full rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-transparent px-4 py-2.5 text-ink dark:text-[#F0EDE6] outline-none focus:ring-2 focus:ring-clay/40 transition resize-none"></textarea>
          <div class="flex gap-3">
            <button @click="submitCancel" :disabled="!cancelReason.trim() || actionLoading" class="bg-clay hover:bg-clay/90 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-full transition">Confirm cancellation</button>
            <button @click="showCancelForm = false" class="text-ink/50 dark:text-white/50 text-sm px-4">Never mind</button>
          </div>
        </div>
      </div>

      <!-- Audit trail (Only for provider or non-cancelled bookings) -->
      <div v-if="booking.history?.length && !isCancelledOrRejected" class="mt-10 pt-8 border-t border-mist dark:border-white/10">
        <button
          @click="showHistory = !showHistory"
          class="flex items-center gap-2 text-sm font-semibold text-ink/70 dark:text-white/70 hover:text-clay transition"
          :aria-expanded="showHistory"
        >
          <span>{{ showHistory ? 'Hide booking history' : 'View booking history' }}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="transition-transform" :class="showHistory ? 'rotate-180' : ''">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <div v-if="showHistory" class="space-y-3 mt-4">
          <div v-for="h in booking.history" :key="h.id" class="flex gap-3 text-sm">
            <span class="text-ink/40 dark:text-white/40 whitespace-nowrap">{{ new Date(h.changed_at).toLocaleDateString() }}</span>
            <span class="text-ink/70 dark:text-white/70">{{ h.remarks }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>