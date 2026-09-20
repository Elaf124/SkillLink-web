<script setup>
definePageMeta({ layout: 'default' })

const { apiFetch, token } = useApi()
const router = useRouter()
const route = useRoute()
const goBack = useGoBack('/dashboard')

// When ?edit=<jobId> is present the page edits an existing open job instead of
// creating a new one. The backend only allows edits while the job is 'open'.
const editId = computed(() => {
  const raw = route.query.edit
  return raw ? Number(raw) : null
})
const isEdit = computed(() => editId.value != null)

// Auth guard
onMounted(async () => {
  if (!token.value) {
    router.push('/login')
    return
  }
  let me
  try {
    me = await apiFetch('/user')
    if (me.role?.name === 'provider') {
      router.push('/dashboard')
      return
    }
  } catch {
    router.push('/login')
    return
  }
  await loadCategories()
  if (isEdit.value) await loadJobForEdit(me?.id)
})

async function loadJobForEdit(myId) {
  try {
    const res = await apiFetch(`/jobs/${editId.value}`)
    const job = res.data
    if (!job || (myId && job.customer_id !== myId)) {
      router.push('/my-jobs')
      return
    }
    if (job.status !== 'open') {
      error.value = 'This job can no longer be edited because it is no longer open.'
      setTimeout(() => router.push(`/jobs/${job.id}`), 1500)
      return
    }
    form.value.title = job.title ?? ''
    form.value.description = job.description ?? ''
    form.value.category_id = job.category_id ?? job.category?.id ?? ''
    form.value.budget = job.budget != null ? String(job.budget) : ''
    form.value.location = job.location ?? ''
    form.value.preferred_date = job.preferred_date ? String(job.preferred_date).split('T')[0] : ''
    form.value.work_type = (job.location && job.location.toLowerCase() === 'remote') ? 'remote' : 'in_person'
  } catch {
    router.push('/my-jobs')
  }
}

const categories = ref([])
const loading = ref(false)
const error = ref('')
const attachments = ref([])

// AI assistant state
const showAiModal = ref(false)
const aiPrompt = ref('')
const aiGenerating = ref(false)
const aiImproving = ref(false)
const aiNotice = ref('')

const form = ref({
  title: '',
  description: '',
  category_id: '',
  work_type: 'in_person', // 'in_person' | 'remote'
  budget_type: 'fixed', // 'fixed' | 'hourly'
  budget: '',
  location: '',
  preferred_date: '',
})

async function loadCategories() {
  try {
    const res = await apiFetch('/categories')
    categories.value = res.data
  } catch {}
}

const isValid = computed(() =>
  form.value.title.trim().length >= 5 &&
  form.value.description.trim().length >= 20 &&
  form.value.category_id &&
  form.value.budget &&
  Number(form.value.budget) > 0 &&
  (form.value.work_type === 'remote' || form.value.location.trim().length > 0)
)

async function generateWithAi() {
  if (!aiPrompt.value.trim()) return
  aiGenerating.value = true
  aiNotice.value = ''
  try {
    const res = await $fetch('/api/ai-job-assistant', {
      method: 'POST',
      body: {
        mode: 'generate',
        prompt: aiPrompt.value.trim(),
      }
    })
    if (res.title) form.value.title = res.title
    if (res.description) form.value.description = res.description
    if (res.suggested_budget_type) form.value.budget_type = res.suggested_budget_type
    if (res.suggested_budget && !form.value.budget) form.value.budget = res.suggested_budget

    // Auto-match category if possible
    if (categories.value.length > 0 && !form.value.category_id) {
      const p = aiPrompt.value.toLowerCase()
      const matched = categories.value.find(c =>
        p.includes(c.name.toLowerCase()) ||
        (c.name.toLowerCase().includes('electric') && p.includes('wire')) ||
        (c.name.toLowerCase().includes('plumb') && p.includes('pipe')) ||
        (c.name.toLowerCase().includes('design') && (p.includes('logo') || p.includes('ui'))) ||
        (c.name.toLowerCase().includes('web') && (p.includes('site') || p.includes('app')))
      )
      if (matched) form.value.category_id = matched.id
    }

    showAiModal.value = false
    aiPrompt.value = ''
    aiNotice.value = '✨ Job details drafted by AI! You can edit any field before posting.'
  } catch (err) {
    aiNotice.value = 'Could not generate with AI. Please fill in details manually.'
  } finally {
    aiGenerating.value = false
  }
}

async function improveDescriptionWithAi() {
  if (!form.value.description.trim()) return
  aiImproving.value = true
  aiNotice.value = ''
  try {
    const res = await $fetch('/api/ai-job-assistant', {
      method: 'POST',
      body: {
        mode: 'improve',
        title: form.value.title,
        description: form.value.description,
      }
    })
    if (res.improved_description) {
      form.value.description = res.improved_description
      aiNotice.value = '✨ Description polished with AI!'
    }
  } catch {
    aiNotice.value = 'AI refinement currently unavailable.'
  } finally {
    aiImproving.value = false
  }
}

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    if (isEdit.value) {
      const body = {
        title: form.value.title,
        description: form.value.description,
        category_id: form.value.category_id,
        budget: form.value.budget,
        location: form.value.location || null,
        preferred_date: form.value.preferred_date || null,
      }
      await apiFetch(`/jobs/${editId.value}`, { method: 'PUT', body })
      router.push(`/jobs/${editId.value}`)
      return
    }
    const payload = new FormData()
    for (const [key, value] of Object.entries(form.value)) {
      if (value !== '') payload.append(key, String(value))
    }
    attachments.value.forEach(file => payload.append('attachments[]', file))
    const res = await apiFetch('/jobs', { method: 'POST', body: payload })
    router.push(`/jobs/${res.data.id}`)
  } catch (err) {
    const errors = err?.data?.errors
    error.value = errors
      ? Object.values(errors).flat().join(' ')
      : err?.data?.message || 'Failed to post job. Please try again.'
  } finally {
    loading.value = false
  }
}

function selectAttachments(event) {
  const input = event.target
  const files = Array.from(input.files || [])
  attachments.value = files.slice(0, 5)
}

function removeAttachment(index) {
  attachments.value.splice(index, 1)
}

const today = computed(() => new Date().toISOString().split('T')[0])
</script>

<template>
  <div class="max-w-3xl mx-auto px-6 py-8">
    <!-- Back arrow -->
    <div class="mb-4">
      <button @click="goBack" class="inline-flex items-center gap-1.5 text-xs font-semibold text-clay hover:underline">
        <span>←</span> Back
      </button>
    </div>

    <!-- Page header & AI Prompt CTA -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-mist dark:border-white/10">
      <div>
        <p class="text-xs font-bold text-clay uppercase tracking-wider mb-1">Customer Job Portal</p>
        <h1 class="font-display text-3xl sm:text-4xl font-extrabold text-ink dark:text-[#F0EDE6]">
          {{ isEdit ? 'Edit Your Job Post' : 'Post a Job & Receive Bids' }}
        </h1>
        <p class="text-sm text-ink/60 dark:text-white/60 mt-1">
          {{ isEdit
            ? 'Update the details below. Changes are visible to providers immediately.'
            : 'Describe your requirement. Verified providers across Ethiopia will submit custom offers.' }}
        </p>
      </div>

      <!-- AI Generate Action Button -->
      <button
        type="button"
        @click="showAiModal = true"
        class="shrink-0 inline-flex items-center gap-2 bg-gradient-to-r from-clay to-amber-600 hover:from-clay/90 hover:to-amber-500 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-md transition transform hover:-translate-y-0.5"
      >
        <span class="text-sm">✨</span> Generate with AI
      </button>
    </div>

    <!-- Success / AI Notice banner -->
    <div v-if="aiNotice" class="mb-6 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-medium text-amber-800 dark:text-amber-300 flex items-center justify-between">
      <span>{{ aiNotice }}</span>
      <button @click="aiNotice = ''" class="text-amber-600 dark:text-amber-400 font-bold ml-2">✕</button>
    </div>

    <!-- Combined Single-Page Form -->
    <form @submit.prevent="handleSubmit" class="space-y-8">

      <!-- SECTION 1: Job Details -->
      <div class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 sm:p-7 shadow-xs space-y-5">
        <h2 class="font-display text-lg font-bold text-ink dark:text-[#F0EDE6] flex items-center gap-2">
          <span>📋</span> 1. Job Information
        </h2>

        <!-- Title -->
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-ink dark:text-[#F0EDE6] mb-1.5">
            Job Title <span class="text-clay">*</span>
          </label>
          <input
            v-model="form.title"
            type="text"
            required
            placeholder="e.g., Fix electrical circuit breaker, Design brand identity & logo, Water pump installation…"
            class="w-full rounded-xl border border-mist dark:border-white/15 bg-mist/20 dark:bg-canvas-dark px-4 py-3 text-sm text-ink dark:text-[#F0EDE6] placeholder:text-ink/35 dark:placeholder:text-white/35 outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition"
          />
          <p class="text-[11px] text-ink/40 dark:text-white/40 mt-1">Min. 5 characters</p>
        </div>

        <!-- Category -->
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-ink dark:text-[#F0EDE6] mb-1.5">
            Category <span class="text-clay">*</span>
          </label>
          <select
            v-model="form.category_id"
            required
            class="w-full rounded-xl border border-mist dark:border-white/15 bg-mist/20 dark:bg-canvas-dark px-4 py-3 text-sm text-ink dark:text-[#F0EDE6] outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition cursor-pointer"
          >
            <option value="" disabled>Select a category…</option>
            <template v-for="cat in categories" :key="cat.id">
              <optgroup v-if="cat.children && cat.children.length" :label="cat.name">
                <option :value="cat.id">{{ cat.name }} (All)</option>
                <option v-for="child in cat.children" :key="child.id" :value="child.id">
                  {{ child.name }}
                </option>
              </optgroup>
              <option v-else :value="cat.id">{{ cat.name }}</option>
            </template>
          </select>
        </div>

        <!-- Description with AI Help -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="block text-xs font-bold uppercase tracking-wider text-ink dark:text-[#F0EDE6]">
              Detailed Description <span class="text-clay">*</span>
            </label>
            <button
              v-if="form.description.trim().length > 10"
              type="button"
              @click="improveDescriptionWithAi"
              :disabled="aiImproving"
              class="text-[11px] font-bold text-clay hover:underline flex items-center gap-1 disabled:opacity-50"
            >
              <span>✨</span> {{ aiImproving ? 'Polishing…' : 'Improve with AI' }}
            </button>
          </div>
          <textarea
            v-model="form.description"
            required
            rows="5"
            placeholder="Explain what needs to be done, requirements, tools or materials needed, timeline, and expectations…"
            class="w-full rounded-xl border border-mist dark:border-white/15 bg-mist/20 dark:bg-canvas-dark px-4 py-3 text-sm text-ink dark:text-[#F0EDE6] placeholder:text-ink/35 dark:placeholder:text-white/35 outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition resize-y"
          ></textarea>
          <div class="flex justify-between items-center mt-1">
            <p class="text-[11px] text-ink/40 dark:text-white/40">Min. 20 characters</p>
            <p
              :class="[
                'text-[11px] font-medium transition',
                form.description.length < 20 ? 'text-clay' : 'text-ink/40 dark:text-white/40'
              ]"
            >
              {{ form.description.length }} chars
            </p>
          </div>
        </div>

        <!-- Work Type: Remote vs In-Person Toggle -->
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-ink dark:text-[#F0EDE6] mb-2">
            Work Arrangement <span class="text-clay">*</span>
          </label>
          <div class="grid grid-cols-2 gap-3">
            <button
              type="button"
              @click="form.work_type = 'in_person'"
              :class="[
                'flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-semibold transition',
                form.work_type === 'in_person'
                  ? 'border-clay bg-clay/10 text-clay shadow-xs'
                  : 'border-mist dark:border-white/15 text-ink/70 dark:text-white/70 hover:bg-mist/40'
              ]"
            >
              <span>📍</span> In-Person / On-Site
            </button>
            <button
              type="button"
              @click="form.work_type = 'remote'; if (!form.location) form.location = 'Remote'"
              :class="[
                'flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-semibold transition',
                form.work_type === 'remote'
                  ? 'border-clay bg-clay/10 text-clay shadow-xs'
                  : 'border-mist dark:border-white/15 text-ink/70 dark:text-white/70 hover:bg-mist/40'
              ]"
            >
              <span>🌐</span> Remote / Online
            </button>
          </div>
        </div>
      </div>

      <!-- SECTION 2: Budget, Pricing Model & Location -->
      <div class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 sm:p-7 shadow-xs space-y-5">
        <h2 class="font-display text-lg font-bold text-ink dark:text-[#F0EDE6] flex items-center gap-2">
          <span>💰</span> 2. Budget & Location
        </h2>

        <!-- Budget Type Toggle: Fixed vs Hourly -->
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-ink dark:text-[#F0EDE6] mb-2">
            Budget Type <span class="text-clay">*</span>
          </label>
          <div class="grid grid-cols-2 gap-3">
            <button
              type="button"
              @click="form.budget_type = 'fixed'"
              :class="[
                'flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-semibold transition',
                form.budget_type === 'fixed'
                  ? 'border-clay bg-clay/10 text-clay shadow-xs'
                  : 'border-mist dark:border-white/15 text-ink/70 dark:text-white/70 hover:bg-mist/40'
              ]"
            >
              <span>🔒</span> Fixed Price Budget
            </button>
            <button
              type="button"
              @click="form.budget_type = 'hourly'"
              :class="[
                'flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-semibold transition',
                form.budget_type === 'hourly'
                  ? 'border-clay bg-clay/10 text-clay shadow-xs'
                  : 'border-mist dark:border-white/15 text-ink/70 dark:text-white/70 hover:bg-mist/40'
              ]"
            >
              <span>⏱️</span> Hourly Rate Budget
            </button>
          </div>
        </div>

        <!-- Budget Amount -->
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-ink dark:text-[#F0EDE6] mb-1.5">
            {{ form.budget_type === 'hourly' ? 'Hourly Rate (ETB / hr)' : 'Estimated Total Budget (ETB)' }} <span class="text-clay">*</span>
          </label>
          <div class="relative">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-ink/40 dark:text-white/40 text-sm font-bold">ETB</span>
            <input
              v-model="form.budget"
              type="number"
              min="1"
              required
              placeholder="0.00"
              class="w-full rounded-xl border border-mist dark:border-white/15 bg-mist/20 dark:bg-canvas-dark pl-14 pr-4 py-3 text-sm text-ink dark:text-[#F0EDE6] placeholder:text-ink/35 dark:placeholder:text-white/35 outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition font-semibold"
            />
          </div>
          <p class="text-[11px] text-ink/40 dark:text-white/40 mt-1">
            Providers will use this as a reference when sending competitive offers.
          </p>
        </div>

        <!-- Location & Target Date in 2 columns -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-ink dark:text-[#F0EDE6] mb-1.5">
              Service Location <span v-if="form.work_type === 'in_person'" class="text-clay">*</span>
            </label>
            <input
              v-model="form.location"
              type="text"
              :required="form.work_type === 'in_person'"
              :placeholder="form.work_type === 'remote' ? 'Remote (Online)' : 'e.g., Bole, Addis Ababa, Hawassa…'"
              class="w-full rounded-xl border border-mist dark:border-white/15 bg-mist/20 dark:bg-canvas-dark px-4 py-3 text-sm text-ink dark:text-[#F0EDE6] placeholder:text-ink/35 dark:placeholder:text-white/35 outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition"
            />
          </div>

          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-ink dark:text-[#F0EDE6] mb-1.5">
              Target Completion Date <span class="text-ink/40 font-normal">(Optional)</span>
            </label>
            <input
              v-model="form.preferred_date"
              type="date"
              :min="today"
              class="w-full rounded-xl border border-mist dark:border-white/15 bg-mist/20 dark:bg-canvas-dark px-4 py-3 text-sm text-ink dark:text-[#F0EDE6] outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition"
            />
          </div>
        </div>
      </div>

      <!-- Supporting files -->
      <div v-if="!isEdit" class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 sm:p-7 shadow-xs space-y-3">
        <h2 class="font-display text-lg font-bold text-ink dark:text-[#F0EDE6] flex items-center gap-2">
          <span>📎</span> Supporting Files <span class="text-sm font-normal text-ink/45 dark:text-white/45">(Optional)</span>
        </h2>
        <p class="text-xs text-ink/55 dark:text-white/55">Upload up to five photos or documents to help providers understand the work. Each file can be up to 10 MB.</p>
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx"
          @change="selectAttachments"
          class="block w-full text-xs text-ink/60 dark:text-white/60 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-xs file:font-bold file:text-teal-700 hover:file:bg-teal-100 dark:file:bg-teal-950/50 dark:file:text-teal-300"
        />
        <div v-if="attachments.length" class="flex flex-wrap gap-2 pt-1">
          <span v-for="(file, index) in attachments" :key="`${file.name}-${index}`" class="inline-flex items-center gap-2 rounded-lg bg-mist/50 dark:bg-white/5 px-3 py-1.5 text-xs text-ink/75 dark:text-white/75">
            <span class="max-w-44 truncate">{{ file.name }}</span>
            <button type="button" @click="removeAttachment(index)" class="font-bold text-clay hover:opacity-70" :aria-label="`Remove ${file.name}`">×</button>
          </span>
        </div>
      </div>

      <!-- Error message -->
      <p v-if="error" class="text-clay text-sm bg-clay/5 border border-clay/20 rounded-xl px-4 py-3">
        {{ error }}
      </p>

      <!-- Submit Action Button -->
      <div class="pt-2">
        <button
          type="submit"
          :disabled="loading || !isValid"
          class="w-full bg-clay hover:bg-clay/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-full transition text-base shadow-lg shadow-clay/20 flex items-center justify-center gap-2"
        >
          <span>{{ loading
            ? (isEdit ? 'Saving changes…' : 'Posting your job…')
            : (isEdit ? '💾 Save Changes' : '🚀 Publish Job & Receive Offers') }}</span>
        </button>
        <p class="text-xs text-center text-ink/45 dark:text-white/45 mt-3">
          {{ isEdit
            ? 'Providers who already sent an offer will see your updated details.'
            : 'Your job will be instantly visible to all verified providers on SkillLink with 100% escrow protection.' }}
        </p>
      </div>
    </form>

    <!-- ── AI Generator Modal ── -->
    <div
      v-if="showAiModal"
      class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      @click.self="showAiModal = false"
    >
      <div class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <span class="text-2xl">✨</span>
            <div>
              <h3 class="font-display text-lg font-bold text-ink dark:text-[#F0EDE6]">
                Generate Job with AI
              </h3>
              <p class="text-xs text-ink/50 dark:text-white/50">Describe your idea roughly, and AI will structure the entire job post.</p>
            </div>
          </div>
          <button @click="showAiModal = false" class="text-ink/40 dark:text-white/40 hover:text-clay text-lg">✕</button>
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-ink dark:text-[#F0EDE6] mb-1.5">
            What do you need done?
          </label>
          <textarea
            v-model="aiPrompt"
            rows="4"
            placeholder="e.g. I need an experienced electrician to inspect and rewire my main power distribution box in CMC Addis Ababa because power keeps tripping..."
            class="w-full rounded-xl border border-mist dark:border-white/15 bg-mist/20 dark:bg-canvas-dark px-4 py-3 text-sm text-ink dark:text-[#F0EDE6] placeholder:text-ink/35 dark:placeholder:text-white/35 outline-none focus:ring-2 focus:ring-clay/40 transition resize-none"
          ></textarea>
        </div>

        <div class="flex gap-3 pt-2">
          <button
            type="button"
            @click="showAiModal = false"
            class="flex-1 border border-mist dark:border-white/15 text-ink/70 dark:text-white/70 font-semibold py-2.5 rounded-xl hover:border-clay/40 transition text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="generateWithAi"
            :disabled="!aiPrompt.trim() || aiGenerating"
            class="flex-1 bg-clay hover:bg-clay/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl transition text-sm shadow-sm flex items-center justify-center gap-2"
          >
            <span>{{ aiGenerating ? 'Generating…' : '✨ Draft Post' }}</span>
          </button>
        </div>
      </div>
    </div>

  </div>
</template>
