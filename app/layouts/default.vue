<script setup lang="ts">
import { categories } from '~/data/categories'

const { apiFetch, token } = useApi()
const { resolveMediaUrl } = useProviderAvatar()
const { isDark, toggleTheme } = useTheme()
const { totalUnreadCount, initializeChat, loadThreads } = useChat()
const { unreadCount: notifUnread, refreshUnread: refreshNotifUnread } = useNotifications()
const router = useRouter()
const route = useRoute()

let unreadPoll = null
let onPhotoUpdated = null
onMounted(async () => {
  if (import.meta.client) {
    onPhotoUpdated = (e: any) => {
      if (user.value) {
        user.value.profile_photo = e.detail
      }
    }
    window.addEventListener('skilllink:profile_photo_updated', onPhotoUpdated)
  }
  if (token.value) {
    initializeChat()
    refreshNotifUnread()
    unreadPoll = setInterval(() => {
      if (token.value) { loadThreads(); refreshNotifUnread() }
    }, 25000)
  }
})
onBeforeUnmount(() => {
  if (unreadPoll) clearInterval(unreadPoll)
  if (import.meta.client && onPhotoUpdated) {
    window.removeEventListener('skilllink:profile_photo_updated', onPhotoUpdated)
  }
})

const user = useState('skilllink_auth_user', () => null)
const sidebarOpen = ref(false)
const sidebarPinned = ref(false)
const findWorkMenuOpen = ref(false)
const userMenuOpen = ref(false)
const userMenuRef = ref(null)
const headerSearch = ref('')

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

function toggleSidebarPin() {
  sidebarPinned.value = !sidebarPinned.value
  if (sidebarPinned.value) {
    sidebarOpen.value = true
  }
  if (import.meta.client) {
    localStorage.setItem('skilllink_sidebar_pinned', String(sidebarPinned.value))
  }
}

function closeSidebar() {
  sidebarOpen.value = false
  sidebarPinned.value = false
  if (import.meta.client) {
    localStorage.setItem('skilllink_sidebar_pinned', 'false')
  }
}

function onSidebarNavClick() {
  if (!sidebarPinned.value) {
    sidebarOpen.value = false
  }
}

function closeAllMenus() {
  if (!sidebarPinned.value) {
    sidebarOpen.value = false
  }
  findWorkMenuOpen.value = false
  userMenuOpen.value = false
}

function onDocumentClick(e) {
  if (userMenuOpen.value && userMenuRef.value && !userMenuRef.value.contains(e.target)) {
    userMenuOpen.value = false
  }
}

function onPhotoUpdated(e) {
  if (user.value) {
    user.value.profile_photo = e?.detail
  }
}

onMounted(() => {
  if (import.meta.client) {
    document.addEventListener('click', onDocumentClick)
    window.addEventListener('skilllink:profile_photo_updated', onPhotoUpdated)
    const savedPin = localStorage.getItem('skilllink_sidebar_pinned')
    if (savedPin === 'true') {
      sidebarPinned.value = true
      sidebarOpen.value = true
    }
  }
})

onBeforeUnmount(() => {
  if (import.meta.client) {
    document.removeEventListener('click', onDocumentClick)
    window.removeEventListener('skilllink:profile_photo_updated', onPhotoUpdated)
  }
})

// Only lock background scroll when the sidebar is an overlay (open AND NOT pinned)
const navigationOpen = computed(() => sidebarOpen.value && !sidebarPinned.value)
watch(navigationOpen, (open) => {
  if (import.meta.client) document.documentElement.classList.toggle('navigation-open', open)
})

onBeforeUnmount(() => {
  if (import.meta.client) document.documentElement.classList.remove('navigation-open')
})

function handleHeaderSearch() {
  const q = headerSearch.value.trim()
  router.push(q ? `/browse?q=${encodeURIComponent(q)}` : '/browse')
  headerSearch.value = ''
  if (!sidebarPinned.value) sidebarOpen.value = false
}

watch(token, async (val) => {
  if (!val) { user.value = null; return }
  try {
    user.value = await apiFetch('/user')
    if (import.meta.client && user.value?.id && !user.value.profile_photo) {
      const saved = localStorage.getItem(`skilllink_user_photo_${user.value.id}`)
      if (saved) user.value.profile_photo = saved
    }
  } catch { user.value = null }
}, { immediate: false })

onMounted(async () => {
  if (token.value) {
    try {
      user.value = await apiFetch('/user')
      if (import.meta.client && user.value?.id && !user.value.profile_photo) {
        const saved = localStorage.getItem(`skilllink_user_photo_${user.value.id}`)
        if (saved) user.value.profile_photo = saved
      }
    } catch { user.value = null }
  }
})

async function logout() {
  try { await apiFetch('/logout', { method: 'POST' }) } catch {}
  token.value = null
  user.value = null
  sidebarOpen.value = false
  sidebarPinned.value = false
  if (import.meta.client) localStorage.setItem('skilllink_sidebar_pinned', 'false')
  userMenuOpen.value = false
  router.push('/login')
}

const isProvider = computed(() => user.value?.role?.name === 'provider')
const isCustomer  = computed(() => user.value?.role?.name === 'customer')
const isAdmin     = computed(() => user.value?.role?.name === 'admin' || user.value?.is_admin === true)
const isAdminFinance = computed(() => user.value?.role?.name === 'admin_finance' || isAdmin.value)
const isAdminSupport = computed(() => user.value?.role?.name === 'admin_support' || isAdmin.value)

const initials = computed(() => {
  if (!user.value) return ''
  return `${user.value.first_name?.[0] ?? ''}${user.value.last_name?.[0] ?? ''}`.toUpperCase()
})

function isActive(path) {
  return route.path === path || route.path.startsWith(path + '/')
}

watch(() => route.fullPath, () => {
  closeAllMenus()
})
</script>

<template>
  <div
    :class="[
      'min-h-screen bg-canvas dark:bg-canvas-dark flex flex-col transition-[padding] duration-300',
      sidebarPinned && sidebarOpen ? 'lg:pl-72' : ''
    ]"
  >

    <!-- ── Navbar ── -->
    <header class="sticky top-0 z-40 border-b border-mist/80 dark:border-mist-dark/60 bg-canvas/95 dark:bg-canvas-dark/95 backdrop-blur-md transition-colors">
      <div class="max-w-[1530px] mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">

        <!-- Left group: Sidebar Triple Line (☰) + Brand Logo -->
        <div class="flex items-center gap-3 shrink-0">
          <!-- Sidebar Toggle Hamburger (Triple Line ☰) -->
          <button
            @click.stop="toggleSidebar"
            class="w-10 h-10 rounded-xl flex items-center justify-center text-ink/80 dark:text-[#F0EDE6] hover:bg-clay/10 hover:text-clay dark:hover:bg-white/10 dark:hover:text-[#D4A98A] transition active:scale-95"
            aria-label="Open Navigation Sidebar"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>

          <!-- Logo -->
          <NuxtLink to="/" class="shrink-0 transition-transform hover:scale-[1.02]">
            <BrandLogo />
          </NuxtLink>
        </div>

        <!-- Centre nav links (desktop) -->
        <nav class="hidden md:flex items-center gap-1.5 shrink-0">
          <NuxtLink
            to="/"
            :class="[
              'px-3.5 py-2 rounded-xl text-sm font-medium transition-all',
              route.path === '/'
                ? 'bg-clay/15 text-clay dark:text-[#D4A98A] font-bold shadow-xs'
                : 'text-ink/80 dark:text-[#F0EDE6]/80 hover:bg-clay/10 dark:hover:bg-white/10 hover:text-clay dark:hover:text-white'
            ]"
          >Home</NuxtLink>

          <!-- FOR PROVIDERS: Direct 'Find Work' link -->
          <template v-if="isProvider">
            <NuxtLink
              to="/jobs"
              :class="[
                'px-3.5 py-2 rounded-xl text-sm font-medium transition-all',
                isActive('/jobs')
                  ? 'bg-clay/15 text-clay dark:text-[#D4A98A] font-bold shadow-xs'
                  : 'text-ink/80 dark:text-[#F0EDE6]/80 hover:bg-clay/10 dark:hover:bg-white/10 hover:text-clay dark:hover:text-white'
              ]"
            >Find Work</NuxtLink>
          </template>

          <!-- FOR CUSTOMERS & GUESTS: 'Find Workers' Dropdown (to browse talent and post jobs) -->
          <template v-else>
            <div class="relative">
              <button
                @click.stop="findWorkMenuOpen = !findWorkMenuOpen"
                :class="[
                  'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all',
                  isActive('/browse') || findWorkMenuOpen
                    ? 'bg-clay/15 text-clay dark:text-[#D4A98A] font-bold shadow-xs'
                    : 'text-ink/80 dark:text-[#F0EDE6]/80 hover:bg-clay/10 dark:hover:bg-white/10 hover:text-clay dark:hover:text-white'
                ]"
              >
                <span>Find Workers</span>
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                  class="transition-transform duration-200"
                  :class="findWorkMenuOpen ? 'rotate-180 text-clay' : ''"
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              <MegaMenu
                v-if="findWorkMenuOpen"
                :categories="categories"
                mode="customer"
                @close="findWorkMenuOpen = false"
              />
            </div>


          </template>

          <!-- Hide 'How It Works' for logged-in providers -->
          <NuxtLink
            v-if="!isProvider"
            to="/#how-it-works"
            class="px-3.5 py-2 rounded-xl text-sm font-medium text-ink/80 dark:text-[#F0EDE6]/80 hover:bg-clay/10 dark:hover:bg-white/10 hover:text-clay dark:hover:text-white transition-all"
          >How It Works</NuxtLink>

          <NuxtLink
            to="/support"
            :class="[
              'px-3.5 py-2 rounded-xl text-sm font-medium transition-all',
              isActive('/support')
                ? 'bg-clay/15 text-clay dark:text-[#D4A98A] font-bold shadow-xs'
                : 'text-ink/80 dark:text-[#F0EDE6]/80 hover:bg-clay/10 dark:hover:bg-white/10 hover:text-clay dark:hover:text-white'
            ]"
          >Support</NuxtLink>
        </nav>

        <!-- Quick search (desktop) -->
        <div class="hidden lg:flex flex-1 max-w-[300px]">
          <div class="relative w-full">
            <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-clay/60 dark:text-[#D4A98A]/60 flex items-center justify-center pointer-events-none">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            <input
              v-model="headerSearch" @keyup.enter="handleHeaderSearch" type="text"
              placeholder="Search services or talent…"
              class="w-full rounded-full bg-mist/35 dark:bg-surface-dark border border-mist/90 dark:border-mist-dark/70 focus:bg-white dark:focus:bg-surface-dark-hover focus:border-clay focus:ring-2 focus:ring-clay/20 pl-9 pr-4 py-2 text-sm text-ink dark:text-[#F0EDE6] placeholder:text-ink/40 dark:placeholder:text-white/40 outline-none transition-all shadow-2xs"
            />
          </div>
        </div>

        <!-- Right side quick actions -->
        <div class="flex items-center gap-2 shrink-0">
          <!-- Theme toggle button (like message and notification icon) -->
          <button
            @click="toggleTheme"
            class="relative w-9 h-9 rounded-xl flex items-center justify-center text-ink/75 dark:text-[#F0EDE6]/80 hover:text-clay hover:bg-clay/10 dark:hover:bg-white/10 dark:hover:text-[#D4A98A] transition active:scale-95"
            :title="isDark ? 'Switch to Light mode' : 'Switch to Dark mode'"
            :aria-label="isDark ? 'Switch to Light mode' : 'Switch to Dark mode'"
          >
            <!-- Sun icon when in dark mode -->
            <svg v-if="isDark" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="text-amber-400">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
            <!-- Moon icon when in light mode -->
            <svg v-else width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          </button>

          <!-- Not logged in -->
          <template v-if="!user">
            <NuxtLink to="/login" class="text-sm font-semibold text-ink/80 dark:text-[#F0EDE6]/80 hover:text-clay dark:hover:text-[#D4A98A] hover:bg-clay/5 dark:hover:bg-white/5 px-3.5 py-2 rounded-xl transition">
              Sign in
            </NuxtLink>
            <NuxtLink to="/register" class="text-sm font-bold bg-gradient-to-r from-clay to-clay-dark hover:from-clay-dark hover:to-clay text-white px-5 py-2 rounded-full transition shadow-xs hover:shadow-sm active:scale-98">
              Get started
            </NuxtLink>
          </template>

          <!-- Logged in quick shortcuts -->
          <template v-else>
            <!-- Notifications quick icon -->
            <NuxtLink
              to="/notifications"
              class="relative w-9 h-9 rounded-xl flex items-center justify-center text-ink/75 dark:text-[#F0EDE6]/80 hover:text-clay hover:bg-clay/10 dark:hover:bg-white/10 dark:hover:text-[#D4A98A] transition active:scale-95"
              aria-label="Notifications"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8a6 6 0 1 0-12 0c0 6-2.5 8-2.5 8h17S18 14 18 8z"/><path d="M13.5 21a2 2 0 0 1-3 0"/>
              </svg>
              <span
                v-if="notifUnread > 0"
                class="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-canvas-dark shadow-xs"
              >
                {{ notifUnread > 9 ? '9+' : notifUnread }}
              </span>
            </NuxtLink>

            <!-- Messages quick icon -->
            <NuxtLink
              to="/messages"
              class="relative w-9 h-9 rounded-xl flex items-center justify-center text-ink/75 dark:text-[#F0EDE6]/80 hover:text-clay hover:bg-clay/10 dark:hover:bg-white/10 dark:hover:text-[#D4A98A] transition active:scale-95"
              aria-label="Messages"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H8l-4 3.5V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/>
              </svg>
              <span
                v-if="totalUnreadCount > 0"
                class="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-clay text-white text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-canvas-dark shadow-xs"
              >
                {{ totalUnreadCount }}
              </span>
            </NuxtLink>

            <!-- User avatar dropdown menu -->
            <div ref="userMenuRef" class="relative">
              <button
                @click.stop="userMenuOpen = !userMenuOpen"
                class="flex items-center gap-2 rounded-full p-0.5 border border-clay/30 hover:border-clay ring-2 ring-transparent hover:ring-clay/20 transition active:scale-95"
                :class="userMenuOpen ? 'border-clay ring-clay/20 shadow-xs' : ''"
                title="Account & Profile Menu"
                aria-haspopup="true"
                :aria-expanded="userMenuOpen"
              >
                <img
                  v-if="user?.profile_photo"
                  :src="resolveMediaUrl(user.profile_photo)"
                  :alt="initials"
                  class="w-8 h-8 rounded-full object-cover shadow-2xs"
                />
                <span v-else class="w-8 h-8 rounded-full bg-gradient-to-br from-clay to-clay-dark flex items-center justify-center font-display text-xs font-bold text-white shadow-2xs">{{ initials }}</span>
              </button>

              <!-- Dropdown Menu -->
              <transition
                enter-active-class="transition duration-150 ease-out"
                enter-from-class="transform scale-95 opacity-0 -translate-y-1"
                enter-to-class="transform scale-100 opacity-100 translate-y-0"
                leave-active-class="transition duration-100 ease-in"
                leave-from-class="transform scale-100 opacity-100 translate-y-0"
                leave-to-class="transform scale-95 opacity-0 -translate-y-1"
              >
                <div
                  v-if="userMenuOpen"
                  class="absolute right-0 mt-2.5 w-64 rounded-2xl bg-white dark:bg-[#1E293B] border border-mist dark:border-white/10 shadow-xl overflow-hidden z-50 py-1.5 focus:outline-none"
                >
                  <!-- User Header -->
                  <div class="px-4 py-3 border-b border-mist/80 dark:border-white/10 bg-mist/20 dark:bg-white/[0.02]">
                    <div class="flex items-center gap-3">
                      <img
                        v-if="user?.profile_photo"
                        :src="resolveMediaUrl(user.profile_photo)"
                        :alt="initials"
                        class="w-10 h-10 rounded-full object-cover shrink-0 shadow-xs border border-clay/20"
                      />
                      <span v-else class="w-10 h-10 rounded-full bg-gradient-to-br from-clay to-clay-dark flex items-center justify-center font-display text-sm font-bold text-white shadow-xs shrink-0">
                        {{ initials }}
                      </span>
                      <div class="min-w-0 flex-1">
                        <p class="font-display font-semibold text-sm text-ink dark:text-white truncate">
                          {{ user?.name || (user?.first_name ? `${user.first_name} ${user.last_name || ''}` : 'My Account') }}
                        </p>
                        <p class="text-xs text-ink/50 dark:text-white/50 truncate">
                          {{ user?.email }}
                        </p>
                        <span class="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider" :class="isProvider ? 'bg-clay/10 text-clay dark:bg-[#D4A98A]/15 dark:text-[#D4A98A]' : 'bg-teal-500/10 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400'">
                          {{ user?.role?.name || (isProvider ? 'Provider' : 'Customer') }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Menu Links: Account Setting -->
                  <div class="py-1">
                    <NuxtLink
                      to="/account"
                      @click="userMenuOpen = false"
                      :class="[
                        'group flex items-center gap-3 px-4 py-2.5 text-sm font-semibold transition-all',
                        isActive('/account')
                          ? 'bg-clay/10 text-clay dark:text-[#D4A98A]'
                          : 'text-ink/80 dark:text-[#F0EDE6]/85 hover:bg-clay/10 hover:text-clay dark:hover:bg-white/10 dark:hover:text-[#D4A98A]'
                      ]"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="text-clay/75 group-hover:text-clay dark:text-[#D4A98A]/80 dark:group-hover:text-white transition">
                        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                      <span>Account Setting</span>
                    </NuxtLink>
                  </div>

                  <!-- Sign Out Button -->
                  <div class="pt-1 border-t border-mist/80 dark:border-white/10">
                    <button
                      type="button"
                      @click="logout"
                      class="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition text-left"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </transition>
            </div>
          </template>
        </div>
      </div>
    </header>

    <!-- ── Backdrop overlay (Only when open AND unpinned - NO blur) ── -->
    <transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="sidebarOpen && !sidebarPinned"
        class="fixed inset-0 z-40 bg-black/25 dark:bg-black/45 transition-opacity"
        @click="sidebarOpen = false"
        aria-hidden="true"
      />
    </transition>

    <!-- ── LEFT SIDEBAR DRAWER (Pinned Docked or Off-canvas Drawer) ── -->
    <aside
      :class="[
        'fixed left-0 top-0 bottom-0 z-40 flex flex-col bg-white dark:bg-canvas-dark border-r border-mist dark:border-white/10 transition-transform duration-300 ease-in-out',
        sidebarPinned
          ? 'w-72 shadow-xs'
          : 'w-[min(88vw,300px)] shadow-2xl',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      ]"
      aria-label="Sidebar navigation"
    >
      <div class="h-1.5 w-full bg-gradient-to-r from-teal-500 via-clay to-blue-600 shrink-0"></div>

      <!-- Sidebar Header with Pin and Close -->
      <div class="p-4 border-b border-mist/80 dark:border-white/10 flex items-center justify-between bg-mist/25 dark:bg-white/[0.03]">
        <BrandLogo size="sm" />
        <div class="flex items-center gap-1">
          <!-- Pin / Unpin button -->
          <button
            @click="toggleSidebarPin"
            :class="[
              'w-8 h-8 rounded-lg flex items-center justify-center transition text-sm',
              sidebarPinned
                ? 'bg-clay/15 text-clay dark:bg-white/15 dark:text-[#D4A98A] font-bold shadow-xs'
                : 'text-ink/60 dark:text-white/60 hover:text-clay hover:bg-clay/10 dark:hover:bg-white/10'
            ]"
            :title="sidebarPinned ? 'Unpin sidebar (floating drawer mode)' : 'Pin sidebar to page (docked mode)'"
            :aria-label="sidebarPinned ? 'Unpin sidebar' : 'Pin sidebar'"
          >
            <!-- Pin SVG icon -->
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="sidebarPinned ? '-rotate-45 text-clay dark:text-[#D4A98A]' : 'text-current'" class="transition-transform duration-200">
              <line x1="12" y1="17" x2="12" y2="22"/>
              <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z"/>
            </svg>
          </button>

          <!-- Close button -->
          <button
            @click="closeSidebar"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-ink/60 dark:text-white/60 hover:text-clay hover:bg-clay/10 dark:hover:bg-white/10 text-base transition"
            aria-label="Close sidebar"
            :title="sidebarPinned ? 'Close & unpin sidebar' : 'Close sidebar'"
          >
            ✕
          </button>
        </div>
      </div>

        <!-- User profile summary if logged in -->
        <div v-if="user" class="p-3.5 mx-3 my-2.5 rounded-2xl bg-white dark:bg-surface-dark border border-mist dark:border-white/10 shadow-xs">
          <div class="flex items-center gap-3">
            <img
              v-if="user.profile_photo"
              :src="resolveMediaUrl(user.profile_photo)"
              :alt="initials"
              class="w-11 h-11 rounded-full object-cover shrink-0 shadow-xs border border-clay/20"
            />
            <div v-else class="w-11 h-11 rounded-full bg-gradient-to-br from-clay to-clay-dark text-white flex items-center justify-center font-display font-bold text-sm shrink-0 shadow-xs">
              {{ initials }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-bold text-sm text-ink dark:text-[#F0EDE6] truncate">
                {{ user.first_name }} {{ user.last_name }}
              </p>
              <p class="text-xs text-ink/55 dark:text-white/60 truncate">{{ user.email }}</p>
              <span class="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider bg-clay/10 text-clay dark:text-[#D4A98A] border border-clay/20 px-2 py-0.5 rounded-full">
                {{ user.role?.name || 'Customer' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Sidebar Navigation Links -->
        <nav class="flex-1 overflow-y-auto p-3 space-y-1">
          <template v-if="user">
            <!-- 1. Dashboard -->
            <NuxtLink
              to="/dashboard"
              @click="onSidebarNavClick"
              :class="[
                'group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all',
                isActive('/dashboard')
                  ? 'bg-gradient-to-r from-clay to-clay-dark text-white shadow-xs'
                  : 'text-ink/80 dark:text-[#F0EDE6]/85 hover:bg-clay/10 hover:text-clay dark:hover:bg-white/10 dark:hover:text-[#D4A98A]'
              ]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" :class="isActive('/dashboard') ? 'text-white' : 'text-clay/75 group-hover:text-clay dark:text-[#D4A98A]/80 dark:group-hover:text-white transition'">
                <rect width="7" height="9" x="3" y="3" rx="1"/>
                <rect width="7" height="5" x="14" y="3" rx="1"/>
                <rect width="7" height="9" x="14" y="12" rx="1"/>
                <rect width="7" height="5" x="3" y="16" rx="1"/>
              </svg>
              <span>Dashboard</span>
            </NuxtLink>

            <!-- 2a. My Jobs — customers only (jobs they posted) -->
            <NuxtLink
              v-if="!isProvider"
              to="/my-jobs"
              @click="onSidebarNavClick"
              :class="[
                'group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all',
                isActive('/my-jobs')
                  ? 'bg-gradient-to-r from-clay to-clay-dark text-white shadow-xs'
                  : 'text-ink/80 dark:text-[#F0EDE6]/85 hover:bg-clay/10 hover:text-clay dark:hover:bg-white/10 dark:hover:text-[#D4A98A]'
              ]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" :class="isActive('/my-jobs') ? 'text-white' : 'text-clay/75 group-hover:text-clay dark:text-[#D4A98A]/80 dark:group-hover:text-white transition'">
                <rect width="20" height="14" x="2" y="7" rx="2" ry="2"/>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
              <span>My Jobs</span>
            </NuxtLink>

            <!-- If user is Provider: show Find Work as primary action -->
            <template v-if="isProvider">
              <NuxtLink
                to="/jobs"
                @click="onSidebarNavClick"
                :class="[
                  'group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all',
                  isActive('/jobs')
                    ? 'bg-gradient-to-r from-clay to-clay-dark text-white shadow-xs'
                    : 'text-ink/80 dark:text-[#F0EDE6]/85 hover:bg-clay/10 hover:text-clay dark:hover:bg-white/10 dark:hover:text-[#D4A98A]'
                ]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" :class="isActive('/jobs') ? 'text-white' : 'text-clay/75 group-hover:text-clay dark:text-[#D4A98A]/80 dark:group-hover:text-white transition'">
                  <rect width="20" height="14" x="2" y="7" rx="2" ry="2"/>
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
                <span>Find Work</span>
              </NuxtLink>
            </template>

            <!-- If user is Customer or Guest: show Find Workers as primary action -->
            <template v-else>
              <NuxtLink
                to="/browse"
                @click="onSidebarNavClick"
                :class="[
                  'group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all',
                  isActive('/browse')
                    ? 'bg-gradient-to-r from-clay to-clay-dark text-white shadow-xs'
                    : 'text-ink/80 dark:text-[#F0EDE6]/85 hover:bg-clay/10 hover:text-clay dark:hover:bg-white/10 dark:hover:text-[#D4A98A]'
                ]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" :class="isActive('/browse') ? 'text-white' : 'text-clay/75 group-hover:text-clay dark:text-[#D4A98A]/80 dark:group-hover:text-white transition'">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <span>Find Workers</span>
              </NuxtLink>

            </template>

            <!-- 3. My Bookings -->
            <NuxtLink
              to="/bookings"
              @click="onSidebarNavClick"
              :class="[
                'group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all',
                isActive('/bookings')
                  ? 'bg-gradient-to-r from-clay to-clay-dark text-white shadow-xs'
                  : 'text-ink/80 dark:text-[#F0EDE6]/85 hover:bg-clay/10 hover:text-clay dark:hover:bg-white/10 dark:hover:text-[#D4A98A]'
              ]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" :class="isActive('/bookings') ? 'text-white' : 'text-clay/75 group-hover:text-clay dark:text-[#D4A98A]/80 dark:group-hover:text-white transition'">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span>My Bookings</span>
            </NuxtLink>

            <!-- 4. Messages -->
            <NuxtLink
              to="/messages"
              @click="onSidebarNavClick"
              :class="[
                'group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all',
                isActive('/messages')
                  ? 'bg-gradient-to-r from-clay to-clay-dark text-white shadow-xs'
                  : 'text-ink/80 dark:text-[#F0EDE6]/85 hover:bg-clay/10 hover:text-clay dark:hover:bg-white/10 dark:hover:text-[#D4A98A]'
              ]"
            >
              <span class="flex items-center gap-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" :class="isActive('/messages') ? 'text-white' : 'text-clay/75 group-hover:text-clay dark:text-[#D4A98A]/80 dark:group-hover:text-white transition'">
                  <path d="M21 15a2 2 0 0 1-2 2H8l-4 3.5V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/>
                </svg>
                <span>Messages</span>
              </span>
              <span
                v-if="totalUnreadCount > 0"
                class="min-w-5 h-5 px-1.5 rounded-full text-[10px] font-extrabold flex items-center justify-center"
                :class="isActive('/messages') ? 'bg-white text-clay' : 'bg-clay text-white'"
              >
                {{ totalUnreadCount }}
              </span>
            </NuxtLink>

            <!-- 5. Notifications -->
            <NuxtLink
              to="/notifications"
              @click="onSidebarNavClick"
              :class="[
                'group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all',
                isActive('/notifications')
                  ? 'bg-gradient-to-r from-clay to-clay-dark text-white shadow-xs'
                  : 'text-ink/80 dark:text-[#F0EDE6]/85 hover:bg-clay/10 hover:text-clay dark:hover:bg-white/10 dark:hover:text-[#D4A98A]'
              ]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" :class="isActive('/notifications') ? 'text-white' : 'text-clay/75 group-hover:text-clay dark:text-[#D4A98A]/80 dark:group-hover:text-white transition'">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <span>Notifications</span>
            </NuxtLink>

            <!-- 6. Favorites — customers only (saved providers) -->
            <NuxtLink
              v-if="!isProvider"
              to="/favorites"
              @click="onSidebarNavClick"
              :class="[
                'group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all',
                isActive('/favorites')
                  ? 'bg-gradient-to-r from-clay to-clay-dark text-white shadow-xs'
                  : 'text-ink/80 dark:text-[#F0EDE6]/85 hover:bg-clay/10 hover:text-clay dark:hover:bg-white/10 dark:hover:text-[#D4A98A]'
              ]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" :class="isActive('/favorites') ? 'text-white' : 'text-clay/75 group-hover:text-clay dark:text-[#D4A98A]/80 dark:group-hover:text-white transition'">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
              </svg>
              <span>Favorites</span>
            </NuxtLink>

            <!-- 7. Transactions -->
            <NuxtLink
              to="/transactions"
              @click="onSidebarNavClick"
              :class="[
                'group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all',
                isActive('/transactions')
                  ? 'bg-gradient-to-r from-clay to-clay-dark text-white shadow-xs'
                  : 'text-ink/80 dark:text-[#F0EDE6]/85 hover:bg-clay/10 hover:text-clay dark:hover:bg-white/10 dark:hover:text-[#D4A98A]'
              ]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" :class="isActive('/transactions') ? 'text-white' : 'text-clay/75 group-hover:text-clay dark:text-[#D4A98A]/80 dark:group-hover:text-white transition'">
                <rect width="20" height="14" x="2" y="5" rx="2"/>
                <line x1="2" y1="10" x2="22" y2="10"/>
              </svg>
              <span>Transactions</span>
            </NuxtLink>

            <!-- 8. Report an Issue -->
            <NuxtLink
              to="/support"
              @click="onSidebarNavClick"
              class="group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-ink/80 dark:text-[#F0EDE6]/85 hover:bg-clay/10 hover:text-clay dark:hover:bg-white/10 dark:hover:text-[#D4A98A] transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="text-clay/75 group-hover:text-clay dark:text-[#D4A98A]/80 dark:group-hover:text-white transition">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                <line x1="4" y1="22" x2="4" y2="15"/>
              </svg>
              <span>Report an Issue</span>
            </NuxtLink>


            <!-- Provider specific links if role is provider -->
            <template v-if="isProvider">
              <div class="pt-3 pb-1 px-3.5 text-[10px] font-bold text-clay dark:text-[#D4A98A] uppercase tracking-wider flex items-center gap-2">
                <span>Provider Tools</span>
                <span class="h-px flex-1 bg-mist dark:bg-white/10"></span>
              </div>
              <NuxtLink
                to="/provider/services"
                @click="onSidebarNavClick"
                :class="[
                  'group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all',
                  isActive('/provider/services')
                    ? 'bg-gradient-to-r from-clay to-clay-dark text-white shadow-xs'
                    : 'text-ink/80 dark:text-[#F0EDE6]/85 hover:bg-clay/10 hover:text-clay dark:hover:bg-white/10 dark:hover:text-[#D4A98A]'
                ]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" :class="isActive('/provider/services') ? 'text-white' : 'text-clay/75 group-hover:text-clay dark:text-[#D4A98A]/80 dark:group-hover:text-white transition'">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                </svg>
                <span>My Services</span>
              </NuxtLink>
              <NuxtLink
                to="/provider/wallet"
                @click="onSidebarNavClick"
                :class="[
                  'group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all',
                  isActive('/provider/wallet')
                    ? 'bg-gradient-to-r from-clay to-clay-dark text-white shadow-xs'
                    : 'text-ink/80 dark:text-[#F0EDE6]/85 hover:bg-clay/10 hover:text-clay dark:hover:bg-white/10 dark:hover:text-[#D4A98A]'
                ]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" :class="isActive('/provider/wallet') ? 'text-white' : 'text-clay/75 group-hover:text-clay dark:text-[#D4A98A]/80 dark:group-hover:text-white transition'">
                  <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/>
                  <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>
                </svg>
                <span>My Wallet & Earnings</span>
              </NuxtLink>
            </template>

            <!-- Admin Consoles -->
            <template v-if="isAdmin || isAdminFinance || isAdminSupport">
              <div class="pt-3 pb-1 px-3.5 text-[10px] font-bold text-clay dark:text-[#D4A98A] uppercase tracking-wider flex items-center gap-2">
                <span>Admin Consoles</span>
                <span class="h-px flex-1 bg-mist dark:bg-white/10"></span>
              </div>
              <NuxtLink
                v-if="isAdmin || isAdminSupport"
                to="/admin/support"
                @click="onSidebarNavClick"
                :class="[
                  'group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all',
                  isActive('/admin/support')
                    ? 'bg-gradient-to-r from-clay to-clay-dark text-white shadow-xs'
                    : 'text-ink/80 dark:text-[#F0EDE6]/85 hover:bg-clay/10 hover:text-clay dark:hover:bg-white/10 dark:hover:text-[#D4A98A]'
                ]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" :class="isActive('/admin/support') ? 'text-white' : 'text-clay/75 group-hover:text-clay dark:text-[#D4A98A]/80 dark:group-hover:text-white transition'">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span>Support & Safety Ops</span>
              </NuxtLink>
              <NuxtLink
                v-if="isAdmin || isAdminSupport"
                to="/admin/providers"
                @click="onSidebarNavClick"
                :class="[
                  'group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all',
                  isActive('/admin/providers')
                    ? 'bg-gradient-to-r from-clay to-clay-dark text-white shadow-xs'
                    : 'text-ink/80 dark:text-[#F0EDE6]/85 hover:bg-clay/10 hover:text-clay dark:hover:bg-white/10 dark:hover:text-[#D4A98A]'
                ]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" :class="isActive('/admin/providers') ? 'text-white' : 'text-clay/75 group-hover:text-clay dark:text-[#D4A98A]/80 dark:group-hover:text-white transition'">
                  <path d="m9 12 2 2 4-4"/><path d="M12 3a12 12 0 0 0 8.5 3A12 12 0 0 1 12 21 12 12 0 0 1 3.5 6 12 12 0 0 0 12 3z"/>
                </svg>
                <span>Provider Verification</span>
              </NuxtLink>
              <NuxtLink
                v-if="isAdmin || isAdminFinance"
                to="/admin/finance"
                @click="onSidebarNavClick"
                :class="[
                  'group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all',
                  isActive('/admin/finance')
                    ? 'bg-gradient-to-r from-clay to-clay-dark text-white shadow-xs'
                    : 'text-ink/80 dark:text-[#F0EDE6]/85 hover:bg-clay/10 hover:text-clay dark:hover:bg-white/10 dark:hover:text-[#D4A98A]'
                ]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" :class="isActive('/admin/finance') ? 'text-white' : 'text-clay/75 group-hover:text-clay dark:text-[#D4A98A]/80 dark:group-hover:text-white transition'">
                  <line x1="12" y1="20" x2="12" y2="10"/>
                  <line x1="18" y1="20" x2="18" y2="4"/>
                  <line x1="6" y1="20" x2="6" y2="16"/>
                </svg>
                <span>Finance & Escrow</span>
              </NuxtLink>
            </template>
          </template>

          <!-- Guest links if not logged in -->
          <template v-else>
            <NuxtLink to="/" @click="onSidebarNavClick" class="group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-ink/80 dark:text-[#F0EDE6]/85 hover:bg-clay/10 hover:text-clay dark:hover:bg-white/10 dark:hover:text-[#D4A98A] transition-all">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="text-clay/75 group-hover:text-clay dark:text-[#D4A98A]/80 dark:group-hover:text-white transition">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              <span>Home</span>
            </NuxtLink>
            <NuxtLink to="/browse" @click="onSidebarNavClick" class="group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-ink/80 dark:text-[#F0EDE6]/85 hover:bg-clay/10 hover:text-clay dark:hover:bg-white/10 dark:hover:text-[#D4A98A] transition-all">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="text-clay/75 group-hover:text-clay dark:text-[#D4A98A]/80 dark:group-hover:text-white transition">
                <circle cx="12" cy="12" r="10"/>
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
              </svg>
              <span>Browse Services</span>
            </NuxtLink>
            <NuxtLink to="/jobs" @click="onSidebarNavClick" class="group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-ink/80 dark:text-[#F0EDE6]/85 hover:bg-clay/10 hover:text-clay dark:hover:bg-white/10 dark:hover:text-[#D4A98A] transition-all">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="text-clay/75 group-hover:text-clay dark:text-[#D4A98A]/80 dark:group-hover:text-white transition">
                <rect width="20" height="14" x="2" y="7" rx="2" ry="2"/>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
              <span>Find Open Jobs</span>
            </NuxtLink>
            <NuxtLink to="/#how-it-works" @click="onSidebarNavClick" class="group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-ink/80 dark:text-[#F0EDE6]/85 hover:bg-clay/10 hover:text-clay dark:hover:bg-white/10 dark:hover:text-[#D4A98A] transition-all">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="text-clay/75 group-hover:text-clay dark:text-[#D4A98A]/80 dark:group-hover:text-white transition">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span>How It Works</span>
            </NuxtLink>
            <NuxtLink to="/support" @click="onSidebarNavClick" class="group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-ink/80 dark:text-[#F0EDE6]/85 hover:bg-clay/10 hover:text-clay dark:hover:bg-white/10 dark:hover:text-[#D4A98A] transition-all">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="text-clay/75 group-hover:text-clay dark:text-[#D4A98A]/80 dark:group-hover:text-white transition">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="4"/>
                <line x1="4.93" y1="4.93" x2="9.17" y2="9.17"/>
                <line x1="14.83" y1="14.83" x2="19.07" y2="19.07"/>
                <line x1="14.83" y1="9.17" x2="19.07" y2="4.93"/>
                <line x1="4.93" y1="19.07" x2="9.17" y2="14.83"/>
              </svg>
              <span>Support</span>
            </NuxtLink>
            <div class="pt-4 space-y-2">
              <NuxtLink to="/login" @click="onSidebarNavClick" class="block text-center py-2.5 rounded-xl border border-mist dark:border-white/15 text-sm font-bold text-ink dark:text-white hover:bg-clay/10 hover:text-clay transition-all">
                Sign In
              </NuxtLink>
              <NuxtLink to="/register" @click="onSidebarNavClick" class="block text-center py-2.5 rounded-xl bg-gradient-to-r from-clay to-clay-dark hover:from-clay-dark hover:to-clay text-white text-sm font-bold shadow-md transition-all active:scale-98">
                Get Started
              </NuxtLink>
            </div>
          </template>
        </nav>


      </aside>

    <!-- ── Page content ── -->
    <main class="flex-1">
      <slot />
    </main>

    <!-- ── Footer ── -->
    <footer class="mt-auto bg-[#0F172A] text-slate-300">
      <div class="max-w-[1230px] mx-auto px-6 pt-12 pb-7">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.45fr_.8fr_.8fr_.9fr] gap-10 pb-10">
          <div>
            <BrandLogo light />
            <p class="max-w-xs mt-4 text-sm leading-6 text-slate-400">A trusted place to find skilled professionals, hire with confidence, and build a stronger career.</p>
            <div class="mt-5 flex flex-wrap gap-2">
              <span class="footer-trust">Verified providers</span>
              <span class="footer-trust">Secure escrow</span>
            </div>
          </div>
          <div>
            <h2 class="footer-title">For customers</h2>
            <nav class="footer-links">
              <NuxtLink to="/browse">Browse services</NuxtLink>
              <NuxtLink to="/providers">Find professionals</NuxtLink>
              <NuxtLink to="/jobs/post">Post a job</NuxtLink>
            </nav>
          </div>
          <div>
            <h2 class="footer-title">For providers</h2>
            <nav class="footer-links">
              <NuxtLink to="/jobs">Find work</NuxtLink>
              <NuxtLink to="/register">Join SkillLink</NuxtLink>
              <NuxtLink to="/pricing">Pricing</NuxtLink>
            </nav>
          </div>
          <div>
            <h2 class="footer-title">SkillLink</h2>
            <nav class="footer-links">
              <NuxtLink to="/about">About us</NuxtLink>
              <NuxtLink to="/support">Help & support</NuxtLink>
              <NuxtLink to="/account">Account settings</NuxtLink>
            </nav>
          </div>
        </div>
        <div class="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {{ new Date().getFullYear() }} SkillLink. Built for Ethiopia.</p>
          <p>Helping skilled people and trusted clients work better together.</p>
        </div>
      </div>
    </footer>

    <!-- ── Global AI Assistant widget (floating, bottom-right) ── -->
    <AiAssistant />
  </div>
</template>

<style scoped>
.footer-title { color: #F8FAFC; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.footer-links { display: grid; gap: 11px; margin-top: 16px; }
.footer-links a { color: #94A3B8; font-size: 14px; transition: color .2s ease; }
.footer-links a:hover { color: #5EEAD4; }
.footer-trust { border: 1px solid rgba(94, 234, 212, .18); border-radius: 999px; padding: 5px 9px; color: #99F6E4; font-size: 11px; font-weight: 600; }
</style>
