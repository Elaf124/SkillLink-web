<script setup>
definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()
const { apiFetch, token } = useApi()
const goBack = useGoBack('/jobs')

const job = ref(null)
const offers = ref([])
const currentUser = ref(null)
const loading = ref(true)
const notFound = ref(false)

const offerForm = ref({ proposed_price: '', message: '', estimated_days: '' })
const submittingOffer = ref(false)
const offerError = ref('')
const offerSuccess = ref(false)

const acceptingOfferId = ref(null)
const rejectingOfferId = ref(null)

const jobId = route.params.id

const isOwner = computed(() => currentUser.value && job.value && job.value.customer_id === currentUser.value.id)
const isProvider = computed(() => currentUser.value?.role?.name === 'provider')
const myOffer = computed(() => offers.value.find(o => o.provider?.user_id === currentUser.value?.id))

async function loadJob() {
  try {
    const res = await apiFetch(`/jobs/${jobId}`)
    job.value = res.data
  } catch (err) {
    notFound.value = true
  }
}

async function loadOffers() {
  if (!isOwner.value) return
  try {
    const res = await apiFetch(`/jobs/${jobId}/offers`)
    offers.value = res.data
  } catch (e) { /* not owner or not logged in */ }
}

onMounted(async () => {
  if (token.value) {
    try {
      currentUser.value = await apiFetch('/user')
    } catch (e) { /* not logged in, still allow viewing */ }
  }
  await loadJob()
  if (job.value) await loadOffers()
  loading.value = false
})

async function submitOffer() {
  offerError.value = ''
  submittingOffer.value = true
  try {
    await apiFetch(`/jobs/${jobId}/offers`, { method: 'POST', body: offerForm.value })
    offerSuccess.value = true
  } catch (err) {
    const errors = err?.data?.errors
    offerError.value = errors ? Object.values(errors).flat().join(' ') : (err?.data?.message || 'Failed to submit offer.')
  } finally {
    submittingOffer.value = false
  }
}

async function acceptOffer(offerId) {
  acceptingOfferId.value = offerId
  try {
    const res = await apiFetch(`/offers/${offerId}/accept`, { method: 'POST' })
    router.push(`/bookings/${res.data.id}`)
  } catch (err) {
    alert(err?.data?.message || 'Failed to accept offer.')
  } finally {
    acceptingOfferId.value = null
  }
}

const deletingJob = ref(false)
async function deleteJob() {
  if (!confirm(`Delete "${job.value?.title}"? This closes the job and providers can no longer send offers.`)) return
  deletingJob.value = true
  try {
    await apiFetch(`/jobs/${jobId}`, { method: 'DELETE' })
    router.push('/my-jobs')
  } catch (err) {
    alert(err?.data?.message || 'Failed to delete this job.')
    deletingJob.value = false
  }
}

async function rejectOffer(offerId) {
  if (!confirm('Decline this offer? The provider will be notified. This does not close your job.')) return
  rejectingOfferId.value = offerId
  try {
    await apiFetch(`/offers/${offerId}/reject`, { method: 'POST' })
    await loadOffers()
  } catch (err) {
    alert(err?.data?.message || 'Failed to decline offer.')
  } finally {
    rejectingOfferId.value = null
  }
}

const statusStyle = {
  pending: 'bg-gold/15 text-gold-light border-gold/30',
  accepted: 'bg-green-600/10 text-green-700 dark:text-green-400 border-green-600/25',
  rejected: 'bg-mist text-ink/50 dark:bg-mist-dark dark:text-white/50 border-mist',
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-6 py-12">
    <div v-if="loading" class="text-ink/40 dark:text-white/40">Loading job…</div>

    <div v-else-if="notFound" class="border border-dashed border-mist dark:border-white/15 rounded-xl p-16 text-center">
      <p class="font-display text-xl text-ink dark:text-[#F0EDE6] mb-2">Job not found</p>
      <button @click="goBack" class="text-clay font-medium hover:underline">← Back to open jobs</button>
    </div>

    <template v-else-if="job">
      <!-- Job header -->
      <div class="mb-10 pb-8 border-b border-mist dark:border-white/10">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-xs bg-mist/60 dark:bg-white/5 text-ink/60 dark:text-white/60 px-2.5 py-1 rounded-full">
            {{ job.category?.name }}
          </span>
          <span
            :class="['text-xs px-2.5 py-1 rounded-full font-medium',
              job.status === 'open' ? 'bg-green-600/10 text-green-700 dark:text-green-400' : 'bg-mist text-ink/50 dark:bg-mist-dark dark:text-white/50']"
          >
            {{ job.status === 'open' ? 'Open for offers' : 'No longer open' }}
          </span>
        </div>

        <h1 class="font-display text-3xl font-semibold text-ink dark:text-[#F0EDE6] mb-3">{{ job.title }}</h1>
        <p class="text-ink/70 dark:text-white/70 leading-relaxed mb-4">{{ job.description }}</p>

        <div class="flex items-center gap-6 text-sm text-ink/50 dark:text-white/50">
          <span class="font-display text-lg font-semibold text-clay">{{ Number(job.budget).toLocaleString() }} ETB</span>
          <span v-if="job.location">📍 {{ job.location }}</span>
          <span v-if="job.preferred_date">Needed by {{ new Date(job.preferred_date).toLocaleDateString() }}</span>
        </div>
        <p class="text-xs text-ink/40 dark:text-white/40 mt-2">
          Posted by {{ job.customer?.first_name }} {{ job.customer?.last_name }}
        </p>
      </div>

      <!-- Provider view: submit an offer -->
      <div v-if="isProvider && job.status === 'open'">
        <div v-if="offerSuccess" class="border border-green-600/30 bg-green-600/5 rounded-xl p-8 text-center">
          <p class="text-2xl mb-2">✓</p>
          <p class="font-display text-lg font-semibold text-ink dark:text-[#F0EDE6] mb-1">Offer submitted!</p>
          <p class="text-ink/60 dark:text-white/60 text-sm">The customer will review it and get back to you.</p>
        </div>

        <div v-else class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-xl p-6">
          <h2 class="font-display text-xl font-semibold text-ink dark:text-[#F0EDE6] mb-4">Submit an offer</h2>
          <form @submit.prevent="submitOffer" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">Your price (ETB)</label>
              <input
                v-model="offerForm.proposed_price" type="number" min="0" required
                class="w-full rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-transparent px-4 py-2.5 text-ink dark:text-[#F0EDE6] outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">Estimated days to complete</label>
              <input
                v-model="offerForm.estimated_days" type="number" min="1"
                class="w-full rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-transparent px-4 py-2.5 text-ink dark:text-[#F0EDE6] outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">Message to the customer</label>
              <textarea
                v-model="offerForm.message" rows="4" placeholder="Introduce yourself and explain your approach…"
                class="w-full rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-transparent px-4 py-2.5 text-ink dark:text-[#F0EDE6] placeholder:text-ink/30 dark:placeholder:text-white/30 outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition resize-none"
              ></textarea>
            </div>
            <p v-if="offerError" class="text-clay text-sm">{{ offerError }}</p>
            <button
              type="submit" :disabled="submittingOffer"
              class="w-full bg-clay hover:bg-clay/90 disabled:opacity-50 text-white font-semibold py-2.5 rounded-full transition"
            >
              {{ submittingOffer ? 'Submitting…' : 'Submit offer' }}
            </button>
          </form>
        </div>
      </div>

      <!-- Owner view: incoming offers -->
      <div v-else-if="isOwner">
        <div class="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <h2 class="font-display text-xl font-semibold text-ink dark:text-[#F0EDE6]">
            Offers received ({{ offers.length }})
          </h2>
          <div v-if="job.status === 'open'" class="flex items-center gap-2">
            <NuxtLink
              :to="`/jobs/post?edit=${job.id}`"
              class="text-xs font-semibold border border-mist dark:border-white/15 text-ink/70 dark:text-white/70 hover:border-clay hover:text-clay px-3 py-1.5 rounded-full transition"
            >
              Edit job
            </NuxtLink>
            <button
              @click="deleteJob"
              :disabled="deletingJob"
              class="text-xs font-semibold border border-mist dark:border-white/15 text-ink/70 dark:text-white/70 hover:border-red-400 hover:text-red-600 disabled:opacity-50 px-3 py-1.5 rounded-full transition"
            >
              {{ deletingJob ? 'Deleting…' : 'Delete job' }}
            </button>
          </div>
        </div>

        <div v-if="!offers.length" class="border border-dashed border-mist dark:border-white/15 rounded-xl p-10 text-center">
          <p class="text-ink/50 dark:text-white/50">No offers yet — check back soon.</p>
        </div>

        <div v-else class="space-y-4">
          <div
            v-for="offer in offers" :key="offer.id"
            class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-xl p-5"
          >
            <div class="flex items-start justify-between gap-4 mb-3">
              <NuxtLink :to="`/providers/${offer.provider?.id}`" class="flex items-center gap-3 group">
                <div class="w-10 h-10 rounded-full bg-clay/10 flex items-center justify-center font-display font-semibold text-clay shrink-0">
                  {{ offer.provider?.user?.first_name?.[0] }}
                </div>
                <div>
                  <p class="font-medium text-ink dark:text-[#F0EDE6] group-hover:text-clay transition">
                    {{ offer.provider?.user?.first_name }} {{ offer.provider?.user?.last_name }}
                  </p>
                  <p class="text-xs text-ink/50 dark:text-white/50">
                    ★ {{ Number(offer.provider?.average_rating || 0).toFixed(1) }} · {{ offer.provider?.completed_jobs }} jobs done
                  </p>
                </div>
              </NuxtLink>
              <span :class="['text-xs font-medium px-2.5 py-1 rounded-full border shrink-0', statusStyle[offer.status]]">
                {{ offer.status }}
              </span>
            </div>

            <p v-if="offer.message" class="text-sm text-ink/60 dark:text-white/60 mb-3">{{ offer.message }}</p>

            <div class="flex items-center justify-between pt-3 border-t border-mist dark:border-white/10">
              <div class="flex items-center gap-4 text-sm">
                <span class="font-display font-semibold text-clay">{{ Number(offer.proposed_price).toLocaleString() }} ETB</span>
                <span v-if="offer.estimated_days" class="text-ink/50 dark:text-white/50">{{ offer.estimated_days }} days</span>
              </div>
              <div class="flex items-center gap-2">
                <NuxtLink
                  :to="`/messages?recipient=${offer.provider?.id}&name=${encodeURIComponent((offer.provider?.user?.first_name || '') + ' ' + (offer.provider?.user?.last_name || ''))}&role=provider&context_type=job&context_id=${job.id}&context_title=${encodeURIComponent(job.title)}&context_amount=${offer.proposed_price || ''}`"
                  class="border border-clay/40 text-clay hover:bg-clay/5 text-xs font-semibold px-3 py-1.5 rounded-full transition"
                >
                  💬 Negotiate
                </NuxtLink>
                <button
                  v-if="offer.status === 'pending' && job.status === 'open'"
                  @click="rejectOffer(offer.id)" :disabled="rejectingOfferId === offer.id || acceptingOfferId === offer.id"
                  class="border border-mist dark:border-white/15 text-ink/60 dark:text-white/60 hover:border-red-400 hover:text-red-600 disabled:opacity-50 text-xs font-semibold px-3 py-2 rounded-full transition"
                >
                  {{ rejectingOfferId === offer.id ? 'Declining…' : 'Decline' }}
                </button>
                <button
                  v-if="offer.status === 'pending' && job.status === 'open'"
                  @click="acceptOffer(offer.id)" :disabled="acceptingOfferId === offer.id || rejectingOfferId === offer.id"
                  class="bg-clay hover:bg-clay/90 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-full transition"
                >
                  {{ acceptingOfferId === offer.id ? 'Accepting…' : 'Accept offer' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Provider who already offered -->
      <div v-else-if="isProvider && myOffer" class="border border-mist dark:border-white/10 rounded-xl p-6 text-center">
        <p class="text-ink/60 dark:text-white/60">You've already submitted an offer on this job.</p>
      </div>

      <!-- Not logged in / read-only -->
      <div v-else-if="!currentUser" class="border border-dashed border-mist dark:border-white/15 rounded-xl p-8 text-center">
        <p class="text-ink/60 dark:text-white/60 mb-4">Sign in as a provider to submit an offer on this job.</p>
        <NuxtLink to="/login" class="text-clay font-medium hover:underline">Log in</NuxtLink>
      </div>
    </template>
  </div>
</template>