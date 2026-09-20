<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'admin-support-only'] })

const { apiFetch } = useApi()
const route = useRoute()
const router = useRouter()

const loading = ref(true)
const stats = ref<any>(null)
const activeTab = ref<'reports' | 'disputes' | 'technical'>('reports')

// Synchronize activeTab with route query param (?tab=reports | disputes | technical)
watch(() => route.query.tab, (tab) => {
  if (tab === 'disputes') activeTab.value = 'disputes'
  else if (tab === 'technical') activeTab.value = 'technical'
  else activeTab.value = 'reports'
}, { immediate: true })

function switchTab(tab: 'reports' | 'disputes' | 'technical') {
  activeTab.value = tab
  router.replace({ query: { ...route.query, tab } })
}

// ── 1. User Reports State (REAL DATA ONLY - NO FAKE ACCOUNTS) ────────────────
const reports = ref<any[]>([])
const reportsLoading = ref(false)
const reportSearch = ref('')
const reportStatusFilter = ref<string>('all')
const reportActionLoading = ref<number | null>(null)

// Suspend user modal (for reports)
const suspendUserModalOpen = ref(false)
const selectedReportForSuspend = ref<any>(null)
const userSuspendReason = ref('')
const userSuspendLoading = ref(false)

// ── 2. Order Disputes State (REAL DATA ONLY - NO FAKE ACCOUNTS) ──────────────
const disputes = ref<any[]>([])
const disputesLoading = ref(false)
const disputeSearch = ref('')
const disputeStatusFilter = ref<string>('all')
const selectedDispute = ref<any>(null)
const resolutionText = ref('')
const resolvingStatus = ref<'under_review' | 'resolved'>('resolved')
const resolveLoading = ref(false)
const resolveModalOpen = ref(false)

// ── 3. Provider Technical Support Inquiries State ────────────────────────────
const technicalInquiries = ref<any[]>([])
const technicalLoading = ref(false)
const techSearch = ref('')
const selectedInquiry = ref<any>(null)
const replyText = ref('')
const replyLoading = ref(false)
const techModalOpen = ref(false)

// Toast notification
const toastMessage = ref('')
function showToast(msg: string) {
  toastMessage.value = msg
  setTimeout(() => {
    toastMessage.value = ''
  }, 4000)
}

onMounted(async () => {
  await Promise.all([loadStats(), loadReports(), loadDisputes(), loadTechnicalInquiries()])
})

// ── Stats Loader ─────────────────────────────────────────────────────────────
async function loadStats() {
  loading.value = true
  try {
    const res: any = await apiFetch('/admin/support/stats')
    stats.value = res.data
  } catch (err) {
    stats.value = null
  } finally {
    loading.value = false
  }
}

// ── 1. Reports Operations ────────────────────────────────────────────────────
async function loadReports() {
  reportsLoading.value = true
  try {
    let url = '/admin/support/reports?type=user'
    if (reportStatusFilter.value !== 'all') {
      url += `&status=${reportStatusFilter.value}`
    }
    const res: any = await apiFetch(url)
    reports.value = res.data?.data ?? res.data ?? []
  } catch (err) {
    // If backend returns empty or network error, empty list - NO FAKE DATA!
    reports.value = []
  } finally {
    reportsLoading.value = false
  }
}

async function updateReportStatus(reportId: number, status: 'reviewed' | 'dismissed') {
  reportActionLoading.value = reportId
  try {
    await apiFetch(`/admin/support/reports/${reportId}`, {
      method: 'PATCH',
      body: { status },
    })
    const r = reports.value.find(rep => rep.id === reportId)
    if (r) r.status = status
    showToast(`✓ Report #${reportId} marked as ${status}`)
    await loadStats()
  } catch (err: any) {
    alert(err?.data?.message || 'Failed to update report status')
  } finally {
    reportActionLoading.value = null
  }
}

function openSuspendUserModal(report: any) {
  selectedReportForSuspend.value = report
  userSuspendReason.value = `Violation: ${report.reason || 'Misconduct reported by community member'}`
  suspendUserModalOpen.value = true
}

async function confirmSuspendUser() {
  if (!selectedReportForSuspend.value) return
  userSuspendLoading.value = true
  const rep = selectedReportForSuspend.value
  try {
    await apiFetch(`/admin/support/reports/${rep.id}`, {
      method: 'PATCH',
      body: { status: 'reviewed', action: 'suspended', reason: userSuspendReason.value }
    })
    rep.status = 'reviewed'
    showToast(`✓ Account for ${rep.reported_user?.first_name || 'user'} has been suspended.`)
    suspendUserModalOpen.value = false
    await loadStats()
  } catch (err: any) {
    alert(err?.data?.message || 'Failed to suspend user')
  } finally {
    userSuspendLoading.value = false
  }
}

// ── 2. Disputes Operations ────────────────────────────────────────────────────
async function loadDisputes() {
  disputesLoading.value = true
  try {
    let url = '/admin/support/disputes'
    if (disputeStatusFilter.value !== 'all') {
      url += `?status=${disputeStatusFilter.value}`
    }
    const res: any = await apiFetch(url)
    disputes.value = res.data?.data ?? res.data ?? []
  } catch (err) {
    disputes.value = []
  } finally {
    disputesLoading.value = false
  }
}

function openResolveModal(dispute: any) {
  selectedDispute.value = dispute
  resolutionText.value = dispute.resolution || ''
  resolvingStatus.value = dispute.status === 'open' ? 'under_review' : 'resolved'
  resolveModalOpen.value = true
}

async function submitResolution() {
  if (!selectedDispute.value) return
  if (resolvingStatus.value === 'resolved' && !resolutionText.value.trim()) {
    alert('A resolution note is required when resolving a dispute.')
    return
  }
  resolveLoading.value = true
  try {
    await apiFetch(`/admin/support/disputes/${selectedDispute.value.id}`, {
      method: 'PATCH',
      body: {
        status: resolvingStatus.value,
        resolution: resolutionText.value,
      },
    })
    selectedDispute.value.status = resolvingStatus.value
    showToast(`✓ Dispute #${selectedDispute.value.id} updated to ${resolvingStatus.value}`)
    resolveModalOpen.value = false
    await loadStats()
  } catch (err: any) {
    alert(err?.data?.message || 'Failed to update dispute')
  } finally {
    resolveLoading.value = false
  }
}

// ── 3. Technical Support Inquiries Operations ────────────────────────────────
// Same `user_reports` table as User Reports, filtered to type=technical — this
// is the /support "Contact Support & Report Issues" form.
async function loadTechnicalInquiries() {
  technicalLoading.value = true
  try {
    const res: any = await apiFetch('/admin/support/reports?type=technical')
    const rows = res.data?.data ?? res.data ?? []
    technicalInquiries.value = rows.map((r: any) => ({
      id: r.id,
      provider_name: `${r.reporter?.first_name ?? ''} ${r.reporter?.last_name ?? ''}`.trim() || 'Member',
      email: r.reporter?.email ?? '',
      subject: r.subject || 'Support inquiry',
      issue: r.reason ?? '',
      created_at: r.created_at,
      status: r.status === 'resolved' ? 'resolved' : 'open',
    }))
  } catch {
    technicalInquiries.value = []
  } finally {
    technicalLoading.value = false
  }
}

function openTechModal(inquiry: any) {
  selectedInquiry.value = inquiry
  replyText.value = ''
  techModalOpen.value = true
}

async function resolveTechnicalInquiry() {
  if (!selectedInquiry.value) return
  try {
    await apiFetch(`/admin/support/reports/${selectedInquiry.value.id}`, {
      method: 'PATCH',
      body: { status: 'resolved' },
    })
    selectedInquiry.value.status = 'resolved'
    showToast('✓ Technical inquiry marked as resolved')
    techModalOpen.value = false
  } catch (err: any) {
    alert(err?.data?.message || 'Failed to update this inquiry.')
  }
}

function formatTableDate(dateStr: string | null | undefined) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return String(dateStr)
  return d.toISOString().split('T')[0]
}

// ── Computed Lists ───────────────────────────────────────────────────────────
const filteredReports = computed(() => {
  let list = reports.value
  if (reportStatusFilter.value !== 'all') {
    list = list.filter(r => r.status === reportStatusFilter.value)
  }
  if (reportSearch.value.trim()) {
    const q = reportSearch.value.toLowerCase()
    list = list.filter((r: any) => {
      const reason = (r.reason || '').toLowerCase()
      const reportedName = `${r.reported_user?.first_name || ''} ${r.reported_user?.last_name || ''}`.toLowerCase()
      const reporterName = `${r.reporter?.first_name || ''} ${r.reporter?.last_name || ''}`.toLowerCase()
      return reason.includes(q) || reportedName.includes(q) || reporterName.includes(q)
    })
  }
  return list
})

const filteredDisputes = computed(() => {
  let list = disputes.value
  if (disputeStatusFilter.value !== 'all') {
    list = list.filter(d => d.status === disputeStatusFilter.value)
  }
  if (disputeSearch.value.trim()) {
    const q = disputeSearch.value.toLowerCase()
    list = list.filter((d: any) => {
      const reason = (d.reason || '').toLowerCase()
      const raisedByName = `${d.raised_by?.first_name || ''} ${d.raised_by?.last_name || ''}`.toLowerCase()
      const bookingTitle = (d.booking?.title || d.booking?.service?.title || d.booking?.job?.title || '').toLowerCase()
      return reason.includes(q) || raisedByName.includes(q) || bookingTitle.includes(q)
    })
  }
  return list
})

const filteredTechnical = computed(() => {
  let list = technicalInquiries.value
  if (techSearch.value.trim()) {
    const q = techSearch.value.toLowerCase()
    list = list.filter((t: any) =>
      (t.subject || '').toLowerCase().includes(q) ||
      (t.provider_name || '').toLowerCase().includes(q) ||
      (t.issue || '').toLowerCase().includes(q)
    )
  }
  return list
})

const pendingReportsCount = computed(() =>
  reports.value.filter(r => r.status === 'pending').length
)

const openDisputesCount = computed(() =>
  disputes.value.filter(d => d.status === 'open' || d.status === 'under_review').length
)
</script>

<template>
  <div class="space-y-6">
    <!-- Admin Consoles Navigation Bar -->
    <div class="flex items-center gap-2 border-b border-mist/80 dark:border-white/10 pb-4 overflow-x-auto">
      <NuxtLink
        to="/admin/support"
        class="px-4 py-2 rounded-xl text-xs font-bold bg-[#8A5B43] text-white shadow-xs flex items-center gap-2"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <span>Trust, Safety & Support</span>
      </NuxtLink>
      <NuxtLink
        to="/admin/providers"
        class="px-4 py-2 rounded-xl text-xs font-semibold text-ink/70 dark:text-white/70 hover:bg-[#8A5B43]/10 hover:text-[#8A5B43] dark:hover:bg-white/10 dark:hover:text-white transition flex items-center gap-2"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m9 12 2 2 4-4"/><path d="M12 3a12 12 0 0 0 8.5 3A12 12 0 0 1 12 21 12 12 0 0 1 3.5 6 12 12 0 0 0 12 3z"/>
        </svg>
        <span>Provider Verification</span>
      </NuxtLink>
    </div>

    <!-- Top notification toast -->
    <div
      v-if="toastMessage"
      class="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-slate-900 text-white shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom-4 duration-200"
    >
      <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
      <span class="text-xs sm:text-sm font-semibold">{{ toastMessage }}</span>
      <button @click="toastMessage = ''" class="ml-2 text-white/60 hover:text-white text-base">&times;</button>
    </div>

    <!-- ── Page Title Header ── -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-[#FAF0E6] dark:bg-[#253742] border border-[#EADFD7] dark:border-white/10 flex items-center justify-center text-[#8A5B43] dark:text-[#D4A98A]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h1 class="font-display text-2xl sm:text-3xl font-bold text-[#1A1210] dark:text-[#F0EDE6] tracking-tight">
            Trust, Safety & Support Operations
          </h1>
        </div>
        <p class="text-sm text-[#7D6E66] dark:text-white/60 mt-1">
          Review community violation reports, arbitrate order disputes, and assist providers facing technical issues.
        </p>
      </div>

      <!-- Refresh Queue Button -->
      <button
        @click="loadStats(); loadReports(); loadDisputes(); loadTechnicalInquiries();"
        :disabled="reportsLoading || disputesLoading || technicalLoading"
        class="px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-surface-dark border border-[#D9CBC1] dark:border-white/15 text-[#5A3E26] dark:text-[#F0EDE6] hover:bg-[#FAF7F4] dark:hover:bg-white/5 transition flex items-center gap-2 shadow-2xs self-start sm:self-auto active:scale-95"
      >
        <svg :class="['w-3.5 h-3.5 text-[#8A5B43] dark:text-[#D4A98A]', (reportsLoading || disputesLoading) ? 'animate-spin' : '']" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
        </svg>
        <span>Refresh Queue</span>
      </button>
    </div>

    <!-- ── KPI Overview Cards ── -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <!-- 1. Pending User Reports -->
      <div
        @click="switchTab('reports')"
        class="p-5 rounded-2xl bg-white dark:bg-[#1E2D37] border border-[#EADFD7] dark:border-white/10 shadow-xs cursor-pointer hover:border-[#8A5B43] transition"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-[#7D6E66] dark:text-white/50">User Reports</span>
          <span class="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
              <line x1="4" y1="22" x2="4" y2="15"/>
            </svg>
          </span>
        </div>
        <p class="text-3xl font-display font-extrabold text-[#1A1210] dark:text-white mt-2">
          {{ pendingReportsCount }}
        </p>
        <p class="text-xs text-[#7D6E66] dark:text-white/50 mt-1">Pending community misconduct flags</p>
      </div>

      <!-- 2. Open Disputes -->
      <div
        @click="switchTab('disputes')"
        class="p-5 rounded-2xl bg-white dark:bg-[#1E2D37] border border-[#EADFD7] dark:border-white/10 shadow-xs cursor-pointer hover:border-[#8A5B43] transition"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-[#7D6E66] dark:text-white/50">Order Disputes</span>
          <span class="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </span>
        </div>
        <p class="text-3xl font-display font-extrabold text-[#1A1210] dark:text-white mt-2">
          {{ openDisputesCount }}
        </p>
        <p class="text-xs text-[#7D6E66] dark:text-white/50 mt-1">Orders requiring escrow arbitration</p>
      </div>

      <!-- 3. Technical Inquiries -->
      <div
        @click="switchTab('technical')"
        class="p-5 rounded-2xl bg-white dark:bg-[#1E2D37] border border-[#EADFD7] dark:border-white/10 shadow-xs cursor-pointer hover:border-[#8A5B43] transition"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-[#7D6E66] dark:text-white/50">Technical Inquiries</span>
          <span class="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
          </span>
        </div>
        <p class="text-3xl font-display font-extrabold text-[#1A1210] dark:text-white mt-2">
          {{ technicalInquiries.filter(t => t.status !== 'resolved').length }}
        </p>
        <p class="text-xs text-[#7D6E66] dark:text-white/50 mt-1">Provider platform assistance requests</p>
      </div>
    </div>

    <!-- ── Main Operations Control Card ── -->
    <div class="bg-white dark:bg-[#1E2D37] rounded-3xl border border-[#EADFD7] dark:border-white/10 shadow-xs p-6 sm:p-7">
      <!-- ── Toolbar: Tabs & Search ── -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#F0E6DE] dark:border-white/10">
        <!-- Control Tabs -->
        <div class="inline-flex items-center gap-1.5 p-1 bg-[#F5EDE6] dark:bg-[#253742] rounded-full border border-[#E8DDD4] dark:border-white/10 overflow-x-auto max-w-full">
          <!-- Tab 1: User Reports -->
          <button
            @click="switchTab('reports')"
            :class="[
              'px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap',
              activeTab === 'reports'
                ? 'bg-white dark:bg-[#15232D] text-[#1A1210] dark:text-white shadow-2xs border border-[#E0D3C7] dark:border-white/10'
                : 'text-[#6E5D53] dark:text-white/70 hover:text-[#1A1210] dark:hover:text-white'
            ]"
          >
            <span class="w-2.5 h-2.5 rounded-full bg-red-500"></span>
            <span>User Reports</span>
            <span v-if="pendingReportsCount > 0" class="px-1.5 py-0.2 rounded-full bg-red-100 text-red-700 text-[10px] font-extrabold">
              {{ pendingReportsCount }}
            </span>
          </button>

          <!-- Tab 2: Order Disputes -->
          <button
            @click="switchTab('disputes')"
            :class="[
              'px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap',
              activeTab === 'disputes'
                ? 'bg-white dark:bg-[#15232D] text-[#1A1210] dark:text-white shadow-2xs border border-[#E0D3C7] dark:border-white/10'
                : 'text-[#6E5D53] dark:text-white/70 hover:text-[#1A1210] dark:hover:text-white'
            ]"
          >
            <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span>Order Disputes</span>
            <span v-if="openDisputesCount > 0" class="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold">
              {{ openDisputesCount }}
            </span>
          </button>

          <!-- Tab 3: Technical Support -->
          <button
            @click="switchTab('technical')"
            :class="[
              'px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap',
              activeTab === 'technical'
                ? 'bg-white dark:bg-[#15232D] text-[#1A1210] dark:text-white shadow-2xs border border-[#E0D3C7] dark:border-white/10'
                : 'text-[#6E5D53] dark:text-white/70 hover:text-[#1A1210] dark:hover:text-white'
            ]"
          >
            <span class="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            <span>Technical Inquiries</span>
          </button>
        </div>

        <!-- Search Input -->
        <div class="relative w-full md:w-80">
          <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A6948B] pointer-events-none">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </span>
          <input
            v-if="activeTab === 'reports'"
            v-model="reportSearch"
            type="text"
            placeholder="Search by member, email, or violation..."
            class="w-full rounded-full bg-[#F5EDE6] dark:bg-[#253742] border border-[#EBE0D7] dark:border-white/10 pl-9 pr-4 py-2 text-xs text-ink dark:text-white placeholder-[#A6948B] outline-none focus:border-[#8A5B43] focus:ring-2 focus:ring-[#8A5B43]/20 transition"
          />
          <input
            v-else-if="activeTab === 'disputes'"
            v-model="disputeSearch"
            type="text"
            placeholder="Search dispute reason, party, or order..."
            class="w-full rounded-full bg-[#F5EDE6] dark:bg-[#253742] border border-[#EBE0D7] dark:border-white/10 pl-9 pr-4 py-2 text-xs text-ink dark:text-white placeholder-[#A6948B] outline-none focus:border-[#8A5B43] focus:ring-2 focus:ring-[#8A5B43]/20 transition"
          />
          <input
            v-else
            v-model="techSearch"
            type="text"
            placeholder="Search technical inquiry, provider..."
            class="w-full rounded-full bg-[#F5EDE6] dark:bg-[#253742] border border-[#EBE0D7] dark:border-white/10 pl-9 pr-4 py-2 text-xs text-ink dark:text-white placeholder-[#A6948B] outline-none focus:border-[#8A5B43] focus:ring-2 focus:ring-[#8A5B43]/20 transition"
          />
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════════════════════════
           TAB 1: USER REPORTS TABLE (REAL DATABASE REPORTS ONLY)
      ══════════════════════════════════════════════════════════════════════════ -->
      <div v-if="activeTab === 'reports'" class="pt-4 overflow-x-auto">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2 text-xs">
            <span class="font-bold text-[#7D6E66] dark:text-white/60">Filter Status:</span>
            <button
              @click="reportStatusFilter = 'all'; loadReports()"
              :class="['px-3 py-1 rounded-full text-xs font-semibold transition', reportStatusFilter === 'all' ? 'bg-[#8A5B43] text-white' : 'bg-[#FAF0E6] text-[#7D6E66]']"
            >All</button>
            <button
              @click="reportStatusFilter = 'pending'; loadReports()"
              :class="['px-3 py-1 rounded-full text-xs font-semibold transition', reportStatusFilter === 'pending' ? 'bg-[#8A5B43] text-white' : 'bg-[#FAF0E6] text-[#7D6E66]']"
            >Pending</button>
            <button
              @click="reportStatusFilter = 'reviewed'; loadReports()"
              :class="['px-3 py-1 rounded-full text-xs font-semibold transition', reportStatusFilter === 'reviewed' ? 'bg-[#8A5B43] text-white' : 'bg-[#FAF0E6] text-[#7D6E66]']"
            >Reviewed</button>
          </div>
          <span class="text-xs text-[#7D6E66] dark:text-white/60">
            Total Reports: <strong class="text-[#1A1210] dark:text-white">{{ filteredReports.length }}</strong>
          </span>
        </div>

        <table class="w-full text-left border-collapse min-w-[760px]">
          <thead>
            <tr class="bg-[#F3EBE4] dark:bg-[#253742] text-[#5A483E] dark:text-[#E0D3C7] text-xs font-bold rounded-xl">
              <th class="py-3 px-4 w-14 rounded-l-xl">ID</th>
              <th class="py-3 px-4">Reported Member</th>
              <th class="py-3 px-4">Reported By</th>
              <th class="py-3 px-4">Category & Reason</th>
              <th class="py-3 px-4">Date</th>
              <th class="py-3 px-4">Status</th>
              <th class="py-3 px-4 text-center rounded-r-xl">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#F0E6DE] dark:divide-white/10 text-sm">
            <tr
              v-for="rep in filteredReports"
              :key="rep.id"
              class="hover:bg-[#FAF6F2] dark:hover:bg-white/[0.02] transition-colors"
            >
              <td class="py-4 px-4 text-xs font-bold text-[#8A5B43]">
                #{{ rep.id }}
              </td>

              <!-- Reported Member -->
              <td class="py-4 px-4">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-full bg-[#4A3C38] text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {{ (rep.reported_user?.first_name?.[0] || 'U') + (rep.reported_user?.last_name?.[0] || '') }}
                  </div>
                  <div>
                    <p class="font-bold text-[#1A1210] dark:text-[#F0EDE6] text-sm">
                      {{ rep.reported_user?.first_name }} {{ rep.reported_user?.last_name }}
                    </p>
                    <p class="text-xs text-[#8A7A71] dark:text-white/50">
                      {{ rep.reported_user?.email }}
                    </p>
                  </div>
                </div>
              </td>

              <!-- Reporter -->
              <td class="py-4 px-4 text-xs">
                <p class="font-semibold text-[#1A1210] dark:text-[#F0EDE6]">
                  {{ rep.reporter?.first_name }} {{ rep.reporter?.last_name }}
                </p>
                <p class="text-[#8A7A71] dark:text-white/50">
                  {{ rep.reporter?.email }}
                </p>
              </td>

              <!-- Reason -->
              <td class="py-4 px-4 text-xs max-w-xs">
                <span class="inline-block px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-bold uppercase mb-1">
                  {{ rep.category || 'Violation' }}
                </span>
                <p class="text-[#1A1210] dark:text-[#F0EDE6] line-clamp-2">
                  {{ rep.reason }}
                </p>
              </td>

              <!-- Date -->
              <td class="py-4 px-4 text-xs text-[#7D6E66] dark:text-white/60">
                {{ formatTableDate(rep.created_at) }}
              </td>

              <!-- Status -->
              <td class="py-4 px-4">
                <span
                  :class="[
                    'inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider',
                    rep.status === 'pending'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : rep.status === 'reviewed'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-gray-100 text-gray-700'
                  ]"
                >
                  {{ rep.status }}
                </span>
              </td>

              <!-- Actions -->
              <td class="py-4 px-4 text-center">
                <div class="flex items-center justify-center gap-2">
                  <button
                    v-if="rep.status === 'pending'"
                    @click="updateReportStatus(rep.id, 'reviewed')"
                    :disabled="reportActionLoading === rep.id"
                    class="bg-[#8A5B43] hover:bg-[#784E29] text-white px-3.5 py-1.5 rounded-full text-xs font-semibold active:scale-95 transition"
                  >
                    Mark Reviewed
                  </button>
                  <button
                    @click="openSuspendUserModal(rep)"
                    class="bg-[#FAF3EE] hover:bg-[#F3EBE4] text-[#8A5B43] border border-[#D9CBC1] px-3.5 py-1.5 rounded-full text-xs font-semibold active:scale-95 transition"
                  >
                    Suspend Member
                  </button>
                </div>
              </td>
            </tr>

            <!-- Clean Empty State when no reports -->
            <tr v-if="filteredReports.length === 0">
              <td colspan="7" class="py-16 text-center">
                <div class="w-12 h-12 rounded-2xl bg-[#FAF0E6] text-[#8A5B43] flex items-center justify-center mx-auto mb-3 text-xl">
                  🛡️
                </div>
                <h3 class="font-display font-bold text-base text-[#1A1210] dark:text-white">
                  No User Reports
                </h3>
                <p class="text-xs text-[#7D6E66] dark:text-white/60 mt-1 max-w-sm mx-auto">
                  When any user or provider reports an account for fraud, harassment, or policy violations, their report will immediately appear here.
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ══════════════════════════════════════════════════════════════════════
           TAB 2: ORDER DISPUTES TABLE (REAL BOOKING DISPUTES ONLY)
      ══════════════════════════════════════════════════════════════════════════ -->
      <div v-else-if="activeTab === 'disputes'" class="pt-4 overflow-x-auto">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2 text-xs">
            <span class="font-bold text-[#7D6E66] dark:text-white/60">Filter Status:</span>
            <button
              @click="disputeStatusFilter = 'all'; loadDisputes()"
              :class="['px-3 py-1 rounded-full text-xs font-semibold transition', disputeStatusFilter === 'all' ? 'bg-[#8A5B43] text-white' : 'bg-[#FAF0E6] text-[#7D6E66]']"
            >All</button>
            <button
              @click="disputeStatusFilter = 'open'; loadDisputes()"
              :class="['px-3 py-1 rounded-full text-xs font-semibold transition', disputeStatusFilter === 'open' ? 'bg-[#8A5B43] text-white' : 'bg-[#FAF0E6] text-[#7D6E66]']"
            >Open</button>
            <button
              @click="disputeStatusFilter = 'resolved'; loadDisputes()"
              :class="['px-3 py-1 rounded-full text-xs font-semibold transition', disputeStatusFilter === 'resolved' ? 'bg-[#8A5B43] text-white' : 'bg-[#FAF0E6] text-[#7D6E66]']"
            >Resolved</button>
          </div>
          <span class="text-xs text-[#7D6E66] dark:text-white/60">
            Total Disputes: <strong class="text-[#1A1210] dark:text-white">{{ filteredDisputes.length }}</strong>
          </span>
        </div>

        <table class="w-full text-left border-collapse min-w-[760px]">
          <thead>
            <tr class="bg-[#F3EBE4] dark:bg-[#253742] text-[#5A483E] dark:text-[#E0D3C7] text-xs font-bold rounded-xl">
              <th class="py-3 px-4 w-14 rounded-l-xl">ID</th>
              <th class="py-3 px-4">Order / Booking</th>
              <th class="py-3 px-4">Raised By</th>
              <th class="py-3 px-4">Reason & Findings</th>
              <th class="py-3 px-4">Date</th>
              <th class="py-3 px-4">Status</th>
              <th class="py-3 px-4 text-center rounded-r-xl">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#F0E6DE] dark:divide-white/10 text-sm">
            <tr
              v-for="disp in filteredDisputes"
              :key="disp.id"
              class="hover:bg-[#FAF6F2] dark:hover:bg-white/[0.02] transition-colors"
            >
              <td class="py-4 px-4 text-xs font-bold text-[#8A5B43]">
                #{{ disp.id }}
              </td>

              <td class="py-4 px-4">
                <p class="font-bold text-[#1A1210] dark:text-[#F0EDE6] text-sm">
                  {{ disp.booking?.job?.title || disp.booking?.service?.title || `Order #${disp.booking_id || 'N/A'}` }}
                </p>
                <p class="text-xs text-[#8A7A71] dark:text-white/50">
                  Provider: {{ disp.booking?.provider?.user?.first_name }} {{ disp.booking?.provider?.user?.last_name }}
                </p>
              </td>

              <td class="py-4 px-4 text-xs">
                <p class="font-semibold text-[#1A1210] dark:text-[#F0EDE6]">
                  {{ disp.raised_by?.first_name }} {{ disp.raised_by?.last_name }}
                </p>
                <p class="text-[#8A7A71] dark:text-white/50">
                  {{ disp.raised_by?.email }}
                </p>
              </td>

              <td class="py-4 px-4 text-xs max-w-xs">
                <p class="text-[#1A1210] dark:text-[#F0EDE6] font-medium">
                  {{ disp.reason }}
                </p>
                <p v-if="disp.resolution" class="text-emerald-700 dark:text-emerald-400 mt-1 italic">
                  Verdict: {{ disp.resolution }}
                </p>
              </td>

              <td class="py-4 px-4 text-xs text-[#7D6E66] dark:text-white/60">
                {{ formatTableDate(disp.created_at) }}
              </td>

              <td class="py-4 px-4">
                <span
                  :class="[
                    'inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider',
                    disp.status === 'open'
                      ? 'bg-red-100 text-red-800 border border-red-200'
                      : disp.status === 'under_review'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  ]"
                >
                  {{ disp.status }}
                </span>
              </td>

              <td class="py-4 px-4 text-center">
                <button
                  @click="openResolveModal(disp)"
                  class="bg-[#8A5B43] hover:bg-[#784E29] text-white px-4 py-1.5 rounded-full text-xs font-semibold active:scale-95 transition"
                >
                  Arbitrate
                </button>
              </td>
            </tr>

            <!-- Clean Empty State when no disputes -->
            <tr v-if="filteredDisputes.length === 0">
              <td colspan="7" class="py-16 text-center">
                <div class="w-12 h-12 rounded-2xl bg-[#FAF0E6] text-[#8A5B43] flex items-center justify-center mx-auto mb-3 text-xl">
                  ⚖️
                </div>
                <h3 class="font-display font-bold text-base text-[#1A1210] dark:text-white">
                  No Active Order Disputes
                </h3>
                <p class="text-xs text-[#7D6E66] dark:text-white/60 mt-1 max-w-sm mx-auto">
                  When a customer or provider opens a dispute over a booking milestone or escrow release, it will appear here for mediation.
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ══════════════════════════════════════════════════════════════════════
           TAB 3: PROVIDER TECHNICAL SUPPORT & INQUIRIES
      ══════════════════════════════════════════════════════════════════════════ -->
      <div v-else class="pt-4 overflow-x-auto">
        <div class="flex items-center justify-between mb-4">
          <p class="text-xs text-[#7D6E66] dark:text-white/60">
            Provider Platform Assistance & Technical Inquiries
          </p>
        </div>

        <table class="w-full text-left border-collapse min-w-[760px]">
          <thead>
            <tr class="bg-[#F3EBE4] dark:bg-[#253742] text-[#5A483E] dark:text-[#E0D3C7] text-xs font-bold rounded-xl">
              <th class="py-3 px-4 w-14 rounded-l-xl">#</th>
              <th class="py-3 px-4">Provider / Member</th>
              <th class="py-3 px-4">Subject & Issue Details</th>
              <th class="py-3 px-4">Date</th>
              <th class="py-3 px-4">Status</th>
              <th class="py-3 px-4 text-center rounded-r-xl">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#F0E6DE] dark:divide-white/10 text-sm">
            <tr
              v-for="inquiry in filteredTechnical"
              :key="inquiry.id"
              class="hover:bg-[#FAF6F2] dark:hover:bg-white/[0.02] transition-colors"
            >
              <td class="py-4 px-4 text-xs font-bold text-[#8A5B43]">
                #{{ inquiry.id }}
              </td>
              <td class="py-4 px-4">
                <p class="font-bold text-[#1A1210] dark:text-white text-sm">
                  {{ inquiry.provider_name }}
                </p>
                <p class="text-xs text-[#8A7A71]">{{ inquiry.email || inquiry.phone }}</p>
              </td>
              <td class="py-4 px-4 text-xs max-w-xs">
                <p class="font-semibold text-[#1A1210] dark:text-white">{{ inquiry.subject }}</p>
                <p class="text-[#7D6E66] line-clamp-2">{{ inquiry.issue }}</p>
              </td>
              <td class="py-4 px-4 text-xs text-[#7D6E66]">
                {{ formatTableDate(inquiry.created_at) }}
              </td>
              <td class="py-4 px-4">
                <span
                  :class="[
                    'inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider',
                    inquiry.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                  ]"
                >
                  {{ inquiry.status || 'open' }}
                </span>
              </td>
              <td class="py-4 px-4 text-center">
                <button
                  @click="openTechModal(inquiry)"
                  class="bg-[#8A5B43] hover:bg-[#784E29] text-white px-4 py-1.5 rounded-full text-xs font-semibold active:scale-95 transition"
                >
                  Assist
                </button>
              </td>
            </tr>

            <!-- Empty State -->
            <tr v-if="filteredTechnical.length === 0">
              <td colspan="6" class="py-16 text-center">
                <div class="w-12 h-12 rounded-2xl bg-[#FAF0E6] text-[#8A5B43] flex items-center justify-center mx-auto mb-3 text-xl">
                  🛠️
                </div>
                <h3 class="font-display font-bold text-base text-[#1A1210] dark:text-white">
                  No Technical Assistance Tickets
                </h3>
                <p class="text-xs text-[#7D6E66] dark:text-white/60 mt-1 max-w-sm mx-auto">
                  When a provider reaches out for technical assistance, booking glitches, or platform issues, their ticket will appear here.
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Suspend User Modal ── -->
    <div
      v-if="suspendUserModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      @click="suspendUserModalOpen = false"
    >
      <div
        class="bg-white dark:bg-[#1E2D37] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#EADFD7] dark:border-white/10"
        @click.stop
      >
        <h3 class="font-display font-bold text-lg text-[#1A1210] dark:text-[#F0EDE6] mb-1">
          Suspend Member Account
        </h3>
        <p class="text-xs text-[#7D6E66] dark:text-white/60 mb-4">
          Confirm account suspension for member <strong class="text-[#8A5B43]">{{ selectedReportForSuspend?.reported_user?.first_name }} {{ selectedReportForSuspend?.reported_user?.last_name }}</strong>.
        </p>

        <textarea
          v-model="userSuspendReason"
          rows="3"
          placeholder="State the policy enforcement violation reason..."
          class="w-full rounded-2xl bg-[#F5EDE6] dark:bg-[#253742] border border-[#EBE0D7] dark:border-white/10 p-3.5 text-xs text-[#1A1210] dark:text-white outline-none focus:border-[#8A5B43] focus:ring-2 focus:ring-[#8A5B43]/20 mb-4"
        ></textarea>

        <div class="flex items-center justify-end gap-3">
          <button
            @click="suspendUserModalOpen = false"
            class="px-4 py-2 rounded-full text-xs font-semibold text-[#7D6E66] hover:bg-[#FAF0E6] transition"
          >
            Cancel
          </button>
          <button
            @click="confirmSuspendUser"
            :disabled="userSuspendLoading"
            class="px-5 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition"
          >
            <span v-if="userSuspendLoading">Suspending...</span>
            <span v-else>Confirm Suspension</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ── Dispute Resolution Modal ── -->
    <div
      v-if="resolveModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      @click="resolveModalOpen = false"
    >
      <div
        class="bg-white dark:bg-[#1E2D37] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#EADFD7] dark:border-white/10"
        @click.stop
      >
        <h3 class="font-display font-bold text-lg text-[#1A1210] dark:text-[#F0EDE6] mb-1">
          Arbitrate Dispute #{{ selectedDispute?.id }}
        </h3>
        <p class="text-xs text-[#7D6E66] dark:text-white/60 mb-4">
          Order: {{ selectedDispute?.booking?.job?.title || selectedDispute?.booking?.service?.title || `Booking #${selectedDispute?.booking_id}` }}
        </p>

        <div class="mb-4">
          <label class="block text-xs font-bold text-[#5A483E] dark:text-white/70 uppercase tracking-wider mb-1.5">Action Status</label>
          <div class="grid grid-cols-2 gap-3">
            <button
              type="button"
              @click="resolvingStatus = 'under_review'"
              :class="[
                'py-2 px-3 rounded-xl text-xs font-bold border transition',
                resolvingStatus === 'under_review' ? 'bg-amber-100 text-amber-800 border-amber-300' : 'border-[#EADFD7] text-[#7D6E66]'
              ]"
            >
              Mark Under Review
            </button>
            <button
              type="button"
              @click="resolvingStatus = 'resolved'"
              :class="[
                'py-2 px-3 rounded-xl text-xs font-bold border transition',
                resolvingStatus === 'resolved' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'border-[#EADFD7] text-[#7D6E66]'
              ]"
            >
              Mark Resolved
            </button>
          </div>
        </div>

        <div class="mb-5">
          <label class="block text-xs font-bold text-[#5A483E] dark:text-white/70 uppercase tracking-wider mb-1.5">Arbitrator Verdict / Resolution</label>
          <textarea
            v-model="resolutionText"
            rows="3"
            placeholder="Document arbitrator findings, agreed escrow release or refund actions..."
            class="w-full rounded-2xl bg-[#F5EDE6] dark:bg-[#253742] border border-[#EBE0D7] dark:border-white/10 p-3.5 text-xs text-[#1A1210] dark:text-white outline-none focus:border-[#8A5B43] focus:ring-2 focus:ring-[#8A5B43]/20"
          ></textarea>
        </div>

        <div class="flex items-center justify-end gap-3">
          <button
            @click="resolveModalOpen = false"
            class="px-4 py-2 rounded-full text-xs font-semibold text-[#7D6E66] hover:bg-[#FAF0E6] transition"
          >
            Cancel
          </button>
          <button
            @click="submitResolution"
            :disabled="resolveLoading"
            class="px-5 py-2 rounded-full bg-[#8A5B43] hover:bg-[#784E29] text-white text-xs font-semibold shadow-xs transition"
          >
            <span v-if="resolveLoading">Saving...</span>
            <span v-else>Save Resolution</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ── Technical Support Modal ── -->
    <div
      v-if="techModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      @click="techModalOpen = false"
    >
      <div
        class="bg-white dark:bg-[#1E2D37] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#EADFD7] dark:border-white/10"
        @click.stop
      >
        <h3 class="font-display font-bold text-lg text-[#1A1210] dark:text-white mb-1">
          Technical Assistance #{{ selectedInquiry?.id }}
        </h3>
        <p class="text-xs text-[#7D6E66] dark:text-white/60 mb-3">
          From: <strong class="text-[#8A5B43]">{{ selectedInquiry?.provider_name }}</strong>
        </p>

        <div class="p-3.5 rounded-2xl bg-[#FAF0E6] text-xs text-[#5A483E] mb-4">
          <p class="font-bold mb-1">{{ selectedInquiry?.subject }}</p>
          <p>{{ selectedInquiry?.issue }}</p>
        </div>

        <div class="flex items-center justify-end gap-3">
          <button
            @click="techModalOpen = false"
            class="px-4 py-2 rounded-full text-xs font-semibold text-[#7D6E66] hover:bg-[#FAF0E6] transition"
          >
            Close
          </button>
          <button
            @click="resolveTechnicalInquiry"
            class="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition"
          >
            Mark Issue Resolved
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
