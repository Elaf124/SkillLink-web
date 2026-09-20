<script setup>
definePageMeta({ layout: 'default' })

const goBack = useGoBack('/dashboard')
const { apiFetch, token } = useApi()

const faqs = [
  { q: 'How does escrow payment work?', a: 'Once a booking is marked complete by the provider, you confirm the completed work and pay through the booking page. Payments are held in escrow and released upon your confirmation.' },
  { q: 'How do I cancel a booking or job?', a: 'Open the booking from your dashboard and use the cancel option there. You will be prompted for a brief reason before cancellation is finalized.' },
  { q: 'How do I become a provider?', a: 'Create an account, choose the provider role, and list your first service from your dashboard. Your profile becomes visible to customers right away.' },
  { q: 'How are providers verified?', a: 'Providers undergo verification checks and skill validation before receiving high-trust badges on SkillLink.' },
  { q: 'What if I need to report an issue or dispute?', a: 'You can reach out directly to our dedicated support team using the form below or via support@skilllink.et.' },
]

const openIndex = ref(0)
function toggle(i) {
  openIndex.value = openIndex.value === i ? -1 : i
}

const contactForm = ref({ name: '', email: '', subject: '', message: '' })
const submitted = ref(false)
const submitting = ref(false)
const submitError = ref('')

onMounted(async () => {
  if (!token.value) return
  try {
    const me = await apiFetch('/user')
    contactForm.value.name = `${me.first_name ?? ''} ${me.last_name ?? ''}`.trim()
    contactForm.value.email = me.email ?? ''
  } catch { /* not logged in / offline — the form still shows the sign-in notice */ }
})

async function submitContact() {
  submitError.value = ''
  if (!contactForm.value.subject.trim() || !contactForm.value.message.trim()) return

  if (!token.value) {
    submitError.value = 'Please sign in to send a message to support.'
    return
  }

  submitting.value = true
  try {
    // Name/email are shown for context but the ticket is always attributed to
    // the signed-in account server-side, so they aren't sent here.
    await apiFetch('/support/technical-inquiries', {
      method: 'POST',
      body: {
        subject: contactForm.value.subject.trim(),
        message: contactForm.value.message.trim(),
      },
    })
    submitted.value = true
  } catch (err) {
    submitError.value = err?.data?.message || 'Failed to send your message. Please try again.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="max-w-3xl mx-auto px-6 py-8 sm:py-12">
    <!-- Back arrow -->
    <div class="mb-4">
      <button @click="goBack" class="inline-flex items-center gap-1.5 text-xs font-semibold text-clay hover:underline">
        <span>←</span> Back
      </button>
    </div>

    <!-- Header -->
    <div class="mb-8">
      <p class="text-xs font-bold text-clay uppercase tracking-wider mb-1">Help & Resource Center</p>
      <h1 class="font-display text-3xl sm:text-4xl font-extrabold text-ink dark:text-[#F0EDE6] mb-2">
        How can we help?
      </h1>
      <p class="text-sm text-ink/60 dark:text-white/60">
        Browse common answers or get in touch with our customer service team.
      </p>
    </div>

    <!-- FAQ Accordion -->
    <div class="rounded-2xl border border-mist dark:border-white/10 divide-y divide-mist dark:divide-white/10 bg-white dark:bg-mist-dark overflow-hidden mb-10 shadow-xs">
      <div v-for="(faq, i) in faqs" :key="faq.q">
        <button
          @click="toggle(i)"
          class="w-full flex items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-ink dark:text-[#F0EDE6] hover:bg-mist/40 dark:hover:bg-white/5 transition"
        >
          {{ faq.q }}
          <span class="text-ink/40 dark:text-white/40 text-lg transition-transform shrink-0" :class="openIndex === i ? 'rotate-45' : ''">+</span>
        </button>
        <p v-if="openIndex === i" class="px-5 pb-4 text-xs sm:text-sm text-ink/70 dark:text-white/70 leading-relaxed">
          {{ faq.a }}
        </p>
      </div>
    </div>

    <!-- Contact Support Box -->
    <div class="bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-2xl p-6 sm:p-7 shadow-xs">
      <div v-if="submitted" class="text-center py-6">
        <div class="text-3xl mb-2">✅</div>
        <h3 class="font-display font-bold text-lg text-ink dark:text-[#F0EDE6] mb-1">Message Received</h3>
        <p class="text-xs text-ink/60 dark:text-white/60">Our Ethiopian support team will get back to you shortly.</p>
      </div>

      <div v-else>
        <h3 class="font-display font-bold text-lg text-ink dark:text-[#F0EDE6] mb-1">Contact Support & Report Issues</h3>
        <p class="text-xs text-ink/60 dark:text-white/60 mb-5">Have an inquiry or issue with an order? Send our support team a direct message.</p>

        <p v-if="!token" class="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-medium text-amber-800 dark:text-amber-300">
          Please <NuxtLink to="/login" class="underline font-bold">sign in</NuxtLink> to send a message — this lets our support team follow up with you and track your ticket.
        </p>

        <form @submit.prevent="submitContact" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-ink dark:text-white uppercase mb-1">Your Name</label>
              <input v-model="contactForm.name" type="text" required placeholder="Abebe Kebede" class="w-full rounded-xl border border-mist dark:border-white/15 bg-mist/20 dark:bg-canvas-dark px-4 py-2.5 text-xs text-ink dark:text-white outline-none focus:ring-2 focus:ring-clay/40" />
            </div>
            <div>
              <label class="block text-xs font-bold text-ink dark:text-white uppercase mb-1">Email Address</label>
              <input v-model="contactForm.email" type="email" required placeholder="abebe@example.com" class="w-full rounded-xl border border-mist dark:border-white/15 bg-mist/20 dark:bg-canvas-dark px-4 py-2.5 text-xs text-ink dark:text-white outline-none focus:ring-2 focus:ring-clay/40" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-ink dark:text-white uppercase mb-1">Subject</label>
            <input v-model="contactForm.subject" type="text" required placeholder="e.g. Dashboard not loading my bookings" class="w-full rounded-xl border border-mist dark:border-white/15 bg-mist/20 dark:bg-canvas-dark px-4 py-2.5 text-xs text-ink dark:text-white outline-none focus:ring-2 focus:ring-clay/40" />
          </div>
          <div>
            <label class="block text-xs font-bold text-ink dark:text-white uppercase mb-1">Message</label>
            <textarea v-model="contactForm.message" required rows="4" placeholder="Describe what you need help with..." class="w-full rounded-xl border border-mist dark:border-white/15 bg-mist/20 dark:bg-canvas-dark px-4 py-2.5 text-xs text-ink dark:text-white outline-none focus:ring-2 focus:ring-clay/40 resize-none"></textarea>
          </div>
          <p v-if="submitError" class="text-clay text-xs bg-clay/5 border border-clay/20 rounded-xl px-4 py-2.5">
            {{ submitError }}
          </p>
          <button type="submit" :disabled="submitting" class="w-full py-3 rounded-xl bg-clay hover:bg-clay/90 disabled:opacity-50 text-white font-bold text-xs shadow-md transition">
            {{ submitting ? 'Sending…' : 'Send Message to Support' }}
          </button>
        </form>
      </div>
    </div>
  </section>
</template>
