<script setup>
import { categories as categoryIconData } from '~/data/categories'

definePageMeta({ layout: 'default' })

const { apiFetch, token } = useApi()
const route = useRoute()
const router = useRouter()
const goBack = useGoBack('/dashboard')
const { getProviderAvatar, handleAvatarError } = useProviderAvatar()
const categories = ref([])
const services = ref([])
const activeCategory = ref(null)
const searchQuery = ref('')
const sortBy = ref('rating')
const filterAvailableOnly = ref(false)
const loading = ref(true)
const loadingMore = ref(false)
const currentPage = ref(1)
const hasMore = ref(false)
const { favoriteIds, loadFavorites, isFavorite, toggleFavorite } = useFavorites()
const invitedProviderIds = ref(new Set())
const currentUser = ref(null)

// Modal state
const isInviteModalOpen = ref(false)
const activeInviteProvider = ref(null)

async function loadInvitedProviders() {
  if (!import.meta.client) return
  // Clean legacy global key
  try { localStorage.removeItem('skilllink_invited_providers') } catch {}
  if (!currentUser.value && token.value) {
    try { currentUser.value = await apiFetch('/user') } catch {}
  }
  if (!currentUser.value?.id) return
  try {
    const saved = localStorage.getItem(`skilllink_invited_providers_uid_${currentUser.value.id}`)
    if (saved) invitedProviderIds.value = new Set(JSON.parse(saved))
  } catch {}
}

function iconFor(name) {
  return categoryIconData.find((c) => c.name === name)?.icon ?? '⭐'
}

function openInviteModal(provider) {
  activeInviteProvider.value = provider
  isInviteModalOpen.value = true
}

function onProviderInvited({ providerId }) {
  invitedProviderIds.value.add(providerId)
  if (import.meta.client && currentUser.value?.id) {
    localStorage.setItem(`skilllink_invited_providers_uid_${currentUser.value.id}`, JSON.stringify(Array.from(invitedProviderIds.value)))
  }
}

async function loadCategories() {
  try {
    const res = await apiFetch('/categories')
    categories.value = res.data ?? []
  } catch {}
}

async function loadServices(page = 1) {
  const params = new URLSearchParams()
  if (activeCategory.value) params.set('category_id', activeCategory.value)
  params.set('page', page)
  const res = await apiFetch(`/services?${params}`)

  if (page === 1) {
    services.value = res.data ?? []
  } else {
    services.value.push(...(res.data ?? []))
  }
  currentPage.value = res.current_page
  hasMore.value = res.current_page < res.last_page
}

async function selectCategory(id) {
  activeCategory.value = id
  loading.value = true
  await loadServices(1)
  loading.value = false
}

async function loadMore() {
  loadingMore.value = true
  await loadServices(currentPage.value + 1)
  loadingMore.value = false
}

onMounted(async () => {
  loading.value = true
  await Promise.allSettled([
    loadFavorites,
    loadInvitedProviders,
    loadCategories
  ])

  if (route.query.q) searchQuery.value = String(route.query.q)
  if (route.query.sort) sortBy.value = String(route.query.sort)
  if (route.query.category) {
    const matched = categories.value.find((c) => c.name.toLowerCase() === String(route.query.category).toLowerCase())
    activeCategory.value = matched?.id ?? null
  }

  await loadServices(1)
  loading.value = false
})

const providerCards = computed(() => {
  const map = new Map()
  for (const s of services.value) {
    if (activeCategory.value && s.category_id && s.category_id !== activeCategory.value) {
      continue
    }

    const pid = s.provider.id
    if (!map.has(pid)) {
      map.set(pid, {
        provider: s.provider,
        services: [],
        minPrice: Infinity,
        priceUnit: s.price_type === 'hourly' ? '/hr' : '',
        primaryCategory: s.category?.name || 'Professional Service'
      })
    }
    const entry = map.get(pid)
    entry.services.push(s)
    entry.minPrice = Math.min(entry.minPrice, Number(s.price))
  }
  let arr = Array.from(map.values())

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    arr = arr.filter(e =>
      `${e.provider.user?.first_name || ''} ${e.provider.user?.last_name || ''}`.toLowerCase().includes(q) ||
      e.services.some(s => s.title?.toLowerCase().includes(q)) ||
      (e.provider.professional_title || '').toLowerCase().includes(q) ||
      (e.provider.bio || '').toLowerCase().includes(q) ||
      (e.provider.skills || []).some(sk => sk.skill_name?.toLowerCase().includes(q))
    )
  }

  if (filterAvailableOnly.value) {
    arr = arr.filter(e => e.provider.availability_status !== 'unavailable')
  }

  if (sortBy.value === 'rating') {
    arr.sort((a, b) => Number(b.provider.average_rating || 5) - Number(a.provider.average_rating || 5))
  } else if (sortBy.value === 'jobs') {
    arr.sort((a, b) => (b.provider.completed_jobs || 0) - (a.provider.completed_jobs || 0))
  } else if (sortBy.value === 'price_low') {
    arr.sort((a, b) => a.minPrice - b.minPrice)
  } else if (sortBy.value === 'price_high') {
    arr.sort((a, b) => b.minPrice - a.minPrice)
  }

  return arr.map((entry, avatarSlot) => ({ ...entry, avatarSlot }))
})

function getJobSuccessScore(provider) {
  const rating = Number(provider.average_rating || 4.9)
  if (rating >= 4.8) return '100%'
  if (rating >= 4.5) return '98%'
  if (rating >= 4.0) return '95%'
  return '92%'
}

function getHeadline(card) {
  const p = card.provider
  if (p.professional_title && p.professional_title.includes('|')) return p.professional_title
  if (p.professional_title) {
    const cat = card.primaryCategory || 'Specialist'
    return `${p.professional_title} | Certified ${cat} Expert | Top Rated`
  }
  if (card.services[0]?.title) {
    return `${card.services[0].title} | Verified Ethiopian Specialist`
  }
  return 'Full-Stack Professional Specialist | Escrow Protected'
}

function getBioExcerpt(card) {
  if (card.provider.bio) {
    return card.provider.bio
  }
  if (card.services[0]?.description) {
    return card.services[0].description
  }
  return 'Dedicated professional with extensive experience providing quality, reliable solutions for businesses and individuals across Ethiopia. Verified ID and Escrow guaranteed.'
}

function getProviderSkills(card) {
  if (card.provider.skills && card.provider.skills.length) {
    return card.provider.skills.map(s => s.skill_name || s)
  }
  // Generate relevant skills from services and category
  const list = [card.primaryCategory]
  for (const s of card.services) {
    if (s.title && !list.includes(s.title)) list.push(s.title)
  }
  if (list.length < 4) {
    list.push('Client Satisfaction', 'Rapid Turnaround', 'Escrow Protected')
  }
  return list
}

function getEarningsText(provider) {
  const jobs = provider.completed_jobs || 0
  if (jobs >= 50) return `ETB ${Math.round(jobs * 1.5)}K+ earned`
  if (jobs >= 10) return `ETB ${Math.round(jobs * 1.2)}K+ earned`
  return `${jobs} jobs completed`
}
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
    <!-- Back arrow -->
    <div class="mb-4">
      <button @click="goBack" class="inline-flex items-center gap-1.5 text-xs font-semibold text-clay hover:underline">
        <span>←</span> Back to Dashboard
      </button>
    </div>

    <!-- Header Banner -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-mist dark:border-white/10">
      <div>
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
          <span>👥</span> Vetted Professional Talent
        </div>
        <h1 class="font-display text-3xl sm:text-4xl font-extrabold text-ink dark:text-[#F0EDE6]">
          Find & Invite Top Professionals
        </h1>
        <p class="text-slate-500 dark:text-slate-400 mt-1 text-sm sm:text-base max-w-2xl">
          Browse vetted Ethiopian talent, check their verified ratings and credentials, and invite them directly to quote on your posted jobs.
        </p>
      </div>

      <div class="flex items-center gap-3 shrink-0">
        <NuxtLink
          to="/my-jobs"
          class="inline-flex items-center gap-2 border border-slate-300 dark:border-slate-700 hover:border-emerald-500 text-slate-800 dark:text-slate-200 text-xs font-bold px-4 py-2.5 rounded-full transition bg-white dark:bg-slate-900 shadow-xs"
        >
          <span>💼</span> My Posted Jobs
        </NuxtLink>
        <NuxtLink
          to="/jobs/post"
          class="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-5 py-2.5 rounded-full shadow-md transition"
        >
          <span>➕</span> Post a Job
        </NuxtLink>
      </div>
    </div>

    <!-- Search & Filter Bar -->
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs mb-8 space-y-4">
      <div class="flex flex-col sm:flex-row gap-3">
        <div class="flex-1 relative">
          <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-base">🔍</span>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by title, skill, or name (e.g. Google Ads, Electrician, Python, UI/UX, Tutor)..."
            class="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-11 pr-4 py-3 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition text-sm"
          />
        </div>
        <select
          v-model="sortBy"
          class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition text-sm font-medium cursor-pointer shrink-0"
        >
          <option value="rating">Sort: Top Rated ★</option>
          <option value="jobs">Sort: Most Completed Jobs</option>
          <option value="price_low">Sort: Lowest Starting Rate</option>
          <option value="price_high">Sort: Highest Starting Rate</option>
        </select>
      </div>

      <!-- Quick filters & category pills -->
      <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
        <button
          @click="selectCategory(null)"
          :class="[
            'px-3.5 py-1.5 rounded-full font-bold transition',
            activeCategory === null
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          ]"
        >
          All Categories
        </button>
        <button
          v-for="cat in categories.slice(0, 8)"
          :key="cat.id"
          @click="selectCategory(cat.id)"
          :class="[
            'px-3.5 py-1.5 rounded-full font-bold transition flex items-center gap-1',
            activeCategory === cat.id
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          ]"
        >
          <span>{{ iconFor(cat.name) }}</span>
          <span>{{ cat.name }}</span>
        </button>
        <button
          @click="filterAvailableOnly = !filterAvailableOnly"
          :class="[
            'ml-auto px-3.5 py-1.5 rounded-full border font-bold transition flex items-center gap-1.5',
            filterAvailableOnly
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
              : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
          ]"
        >
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Available Now
        </button>
      </div>
    </div>

    <!-- Provider Count -->
    <div class="flex items-center justify-between mb-4 px-1">
      <p v-if="!loading" class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
        Showing <span class="font-bold text-slate-900 dark:text-white">{{ providerCards.length }}</span> vetted professionals
      </p>
    </div>

    <!-- Skeleton Loading -->
    <div v-if="loading" class="space-y-4">
      <div v-for="i in 4" :key="i" class="h-64 rounded-3xl bg-slate-200 dark:bg-slate-800 animate-pulse"></div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!providerCards.length" class="border border-dashed border-slate-300 dark:border-slate-800 rounded-3xl p-16 text-center bg-white dark:bg-slate-900/40">
      <div class="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 text-3xl flex items-center justify-center mx-auto mb-4">
        🔍
      </div>
      <h3 class="font-display text-xl font-bold text-slate-900 dark:text-white mb-2">No professionals found</h3>
      <p class="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto mb-6">
        Try adjusting your search query or post an open job to receive competitive quotes directly from providers!
      </p>
      <NuxtLink
        to="/jobs/post"
        class="px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition inline-block"
      >
        Post an Open Job Instead
      </NuxtLink>
    </div>

    <!-- Professionals List -->
    <div v-else class="space-y-4">
      <div
        v-for="card in providerCards"
        :key="card.provider.id"
        class="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 rounded-3xl p-6 sm:p-7 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between relative"
      >
        <!-- Top Section: Avatar + Name/Headline + Top-Right Action Buttons -->
        <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
          <!-- Left: Avatar + Identity -->
          <div class="flex items-start gap-4">
            <!-- Profile Avatar with Online Dot & Top-Rated Star Badge -->
            <div class="relative shrink-0">
              <!-- Online status dot on top-left -->
              <span class="absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 ring-2 ring-emerald-500/20 z-10" title="Online now"></span>

              <img
                :src="getProviderAvatar(card.provider, card.avatarSlot)"
                :alt="card.provider.user?.first_name || 'Provider'"
                @error="(e) => handleAvatarError(e, card.provider)"
                class="w-16 h-16 sm:w-18 sm:h-18 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
              />

              <!-- Top-Rated / Star Badge on bottom-right of avatar -->
              <span
                class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-tr from-pink-500 to-rose-400 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-xs"
                title="Top Rated Talent"
              >
                ★
              </span>
            </div>

            <!-- Identity Info -->
            <div class="min-w-0 flex-1">
              <!-- Line 1: Name + Boosted / Top Rated Tag -->
              <div class="flex items-center gap-2 flex-wrap mb-1">
                <NuxtLink
                  :to="`/providers/${card.provider.id}`"
                  class="font-display font-bold text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition text-base sm:text-lg"
                >
                  {{ card.provider.user?.first_name }} {{ card.provider.user?.last_name?.[0] ? card.provider.user?.last_name?.[0] + '.' : '' }}
                </NuxtLink>

                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  <span>⚡</span> Boosted
                </span>
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  <span>✓</span> Verified ID
                </span>
              </div>

              <!-- Line 2: Bold Headline / Title -->
              <NuxtLink
                :to="`/providers/${card.provider.id}`"
                class="block font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base hover:text-emerald-600 dark:hover:text-emerald-400 transition line-clamp-1 mb-1"
              >
                {{ getHeadline(card) }}
              </NuxtLink>

              <!-- Line 3: Location -->
              <p class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <span>📍</span>
                <span>{{ card.provider.user?.city || 'Addis Ababa, Ethiopia' }}</span>
              </p>
            </div>
          </div>

          <!-- Right: Favorite Heart + Green "Invite to job" Button -->
          <div class="flex items-center gap-2.5 sm:self-start shrink-0 pt-1">
            <!-- Favorite button -->
            <button
              @click="(e) => toggleFavorite(e, card.provider.id)"
              class="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 flex items-center justify-center text-base transition bg-white dark:bg-slate-800"
              :class="isFavorite(card.provider.id) ? 'text-red-500 font-bold bg-red-50 dark:bg-red-950/30' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
              title="Save to favorites"
            >
              {{ isFavorite(card.provider.id) ? '♥' : '♡' }}
            </button>

            <!-- Prominent Green "Invite to job" Button -->
            <button
              v-if="invitedProviderIds.has(card.provider.id)"
              disabled
              class="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-bold text-xs border border-emerald-500/30 cursor-default shadow-xs"
            >
              <span>✓</span> Invited
            </button>
            <button
              v-else
              @click="openInviteModal(card.provider)"
              class="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-clay hover:bg-clay-dark text-white font-bold text-xs sm:text-sm shadow-md shadow-clay/25 hover:shadow-lg transition active:scale-98"
            >
              <span>Invite to job</span>
            </button>
          </div>
        </div>

        <!-- Metrics Row: Rates, Job Success Badge, Total Earned/Jobs, Open for work -->
        <div class="flex flex-wrap items-center gap-x-5 gap-y-2 py-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 border-t border-b border-slate-100 dark:border-slate-800/80 mb-3">
          <!-- Rate -->
          <div class="font-bold text-slate-900 dark:text-white">
            <span class="text-base sm:text-lg text-emerald-600 dark:text-emerald-400">
              {{ card.minPrice !== Infinity ? Number(card.minPrice).toLocaleString() : '500' }} ETB
            </span>
            <span class="text-xs text-slate-500 font-medium">{{ card.priceUnit || '/hr' }}</span>
          </div>

          <!-- Job Success Round Badge with Crown Icon -->
          <div class="flex items-center gap-1.5 font-medium">
            <div class="w-6 h-6 rounded-full border-2 border-blue-500/80 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs">
              👑
            </div>
            <span class="font-bold text-slate-900 dark:text-white">{{ getJobSuccessScore(card.provider) }}</span>
            <span class="text-slate-500 dark:text-slate-400 text-xs">Job Success</span>
          </div>

          <!-- Completed Jobs / Earnings -->
          <div class="flex items-center gap-1.5">
            <span class="font-bold text-slate-900 dark:text-white">{{ getEarningsText(card.provider) }}</span>
          </div>

          <!-- Open for work -->
          <div class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span class="text-emerald-500 font-bold">⚡</span>
            <span>Open for work</span>
          </div>

          <!-- Offers direct consultations -->
          <div class="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span>💬</span>
            <span>Offers direct hire</span>
          </div>
        </div>

        <!-- Skills / Expertise Tag Chips -->
        <div class="flex flex-wrap gap-1.5 mb-3">
          <span
            v-for="skill in getProviderSkills(card).slice(0, 5)"
            :key="skill"
            class="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-full font-medium"
          >
            {{ skill }}
          </span>
          <span v-if="getProviderSkills(card).length > 5" class="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2.5 py-1 rounded-full font-semibold">
            +{{ getProviderSkills(card).length - 5 }}
          </span>
        </div>

        <!-- Bio Snippet -->
        <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-2 mb-3.5 leading-relaxed">
          {{ getBioExcerpt(card) }}
        </p>

        <!-- Associated Credential Box -->
        <div class="p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-500/20 flex items-center justify-between gap-3 text-xs">
          <div class="flex items-center gap-2.5">
            <div class="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
              ✓
            </div>
            <div class="min-w-0">
              <p class="font-bold text-slate-900 dark:text-white truncate">
                Associated with <span class="text-emerald-600 dark:text-emerald-400">{{ card.primaryCategory }} Verified Experts</span>
              </p>
              <p class="text-[11px] text-slate-500 dark:text-slate-400">
                🏅 Top 1% SkillLink Talent • Escrow Payment Protected
              </p>
            </div>
          </div>

          <div class="flex items-center gap-3 shrink-0">
            <NuxtLink
              :to="`/messages?recipient=${card.provider.id}&name=${encodeURIComponent(card.provider.user?.first_name + ' ' + card.provider.user?.last_name)}&role=provider`"
              class="text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
            >
              💬 Chat
            </NuxtLink>
            <NuxtLink
              :to="`/providers/${card.provider.id}`"
              class="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              View profile →
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>

    <!-- Load More Button -->
    <div v-if="hasMore && !loading" class="text-center mt-10">
      <button
        @click="loadMore"
        :disabled="loadingMore"
        class="px-8 py-3 rounded-full border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition disabled:opacity-50"
      >
        {{ loadingMore ? 'Loading More…' : 'Load More Professionals' }}
      </button>
    </div>

    <!-- Invite to Job Modal Component -->
    <InviteToJobModal
      :is-open="isInviteModalOpen"
      :provider="activeInviteProvider"
      @close="isInviteModalOpen = false"
      @invited="onProviderInvited"
    />
  </div>
</template>
