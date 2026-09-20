<script setup lang="ts">
definePageMeta({ layout: 'default', middleware: ['auth', 'customer-only'] })

const { apiFetch, token } = useApi()
const router = useRouter()
const goBack = useGoBack('/dashboard')

const jobs = ref<any[]>([])
const loading = ref(true)
const filter = ref<'all' | 'open' | 'closed'>('all')

onMounted(async () => {
  if (!token.value) {
    router.push('/login')
    return
  }
  await loadJobs()
})

async function loadJobs() {
  loading.value = true
  try {
    const res = await apiFetch<any>('/my-jobs')
    jobs.value = res.data ?? []
  } catch {
    jobs.value = []
  } finally {
    loading.value = false
  }
}

const filteredJobs = computed(() => {
  if (filter.value === 'open') return jobs.value.filter(j => j.status === 'open')
  if (filter.value === 'closed') return jobs.value.filter(j => j.status !== 'open')
  return jobs.value
})

function formatDate(d: string) {
  if (!d) return ''
  return new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d))
}

const deletingId = ref<number | null>(null)
async function deleteJob(job: any) {
  if (!confirm(`Delete "${job.title}"? This closes the job and providers can no longer send offers.`)) return
  deletingId.value = job.id
  try {
    await apiFetch(`/jobs/${job.id}`, { method: 'DELETE' })
    await loadJobs()
  } catch (err: any) {
    alert(err?.data?.message || 'Failed to delete this job.')
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-6 py-8 sm:py-12">
    <!-- Back navigation -->
    <div class="mb-4">
      <button @click="goBack" class="inline-flex items-center gap-1.5 text-xs font-semibold text-clay hover:underline">
        <span>←</span> Back to Dashboard
      </button>
    </div>

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-mist dark:border-white/10">
      <div>
        <p class="text-xs font-bold text-clay uppercase tracking-wider mb-1">Customer Workspace</p>
        <h1 class="font-display text-3xl font-extrabold text-ink dark:text-[#F0EDE6]">
          My Posted Jobs
        </h1>
        <p class="text-sm text-ink/60 dark:text-white/60 mt-1">
          Review, manage, and accept proposals on jobs you have commissioned.
        </p>
      </div>

      <NuxtLink
        to="/jobs/post"
        class="inline-flex items-center gap-2 bg-clay hover:bg-clay/90 text-white text-xs font-bold px-5 py-3 rounded-full shadow-md transition shrink-0"
      >
        <span>➕</span> Post a New Job
      </NuxtLink>
    </div>

    <!-- Filter tabs -->
    <div class="flex gap-2 mb-6">
      <button
        v-for="f in (['all', 'open', 'closed'] as const)"
        :key="f"
        @click="filter = f"
        :class="[
          'px-4 py-2 rounded-full text-xs font-bold capitalize transition',
          filter === f
            ? 'bg-clay text-white shadow-xs'
            : 'bg-white dark:bg-mist-dark border border-mist dark:border-white/10 text-ink/70 dark:text-white/70 hover:bg-mist/40'
        ]"
      >
        {{ f === 'all' ? `All Jobs (${jobs.length})` : f }}
      </button>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="h-36 rounded-2xl bg-mist/50 dark:bg-mist-dark/50 animate-pulse"></div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!filteredJobs.length" class="border border-dashed border-mist dark:border-white/15 rounded-3xl p-16 text-center bg-white dark:bg-mist-dark/30">
      <div class="text-3xl mb-3">💼</div>
      <p class="font-display font-bold text-lg text-ink dark:text-[#F0EDE6] mb-1">No jobs found</p>
      <p class="text-sm text-ink/50 dark:text-white/50 mb-6">You haven't posted any jobs under this filter yet.</p>
      <NuxtLink
        to="/jobs/post"
        class="inline-flex items-center gap-2 bg-clay hover:bg-clay/90 text-white text-xs font-bold px-5 py-2.5 rounded-full transition shadow-sm"
      >
        Post Your First Job →
      </NuxtLink>
    </div>

    <!-- Job Cards List -->
    <div v-else class="space-y-4">
      <div
        v-for="job in filteredJobs"
        :key="job.id"
        class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 shadow-xs hover:border-clay/40 transition"
      >
        <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-3">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 mb-1.5 flex-wrap">
              <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-mist dark:bg-white/10 text-ink/70 dark:text-white/70">
                {{ job.category?.name || 'General' }}
              </span>
              <span
                :class="[
                  'text-xs font-bold px-2.5 py-0.5 rounded-full',
                  job.status === 'open'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-mist text-ink/50 dark:bg-white/5 dark:text-white/40'
                ]"
              >
                {{ job.status === 'open' ? '🟢 Open for Offers' : 'Closed' }}
              </span>
            </div>

            <NuxtLink :to="`/jobs/${job.id}`" class="block group">
              <h2 class="font-display text-xl font-bold text-ink dark:text-[#F0EDE6] group-hover:text-clay transition truncate">
                {{ job.title }}
              </h2>
            </NuxtLink>
          </div>

          <!-- Budget -->
          <div class="text-left sm:text-right shrink-0">
            <p class="text-xs text-ink/50 dark:text-white/50">Budget</p>
            <p class="font-display text-xl font-bold text-clay">ETB {{ Number(job.budget).toLocaleString() }}</p>
          </div>
        </div>

        <p class="text-xs sm:text-sm text-ink/70 dark:text-white/70 line-clamp-2 mb-4 leading-relaxed">
          {{ job.description }}
        </p>

        <div class="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-mist dark:border-white/10 text-xs">
          <div class="flex items-center gap-4 text-ink/50 dark:text-white/50">
            <span>🗓️ Posted {{ formatDate(job.created_at) }}</span>
            <span v-if="job.location">📍 {{ job.location }}</span>
          </div>

          <div class="flex items-center gap-2">
            <template v-if="job.status === 'open'">
              <NuxtLink
                :to="`/jobs/post?edit=${job.id}`"
                class="px-3 py-2 rounded-xl border border-mist dark:border-white/15 text-ink/70 dark:text-white/70 hover:border-clay hover:text-clay font-bold text-xs transition"
              >
                Edit
              </NuxtLink>
              <button
                @click="deleteJob(job)"
                :disabled="deletingId === job.id"
                class="px-3 py-2 rounded-xl border border-mist dark:border-white/15 text-ink/70 dark:text-white/70 hover:border-red-400 hover:text-red-600 disabled:opacity-50 font-bold text-xs transition"
              >
                {{ deletingId === job.id ? 'Deleting…' : 'Delete' }}
              </button>
            </template>
            <NuxtLink
              :to="`/jobs/${job.id}`"
              class="px-4 py-2 rounded-xl bg-clay hover:bg-clay/90 text-white font-bold text-xs transition shadow-xs flex items-center gap-1.5"
            >
              <span>Manage & Review Offers</span>
              <span>→</span>
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>
