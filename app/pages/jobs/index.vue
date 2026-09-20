<script setup>
definePageMeta({ layout: 'default' })

const { apiFetch, token } = useApi()
const route = useRoute()
const router = useRouter()
const goBack = useGoBack('/dashboard')

const jobs = ref([])
const categories = ref([])
const activeCategory = ref(null)
const searchQuery = ref('')
const loading = ref(true)
const loadingMore = ref(false)
const currentPage = ref(1)
const hasMore = ref(false)
const user = ref(null)

onMounted(async () => {
  loading.value = true
  await loadCategories()

  if (route.query.category_id) {
    activeCategory.value = Number(route.query.category_id)
  } else if (route.query.category) {
    const matched = categories.value.find(c => c.name.toLowerCase() === String(route.query.category).toLowerCase())
    if (matched) activeCategory.value = matched.id
  }

  await loadJobs(1)
  if (token.value) {
    try { user.value = await apiFetch('/user') } catch {}
  }
  loading.value = false
})

async function loadCategories() {
  try {
    const res = await apiFetch('/categories')
    categories.value = res.data ?? []
  } catch {}
}

async function loadJobs(page = 1) {
  const params = new URLSearchParams({ page })
  if (activeCategory.value) params.set('category_id', activeCategory.value)
  // Always request only open jobs (providers must not see taken/closed jobs)
  params.set('status', 'open')
  const res = await apiFetch(`/jobs?${params}`)
  // Filter client-side too in case the API returns mixed statuses
  const openOnly = (res.data ?? []).filter(j => j.status === 'open' || !j.status)
  if (page === 1) {
    jobs.value = openOnly
  } else {
    jobs.value.push(...openOnly)
  }
  currentPage.value = res.current_page
  hasMore.value = res.current_page < res.last_page
}

async function selectCategory(id) {
  activeCategory.value = id
  const query = { ...route.query }
  if (id) {
    query.category_id = String(id)
  } else {
    delete query.category_id
    delete query.category
  }
  router.replace({ query })
  loading.value = true
  await loadJobs(1)
  loading.value = false
}

async function loadMore() {
  loadingMore.value = true
  await loadJobs(currentPage.value + 1)
  loadingMore.value = false
}

function budgetLabel(job) {
  const amt = Number(job.budget).toLocaleString()
  return job.budget_type === 'hourly' ? `ETB ${amt}/hr` : `ETB ${amt}`
}

function budgetTypeLabel(job) {
  return job.budget_type === 'hourly' ? '⏰ Hourly Rate' : '💰 Fixed-Price Budget'
}

function timeAgo(dateStr) {
  if (!dateStr) return 'Recently'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${Math.max(1, mins)}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const isProvider = computed(() => user.value?.role?.name === 'provider')
const isCustomer  = computed(() => user.value?.role?.name === 'customer')

const filteredJobs = computed(() => {
  let list = jobs.value
  if (activeCategory.value) {
    const activeCatObj = categories.value.find(c => c.id === activeCategory.value)
    const validIds = new Set([activeCategory.value])
    if (activeCatObj?.children?.length) {
      activeCatObj.children.forEach(ch => validIds.add(ch.id))
    }
    list = list.filter(j => validIds.has(j.category_id) || validIds.has(j.category?.id))
  }
  if (!searchQuery.value.trim()) return list
  const q = searchQuery.value.toLowerCase()
  return list.filter(j =>
    j.title?.toLowerCase().includes(q) ||
    j.description?.toLowerCase().includes(q) ||
    j.category?.name?.toLowerCase().includes(q) ||
    j.location?.toLowerCase().includes(q)
  )
})
</script>

<template>
  <div class="max-w-6xl mx-auto px-6 py-8 sm:py-10">
    <!-- Back arrow -->
    <div class="mb-4">
      <button @click="goBack" class="inline-flex items-center gap-1.5 text-xs font-semibold text-clay hover:underline">
        <span>←</span> Back
      </button>
    </div>

    <!-- Header Banner -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
          <span>💼</span> Open Jobs
        </div>
        <h1 class="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          Find Work & Submit Proposals
        </h1>
        <p class="text-slate-500 dark:text-slate-400 mt-1 text-sm sm:text-base">
          Browse open client requirements across Ethiopia — submit competitive bids or negotiate custom terms.
        </p>
      </div>

      <!-- Only customers can post jobs -->
      <NuxtLink
        v-if="isCustomer"
        to="/jobs/post"
        class="shrink-0 inline-flex items-center gap-2 bg-clay hover:bg-clay-dark text-white font-extrabold px-6 py-3 rounded-xl transition shadow-md shadow-clay/20 text-sm"
      >
        <span>➕</span> Post an Open Job
      </NuxtLink>
    </div>

    <!-- Search & Category Filters -->
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm mb-8 space-y-4">
      <div class="relative">
        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-base">🔍</span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search jobs by keywords (e.g., electrical, website, generator, plumbing)..."
          class="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-11 pr-4 py-3 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-clay/30 focus:border-clay transition text-sm"
        />
      </div>

      <div class="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
        <button
          @click="selectCategory(null)"
          :class="[
            'px-3.5 py-1.5 rounded-full text-xs font-bold transition',
            activeCategory === null
              ? 'bg-clay text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          ]"
        >
          All Categories
        </button>
        <button
          v-for="cat in categories"
          :key="cat.id"
          @click="selectCategory(cat.id)"
          :class="[
            'px-3.5 py-1.5 rounded-full text-xs font-bold transition',
            activeCategory === cat.id
              ? 'bg-clay text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          ]"
        >
          {{ cat.name }}
        </button>
      </div>
    </div>

    <!-- Results Header -->
    <div class="flex items-center justify-between mb-4">
      <p v-if="!loading" class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
        <span class="font-bold text-slate-900 dark:text-white">{{ filteredJobs.length }}</span> open jobs waiting for proposals
      </p>
    </div>

    <!-- Skeleton Loading -->
    <div v-if="loading" class="space-y-4">
      <div v-for="i in 4" :key="i" class="h-44 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse"></div>
    </div>

    <!-- Empty state -->
    <div v-else-if="!filteredJobs.length" class="border border-dashed border-slate-300 dark:border-slate-800 rounded-3xl p-16 text-center bg-white dark:bg-slate-900/40">
      <div class="w-16 h-16 rounded-full bg-clay/10 text-clay text-3xl flex items-center justify-center mx-auto mb-4">
        💼
      </div>
      <h3 class="font-display text-xl font-bold text-slate-900 dark:text-white mb-2">No open jobs found</h3>
      <p class="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto mb-6">
        {{ isProvider ? 'No open jobs in this category right now. Check back soon!' : 'Try a different category or be the first to post a job for providers to bid on!' }}
      </p>
      <NuxtLink
        v-if="isCustomer"
        to="/jobs/post"
        class="inline-flex items-center gap-2 bg-clay hover:bg-clay-dark text-white font-bold px-6 py-3 rounded-xl transition shadow-md"
      >
        Post a Job Now
      </NuxtLink>
    </div>

    <!-- Job Cards List -->
    <div v-else class="space-y-4">
      <NuxtLink
        v-for="job in filteredJobs"
        :key="job.id"
        :to="`/jobs/${job.id}`"
        class="group block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-clay/60 dark:hover:border-clay/60 rounded-2xl p-6 sm:p-7 transition-all duration-300 card-hover-lift shadow-sm relative overflow-hidden"
      >
        <!-- Top Meta Row -->
        <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 mb-3">
          <div class="flex items-center gap-3">
            <span class="text-slate-500 font-semibold">Posted {{ timeAgo(job.created_at) }}</span>
            <span>•</span>
            <span class="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
              {{ job.category?.name || 'General Service' }}
            </span>
            <span v-if="job.location" class="hidden sm:inline">📍 {{ job.location }}</span>
          </div>
          <div class="flex items-center gap-1.5 text-clay font-semibold text-xs">
            <span>🛡️</span> Escrow Protected
          </div>
        </div>

        <!-- Job Title -->
        <h2 class="font-display font-bold text-lg sm:text-xl text-slate-900 dark:text-white group-hover:text-clay transition mb-2">
          {{ job.title }}
        </h2>

        <!-- Description -->
        <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed mb-4">
          {{ job.description }}
        </p>

        <!-- Trust & Decision Row -->
        <div class="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
          <!-- Client & Scope Details -->
          <div class="flex flex-wrap items-center gap-4 text-slate-500 dark:text-slate-400">
            <div class="flex items-center gap-1 font-semibold text-slate-900 dark:text-white">
              <span>{{ budgetTypeLabel(job) }}:</span>
              <span class="text-clay font-extrabold text-sm">{{ budgetLabel(job) }}</span>
            </div>
            <span>•</span>
            <div>
              <span>Proposals: </span>
              <span class="font-semibold text-slate-700 dark:text-slate-300">
                {{ job.offers_count ?? job.offers?.length ?? 0 }} submitted
              </span>
            </div>
            <span v-if="job.preferred_date" class="hidden sm:inline">•</span>
            <span v-if="job.preferred_date" class="hidden sm:inline">
              📅 Target Date: {{ job.preferred_date }}
            </span>
          </div>

          <!-- CTA Button -->
          <div class="flex items-center gap-2">
            <span class="px-4 py-1.5 rounded-lg bg-clay group-hover:bg-clay-dark text-white font-bold text-xs transition shadow-xs">
              Submit Proposal →
            </span>
          </div>
        </div>
      </NuxtLink>
    </div>

    <!-- Load More -->
    <div v-if="hasMore && !loading" class="text-center mt-10">
      <button
        @click="loadMore"
        :disabled="loadingMore"
        class="px-8 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition disabled:opacity-50"
      >
        {{ loadingMore ? 'Loading…' : 'Load More Jobs' }}
      </button>
    </div>
  </div>
</template>
