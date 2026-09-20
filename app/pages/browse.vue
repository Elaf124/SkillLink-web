<script setup>
import { categories as categoryIconData } from '~/data/categories'

definePageMeta({ layout: 'default' })

const { apiFetch } = useApi()
const route = useRoute()
const router = useRouter()
const goBack = useGoBack('/dashboard')
const { getProviderAvatar, handleAvatarError } = useProviderAvatar()
const categories = ref([])
const services = ref([])
const verifiedProviders = ref([])
const activeCategory = ref(null)
const searchQuery = ref('')
const sortBy = ref('rating')
const filterAvailableOnly = ref(false)
const loading = ref(true)
const loadingMore = ref(false)
const currentPage = ref(1)
const hasMore = ref(false)
const categoriesExpanded = ref(false)
const mobileCategoryOpen = ref(false)
const { favoriteIds, loadFavorites, isFavorite, toggleFavorite } = useFavorites()
const visibleCategories = computed(() => categoriesExpanded.value ? categories.value : categories.value.slice(0, 10))

function iconFor(name) {
  return categoryIconData.find((c) => c.name === name)?.icon ?? '⭐'
}

async function loadCategories() {
  const res = await apiFetch('/categories')
  categories.value = res.data
}

function resolveCategoryFromQuery() {
  if (route.query.category_id) {
    return Number(route.query.category_id)
  }
  if (route.query.category) {
    const catName = String(route.query.category).toLowerCase().trim()
    // 1. Check top-level categories
    const top = categories.value.find(c => c.name.toLowerCase() === catName)
    if (top) return top.id
    // 2. Check child subcategories
    for (const c of categories.value) {
      const child = c.children?.find(ch => ch.name.toLowerCase() === catName)
      if (child) return child.id
    }
  }
  return null
}

async function loadServices(page = 1) {
  const params = new URLSearchParams()
  if (activeCategory.value) params.set('category_id', activeCategory.value)
  if (searchQuery.value.trim()) params.set('q', searchQuery.value.trim())
  params.set('page', page)

  const [resServices, resProviders] = await Promise.allSettled([
    apiFetch(`/services?${params}`),
    apiFetch(`/providers?${params}`),
  ])

  const sData = resServices.status === 'fulfilled' && resServices.value ? (resServices.value.data ?? []) : []
  const pData = resProviders.status === 'fulfilled' && resProviders.value ? (resProviders.value.data ?? []) : []

  if (page === 1) {
    services.value = sData
    verifiedProviders.value = pData
  } else {
    services.value.push(...sData)
    verifiedProviders.value.push(...pData)
  }
  currentPage.value = resServices.status === 'fulfilled' && resServices.value ? resServices.value.current_page : 1
  hasMore.value = resServices.status === 'fulfilled' && resServices.value ? (resServices.value.current_page < resServices.value.last_page) : false
}

async function selectCategory(id) {
  activeCategory.value = id
  const query = { ...route.query }
  if (id) {
    // Find category name to keep clean URLs
    let catObj = categories.value.find(c => c.id === id)
    if (!catObj) {
      for (const c of categories.value) {
        const ch = c.children?.find(x => x.id === id)
        if (ch) { catObj = ch; break; }
      }
    }
    query.category = catObj?.name || String(id)
    delete query.category_id
  } else {
    delete query.category
    delete query.category_id
  }
  router.replace({ query })
  loading.value = true
  await loadServices(1)
  loading.value = false
}

let searchDebounce = null
function onSearchInput() {
  clearTimeout(searchDebounce)
  searchDebounce = setTimeout(async () => {
    const query = { ...route.query }
    if (searchQuery.value.trim()) {
      query.q = searchQuery.value.trim()
    } else {
      delete query.q
    }
    router.replace({ query })
    loading.value = true
    await loadServices(1)
    loading.value = false
  }, 350)
}

function onSortChange() {
  const query = { ...route.query }
  if (sortBy.value !== 'rating') {
    query.sort = sortBy.value
  } else {
    delete query.sort
  }
  router.replace({ query })
}

async function loadMore() {
  loadingMore.value = true
  await loadServices(currentPage.value + 1)
  loadingMore.value = false
}

// Watch URL query changes so clicking categories in MegaMenu or back/forward updates filters instantly
watch(
  () => [route.query.category, route.query.category_id, route.query.q, route.query.sort],
  async () => {
    const resolvedCat = resolveCategoryFromQuery()
    if (activeCategory.value !== resolvedCat) {
      activeCategory.value = resolvedCat
    }
    if (route.query.q !== undefined && searchQuery.value !== String(route.query.q)) {
      searchQuery.value = String(route.query.q || '')
    }
    if (route.query.sort && sortBy.value !== String(route.query.sort)) {
      sortBy.value = String(route.query.sort)
    }
    loading.value = true
    await loadServices(1)
    loading.value = false
  }
)

onMounted(async () => {
  loading.value = true
  await Promise.allSettled([
    loadFavorites(),
    loadCategories()
  ])

  if (route.query.q) searchQuery.value = String(route.query.q)
  if (route.query.sort) sortBy.value = String(route.query.sort)
  activeCategory.value = resolveCategoryFromQuery()

  await loadServices(1)
  loading.value = false
})

// Group services by provider and compute display attributes
const providerCards = computed(() => {
  const map = new Map()

  // Find active category and all its children IDs
  const activeCatObj = categories.value.find(c => c.id === activeCategory.value)
  const validCategoryIds = new Set()
  if (activeCategory.value) {
    validCategoryIds.add(activeCategory.value)
    if (activeCatObj?.children?.length) {
      activeCatObj.children.forEach(ch => validCategoryIds.add(ch.id))
    }
  }

  for (const s of services.value) {
    if (!s?.provider) continue
    if (activeCategory.value && s.category_id && !validCategoryIds.has(s.category_id)) {
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

  // Also include all verified providers who may not have added catalog services yet
  for (const p of verifiedProviders.value) {
    if (!p || map.has(p.id)) continue
    if (activeCategory.value) {
      const hasCatInServices = p.services?.some(s => validCategoryIds.has(s.category_id))
      const catNames = [activeCatObj?.name, ...(activeCatObj?.children || []).map(c => c.name)].filter(Boolean)
      const matchesTitle = catNames.some(cn =>
        p.professional_title?.toLowerCase().includes(cn.toLowerCase()) ||
        p.bio?.toLowerCase().includes(cn.toLowerCase())
      )
      if (!hasCatInServices && !matchesTitle) continue
    }
    const pServices = p.services || []
    const lowest = pServices.length ? pServices.reduce((min, s) => Math.min(min, Number(s.price)), Infinity) : null
    map.set(p.id, {
      provider: p,
      services: pServices,
      minPrice: lowest !== Infinity ? lowest : null,
      priceUnit: pServices[0]?.price_type === 'hourly' ? '/hr' : '',
      primaryCategory: pServices[0]?.category?.name || p.professional_title || 'Verified Specialist'
    })
  }
  let arr = Array.from(map.values())

  // Search filter
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    arr = arr.filter(e =>
      `${e.provider.user.first_name} ${e.provider.user.last_name}`.toLowerCase().includes(q) ||
      e.services.some(s => s.title?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)) ||
      e.provider.professional_title?.toLowerCase().includes(q) ||
      e.provider.bio?.toLowerCase().includes(q) ||
      e.provider.skills?.some(sk => sk.skill_name?.toLowerCase().includes(q))
    )
  }

  // Available filter
  if (filterAvailableOnly.value) {
    arr = arr.filter(e => e.provider.availability_status !== 'unavailable')
  }

  // Sorting
  if (sortBy.value === 'rating') {
    arr.sort((a, b) => Number(b.provider.average_rating) - Number(a.provider.average_rating))
  } else if (sortBy.value === 'price_low') {
    arr.sort((a, b) => a.minPrice - b.minPrice)
  } else if (sortBy.value === 'price_high') {
    arr.sort((a, b) => b.minPrice - a.minPrice)
  } else if (sortBy.value === 'jobs') {
    arr.sort((a, b) => b.provider.completed_jobs - a.provider.completed_jobs)
  }

  return arr.map((entry, avatarSlot) => ({ ...entry, avatarSlot }))
})

function getSellerLevel(provider) {
  const jobs = provider.completed_jobs || 0
  const rating = Number(provider.average_rating || 0)
  if (jobs >= 15 && rating >= 4.8) return { label: 'Top Rated Pro', class: 'badge-pro' }
  if (jobs >= 5 && rating >= 4.5) return { label: 'Level 2 Seller', class: 'bg-slate-900 text-white dark:bg-slate-700' }
  return { label: 'Rising Talent', class: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-500/20' }
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-6 py-8">
    <!-- Back arrow breadcrumb -->
    <div class="mb-4">
      <button @click="goBack" class="inline-flex items-center gap-1.5 text-xs font-semibold text-clay hover:underline">
        <span>←</span> Back
      </button>
    </div>

    <!-- Header Banner -->
    <div class="mb-8">
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
        <span>🌐</span> Service Marketplace
      </div>
      <h1 class="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
        Explore Verified Talent & Services
      </h1>
      <p class="text-slate-500 dark:text-slate-400 mt-1 text-sm sm:text-base">
        Browse pre-priced service packages or hire directly with 100% escrow protection.
      </p>
    </div>

    <!-- Search, Sort & Quick Filter Bar -->
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm mb-8 space-y-4">
      <div class="flex flex-col sm:flex-row gap-3">
        <div class="flex-1 relative">
          <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-base">🔍</span>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by skill, service title, or provider name..."
            class="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-11 pr-4 py-3 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition text-sm"
          />
        </div>
        <select
          v-model="sortBy"
          @change="onSortChange"
          class="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition text-sm font-medium cursor-pointer shrink-0"
        >
          <option value="rating">Sort: Top Rated ★</option>
          <option value="jobs">Sort: Most Completed Jobs</option>
          <option value="price_low">Sort: Price (Low to High)</option>
          <option value="price_high">Sort: Price (High to Low)</option>
        </select>
      </div>

      <!-- Quick Filter Pills -->
      <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
        <span class="text-slate-400 font-semibold uppercase tracking-wider text-[11px] mr-1">Quick Filters:</span>
        <button
          @click="filterAvailableOnly = !filterAvailableOnly"
          :class="[
            'px-3.5 py-1.5 rounded-full border font-semibold transition flex items-center gap-1.5',
            filterAvailableOnly
              ? 'bg-clay text-white border-clay shadow-sm'
              : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
          ]"
        >
          <span>🟢</span> Available Now
        </button>
        <NuxtLink
          to="/jobs/post"
          class="ml-auto text-clay hover:underline font-bold flex items-center gap-1"
        >
          <span>➕</span> Post Custom Job Instead
        </NuxtLink>
      </div>
    </div>

    <!-- Main Layout: Categories Sidebar + Service Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8">
      <!-- Category sidebar (Responsive & Collapsible on mobile) -->
      <aside class="space-y-6">
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div
            @click="mobileCategoryOpen = !mobileCategoryOpen"
            class="flex items-center justify-between cursor-pointer lg:cursor-default mb-3 pb-2 border-b border-slate-100 dark:border-slate-800 select-none"
          >
            <div class="flex items-center gap-2">
              <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Categories</h3>
              <span class="text-[11px] text-slate-400 font-semibold">({{ categories.length }})</span>
            </div>
            <button class="lg:hidden text-xs font-bold text-clay flex items-center gap-1">
              <span>{{ mobileCategoryOpen ? 'Hide' : 'Filter' }}</span>
              <span class="text-[10px]">{{ mobileCategoryOpen ? '▲' : '▼' }}</span>
            </button>
          </div>

          <div :class="[mobileCategoryOpen ? 'block' : 'hidden lg:block', 'space-y-1']">
            <button
              @click="selectCategory(null); mobileCategoryOpen = false"
              :class="[
                'w-full text-left px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center justify-between',
                activeCategory === null
                  ? 'bg-clay text-white shadow-sm'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              ]"
            >
              <span>🌐 All Categories</span>
            </button>
            <button
              v-for="cat in visibleCategories"
              :key="cat.id"
              @click="selectCategory(cat.id); mobileCategoryOpen = false"
              :class="[
                'w-full text-left px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition flex items-center gap-2 truncate',
                activeCategory === cat.id
                  ? 'bg-clay text-white font-bold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              ]"
            >
              <span>{{ iconFor(cat.name) }}</span>
              <span class="truncate">{{ cat.name }}</span>
            </button>

            <button
              v-if="categories.length > 10"
              @click.stop="categoriesExpanded = !categoriesExpanded"
              class="mt-3 w-full text-center text-xs font-bold text-clay hover:underline pt-2 border-t border-slate-100 dark:border-slate-800"
            >
              {{ categoriesExpanded ? 'Show Fewer ▲' : 'Show All Categories ▼' }}
            </button>
          </div>
        </div>
      </aside>

      <!-- Results Grid -->
      <div>
        <div class="flex items-center justify-between mb-4">
          <p v-if="!loading" class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Showing <span class="font-bold text-slate-900 dark:text-white">{{ providerCards.length }}</span> verified providers
          </p>
        </div>

        <!-- Skeleton Loading -->
        <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          <div v-for="i in 6" :key="i" class="h-80 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse"></div>
        </div>

        <!-- Empty State -->
        <div v-else-if="!providerCards.length" class="border border-dashed border-slate-300 dark:border-slate-800 rounded-3xl p-16 text-center bg-white dark:bg-slate-900/40">
          <div class="w-16 h-16 rounded-full bg-clay/10 text-clay text-3xl flex items-center justify-center mx-auto mb-4">
            🔍
          </div>
          <h3 class="font-display text-xl font-bold text-slate-900 dark:text-white mb-2">No matching providers found</h3>
          <p class="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto mb-6">
            Try adjusting your search terms or filters. You can also post an open job to receive custom bids!
          </p>
          <div class="flex justify-center gap-3">
            <button
              @click="searchQuery = ''; activeCategory = null; filterAvailableOnly = false"
              class="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-clay hover:text-clay transition"
            >
              Reset Filters
            </button>
            <NuxtLink
              to="/jobs/post"
              class="px-5 py-2.5 rounded-xl bg-clay hover:bg-clay-dark text-white font-bold text-xs shadow-md transition"
            >
              Post a Job
            </NuxtLink>
          </div>
        </div>

        <!-- Rich Cards -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          <NuxtLink
            v-for="card in providerCards"
            :key="card.provider.id"
            :to="`/providers/${card.provider.id}`"
            class="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-clay/60 dark:hover:border-clay/60 rounded-2xl overflow-hidden card-hover-lift flex flex-col justify-between transition-all duration-300 relative shadow-sm"
          >
            <!-- Card Image Banner / Category Header -->
            <div class="h-24 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-3.5 relative flex flex-col justify-between overflow-hidden">
              <div class="absolute -right-3 -bottom-5 text-5xl opacity-15 select-none pointer-events-none">
                {{ iconFor(card.primaryCategory) }}
              </div>
              <div class="flex items-center justify-between relative z-10">
                <span class="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-950/70 backdrop-blur-md text-emerald-400 border border-emerald-500/30">
                  {{ card.primaryCategory }}
                </span>
                <!-- Favorite Heart Button -->
                <button
                  @click="(e) => toggleFavorite(e, card.provider.id)"
                  class="w-7 h-7 rounded-full bg-slate-950/60 backdrop-blur-md flex items-center justify-center text-xs transition hover:scale-110"
                  :class="isFavorite(card.provider.id) ? 'text-red-500 font-bold' : 'text-slate-300 hover:text-white'"
                >
                  {{ isFavorite(card.provider.id) ? '♥' : '♡' }}
                </button>
              </div>
              <!-- Empty bottom space so avatar overlaps cleanly without hitting any text -->
              <div></div>
            </div>

            <!-- Card Body -->
            <div class="p-4 sm:p-5 flex-1 flex flex-col justify-between">
              <div>
                <!-- Provider Info Row: Avatar cleanly overlapping bottom of banner, Seller badge beside name -->
                <div class="flex items-center gap-3 mb-3 -mt-8 relative z-20">
                  <div class="relative shrink-0">
                    <div class="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl overflow-hidden ring-3 ring-white dark:ring-slate-900 shadow-md bg-slate-200 dark:bg-slate-800">
                      <img :src="getProviderAvatar(card.provider, card.avatarSlot)" class="w-full h-full object-cover" alt="" @error="(e) => handleAvatarError(e, card.provider)" />
                    </div>
                    <span class="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] flex items-center justify-center ring-1 ring-white dark:ring-slate-900 font-bold">✓</span>
                  </div>
                  <div class="min-w-0 pt-4">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <h3 class="font-display font-bold text-slate-900 dark:text-white group-hover:text-clay transition truncate text-sm">
                        {{ card.provider.user.first_name }} {{ card.provider.user.last_name }}
                      </h3>
                      <span :class="getSellerLevel(card.provider).class" class="text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0">
                        {{ getSellerLevel(card.provider).label }}
                      </span>
                    </div>
                    <p class="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {{ card.provider.professional_title || 'Certified Specialist' }}
                    </p>
                  </div>
                </div>

                <!-- Service Title Preview -->
                <p class="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-sm line-clamp-2 mb-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">
                  {{ card.services[0]?.title || card.provider.bio || 'Professional verified services with fast turnaround' }}
                </p>

                <!-- Rating & Jobs Completed -->
                <div class="flex items-center gap-1.5 text-xs mb-3">
                  <span class="text-amber-500 font-bold">★ {{ Number(card.provider.average_rating || 5.0).toFixed(1) }}</span>
                  <span class="text-slate-400">({{ card.provider.completed_jobs || 0 }} jobs)</span>
                  <span class="text-slate-300 dark:text-slate-700">•</span>
                  <span class="text-emerald-600 dark:text-emerald-400 font-medium">98% Success</span>
                </div>

                <!-- Skill Tags -->
                <div class="flex flex-wrap gap-1 mb-4">
                  <span
                    v-for="skill in (card.provider.skills || []).slice(0, 3)"
                    :key="skill.id"
                    class="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md font-medium"
                  >
                    {{ skill.skill_name }}
                  </span>
                  <span v-if="(card.provider.skills || []).length > 3" class="text-[10px] text-slate-400 px-1 py-0.5">
                    +{{ card.provider.skills.length - 3 }}
                  </span>
                </div>
              </div>

              <!-- Card Footer: Starting Price -->
              <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span class="text-slate-400 font-medium">STARTING AT</span>
                <span class="font-display font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                  <template v-if="card.minPrice && card.minPrice !== Infinity">
                    {{ card.minPrice.toLocaleString() }} ETB{{ card.priceUnit }}
                  </template>
                  <template v-else>
                    Custom Quote
                  </template>
                </span>
              </div>
            </div>
          </NuxtLink>
        </div>

        <!-- Load More Button -->
        <div v-if="hasMore && !loading" class="text-center mt-10">
          <button
            @click="loadMore"
            :disabled="loadingMore"
            class="px-8 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition disabled:opacity-50"
          >
            {{ loadingMore ? 'Loading More…' : 'Load More Services' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
