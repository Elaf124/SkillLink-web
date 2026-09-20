<script setup lang="ts">
const props = defineProps<{
  isOpen: boolean
  provider: any
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'invited', data: { providerId: number | string; jobId: number | string; jobTitle: string }): void
}>()

const { apiFetch, token } = useApi()
const { getProviderAvatar, handleAvatarError } = useProviderAvatar()
const { startOrGetThread, sendMessage, initializeChat } = useChat()
const router = useRouter()

const loadingJobs = ref(false)
const sending = ref(false)
const successMessage = ref('')
const errorMessage = ref('')
const myJobs = ref<any[]>([])
const selectedJobId = ref<number | string | null>(null)
const inviteMessage = ref('')
const currentUser = ref<any>(null)

const isCustomer = computed(() => {
  if (!currentUser.value) return true
  return currentUser.value.role?.name !== 'provider'
})

const openJobs = computed(() => {
  return myJobs.value.filter(j => j.status === 'open' || !j.status)
})

const selectedJob = computed(() => {
  return openJobs.value.find(j => j.id === selectedJobId.value) || null
})

watch(() => props.isOpen, async (newVal) => {
  if (newVal) {
    successMessage.value = ''
    errorMessage.value = ''
    await loadInitialData()
  }
})

watch(selectedJob, (newJob) => {
  if (newJob && props.provider) {
    const name = props.provider.user?.first_name || 'there'
    inviteMessage.value = `Hi ${name}, I reviewed your impressive profile and experience on SkillLink. I'd love to invite you to review and submit a proposal for my job: "${newJob.title}". Looking forward to hearing from you!`
  }
})

async function loadInitialData() {
  if (!token.value) return

  loadingJobs.value = true
  try {
    const [userRes, jobsRes] = await Promise.allSettled([
      apiFetch<any>('/user'),
      apiFetch<any>('/my-jobs')
    ])

    if (userRes.status === 'fulfilled') {
      currentUser.value = userRes.value
    }

    if (jobsRes.status === 'fulfilled') {
      const data = jobsRes.value.data ?? jobsRes.value ?? []
      myJobs.value = Array.isArray(data) ? data : []
      if (openJobs.value.length > 0) {
        selectedJobId.value = openJobs.value[0].id
      }
    }
  } catch (err: any) {
    console.error('Failed loading jobs for invite:', err)
  } finally {
    loadingJobs.value = false
  }
}

async function handleSendInvite() {
  if (!selectedJob.value) {
    errorMessage.value = 'Please select an open job to invite this professional to.'
    return
  }

  sending.value = true
  errorMessage.value = ''

  try {
    await initializeChat()

    const providerId = props.provider.id
    const providerName = `${props.provider.user?.first_name || ''} ${props.provider.user?.last_name || ''}`.trim() || 'Professional'

    // Create / open chat thread with Job context
    const threadId = startOrGetThread({
      participantId: providerId,
      participantName: providerName,
      participantRole: 'provider',
      participantTitle: props.provider.professional_title || 'Specialist',
      context: {
        type: 'job',
        id: selectedJob.value.id,
        title: selectedJob.value.title,
        amount: Number(selectedJob.value.budget || 0)
      }
    })

    // Send invitation message
    const invitationText = `🤝 **JOB INVITATION**\n\nYou've been invited to apply for: **${selectedJob.value.title}** (Budget: ${selectedJob.value.budget ? Number(selectedJob.value.budget).toLocaleString() + ' ETB' : 'Flexible'})\n\n"${inviteMessage.value.trim()}"`
    sendMessage(threadId, invitationText)

    successMessage.value = `Invitation sent successfully to ${providerName}!`
    emit('invited', {
      providerId: props.provider.id,
      jobId: selectedJob.value.id,
      jobTitle: selectedJob.value.title
    })

    setTimeout(() => {
      emit('close')
    }, 1800)
  } catch (err: any) {
    errorMessage.value = 'Could not send the invitation. Please try again.'
  } finally {
    sending.value = false
  }
}

function handlePostJob() {
  emit('close')
  router.push(`/jobs/post?invited_provider=${props.provider?.id || ''}`)
}

function handleLogin() {
  emit('close')
  router.push(`/login?redirect=${encodeURIComponent(router.currentRoute.value.fullPath)}`)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
        @click="emit('close')"
      ></div>

      <!-- Modal Card -->
      <div
        class="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-10 transition-all transform animate-in fade-in zoom-in-95 duration-200"
      >
        <!-- Modal Header -->
        <div class="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-850">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg">
              ✉️
            </div>
            <div>
              <h2 class="font-display text-lg font-bold text-slate-900 dark:text-white">
                Invite to Job
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Directly invite this verified professional to quote your project
              </p>
            </div>
          </div>
          <button
            @click="emit('close')"
            class="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        <!-- Provider Summary Row -->
        <div v-if="provider" class="px-6 py-4 bg-slate-50/70 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4">
          <div class="relative shrink-0">
            <img
              :src="getProviderAvatar(provider)"
              :alt="provider.user?.first_name || 'Provider'"
              @error="(e) => handleAvatarError(e, provider)"
              class="w-14 h-14 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-sm"
            />
            <span class="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900"></span>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h3 class="font-display font-bold text-slate-900 dark:text-white text-base truncate">
                {{ provider.user?.first_name }} {{ provider.user?.last_name }}
              </h3>
              <span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                Verified Pro
              </span>
            </div>
            <p class="text-xs text-slate-600 dark:text-slate-300 font-medium truncate mt-0.5">
              {{ provider.professional_title || 'Certified Expert' }}
            </p>
            <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
              <span class="text-amber-500 font-bold">★ {{ Number(provider.average_rating || 5.0).toFixed(1) }}</span>
              <span>•</span>
              <span>{{ provider.completed_jobs || 0 }} completed jobs</span>
              <span>•</span>
              <span class="text-emerald-600 dark:text-emerald-400 font-medium">100% Job Success</span>
            </div>
          </div>
        </div>

        <!-- Body -->
        <div class="p-6">
          <!-- 1. Guest / Not Logged In -->
          <div v-if="!token" class="text-center py-6">
            <div class="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-2xl flex items-center justify-center mx-auto mb-3">
              🔒
            </div>
            <h4 class="font-display font-bold text-slate-900 dark:text-white text-base mb-1">
              Sign In to Invite Talent
            </h4>
            <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6">
              Create a free customer account or sign in to commission jobs and invite top Ethiopian professionals directly.
            </p>
            <div class="flex items-center justify-center gap-3">
              <button
                @click="handleLogin"
                class="px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition"
              >
                Sign In / Register →
              </button>
              <button
                @click="emit('close')"
                class="px-5 py-2.5 rounded-full border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
            </div>
          </div>

          <!-- 2. Success Alert -->
          <div v-else-if="successMessage" class="p-6 text-center">
            <div class="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-3xl flex items-center justify-center mx-auto mb-3 animate-bounce">
              ✓
            </div>
            <h4 class="font-display font-bold text-slate-900 dark:text-white text-lg mb-1">
              Invitation Sent!
            </h4>
            <p class="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
              {{ successMessage }}
            </p>
          </div>

          <!-- 3. Loading State -->
          <div v-else-if="loadingJobs" class="py-10 text-center space-y-3">
            <div class="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">Fetching your posted jobs…</p>
          </div>

          <!-- 4. No Posted Jobs -->
          <div v-else-if="openJobs.length === 0" class="text-center py-6">
            <div class="w-14 h-14 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-2xl flex items-center justify-center mx-auto mb-3">
              💼
            </div>
            <h4 class="font-display font-bold text-slate-900 dark:text-white text-base mb-1">
              You haven't posted any jobs yet
            </h4>
            <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6">
              To invite {{ provider.user?.first_name || 'this provider' }}, post an open job outlining your task, timeline, and budget. It only takes two minutes!
            </p>
            <div class="flex items-center justify-center gap-3">
              <button
                @click="handlePostJob"
                class="px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition flex items-center gap-2"
              >
                <span>➕</span> Post an Open Job
              </button>
              <button
                @click="emit('close')"
                class="px-5 py-2.5 rounded-full border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Not Now
              </button>
            </div>
          </div>

          <!-- 5. Job Selection & Message Form -->
          <form v-else @submit.prevent="handleSendInvite" class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
                1. Select Which Job to Invite To:
              </label>
              <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
                <label
                  v-for="job in openJobs"
                  :key="job.id"
                  :class="[
                    'flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition text-left',
                    selectedJobId === job.id
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500/40'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                  ]"
                >
                  <div class="flex items-center gap-3 min-w-0">
                    <input
                      type="radio"
                      :value="job.id"
                      v-model="selectedJobId"
                      class="text-emerald-600 focus:ring-emerald-500 h-4 w-4 shrink-0"
                    />
                    <div class="min-w-0">
                      <p class="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                        {{ job.title }}
                      </p>
                      <p class="text-[11px] text-slate-500 dark:text-slate-400">
                        {{ job.category?.name || 'General' }} • Status: <span class="capitalize text-emerald-600 dark:text-emerald-400 font-semibold">{{ job.status || 'Open' }}</span>
                      </p>
                    </div>
                  </div>
                  <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0 ml-3">
                    {{ job.budget ? Number(job.budget).toLocaleString() + ' ETB' : 'Flexible' }}
                  </span>
                </label>
              </div>
            </div>

            <!-- Message Textarea -->
            <div>
              <label class="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
                2. Personal Invitation Note:
              </label>
              <textarea
                v-model="inviteMessage"
                rows="3"
                placeholder="Write a brief note explaining why you think they'd be a great match..."
                class="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
              ></textarea>
            </div>

            <div v-if="errorMessage" class="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs">
              {{ errorMessage }}
            </div>

            <!-- Footer Actions -->
            <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                @click="emit('close')"
                class="px-4 py-2.5 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="sending || !selectedJobId"
                class="px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition flex items-center gap-2 disabled:opacity-50"
              >
                <span v-if="sending" class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>{{ sending ? 'Sending Invite…' : 'Send Invitation' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </Teleport>
</template>
