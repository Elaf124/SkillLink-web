<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()
const { apiFetch, token } = useApi()
const goBack = useGoBack('/browse')
const { getProviderAvatar, handleAvatarError, resolveMediaUrl } = useProviderAvatar()
const provider = ref(null)
const reviews = ref([])
const loading = ref(true)
const notFound = ref(false)
const activeTab = ref('services')

const approvedCertifications = computed(() => {
  return (provider.value?.verifications ?? []).filter((v: any) => v.document_category === 'certification' && v.verification_status === 'approved')
})
const showInviteModal = ref(false)

async function load() {
  try {
    const res = await apiFetch(`/providers/${route.params.id}`)
    provider.value = res.data ?? res
    reviews.value = provider.value?.reviews ?? res.reviews ?? []
  } catch (err) {
    notFound.value = true
  } finally {
    loading.value = false
  }
}
onMounted(load)

function priceLabel(service: any) {
  const amount = Number(service.price).toLocaleString()
  return service.price_type === 'hourly' ? `ETB ${amount}/hr` : `ETB ${amount}`
}

const uniqueServices = computed(() => {
  if (!provider.value?.services) return []
  const seen = new Set<string>()
  return provider.value.services.filter((s: any) => {
    const key = (s.title || '').trim().toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
})
// Booking modal state
const showBookingModal = ref(false)
const bookingServiceId = ref<number | null>(null)
const bookingServiceTitle = ref('')
const bookingServicePrice = ref(0)
const bookError = ref('')
const bookingForm = ref({
  start_date: '',
  end_date: '',
  start_time: '',
  end_time: '',
  notes: '',
})
const bookingLoading = ref(false)

function openBookingModal(service: any) {
  if (!token.value) { router.push('/login'); return }
  bookingServiceId.value = service.id
  bookingServiceTitle.value = service.title
  bookingServicePrice.value = Number(service.price)
  bookingForm.value = { start_date: '', end_date: '', start_time: '', end_time: '', notes: '' }
  bookError.value = ''
  showBookingModal.value = true
}

async function confirmBooking() {
  if (!bookingForm.value.start_date) {
    bookError.value = 'Please select a preferred start date.'
    return
  }
  bookError.value = ''
  bookingLoading.value = true
  try {
    const res = await apiFetch(`/services/${bookingServiceId.value}/book`, {
      method: 'POST',
      body: {
        preferred_start_date: bookingForm.value.start_date,
        preferred_end_date: bookingForm.value.end_date || null,
        preferred_start_time: bookingForm.value.start_time || null,
        preferred_end_time: bookingForm.value.end_time || null,
        notes: bookingForm.value.notes || null,
      }
    })
    showBookingModal.value = false
    router.push(`/bookings/${res.data.id}`)
  } catch (err: any) {
    bookError.value = err?.data?.message || 'Unable to book this service right now.'
  } finally {
    bookingLoading.value = false
  }
}

const proficiencyLabel = { beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert' }

const lowestPrice = computed(() => {
  if (!provider.value?.services?.length) return 800
  return provider.value.services.reduce((min, s) => Math.min(min, Number(s.price)), Infinity)
})

// Tier pricing calculation based on provider's base price
const tiers = computed(() => {
  const base = lowestPrice.value || 1000
  return {
    basic: {
      name: 'Basic Package',
      price: base,
      delivery: '1 Day Delivery',
      revisions: '1 Revision Included',
      description: 'Standard diagnostic, inspection, or single minor service task with full documentation.',
      features: ['Preliminary diagnosis & check', 'Standard labor up to 2 hours', 'Safety verification']
    },
    standard: {
      name: 'Standard Package (Recommended)',
      price: Math.round(base * 1.8),
      delivery: '2 Days Delivery',
      revisions: '3 Revisions Included',
      description: 'Complete end-to-end service, standard replacement/setup, and post-service testing.',
      features: ['Full diagnostic & maintenance', 'Complete labor & installation', '7-day service warranty', 'Priority chat support']
    },
    premium: {
      name: 'Premium Pro Package',
      price: Math.round(base * 3.2),
      delivery: '3 Days Delivery',
      revisions: 'Unlimited Revisions',
      description: 'Comprehensive top-tier overhaul, premium quality parts recommendation, and 30-day warranty.',
      features: ['Everything in Standard', '30-day complete warranty', 'Expedited same-day response', 'Full follow-up inspection']
    }
  }
})

// Availability comes from the provider_availability schedule returned by the API.
// No weekday marked open → treated as not currently accepting work.
// No schedule set at all → assume available (provider just hasn't configured hours).
const isAvailable = computed(() => {
  if (!provider.value) return true
  const slots = provider.value.availability ?? []
  if (slots.length === 0) return true
  return slots.some(s => s.is_available)
})

function getSellerBadge(p) {
  const jobs = p.completed_jobs || 0
  const rating = Number(p.average_rating || 0)
  if (jobs >= 15 && rating >= 4.8) return { label: 'Top Rated Pro', class: 'badge-pro' }
  if (jobs >= 5 && rating >= 4.5) return { label: 'Level 2 Seller', class: 'bg-slate-900 text-white dark:bg-slate-700' }
  return { label: 'Verified Talent', class: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-500/20' }
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-6 py-10">
    <div v-if="loading" class="flex items-center justify-center py-20 text-slate-400">
      <div class="animate-spin text-3xl mr-3">⏳</div>
      <span>Loading provider profile…</span>
    </div>

    <div v-else-if="notFound" class="border border-dashed border-slate-300 dark:border-slate-800 rounded-3xl p-16 text-center bg-white dark:bg-slate-900">
      <p class="font-display text-2xl font-bold text-slate-900 dark:text-white mb-2">Provider Profile Not Found</p>
      <p class="text-slate-500 dark:text-slate-400 mb-6">This provider may not be verified yet, or the link has expired.</p>
      <button @click="goBack" class="px-6 py-2.5 rounded-xl bg-clay text-white font-bold hover:bg-clay-dark transition">
        ← Back to Browse Services
      </button>
    </div>

    <template v-else-if="provider">
      <!-- Back Navigation & Breadcrumb -->
      <div class="flex items-center justify-between mb-6 text-xs text-slate-500 dark:text-slate-400">
        <button @click="goBack" class="inline-flex items-center gap-1 hover:text-emerald-600 dark:hover:text-emerald-400 transition font-semibold">
          ← Back to Search Results
        </button>
        <span class="hidden sm:inline">Verified Escrow Partner</span>
      </div>
      <!-- Profile Hero — 100% Fully Responsive LinkedIn Style -->
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm mb-10 overflow-visible">

        <!-- ① Cover Banner -->
        <div class="h-36 sm:h-48 md:h-56 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 rounded-t-3xl relative overflow-hidden">
          <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.25),transparent_70%)]"></div>
          <!-- Badge overlay inside banner top-right -->
          <div class="absolute top-4 right-4 sm:right-6 flex items-center gap-2">
            <span :class="getSellerBadge(provider).class" class="text-xs px-3 py-1 rounded-full font-bold shadow-md">
              {{ getSellerBadge(provider).label }}
            </span>
          </div>
        </div>

        <!-- ② Identity Row & Actions (Flexbox in normal flow — ZERO OVERLAPPING on any screen) -->
        <div class="px-5 sm:px-8 md:px-10 pb-8">

          <!-- Row 1: Avatar on left (pops up into banner) + Action buttons on right -->
          <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-16 md:-mt-20 mb-5">

            <!-- Avatar: in normal flow with negative margin so it cannot collide with text -->
            <div class="relative shrink-0 self-start sm:self-auto">
              <div class="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-2xl ring-4 ring-white dark:ring-slate-900 bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-extrabold text-3xl shadow-xl overflow-hidden">
                <img :src="getProviderAvatar(provider)" class="w-full h-full object-cover" alt="" @error="(e) => handleAvatarError(e, provider)" />
              </div>
              <span class="absolute -bottom-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center ring-2 ring-white dark:ring-slate-900 font-bold shadow-md z-10" title="Admin Verified">&#10003;</span>
            </div>

            <!-- Action buttons: cleanly sits on the right, wraps naturally on mobile -->
            <div class="flex items-center gap-2 sm:gap-3 flex-wrap">
              <button
                @click="showInviteModal = true"
                class="px-4 py-2.5 rounded-xl bg-clay hover:bg-clay-dark text-white font-bold text-xs sm:text-sm transition flex items-center gap-1.5 shadow-md shadow-clay/25"
              >
                <span>👔</span> Invite to Job
              </button>
              <NuxtLink
                :to="`/messages?recipient=${provider.id}&name=${encodeURIComponent(provider.user?.first_name + ' ' + provider.user?.last_name)}&role=provider&context_type=service&context_title=${encodeURIComponent(provider.professional_title || 'Service Inquiry')}&context_amount=${lowestPrice || ''}`"
                class="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 font-bold text-xs sm:text-sm transition flex items-center gap-2 bg-white dark:bg-slate-900"
              >
                <span>💬</span> Message &amp; Negotiate
              </NuxtLink>
              <a
                v-if="isAvailable"
                href="#pricing-tiers"
                class="px-5 py-2.5 rounded-xl bg-clay hover:bg-clay-dark text-white font-extrabold text-xs sm:text-sm transition shadow-md shadow-clay/25 flex items-center gap-1.5"
              >
                <span>📋</span> Book Service
              </a>
            </div>
          </div>

          <!-- Row 2: Name, Professional Title, Availability, Location (Full width below avatar, never clipped) -->
          <div class="space-y-1.5 mb-6">
            <div class="flex items-center gap-2.5 flex-wrap">
              <h1 class="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white leading-tight">
                {{ provider.user.first_name }} {{ provider.user.last_name }}
              </h1>
              <span
                :class="[
                  'inline-flex items-center gap-1.5 text-xs font-bold px-3 py-0.5 rounded-full border',
                  isAvailable
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                    : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800'
                ]"
              >
                <span class="w-2 h-2 rounded-full" :class="isAvailable ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'"></span>
                {{ isAvailable ? 'Available Now' : 'Currently Busy' }}
              </span>
            </div>
            <p class="text-sm sm:text-base font-semibold text-slate-600 dark:text-slate-300">
              {{ provider.professional_title || 'Certified Professional Service Provider' }}
            </p>
            <p class="text-xs text-slate-400 flex items-center gap-1.5">
              <span>🌍</span> Addis Ababa, Ethiopia
            </p>
          </div>

          <!-- Trust & Stats Metric Bar -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300">
            <div class="flex items-center gap-3">
              <span class="text-2xl">⭐</span>
              <div>
                <p class="font-display font-extrabold text-base text-slate-900 dark:text-white">
                  {{ Number(provider.average_rating || 5.0).toFixed(1) }} / 5.0
                </p>
                <p class="text-xs text-slate-400">{{ reviews.length }} Customer Reviews</p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-2xl">🏆</span>
              <div>
                <p class="font-display font-extrabold text-base text-slate-900 dark:text-white">
                  {{ provider.completed_jobs || 0 }} Jobs
                </p>
                <p class="text-xs text-slate-400">100% Completion Rate</p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-2xl">⚡</span>
              <div>
                <p class="font-display font-extrabold text-base text-slate-900 dark:text-white">&lt; 1 Hour</p>
                <p class="text-xs text-slate-400">Average Response Time</p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-2xl">🛡️</span>
              <div>
                <p class="font-display font-extrabold text-base text-emerald-600 dark:text-emerald-400">ID Verified</p>
                <p class="text-xs text-slate-400">Escrow Payment Protection</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Main Profile Grid ── -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <!-- Left Content Area (2 Cols) -->
        <div class="lg:col-span-2 space-y-10">
          <!-- Tab Navigation -->
          <div class="flex items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-2 text-sm font-bold overflow-x-auto">
            <button
              @click="activeTab = 'services'"
              :class="activeTab === 'services' ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500 pb-2' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white pb-2'"
            >
              Services & Packages
            </button>
            <button
              @click="activeTab = 'about'"
              :class="activeTab === 'about' ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500 pb-2' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white pb-2'"
            >
              About & Credentials
            </button>
            <button
              @click="activeTab = 'portfolio'"
              :class="activeTab === 'portfolio' ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500 pb-2' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white pb-2'"
            >
              Portfolio ({{ provider.portfolio?.length || 0 }})
            </button>
            <button
              @click="activeTab = 'reviews'"
              :class="activeTab === 'reviews' ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500 pb-2' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white pb-2'"
            >
              Customer Reviews ({{ reviews.length }})
            </button>
          </div>

          <!-- Tab 1: Services Catalog & Direct Booking -->
          <div v-show="activeTab === 'services'" class="space-y-6">
            <div class="flex items-center justify-between">
              <h2 class="font-display text-xl font-bold text-slate-900 dark:text-white">
                Available Service Offerings
              </h2>
              <span class="text-xs text-slate-400">All services backed by Escrow Guarantee</span>
            </div>

            <p v-if="bookError" class="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs font-semibold">
              {{ bookError }}
            </p>

            <div v-if="!uniqueServices.length" class="p-8 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl text-center text-slate-400 text-sm">
              No specific catalog services listed yet. You can still message this provider for a custom job offer!
            </div>

            <div v-else class="space-y-4">
              <div
                v-for="service in uniqueServices"
                :key="service.id"
                class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 card-hover-lift"
              >
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      {{ service.category?.name || 'Service' }}
                    </span>
                    <span class="text-xs text-slate-400">· {{ service.price_type === 'hourly' ? 'Hourly Rate' : 'Fixed Price' }}</span>
                  </div>
                  <h3 class="font-display font-bold text-base text-slate-900 dark:text-white mb-1">
                    {{ service.title }}
                  </h3>
                  <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
                    {{ service.description }}
                  </p>
                  <p class="font-display font-extrabold text-lg text-emerald-600 dark:text-emerald-400">
                    {{ priceLabel(service) }}
                  </p>
                </div>

              <!-- service card book button → opens modal -->
              <div class="flex sm:flex-col items-center gap-2 shrink-0">
                <button
                  @click="openBookingModal(service)"
                  :disabled="!isAvailable"
                  :class="[
                    'w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer',
                    isAvailable
                      ? 'bg-clay hover:bg-clay-dark text-white shadow-md shadow-clay/20'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  ]"
                >
                  {{ isAvailable ? 'Book This Service' : 'Unavailable' }}
                </button>
                  <NuxtLink
                    :to="`/messages?recipient=${provider.id}&name=${encodeURIComponent(provider.user?.first_name + ' ' + provider.user?.last_name)}&role=provider&context_type=service&context_title=${encodeURIComponent(service.title)}&context_amount=${service.price}`"
                    class="text-xs text-slate-500 hover:text-emerald-500 font-semibold"
                  >
                    Inquire first →
                  </NuxtLink>
                </div>
              </div>
            </div>
          </div>

          <!-- Tab 2: About & Credentials (Experience, Education, Certifications) -->
          <div v-show="activeTab === 'about'" class="space-y-8">
            <!-- Bio -->
            <div>
              <h2 class="font-display text-xl font-bold text-slate-900 dark:text-white mb-3">About the Specialist</h2>
              <p class="text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                {{ provider.bio || 'This provider has verified qualifications and offers expert services across Ethiopia.' }}
              </p>
            </div>

            <!-- Skills -->
            <div v-if="provider.skills?.length">
              <h2 class="font-display text-xl font-bold text-slate-900 dark:text-white mb-3">Verified Skills & Tools</h2>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="skill in provider.skills"
                  :key="skill.id"
                  class="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 px-3.5 py-1.5 rounded-xl font-medium flex items-center gap-1.5"
                >
                  <span class="text-emerald-500 font-bold">✓</span> {{ skill.skill_name }}
                  <span class="text-slate-400">({{ proficiencyLabel[skill.pivot?.proficiency_level] || 'Pro' }})</span>
                </span>
              </div>
            </div>

            <!-- Work Experience Timeline -->
            <div v-if="provider.experience?.length" class="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
              <div class="flex items-center gap-2">
                <span class="text-xl">💼</span>
                <h2 class="font-display text-xl font-bold text-slate-900 dark:text-white">Work Experience</h2>
              </div>
              <div class="space-y-3">
                <div
                  v-for="(exp, idx) in provider.experience"
                  :key="idx"
                  class="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-2xs"
                >
                  <div class="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <h3 class="font-bold text-slate-900 dark:text-white text-base">{{ exp.role }}</h3>
                      <p class="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-0.5 flex items-center gap-1.5">
                        <span>🏢</span> {{ exp.company }}
                      </p>
                    </div>
                    <span v-if="exp.period" class="text-xs px-2.5 py-1 rounded-full bg-clay/10 text-clay dark:bg-[#D4A98A]/15 dark:text-[#D4A98A] font-semibold">
                      🗓️ {{ exp.period }}
                    </span>
                  </div>
                  <p v-if="exp.description" class="text-xs text-slate-600 dark:text-slate-400 mt-2.5 leading-relaxed whitespace-pre-line">
                    {{ exp.description }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Education -->
            <div v-if="provider.education?.length" class="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
              <div class="flex items-center gap-2">
                <span class="text-xl">🎓</span>
                <h2 class="font-display text-xl font-bold text-slate-900 dark:text-white">Education & Qualifications</h2>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  v-for="(edu, idx) in provider.education"
                  :key="idx"
                  class="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between"
                >
                  <div>
                    <div class="flex items-start justify-between gap-2 mb-1.5">
                      <h3 class="font-bold text-slate-900 dark:text-white text-sm line-clamp-2">{{ edu.qualification }}</h3>
                      <span v-if="edu.year" class="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold shrink-0">
                        {{ edu.year }}
                      </span>
                    </div>
                    <p class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <span>🏫</span> {{ edu.institution }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Verified Certifications & Trade Licenses -->
            <div class="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
              <div class="flex items-center justify-between flex-wrap gap-2">
                <div class="flex items-center gap-2">
                  <span class="text-xl">📜</span>
                  <h2 class="font-display text-xl font-bold text-slate-900 dark:text-white">Verified Certifications & Licenses</h2>
                </div>
                <span v-if="approvedCertifications.length" class="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <span>✓</span> Verified by Platform
                </span>
              </div>

              <!-- When certifications exist -->
              <div v-if="approvedCertifications.length" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  v-for="cert in approvedCertifications"
                  :key="cert.id"
                  class="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 shadow-2xs flex flex-col justify-between"
                >
                  <div>
                    <div class="flex items-start justify-between gap-2 mb-1.5">
                      <h3 class="font-bold text-slate-900 dark:text-white text-sm">{{ cert.document_name }}</h3>
                      <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold tracking-wider uppercase shrink-0">
                        Verified
                      </span>
                    </div>
                    <p v-if="cert.issuing_organization" class="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1">
                      <span>🏛️</span> {{ cert.issuing_organization }}
                    </p>
                    <p v-if="cert.issue_date" class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      Issued: {{ new Date(cert.issue_date).toLocaleDateString() }}
                    </p>
                  </div>
                  <div v-if="cert.file_url || cert.credential_url" class="mt-3 pt-2.5 border-t border-emerald-200/60 dark:border-emerald-800/40">
                    <a
                      :href="resolveMediaUrl(cert.file_url || cert.credential_url)"
                      target="_blank"
                      rel="noopener"
                      class="text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline inline-flex items-center gap-1"
                    >
                      <span>🔍</span> View Verified Credential Document →
                    </a>
                  </div>
                </div>
              </div>

              <!-- When no certificate is present -->
              <div v-else class="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-1.5">
                <span class="text-2xl block mb-1">📜</span>
                <p class="font-bold text-sm text-slate-700 dark:text-slate-300">No certificate</p>
                <p class="text-xs text-slate-400 max-w-sm mx-auto">This provider has not uploaded or verified any professional trade certificates or licenses yet.</p>
              </div>
            </div>
          </div>

          <!-- Tab 3: Portfolio -->
          <div v-show="activeTab === 'portfolio'" class="space-y-6">
            <h2 class="font-display text-xl font-bold text-slate-900 dark:text-white">Past Work & Portfolio</h2>
            <div v-if="!provider.portfolio?.length" class="p-8 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl text-center text-slate-400 text-sm">
              No visual portfolio items uploaded yet.
            </div>
            <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                v-for="item in provider.portfolio"
                :key="item.id"
                class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden card-hover-lift"
              >
                <img v-if="item.image_url" :src="resolveMediaUrl(item.image_url)" :alt="item.title" class="w-full h-44 object-cover" />
                <div class="p-4">
                  <h3 class="font-display font-bold text-sm text-slate-900 dark:text-white mb-1">{{ item.title }}</h3>
                  <p v-if="item.description" class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{{ item.description }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Tab 4: Reviews -->
          <div v-show="activeTab === 'reviews'" class="space-y-6">
            <div class="flex items-center justify-between">
              <h2 class="font-display text-xl font-bold text-slate-900 dark:text-white">Client Reviews & Testimonials</h2>
              <div class="flex items-center gap-1.5 text-sm font-bold text-amber-500">
                <span>★ {{ Number(provider.average_rating || 5.0).toFixed(1) }}</span>
                <span class="text-slate-400">({{ reviews.length }} verified reviews)</span>
              </div>
            </div>

            <div v-if="!reviews.length" class="p-8 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl text-center text-slate-400 text-sm">
              No public reviews submitted yet. Completed jobs will show verified testimonials here.
            </div>

            <div v-else class="space-y-4">
              <div
                v-for="review in reviews"
                :key="review.id"
                class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5"
              >
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300">
                      {{ review.customer?.first_name?.[0] || 'C' }}
                    </div>
                    <div>
                      <p class="text-xs font-bold text-slate-900 dark:text-white">
                        {{ review.customer?.first_name }} {{ review.customer?.last_name?.[0] }}.
                      </p>
                      <span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">✓ Verified Transaction</span>
                    </div>
                  </div>
                  <span class="text-amber-400 text-xs font-bold">★ {{ review.overall_rating }}.0</span>
                </div>
                <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{{ review.comment }}</p>
                <div v-if="review.provider_response" class="mt-3 pl-3 border-l-2 border-emerald-500 text-xs text-slate-500 dark:text-slate-400 italic">
                  <strong>Provider Response:</strong> {{ review.provider_response }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Right Sticky Column: Contact + Escrow (clean, no calculated tiers) ── -->
        <div class="space-y-6">
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl sticky top-24">
            <!-- Starting price -->
            <div class="mb-6">
              <p class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Starting from</p>
              <p class="font-display font-extrabold text-3xl text-emerald-600 dark:text-emerald-400">
                {{ lowestPrice.toLocaleString() }} <span class="text-base font-normal text-slate-400">ETB</span>
              </p>
              <p class="text-xs text-slate-400 mt-1">Exact price depends on scope. Message to get a custom quote.</p>
            </div>

            <!-- Book CTA -->
            <div class="space-y-2">
              <button
                v-if="isAvailable && provider.services?.length"
                @click="openBookingModal(provider.services[0])"
                class="w-full py-3.5 rounded-xl bg-clay hover:bg-clay-dark text-white font-extrabold text-sm transition shadow-md shadow-clay/25 flex items-center justify-center gap-2"
              >
                <span>⚡</span> Book Now
              </button>
              <button
                v-else-if="!isAvailable"
                disabled
                class="w-full py-3.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-400 font-bold text-sm cursor-not-allowed"
              >
                Provider Currently Busy
              </button>

              <NuxtLink
                :to="`/messages?recipient=${provider.id}&name=${encodeURIComponent(provider.user?.first_name + ' ' + provider.user?.last_name)}&role=provider&context_type=service&context_title=${encodeURIComponent(provider.professional_title || 'Service Inquiry')}&context_amount=${lowestPrice}`"
                class="w-full py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 font-bold text-xs text-center block transition"
              >
                💬 Contact / Custom Quote
              </NuxtLink>
            </div>

            <!-- Payment Protection Escrow Badge -->
            <div class="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 flex items-start gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span class="text-emerald-500 text-base shrink-0">🛡️</span>
              <div>
                <p class="font-bold text-slate-800 dark:text-slate-200 mb-0.5">Escrow Payment Protection</p>
                <p class="leading-relaxed text-[11px]">Funds are safely held until you inspect and approve the completed service.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>

  <!-- ── Booking Modal ── -->
  <Teleport to="body">
    <div
      v-if="showBookingModal"
      class="fixed inset-0 z-[200] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      @click.self="showBookingModal = false"
    >
      <div class="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-8">
        <div class="flex items-start justify-between mb-6">
          <div>
            <p class="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Booking Request</p>
            <h2 class="font-display text-xl font-bold text-slate-900 dark:text-white">{{ bookingServiceTitle }}</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">ETB {{ bookingServicePrice.toLocaleString() }}</p>
          </div>
          <button
            @click="showBookingModal = false"
            class="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition text-lg"
          >×</button>
        </div>

        <div class="space-y-4">
          <!-- Start date (required) -->
          <div>
            <label class="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              Preferred Start Date <span class="text-emerald-500">*</span>
            </label>
            <input
              v-model="bookingForm.start_date" type="date"
              :min="new Date().toISOString().split('T')[0]"
              class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
            />
          </div>

          <!-- End date (optional) -->
          <div>
            <label class="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              Preferred End Date <span class="text-xs font-normal text-slate-400">(optional)</span>
            </label>
            <input
              v-model="bookingForm.end_date" type="date"
              :min="bookingForm.start_date || new Date().toISOString().split('T')[0]"
              class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
            />
          </div>

          <!-- Start/end times -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                Start Time <span class="text-xs font-normal text-slate-400">(optional)</span>
              </label>
              <input
                v-model="bookingForm.start_time" type="time"
                class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
              />
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                End Time <span class="text-xs font-normal text-slate-400">(optional)</span>
              </label>
              <input
                v-model="bookingForm.end_time" type="time"
                class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
              />
            </div>
          </div>

          <!-- Notes -->
          <div>
            <label class="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              Notes / Special Instructions <span class="text-xs font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              v-model="bookingForm.notes" rows="2"
              placeholder="Any specific requirements or instructions for the provider..."
              class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition resize-none"
            ></textarea>
          </div>

          <p v-if="bookError" class="text-red-600 dark:text-red-400 text-xs font-semibold">⚠️ {{ bookError }}</p>

          <button
            @click="confirmBooking"
            :disabled="bookingLoading || !bookingForm.start_date"
            class="w-full py-3.5 rounded-xl bg-clay hover:bg-clay-dark disabled:opacity-50 text-white font-extrabold text-sm transition shadow-md shadow-clay/25 flex items-center justify-center gap-2"
          >
            <span v-if="bookingLoading">⏳ Processing…</span>
            <span v-else>⚡ Confirm Booking &mdash; ETB {{ bookingServicePrice.toLocaleString() }}</span>
          </button>

          <p class="text-[11px] text-slate-400 text-center">🛡️ Payment held in escrow until service is completed and approved.</p>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Invite to Job Modal -->
  <InviteToJobModal
    :is-open="showInviteModal"
    :provider="provider"
    @close="showInviteModal = false"
  />
</template>

<style scoped>
/* The portrait overlaps the cover; the identity copy begins below it on the light surface. */
.profile-identity { margin-top: 0; padding-top: 1.5rem; }
.profile-avatar { margin-top: -4rem; }
.profile-name { padding-top: 2.5rem; }

@media (min-width: 640px) {
  .profile-identity { margin-top: 0; padding-top: 1.75rem; }
  .profile-avatar { margin-top: -5rem; }
  .profile-name { padding-top: 3.25rem; }
}

@media (max-width: 639px) {
  .profile-identity { margin-top: 0; padding-top: 1.25rem; }
  .profile-avatar { margin-top: -3.75rem; }
  .profile-name { padding-top: 2.75rem; }
}
</style>
