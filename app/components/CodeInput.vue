<script setup>
// Segmented one-time-code input (default 6 digits) with auto-advance, backspace
// navigation, and paste support. v-model is the joined string; `complete` fires
// once every box is filled.
const props = defineProps({
  modelValue: { type: String, default: '' },
  length: { type: Number, default: 6 },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'complete'])

const boxes = ref(Array.from({ length: props.length }, () => ''))
const els = ref([])

watch(() => props.modelValue, (val) => {
  const chars = (val || '').split('')
  for (let i = 0; i < props.length; i++) boxes.value[i] = chars[i] || ''
})

function emitValue() {
  const v = boxes.value.join('')
  emit('update:modelValue', v)
  if (v.length === props.length) emit('complete', v)
}

function onInput(i, e) {
  const raw = e.target.value.replace(/\D/g, '')
  if (!raw) { boxes.value[i] = ''; emitValue(); return }
  boxes.value[i] = raw[raw.length - 1]
  if (i < props.length - 1) els.value[i + 1]?.focus()
  emitValue()
}

function onKeydown(i, e) {
  if (e.key === 'Backspace' && !boxes.value[i] && i > 0) {
    boxes.value[i - 1] = ''
    els.value[i - 1]?.focus()
    emitValue()
  }
}

function onPaste(e) {
  const t = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, props.length)
  if (!t) return
  e.preventDefault()
  for (let i = 0; i < props.length; i++) boxes.value[i] = t[i] || ''
  els.value[Math.min(t.length, props.length - 1)]?.focus()
  emitValue()
}

defineExpose({
  focus: () => els.value[0]?.focus(),
  clear: () => { boxes.value = boxes.value.map(() => ''); emitValue() },
})
</script>

<template>
  <div class="flex gap-2 sm:gap-2.5">
    <input
      v-for="(b, i) in boxes" :key="i"
      :ref="el => (els[i] = el)"
      :value="boxes[i]"
      :disabled="disabled"
      type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="1"
      @input="onInput(i, $event)"
      @keydown="onKeydown(i, $event)"
      @paste="onPaste"
      class="w-11 h-14 sm:w-12 sm:h-16 text-center text-xl font-bold rounded-xl border border-mist dark:border-white/15 bg-mist/20 dark:bg-canvas-dark text-ink dark:text-[#F0EDE6] outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition disabled:opacity-50"
    />
  </div>
</template>
