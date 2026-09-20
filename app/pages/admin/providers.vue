<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'admin-support-only'] })

const { apiFetch } = useApi()
const goBack = useGoBack('/dashboard')

const loading = ref(true)
const providers = ref<any[]>([])
const summary = ref<any>({ pending: 0, verified: 0, suspended: 0 })
const activeTab = ref<'pending' | 'verified' | 'suspended' | 'all'>('pending')
const searchQuery = ref('')
const actionLoading = ref<number | null>(null)
const successMessage = ref('')

async function loadProviders() {
  loading.value = true
  try {
    const res = await apiFetch<any>('/admin/verifications')
    providers.value = res.data ?? []
    summary.value = res.summary ?? summary.value
  } catch (err) {
    providers.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadProviders)

const filteredProviders = computed(() => {
  let list = providers.value
  if (activeTab.value !== 'all') list = list.filter(p => p.verification_status === activeTab.value)

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.professional_title || '').toLowerCase().includes(q) ||
      (p.city || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q)
    )
  }
  return list
})

async function decide(providerId: number, status: 'verified' | 'rejected' | 'suspended', name: string) {
  actionLoading.value = providerId
  successMessage.value = ''
  try {
    await apiFetch(`/admin/verifications/providers/${providerId}/decision`, {
      method: 'POST',
      body: { status },
    })
    successMessage.value = {
      verified: `✓ ${name} is now a verified provider and publicly bookable.`,
      rejected: `✕ ${name}'s application was rejected — they can resubmit documents.`,
      suspended: `${name} has been suspended and removed from public listings.`,
    }[status]
    await loadProviders()
  } catch (e: any) {
    successMessage.value = e?.data?.message || 'Action failed. Try again.'
  } finally {
    actionLoading.value = null
  }
}

function formatDate(iso: string) {
  if (!iso) return ''
  return new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso))
}

const statusBadge = (s: string) => ({
  verified: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800',
  suspended: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800',
  pending: 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
}[s] || 'bg-mist text-ink/60')
</script>

<template>
  <div class="space-y-6">
    <!-- Admin Consoles Sub-Navigation Bar -->
    <div class="flex items-center gap-2 border-b border-mist/80 dark:border-white/10 pb-4 overflow-x-auto">
      <NuxtLink
        to="/admin/support"
        class="px-4 py-2 rounded-xl text-xs font-semibold text-ink/70 dark:text-white/70 hover:bg-[#8A5B43]/10 hover:text-[#8A5B43] dark:hover:bg-white/10 dark:hover:text-white transition flex items-center gap-2"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <span>Trust, Safety & Support</span>
      </NuxtLink>
      <NuxtLink
        to="/admin/providers"
        class="px-4 py-2 rounded-xl text-xs font-bold bg-[#8A5B43] text-white shadow-xs flex items-center gap-2"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m9 12 2 2 4-4"/><path d="M12 3a12 12 0 0 0 8.5 3A12 12 0 0 1 12 21 12 12 0 0 1 3.5 6 12 12 0 0 0 12 3z"/>
        </svg>
        <span>Provider Verification</span>
        <span v-if="summary.pending > 0" class="px-1.5 py-0.2 text-[10px] rounded-full bg-white/25 text-white font-black">
          {{ summary.pending }}
        </span>
      </NuxtLink>
    </div>

    <!-- Page Title Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-[#FAF0E6] dark:bg-[#253742] border border-[#EADFD7] dark:border-white/10 flex items-center justify-center text-[#8A5B43] dark:text-[#D4A98A]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m9 12 2 2 4-4"/><path d="M12 3a12 12 0 0 0 8.5 3A12 12 0 0 1 12 21 12 12 0 0 1 3.5 6 12 12 0 0 0 12 3z"/>
            </svg>
          </div>
          <h1 class="font-display text-2xl sm:text-3xl font-bold text-[#1A1210] dark:text-[#F0EDE6] tracking-tight">
            Provider Verification Console
          </h1>
        </div>
        <p class="text-sm text-[#7D6E66] dark:text-white/60 mt-1">
          Review credentials, national ID / passport documents, and approve Ethiopian service providers.
        </p>
      </div>

      <!-- Refresh Providers Button -->
      <button
        @click="loadProviders"
        :disabled="loading"
        class="px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-surface-dark border border-[#D9CBC1] dark:border-white/15 text-[#5A3E26] dark:text-[#F0EDE6] hover:bg-[#FAF7F4] dark:hover:bg-white/5 transition flex items-center gap-2 shadow-2xs self-start sm:self-auto active:scale-95"
      >
        <svg :class="['w-3.5 h-3.5 text-[#8A5B43] dark:text-[#D4A98A]', loading ? 'animate-spin' : '']" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
        </svg>
        <span>Refresh List</span>
      </button>
    </div>

    <!-- Alert toast -->
    <div v-if="successMessage" class="p-4 rounded-xl bg-green-50 dark:bg-green-950/40 border border-green-300 dark:border-green-800 text-green-800 dark:text-green-300 text-sm font-semibold flex items-center justify-between">
      <span>{{ successMessage }}</span>
      <button @click="successMessage = ''" class="text-xs text-green-700 hover:underline">Dismiss</button>
    </div>

    <!-- Filter & Search Bar -->
    <div class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-xs mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
      <!-- Tab filters -->
      <div class="flex gap-1.5 bg-mist/60 dark:bg-white/5 p-1 rounded-xl w-full sm:w-auto text-xs font-semibold overflow-x-auto">
        <button
          v-for="t in [
            { key: 'pending', label: '⏳ Needs Review', count: summary.pending },
            { key: 'verified', label: '✓ Verified', count: summary.verified },
            { key: 'suspended', label: '⛔ Suspended', count: summary.suspended },
            { key: 'all', label: 'All', count: providers.length },
          ]"
          :key="t.key"
          @click="activeTab = t.key as any"
          :class="[
            'px-4 py-2 rounded-lg transition flex items-center gap-1.5 whitespace-nowrap',
            activeTab === t.key
              ? 'bg-white dark:bg-mist-dark text-clay shadow-xs'
              : 'text-ink/60 dark:text-white/60 hover:text-ink dark:hover:text-white'
          ]"
        >
          <span>{{ t.label }}</span>
          <span v-if="t.count" class="min-w-5 h-5 px-1 rounded-full bg-clay/15 text-clay text-[10px] flex items-center justify-center font-bold">
            {{ t.count }}
          </span>
        </button>
      </div>

      <!-- Search Input -->
      <div class="relative w-full sm:w-72">
        <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/30 dark:text-white/30 text-sm">🔍</span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Filter by name, skill, or city…"
          class="w-full rounded-xl bg-mist/30 dark:bg-white/5 border border-mist dark:border-white/10 pl-9 pr-3 py-2 text-sm text-ink dark:text-[#F0EDE6] placeholder:text-ink/35 dark:placeholder:text-white/35 outline-none focus:ring-2 focus:ring-clay/30 focus:border-clay transition"
        />
      </div>
    </div>

    <!-- Providers List -->
    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="h-44 rounded-2xl bg-mist/50 dark:bg-mist-dark/50 animate-pulse"></div>
    </div>

    <div v-else-if="!filteredProviders.length" class="border border-dashed border-mist dark:border-white/15 rounded-2xl p-16 text-center text-ink/50 dark:text-white/50">
      <p class="text-3xl mb-2">🎉</p>
      <p class="font-semibold text-ink dark:text-[#F0EDE6]">No applications in this queue</p>
      <p class="text-xs text-ink/50 dark:text-white/50 mt-1">All provider verification requests have been reviewed.</p>
    </div>

    <div v-else class="space-y-5">
      <div
        v-for="p in filteredProviders"
        :key="p.id"
        class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 shadow-xs hover:border-clay/30 transition"
      >
        <div class="flex items-start justify-between gap-4 flex-wrap pb-4 border-b border-mist dark:border-white/10">
          <div class="flex items-start gap-4 min-w-0">
            <div class="w-12 h-12 rounded-full bg-clay/10 text-clay flex items-center justify-center font-display font-bold text-base shrink-0">
              {{ (p.name || 'P').charAt(0) }}
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="font-display font-semibold text-lg text-ink dark:text-[#F0EDE6]">{{ p.name || 'Provider' }}</h3>
                <span :class="['text-xs font-bold px-2.5 py-0.5 rounded-full border capitalize', statusBadge(p.verification_status)]">
                  {{ p.verification_status }}
                </span>
                <span v-if="p.pending_documents" class="text-[10px] font-bold bg-clay/15 text-clay px-2 py-0.5 rounded-full">
                  {{ p.pending_documents }} new doc{{ p.pending_documents === 1 ? '' : 's' }}
                </span>
              </div>
              <p class="text-sm font-medium text-clay mt-0.5">{{ p.professional_title || '—' }}</p>
              <p class="text-xs text-ink/50 dark:text-white/50 mt-0.5">
                📍 {{ p.city || '—' }} · 📞 {{ p.phone || '—' }} · ✉️ {{ p.email }}
              </p>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <button
              v-if="p.verification_status !== 'verified'"
              @click="decide(p.id, 'verified', p.name)"
              :disabled="actionLoading === p.id"
              class="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold text-xs px-4 py-2 rounded-full transition shadow-xs"
            >
              ✓ Verify
            </button>
            <button
              v-if="p.verification_status === 'pending'"
              @click="decide(p.id, 'rejected', p.name)"
              :disabled="actionLoading === p.id"
              class="border border-amber-400 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 disabled:opacity-50 text-xs font-semibold px-4 py-2 rounded-full transition"
            >
              Reject
            </button>
            <button
              v-if="p.verification_status !== 'suspended'"
              @click="decide(p.id, 'suspended', p.name)"
              :disabled="actionLoading === p.id"
              class="border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 text-xs font-semibold px-4 py-2 rounded-full transition"
            >
              Suspend
            </button>
            <NuxtLink
              :to="`/providers/${p.id}`"
              class="border border-mist dark:border-white/15 text-ink/70 dark:text-white/70 hover:border-clay/40 text-xs font-semibold px-3 py-2 rounded-full transition"
            >
              Profile →
            </NuxtLink>
          </div>
        </div>

        <!-- Details grid -->
        <div class="pt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <span class="text-ink/40 dark:text-white/40 block mb-1 font-semibold uppercase">Professional Bio</span>
            <p class="text-ink/70 dark:text-white/70 leading-relaxed">{{ p.bio || 'No bio provided.' }}</p>
            <p class="text-ink/60 dark:text-white/60 mt-2">Experience: <strong>{{ p.experience_years ?? 0 }} yrs</strong> · Applied {{ formatDate(p.applied_at) }}</p>
          </div>
          <div>
            <span class="text-ink/40 dark:text-white/40 block mb-1 font-semibold uppercase">Skills</span>
            <div class="flex flex-wrap gap-1.5">
              <span v-for="s in p.skills" :key="s" class="bg-mist/60 dark:bg-white/5 text-ink/70 dark:text-white/70 px-2 py-1 rounded-md">{{ s }}</span>
              <span v-if="!p.skills?.length" class="text-ink/40">None listed</span>
            </div>
          </div>
          <div>
            <span class="text-ink/40 dark:text-white/40 block mb-1 font-semibold uppercase">Verification Documents</span>
            <div v-if="!p.documents?.length" class="text-ink/40">No documents uploaded.</div>
            <ul v-else class="space-y-1.5">
              <li v-for="d in p.documents" :key="d.id" class="flex items-center justify-between gap-2">
                <a :href="d.file_url" target="_blank" rel="noopener" class="text-clay hover:underline truncate">
                  📄 {{ d.document_name }}
                </a>
                <span :class="['text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize shrink-0', statusBadge(d.verification_status)]">{{ d.verification_status }}</span>
              </li>
            </ul>
          </div>
        </div>

      </div>
    </div>

  </div>
</template>
