<script setup>
definePageMeta({ layout: 'default', middleware: ['auth', 'customer-only'] })

const goBack = useGoBack('/dashboard')
const { favoriteProviders, loadFavorites, removeFavorite } = useFavorites()
const { getProviderAvatar, handleAvatarError } = useProviderAvatar()

const loading = ref(true)
const removingId = ref(null)

const cards = computed(() =>
  (favoriteProviders.value ?? []).map((p) => {
    const user = p.user ?? {}
    const firstService = p.services?.[0]
    return {
      id: p.id,
      providerRaw: p,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Provider',
      title: p.professional_title || firstService?.title || 'Professional Provider',
      rating: p.average_rating || 5.0,
      jobs: p.completed_jobs || 0,
      serviceTitle: firstService?.title || p.professional_title || 'General Services',
      price: firstService?.price || 0,
      category: firstService?.category?.name || 'Professional Service',
    }
  })
)

async function handleRemove(providerId) {
  removingId.value = providerId
  try {
    await removeFavorite(providerId)
  } finally {
    removingId.value = null
  }
}

onMounted(async () => {
  loading.value = true
  try {
    await loadFavorites(true)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="max-w-5xl mx-auto px-6 py-8 sm:py-12">
    <!-- Back arrow -->
    <div class="mb-4">
      <button @click="goBack" class="inline-flex items-center gap-1.5 text-xs font-semibold text-clay hover:underline">
        <span>←</span> Back to Dashboard
      </button>
    </div>

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-mist dark:border-white/10">
      <div>
        <p class="text-xs font-bold text-clay uppercase tracking-wider mb-1">Saved Talent</p>
        <h1 class="font-display text-3xl font-extrabold text-ink dark:text-[#F0EDE6]">
          Your Favorite Providers
        </h1>
        <p class="text-sm text-ink/60 dark:text-white/60 mt-1">
          Quickly re-hire, message, or manage professionals you have shortlisted.
        </p>
      </div>

      <NuxtLink
        to="/providers"
        class="inline-flex items-center gap-2 bg-clay hover:bg-clay/90 text-white text-xs font-bold px-5 py-3 rounded-full shadow-md transition shrink-0"
      >
        <span>🔍</span> Browse More Talent
      </NuxtLink>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div v-for="i in 3" :key="i" class="h-64 rounded-2xl bg-mist/50 dark:bg-mist-dark/50 animate-pulse"></div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!cards.length" class="border border-dashed border-mist dark:border-white/15 rounded-3xl p-16 text-center bg-white dark:bg-mist-dark/30">
      <div class="text-4xl mb-3">♡</div>
      <p class="font-display font-bold text-lg text-ink dark:text-[#F0EDE6] mb-1">No favorites saved yet</p>
      <p class="text-sm text-ink/50 dark:text-white/50 mb-6 max-w-sm mx-auto">
        Click the heart icon on any provider profile in Find Talent to shortlist them here.
      </p>
      <NuxtLink
        to="/providers"
        class="inline-flex items-center gap-2 bg-clay hover:bg-clay/90 text-white text-xs font-bold px-6 py-3 rounded-full transition shadow-sm"
      >
        Find Talent →
      </NuxtLink>
    </div>

    <!-- Cards Grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="p in cards"
        :key="p.id"
        class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-5 shadow-xs hover:border-clay/40 transition flex flex-col justify-between group/card"
      >
        <div>
          <!-- Card Header: Category badge + Remove from favorites button -->
          <div class="flex items-center justify-between gap-2 mb-3">
            <span class="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-clay/10 text-clay">
              {{ p.category }}
            </span>
            <button
              @click="handleRemove(p.id)"
              :disabled="removingId === p.id"
              class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 border border-transparent hover:border-red-200 dark:hover:border-red-900/40 transition"
              title="Remove from favorites"
            >
              <span>♥</span>
              <span class="text-[11px]">Remove</span>
            </button>
          </div>

          <!-- Provider Identity -->
          <div class="flex items-center gap-3 mb-3">
            <div class="relative shrink-0">
              <img
                :src="getProviderAvatar(p.providerRaw)"
                :alt="p.name"
                @error="(e) => handleAvatarError(e, p.providerRaw)"
                class="w-12 h-12 rounded-full object-cover border border-mist dark:border-white/15"
              />
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="font-bold text-base text-ink dark:text-[#F0EDE6] truncate">{{ p.name }}</h3>
              <p class="text-xs text-ink/50 dark:text-white/50 truncate">{{ p.title }}</p>
            </div>
          </div>

          <p class="text-xs text-ink/70 dark:text-white/70 line-clamp-2 mb-3">
            {{ p.serviceTitle }}
          </p>

          <div class="flex items-center justify-between text-xs text-ink/60 dark:text-white/60 mb-4 pt-2 border-t border-mist dark:border-white/10">
            <span>★ {{ Number(p.rating).toFixed(1) }} ({{ p.jobs }} jobs)</span>
            <span class="font-bold text-ink dark:text-white">ETB {{ Number(p.price).toLocaleString() }}</span>
          </div>
        </div>

        <div class="flex gap-2">
          <NuxtLink
            :to="`/messages?recipient=${p.id}&name=${encodeURIComponent(p.name)}&role=provider`"
            class="flex-1 text-center py-2 rounded-xl border border-clay/40 text-clay hover:bg-clay/5 text-xs font-bold transition"
          >
            💬 Chat
          </NuxtLink>
          <NuxtLink
            :to="`/providers/${p.id}`"
            class="flex-1 text-center py-2 rounded-xl bg-clay hover:bg-clay/90 text-white text-xs font-bold transition shadow-xs"
          >
            View Profile →
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
