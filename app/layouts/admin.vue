<script setup lang="ts">
const { apiFetch, token } = useApi()
const router = useRouter()
const route = useRoute()

const user = ref<any>(null)
const mobileSidebarOpen = ref(false)
const userMenuOpen = ref(false)
const adminSearch = ref('')

onMounted(async () => {
  if (token.value) {
    try {
      user.value = await apiFetch('/user')
    } catch {
      user.value = null
    }
  }
})

watch(token, async (val) => {
  if (!val) {
    user.value = null
    return
  }
  try {
    user.value = await apiFetch('/user')
  } catch {
    user.value = null
  }
})

const initials = computed(() => {
  if (!user.value) return 'AD'
  const first = user.value.first_name?.[0] ?? ''
  const last = user.value.last_name?.[0] ?? ''
  return (first + last).toUpperCase() || 'AD'
})

const roleName = computed(() => user.value?.role?.name ?? '')
const isFullAdmin = computed(() => user.value?.is_admin === true || roleName.value === 'admin')
const canAccessSupport = computed(() => isFullAdmin.value || roleName.value === 'admin_support')
const canAccessFinance = computed(() => isFullAdmin.value || roleName.value === 'admin_finance')

const pageTitle = computed(() => {
  if (route.path.includes('/admin/providers')) return 'Provider Verification Console'
  if (route.path.includes('/admin/support')) return 'Support Operations & Safety'
  if (route.path.includes('/admin/finance')) return 'Finance & Escrow Operations'
  return 'Admin Command Center'
})

const activeSupportTab = computed(() => {
  if (!route.path.includes('/admin/support')) return ''
  const tab = route.query.tab as string
  if (tab === 'disputes') return 'disputes'
  if (tab === 'technical') return 'technical'
  return 'reports'
})

const activeFinanceTab = computed(() => {
  if (!route.path.includes('/admin/finance')) return ''
  const tab = route.query.tab as string
  if (tab === 'transactions') return 'transactions'
  if (tab === 'escrow') return 'escrow'
  if (tab === 'gateways') return 'gateways'
  return 'overview'
})

async function logout() {
  userMenuOpen.value = false
  try {
    await apiFetch('/logout', { method: 'POST' })
  } catch {}
  token.value = null
  user.value = null
  router.push('/login')
}

function closeMenus() {
  userMenuOpen.value = false
}

onMounted(() => {
  if (import.meta.client) {
    window.addEventListener('click', closeMenus)
  }
})

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('click', closeMenus)
  }
})
</script>

<template>
  <div class="admin-shell min-h-screen bg-[#FBF8F5] dark:bg-[#15232D] flex text-ink dark:text-[#F0EDE6] antialiased">
    <!-- ── Dedicated Admin Sidebar (Desktop) ── -->
    <aside class="hidden lg:flex flex-col w-64 bg-[#8A5B43] text-white shrink-0 min-h-screen select-none sticky top-0 h-screen z-30 shadow-xl">
      <!-- Admin Portal Brand -->
      <div class="p-6 flex items-center justify-between border-b border-white/10">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[#8A5B43] shadow-xs">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M3 8.5 6.5 12 13 4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div>
            <span class="font-display text-lg font-bold text-white tracking-tight block leading-tight">
              SkillLink
            </span>
            <span class="text-[10px] uppercase font-bold tracking-widest text-white/70">
              Admin Portal
            </span>
          </div>
        </div>
      </div>

      <!-- Admin Navigation Links (Strictly Admin Controls - No Customer/Provider items!) -->
      <nav class="flex-1 overflow-y-auto px-3.5 py-4 space-y-3 text-sm">
        <!-- Section: Trust & Moderation -->
        <div v-if="canAccessSupport">
          <div class="px-3 pb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-white/50">
            Trust, Safety & Support
          </div>

          <!-- Main Support Ops -->
          <NuxtLink
            to="/admin/support"
            class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold transition"
            :class="route.path === '/admin/support' ? 'bg-white/20 text-white shadow-2xs' : 'text-white/80 hover:bg-white/10 hover:text-white'"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span>Operations Hub</span>
          </NuxtLink>

          <!-- Provider Verification -->
          <NuxtLink
            to="/admin/providers"
            class="flex items-center gap-3 px-3.5 py-2.5 mt-1 rounded-xl font-semibold transition"
            :class="route.path === '/admin/providers' ? 'bg-white/20 text-white shadow-2xs' : 'text-white/80 hover:bg-white/10 hover:text-white'"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="m9 12 2 2 4-4"/><path d="M12 3a12 12 0 0 0 8.5 3A12 12 0 0 1 12 21 12 12 0 0 1 3.5 6 12 12 0 0 0 12 3z"/>
            </svg>
            <span>Provider Verification</span>
          </NuxtLink>

          <!-- Direct Sub-items under Support -->
          <div class="mt-1 ml-2 pl-3 border-l border-white/20 space-y-1 text-xs">
            <!-- 1. User Reports -->
            <NuxtLink
              :to="{ path: '/admin/support', query: { tab: 'reports' } }"
              class="flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition"
              :class="activeSupportTab === 'reports' ? 'bg-white/25 text-white font-bold' : 'text-white/80 hover:bg-white/10 hover:text-white'"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                <line x1="4" y1="22" x2="4" y2="15"/>
              </svg>
              <span>User Reports</span>
            </NuxtLink>

            <!-- 2. Order Disputes -->
            <NuxtLink
              :to="{ path: '/admin/support', query: { tab: 'disputes' } }"
              class="flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition"
              :class="activeSupportTab === 'disputes' ? 'bg-white/25 text-white font-bold' : 'text-white/80 hover:bg-white/10 hover:text-white'"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>Order Disputes</span>
            </NuxtLink>

            <!-- 3. Provider Technical Support -->
            <NuxtLink
              :to="{ path: '/admin/support', query: { tab: 'technical' } }"
              class="flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition"
              :class="activeSupportTab === 'technical' ? 'bg-white/25 text-white font-bold' : 'text-white/80 hover:bg-white/10 hover:text-white'"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
              </svg>
              <span>Technical Support</span>
            </NuxtLink>
          </div>
        </div>

        <!-- Section: Finance -->
        <div v-if="canAccessFinance" class="pt-2">
          <div class="px-3 pb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-white/50">
            Platform Finances
          </div>
          <NuxtLink
            to="/admin/finance"
            class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold transition"
            :class="route.path === '/admin/finance' ? 'bg-white/20 text-white shadow-2xs' : 'text-white/80 hover:bg-white/10 hover:text-white'"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect width="20" height="14" x="2" y="5" rx="2"/>
              <line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
            <span>Finance & Escrow Hub</span>
          </NuxtLink>

          <!-- Direct Sub-items under Finance -->
          <div class="mt-1 ml-2 pl-3 border-l border-white/20 space-y-1 text-xs">
            <!-- 1. Overview & Analytics -->
            <NuxtLink
              :to="{ path: '/admin/finance', query: { tab: 'overview' } }"
              class="flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition"
              :class="activeFinanceTab === 'overview' ? 'bg-white/25 text-white font-bold' : 'text-white/80 hover:bg-white/10 hover:text-white'"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M3 3v18h18"/>
                <path d="m19 9-5 5-4-4-3 3"/>
              </svg>
              <span>Financial Overview</span>
            </NuxtLink>

            <!-- 2. Transaction Ledger -->
            <NuxtLink
              :to="{ path: '/admin/finance', query: { tab: 'transactions' } }"
              class="flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition"
              :class="activeFinanceTab === 'transactions' ? 'bg-white/25 text-white font-bold' : 'text-white/80 hover:bg-white/10 hover:text-white'"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <line x1="8" y1="6" x2="21" y2="6"/>
                <line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/>
                <line x1="3" y1="12" x2="3.01" y2="12"/>
                <line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
              <span>Transaction Ledger</span>
            </NuxtLink>

            <!-- 3. Escrow & Settlements -->
            <NuxtLink
              :to="{ path: '/admin/finance', query: { tab: 'escrow' } }"
              class="flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition"
              :class="activeFinanceTab === 'escrow' ? 'bg-white/25 text-white font-bold' : 'text-white/80 hover:bg-white/10 hover:text-white'"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <span>Escrow & Settlements</span>
            </NuxtLink>

            <!-- 4. Payment Gateways -->
            <NuxtLink
              :to="{ path: '/admin/finance', query: { tab: 'gateways' } }"
              class="flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition"
              :class="activeFinanceTab === 'gateways' ? 'bg-white/25 text-white font-bold' : 'text-white/80 hover:bg-white/10 hover:text-white'"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
              <span>Payment Gateways</span>
            </NuxtLink>
          </div>
        </div>
      </nav>

      <!-- Admin Status & Quick Logout at bottom -->
      <div class="p-4 border-t border-white/10 bg-black/10">
        <div class="flex items-center justify-between text-xs text-white/80 mb-2">
          <span class="font-semibold">{{ user?.first_name || 'Admin' }}</span>
          <span class="inline-flex items-center gap-1.5 text-[11px] text-emerald-300">
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
            Online
          </span>
        </div>
        <button
          @click="logout"
          class="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>

    <!-- ── Mobile Drawer ── -->
    <div v-if="mobileSidebarOpen" class="fixed inset-0 z-50 bg-black/60 lg:hidden" @click="mobileSidebarOpen = false">
      <aside class="w-72 bg-[#8A5B43] text-white h-full flex flex-col p-5 overflow-y-auto" @click.stop>
        <div class="flex items-center justify-between pb-4 border-b border-white/15 mb-4">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded bg-white flex items-center justify-center text-[#8A5B43] font-bold text-xs">✓</div>
            <span class="font-display font-bold text-lg text-white">SkillLink Admin</span>
          </div>
          <button @click="mobileSidebarOpen = false" class="text-white/70 hover:text-white text-xl">&times;</button>
        </div>
        <nav class="space-y-4 text-sm">
          <div v-if="canAccessSupport">
            <div class="text-[10px] font-extrabold uppercase tracking-wider text-white/50 mb-1.5">Trust & Support</div>
            <div class="space-y-1">
              <NuxtLink to="/admin/support" @click="mobileSidebarOpen = false" class="block py-2 px-3 rounded-xl hover:bg-white/10" :class="route.path === '/admin/support' ? 'bg-white/20 font-bold' : ''">Operations Hub</NuxtLink>
              <NuxtLink to="/admin/providers" @click="mobileSidebarOpen = false" class="block py-2 px-3 rounded-xl hover:bg-white/10" :class="route.path === '/admin/providers' ? 'bg-white/20 font-bold' : ''">Provider Verification</NuxtLink>
              <NuxtLink :to="{ path: '/admin/support', query: { tab: 'reports' } }" @click="mobileSidebarOpen = false" class="block py-2 px-3 rounded-xl hover:bg-white/10" :class="activeSupportTab === 'reports' ? 'bg-white/20 font-bold' : ''">User Reports</NuxtLink>
              <NuxtLink :to="{ path: '/admin/support', query: { tab: 'disputes' } }" @click="mobileSidebarOpen = false" class="block py-2 px-3 rounded-xl hover:bg-white/10" :class="activeSupportTab === 'disputes' ? 'bg-white/20 font-bold' : ''">Order Disputes</NuxtLink>
              <NuxtLink :to="{ path: '/admin/support', query: { tab: 'technical' } }" @click="mobileSidebarOpen = false" class="block py-2 px-3 rounded-xl hover:bg-white/10" :class="activeSupportTab === 'technical' ? 'bg-white/20 font-bold' : ''">Technical Support</NuxtLink>
            </div>
          </div>
          <div v-if="canAccessFinance">
            <div class="text-[10px] font-extrabold uppercase tracking-wider text-white/50 mb-1.5">Platform Finances</div>
            <div class="space-y-1">
              <NuxtLink :to="{ path: '/admin/finance', query: { tab: 'overview' } }" @click="mobileSidebarOpen = false" class="block py-2 px-3 rounded-xl hover:bg-white/10" :class="activeFinanceTab === 'overview' ? 'bg-white/20 font-bold' : ''">Financial Overview</NuxtLink>
              <NuxtLink :to="{ path: '/admin/finance', query: { tab: 'transactions' } }" @click="mobileSidebarOpen = false" class="block py-2 px-3 rounded-xl hover:bg-white/10" :class="activeFinanceTab === 'transactions' ? 'bg-white/20 font-bold' : ''">Transaction Ledger</NuxtLink>
              <NuxtLink :to="{ path: '/admin/finance', query: { tab: 'escrow' } }" @click="mobileSidebarOpen = false" class="block py-2 px-3 rounded-xl hover:bg-white/10" :class="activeFinanceTab === 'escrow' ? 'bg-white/20 font-bold' : ''">Escrow & Settlements</NuxtLink>
              <NuxtLink :to="{ path: '/admin/finance', query: { tab: 'gateways' } }" @click="mobileSidebarOpen = false" class="block py-2 px-3 rounded-xl hover:bg-white/10" :class="activeFinanceTab === 'gateways' ? 'bg-white/20 font-bold' : ''">Payment Gateways</NuxtLink>
            </div>
          </div>
        </nav>
      </aside>
    </div>

    <!-- ── Main Admin Area ── -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- ── Top Header Bar ── -->
      <header class="h-16 px-6 sm:px-8 flex items-center justify-between gap-4 border-b border-[#EBE0D7] dark:border-white/10 bg-[#FBF8F5]/95 dark:bg-[#15232D]/95 backdrop-blur-sm sticky top-0 z-20">
        <!-- Left: Mobile menu toggle + Breadcrumbs -->
        <div class="flex items-center gap-3">
          <button
            @click="mobileSidebarOpen = true"
            class="lg:hidden p-2 rounded-xl text-ink/70 hover:bg-[#F3EBE4] transition"
            aria-label="Open admin menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>

          <div class="flex items-center gap-2 text-sm sm:text-base">
            <span class="font-display font-semibold text-[#8A5B43] dark:text-[#D4A98A]">Admin Portal</span>
            <span class="text-[#8A5B43]/40">/</span>
            <span class="font-display font-bold text-[#1A1210] dark:text-[#F0EDE6]">{{ pageTitle }}</span>
          </div>
        </div>

        <!-- Right: Admin controls -->
        <div class="flex items-center gap-3">
          <!-- Admin Avatar & Quick Actions -->
          <div class="relative" @click.stop>
            <button
              @click="userMenuOpen = !userMenuOpen"
              class="w-9 h-9 rounded-full bg-[#8A5B43] text-white flex items-center justify-center font-display text-xs font-bold shadow-xs hover:ring-2 hover:ring-[#8A5B43]/40 transition active:scale-95"
              aria-label="Admin menu"
            >
              {{ initials }}
            </button>

            <!-- Dropdown Menu -->
            <div
              v-if="userMenuOpen"
              class="absolute right-0 top-11 w-48 rounded-2xl bg-white dark:bg-[#1C3340] border border-[#EBE0D7] dark:border-white/10 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
            >
              <div class="px-4 py-2 border-b border-mist/80 dark:border-white/10">
                <p class="text-xs font-bold text-ink dark:text-white">{{ user?.first_name }} {{ user?.last_name }}</p>
                <p class="text-[11px] text-ink/50 dark:text-white/50 truncate">{{ user?.email }}</p>
              </div>
              <button
                @click="logout"
                class="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-[#8A5B43] hover:bg-[#F5EDE6] dark:hover:bg-white/5 transition text-left"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- ── Admin Page Body ── -->
      <main class="flex-1 p-5 sm:p-8 max-w-[1600px] w-full mx-auto">
        <slot />
      </main>

      <!-- ── Clean Bottom Footer ── -->
      <footer class="py-5 text-center text-xs text-ink/40 dark:text-white/40 flex items-center justify-center gap-2 select-none border-t border-[#EBE0D7]/60 dark:border-white/5">
        <span class="text-sm">🌍</span>
        <span>Built for Ethiopia &bull; SkillLink Support Portal</span>
      </footer>
    </div>
  </div>
</template>
