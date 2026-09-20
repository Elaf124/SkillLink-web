<script setup>
// Provider onboarding / verification gate.
// Shown immediately after a user signs up as a provider — they can't enter the
// provider experience until this is submitted. Two flows: Individual and Company.
import { categories as CATEGORY_DATA } from '~/data/categories'

definePageMeta({ layout: false })

const { apiFetch, token } = useApi()
const { isDark, toggleTheme } = useTheme()
const router = useRouter()

const cityOptions = ['Addis Ababa', 'Bahir Dar', 'Hawassa', 'Mekelle', 'Adama', 'Dire Dawa', 'Gondar', 'Jimma', 'Other']

const user = ref(null)
const checking = ref(true)
const submitting = ref(false)
const submitError = ref('')
const showErrors = ref(false)

// ── Guard: only un-onboarded providers belong here ────────────────────────────
onMounted(async () => {
  if (!token.value) return router.replace('/login')
  try {
    user.value = await apiFetch('/user')
  } catch {
    token.value = null
    return router.replace('/login')
  }
  if (!user.value.email_verified_at) return router.replace('/verify-email')
  if (user.value?.role?.name !== 'provider') return router.replace('/dashboard')
  if (isOnboarded(user.value)) return router.replace('/dashboard')
  // Prefill what we already know
  form.value.phone = (user.value.phone ?? '').replace(/^\+?251/, '').replace(/^0/, '').trim()
  form.value.city = user.value.city ?? ''
  company.value.name = user.value.company_name ?? ''
  company.value.website = user.value.company_website ?? ''
  checking.value = false
})

function isOnboarded(u) {
  return checkIsProviderOnboarded(u)
}

// ── Mode toggle ──────────────────────────────────────────────────────────────
const mode = ref('individual') // 'individual' | 'company'

// ── Individual: About You ────────────────────────────────────────────────────
const form = ref({
  title: '',
  intro: '',
  phone: '',
  city: '',
  address: '',
})

const avatarFile = ref(null)
const avatarPreview = ref('')
function onAvatarChange(e) {
  const f = e.target.files?.[0]
  if (!f) return
  if (avatarPreview.value) URL.revokeObjectURL(avatarPreview.value)
  avatarFile.value = f
  avatarPreview.value = URL.createObjectURL(f)
}
function clearAvatar() {
  if (avatarPreview.value) URL.revokeObjectURL(avatarPreview.value)
  avatarFile.value = null
  avatarPreview.value = ''
}

const introWordCount = computed(() => form.value.intro.trim().split(/\s+/).filter(Boolean).length)

// ── Individual: Experience & Education (optional, repeatable) ─────────────────
const experience = ref([])
const education = ref([])
const addExperience = () => experience.value.push({ role: '', company: '', period: '' })
const addEducation = () => education.value.push({ qualification: '', institution: '', year: '' })
const removeExperience = (i) => experience.value.splice(i, 1)
const removeEducation = (i) => education.value.splice(i, 1)

// ── Individual: Identity Verification ───────────────────────────────────────
const idFile = ref(null)
function onIdChange(e) {
  const f = e.target.files?.[0]
  if (f) idFile.value = f
}

// ── Individual: Type of Work ────────────────────────────────────────────────
const workCategory = ref('')
const selectedSkills = ref([])
const otherSkillEnabled = ref(false)
const otherSkillText = ref('')

const currentCategorySkills = computed(() => {
  const cat = CATEGORY_DATA.find(c => c.name === workCategory.value)
  return cat ? cat.skills : []
})
watch(workCategory, () => { selectedSkills.value = [] })

function toggleSkill(name) {
  const i = selectedSkills.value.indexOf(name)
  if (i === -1) selectedSkills.value.push(name)
  else selectedSkills.value.splice(i, 1)
}

// ── Company: About You ──────────────────────────────────────────────────────
const company = ref({
  name: '',
  website: '',
  description: '',
})
const logoFile = ref(null)
const logoPreview = ref('')
function onLogoChange(e) {
  const f = e.target.files?.[0]
  if (!f) return
  if (logoPreview.value) URL.revokeObjectURL(logoPreview.value)
  logoFile.value = f
  logoPreview.value = URL.createObjectURL(f)
}
function clearLogo() {
  if (logoPreview.value) URL.revokeObjectURL(logoPreview.value)
  logoFile.value = null
  logoPreview.value = ''
}

// ── Company: Business Verification ─────────────────────────────────────────
const licenseFile = ref(null)
function onLicenseChange(e) {
  const f = e.target.files?.[0]
  if (f) licenseFile.value = f
}

// ── Company: Services ─────────────────────────────────────────────────────
const companyCategory = ref('')
const companyServices = ref([''])
const addCompanyService = () => companyServices.value.push('')
const removeCompanyService = (i) => companyServices.value.splice(i, 1)
const filledCompanyServices = computed(() => companyServices.value.map(s => s.trim()).filter(Boolean))

// ── Validation ────────────────────────────────────────────────────────────
const errors = computed(() => {
  const e = []
  if (mode.value === 'individual') {
    if (!avatarFile.value) e.push('Add a profile picture.')
    if (!form.value.title.trim()) e.push('Enter your professional title.')
    if (introWordCount.value < 100) e.push(`Your introduction needs at least 100 words (currently ${introWordCount.value}).`)
    if (!form.value.phone.trim()) e.push('Enter your phone number.')
    if (!form.value.city) e.push('Select your city.')
    if (!idFile.value) e.push('Upload your National ID or Passport.')
    if (!workCategory.value) e.push('Choose a category for your work.')
    const hasSkill = selectedSkills.value.length > 0 || (otherSkillEnabled.value && otherSkillText.value.trim())
    if (!hasSkill) e.push('Select at least one skill (or specify one under “Other”).')
    if (otherSkillEnabled.value && !otherSkillText.value.trim()) e.push('Describe your custom skill under “Other”.')
  } else {
    if (!logoFile.value) e.push('Upload your company logo.')
    if (!company.value.name.trim()) e.push('Enter your company name.')
    if (!company.value.website.trim()) e.push('Enter your company website URL.')
    if (!company.value.description.trim()) e.push('Add a company description.')
    if (!licenseFile.value) e.push('Upload your business license.')
    if (!companyCategory.value) e.push('Choose a service category.')
    if (filledCompanyServices.value.length < 1) e.push('Add at least one service.')
  }
  return e
})
const isValid = computed(() => errors.value.length === 0)

// ── Submit ────────────────────────────────────────────────────────────────
async function handleSubmit() {
  showErrors.value = true
  submitError.value = ''
  if (!isValid.value) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  submitting.value = true

  const fd = new FormData()
  fd.append('provider_type', mode.value)
  if (mode.value === 'individual') {
    fd.append('title', form.value.title)
    fd.append('introduction', form.value.intro)
    fd.append('phone', form.value.phone)
    fd.append('city', form.value.city)
    fd.append('address', form.value.address)
    if (avatarFile.value) fd.append('profile_picture', avatarFile.value)
    if (idFile.value) fd.append('identity_document', idFile.value)
    fd.append('experience', JSON.stringify(experience.value))
    fd.append('education', JSON.stringify(education.value))
    fd.append('work_category', workCategory.value)
    const skills = [...selectedSkills.value]
    if (otherSkillEnabled.value && otherSkillText.value.trim()) skills.push(otherSkillText.value.trim())
    fd.append('skills', JSON.stringify(skills))
  } else {
    fd.append('company_name', company.value.name)
    fd.append('company_website', company.value.website)
    fd.append('company_description', company.value.description)
    if (logoFile.value) fd.append('company_logo', logoFile.value)
    if (licenseFile.value) fd.append('business_license', licenseFile.value)
    fd.append('service_category', companyCategory.value)
    fd.append('services', JSON.stringify(filledCompanyServices.value))
  }

  try {
    await apiFetch('/provider/onboarding', { method: 'POST', body: fd })
  } catch (err) {
    // Backend endpoint may not be live yet — don't trap the provider on the gate.
    if (err?.status && err.status !== 404 && err.status !== 405) {
      submitError.value = err?.data?.message || 'Something went wrong submitting your application. Please try again.'
      submitting.value = false
      return
    }
  }

  if (import.meta.client && user.value) {
    localStorage.setItem(`skilllink_provider_onboarded_${user.value.id}`, 'true')
    sessionStorage.removeItem('skilllink_new_provider_signup')
  }
  router.replace('/dashboard')
}

async function signOut() {
  try { await apiFetch('/logout', { method: 'POST' }) } catch {}
  token.value = null
  router.replace('/login')
}

const fieldClass =
  'w-full rounded-xl border border-mist dark:border-white/15 bg-mist/20 dark:bg-canvas-dark px-4 py-3 text-sm text-ink dark:text-[#F0EDE6] placeholder:text-ink/35 dark:placeholder:text-white/35 outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition'
const labelClass = 'block text-xs font-bold uppercase tracking-wider text-ink dark:text-[#F0EDE6] mb-1.5'
</script>

<template>
  <div class="min-h-screen bg-canvas dark:bg-canvas-dark flex flex-col">
    <!-- Header -->
    <header class="border-b border-mist dark:border-mist-dark">
      <div class="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
        <NuxtLink to="/" class="transition-transform hover:scale-[1.02]"><BrandLogo /></NuxtLink>
        <div class="flex items-center gap-4">
          <button @click="toggleTheme" class="text-ink/50 dark:text-white/50 hover:text-ink dark:hover:text-white transition" aria-label="Toggle dark mode">
            {{ isDark ? '☀️' : '🌙' }}
          </button>
          <button @click="signOut" class="text-sm font-medium text-ink/60 dark:text-white/60 hover:text-clay transition">Sign out</button>
        </div>
      </div>
    </header>

    <div v-if="checking" class="flex-1 flex items-center justify-center text-ink/50 dark:text-white/50 text-sm">
      Loading…
    </div>

    <div v-else class="flex-1">
      <div class="max-w-3xl mx-auto px-6 py-10">
        <!-- Intro -->
        <p class="text-xs font-bold text-clay uppercase tracking-wider mb-1">Provider verification</p>
        <h1 class="font-display text-3xl sm:text-4xl font-extrabold text-ink dark:text-[#F0EDE6]">
          Set up your provider profile
        </h1>
        <p class="text-sm text-ink/60 dark:text-white/60 mt-2">
          Complete this one-time application so customers know who they're hiring. You'll reach your
          dashboard as soon as it's submitted.
        </p>

        <!-- Mode toggle -->
        <div class="mt-7 grid grid-cols-2 gap-3 p-1.5 rounded-2xl bg-mist/40 dark:bg-white/5 border border-mist dark:border-white/10">
          <button
            type="button" @click="mode = 'individual'"
            :class="[
              'rounded-xl px-4 py-3 text-sm font-semibold transition text-center',
              mode === 'individual' ? 'bg-white dark:bg-mist-dark text-clay shadow-sm' : 'text-ink/60 dark:text-white/60 hover:text-ink dark:hover:text-white'
            ]"
          >
            🧑‍🔧 Provide service as Individual
          </button>
          <button
            type="button" @click="mode = 'company'"
            :class="[
              'rounded-xl px-4 py-3 text-sm font-semibold transition text-center',
              mode === 'company' ? 'bg-white dark:bg-mist-dark text-clay shadow-sm' : 'text-ink/60 dark:text-white/60 hover:text-ink dark:hover:text-white'
            ]"
          >
            🏢 Provide service as a Company
          </button>
        </div>

        <!-- Error summary -->
        <div v-if="showErrors && errors.length" class="mt-6 rounded-xl bg-clay/5 border border-clay/25 px-4 py-3">
          <p class="text-sm font-semibold text-clay mb-1.5">Please finish these {{ errors.length }} item{{ errors.length === 1 ? '' : 's' }}:</p>
          <ul class="list-disc list-inside space-y-0.5 text-xs text-clay/90">
            <li v-for="(e, i) in errors" :key="i">{{ e }}</li>
          </ul>
        </div>

        <form @submit.prevent="handleSubmit" class="mt-6 space-y-6">

          <!-- ══════════════ INDIVIDUAL FLOW ══════════════ -->
          <template v-if="mode === 'individual'">

            <!-- About You -->
            <section class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 sm:p-7 space-y-5">
              <h2 class="font-display text-lg font-bold text-ink dark:text-[#F0EDE6] flex items-center gap-2"><span>👤</span> About you</h2>

              <!-- Profile picture (circular) -->
              <div>
                <label :class="labelClass">Profile picture <span class="text-clay">*</span></label>
                <div class="flex items-center gap-5">
                  <div class="w-24 h-24 rounded-full overflow-hidden shrink-0 border-2 border-dashed border-mist dark:border-white/20 bg-mist/30 dark:bg-canvas-dark flex items-center justify-center">
                    <img v-if="avatarPreview" :src="avatarPreview" alt="" class="w-full h-full object-cover" />
                    <span v-else class="text-2xl text-ink/30 dark:text-white/30">📷</span>
                  </div>
                  <div class="text-sm">
                    <label class="inline-flex items-center gap-2 font-semibold border border-mist dark:border-white/15 text-ink/75 dark:text-white/75 px-3.5 py-2 rounded-lg hover:border-clay/40 transition cursor-pointer">
                      <input type="file" accept="image/*" class="hidden" @change="onAvatarChange" />
                      {{ avatarPreview ? 'Replace photo' : 'Upload photo' }}
                    </label>
                    <button v-if="avatarPreview" type="button" @click="clearAvatar" class="ml-2 text-ink/50 dark:text-white/50 hover:text-clay transition">Remove</button>
                    <p class="text-[11px] text-ink/40 dark:text-white/40 mt-2">A clear, front-facing headshot. JPG or PNG.</p>
                  </div>
                </div>
              </div>

              <!-- Title -->
              <div>
                <label :class="labelClass">Professional title <span class="text-clay">*</span></label>
                <input v-model="form.title" type="text" :class="fieldClass" placeholder="e.g. Licensed Electrician · Brand & Logo Designer · Private Math Tutor" />
              </div>

              <!-- Introduction -->
              <div>
                <label :class="labelClass">Introduction <span class="text-clay">*</span></label>
                <textarea
                  v-model="form.intro" rows="6" :class="[fieldClass, 'resize-y']"
                  placeholder="Write at least 100 words. Cover what you do, your experience, the kind of jobs you take on, your approach to quality and communication, and why a customer should trust you."
                ></textarea>
                <div class="flex justify-between items-center mt-1">
                  <p class="text-[11px] text-ink/40 dark:text-white/40">Minimum 100 words.</p>
                  <p :class="['text-[11px] font-medium', introWordCount < 100 ? 'text-clay' : 'text-emerald-600 dark:text-emerald-400']">
                    {{ introWordCount }} / 100 words
                  </p>
                </div>
              </div>
            </section>

            <!-- Address -->
            <section class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 sm:p-7 space-y-5">
              <h2 class="font-display text-lg font-bold text-ink dark:text-[#F0EDE6] flex items-center gap-2"><span>📍</span> Address</h2>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label :class="labelClass">Phone number <span class="text-clay">*</span></label>
                  <div class="flex gap-2">
                    <span class="flex items-center rounded-xl border border-mist dark:border-white/15 bg-mist/40 dark:bg-white/5 text-ink/60 dark:text-white/60 px-3 text-sm shrink-0">+251</span>
                    <input v-model="form.phone" type="tel" :class="fieldClass" placeholder="911 234 567" />
                  </div>
                </div>
                <div>
                  <label :class="labelClass">City <span class="text-clay">*</span></label>
                  <select v-model="form.city" :class="[fieldClass, 'cursor-pointer appearance-none']">
                    <option value="" disabled>Select your city…</option>
                    <option v-for="c in cityOptions" :key="c" :value="c">{{ c }}</option>
                  </select>
                </div>
              </div>
              <div>
                <label :class="labelClass">Specific address <span class="text-ink/40 dark:text-white/40 font-normal normal-case">(optional)</span></label>
                <input v-model="form.address" type="text" :class="fieldClass" placeholder="Sub-city, woreda, street or landmark" />
              </div>
            </section>

            <!-- Experience & Education -->
            <section class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 sm:p-7 space-y-6">
              <h2 class="font-display text-lg font-bold text-ink dark:text-[#F0EDE6] flex items-center gap-2"><span>🎓</span> Experience &amp; education
                <span class="text-[11px] font-medium text-ink/40 dark:text-white/40 normal-case tracking-normal">Optional</span>
              </h2>

              <!-- Experience -->
              <div class="space-y-3">
                <p class="text-xs font-bold uppercase tracking-wider text-ink/70 dark:text-white/70">Experience</p>
                <div v-for="(x, i) in experience" :key="`x${i}`" class="rounded-xl border border-mist dark:border-white/10 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 relative">
                  <input v-model="x.role" type="text" :class="fieldClass" placeholder="Role / title" />
                  <input v-model="x.company" type="text" :class="fieldClass" placeholder="Company / client" />
                  <input v-model="x.period" type="text" :class="fieldClass" placeholder="e.g. 2021 – 2024" />
                  <button type="button" @click="removeExperience(i)" class="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-clay text-white text-xs font-bold flex items-center justify-center hover:bg-clay/90">✕</button>
                </div>
                <button type="button" @click="addExperience" class="text-sm font-semibold text-clay hover:underline">+ Add experience</button>
              </div>

              <!-- Education -->
              <div class="space-y-3">
                <p class="text-xs font-bold uppercase tracking-wider text-ink/70 dark:text-white/70">Education</p>
                <div v-for="(ed, i) in education" :key="`e${i}`" class="rounded-xl border border-mist dark:border-white/10 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 relative">
                  <input v-model="ed.qualification" type="text" :class="fieldClass" placeholder="Qualification" />
                  <input v-model="ed.institution" type="text" :class="fieldClass" placeholder="Institution" />
                  <input v-model="ed.year" type="text" :class="fieldClass" placeholder="Year" />
                  <button type="button" @click="removeEducation(i)" class="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-clay text-white text-xs font-bold flex items-center justify-center hover:bg-clay/90">✕</button>
                </div>
                <button type="button" @click="addEducation" class="text-sm font-semibold text-clay hover:underline">+ Add education</button>
              </div>
            </section>

            <!-- Identity Verification -->
            <section class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 sm:p-7 space-y-4">
              <h2 class="font-display text-lg font-bold text-ink dark:text-[#F0EDE6] flex items-center gap-2"><span>🪪</span> Identity verification</h2>
              <p class="text-sm text-ink/60 dark:text-white/60">Upload a clear photo or scan of your <strong>National ID or Passport</strong>. This is only used to verify your identity and is never shown publicly.</p>
              <label class="block rounded-xl border-2 border-dashed border-mist dark:border-white/20 bg-mist/20 dark:bg-canvas-dark px-6 py-8 text-center cursor-pointer hover:border-clay/50 transition">
                <input type="file" accept="image/*,application/pdf" class="hidden" @change="onIdChange" />
                <p class="text-2xl mb-1">⬆️</p>
                <p class="text-sm font-semibold text-ink dark:text-[#F0EDE6]">{{ idFile ? idFile.name : 'Click to upload National ID / Passport' }}</p>
                <p class="text-[11px] text-ink/40 dark:text-white/40 mt-1">JPG, PNG or PDF · max 10 MB</p>
              </label>
            </section>

            <!-- Type of Work -->
            <section class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 sm:p-7 space-y-5">
              <h2 class="font-display text-lg font-bold text-ink dark:text-[#F0EDE6] flex items-center gap-2"><span>🧰</span> Type of work</h2>

              <div>
                <label :class="labelClass">Category <span class="text-clay">*</span></label>
                <select v-model="workCategory" :class="[fieldClass, 'cursor-pointer appearance-none']">
                  <option value="" disabled>Select a category…</option>
                  <option v-for="c in CATEGORY_DATA" :key="c.name" :value="c.name">{{ c.icon }} {{ c.name }}</option>
                </select>
              </div>

              <div v-if="workCategory">
                <label :class="labelClass">Skills you offer <span class="text-clay">*</span></label>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label
                    v-for="s in currentCategorySkills" :key="s.name"
                    :class="[
                      'flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 cursor-pointer transition',
                      selectedSkills.includes(s.name) ? 'border-clay bg-clay/5' : 'border-mist dark:border-white/15 hover:border-clay/40'
                    ]"
                  >
                    <input type="checkbox" class="mt-0.5 accent-clay" :checked="selectedSkills.includes(s.name)" @change="toggleSkill(s.name)" />
                    <span>
                      <span class="block text-sm font-medium text-ink dark:text-[#F0EDE6]">{{ s.name }}</span>
                      <span class="block text-[11px] text-ink/45 dark:text-white/45">{{ s.description }}</span>
                    </span>
                  </label>

                  <!-- Other -->
                  <label
                    :class="[
                      'flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 cursor-pointer transition',
                      otherSkillEnabled ? 'border-clay bg-clay/5' : 'border-mist dark:border-white/15 hover:border-clay/40'
                    ]"
                  >
                    <input type="checkbox" class="mt-0.5 accent-clay" v-model="otherSkillEnabled" />
                    <span class="block text-sm font-medium text-ink dark:text-[#F0EDE6]">Other</span>
                  </label>
                </div>

                <input
                  v-if="otherSkillEnabled" v-model="otherSkillText" type="text"
                  :class="[fieldClass, 'mt-2']" placeholder="Describe the skill or service you offer"
                />
              </div>
            </section>
          </template>

          <!-- ══════════════ COMPANY FLOW ══════════════ -->
          <template v-else>

            <!-- About You (company) -->
            <section class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 sm:p-7 space-y-5">
              <h2 class="font-display text-lg font-bold text-ink dark:text-[#F0EDE6] flex items-center gap-2"><span>🏢</span> About your company</h2>

              <!-- Logo (square) -->
              <div>
                <label :class="labelClass">Company logo <span class="text-clay">*</span></label>
                <div class="flex items-center gap-5">
                  <div class="w-24 h-24 rounded-xl overflow-hidden shrink-0 border-2 border-dashed border-mist dark:border-white/20 bg-mist/30 dark:bg-canvas-dark flex items-center justify-center">
                    <img v-if="logoPreview" :src="logoPreview" alt="" class="w-full h-full object-cover" />
                    <span v-else class="text-2xl text-ink/30 dark:text-white/30">🖼️</span>
                  </div>
                  <div class="text-sm">
                    <label class="inline-flex items-center gap-2 font-semibold border border-mist dark:border-white/15 text-ink/75 dark:text-white/75 px-3.5 py-2 rounded-lg hover:border-clay/40 transition cursor-pointer">
                      <input type="file" accept="image/*" class="hidden" @change="onLogoChange" />
                      {{ logoPreview ? 'Replace logo' : 'Upload logo' }}
                    </label>
                    <button v-if="logoPreview" type="button" @click="clearLogo" class="ml-2 text-ink/50 dark:text-white/50 hover:text-clay transition">Remove</button>
                    <p class="text-[11px] text-ink/40 dark:text-white/40 mt-2">Square image works best. JPG, PNG or SVG.</p>
                  </div>
                </div>
              </div>

              <div>
                <label :class="labelClass">Company name <span class="text-clay">*</span></label>
                <input v-model="company.name" type="text" :class="fieldClass" placeholder="e.g. BlueNile Facilities PLC" />
              </div>
              <div>
                <label :class="labelClass">Website URL <span class="text-clay">*</span></label>
                <input v-model="company.website" type="url" :class="fieldClass" placeholder="https://yourcompany.et" />
              </div>
              <div>
                <label :class="labelClass">Description <span class="text-clay">*</span></label>
                <textarea v-model="company.description" rows="5" :class="[fieldClass, 'resize-y']" placeholder="What your company does, the services you provide, your team, and the areas you cover."></textarea>
              </div>
            </section>

            <!-- Business Verification -->
            <section class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 sm:p-7 space-y-4">
              <h2 class="font-display text-lg font-bold text-ink dark:text-[#F0EDE6] flex items-center gap-2"><span>📄</span> Business verification</h2>
              <p class="text-sm text-ink/60 dark:text-white/60">Upload your <strong>business license</strong> (renewed / valid). Used only to verify your business is registered.</p>
              <label class="block rounded-xl border-2 border-dashed border-mist dark:border-white/20 bg-mist/20 dark:bg-canvas-dark px-6 py-8 text-center cursor-pointer hover:border-clay/50 transition">
                <input type="file" accept="image/*,application/pdf" class="hidden" @change="onLicenseChange" />
                <p class="text-2xl mb-1">⬆️</p>
                <p class="text-sm font-semibold text-ink dark:text-[#F0EDE6]">{{ licenseFile ? licenseFile.name : 'Click to upload business license' }}</p>
                <p class="text-[11px] text-ink/40 dark:text-white/40 mt-1">JPG, PNG or PDF · max 10 MB</p>
              </label>
            </section>

            <!-- Services -->
            <section class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 sm:p-7 space-y-5">
              <h2 class="font-display text-lg font-bold text-ink dark:text-[#F0EDE6] flex items-center gap-2"><span>🧾</span> Services</h2>
              <p class="text-sm text-ink/60 dark:text-white/60">At least one service is required.</p>

              <div>
                <label :class="labelClass">Category <span class="text-clay">*</span></label>
                <select v-model="companyCategory" :class="[fieldClass, 'cursor-pointer appearance-none']">
                  <option value="" disabled>Select a category…</option>
                  <option v-for="c in CATEGORY_DATA" :key="c.name" :value="c.name">{{ c.icon }} {{ c.name }}</option>
                </select>
              </div>

              <div class="space-y-2">
                <label :class="labelClass">Services offered <span class="text-clay">*</span></label>
                <div v-for="(s, i) in companyServices" :key="`svc${i}`" class="flex gap-2">
                  <input v-model="companyServices[i]" type="text" :class="fieldClass" placeholder="e.g. Commercial deep cleaning" />
                  <button
                    v-if="companyServices.length > 1" type="button" @click="removeCompanyService(i)"
                    class="shrink-0 w-11 rounded-xl border border-mist dark:border-white/15 text-ink/50 dark:text-white/50 hover:border-clay/40 hover:text-clay transition"
                  >✕</button>
                </div>
                <button type="button" @click="addCompanyService" class="text-sm font-semibold text-clay hover:underline">+ Add service</button>
              </div>
            </section>
          </template>

          <!-- Submit -->
          <p v-if="submitError" class="text-clay text-sm bg-clay/5 border border-clay/20 rounded-xl px-4 py-3">{{ submitError }}</p>

          <div class="pt-1">
            <button
              type="submit" :disabled="submitting"
              class="w-full bg-clay hover:bg-clay/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-full transition text-base shadow-lg shadow-clay/20"
            >
              {{ submitting ? 'Submitting…' : 'Submit & continue to dashboard' }}
            </button>
            <p class="text-xs text-center text-ink/45 dark:text-white/45 mt-3">
              Your documents are used for verification only. You can edit your profile later from Account settings.
            </p>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
