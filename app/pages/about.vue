<script setup>
definePageMeta({ layout: 'default' })

const values = [
  { icon: '✅', title: 'Verified, not anonymous', body: 'Every provider on SkillLink is identity-checked before they can list a service, so you know who is showing up.' },
  { icon: '🤝', title: 'Fair on both sides', body: 'Customers get transparent pricing and reviews. Providers get to set their own rates and keep control of their schedule.' },
  { icon: '🇪🇹', title: 'Built for Ethiopia', body: 'From electricians in Bahir Dar to tutors in Addis Ababa, SkillLink is designed around how work actually gets found and done here.' },
]
</script>

<template>
  <div>
    <!-- Intro -->
    <section class="bg-ink dark:bg-canvas-dark py-20 px-6">
      <div class="max-w-3xl mx-auto text-center">
        <p class="text-sm font-medium text-gold-light uppercase tracking-wide mb-3">About SkillLink</p>
        <h1 class="font-display text-4xl sm:text-5xl font-semibold text-white leading-tight mb-5">
          Connecting Ethiopia's skills with the people who need them
        </h1>
        <p class="text-white/70 text-lg max-w-xl mx-auto">
          SkillLink is a marketplace where verified electricians, tutors, cleaners, mechanics, designers, and hundreds of other service providers meet customers who need real work done — on their timeline, at their price.
        </p>
      </div>
    </section>

    <!-- Story -->
    <section class="max-w-3xl mx-auto px-6 py-20">
      <h2 class="font-display text-2xl sm:text-3xl font-semibold text-ink dark:text-[#F0EDE6] mb-5">
        Why we built this
      </h2>
      <p class="text-ink/70 dark:text-white/70 mb-4 leading-relaxed">
        Finding a trustworthy electrician or a decent tutor usually means asking around and hoping for the best. On the other side, skilled people struggle to find steady, fairly-paid work outside their immediate network. SkillLink exists to close that gap: a single place to browse verified providers, compare offers, and get things done — or to turn your skills into a real source of income.
      </p>
      <p class="text-ink/70 dark:text-white/70 leading-relaxed">
        Whether you're hiring for a one-off job or building a client base as a provider, SkillLink gives you the tools to do it with confidence: verified profiles, transparent pricing, reviews, and a booking flow that keeps both sides accountable.
      </p>
    </section>

    <!-- Values -->
    <section class="bg-white dark:bg-mist-dark/40 border-y border-mist dark:border-white/10 py-20 px-6">
      <div class="max-w-5xl mx-auto">
        <h2 class="font-display text-2xl sm:text-3xl font-semibold text-ink dark:text-[#F0EDE6] text-center mb-12">
          What we care about
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div v-for="v in values" :key="v.title">
            <p class="text-3xl mb-3">{{ v.icon }}</p>
            <h3 class="font-display text-lg font-semibold text-ink dark:text-[#F0EDE6] mb-2">{{ v.title }}</h3>
            <p class="text-ink/60 dark:text-white/60 text-sm leading-relaxed">{{ v.body }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="py-20 text-center px-6">
      <h2 class="font-display text-3xl sm:text-4xl font-semibold text-ink dark:text-[#F0EDE6] mb-4">
        Ready to get started?
      </h2>
      <p class="text-ink/60 dark:text-white/60 mb-8">Join SkillLink today — it's free to browse and post.</p>
      <div class="flex flex-wrap justify-center gap-3">
        <NuxtLink
          to="/browse"
          class="inline-block bg-clay hover:bg-clay/90 text-white font-semibold px-8 py-3.5 rounded-full transition"
        >
          Browse services
        </NuxtLink>
        <NuxtLink
          to="/register"
          class="inline-block border border-clay text-clay hover:bg-clay/10 font-semibold px-8 py-3.5 rounded-full transition"
        >
          Become a provider
        </NuxtLink>
      </div>
    </section>
  </div>
</template>
