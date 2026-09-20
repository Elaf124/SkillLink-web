<script setup>
definePageMeta({ layout: 'default' })
</script>

<template>
  <section class="max-w-2xl mx-auto px-6 py-14 sm:py-16">
    <p class="text-sm font-medium text-clay uppercase tracking-wide mb-1">Pricing</p>
    <h1 class="font-display text-3xl sm:text-4xl font-semibold text-ink dark:text-[#F0EDE6] mb-6">
      Simple, pay-as-you-go
    </h1>

    <div class="space-y-4 mb-10">
      <div class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6">
        <p class="font-semibold text-ink dark:text-[#F0EDE6] mb-1">Browsing &amp; posting — free</p>
        <p class="text-sm text-ink/60 dark:text-white/60">Creating an account, browsing providers, and posting a job are always free for customers and providers.</p>
      </div>
      <div class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6">
        <p class="font-semibold text-ink dark:text-[#F0EDE6] mb-1">You only pay for completed work</p>
        <p class="text-sm text-ink/60 dark:text-white/60">Payment happens per booking, once the work is done and you've confirmed it — there's no subscription or monthly fee today.</p>
      </div>
    </div>

    <p class="text-sm text-ink/50 dark:text-white/50">
      Detailed fee breakdowns for providers are still being finalized. In the meantime, questions? Visit
      <NuxtLink to="/support" class="text-clay font-medium hover:underline">Support</NuxtLink>.
    </p>
  </section>
</template>
