<script setup>
import { categories } from '~/data/categories'

definePageMeta({ layout: 'default' })

const router = useRouter()
const searchQuery = ref('')
const showAllCategories = ref(false)
const heroMode = ref('hire') // 'hire' | 'work'

function handleSearch() {
  const query = searchQuery.value.trim()
  if (heroMode.value === 'work') {
    router.push(query ? `/jobs?q=${encodeURIComponent(query)}` : '/jobs')
  } else {
    router.push(query ? `/browse?q=${encodeURIComponent(query)}` : '/browse')
  }
}

const topCategories = categories.slice(0, 10)
const moreCategories = categories.slice(10)
const heroQuickCategories = [
  { name: 'Electrical Work', icon: '⚡' },
  { name: 'Web Development', icon: '💻' },
  { name: 'Plumbing', icon: '🔧' },
  { name: 'UI/UX Design', icon: '🎨' },
  { name: 'Tutor & Lessons', icon: '📚' }
]

// Featured Ethiopian Freelancers for the interactive slideshow
const activeProSlide = ref(0)
const isPaused = ref(false)

const featuredFreelancers = [
  {
    id: 1,
    name: 'Dawit Bekele',
    profession: 'Web Developer',
    roleTag: 'Full-Stack Web & Mobile Engineer',
    title: 'Senior Full-Stack & Python Developer',
    rating: '5.0',
    reviews: 38,
    badge: 'Top Rated Pro',
    price: '1,200 ETB/hr',
    image: '/images/providers/developer.jpg',
    city: 'Addis Ababa, Ethiopia',
    experience: '6+ Years Experience',
    bio: 'Crafting high-performance web applications, custom API backends, and responsive frontend interfaces with Vue.js, Nuxt, Node.js, and Python.',
    skills: ['Vue.js', 'Nuxt 4', 'Python', 'FastAPI', 'TailwindCSS', 'PostgreSQL'],
    completedJobs: 46
  },
  {
    id: 2,
    name: 'Selamawit Tadesse',
    profession: 'UI/UX Designer',
    roleTag: 'Product & Interface Designer',
    title: 'Senior UI/UX & Product Designer',
    rating: '5.0',
    reviews: 52,
    badge: 'Top Rated Pro',
    price: '2,000 ETB',
    image: '/images/providers/designer.jpg',
    city: 'Bole, Addis Ababa',
    experience: '5+ Years Experience',
    bio: 'Designing user-friendly mobile applications, high-converting web landing pages, wireframes, interactive prototypes, and scalable Figma design systems.',
    skills: ['Figma', 'UI/UX Design', 'User Research', 'Interactive Prototypes', 'Design Systems', 'Brand Identity'],
    completedJobs: 63
  }
]

let slideTimer = null

function nextProSlide() {
  activeProSlide.value = (activeProSlide.value + 1) % featuredFreelancers.length
}

function prevProSlide() {
  activeProSlide.value = (activeProSlide.value - 1 + featuredFreelancers.length) % featuredFreelancers.length
}

function startSlideTimer() {
  stopSlideTimer
  slideTimer = setInterval(() => {
    if (!isPaused.value) {
      nextProSlide
    }
  }, 5000)
}

function stopSlideTimer() {
  if (slideTimer) {
    clearInterval(slideTimer)
    slideTimer = null
  }
}

onMounted(() => {
  startSlideTimer
})

onUnmounted(() => {
  stopSlideTimer
})
</script>

<template>
  <div class="overflow-hidden">
    <!-- ── Hero Section ── -->
    <section class="relative bg-slate-950 text-white pt-16 pb-24 overflow-hidden border-b border-slate-800">
      <!-- Background Video -->
      <video
        autoplay muted loop playsinline
        class="absolute inset-0 w-full h-full object-cover opacity-60 z-0 pointer-events-none"
      >
        <source src="/videos/hero.mp4" type="video/mp4" />
      </video>

      <!-- Clean Translucent Overlay for Contrast -->
      <div class="absolute inset-0 bg-slate-950/50 z-0"></div>
      <div class="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(225,92,39,0.25),transparent)] z-0"></div>

      <div class="max-w-6xl mx-auto px-6 relative z-10 text-center">
        <!-- Dual Mode Pill Toggle -->
        <div class="inline-flex items-center p-1 rounded-full bg-slate-900/90 border border-slate-700/80 backdrop-blur-md mb-8 shadow-xl">
          <button
            @click="heroMode = 'hire'"
            :class="[
              'px-6 py-2 rounded-full text-xs sm:text-sm font-bold transition-all duration-300 cursor-pointer',
              heroMode === 'hire'
                ? 'bg-clay text-white shadow-md shadow-clay/30'
                : 'text-slate-300 hover:text-white'
            ]"
          >
            🔍 I want to hire talent
          </button>
          <button
            @click="heroMode = 'work'"
            :class="[
              'px-6 py-2 rounded-full text-xs sm:text-sm font-bold transition-all duration-300 cursor-pointer',
              heroMode === 'work'
                ? 'bg-clay text-white shadow-md shadow-clay/30'
                : 'text-slate-300 hover:text-white'
            ]"
          >
            💼 I want to work & earn
          </button>
        </div>

        <Transition
          mode="out-in"
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="opacity-0 translate-y-3"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-3"
        >
          <!-- Client Mode Hero -->
          <div v-if="heroMode === 'hire'" key="hire" class="max-w-3xl mx-auto">
            <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-clay/20 border border-clay/40 text-clay-light text-xs font-bold uppercase tracking-wider mb-5 backdrop-blur-md shadow-md">
              <span>🛡️</span> Verified Ethiopian Freelance & Service Network
            </div>
            <h1 class="font-display text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-[1.15] mb-6 drop-shadow-lg">
              Hire top verified talent for <span class="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 via-teal-500 to-blue-500">any job or service</span>
            </h1>
            <p class="text-slate-100 text-base sm:text-lg mb-10 max-w-2xl mx-auto leading-relaxed font-normal drop-shadow-md">
              Browse thousands of certified electricians, developers, designers, tutors, and technicians across Ethiopia — with 100% escrow protection.
            </p>

            <!-- Search Bar -->
            <div class="max-w-2xl mx-auto bg-slate-900/95 border border-slate-700 rounded-2xl p-2 shadow-2xl backdrop-blur-xl flex flex-col sm:flex-row items-center gap-2">
              <div class="flex-1 flex items-center gap-3 w-full pl-4 pr-2 py-2">
                <span class="text-slate-400 text-lg">🔍</span>
                <input
                  v-model="searchQuery"
                  @keyup.enter="handleSearch"
                  type="text"
                  placeholder="Try 'electrician in Addis', 'logo design', 'plumber'..."
                  class="bg-transparent flex-1 text-white placeholder:text-slate-400 outline-none text-sm sm:text-base font-medium"
                />
              </div>
              <button
                @click="handleSearch"
                class="w-full sm:w-auto bg-clay hover:bg-clay-dark text-white font-bold px-8 py-3.5 rounded-xl transition shadow-lg shadow-clay/30 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                Search Talent
              </button>
            </div>

            <!-- Popular Quick Pills -->
            <div class="flex flex-wrap items-center justify-center gap-2 mt-6 text-xs text-white">
              <span class="font-bold text-clay-light drop-shadow-sm">Popular:</span>
              <button
                v-for="cat in heroQuickCategories"
                :key="cat.name"
                @click="router.push(`/browse?q=${encodeURIComponent(cat.name)}`)"
                class="px-3.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-white/20 text-white hover:text-clay-light font-medium transition flex items-center gap-1.5 shadow-sm backdrop-blur-md cursor-pointer"
              >
                <span>{{ cat.icon }}</span> {{ cat.name }}
              </button>
            </div>

            <div class="mt-8 text-xs text-slate-200 flex items-center justify-center gap-2 drop-shadow-sm">
              <span class="font-medium">Need custom requirements?</span>
              <NuxtLink to="/jobs/post" class="text-clay-light hover:text-white font-bold underline underline-offset-4">
                Post an open job and get offers →
              </NuxtLink>
            </div>
          </div>

          <!-- Provider Mode Hero -->
          <div v-else key="work" class="max-w-3xl mx-auto">
            <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-clay/20 border border-clay/40 text-clay-light text-xs font-bold uppercase tracking-wider mb-5 backdrop-blur-md shadow-md">
              <span>💰</span> Keep 90% of Your Earnings · Instant Payouts
            </div>
            <h1 class="font-display text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-[1.15] mb-6 drop-shadow-lg">
              Grow your career on Ethiopia's <span class="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 via-teal-500 to-blue-500">#1 skill marketplace</span>
            </h1>
            <p class="text-slate-100 text-base sm:text-lg mb-10 max-w-2xl mx-auto leading-relaxed font-normal drop-shadow-md">
              Set your own prices, showcase your portfolio, negotiate custom offers, and withdraw earnings directly via Telebirr or CBE.
            </p>

            <div class="flex flex-wrap items-center justify-center gap-4">
              <NuxtLink
                to="/register"
                class="bg-clay hover:bg-clay-dark text-white font-bold px-8 py-4 rounded-xl transition shadow-xl shadow-clay/30 flex items-center gap-2 text-base"
              >
                Create Provider Profile →
              </NuxtLink>
              <NuxtLink
                to="/jobs"
                class="bg-slate-900/90 hover:bg-slate-800 border border-white/20 text-white font-bold px-8 py-4 rounded-xl transition flex items-center gap-2 text-base backdrop-blur-md"
              >
                Browse Open Jobs (Bids)
              </NuxtLink>
            </div>

            <!-- Quick stats row -->
            <div class="grid grid-cols-3 gap-4 max-w-lg mx-auto mt-12 pt-8 border-t border-white/20 text-center">
              <div class="bg-slate-950/60 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-lg">
                <p class="text-2xl sm:text-3xl font-extrabold text-white font-display">10%</p>
                <p class="text-xs text-slate-300 font-medium">Fair Take-Rate</p>
              </div>
              <div class="bg-slate-950/60 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-lg">
                <p class="text-2xl sm:text-3xl font-extrabold text-clay font-display">24/7</p>
                <p class="text-xs text-slate-300 font-medium">AI Match Assistant</p>
              </div>
              <div class="bg-slate-950/60 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-lg">
                <p class="text-2xl sm:text-3xl font-extrabold text-white font-display">100%</p>
                <p class="text-xs text-slate-300 font-medium">Escrow Protected</p>
              </div>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Trust Bar -->
      <div class="max-w-6xl mx-auto px-6 mt-16 pt-8 border-t border-white/15 text-center relative z-10">
        <p class="text-xs uppercase font-extrabold tracking-widest text-clay-light mb-6 drop-shadow-sm">
          Why Clients & Service Providers Trust SkillLink
        </p>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-white text-xs sm:text-sm font-bold">
          <div class="flex items-center justify-center gap-2 bg-slate-950/70 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10 shadow-md">
            <span class="w-2 h-2 rounded-full bg-clay animate-pulse"></span>
            <span>🛡️ Admin-Verified ID Badges</span>
          </div>
          <div class="flex items-center justify-center gap-2 bg-slate-950/70 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10 shadow-md">
            <span class="w-2 h-2 rounded-full bg-clay animate-pulse"></span>
            <span>💳 Safe Payment After Service</span>
          </div>
          <div class="flex items-center justify-center gap-2 bg-slate-950/70 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10 shadow-md">
            <span class="w-2 h-2 rounded-full bg-clay animate-pulse"></span>
            <span>💬 Live Chat & Price Quotes</span>
          </div>
          <div class="flex items-center justify-center gap-2 bg-slate-950/70 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10 shadow-md">
            <span class="w-2 h-2 rounded-full bg-clay animate-pulse"></span>
            <span>🤖 AI Smart Recommendation</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Category Showcase Grid ── -->
    <section class="max-w-7xl mx-auto px-6 py-20">
      <div class="flex flex-col md:flex-row md:items-end justify-between mb-12">
        <div>
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-clay/10 text-clay text-xs font-bold uppercase tracking-wider mb-3">
            <span>✨</span> Explore Marketplace
          </div>
          <h2 class="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
            Popular Professional Categories
          </h2>
          <p class="text-slate-500 dark:text-slate-400 mt-2 text-sm sm:text-base">
            From emergency repairs to digital design, find certified specialists in 20+ fields.
          </p>
        </div>
        <NuxtLink
          to="/browse"
          class="mt-4 md:mt-0 inline-flex items-center gap-1 text-sm font-bold text-clay hover:underline"
        >
          View all 20 categories →
        </NuxtLink>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
        <NuxtLink
          v-for="cat in (showAllCategories ? categories : topCategories)"
          :key="cat.name"
          :to="`/browse?category=${encodeURIComponent(cat.name)}`"
          class="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-clay/50 dark:hover:border-clay/50 rounded-2xl p-6 transition-all duration-300 card-hover-lift flex flex-col justify-between"
        >
          <div>
            <div class="w-14 h-14 rounded-2xl bg-clay/10 dark:bg-clay/15 flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">
              {{ cat.icon }}
            </div>
            <h3 class="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white group-hover:text-clay transition mb-1">
              {{ cat.name }}
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
              {{ cat.skills?.[0]?.description || 'Certified specialists and ready-to-book services' }}
            </p>
          </div>
          <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-400 group-hover:text-clay transition font-medium">
            <span>Explore services</span>
            <span>→</span>
          </div>
        </NuxtLink>
      </div>

      <div class="text-center mt-10">
        <button
          @click="showAllCategories = !showAllCategories"
          class="px-6 py-2.5 rounded-full border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:border-clay hover:text-clay transition"
        >
          {{ showAllCategories ? 'Show fewer categories ↑' : 'Show all 20 categories ↓' }}
        </button>
      </div>
    </section>

    <!-- ── Featured Verified Pros Showcase (Interactive Slideshow) ── -->
    <section
      class="bg-slate-50 dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-800 py-20 relative overflow-hidden"
      @mouseenter="isPaused = true"
      @mouseleave="isPaused = false"
    >
      <div class="max-w-7xl mx-auto px-6">
        <!-- Section Header & Controls -->
        <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-clay/10 text-clay text-xs font-bold uppercase tracking-wider mb-3">
              <span>⭐</span> Verified Ethiopian Talent
            </div>
            <h2 class="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
              Featured Top-Rated Specialists
            </h2>
            <p class="text-slate-500 dark:text-slate-400 mt-2 text-sm sm:text-base">
              Verified Ethiopian freelance professionals ready for direct booking and custom projects.
            </p>
          </div>

          <!-- Carousel Controls (Previous / Next) -->
          <div class="flex items-center gap-3 shrink-0">
            <div class="text-xs font-bold text-slate-400 dark:text-slate-500 mr-2">
              <span class="text-clay font-extrabold">0{{ activeProSlide + 1 }}</span> / 0{{ featuredFreelancers.length }}
            </div>
            <button
              @click="prevProSlide"
              class="w-11 h-11 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white hover:border-clay hover:text-clay transition flex items-center justify-center font-bold text-lg shadow-sm cursor-pointer"
              aria-label="Previous specialist"
            >
              ‹
            </button>
            <button
              @click="nextProSlide"
              class="w-11 h-11 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white hover:border-clay hover:text-clay transition flex items-center justify-center font-bold text-lg shadow-sm cursor-pointer"
              aria-label="Next specialist"
            >
              ›
            </button>
          </div>
        </div>

        <!-- Slideshow Container -->
        <div class="relative">
          <Transition
            mode="out-in"
            enter-active-class="transition duration-400 ease-out"
            enter-from-class="opacity-0 translate-x-6"
            enter-to-class="opacity-100 translate-x-0"
            leave-active-class="transition duration-300 ease-in"
            leave-from-class="opacity-100 translate-x-0"
            leave-to-class="opacity-0 -translate-x-6"
          >
            <div
              :key="featuredFreelancers[activeProSlide].id"
              class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-lg grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
            >
              <!-- Left Column: Big Portrait Card with Bottom Label -->
              <div class="lg:col-span-5 relative">
                <div class="relative w-full aspect-square sm:aspect-[4/4] rounded-2xl overflow-hidden shadow-xl border-2 border-slate-100 dark:border-slate-800 group">
                  <img
                    :src="featuredFreelancers[activeProSlide].image"
                    :alt="featuredFreelancers[activeProSlide].name"
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <!-- Top-Left Verified ID Badge -->
                  <div class="absolute top-4 left-4 bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-full border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center gap-1.5 shadow-md">
                    <span>✓</span> ID Verified Pro
                  </div>

                  <!-- Top-Right Level Badge -->
                  <div class="absolute top-4 right-4">
                    <span class="badge-pro text-xs px-3 py-1 rounded-full font-bold shadow-md">
                      {{ featuredFreelancers[activeProSlide].badge }}
                    </span>
                  </div>

                  <!-- Bottom Photo Overlay with Profession Label -->
                  <div class="absolute bottom-4 left-4 right-4 bg-slate-950/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-3.5 flex items-center justify-between text-white shadow-xl">
                    <div>
                      <p class="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Expert Discipline</p>
                      <p class="font-display font-extrabold text-base sm:text-lg text-white">
                        {{ featuredFreelancers[activeProSlide].profession }}
                      </p>
                    </div>
                    <div class="text-right">
                      <p class="text-[10px] text-slate-400 font-semibold">Overall Rating</p>
                      <span class="text-amber-400 font-extrabold text-sm flex items-center gap-1 justify-end">
                        ★ {{ featuredFreelancers[activeProSlide].rating }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Right Column: Profile Overview, Bio & Direct Actions -->
              <div class="lg:col-span-7 flex flex-col justify-between space-y-6">
                <div>
                  <div class="flex flex-wrap items-center gap-2 mb-2">
                    <h3 class="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white">
                      {{ featuredFreelancers[activeProSlide].name }}
                    </h3>
                    <span class="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                      📍 {{ featuredFreelancers[activeProSlide].city }}
                    </span>
                    <span class="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold">
                      {{ featuredFreelancers[activeProSlide].experience }}
                    </span>
                  </div>

                  <p class="text-emerald-600 dark:text-emerald-400 font-bold text-sm sm:text-base mb-4">
                    {{ featuredFreelancers[activeProSlide].title }}
                  </p>

                  <p class="text-slate-600 dark:text-slate-300 text-sm sm:text-base leading-relaxed mb-6">
                    "{{ featuredFreelancers[activeProSlide].bio }}"
                  </p>

                  <!-- Skills Pills -->
                  <div class="mb-6">
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Core Skills & Tooling</p>
                    <div class="flex flex-wrap gap-2">
                      <span
                        v-for="s in featuredFreelancers[activeProSlide].skills"
                        :key="s"
                        class="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 px-3 py-1 rounded-lg font-semibold flex items-center gap-1"
                      >
                        <span>✓</span> {{ s }}
                      </span>
                    </div>
                  </div>

                  <!-- Trust & Activity Metrics -->
                  <div class="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 mb-6 text-center">
                    <div>
                      <p class="font-display font-extrabold text-lg text-slate-900 dark:text-white">
                        {{ featuredFreelancers[activeProSlide].completedJobs }}
                      </p>
                      <p class="text-xs text-slate-400">Jobs Completed</p>
                    </div>
                    <div>
                      <p class="font-display font-extrabold text-lg text-amber-500">
                        ★ 5.0
                      </p>
                      <p class="text-xs text-slate-400">({{ featuredFreelancers[activeProSlide].reviews }} Reviews)</p>
                    </div>
                    <div>
                      <p class="font-display font-extrabold text-lg text-emerald-600 dark:text-emerald-400">
                        100%
                      </p>
                      <p class="text-xs text-slate-400">Job Success</p>
                    </div>
                  </div>
                </div>

                <!-- Footer Call to Action -->
                <div class="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                  <div>
                    <span class="text-xs text-slate-400 font-semibold block">Starting Rate</span>
                    <span class="font-display font-extrabold text-2xl text-slate-900 dark:text-white">
                      {{ featuredFreelancers[activeProSlide].price }}
                    </span>
                  </div>

                  <div class="flex items-center gap-3">
                    <NuxtLink
                      :to="`/messages?recipient=${featuredFreelancers[activeProSlide].id}&name=${encodeURIComponent(featuredFreelancers[activeProSlide].name)}&role=provider&context_type=service&context_title=${encodeURIComponent(featuredFreelancers[activeProSlide].profession)}&context_amount=${featuredFreelancers[activeProSlide].price}`"
                      class="px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 hover:border-clay hover:text-clay font-bold text-xs sm:text-sm transition flex items-center justify-center gap-1.5"
                    >
                      <span>💬</span> Chat & Negotiate
                    </NuxtLink>
                    <NuxtLink
                      to="/browse"
                      class="px-6 py-3 rounded-xl bg-clay hover:bg-clay-dark text-white font-extrabold text-xs sm:text-sm transition shadow-md shadow-clay/25 flex items-center justify-center gap-1.5"
                    >
                      <span>⚡</span> Hire Specialist
                    </NuxtLink>
                  </div>
                </div>
              </div>
            </div>
          </Transition>

          <!-- Interactive Pagination Dots -->
          <div class="flex justify-center gap-2 mt-8">
            <button
              v-for="(_, idx) in featuredFreelancers"
              :key="idx"
              @click="activeProSlide = idx"
              :class="[
                'h-2.5 rounded-full transition-all duration-300 cursor-pointer',
                activeProSlide === idx
                  ? 'w-10 bg-clay'
                  : 'w-2.5 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
              ]"
              :aria-label="`Go to slide ${idx + 1}`"
            ></button>
          </div>
        </div>
      </div>
    </section>

    <!-- ── How It Works ── -->
    <section id="how-it-works" class="max-w-7xl mx-auto px-6 py-24 scroll-mt-20">
      <div class="text-center max-w-2xl mx-auto mb-16">
        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-clay/10 text-clay text-xs font-bold uppercase tracking-wider mb-3">
          <span>⚙️</span> Seamless Experience
        </div>
        <h2 class="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          Two Flexible Ways to Work
        </h2>
        <p class="text-slate-500 dark:text-slate-400 mt-2 text-sm sm:text-base">
          Whether you want an instant service package or custom bids for a complex project, SkillLink gives you full control.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <!-- Model 1: Direct Gig Booking -->
        <div class="bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-10 shadow-sm relative overflow-hidden">
          <div class="w-12 h-12 rounded-2xl bg-clay text-white flex items-center justify-center text-xl font-bold font-display mb-6">
            1
          </div>
          <span class="text-xs font-bold uppercase tracking-wider text-clay">The Catalog Model</span>
          <h3 class="font-display text-2xl font-bold text-slate-900 dark:text-white mt-1 mb-4">
            Book a Pre-Priced Service Package
          </h3>
          <p class="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-6">
            Search verified provider profiles, compare transparent pricing packages (Basic / Standard / Premium), and book immediately.
          </p>
          <ul class="space-y-3 text-sm text-slate-700 dark:text-slate-300 mb-8">
            <li class="flex items-center gap-3">
              <span class="text-clay font-bold">✓</span> Direct chat and pre-booking inquiries
            </li>
            <li class="flex items-center gap-3">
              <span class="text-clay font-bold">✓</span> Fixed pricing with clear turnaround deliverables
            </li>
            <li class="flex items-center gap-3">
              <span class="text-clay font-bold">✓</span> Payment held safely in escrow until you approve the result
            </li>
          </ul>
          <NuxtLink
            to="/browse"
            class="inline-flex items-center gap-2 text-sm font-bold text-clay hover:underline"
          >
            Explore service catalog →
          </NuxtLink>
        </div>

        <!-- Model 2: Custom Job Bidding -->
        <div class="bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-10 shadow-sm relative overflow-hidden">
          <div class="w-12 h-12 rounded-2xl bg-clay text-white flex items-center justify-center text-xl font-bold font-display mb-6">
            2
          </div>
          <span class="text-xs font-bold uppercase tracking-wider text-clay">Post a Job &amp; Get Bids</span>
          <h3 class="font-display text-2xl font-bold text-slate-900 dark:text-white mt-1 mb-4">
            Post an Open Job & Compare Proposals
          </h3>
          <p class="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-6">
            Describe your custom job, set your budget and timeline, and receive tailored proposals from top professionals.
          </p>
          <ul class="space-y-3 text-sm text-slate-700 dark:text-slate-300 mb-8">
            <li class="flex items-center gap-3">
              <span class="text-clay font-bold">✓</span> Multiple competitive bids sent directly to your inbox
            </li>
            <li class="flex items-center gap-3">
              <span class="text-clay font-bold">✓</span> In-app live chat negotiation on rates and scope
            </li>
            <li class="flex items-center gap-3">
              <span class="text-clay font-bold">✓</span> Accept the best proposal and track progress step by step
            </li>
          </ul>
          <NuxtLink
            to="/jobs/post"
            class="inline-flex items-center gap-2 text-sm font-bold text-clay hover:underline"
          >
            Post a custom job now →
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- ── High-Converting Dual CTA Banner ── -->
    <section class="bg-slate-950 border-t border-slate-800 py-20 text-white relative overflow-hidden">
      <div class="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_120%,rgba(225,92,39,0.15),transparent)]"></div>

      <div class="max-w-5xl mx-auto px-6 relative z-10 text-center">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-clay/10 border border-clay/20 text-clay-light text-xs font-bold uppercase tracking-wider mb-6">
          <span>🚀</span> Ready to Get Started?
        </div>
        <h2 class="font-display text-3xl sm:text-5xl font-extrabold mb-6 max-w-3xl mx-auto leading-tight">
          Join Ethiopia's most trusted freelance & skill network today
        </h2>
        <p class="text-slate-400 text-base sm:text-lg mb-10 max-w-xl mx-auto">
          Free to sign up, free to post jobs, and transparent 10% platform commission with zero hidden fees.
        </p>
        <div class="flex flex-wrap items-center justify-center gap-4">
          <NuxtLink
            to="/register"
            class="bg-clay hover:bg-clay-dark text-white font-bold px-8 py-4 rounded-xl transition shadow-xl shadow-clay/25 text-base"
          >
            Create Your Account Free
          </NuxtLink>
          <NuxtLink
            to="/browse"
            class="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold px-8 py-4 rounded-xl transition text-base"
          >
            Browse Services
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>
