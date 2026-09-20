<script setup lang="ts">
definePageMeta({ layout: 'default', middleware: ['auth'] })

const { apiFetch, token } = useApi()
const router = useRouter()
const goBack = useGoBack('/dashboard')

const user = ref<any>(null)
const loading = ref(true)
const activeTab = ref('profile')

const isProvider = computed(() => user.value?.role?.name === 'provider')
const isCustomer = computed(() => user.value?.role?.name === 'customer')

const tabs = [
  { key: 'profile', label: 'Profile', icon: '👤' },
  { key: 'account', label: 'Account', icon: '⚙️' },
  { key: 'security', label: 'Security', icon: '🛡️' },
  { key: 'notifications', label: 'Notifications', icon: '🔔' },
  { key: 'payments', label: 'Payments', icon: '💳' },
  { key: 'privacy', label: 'Privacy', icon: '🔒' },
]

// ── Profile form ──
const cityOptions = ['Addis Ababa', 'Bahir Dar', 'Hawassa', 'Mekelle', 'Adama', 'Dire Dawa', 'Gondar', 'Jimma', 'Other']
const languageOptions = ['Amharic', 'English', 'Oromo', 'Tigrinya', 'Arabic', 'French']

const fullName = ref('')
const isAvailable = ref(true)
const providerProfile = ref<any>(null)
const availableSkills = ref<any[]>([])
const selectedSkills = ref<any[]>([])
const experienceList = ref<any[]>([])
const educationList = ref<any[]>([])

function addExperienceItem() {
  experienceList.value.push({ role: '', company: '', period: '', description: '' })
}
function removeExperienceItem(i: number) {
  experienceList.value.splice(i, 1)
}

function addEducationItem() {
  educationList.value.push({ qualification: '', institution: '', year: '' })
}
function removeEducationItem(i: number) {
  educationList.value.splice(i, 1)
}
const availability = ref<any[]>([])
const portfolio = ref<any[]>([])
const portfolioTitle = ref('')
const portfolioDescription = ref('')
const portfolioImage = ref<File | null>(null)
const portfolioSaving = ref(false)
const portfolioError = ref('')

// ── Verification ──
const verificationStatus = ref('pending')
const verificationDocs = ref<any[]>([])
const vDoc = reactive({ preset: 'national_id', file: null as File | null })
const vSaving = ref(false)
const vError = ref('')
const V_PRESETS: Record<string, { label: string; category: string; name: string }> = {
  national_id:      { label: 'National ID / Passport', category: 'verification',  name: 'National ID / Passport' },
  business_license: { label: 'Business licence',        category: 'verification',  name: 'Business Licence' },
  tin_certificate:  { label: 'TIN certificate',         category: 'verification',  name: 'TIN Certificate' },
  trade_certificate:{ label: 'Trade / skill certificate', category: 'certification', name: 'Trade Certificate' },
}

async function loadVerification() {
  try {
    const res: any = await apiFetch('/provider/verification')
    verificationStatus.value = res.data?.verification_status ?? 'pending'
    verificationDocs.value = res.data?.documents ?? []
  } catch {
    verificationDocs.value = []
  }
}

function selectVerificationFile(e: Event) {
  vDoc.file = (e.target as HTMLInputElement).files?.[0] ?? null
}

async function uploadVerificationDoc() {
  if (!vDoc.file) { vError.value = 'Choose a file to upload.'; return }
  vSaving.value = true
  vError.value = ''
  try {
    const preset = V_PRESETS[vDoc.preset]
    const fd = new FormData()
    fd.append('document_category', preset.category)
    fd.append('document_type', vDoc.preset)
    fd.append('document_name', preset.name)
    fd.append('file', vDoc.file)
    await apiFetch('/provider/verification', { method: 'POST', body: fd })
    vDoc.file = null
    await loadVerification()
  } catch (err: any) {
    vError.value = err?.data?.message ?? 'Upload failed.'
  } finally {
    vSaving.value = false
  }
}

async function removeVerificationDoc(id: number) {
  try {
    await apiFetch(`/provider/verification/${id}`, { method: 'DELETE' })
    verificationDocs.value = verificationDocs.value.filter(d => d.id !== id)
  } catch {}
}
const weekDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const form = ref({
  email: '', phone: '', city: '', area: '', bio: '', languages: [], company_name: '', company_website: '',
})
let snapshot = null // last-saved/loaded state, for Discard

function loadFormFromUser() {
  fullName.value = `${user.value.first_name ?? ''} ${user.value.last_name ?? ''}`.trim()
  isAvailable.value = availability.value.some(slot => slot.is_available)
  form.value = {
    email: user.value.email ?? '',
    phone: (user.value.phone ?? '').replace(/^\+?251/, '').replace(/^0/, '').trim(),
    city: user.value.city ?? '',
    area: user.value.area ?? '',
    bio: user.value.bio ?? '',
    languages: user.value.languages ?? [],
    company_name: user.value.company_name ?? '',
    company_website: user.value.company_website ?? '',
  }
  snapshot = { fullName: fullName.value, isAvailable: isAvailable.value, ...form.value, languages: [...form.value.languages] }
}

function toggleAvailability() {
  isAvailable.value = !isAvailable.value
  availability.value = availability.value.map(slot => ({ ...slot, is_available: isAvailable.value }))
}

function ensureWeeklyAvailability(slots: any[] = []) {
  return weekDays.map(day => {
    const saved = slots.find(slot => slot.day_of_week === day)
    return saved
      ? {
          ...saved,
          start_time: saved.start_time ? String(saved.start_time).slice(0, 5) : '09:00',
          end_time: saved.end_time ? String(saved.end_time).slice(0, 5) : '17:00',
          is_available: Boolean(saved.is_available)
        }
      : { day_of_week: day, start_time: '09:00', end_time: '17:00', is_available: true }
  })
}

async function loadProviderWorkspace() {
  const [profileResponse, skillsResponse] = await Promise.all([
    apiFetch<any>('/provider/profile'),
    apiFetch<any>('/skills'),
  ])
  providerProfile.value = profileResponse.data ?? profileResponse
  portfolio.value = providerProfile.value.portfolio ?? []
  availability.value = ensureWeeklyAvailability(providerProfile.value.availability ?? [])
  selectedSkills.value = (providerProfile.value.skills ?? []).map((skill: any) => ({
    id: skill.id,
    proficiency_level: skill.pivot?.proficiency_level ?? 'beginner',
  }))
  experienceList.value = Array.isArray(providerProfile.value.experience) ? JSON.parse(JSON.stringify(providerProfile.value.experience)) : []
  educationList.value = Array.isArray(providerProfile.value.education) ? JSON.parse(JSON.stringify(providerProfile.value.education)) : []
  availableSkills.value = skillsResponse.data ?? skillsResponse ?? []
  await loadVerification()
}

function toggleSkill(skillId: number) {
  const index = selectedSkills.value.findIndex(skill => skill.id === skillId)
  if (index >= 0) selectedSkills.value.splice(index, 1)
  else selectedSkills.value.push({ id: skillId, proficiency_level: 'intermediate' })
}

function selectPortfolioImage(event: Event) {
  portfolioImage.value = (event.target as HTMLInputElement).files?.[0] ?? null
}

async function uploadPortfolio() {
  if (!portfolioTitle.value.trim() || !portfolioImage.value) {
    portfolioError.value = 'Add a title and image before uploading.'
    return
  }
  portfolioSaving.value = true
  portfolioError.value = ''
  try {
    const payload = new FormData()
    payload.append('title', portfolioTitle.value.trim())
    payload.append('description', portfolioDescription.value.trim())
    payload.append('image', portfolioImage.value)
    const response = await apiFetch<any>('/provider/profile/portfolio', { method: 'POST', body: payload })
    portfolio.value.unshift(response.data ?? response)
    portfolioTitle.value = ''
    portfolioDescription.value = ''
    portfolioImage.value = null
  } catch (err: any) {
    portfolioError.value = err?.data?.message ?? 'Could not upload this portfolio item.'
  } finally {
    portfolioSaving.value = false
  }
}

async function deletePortfolio(id: number) {
  await apiFetch(`/provider/profile/portfolio/${id}`, { method: 'DELETE' })
  portfolio.value = portfolio.value.filter(item => item.id !== id)
}

function discardChanges() {
  if (!snapshot) return
  fullName.value = snapshot.fullName
  form.value = { ...snapshot, languages: [...snapshot.languages] }
  saveError.value = ''
  saveSuccess.value = false
}

function toggleLanguage(lang) {
  const i = form.value.languages.indexOf(lang)
  if (i === -1) form.value.languages.push(lang)
  else form.value.languages.splice(i, 1)
}

const saving = ref(false)
const saveError = ref('')
const saveSuccess = ref(false)

async function saveProfile() {
  saving.value = true
  saveError.value = ''
  saveSuccess.value = false
  try {
    const parts = fullName.value.trim().split(/\s+/)
    const payload = {
      first_name: parts[0] || '',
      last_name: parts.slice(1).join(' ') || parts[0] || '',
      email: form.value.email,
      phone: form.value.phone ? `+251${form.value.phone.replace(/\s+/g, '')}` : '',
      city: form.value.city,
      area: form.value.area,
      bio: form.value.bio,
      languages: form.value.languages,
      company_name: form.value.company_name,
      company_website: form.value.company_website,
    }
    const updated = await apiFetch('/user', { method: 'PATCH', body: payload })
    user.value = updated?.data ?? updated ?? user.value
    if (isProvider.value) {
      const sanitizedAvailability = availability.value.map(slot => ({
        day_of_week: slot.day_of_week,
        start_time: slot.start_time ? String(slot.start_time).slice(0, 5) : null,
        end_time: slot.end_time ? String(slot.end_time).slice(0, 5) : null,
        is_available: Boolean(slot.is_available),
      }))
      const providerUpdated: any = await apiFetch('/provider/profile', {
        method: 'PUT',
        body: {
          bio: form.value.bio,
          skills: selectedSkills.value,
          experience: experienceList.value,
          education: educationList.value,
          availability: sanitizedAvailability,
        },
      })
      providerProfile.value = providerUpdated.data ?? providerUpdated
      portfolio.value = providerProfile.value.portfolio ?? portfolio.value
      availability.value = ensureWeeklyAvailability(providerProfile.value.availability ?? availability.value)
    }
    loadFormFromUser()
    saveSuccess.value = true
  } catch (err: any) {
    if (err?.data?.errors) {
      const errMsgs = Object.values(err.data.errors).flat().join(' ')
      saveError.value = errMsgs || err?.data?.message || 'Failed to save changes.'
    } else {
      saveError.value = err?.data?.message || 'Failed to save changes. Please try again.'
    }
  } finally {
    saving.value = false
  }
}

// ── Payments tab: reuses real booking data (no separate wallet exists) ──
const bookings = ref([])
const paymentsLoaded = ref(false)
const paymentsLoading = ref(false)

async function loadPayments() {
  if (paymentsLoaded.value || paymentsLoading.value) return
  paymentsLoading.value = true
  try {
    const res = await apiFetch(isCustomer.value ? '/my-bookings/customer' : '/my-bookings/provider')
    bookings.value = (res.data ?? []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8)
    paymentsLoaded.value = true
  } catch {
    bookings.value = []
  } finally {
    paymentsLoading.value = false
  }
}

watch(activeTab, (tab) => { if (tab === 'payments') loadPayments() })

// ── Security tab state ──
const secForm = ref({ currentPassword: '', newPassword: '', confirmPassword: '' })
const secSaving = ref(false)
const secError = ref('')
const secSuccess = ref(false)

async function changePassword() {
  secError.value = ''
  secSuccess.value = false
  if (!secForm.value.currentPassword || !secForm.value.newPassword) {
    secError.value = 'Please fill in all password fields.'
    return
  }
  if (secForm.value.newPassword.length < 8) {
    secError.value = 'New password must be at least 8 characters.'
    return
  }
  if (secForm.value.newPassword !== secForm.value.confirmPassword) {
    secError.value = 'New passwords do not match.'
    return
  }
  secSaving.value = true
  try {
    await apiFetch('/user/password', {
      method: 'PATCH',
      body: {
        current_password: secForm.value.currentPassword,
        new_password: secForm.value.newPassword,
        new_password_confirmation: secForm.value.confirmPassword,
      }
    })
    secSuccess.value = true
    secForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' }
  } catch (err: any) {
    secError.value = err?.data?.message || 'Failed to update password. Check your current password.'
  } finally {
    secSaving.value = false
  }
}

// ── Notification Preferences state ──
const notifSaving = ref(false)
const notifSuccess = ref(false)

const notifPreferences = reactive<Record<string, {
  category: string
  icon: string
  title: string
  description: string
  email: boolean
  push: boolean
  pushOnly?: boolean
}>>({
  messages: {
    category: 'Direct Communication',
    icon: '💬',
    title: 'Direct Messages & Inquiries',
    description: 'Instant alerts when customers or service providers message you.',
    email: true,
    push: true,
  },
  proposals: {
    category: 'Direct Communication',
    icon: '📄',
    title: 'Custom Offers & Proposals',
    description: 'Alerts when proposals, price adjustments, or quotes are submitted.',
    email: true,
    push: true,
  },
  soundAlerts: {
    category: 'Direct Communication',
    icon: '🔔',
    title: 'In-App Sound Chimes',
    description: 'Play an audio tone when a new message or real-time alert arrives.',
    email: false,
    push: true,
    pushOnly: true,
  },
  bookingStatus: {
    category: 'Bookings & Orders',
    icon: '📦',
    title: 'Booking Confirmations & Status Updates',
    description: 'Updates when a booking is created, accepted, in-progress, or marked completed.',
    email: true,
    push: true,
  },
  bookingReminders: {
    category: 'Bookings & Orders',
    icon: '⏰',
    title: 'Service Appointment Reminders',
    description: 'Upcoming scheduled service reminders 24 hours and 1 hour before start time.',
    email: true,
    push: true,
  },
  payments: {
    category: 'Finance & Security',
    icon: '💳',
    title: 'Payments & Escrow Releases',
    description: 'Receipts, deposit confirmations, escrow fund releases, and payout notices.',
    email: true,
    push: true,
  },
  reviews: {
    category: 'Finance & Security',
    icon: '⭐',
    title: 'Reviews & Feedback',
    description: 'Notifications when a counterparty leaves you a review or rating.',
    email: true,
    push: true,
  },
  securityAlerts: {
    category: 'Finance & Security',
    icon: '🛡️',
    title: 'Security & Account Logins',
    description: 'Immediate alert when your account is accessed from a new device or password changes.',
    email: true,
    push: true,
  },
  digest: {
    category: 'News & Growth',
    icon: '📰',
    title: 'Platform Updates & SkillLink Digest',
    description: 'Periodic product improvements, safety tips, and featured platform highlights.',
    email: false,
    push: false,
  },
  promotions: {
    category: 'News & Growth',
    icon: '🏷️',
    title: 'Promotional Offers & Fee Discounts',
    description: 'Occasional discount vouchers and seasonal platform campaigns.',
    email: false,
    push: false,
  }
})

const notifCategories = computed(() => {
  const groups: Record<string, string[]> = {}
  for (const [key, item] of Object.entries(notifPreferences)) {
    if (!groups[item.category]) groups[item.category] = []
    groups[item.category].push(key)
  }
  return groups
})

function loadNotifPreferences() {
  if (!import.meta.client || !user.value?.id) return
  try {
    const saved = localStorage.getItem(`skilllink_notif_prefs_uid_${user.value.id}`)
    if (saved) {
      const parsed = JSON.parse(saved)
      for (const [k, val] of Object.entries(parsed) as [string, any][]) {
        if (notifPreferences[k]) {
          if (typeof val?.email === 'boolean') notifPreferences[k].email = val.email
          if (typeof val?.push === 'boolean') notifPreferences[k].push = val.push
        }
      }
    }
  } catch {}
}

function saveNotifPreferences() {
  notifSaving.value = true
  notifSuccess.value = false
  if (import.meta.client && user.value?.id) {
    try {
      const serialized: Record<string, { email: boolean; push: boolean }> = {}
      for (const [k, v] of Object.entries(notifPreferences)) {
        serialized[k] = { email: v.email, push: v.push }
      }
      localStorage.setItem(`skilllink_notif_prefs_uid_${user.value.id}`, JSON.stringify(serialized))
      notifSuccess.value = true
      setTimeout(() => { notifSuccess.value = false }, 3000)
    } catch {}
  }
  notifSaving.value = false
}

function toggleNotifChannel(key: string, channel: 'email' | 'push') {
  if (notifPreferences[key]) {
    notifPreferences[key][channel] = !notifPreferences[key][channel]
    if (import.meta.client && user.value?.id) {
      try {
        const serialized: Record<string, { email: boolean; push: boolean }> = {}
        for (const [k, v] of Object.entries(notifPreferences)) {
          serialized[k] = { email: v.email, push: v.push }
        }
        localStorage.setItem(`skilllink_notif_prefs_uid_${user.value.id}`, JSON.stringify(serialized))
      } catch {}
    }
  }
}

function setAllChannels(channel: 'email' | 'push', value: boolean) {
  for (const item of Object.values(notifPreferences)) {
    if (!item.pushOnly || channel === 'push') {
      item[channel] = value
    }
  }
  saveNotifPreferences()
}

function resetNotifToDefaults() {
  for (const [k, item] of Object.entries(notifPreferences)) {
    if (item.category === 'News & Growth') {
      item.email = false
      item.push = false
    } else {
      item.email = !item.pushOnly
      item.push = true
    }
  }
  saveNotifPreferences()
}

// ── Privacy tab state ──
const privacySettings = reactive<Record<string, { label: string; hint: string; enabled: boolean }>>({
  publicProfile: { label: 'Public profile', hint: 'Allow anyone to view your profile and services.', enabled: true },
  showPhone: { label: 'Show phone number', hint: 'Display your phone number on your public profile.', enabled: false },
  showEmail: { label: 'Show email address', hint: 'Show your email on bookings and enquiries.', enabled: true },
  marketingEmails: { label: 'Marketing emails', hint: 'Receive tips, promotions, and platform news via email.', enabled: true },
  activityStatus: { label: 'Show online status', hint: 'Let others see when you were last active.', enabled: true },
})

function loadPrivacySettings() {
  if (!import.meta.client || !user.value?.id) return
  try {
    const saved = localStorage.getItem(`skilllink_privacy_prefs_uid_${user.value.id}`)
    if (saved) {
      const parsed = JSON.parse(saved)
      for (const [k, enabled] of Object.entries(parsed)) {
        if (privacySettings[k]) privacySettings[k].enabled = Boolean(enabled)
      }
    }
  } catch {}
}

function togglePrivacySetting(key: string) {
  if (privacySettings[key]) {
    privacySettings[key].enabled = !privacySettings[key].enabled
    if (import.meta.client && user.value?.id) {
      try {
        const serialized: Record<string, boolean> = {}
        for (const [k, v] of Object.entries(privacySettings)) {
          serialized[k] = v.enabled
        }
        localStorage.setItem(`skilllink_privacy_prefs_uid_${user.value.id}`, JSON.stringify(serialized))
      } catch {}
    }
  }
}

const bookingTitle = (b) => b.job?.title || b.service?.title || `Booking #${b.id}`
const formatDate = (d) => new Intl.DateTimeFormat('en-CA').format(new Date(d))

// ── Account Deletion ──
const deleteModalOpen = ref(false)
const deletePassword = ref('')
const deleteLoading = ref(false)
const deleteError = ref('')

function openDeleteModal() {
  deletePassword.value = ''
  deleteError.value = ''
  deleteModalOpen.value = true
}

function closeDeleteModal() {
  if (deleteLoading.value) return
  deleteModalOpen.value = false
  deletePassword.value = ''
  deleteError.value = ''
}

async function confirmDeleteAccount() {
  if (!deletePassword.value) {
    deleteError.value = 'Please enter your password to confirm deletion.'
    return
  }
  deleteError.value = ''
  deleteLoading.value = true

  try {
    await apiFetch('/user', {
      method: 'DELETE',
      body: { password: deletePassword.value }
    })
    token.value = null
    user.value = null
    deleteModalOpen.value = false
    router.push('/login?deleted=1')
  } catch (err: any) {
    deleteError.value = err?.data?.message || err?.message || 'Failed to delete account. Please verify your password.'
  } finally {
    deleteLoading.value = false
  }
}

onMounted(async () => {
  try {
    user.value = await apiFetch('/user')
    if (user.value.role?.name === 'provider') await loadProviderWorkspace()
    loadFormFromUser()
    loadNotifPreferences()
    loadPrivacySettings()
  } catch {
    token.value = null
    await router.push('/login')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <section class="max-w-5xl mx-auto px-6 py-10 sm:py-14">
    <!-- Back arrow -->
    <div class="mb-4">
      <button @click="goBack" class="inline-flex items-center gap-1.5 text-xs font-semibold text-clay hover:underline">
        <span>←</span> Back to Dashboard
      </button>
    </div>

    <div v-if="loading" class="text-ink/50 dark:text-white/50">Loading your account…</div>

    <template v-else-if="user">
      <p class="text-sm font-medium text-clay uppercase tracking-wide mb-1">Account</p>
      <h1 class="font-display text-3xl sm:text-4xl font-semibold text-ink dark:text-[#F0EDE6] mb-2">Profile settings</h1>
      <p class="text-ink/60 dark:text-white/60 mb-10">Manage your {{ user.role?.name }} profile, account security, and platform preferences.</p>

      <div class="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
        <!-- Sidebar -->
        <aside class="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
          <button
            v-for="tab in tabs" :key="tab.key"
            @click="activeTab = tab.key"
            :class="[
              'flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition shrink-0',
              activeTab === tab.key ? 'bg-clay text-white' : 'text-ink/70 dark:text-white/70 hover:bg-mist/60 dark:hover:bg-white/5'
            ]"
          >
            <span>{{ tab.icon }}</span> {{ tab.label }}
            <span v-if="activeTab === tab.key" class="ml-auto hidden lg:inline">›</span>
          </button>
        </aside>

        <!-- Content -->
        <div>
          <!-- ── Profile tab ── -->
          <template v-if="activeTab === 'profile'">
            <!-- Photo -->
            <div class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 mb-5">
              <p class="font-semibold text-ink dark:text-[#F0EDE6] mb-1">Profile photo</p>
              <p class="text-sm text-ink/50 dark:text-white/50 mb-5">A clear headshot helps build trust.</p>
              <div class="flex items-center gap-4 flex-wrap">
                <span class="w-16 h-16 rounded-full bg-[#ffd4c0] flex items-center justify-center font-display text-lg font-semibold text-clay shrink-0">
                  {{ (user.first_name?.[0] ?? '') + (user.last_name?.[0] ?? '') }}
                </span>
                <div class="flex items-center gap-3 text-sm">
                  <button type="button" class="font-medium border border-mist dark:border-white/15 text-ink/70 dark:text-white/70 px-3.5 py-2 rounded-lg hover:border-clay/40 transition">📷 Change photo</button>
                  <button type="button" class="font-medium text-ink/50 dark:text-white/50 px-3.5 py-2 rounded-lg hover:text-clay transition">🗑 Remove</button>
                </div>
              </div>
              <p class="text-xs text-ink/40 dark:text-white/40 mt-3">Photo uploads aren't available yet — this is a preview of the upcoming design.</p>
            </div>

            <!-- Availability Status (Provider only) -->
            <div v-if="isProvider" class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 mb-5">
              <div class="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p class="font-semibold text-ink dark:text-[#F0EDE6] mb-0.5">Booking Availability Status</p>
                  <p class="text-sm text-ink/50 dark:text-white/50">
                    {{ isAvailable ? 'You are currently open to accepting new customer bookings.' : 'You are marked as busy/unavailable. Customers will not be able to book you.' }}
                  </p>
                </div>
                <button
                  type="button"
                  @click="toggleAvailability"
                  :class="[
                    'px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-2 border',
                    isAvailable
                      ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800'
                      : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800'
                  ]"
                >
                  <span class="w-2 h-2 rounded-full" :class="isAvailable ? 'bg-green-500' : 'bg-red-500'"></span>
                  {{ isAvailable ? '🟢 Available for Work' : '🔴 Busy / Unavailable' }}
                </button>
              </div>
            </div>

            <!-- Offered Services & Pricing Management -->
            <div v-if="isProvider" class="bg-gradient-to-r from-clay/10 via-white to-clay/5 dark:from-white/5 dark:via-mist-dark dark:to-white/5 border border-clay/30 dark:border-white/10 rounded-2xl p-6 mb-5">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div class="flex items-center gap-2 mb-1">
                    <p class="font-semibold text-ink dark:text-[#F0EDE6]">Offered Services & Pricing</p>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-clay text-white">Marketplace Catalog</span>
                  </div>
                  <p class="text-xs sm:text-sm text-ink/65 dark:text-white/60">
                    Skills define your expertise, while Services are your bookable fixed/hourly packages that customers purchase directly.
                  </p>
                </div>
                <NuxtLink
                  to="/provider/services"
                  class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-clay hover:bg-clay-dark text-white text-xs font-bold transition shadow-xs shrink-0 active:scale-95"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  <span>Add & Manage Services</span>
                </NuxtLink>
              </div>
            </div>

            <div v-if="isProvider" class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 mb-5">
              <p class="font-semibold text-ink dark:text-[#F0EDE6] mb-1">Skills</p>
              <p class="text-sm text-ink/50 dark:text-white/50 mb-4">Choose the skills customers should see on your profile. Your choices are saved with your provider profile.</p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="skill in availableSkills" :key="skill.id" type="button" @click="toggleSkill(skill.id)"
                  :class="['rounded-full border px-3 py-1.5 text-xs font-semibold transition', selectedSkills.some(selected => selected.id === skill.id) ? 'border-teal-600 bg-teal-600 text-white' : 'border-mist text-ink/70 hover:border-teal-400 dark:border-white/15 dark:text-white/70']"
                >
                  {{ skill.skill_name || skill.name }}
                </button>
              </div>
              <div v-if="selectedSkills.length" class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label v-for="selected in selectedSkills" :key="selected.id" class="flex items-center justify-between gap-3 rounded-lg bg-teal-50 px-3 py-2 text-xs dark:bg-teal-950/35">
                  <span class="font-semibold text-teal-900 dark:text-teal-100">{{ availableSkills.find(skill => skill.id === selected.id)?.skill_name }}</span>
                  <select v-model="selected.proficiency_level" class="rounded border border-teal-200 bg-white px-2 py-1 text-xs text-teal-800 dark:border-teal-800 dark:bg-slate-900 dark:text-teal-100">
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="expert">Expert</option>
                  </select>
                </label>
              </div>
              <p v-if="!availableSkills.length" class="text-xs text-ink/45 dark:text-white/45">Skills could not be loaded. Refresh the page and try again.</p>
            </div>

            <!-- Work Experience (provider only) -->
            <div v-if="isProvider" class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 mb-5">
              <div class="flex items-center justify-between mb-1">
                <p class="font-semibold text-ink dark:text-[#F0EDE6] flex items-center gap-2"><span>💼</span> Work Experience</p>
                <button type="button" @click="addExperienceItem" class="text-xs font-bold text-clay dark:text-[#D4A98A] hover:underline flex items-center gap-1">
                  <span>+</span> Add Experience
                </button>
              </div>
              <p class="text-sm text-ink/50 dark:text-white/50 mb-4">Add your past job roles, companies, and achievements so customers can see your proven track record.</p>

              <div v-if="!experienceList.length" class="rounded-xl border border-dashed border-mist dark:border-white/10 p-5 text-center text-xs text-ink/50 dark:text-white/50">
                No experience added yet. Click "+ Add Experience" above to highlight your background to clients.
              </div>

              <div v-else class="space-y-4">
                <div v-for="(exp, i) in experienceList" :key="i" class="p-4 rounded-xl border border-mist dark:border-white/10 relative bg-mist/10 dark:bg-canvas-dark/40 space-y-3">
                  <button type="button" @click="removeExperienceItem(i)" class="absolute top-3 right-3 text-red-500 hover:text-red-700 text-xs font-bold">
                    ✕ Remove
                  </button>
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pr-16">
                    <div>
                      <label class="block text-[11px] font-bold text-ink/70 dark:text-white/70 mb-1">Role / Job Title</label>
                      <input v-model="exp.role" type="text" placeholder="e.g. Senior Plumber" class="w-full rounded-lg border border-mist bg-white px-3 py-2 text-xs text-ink dark:border-white/15 dark:bg-transparent dark:text-white" />
                    </div>
                    <div>
                      <label class="block text-[11px] font-bold text-ink/70 dark:text-white/70 mb-1">Company / Organization</label>
                      <input v-model="exp.company" type="text" placeholder="e.g. Nile Engineering" class="w-full rounded-lg border border-mist bg-white px-3 py-2 text-xs text-ink dark:border-white/15 dark:bg-transparent dark:text-white" />
                    </div>
                    <div>
                      <label class="block text-[11px] font-bold text-ink/70 dark:text-white/70 mb-1">Time Period</label>
                      <input v-model="exp.period" type="text" placeholder="e.g. 2021 - Present" class="w-full rounded-lg border border-mist bg-white px-3 py-2 text-xs text-ink dark:border-white/15 dark:bg-transparent dark:text-white" />
                    </div>
                  </div>
                  <div>
                    <label class="block text-[11px] font-bold text-ink/70 dark:text-white/70 mb-1">Description / Key Responsibilities</label>
                    <textarea v-model="exp.description" rows="2" placeholder="Briefly describe what you did, technologies used, or client results..." class="w-full rounded-lg border border-mist bg-white px-3 py-2 text-xs text-ink dark:border-white/15 dark:bg-transparent dark:text-white"></textarea>
                  </div>
                </div>
              </div>
            </div>

            <!-- Education & Qualifications (provider only) -->
            <div v-if="isProvider" class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 mb-5">
              <div class="flex items-center justify-between mb-1">
                <p class="font-semibold text-ink dark:text-[#F0EDE6] flex items-center gap-2"><span>🎓</span> Education &amp; Degrees</p>
                <button type="button" @click="addEducationItem" class="text-xs font-bold text-clay dark:text-[#D4A98A] hover:underline flex items-center gap-1">
                  <span>+</span> Add Education
                </button>
              </div>
              <p class="text-sm text-ink/50 dark:text-white/50 mb-4">List your degrees, technical college diplomas, or vocational certifications.</p>

              <div v-if="!educationList.length" class="rounded-xl border border-dashed border-mist dark:border-white/10 p-5 text-center text-xs text-ink/50 dark:text-white/50">
                No education added yet. Click "+ Add Education" to add your academic qualifications.
              </div>

              <div v-else class="space-y-4">
                <div v-for="(edu, i) in educationList" :key="i" class="p-4 rounded-xl border border-mist dark:border-white/10 relative bg-mist/10 dark:bg-canvas-dark/40 space-y-3">
                  <button type="button" @click="removeEducationItem(i)" class="absolute top-3 right-3 text-red-500 hover:text-red-700 text-xs font-bold">
                    ✕ Remove
                  </button>
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pr-16">
                    <div>
                      <label class="block text-[11px] font-bold text-ink/70 dark:text-white/70 mb-1">Degree / Qualification</label>
                      <input v-model="edu.qualification" type="text" placeholder="e.g. BSc in Electrical Eng." class="w-full rounded-lg border border-mist bg-white px-3 py-2 text-xs text-ink dark:border-white/15 dark:bg-transparent dark:text-white" />
                    </div>
                    <div>
                      <label class="block text-[11px] font-bold text-ink/70 dark:text-white/70 mb-1">University / College / School</label>
                      <input v-model="edu.institution" type="text" placeholder="e.g. Addis Ababa University" class="w-full rounded-lg border border-mist bg-white px-3 py-2 text-xs text-ink dark:border-white/15 dark:bg-transparent dark:text-white" />
                    </div>
                    <div>
                      <label class="block text-[11px] font-bold text-ink/70 dark:text-white/70 mb-1">Year</label>
                      <input v-model="edu.year" type="text" placeholder="e.g. 2020" class="w-full rounded-lg border border-mist bg-white px-3 py-2 text-xs text-ink dark:border-white/15 dark:bg-transparent dark:text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="isProvider" class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 mb-5">
              <p class="font-semibold text-ink dark:text-[#F0EDE6] mb-1">Weekly availability</p>
              <p class="text-sm text-ink/50 dark:text-white/50 mb-4">Set the hours customers can request your service. Changes save with the profile form below.</p>
              <div class="space-y-2">
                <div v-for="slot in availability" :key="slot.day_of_week" class="grid grid-cols-[100px_1fr_1fr_auto] gap-2 items-center text-xs">
                  <span class="font-semibold capitalize text-ink dark:text-white">{{ slot.day_of_week }}</span>
                  <input v-model="slot.start_time" type="time" :disabled="!slot.is_available" class="rounded-lg border border-mist bg-white px-2 py-1.5 text-ink disabled:opacity-40 dark:border-white/15 dark:bg-transparent dark:text-white" />
                  <input v-model="slot.end_time" type="time" :disabled="!slot.is_available" class="rounded-lg border border-mist bg-white px-2 py-1.5 text-ink disabled:opacity-40 dark:border-white/15 dark:bg-transparent dark:text-white" />
                  <button type="button" @click="slot.is_available = !slot.is_available" :class="['rounded-lg px-2.5 py-1.5 font-bold', slot.is_available ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300' : 'bg-slate-100 text-slate-500 dark:bg-white/10']">{{ slot.is_available ? 'Open' : 'Closed' }}</button>
                </div>
              </div>
            </div>

            <div v-if="isProvider" class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 mb-5">
              <p class="font-semibold text-ink dark:text-[#F0EDE6] mb-1">Portfolio</p>
              <p class="text-sm text-ink/50 dark:text-white/50 mb-4">Show completed work with a title, description, and image.</p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input v-model="portfolioTitle" type="text" placeholder="Project title" class="rounded-lg border border-mist bg-white px-3 py-2 text-sm text-ink dark:border-white/15 dark:bg-transparent dark:text-white" />
                <input type="file" accept="image/jpeg,image/png,image/webp" @change="selectPortfolioImage" class="text-xs text-ink/60 dark:text-white/60" />
              </div>
              <textarea v-model="portfolioDescription" rows="2" placeholder="What did you do on this project?" class="mt-3 w-full rounded-lg border border-mist bg-white px-3 py-2 text-sm text-ink dark:border-white/15 dark:bg-transparent dark:text-white"></textarea>
              <p v-if="portfolioError" class="mt-2 text-xs text-red-600">{{ portfolioError }}</p>
              <button type="button" @click="uploadPortfolio" :disabled="portfolioSaving" class="mt-3 rounded-lg bg-teal-700 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-50">{{ portfolioSaving ? 'Uploading…' : 'Upload portfolio item' }}</button>
              <div v-if="portfolio.length" class="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <article v-for="item in portfolio" :key="item.id" class="overflow-hidden rounded-xl border border-mist dark:border-white/10">
                  <img v-if="item.image_url" :src="item.image_url" :alt="item.title" class="h-32 w-full object-cover" />
                  <div class="p-3">
                    <p class="font-semibold text-sm text-ink dark:text-white">{{ item.title }}</p>
                    <p v-if="item.description" class="mt-1 text-xs text-ink/55 dark:text-white/55">{{ item.description }}</p>
                    <button type="button" @click="deletePortfolio(item.id)" class="mt-2 text-xs font-bold text-red-600 hover:underline">Remove</button>
                  </div>
                </article>
              </div>
            </div>

            <!-- Verification (provider only) -->
            <div v-if="isProvider" class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 mb-5">
              <div class="flex items-center justify-between gap-3 mb-1 flex-wrap">
                <p class="font-semibold text-ink dark:text-[#F0EDE6]">Verification</p>
                <span
                  class="text-[11px] font-bold px-2.5 py-0.5 rounded-full border capitalize"
                  :class="{
                    'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800': verificationStatus === 'verified',
                    'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800': verificationStatus === 'suspended',
                    'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800': verificationStatus === 'pending',
                  }"
                >
                  {{ verificationStatus === 'verified' ? '✓ Verified' : verificationStatus }}
                </span>
              </div>
              <p class="text-sm text-ink/50 dark:text-white/50 mb-4">
                {{ verificationStatus === 'verified'
                  ? 'Your account is verified — customers can book you.'
                  : 'Upload your ID and any trade certificates. An admin reviews them before you can accept bookings.' }}
              </p>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select v-model="vDoc.preset" class="rounded-lg border border-mist bg-white px-3 py-2 text-sm text-ink dark:border-white/15 dark:bg-transparent dark:text-white">
                  <option v-for="(preset, key) in V_PRESETS" :key="key" :value="key">{{ preset.label }}</option>
                </select>
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" @change="selectVerificationFile" class="text-xs text-ink/60 dark:text-white/60" >
              </div>
              <p v-if="vError" class="mt-2 text-xs text-red-600">{{ vError }}</p>
              <button type="button" @click="uploadVerificationDoc" :disabled="vSaving" class="mt-3 rounded-lg bg-teal-700 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-50">
                {{ vSaving ? 'Uploading…' : 'Upload document' }}
              </button>

              <ul v-if="verificationDocs.length" class="mt-5 divide-y divide-mist dark:divide-white/10">
                <li v-for="d in verificationDocs" :key="d.id" class="py-2.5 flex items-center justify-between gap-3">
                  <a :href="d.file_url" target="_blank" rel="noopener" class="text-sm text-clay hover:underline truncate">📄 {{ d.document_name }}</a>
                  <div class="flex items-center gap-2 shrink-0">
                    <span
                      class="text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize"
                      :class="{
                        'bg-green-100 text-green-700': d.verification_status === 'approved',
                        'bg-red-100 text-red-700': d.verification_status === 'rejected',
                        'bg-amber-100 text-amber-800': d.verification_status === 'pending',
                      }"
                    >{{ d.verification_status }}</span>
                    <button v-if="d.verification_status === 'pending'" type="button" @click="removeVerificationDoc(d.id)" class="text-xs font-bold text-red-500 hover:underline">Remove</button>
                  </div>
                </li>
              </ul>
            </div>

            <!-- Identity -->
            <div class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 mb-5">
              <p class="font-semibold text-ink dark:text-[#F0EDE6] mb-1">Identity</p>
              <p class="text-sm text-ink/50 dark:text-white/50 mb-5">Your name, contact details, and location.</p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">Full name</label>
                  <div class="relative">
                    <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/30 dark:text-white/30 text-sm">👤</span>
                    <input v-model="fullName" type="text" class="w-full rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-transparent pl-10 pr-4 py-2.5 text-ink dark:text-[#F0EDE6] outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition" />
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">Email</label>
                  <div class="relative">
                    <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/30 dark:text-white/30 text-sm">✉️</span>
                    <input v-model="form.email" type="email" class="w-full rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-transparent pl-10 pr-4 py-2.5 text-ink dark:text-[#F0EDE6] outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition" />
                  </div>
                </div>
              </div>
              <div class="mb-4">
                <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">Phone</label>
                <div class="flex gap-2">
                  <span class="flex items-center gap-1 rounded-lg border border-mist dark:border-white/15 bg-mist/40 dark:bg-white/5 text-ink/60 dark:text-white/60 px-3 text-sm shrink-0">📞 +251</span>
                  <input v-model="form.phone" type="text" placeholder="911 234 567" class="flex-1 min-w-0 rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-transparent px-4 py-2.5 text-ink dark:text-[#F0EDE6] placeholder:text-ink/30 dark:placeholder:text-white/30 outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition" />
                </div>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">City</label>
                  <div class="relative">
                    <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/30 dark:text-white/30 text-sm">📍</span>
                    <select v-model="form.city" class="w-full appearance-none rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-mist-dark pl-10 pr-4 py-2.5 text-ink dark:text-[#F0EDE6] outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition">
                      <option value="">Select a city</option>
                      <option v-for="c in cityOptions" :key="c" :value="c">{{ c }}</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">Area / sub-city</label>
                  <input v-model="form.area" type="text" placeholder="Bole" class="w-full rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-transparent px-4 py-2.5 text-ink dark:text-[#F0EDE6] placeholder:text-ink/30 dark:placeholder:text-white/30 outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition" />
                </div>
              </div>
            </div>

            <!-- About you -->
            <div class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 mb-5">
              <p class="font-semibold text-ink dark:text-[#F0EDE6] mb-1">About you</p>
              <p class="text-sm text-ink/50 dark:text-white/50 mb-4">{{ isProvider ? 'A short bio helps customers understand your skills.' : 'A short bio helps providers understand your needs.' }}</p>
              <textarea
                v-model="form.bio" rows="3" maxlength="500"
                :placeholder="isProvider ? 'I specialize in...' : 'I run a retail business in Addis Ababa and need reliable contractors for tech and design work...'"
                class="w-full rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-transparent px-4 py-2.5 text-ink dark:text-[#F0EDE6] placeholder:text-ink/30 dark:placeholder:text-white/30 outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition resize-none"
              ></textarea>
              <div class="flex items-center justify-between mt-2 text-xs text-ink/40 dark:text-white/40">
                <span>{{ form.bio.length }}/500 characters</span>
                <span>Be specific — vague bios get fewer responses.</span>
              </div>
            </div>

            <!-- Languages -->
            <div class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 mb-5">
              <p class="font-semibold text-ink dark:text-[#F0EDE6] mb-1">Languages</p>
              <p class="text-sm text-ink/50 dark:text-white/50 mb-4">Pick the languages you can work in.</p>
              <div class="flex flex-wrap gap-2 mb-3">
                <button
                  v-for="lang in languageOptions" :key="lang" type="button"
                  @click="toggleLanguage(lang)"
                  :class="[
                    'text-sm font-medium px-3.5 py-1.5 rounded-full border transition',
                    form.languages.includes(lang)
                      ? 'bg-clay border-clay text-white'
                      : 'border-mist dark:border-white/15 text-ink/70 dark:text-white/70 hover:border-clay/40'
                  ]"
                >
                  <span v-if="form.languages.includes(lang)">✓ </span>{{ lang }}
                </button>
              </div>
              <p class="text-xs text-ink/40 dark:text-white/40">🗣️ {{ form.languages.length }} language{{ form.languages.length === 1 ? '' : 's' }} selected</p>
            </div>

            <!-- Company (customer only) -->
            <div v-if="isCustomer" class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 mb-6">
              <p class="font-semibold text-ink dark:text-[#F0EDE6] mb-1">Company</p>
              <p class="text-sm text-ink/50 dark:text-white/50 mb-4">Add company details (optional) — useful for B2B bookings.</p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">Company name</label>
                  <div class="relative">
                    <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/30 dark:text-white/30 text-sm">🏢</span>
                    <input v-model="form.company_name" type="text" class="w-full rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-transparent pl-10 pr-4 py-2.5 text-ink dark:text-[#F0EDE6] outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition" />
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">Company website (optional)</label>
                  <div class="relative">
                    <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/30 dark:text-white/30 text-sm">🌐</span>
                    <input v-model="form.company_website" type="text" placeholder="https://yourcompany.et" class="w-full rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-transparent pl-10 pr-4 py-2.5 text-ink dark:text-[#F0EDE6] placeholder:text-ink/30 dark:placeholder:text-white/30 outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition" />
                  </div>
                </div>
              </div>
            </div>

            <p v-if="saveError" class="text-clay text-sm mb-3">{{ saveError }}</p>
            <p v-if="saveSuccess" class="text-green-700 dark:text-green-400 text-sm mb-3">✓ Saved.</p>

            <!-- Form footer -->
            <div class="flex items-center justify-end gap-3">
              <button type="button" @click="discardChanges" class="text-sm font-medium text-ink/60 dark:text-white/60 hover:text-ink dark:hover:text-white transition">Discard</button>
              <button
                type="button" @click="saveProfile" :disabled="saving"
                class="flex items-center gap-2 bg-clay hover:bg-clay-dark disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg transition"
              >
                💾 {{ saving ? 'Saving…' : 'Save changes' }}
              </button>
            </div>
          </template>

          <!-- ── Account tab ── -->
          <template v-else-if="activeTab === 'account'">
            <div class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6">
              <p class="font-semibold text-ink dark:text-[#F0EDE6] mb-4">Account</p>
              <dl class="space-y-4 text-sm">
                <div class="flex justify-between border-t border-mist dark:border-white/10 pt-4">
                  <dt class="text-ink/50 dark:text-white/50">Account type</dt>
                  <dd class="text-ink dark:text-[#F0EDE6] font-medium capitalize">{{ user.role?.name }}</dd>
                </div>
                <div class="flex justify-between border-t border-mist dark:border-white/10 pt-4">
                  <dt class="text-ink/50 dark:text-white/50">Email</dt>
                  <dd class="text-ink dark:text-[#F0EDE6] font-medium">{{ user.email }}</dd>
                </div>
              </dl>
            </div>
          </template>

          <!-- ── Security tab ── -->
          <template v-else-if="activeTab === 'security'">
            <!-- Change Password -->
            <div class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 mb-5">
              <p class="font-semibold text-ink dark:text-[#F0EDE6] mb-1">Change Password</p>
              <p class="text-sm text-ink/50 dark:text-white/50 mb-5">Choose a strong password with at least 8 characters, a number, and a symbol.</p>
              <div class="space-y-4 max-w-md">
                <div>
                  <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">Current password</label>
                  <input
                    v-model="secForm.currentPassword" type="password"
                    placeholder="Enter your current password"
                    class="w-full rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-transparent px-4 py-2.5 text-ink dark:text-[#F0EDE6] outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">New password</label>
                  <input
                    v-model="secForm.newPassword" type="password"
                    placeholder="At least 8 characters"
                    class="w-full rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-transparent px-4 py-2.5 text-ink dark:text-[#F0EDE6] outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">Confirm new password</label>
                  <input
                    v-model="secForm.confirmPassword" type="password"
                    placeholder="Repeat the new password"
                    class="w-full rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-transparent px-4 py-2.5 text-ink dark:text-[#F0EDE6] outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition"
                  />
                </div>
                <p v-if="secError" class="text-clay text-xs font-medium">{{ secError }}</p>
                <p v-if="secSuccess" class="text-green-600 dark:text-green-400 text-xs font-medium">✓ Password updated successfully.</p>
                <button
                  type="button" @click="changePassword" :disabled="secSaving"
                  class="flex items-center gap-2 bg-clay hover:bg-clay-dark disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg transition text-sm"
                >
                  🔐 {{ secSaving ? 'Updating…' : 'Update Password' }}
                </button>
              </div>
            </div>

            <!-- Two-Factor Authentication (informational) -->
            <div class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6">
              <div class="flex items-start gap-4">
                <span class="text-2xl mt-0.5">📱</span>
                <div>
                  <p class="font-semibold text-ink dark:text-[#F0EDE6] mb-1">Two-Factor Authentication (2FA)</p>
                  <p class="text-sm text-ink/50 dark:text-white/50 mb-3">Adds an extra layer of security. Coming in the next platform update.</p>
                  <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-mist/60 dark:bg-white/5 text-xs font-semibold text-ink/60 dark:text-white/50">🔜 Coming soon</span>
                </div>
              </div>
            </div>
          </template>

          <!-- ── Notifications tab ── -->
          <template v-else-if="activeTab === 'notifications'">
            <div class="space-y-6">
              <!-- Top Banner & Direct Feed Link -->
              <div class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                <div>
                  <h2 class="font-display font-bold text-xl text-ink dark:text-[#F0EDE6]">Notification Preferences</h2>
                  <p class="text-sm text-ink/60 dark:text-white/60 mt-1">
                    Control which updates SkillLink delivers to your email inbox and in-app alert feed.
                  </p>
                </div>
                <NuxtLink
                  to="/notifications"
                  class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-clay/30 text-clay hover:bg-clay/5 text-xs font-bold transition shrink-0"
                >
                  <span>🔔</span> View Live Notifications Feed →
                </NuxtLink>
              </div>

              <!-- Quick Control Actions & Saved Toast -->
              <div class="flex flex-wrap items-center justify-between gap-3 px-1 text-xs">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-ink/50 dark:text-white/50 font-medium mr-1">Quick presets:</span>
                  <button
                    type="button"
                    @click="setAllChannels('email', true)"
                    class="px-3 py-1.5 rounded-lg bg-mist/50 dark:bg-white/5 hover:bg-clay/15 hover:text-clay text-ink/75 dark:text-white/75 font-semibold transition"
                  >
                    Enable All Email
                  </button>
                  <button
                    type="button"
                    @click="setAllChannels('push', true)"
                    class="px-3 py-1.5 rounded-lg bg-mist/50 dark:bg-white/5 hover:bg-clay/15 hover:text-clay text-ink/75 dark:text-white/75 font-semibold transition"
                  >
                    Enable All Push
                  </button>
                  <button
                    type="button"
                    @click="resetNotifToDefaults"
                    class="px-3 py-1.5 rounded-lg bg-mist/50 dark:bg-white/5 hover:bg-clay/15 hover:text-clay text-ink/75 dark:text-white/75 font-semibold transition"
                  >
                    Reset to Recommended
                  </button>
                </div>

                <span v-if="notifSuccess" class="inline-flex items-center gap-1 text-green-600 dark:text-green-400 font-bold transition">
                  ✓ Preferences saved
                </span>
              </div>

              <!-- Categorized Notification Settings -->
              <div
                v-for="(keys, categoryName) in notifCategories"
                :key="categoryName"
                class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl overflow-hidden shadow-xs"
              >
                <!-- Category Section Header -->
                <div class="px-6 py-4 bg-mist/20 dark:bg-white/[0.03] border-b border-mist dark:border-white/10 flex items-center justify-between">
                  <h3 class="font-bold text-sm text-ink dark:text-[#F0EDE6] tracking-wide">{{ categoryName }}</h3>
                  <div class="hidden sm:flex items-center gap-10 text-xs font-bold text-ink/50 dark:text-white/50 pr-4">
                    <span class="w-14 text-center">Email</span>
                    <span class="w-14 text-center">In-App</span>
                  </div>
                </div>

                <!-- Preference Items List -->
                <div class="divide-y divide-mist/60 dark:divide-white/5">
                  <div
                    v-for="key in keys"
                    :key="key"
                    class="p-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-mist/10 dark:hover:bg-white/[0.01] transition"
                  >
                    <!-- Label & Description -->
                    <div class="flex items-start gap-3.5 flex-1 min-w-0">
                      <span class="text-xl shrink-0 mt-0.5">{{ notifPreferences[key].icon }}</span>
                      <div>
                        <p class="text-sm font-semibold text-ink dark:text-[#F0EDE6]">
                          {{ notifPreferences[key].title }}
                        </p>
                        <p class="text-xs text-ink/60 dark:text-white/60 mt-0.5 leading-relaxed">
                          {{ notifPreferences[key].description }}
                        </p>
                      </div>
                    </div>

                    <!-- Channel Toggles -->
                    <div class="flex items-center justify-between sm:justify-end gap-6 sm:gap-10 pt-2 sm:pt-0 border-t sm:border-t-0 border-mist/40 dark:border-white/5">
                      <!-- Email Toggle -->
                      <div class="flex items-center gap-2 sm:w-14 sm:justify-center">
                        <span class="sm:hidden text-xs text-ink/50 dark:text-white/50">Email:</span>
                        <button
                          v-if="!notifPreferences[key].pushOnly"
                          type="button"
                          @click="toggleNotifChannel(key, 'email')"
                          :class="[
                            'relative inline-flex h-6 w-11 items-center rounded-full transition focus:outline-none shrink-0',
                            notifPreferences[key].email ? 'bg-clay' : 'bg-mist dark:bg-white/15'
                          ]"
                          :aria-label="`${notifPreferences[key].title} Email Toggle`"
                        >
                          <span
                            :class="[
                              'inline-block h-4 w-4 transform rounded-full bg-white shadow transition',
                              notifPreferences[key].email ? 'translate-x-6' : 'translate-x-1'
                            ]"
                          />
                        </button>
                        <span v-else class="text-[11px] text-ink/30 dark:text-white/30 italic text-center w-full">N/A</span>
                      </div>

                      <!-- Push / In-App Toggle -->
                      <div class="flex items-center gap-2 sm:w-14 sm:justify-center">
                        <span class="sm:hidden text-xs text-ink/50 dark:text-white/50">In-App:</span>
                        <button
                          type="button"
                          @click="toggleNotifChannel(key, 'push')"
                          :class="[
                            'relative inline-flex h-6 w-11 items-center rounded-full transition focus:outline-none shrink-0',
                            notifPreferences[key].push ? 'bg-clay' : 'bg-mist dark:bg-white/15'
                          ]"
                          :aria-label="`${notifPreferences[key].title} In-App Toggle`"
                        >
                          <span
                            :class="[
                              'inline-block h-4 w-4 transform rounded-full bg-white shadow transition',
                              notifPreferences[key].push ? 'translate-x-6' : 'translate-x-1'
                            ]"
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Bottom Save & Confirmation Bar -->
              <div class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div class="flex items-center gap-2 text-xs text-ink/60 dark:text-white/60">
                  <span class="text-clay font-bold text-sm">✓</span>
                  <span>Toggles are immediately saved to your authenticated profile.</span>
                </div>
                <button
                  type="button"
                  @click="saveNotifPreferences"
                  :disabled="notifSaving"
                  class="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-clay hover:bg-clay-dark text-white font-semibold text-xs transition shadow-xs flex items-center justify-center gap-2"
                >
                  <span>💾</span> {{ notifSaving ? 'Saving…' : (notifSuccess ? 'Preferences Saved ✓' : 'Save Preferences') }}
                </button>
              </div>
            </div>
          </template>

          <!-- ── Payments tab (real data) ── -->
          <template v-else-if="activeTab === 'payments'">
            <!-- Provider Quick Wallet Banner -->
            <div v-if="isProvider" class="bg-clay/10 border border-clay/25 rounded-2xl p-5 mb-5 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p class="font-display font-semibold text-base text-ink dark:text-[#F0EDE6]">Provider Wallet & Payouts</p>
                <p class="text-xs text-ink/65 dark:text-white/65">
                  Keep 90% of completed orders with transparent 10% platform fee calculations.
                </p>
              </div>
              <NuxtLink
                to="/provider/wallet"
                class="bg-clay hover:bg-clay/90 text-white text-xs font-semibold px-4 py-2 rounded-full transition shadow-xs flex items-center gap-1.5"
              >
                <span>💸</span> Open Full Wallet →
              </NuxtLink>
            </div>

            <div class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl overflow-hidden">
              <div v-if="paymentsLoading" class="px-6 py-10 text-center text-sm text-ink/50 dark:text-white/50">Loading…</div>
              <div v-else-if="!bookings.length" class="px-6 py-10 text-center text-sm text-ink/50 dark:text-white/50">Nothing here yet.</div>
              <div v-else class="divide-y divide-mist dark:divide-white/10">
                <div v-for="b in bookings" :key="b.id" class="flex items-center justify-between px-5 py-3.5 text-sm">
                  <div class="min-w-0">
                    <p class="font-medium text-ink dark:text-[#F0EDE6] truncate">{{ bookingTitle(b) }}</p>
                    <p class="text-xs text-ink/45 dark:text-white/45">{{ formatDate(b.created_at) }}</p>
                  </div>
                  <div class="text-right">
                    <span class="font-semibold text-ink dark:text-white block">ETB {{ Number(b.amount ?? b.total_amount ?? 0).toLocaleString() }}</span>
                    <span v-if="isProvider" class="text-[11px] text-green-700 dark:text-green-400">Net: ETB {{ (Number(b.amount ?? b.total_amount ?? 0) * 0.9).toLocaleString() }}</span>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- ── Privacy tab ── -->
          <template v-else-if="activeTab === 'privacy'">
            <div class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 mb-5">
              <p class="font-semibold text-ink dark:text-[#F0EDE6] mb-1">Profile Visibility</p>
              <p class="text-sm text-ink/50 dark:text-white/50 mb-5">Control who can see your profile and contact information.</p>
              <div class="space-y-4">
                <div v-for="(item, key) in privacySettings" :key="key"
                  class="flex items-center justify-between py-3 border-t border-mist dark:border-white/10 first:border-0 first:pt-0"
                >
                  <div>
                    <p class="text-sm font-medium text-ink dark:text-[#F0EDE6]">{{ item.label }}</p>
                    <p class="text-xs text-ink/50 dark:text-white/50 mt-0.5">{{ item.hint }}</p>
                  </div>
                  <button
                    type="button"
                    @click="togglePrivacySetting(key)"
                    :class="[
                      'relative inline-flex h-6 w-11 items-center rounded-full transition focus:outline-none',
                      item.enabled ? 'bg-clay' : 'bg-mist dark:bg-white/15'
                    ]"
                  >
                    <span
                      :class="[
                        'inline-block h-4 w-4 transform rounded-full bg-white shadow transition',
                        item.enabled ? 'translate-x-6' : 'translate-x-1'
                      ]"
                    />
                  </button>
                </div>
              </div>
            </div>

            <div class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6">
              <p class="font-semibold text-ink dark:text-[#F0EDE6] mb-1">Data & Account</p>
              <p class="text-sm text-ink/50 dark:text-white/50 mb-4">Manage your data and account deletion preferences.</p>
              <div class="flex flex-wrap gap-3">
                <button type="button" class="text-sm font-medium border border-mist dark:border-white/15 text-ink/70 dark:text-white/70 px-4 py-2 rounded-lg hover:border-clay/40 transition">📥 Download my data</button>
                <button
                  type="button"
                  @click="openDeleteModal"
                  class="text-sm font-medium border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                >
                  ⚠️ Delete account
                </button>
              </div>
              <p class="text-xs text-ink/40 dark:text-white/40 mt-3">Account deletion is permanent. Data export requests are processed within 72 hours.</p>
            </div>
          </template>
        </div>
      </div>
    </template>

    <!-- Delete Account Confirmation Modal -->
    <Teleport to="body">
      <transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="deleteModalOpen"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/70 dark:bg-black/80"
          @click.self="closeDeleteModal"
        >
          <div
            class="w-full max-w-md bg-white dark:bg-[#1E293B] border border-red-200 dark:border-red-900/50 rounded-2xl p-6 shadow-2xl space-y-5"
          >
            <!-- Modal Header -->
            <div class="flex items-start gap-3.5">
              <div class="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-bold text-ink dark:text-[#F0EDE6]">Permanently Delete Account?</h3>
                <p class="text-xs text-ink/60 dark:text-white/60 mt-1">
                  This action is irreversibly permanent. All your profile information, active listings, reviews, and transaction history will be purged.
                </p>
              </div>
            </div>

            <!-- Safety Notice -->
            <div class="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200/80 dark:border-red-900/40 rounded-xl text-xs text-red-700 dark:text-red-300 space-y-1">
              <p class="font-semibold">Important requirements:</p>
              <ul class="list-disc list-inside space-y-0.5 opacity-90">
                <li>You must not have pending or active bookings.</li>
                <li>Providers must withdraw any remaining wallet balance.</li>
              </ul>
            </div>

            <!-- Password confirmation input -->
            <div class="space-y-1.5">
              <label class="block text-xs font-semibold text-ink/80 dark:text-[#F0EDE6]/80">
                Confirm your current password
              </label>
              <input
                v-model="deletePassword"
                type="password"
                placeholder="Enter your current password"
                @keyup.enter="confirmDeleteAccount"
                class="w-full px-3.5 py-2.5 rounded-xl border border-mist dark:border-white/15 bg-white dark:bg-[#0F172A] text-sm text-ink dark:text-white placeholder:text-ink/30 dark:placeholder:text-white/30 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
                autocomplete="current-password"
              />
            </div>

            <!-- Error message if any -->
            <div v-if="deleteError" class="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg p-2.5">
              {{ deleteError }}
            </div>

            <!-- Actions -->
            <div class="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                @click="closeDeleteModal"
                :disabled="deleteLoading"
                class="px-4 py-2 rounded-xl text-sm font-semibold border border-mist dark:border-white/15 text-ink/70 dark:text-white/70 hover:bg-mist/30 dark:hover:bg-white/5 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                @click="confirmDeleteAccount"
                :disabled="deleteLoading || !deletePassword"
                class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-700 text-white shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg v-if="deleteLoading" class="animate-spin -ml-1 mr-1 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>{{ deleteLoading ? 'Deleting Account…' : 'Yes, Delete My Account' }}</span>
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </section>
</template>
