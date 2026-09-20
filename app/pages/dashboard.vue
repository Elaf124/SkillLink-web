<script setup lang="ts">
definePageMeta({ layout: 'default', middleware: ['auth'] })

const { apiFetch, token } = useApi()
const router = useRouter()
const { getProviderAvatar, handleAvatarError } = useProviderAvatar()
const user = ref<any>(null)
const loading = ref(true)
const stats = ref<any>(null)
const bookings = ref<any[]>([])
const jobs = ref<any[]>([])
const showCancelled = ref(false)

// Statuses that are "closed" (terminal)
const closedStatuses = ['completed', 'rejected', 'cancelled_by_customer', 'cancelled_by_provider']
const cancelledStatuses = ['cancelled_by_customer', 'cancelled_by_provider']

onMounted(async () => {
  try {
    user.value = await apiFetch('/user')
    if (user.value?.role?.name === 'admin_finance') {
      await router.replace('/admin/finance')
      return
    }
    if (user.value?.role?.name === 'admin_support') {
      await router.replace('/admin/support')
      return
    }
    await loadStats()
    if (isCustomer.value) {
      await loadRecommendations()
      await loadCompareOffers()
    } else {
      await loadProviderJobRecommendations()
    }
  } catch {
    token.value = null
    await router.push('/login')
  } finally { loading.value = false }
})

async function loadStats() {
  try {
    const customer = user.value.role?.name !== 'provider'
    const bookingsRes = await apiFetch<any>(customer ? '/my-bookings/customer' : '/my-bookings/provider')
    const byId = new Map<number, any>()
    for (const b of bookingsRes.data ?? []) byId.set(b.id, b)
    bookings.value = Array.from(byId.values())
    const jobsRes = customer ? await apiFetch<any>('/my-jobs') : { data: [] }
    jobs.value = jobsRes.data ?? []
    stats.value = {
      type: customer ? 'customer' : 'provider',
      openJobs: jobs.value.filter((job: any) => job.status === 'open').length,
      activeBookings: bookings.value.filter((booking: any) => !closedStatuses.includes(booking.status)).length,
      awaitingReview: bookings.value.filter((booking: any) => booking.status === 'awaiting_confirmation').length,
      completed: bookings.value.filter((booking: any) => booking.status === 'completed').length,
      // Provider wallet: 90% of completed booking amounts
      netEarnings: customer ? 0 : bookings.value
        .filter((b: any) => b.status === 'completed')
        .reduce((sum: number, b: any) => sum + Number(b.amount ?? b.total_amount ?? 0) * 0.9, 0),
    }
  } catch {
    stats.value = { type: user.value.role?.name === 'provider' ? 'provider' : 'customer', openJobs: 0, activeBookings: 0, awaitingReview: 0, completed: 0 }
  }
}

const isCustomer = computed(() => stats.value?.type === 'customer')

const statusLabel: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  in_progress: 'In progress',
  awaiting_confirmation: 'Awaiting review',
  completed: 'Completed',
  cancelled_by_customer: 'Cancelled',
  cancelled_by_provider: 'Cancelled',
  rejected: 'Rejected',
  disputed: 'Disputed',
  open: 'Open · awaiting offers',
}

const bookingTitle = (booking: any) => booking.job?.title || booking.service?.title || `Booking`
const bookingPerson = (booking: any) =>
  isCustomer.value
    ? `${booking.provider?.user?.first_name ?? ''} ${booking.provider?.user?.last_name ?? ''}`.trim()
    : `${booking.customer?.first_name ?? ''} ${booking.customer?.last_name ?? ''}`.trim()
const formatDate = (d: string) => new Intl.DateTimeFormat('en-CA').format(new Date(d))

// Completed bookings drop off the dashboard 24h after the customer confirms.
const COMPLETED_TTL_MS = 24 * 60 * 60 * 1000
function isStaleCompleted(b: any): boolean {
  if (b.status !== 'completed') return false
  const at = b.completed_at ?? b.updated_at ?? b.created_at
  if (!at) return false
  return Date.now() - new Date(at).getTime() > COMPLETED_TTL_MS
}

// ── Unified "active projects" list ──────────────────────────────────────────
const projects = computed(() => {
  const fromBookings = bookings.value.map((b: any) => ({
    key: `booking-${b.id}`,
    title: bookingTitle(b),
    statusRaw: b.status,
    counterpart: bookingPerson(b) || (isCustomer.value ? 'Provider not yet assigned' : 'Customer'),
    date: b.created_at,
    amount: b.amount ?? b.total_amount,
    viewLink: `/bookings/${b.id}`,
    isActive: !closedStatuses.includes(b.status),
    isCompleted: b.status === 'completed',
    isCancelled: cancelledStatuses.includes(b.status),
    isStaleCompleted: isStaleCompleted(b),
    rehireLink: b.status === 'completed' && b.provider?.id ? `/providers/${b.provider.id}` : null,
    manageLink: null as string | null,
  }))
  const fromJobs = isCustomer.value ? jobs.value.map((j: any) => ({
    key: `job-${j.id}`,
    title: j.title,
    statusRaw: j.status,
    counterpart: j.status === 'open' ? 'Awaiting offers' : 'Provider assigned',
    date: j.created_at,
    amount: j.budget,
    viewLink: `/jobs/${j.id}`,
    isActive: j.status === 'open',
    isCompleted: false,
    isCancelled: false,
    isStaleCompleted: false,
    rehireLink: null as string | null,
    manageLink: j.status === 'open' ? `/jobs/${j.id}` : null,
  })) : []
  return [...fromBookings, ...fromJobs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
})

const projectFilter = ref<'all' | 'active' | 'completed'>('all')
const filteredProjects = computed(() => {
  let list = projects.value
  // Completed projects fall off the board 24h after completion
  list = list.filter(p => !p.isStaleCompleted)
  // Hide cancelled by default unless user toggles
  if (!showCancelled.value) list = list.filter(p => !p.isCancelled)
  if (projectFilter.value === 'active') return list.filter(p => p.isActive)
  if (projectFilter.value === 'completed') return list.filter(p => p.isCompleted)
  return list
})
const showAllProjects = ref(false)
const visibleProjects = computed(() => showAllProjects.value ? filteredProjects.value : filteredProjects.value.slice(0, 5))

const cancelledCount = computed(() => projects.value.filter(p => p.isCancelled).length)

// ── Compare Offers (open jobs only) ─────────────────────────────────────────
const offersByJob = ref<Record<string, any[]>>({})
const loadingOffers = ref(false)

async function loadCompareOffers() {
  const openJobs = jobs.value.filter((j: any) => j.status === 'open')
  if (!openJobs.length) return
  loadingOffers.value = true
  try {
    await Promise.all(
      openJobs.map(async (job: any) => {
        try {
          const res = await apiFetch<any>(`/jobs/${job.id}/offers`)
          offersByJob.value[job.id] = (res.data ?? []).filter((o: any) => o.status === 'pending')
        } catch {
          offersByJob.value[job.id] = []
        }
      })
    )
  } finally {
    loadingOffers.value = false
  }
}

const openJobsWithOffers = computed(() =>
  jobs.value
    .filter((j: any) => j.status === 'open' && (offersByJob.value[j.id]?.length ?? 0) > 0)
)

const rejectingOfferId = ref<number | null>(null)
async function declineOffer(jobId: string | number, offerId: number) {
  if (!confirm('Decline this offer? The provider will be notified.')) return
  rejectingOfferId.value = offerId
  try {
    await apiFetch(`/offers/${offerId}/reject`, { method: 'POST' })
    offersByJob.value[jobId] = (offersByJob.value[jobId] ?? []).filter((o: any) => o.id !== offerId)
  } catch (err: any) {
    alert(err?.data?.message || 'Failed to decline offer.')
  } finally {
    rejectingOfferId.value = null
  }
}

// ── Smart Recommendations ─────────────────────────────────────────────────
const recommendedProviders = ref<any[]>([])
const loadingRecommendations = ref(false)

const recentJobCategory = computed(() => jobs.value[0]?.category?.name ?? '')
const userCity = computed(() => user.value?.city ?? '')

const recommendationReason = computed(() => {
  if (recentJobCategory.value) return `Matched to your "${recentJobCategory.value}" job post`
  return 'Top-scored providers on SkillLink'
})

function scoreProvider(entry: any): number {
  const p = entry.provider
  const rating = Number(p.average_rating ?? 0)
  const jobs = Number(p.completed_jobs ?? 0)
  const categoryName = entry.service?.category?.name ?? ''
  const categoryMatch = recentJobCategory.value && categoryName === recentJobCategory.value ? 3 : 0
  const cityMatch = userCity.value && p.user?.city && p.user.city.toLowerCase() === userCity.value.toLowerCase() ? 2 : 0
  return (rating * 2) + (jobs * 0.1) + categoryMatch + cityMatch
}

function whyRecommended(entry: any): string {
  const reasons: string[] = []
  const p = entry.provider
  const categoryName = entry.service?.category?.name ?? ''
  if (recentJobCategory.value && categoryName === recentJobCategory.value) reasons.push(`Matches your "${recentJobCategory.value}" job`)
  if (userCity.value && p.user?.city?.toLowerCase() === userCity.value.toLowerCase()) reasons.push('Near you')
  if (Number(p.average_rating ?? 0) >= 4.5) reasons.push('Top rated ⭐')
  if (Number(p.completed_jobs ?? 0) >= 10) reasons.push('Highly experienced')
  return reasons.length ? reasons.join(' · ') : 'Trending on SkillLink'
}

async function loadRecommendations() {
  loadingRecommendations.value = true
  try {
    const categoryId = jobs.value[0]?.category_id ?? jobs.value[0]?.category?.id
    const params1 = new URLSearchParams({ page: '1' })
    const params2 = new URLSearchParams({ page: '2' })
    if (categoryId) { params1.set('category_id', categoryId); params2.set('category_id', categoryId) }

    const [res1, res2] = await Promise.allSettled([
      apiFetch<any>(`/services?${params1}`),
      apiFetch<any>(`/services?${params2}`),
    ])
    const allServices: any[] = [
      ...(res1.status === 'fulfilled' ? res1.value.data ?? [] : []),
      ...(res2.status === 'fulfilled' ? res2.value.data ?? [] : []),
    ]
    const byProvider = new Map()
    for (const s of allServices) {
      const pid = s.provider?.id
      if (!pid || byProvider.has(pid)) continue
      byProvider.set(pid, { provider: s.provider, service: s })
    }
    recommendedProviders.value = Array.from(byProvider.values())
      .map((entry: any) => ({ ...entry, score: scoreProvider(entry), why: whyRecommended(entry) }))
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 6)
  } catch {
    recommendedProviders.value = []
  } finally {
    loadingRecommendations.value = false
  }
}


// Whether the provider has a meaningful profile (title, bio, or services)
const providerProfileComplete = computed(() => {
  if (!user.value) return false
  const p = user.value.providerProfile ?? user.value.provider_profile ?? user.value.provider
  if (!p) return false
  return !!(p.professional_title || p.title || p.bio || (p.services && p.services.length > 0))
})

const recommendedJobs = ref<any[]>([])
const loadingJobRecs = ref(false)

async function loadProviderJobRecommendations() {
  loadingJobRecs.value = true
  try {
    const res = await apiFetch<any>('/jobs?page=1')
    const raw = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : [])
    const openJobs = raw.filter((j: any) => j.status === 'open')
    recommendedJobs.value = openJobs.slice(0, 6)
  } catch {
    recommendedJobs.value = []
  } finally {
    loadingJobRecs.value = false
  }
}

function askAiForJobs() {
  const query = 'Show me top open jobs to bid on'
  window.dispatchEvent(new CustomEvent('skilllink:ai-open', { detail: { query } }))
}

const aiWidget = ref<any>(null)
function askAiForMore() {
  const query = recentJobCategory.value
    ? `Find me the best providers for ${recentJobCategory.value}`
    : 'Who are the best service providers on SkillLink?'
  window.dispatchEvent(new CustomEvent('skilllink:ai-open', { detail: { query } }))
}
</script>

<template>
  <section class="dashboard-page max-w-[1230px] mx-auto px-6 py-14 sm:py-16">
    <div v-if="loading" class="py-16 text-ink/50 dark:text-white/50">Loading your dashboard…</div>
    <template v-else-if="user">

      <!-- ── Welcome / profile overview ── -->
      <div class="dashboard-heading mb-8 sm:mb-10">
        <div>
          <p class="workspace-label">{{ isCustomer ? 'Customer workspace' : 'Provider workspace' }}</p>
          <h1 class="font-display text-[34px] leading-[1.14] sm:text-[42px] font-semibold tracking-[-0.035em] text-ink dark:text-[#F1F5F9]">Welcome back, {{ user.first_name }}.</h1>
          <p class="mt-2 text-[16px] text-ink/65 dark:text-white/65">{{ stats.activeBookings ? `You have ${stats.activeBookings} item${stats.activeBookings === 1 ? '' : 's'} that need${stats.activeBookings === 1 ? 's' : ''} attention.` : (isCustomer ? 'Start a project when you are ready.' : 'Find your next opportunity when you are ready.') }}</p>
        </div>
        <NuxtLink :to="isCustomer ? '/jobs/post' : '/jobs'" class="heading-action">
          {{ isCustomer ? 'Post a job' : 'Find work' }} <span>→</span>
        </NuxtLink>
      </div>

      <!-- Quick stats -->
      <div class="stats-grid grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <!-- Customer: Projects posted -->
        <div v-if="isCustomer" class="stat-card">
          <span class="stat-icon stat-icon--clay">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><path d="M9 11h6M9 15h4"/></svg>
          </span>
          <strong>{{ stats.openJobs }}</strong>
          <p>Projects posted</p>
        </div>
        <!-- Provider: Wallet / Net Earnings -->
        <div v-if="!isCustomer" class="stat-card">
          <span class="stat-icon" style="background:rgba(39,138,129,0.12);color:#278A81">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 11a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/><path d="M22 7V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2"/></svg>
          </span>
          <strong class="text-lg">ETB {{ Math.round(stats.netEarnings ?? 0).toLocaleString() }}</strong>
          <p>Wallet (net earned)</p>
        </div>
        <div class="stat-card">
          <span class="stat-icon stat-icon--teal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>
          </span>
          <strong>{{ stats.activeBookings }}</strong>
          <p>Active orders</p>
        </div>
        <div class="stat-card">
          <span class="stat-icon stat-icon--gold">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>
          </span>
          <strong>{{ stats.awaitingReview }}</strong>
          <p>Awaiting review</p>
        </div>
        <div class="stat-card">
          <span class="stat-icon stat-icon--green">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6"/></svg>
          </span>
          <strong>{{ stats.completed }}</strong>
          <p>Completed</p>
        </div>
      </div>

      <!-- ── Action buttons ── -->
      <div :class="['action-grid mb-12', { 'action-grid--single': !isCustomer }]">
        <NuxtLink v-if="isCustomer" to="/jobs/post" class="primary-cta group">
          <span class="cta-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><path d="M9 11h6M9 15h4"/></svg>
          </span>
          <span class="min-w-0"><strong>Post a new job</strong><small>Get offers from skilled providers</small></span>
          <span class="cta-arrow">→</span>
        </NuxtLink>
        <NuxtLink v-else to="/jobs" class="primary-cta group">
          <span class="cta-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7.5" width="18" height="12" rx="2"/><path d="M8 7.5V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1.5"/><path d="M3 12.5h18"/></svg>
          </span>
          <span class="min-w-0"><strong>Find work</strong><small>Browse open jobs and send offers</small></span>
          <span class="cta-arrow">→</span>
        </NuxtLink>

        <div v-if="isCustomer" class="action-links grid grid-cols-1 gap-3">
          <NuxtLink to="/browse" class="secondary-card group">
            <span class="sc-icon sc-icon--clay">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.8-3.8"/></svg>
            </span>
            <span class="min-w-0"><strong>Browse services</strong><small>Discover verified services across Ethiopia</small></span>
            <span class="sc-arrow">→</span>
          </NuxtLink>
          <!-- Fixed: Explore professionals → /providers (available providers list) -->
          <NuxtLink to="/providers" class="secondary-card group">
            <span class="sc-icon sc-icon--teal">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20c1.4-4 4-6 7.5-6s6.1 2 7.5 6"/></svg>
            </span>
            <span class="min-w-0"><strong>Explore professionals</strong><small>Find trusted experts by skill or rating</small></span>
            <span class="sc-arrow">→</span>
          </NuxtLink>
        </div>
      </div>

      <!-- ── Recommended for you (customer only) ── -->
      <div v-if="isCustomer" class="recommendations-panel mb-12">
        <div class="flex items-start justify-between gap-4 mb-1 flex-wrap">
          <div>
            <h2 class="font-display text-[19px] font-semibold text-ink dark:text-[#F1F5F9]">Recommended for you</h2>
            <p class="text-sm text-ink/50 dark:text-white/50 mt-0.5">{{ recommendationReason }}</p>
          </div>
          <button
            @click="askAiForMore"
            class="shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-full border border-clay/30 text-clay text-xs font-semibold hover:bg-clay/5 transition"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z"/>
            </svg>
            Ask AI for more
          </button>
        </div>

        <div v-if="loadingRecommendations" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
          <div v-for="i in 6" :key="i" class="h-36 rounded-2xl bg-mist/50 dark:bg-mist-dark/50 animate-pulse"></div>
        </div>
        <div v-else-if="!recommendedProviders.length" class="rounded-[20px] border border-dashed border-mist dark:border-white/15 px-6 py-8 text-center text-sm text-ink/50 dark:text-white/50 mt-5">
          No providers to recommend yet — check back once more providers join SkillLink.
        </div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
          <NuxtLink
            v-for="r in recommendedProviders" :key="r.provider.id"
            :to="`/providers/${r.provider.id}`"
            class="recommend-card group"
          >
            <div class="flex items-center gap-1.5 mb-3">
              <span class="text-[10px] font-semibold text-clay/80 bg-clay/8 px-2 py-0.5 rounded-full truncate max-w-full">
                {{ r.why }}
              </span>
            </div>
            <div class="flex items-center gap-3 mb-3">
              <div class="w-10 h-10 rounded-full overflow-hidden bg-clay/10 shrink-0 border border-mist dark:border-white/10">
                <img :src="getProviderAvatar(r.provider)" class="w-full h-full object-cover" alt="" @error="(e) => handleAvatarError(e, r.provider)" />
              </div>
              <div class="min-w-0">
                <p class="font-semibold text-sm text-ink dark:text-[#F1F5F9] truncate group-hover:text-clay transition">{{ r.provider.user?.first_name }} {{ r.provider.user?.last_name }}</p>
                <p class="text-xs text-ink/50 dark:text-white/50 truncate">{{ r.provider.professional_title || r.service.title }}</p>
              </div>
            </div>
            <div class="flex items-center justify-between text-xs text-ink/60 dark:text-white/60">
              <span>★ {{ Number(r.provider.average_rating || 0).toFixed(1) }} · {{ r.provider.completed_jobs ?? 0 }} jobs</span>
              <span class="font-semibold text-ink dark:text-white">ETB {{ Number(r.service.price).toLocaleString() }}{{ r.service.price_type === 'hourly' ? '/hr' : '' }}</span>
            </div>
          </NuxtLink>
        </div>
      </div>

      <!-- ── Active projects / orders ── -->
      

      <!-- Provider: Complete portfolio CTA or job recs -->
      <div v-else class="recommendations-panel mb-12">

        <!-- Portfolio incomplete CTA -->
        <div v-if="!providerProfileComplete" class="portfolio-cta-card mb-6">
          <div class="portfolio-cta-inner">
            <div class="portfolio-cta-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div class="portfolio-cta-body">
              <h2 class="portfolio-cta-title">Complete your portfolio</h2>
              <p class="portfolio-cta-desc">Add your professional title, bio, skills, and first service to start receiving bookings from clients across Ethiopia.</p>
              <div class="portfolio-cta-steps">
                <span class="portfolio-step">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6"/></svg>
                  Add a professional title &amp; bio
                </span>
                <span class="portfolio-step">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6"/></svg>
                  List your first service with pricing
                </span>
                <span class="portfolio-step">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6"/></svg>
                  Upload a profile photo
                </span>
              </div>
            </div>
            <NuxtLink to="/account" class="portfolio-cta-btn">
              Set up portfolio
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </NuxtLink>
          </div>
        </div>

        <!-- Job recommendations (always shown for providers) -->
        <div class="flex items-start justify-between gap-4 mb-4 flex-wrap">
          <div>
            <h2 class="font-display text-[19px] font-semibold text-ink dark:text-[#F1F5F9]">Open jobs for you</h2>
            <p class="text-sm text-ink/50 dark:text-white/50 mt-0.5">Posted client jobs you can bid on right now</p>
          </div>
          <button
            @click="askAiForJobs"
            class="shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-full border border-clay/30 text-clay text-xs font-semibold hover:bg-clay/5 transition"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z"/>
            </svg>
            Ask AI to match jobs
          </button>
        </div>

        <div v-if="loadingJobRecs" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="i in 3" :key="i" class="h-36 rounded-2xl bg-mist/50 dark:bg-mist-dark/50 animate-pulse"></div>
        </div>
        <div v-else-if="!recommendedJobs.length" class="rounded-[20px] border border-dashed border-mist dark:border-white/15 px-6 py-8 text-center text-sm text-ink/50 dark:text-white/50">
          No open jobs right now — check back soon or <NuxtLink to="/jobs" class="text-clay font-semibold hover:underline">browse all jobs</NuxtLink>.
        </div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <NuxtLink
            v-for="job in recommendedJobs"
            :key="job.id"
            :to="`/jobs/${job.id}`"
            class="recommend-card flex flex-col justify-between group"
          >
            <div>
              <div class="flex items-center justify-between gap-2 mb-2">
                <span class="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-clay/10 text-clay dark:bg-white/10 dark:text-[#D4A98A] truncate">
                  {{ job.category?.name || 'General' }}
                </span>
                <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  ETB {{ Number(job.budget ?? 0).toLocaleString() }}
                </span>
              </div>
              <h3 class="font-bold text-ink dark:text-[#F1F5F9] text-sm mb-1 line-clamp-1 group-hover:text-clay transition">{{ job.title }}</h3>
              <p class="text-xs text-ink/60 dark:text-white/60 line-clamp-2 mb-3">{{ job.description }}</p>
            </div>
            <div class="pt-3 border-t border-mist/60 dark:border-white/10 flex items-center justify-between">
              <span class="text-[11px] text-ink/50 dark:text-white/50">📍 {{ job.location || 'Addis Ababa' }}</span>
              <span class="text-xs font-bold text-clay dark:text-[#D4A98A] group-hover:underline">Send offer →</span>
            </div>
          </NuxtLink>
        </div>
      </div>

      <div class="work-queue mb-12">
        <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <p class="workspace-label mb-1">Work queue</p>
            <h2 class="font-display text-[25px] font-semibold text-ink dark:text-[#F1F5F9]">{{ isCustomer ? 'Your projects & orders' : 'Your bookings' }}</h2>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <!-- Show/hide cancelled toggle -->
            <button
              v-if="isCustomer && cancelledCount > 0"
              @click="showCancelled = !showCancelled"
              class="text-xs font-medium text-ink/50 dark:text-white/50 hover:text-clay transition px-3 py-1.5 rounded-full border border-mist dark:border-white/15"
            >
              {{ showCancelled ? `Hide cancelled (${cancelledCount})` : `Show cancelled (${cancelledCount})` }}
            </button>
            <div class="flex gap-1 bg-mist/60 dark:bg-white/5 rounded-full p-1">
              <button v-for="f in ['all', 'active', 'completed']" :key="f" @click="projectFilter = f as any"
                :class="['px-3.5 py-1.5 rounded-full text-xs font-medium capitalize transition', projectFilter === f ? 'bg-white dark:bg-mist-dark text-clay shadow-sm' : 'text-ink/50 dark:text-white/50 hover:text-ink dark:hover:text-white']">
                {{ f }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="!filteredProjects.length" class="getting-started">
          <div class="getting-started-copy">
            <p class="workspace-label mb-2">Your next step</p>
            <h3>{{ isCustomer ? 'Bring your first project to life' : 'Set up your next opportunity' }}</h3>
            <p>{{ isCustomer ? 'Post a request, compare qualified offers, and book with confidence.' : 'Create a service, find suitable jobs, and turn your skills into paid work.' }}</p>
          </div>
          <div class="getting-started-steps">
            <NuxtLink v-if="isCustomer" to="/jobs/post"><span>01</span> Post your request</NuxtLink>
            <NuxtLink v-else to="/provider/services"><span>01</span> List a service</NuxtLink>
            <NuxtLink v-if="isCustomer" to="/browse"><span>02</span> Explore providers</NuxtLink>
            <NuxtLink v-else to="/jobs"><span>02</span> Browse open jobs</NuxtLink>
            <NuxtLink to="/support"><span>03</span> See how SkillLink works</NuxtLink>
          </div>
        </div>
        <div v-else class="rounded-[20px] border border-mist dark:border-white/10 bg-white dark:bg-mist-dark overflow-hidden divide-y divide-mist dark:divide-white/10">
          <div v-for="p in visibleProjects" :key="p.key" class="project-row" :class="{ 'opacity-60': p.isCancelled }">
            <NuxtLink :to="p.viewLink" class="flex items-center gap-4 flex-1 min-w-0">
              <div class="booking-avatar">{{ p.counterpart.charAt(0) || 'S' }}</div>
              <div class="min-w-0 flex-1">
                <p class="font-semibold text-[15px] text-ink dark:text-[#F1F5F9] truncate">{{ p.title }}</p>
                <p class="text-sm text-ink/60 dark:text-white/60 truncate">{{ p.counterpart }}</p>
                <p class="mt-2 text-sm text-ink/70 dark:text-white/70">🗓️ {{ formatDate(p.date) }} <span class="ml-3 font-semibold text-ink dark:text-white">ETB {{ Number(p.amount ?? 0).toLocaleString() }}</span></p>
              </div>
            </NuxtLink>
            <div class="flex flex-col items-end gap-2 shrink-0">
              <span class="status-pill" :class="{ 'status-pill--complete': p.isCompleted, 'status-pill--cancelled': p.isCancelled }">•&nbsp; {{ statusLabel[p.statusRaw] ?? p.statusRaw }}</span>
              <div class="flex gap-2">
                <NuxtLink v-if="p.rehireLink" :to="p.rehireLink" class="row-action">Re-hire</NuxtLink>
                <NuxtLink v-if="p.manageLink" :to="p.manageLink" class="row-action">Manage offers</NuxtLink>
                <NuxtLink :to="p.viewLink" class="row-action row-action--muted">View →</NuxtLink>
              </div>
            </div>
          </div>
        </div>
        <button v-if="filteredProjects.length > 5" @click="showAllProjects = !showAllProjects" class="mt-4 text-sm font-medium text-clay hover:underline">
          {{ showAllProjects ? 'Show fewer ↑' : `Show all ${filteredProjects.length} →` }}
        </button>
      </div>

      <!-- ── Compare Offers (customer: open jobs that have incoming offers) ── -->
      <div v-if="isCustomer && openJobsWithOffers.length" class="mb-10">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="font-display text-[22px] font-semibold text-ink dark:text-[#F1F5F9]">Compare offers</h2>
            <p class="text-sm text-ink/50 dark:text-white/50 mt-0.5">Providers who submitted offers on your open jobs</p>
          </div>
        </div>

        <div v-if="loadingOffers" class="space-y-4">
          <div v-for="i in 2" :key="i" class="h-28 rounded-2xl bg-mist/50 dark:bg-mist-dark/50 animate-pulse"></div>
        </div>

        <div class="space-y-6">
          <div v-for="job in openJobsWithOffers" :key="job.id" class="rounded-[20px] border border-mist dark:border-white/10 bg-white dark:bg-mist-dark overflow-hidden">
            <!-- Job title header -->
            <div class="px-5 py-3 bg-mist/30 dark:bg-white/[0.03] border-b border-mist dark:border-white/10 flex items-center justify-between">
              <div>
                <p class="font-semibold text-sm text-ink dark:text-[#F1F5F9]">{{ job.title }}</p>
                <p class="text-xs text-ink/50 dark:text-white/50 mt-0.5">Budget: ETB {{ Number(job.budget).toLocaleString() }} · {{ offersByJob[job.id]?.length ?? 0 }} offer{{ (offersByJob[job.id]?.length ?? 0) === 1 ? '' : 's' }}</p>
              </div>
              <NuxtLink :to="`/jobs/${job.id}`" class="text-xs font-semibold text-clay hover:underline">View job →</NuxtLink>
            </div>

            <!-- Offers table -->
            <div class="divide-y divide-mist dark:divide-white/10">
              <div
                v-for="offer in offersByJob[job.id]"
                :key="offer.id"
                class="flex items-center gap-4 px-5 py-4 flex-wrap"
              >
                <!-- Provider avatar + name -->
                <NuxtLink :to="`/providers/${offer.provider?.id}`" class="flex items-center gap-3 group flex-1 min-w-0">
                  <div class="w-9 h-9 rounded-full overflow-hidden bg-clay/10 shrink-0 border border-mist dark:border-white/10">
                    <img :src="getProviderAvatar(offer.provider)" class="w-full h-full object-cover" alt="" @error="(e) => handleAvatarError(e, offer.provider)" >
                  </div>
                  <div class="min-w-0">
                    <p class="font-medium text-sm text-ink dark:text-[#F1F5F9] truncate group-hover:text-clay transition">
                      {{ offer.provider?.user?.first_name }} {{ offer.provider?.user?.last_name }}
                    </p>
                    <p class="text-xs text-ink/50 dark:text-white/50">
                      ★ {{ Number(offer.provider?.average_rating || 0).toFixed(1) }} · {{ offer.provider?.completed_jobs ?? 0 }} jobs done
                    </p>
                  </div>
                </NuxtLink>

                <!-- Price + days -->
                <div class="text-right shrink-0">
                  <p class="font-display font-semibold text-clay">ETB {{ Number(offer.proposed_price).toLocaleString() }}</p>
                  <p v-if="offer.estimated_days" class="text-xs text-ink/50 dark:text-white/50">{{ offer.estimated_days }} days</p>
                </div>

                <!-- Actions -->
                <div class="flex items-center gap-2 shrink-0">
                  <NuxtLink
                    :to="`/messages?recipient=${offer.provider?.id}&name=${encodeURIComponent((offer.provider?.user?.first_name || '') + ' ' + (offer.provider?.user?.last_name || ''))}&role=provider&context_type=job&context_id=${job.id}&context_title=${encodeURIComponent(job.title)}&context_amount=${offer.proposed_price}`"
                    class="text-xs font-semibold border border-clay/40 text-clay hover:bg-clay/5 px-3 py-1.5 rounded-full transition"
                  >
                    💬 Negotiate
                  </NuxtLink>
                  <button
                    @click="declineOffer(job.id, offer.id)"
                    :disabled="rejectingOfferId === offer.id"
                    class="text-xs font-semibold border border-mist dark:border-white/15 text-ink/55 dark:text-white/55 hover:border-red-400 hover:text-red-600 disabled:opacity-50 px-3 py-1.5 rounded-full transition"
                  >
                    {{ rejectingOfferId === offer.id ? 'Declining…' : 'Decline' }}
                  </button>
                  <NuxtLink
                    :to="`/jobs/${job.id}`"
                    class="text-xs font-semibold bg-clay hover:bg-clay/90 text-white px-3 py-1.5 rounded-full transition"
                  >
                    Accept →
                  </NuxtLink>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </template>
  </section>
</template>

<style scoped>
.dashboard-page {
  --color-clay: #0F766E;
  --color-ink: #172033;
  position: relative;
}
.dark .dashboard-page {
  --color-clay: #5EEAD4;
}

.dashboard-heading { display: flex; align-items: end; justify-content: space-between; gap: 24px; }
.workspace-label { color: var(--color-clay); font-size: 11px; font-weight: 700; letter-spacing: .11em; text-transform: uppercase; }
.heading-action { display: inline-flex; align-items: center; gap: 12px; white-space: nowrap; border: 1px solid #CBD5E1; border-radius: 10px; padding: 10px 14px; color: var(--color-ink); font-size: 13px; font-weight: 700; background: #fff; transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease; }
.heading-action span { color: var(--color-clay); font-size: 17px; line-height: 1; }
.heading-action:hover { border-color: var(--color-clay); box-shadow: 0 5px 14px rgba(15, 23, 42, .08); transform: translateY(-1px); }
.dark .heading-action { background: var(--color-surface-dark); color: #F1F5F9; border-color: rgba(255,255,255,.14); }

/* ── Quick stats ── */
.stat-card { min-height: 132px; border-radius: 14px; border: 1.5px solid rgba(15, 118, 110, .72); background-color: white; padding: 18px; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; box-shadow: 0 0 0 3px rgba(45, 212, 191, .08), 0 8px 18px rgba(15, 118, 110, .09); transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease; }
.stat-card:hover { transform: translateY(-2px); border-color: #0F766E; box-shadow: 0 0 0 4px rgba(45, 212, 191, .12), 0 14px 26px rgba(15, 118, 110, .14); }
.dark .stat-card { border-color: rgba(94, 234, 212, .65); background-color: var(--color-surface-dark, #172033); }
.dark .stat-card:hover { box-shadow: 0 10px 24px rgba(0, 0, 0, 0.3); }
.stat-icon { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.stat-icon--clay { background-color: #F0FDFA; color: var(--color-clay, #0F766E); }
.stat-icon--teal { background-color: #EFF6FF; color: #2563EB; }
.dark .stat-icon--teal { color: #93C5FD; }
.stat-icon--gold { background-color: rgba(245, 158, 11, 0.14); color: var(--color-gold, #F59E0B); }
.stat-icon--green { background-color: #ECFDF5; color: #059669; }
.dark .stat-icon--green { color: #6EE7B7; }
.stat-card strong { margin-top: auto; font-family: var(--font-display); font-size: 28px; font-weight: 650; line-height: 1; color: var(--color-ink, #181513); }
.dark .stat-card strong { color: #F1F5F9; }
.stat-card p { font-size: 13.5px; color: rgba(0, 0, 0, 0.55); }
.dark .stat-card p { color: rgba(255, 255, 255, 0.55); }

.action-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(270px, .9fr); gap: 16px; }
.action-grid--single { grid-template-columns: 1fr; }
/* ── Primary CTA ── */
.primary-cta { min-height: 176px; border-radius: 18px; background: linear-gradient(115deg, #0F172A 0%, #172554 58%, #0F766E 130%); color: white; padding: 28px 32px; display: flex; align-items: center; gap: 22px; box-shadow: 0 12px 28px rgba(15, 23, 42, 0.2); transition: transform 0.25s ease, box-shadow 0.25s ease; }
.primary-cta:hover { transform: translateY(-3px); box-shadow: 0 18px 36px rgba(15, 23, 42, 0.28); }
.primary-cta .cta-icon { width: 60px; height: 60px; border-radius: 16px; background: rgba(255, 255, 255, 0.2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.primary-cta strong { display: block; font-family: var(--font-display); font-size: 21px; font-weight: 600; margin-bottom: 3px; }
.primary-cta small { display: block; font-size: 14px; color: rgba(255, 255, 255, 0.9); }
.primary-cta .cta-arrow { margin-left: auto; font-size: 28px; line-height: 1; transition: transform 0.25s ease; }
.primary-cta:hover .cta-arrow { transform: translateX(5px); }

/* ── Secondary cards ── */
.action-links { display: flex; flex-direction: column; gap: 12px; }
.secondary-card { flex: 1; border-radius: 14px; border: 1px solid var(--color-mist, #E2E8F0); background-color: white; padding: 16px 18px; display: flex; align-items: center; gap: 14px; transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease; }
.secondary-card:hover { transform: translateY(-2px); box-shadow: 0 10px 22px rgba(15, 23, 42, 0.07); border-color: rgba(15, 118, 110, 0.4); }
.dark .secondary-card { border-color: rgba(255, 255, 255, 0.1); background-color: var(--color-surface-dark, #172033); }
.dark .secondary-card:hover { box-shadow: 0 10px 22px rgba(0, 0, 0, 0.3); }
.sc-icon { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.sc-icon--clay { background-color: #F0FDFA; color: var(--color-clay, #0F766E); }
.sc-icon--teal { background-color: #EFF6FF; color: #2563EB; }
.dark .sc-icon--teal { color: #93C5FD; }
.secondary-card strong { display: block; font-size: 15px; font-weight: 600; color: var(--color-ink, #181513); }
.dark .secondary-card strong { color: #F1F5F9; }
.secondary-card small { display: block; margin-top: 2px; font-size: 13px; color: rgba(0, 0, 0, 0.55); }
.dark .secondary-card small { color: rgba(255, 255, 255, 0.55); }
.sc-arrow { margin-left: auto; color: rgba(0, 0, 0, 0.3); transition: transform 0.2s ease, color 0.2s ease; }
.dark .sc-arrow { color: rgba(255, 255, 255, 0.3); }
.secondary-card:hover .sc-arrow { transform: translateX(3px); color: var(--color-clay, #E15C27); }

/* ── Recommendations ── */
.recommend-card { border-radius: 16px; border: 1px solid var(--color-mist, #E2E8F0); background-color: white; padding: 16px; transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease; }
.recommend-card:hover { transform: translateY(-3px); box-shadow: 0 10px 22px rgba(15, 23, 42, 0.07); border-color: rgba(15, 118, 110, 0.4); }
.dark .recommend-card { border-color: rgba(255, 255, 255, 0.1); background-color: var(--color-surface-dark, #172033); }
.dark .recommend-card:hover { box-shadow: 0 10px 22px rgba(0, 0, 0, 0.3); }

.recommendations-panel { border-top: 1px solid var(--color-mist); padding-top: 32px; }
.dark .recommendations-panel { border-color: rgba(255,255,255,.1); }
.work-queue { border-top: 1px solid var(--color-mist); padding-top: 32px; }
.dark .work-queue { border-color: rgba(255,255,255,.1); }

.getting-started { min-height: 218px; overflow: hidden; border-radius: 18px; background: #fff; border: 1px solid var(--color-mist); padding: 30px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(240px, .82fr); gap: 32px; align-items: center; }
.getting-started-copy h3 { color: var(--color-ink); font-family: var(--font-display); font-size: 22px; font-weight: 650; letter-spacing: -.02em; }
.getting-started-copy p:not(.workspace-label) { max-width: 510px; color: rgba(23, 32, 51, .64); margin-top: 8px; font-size: 14px; line-height: 1.65; }
.getting-started-steps { display: grid; gap: 8px; }
.getting-started-steps a { display: flex; align-items: center; gap: 12px; min-height: 42px; border-radius: 10px; padding: 8px 10px; background: #F8FAFC; color: var(--color-ink); font-size: 13px; font-weight: 650; transition: background-color .2s ease, color .2s ease, transform .2s ease; }
.getting-started-steps a span { color: var(--color-clay); font-size: 10px; font-weight: 800; letter-spacing: .08em; }
.getting-started-steps a:hover { background: #F0FDFA; color: var(--color-clay); transform: translateX(3px); }
.dark .getting-started { background: var(--color-surface-dark); border-color: rgba(255,255,255,.1); }
.dark .getting-started-copy h3 { color: #F1F5F9; }
.dark .getting-started-copy p:not(.workspace-label) { color: rgba(255,255,255,.62); }
.dark .getting-started-steps a { background: rgba(255,255,255,.06); color: #F1F5F9; }
.dark .getting-started-steps a:hover { background: rgba(94,234,212,.12); color: #5EEAD4; }

/* ── Projects list ── */
.project-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px 24px; transition: background-color 0.2s ease; flex-wrap: wrap; }
.project-row:hover { background-color: rgba(15, 118, 110, 0.045); }
.dark .project-row:hover { background-color: rgba(255, 255, 255, 0.05); }
.booking-avatar { height: 52px; width: 52px; flex-shrink: 0; border-radius: 14px; background: linear-gradient(135deg, #0F766E, #0F172A); color: white; display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-size: 18px; }
.status-pill { flex-shrink: 0; border-radius: 9999px; background-color: #EFF6FF; padding: 6px 16px; font-size: 12px; font-weight: 600; color: #2563EB; white-space: nowrap; }
.dark .status-pill { color: #93C5FD; }
.status-pill--complete { background-color: #ECFDF5; color: #047857; }
.dark .status-pill--complete { color: #6EE7B7; }
.status-pill--cancelled { background-color: #EAE5DF; color: rgba(0,0,0,0.4); }
.dark .status-pill--cancelled { background-color: rgba(255,255,255,0.08); color: rgba(255,255,255,0.4); }
.row-action { font-size: 12px; font-weight: 600; color: var(--color-clay, #0F766E); white-space: nowrap; transition: opacity 0.2s ease; }
.row-action:hover { text-decoration: underline; }
.row-action--muted { color: rgba(0, 0, 0, 0.5); }
.dark .row-action--muted { color: rgba(255, 255, 255, 0.5); }

@media (max-width: 760px) {
  .dashboard-heading { align-items: start; flex-direction: column; gap: 16px; }
  .heading-action { width: 100%; justify-content: space-between; }
  .action-grid { grid-template-columns: 1fr; }
  .primary-cta { min-height: 150px; padding: 22px; }
  .primary-cta .cta-icon { width: 48px; height: 48px; }
  .primary-cta strong { font-size: 18px; }
  .stat-card { min-height: 120px; padding: 16px; }
  .stat-card strong { font-size: 24px; }
  .getting-started { grid-template-columns: 1fr; gap: 22px; padding: 24px; }
}

/* ── Portfolio CTA Card ── */
.portfolio-cta-card {
  border-radius: 20px;
  background: linear-gradient(115deg, #0F172A 0%, #1e3a5f 55%, #0F766E 130%);
  padding: 2px;
}
.portfolio-cta-inner {
  border-radius: 19px;
  background: linear-gradient(115deg, #0f1d32 0%, #14304e 55%, #0a5a51 130%);
  padding: 28px 32px;
  display: flex;
  align-items: flex-start;
  gap: 22px;
  flex-wrap: wrap;
}
.portfolio-cta-icon {
  width: 60px;
  height: 60px;
  border-radius: 16px;
  background: rgba(255,255,255,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
}
.portfolio-cta-body {
  flex: 1;
  min-width: 220px;
}
.portfolio-cta-title {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 650;
  color: white;
  margin-bottom: 6px;
}
.portfolio-cta-desc {
  font-size: 13.5px;
  color: rgba(255,255,255,0.75);
  line-height: 1.6;
  margin-bottom: 14px;
}
.portfolio-cta-steps {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.portfolio-step {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255,255,255,0.85);
  background: rgba(255,255,255,0.08);
  border-radius: 999px;
  padding: 4px 10px;
}
.portfolio-step svg { color: #5EEAD4; flex-shrink: 0; }
.portfolio-cta-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  align-self: center;
  background: white;
  color: #0F172A;
  font-size: 13px;
  font-weight: 700;
  padding: 11px 20px;
  border-radius: 12px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  text-decoration: none;
  white-space: nowrap;
}
.portfolio-cta-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.25); }

</style>
