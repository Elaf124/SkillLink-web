<script setup lang="ts">
withDefaults(defineProps<{ compact?: boolean; size?: 'sm' | 'md'; light?: boolean }>(), {
  compact: false,
  size: 'md',
  light: false,
})
</script>

<template>
  <span
    class="brand-logo inline-flex items-center text-ink dark:text-[#F8FAFC] transition-colors"
    :class="[`brand-logo--${size}`, { 'brand-logo--compact': compact, 'brand-logo--light': light }]"
    aria-label="SkillLink"
  >
    <span
      class="brand-logo__mark inline-flex items-center justify-center shrink-0 text-[#CCFBF1] transition-all"
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M13.1 19.9 10.7 22.3a5 5 0 0 1-7.1-7.1l5-5a5 5 0 0 1 7.1 0" stroke="currentColor" stroke-width="2.75" stroke-linecap="round"/>
        <path d="m18.9 12.1 2.4-2.4a5 5 0 0 1 7.1 7.1l-5 5a5 5 0 0 1-7.1 0" stroke="currentColor" stroke-width="2.75" stroke-linecap="round"/>
        <path d="m11.5 20.5 9-9" stroke="white" stroke-width="2.75" stroke-linecap="round"/>
      </svg>
    </span>
    <span v-if="!compact" class="brand-logo__wordmark font-display text-ink dark:text-[#F8FAFC]">
      Skill<span class="text-[#0F766E] dark:text-[#2DD4BF]">Link</span>
    </span>
  </span>
</template>

<style scoped>
.brand-logo {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  color: var(--color-ink, #0F172A);
}
.brand-logo__mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  color: #CCFBF1;
  background: linear-gradient(135deg, #0F766E, #134E4A);
  box-shadow: 0 4px 10px rgba(15, 118, 110, .22);
}
.brand-logo__mark svg {
  width: 20px;
  height: 20px;
}
.brand-logo__wordmark {
  font-family: var(--font-display, inherit);
  font-size: 18px;
  font-weight: 750;
  letter-spacing: -.04em;
  color: inherit;
}
.brand-logo__wordmark span {
  color: #0F766E;
  transition: color 0.2s ease;
}

/* Light variant (e.g. dark footers or dark banners) */
.brand-logo--light {
  color: #F8FAFC !important;
}
.brand-logo--light .brand-logo__wordmark {
  color: #F8FAFC !important;
}
.brand-logo--light .brand-logo__wordmark span {
  color: #2DD4BF !important;
}

.brand-logo--md .brand-logo__mark {
  width: 34px;
  height: 34px;
}
.brand-logo--sm {
  gap: 7px;
}
.brand-logo--sm .brand-logo__mark {
  width: 26px;
  height: 26px;
  border-radius: 7px;
}
.brand-logo--sm .brand-logo__mark svg {
  width: 16px;
  height: 16px;
}
.brand-logo--sm .brand-logo__wordmark {
  font-size: 14px;
}

/* Dark mode overrides */
:global(html.dark) .brand-logo,
:global(.dark) .brand-logo {
  color: #F8FAFC !important;
}
:global(html.dark) .brand-logo .brand-logo__wordmark,
:global(.dark) .brand-logo .brand-logo__wordmark {
  color: #F8FAFC !important;
}
:global(html.dark) .brand-logo .brand-logo__wordmark span,
:global(.dark) .brand-logo .brand-logo__wordmark span {
  color: #2DD4BF !important;
}
:global(html.dark) .brand-logo .brand-logo__mark,
:global(.dark) .brand-logo .brand-logo__mark {
  background: linear-gradient(135deg, #0D9488, #115E59) !important;
  box-shadow: 0 0 14px rgba(45, 212, 191, 0.28) !important;
  border: 1px solid rgba(255, 255, 255, 0.16) !important;
}
</style>
