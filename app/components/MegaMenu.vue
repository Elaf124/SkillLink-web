<script setup>
const props = defineProps({
  categories: { type: Array, required: true },
  mode: { type: String, default: 'provider' }, // 'provider' | 'customer'
})
const emit = defineEmits(['close'])

const active = ref(0)
const activeCategory = computed(() => props.categories[active.value] || props.categories[0])
const menuRef = ref(null)

const isCustomerMode = computed(() => props.mode === 'customer')

function onKeydown(e) {
  if (e.key === 'Escape') emit('close')
}

function onClickOutside(e) {
  if (menuRef.value && !menuRef.value.contains(e.target)) {
    emit('close')
  }
}

onMounted(() => {
  if (import.meta.client) {
    document.addEventListener('keydown', onKeydown)
    setTimeout(() => {
      document.addEventListener('click', onClickOutside)
    }, 50)
  }
})

onBeforeUnmount(() => {
  if (import.meta.client) {
    document.removeEventListener('keydown', onKeydown)
    document.removeEventListener('click', onClickOutside)
  }
})
</script>

<template>
  <div
    ref="menuRef"
    class="absolute left-0 top-full mt-2.5 w-[min(94vw,740px)] max-h-[82vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150"
    @click.stop
  >
    <!-- Top accent color strip -->
    <div class="h-1 w-full bg-gradient-to-r from-clay via-emerald-500 to-teal-600"></div>

    <!-- Header bar with Title + Close button -->
    <div class="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/50">
      <div class="flex items-center gap-2">
        <span class="text-base">{{ isCustomerMode ? '👥' : '💼' }}</span>
        <span class="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
          {{ isCustomerMode ? 'Find Workers & Services' : 'Find Work & Job Bids' }}
        </span>
      </div>
      <div class="flex items-center gap-3">
        <NuxtLink
          :to="isCustomerMode ? '/browse' : '/jobs'"
          @click="emit('close')"
          class="text-xs font-bold text-clay hover:underline flex items-center gap-1"
        >
          {{ isCustomerMode ? 'Browse All Workers →' : 'View All Open Jobs →' }}
        </NuxtLink>
        <button
          @click="emit('close')"
          class="w-6 h-6 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-xs transition"
          title="Close menu"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- Quick Action Cards -->
    <div class="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
      <!-- Card 1 -->
      <NuxtLink
        :to="isCustomerMode ? '/browse' : '/jobs'"
        @click="emit('close')"
        class="group p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-clay/60 dark:hover:border-clay/60 hover:bg-clay/5 dark:hover:bg-slate-800/60 transition flex items-start gap-3"
      >
        <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg shrink-0 group-hover:scale-105 transition-transform">
          {{ isCustomerMode ? '🔍' : '📋' }}
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h4 class="text-sm font-bold text-slate-900 dark:text-white group-hover:text-clay transition">
              {{ isCustomerMode ? 'Find & Hire Workers' : 'Browse Open Jobs' }}
            </h4>
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              {{ isCustomerMode ? 'Verified' : 'Live Bids' }}
            </span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {{ isCustomerMode ? 'Browse verified Ethiopian talent, read reviews, and hire directly.' : 'Explore open requirements from clients and submit competitive bids.' }}
          </p>
        </div>
      </NuxtLink>

      <!-- Card 2 -->
      <NuxtLink
        to="/jobs/post"
        @click="emit('close')"
        class="group p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-clay/60 dark:hover:border-clay/60 hover:bg-clay/5 dark:hover:bg-slate-800/60 transition flex items-start gap-3"
      >
        <div class="w-10 h-10 rounded-xl bg-clay/10 text-clay flex items-center justify-center text-lg shrink-0 group-hover:scale-105 transition-transform">
          ✍️
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h4 class="text-sm font-bold text-slate-900 dark:text-white group-hover:text-clay transition">Post a Custom Job</h4>
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">Fast Bids</span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Describe your project and let top providers submit custom quotes.
          </p>
        </div>
      </NuxtLink>
    </div>

    <!-- Category Explorer -->
    <div class="grid grid-cols-[200px_1fr] flex-1 min-h-0 overflow-hidden">
      <!-- Left column: Categories -->
      <div class="border-r border-slate-100 dark:border-slate-800 py-2 bg-slate-50/50 dark:bg-slate-950/30 overflow-y-auto max-h-[290px]">
        <p class="px-4 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          {{ isCustomerMode ? 'Worker Categories' : 'Job Categories' }}
        </p>
        <button
          v-for="(cat, i) in categories"
          :key="cat.name"
          @mouseenter="active = i"
          @click="active = i"
          :class="[
            'w-full flex items-center justify-between gap-2 px-4 py-2 text-xs text-left font-medium transition',
            active === i
              ? 'bg-clay/10 text-clay dark:text-[#D4A98A] font-bold border-r-2 border-clay'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          ]"
        >
          <span class="flex items-center gap-2 truncate">
            <span>{{ cat.icon || '📁' }}</span>
            <span class="truncate">{{ cat.name }}</span>
          </span>
          <span class="text-[10px] text-slate-400">›</span>
        </button>
      </div>

      <!-- Right column: Subcategories & Direct links -->
      <div class="p-4 bg-white dark:bg-slate-900 overflow-y-auto max-h-[290px]">
        <div class="flex items-center justify-between mb-3 pb-1.5 border-b border-slate-100 dark:border-slate-800">
          <span class="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <span>{{ activeCategory?.icon }}</span>
            <span>{{ activeCategory?.name }}</span>
          </span>
          <NuxtLink
            :to="isCustomerMode ? `/browse?category=${encodeURIComponent(activeCategory?.name)}` : `/jobs?category=${encodeURIComponent(activeCategory?.name)}`"
            @click="emit('close')"
            class="text-[11px] font-bold text-clay hover:underline flex items-center gap-0.5"
          >
            All {{ activeCategory?.name }} {{ isCustomerMode ? 'Workers' : 'Jobs' }} →
          </NuxtLink>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <NuxtLink
            v-for="skill in (activeCategory?.skills || [])"
            :key="skill.name"
            :to="isCustomerMode ? `/browse?category=${encodeURIComponent(activeCategory?.name)}&q=${encodeURIComponent(skill.name)}` : `/jobs?category=${encodeURIComponent(activeCategory?.name)}&q=${encodeURIComponent(skill.name)}`"
            @click="emit('close')"
            class="group p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition block"
          >
            <p class="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-clay transition truncate">
              {{ skill.name }}
            </p>
            <p class="text-[11px] text-slate-400 line-clamp-1">
              {{ skill.description }}
            </p>
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Footer Bar -->
    <div class="px-5 py-2.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
      <div class="flex items-center gap-4">
        <NuxtLink to="/browse" @click="emit('close')" class="hover:text-clay font-medium transition">
          Browse All Categories
        </NuxtLink>
        <NuxtLink to="/#how-it-works" @click="emit('close')" class="hover:text-clay font-medium transition">How It Works</NuxtLink>
        <NuxtLink to="/support" @click="emit('close')" class="hover:text-clay font-medium transition">Support</NuxtLink>
      </div>
      <NuxtLink :to="isCustomerMode ? '/jobs/post' : '/jobs'" @click="emit('close')" class="text-clay font-bold hover:underline">
        {{ isCustomerMode ? 'Post a Job →' : 'Go to Jobs Board →' }}
      </NuxtLink>
    </div>
  </div>
</template>
