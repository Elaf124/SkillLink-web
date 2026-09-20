<script setup>
definePageMeta({
  layout: 'default',
  middleware: ['auth', 'provider-only']
})

const { apiFetch } = useApi()

const services = ref([])
const categories = ref([])
const loading = ref(true)
const actionLoading = ref(false)
const error = ref('')

// Modal state
const modalOpen = ref(false)
const modalType = ref('add') // 'add' or 'edit'
const selectedServiceId = ref(null)

const form = ref({
  title: '',
  description: '',
  category_id: '',
  price: '',
  price_type: 'fixed',
  duration: '',
  service_status: 'active'
})

// Delete confirmation modal state
const deleteModalOpen = ref(false)
const serviceToDelete = ref(null)

async function fetchProviderProfile() {
  try {
    const res = await apiFetch('/provider/profile')
    services.value = res.data.services || []
    portfolio.value = res.data.portfolio || []
  } catch (err) {
    error.value = 'Failed to load services. Please refresh.'
  }
}

// ── Portfolio / visual past work ──────────────────────────────────────────
const portfolio = ref([])
const portfolioModalOpen = ref(false)
const portfolioSaving = ref(false)
const portfolioError = ref('')
const portfolioForm = ref({ title: '', description: '', file: null, preview: '' })
const portfolioDeletingId = ref(null)

function openPortfolioModal() {
  portfolioForm.value = { title: '', description: '', file: null, preview: '' }
  portfolioError.value = ''
  portfolioModalOpen.value = true
}

function selectPortfolioImage(event) {
  const file = event.target.files?.[0]
  if (!file) return
  if (file.size > 5 * 1024 * 1024) {
    portfolioError.value = 'Image must be 5 MB or smaller.'
    return
  }
  portfolioForm.value.file = file
  portfolioForm.value.preview = URL.createObjectURL(file)
  portfolioError.value = ''
}

async function handleSavePortfolio() {
  portfolioError.value = ''
  if (!portfolioForm.value.title.trim() || !portfolioForm.value.file) {
    portfolioError.value = 'Add a title and choose an image.'
    return
  }
  portfolioSaving.value = true
  try {
    const payload = new FormData()
    payload.append('title', portfolioForm.value.title.trim())
    if (portfolioForm.value.description.trim()) payload.append('description', portfolioForm.value.description.trim())
    payload.append('image', portfolioForm.value.file)
    await apiFetch('/provider/profile/portfolio', { method: 'POST', body: payload })
    portfolioModalOpen.value = false
    await fetchProviderProfile()
  } catch (err) {
    const errors = err?.data?.errors
    portfolioError.value = errors
      ? Object.values(errors).flat().join(' ')
      : err?.data?.message || 'Failed to upload. Please try again.'
  } finally {
    portfolioSaving.value = false
  }
}

async function deletePortfolioItem(item) {
  if (!confirm(`Remove "${item.title}" from your portfolio?`)) return
  portfolioDeletingId.value = item.id
  try {
    await apiFetch(`/provider/profile/portfolio/${item.id}`, { method: 'DELETE' })
    portfolio.value = portfolio.value.filter(p => p.id !== item.id)
  } catch (err) {
    alert(err?.data?.message || 'Failed to remove this item.')
  } finally {
    portfolioDeletingId.value = null
  }
}

async function fetchCategories() {
  try {
    const res = await apiFetch('/categories')
    categories.value = res.data || []
  } catch (err) {
    console.error(err)
  }
}

onMounted(async () => {
  loading.value = true
  await Promise.all([fetchProviderProfile(), fetchCategories()])
  loading.value = false
})

function openAddModal() {
  modalType.value = 'add'
  selectedServiceId.value = null
  form.value = {
    title: '',
    description: '',
    category_id: '',
    price: '',
    price_type: 'fixed',
    duration: '',
    service_status: 'active'
  }
  error.value = ''
  modalOpen.value = true
}

function openEditModal(service) {
  modalType.value = 'edit'
  selectedServiceId.value = service.id
  form.value = {
    title: service.title,
    description: service.description,
    category_id: service.category_id,
    price: service.price,
    price_type: service.price_type,
    duration: service.duration || '',
    service_status: service.service_status || 'active'
  }
  error.value = ''
  modalOpen.value = true
}

async function handleSaveService() {
  error.value = ''
  actionLoading.value = true

  // Validate form
  if (!form.value.title.trim() || !form.value.description.trim() || !form.value.category_id || !form.value.price) {
    error.value = 'Please fill in all required fields.'
    actionLoading.value = false
    return
  }

  try {
    const payload = {
      title: form.value.title,
      description: form.value.description,
      category_id: Number(form.value.category_id),
      price: Number(form.value.price),
      price_type: form.value.price_type,
      duration: form.value.duration ? Number(form.value.duration) : null
    }

    if (modalType.value === 'edit') {
      payload.service_status = form.value.service_status
      await apiFetch(`/services/${selectedServiceId.value}`, {
        method: 'PUT',
        body: payload
      })
    } else {
      await apiFetch('/services', {
        method: 'POST',
        body: payload
      })
    }

    modalOpen.value = false
    await fetchProviderProfile()
  } catch (err) {
    const errors = err?.data?.errors
    error.value = errors
      ? Object.values(errors).flat().join(' ')
      : err?.data?.message || 'Failed to save service. Please try again.'
  } finally {
    actionLoading.value = false
  }
}

function confirmDelete(service) {
  serviceToDelete.value = service
  deleteModalOpen.value = true
}

async function handleDeleteService() {
  if (!serviceToDelete.value) return
  actionLoading.value = true
  try {
    await apiFetch(`/services/${serviceToDelete.value.id}`, { method: 'DELETE' })
    deleteModalOpen.value = false
    serviceToDelete.value = null
    await fetchProviderProfile()
  } catch (err) {
    alert(err?.data?.message || 'Failed to delete service. Please try again.')
  } finally {
    actionLoading.value = false
  }
}

function priceLabel(service) {
  return service.price_type === 'hourly'
    ? `${Number(service.price).toLocaleString()} ETB/hr`
    : `${Number(service.price).toLocaleString()} ETB`
}

function categoryName(catId) {
  const cat = categories.value.find(c => c.id === catId)
  return cat ? cat.name : 'Unknown'
}
</script>

<template>
  <div class="max-w-6xl mx-auto px-6 py-12">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        <p class="text-sm font-medium text-clay uppercase tracking-wide mb-1">Provider Settings</p>
        <h1 class="font-display text-4xl font-semibold text-ink dark:text-[#F0EDE6] mb-2">
          Manage Your Services
        </h1>
        <p class="text-ink/60 dark:text-white/60">
          List the services you offer, set your prices, and keep them up to date.
        </p>
      </div>
      <button
        @click="openAddModal"
        class="shrink-0 inline-flex items-center gap-2 bg-clay hover:bg-clay/90 text-white font-semibold px-5 py-2.5 rounded-full transition shadow-sm hover:scale-102"
      >
        + Add New Service
      </button>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div v-for="i in 3" :key="i" class="h-56 rounded-xl bg-mist/50 dark:bg-mist-dark/50 animate-pulse"></div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!services.length" class="border border-dashed border-mist dark:border-white/15 rounded-xl p-16 text-center">
      <div class="w-16 h-16 mx-auto rounded-full bg-clay/10 flex items-center justify-center text-clay text-2xl mb-4">🔧</div>
      <p class="font-display text-xl text-ink dark:text-[#F0EDE6] mb-2">You haven't listed any services yet</p>
      <p class="text-ink/50 dark:text-white/50 mb-6 max-w-sm mx-auto">Add your skills and services so customers can hire you directly.</p>
      <button
        @click="openAddModal"
        class="inline-flex items-center gap-2 bg-clay hover:bg-clay/90 text-white font-semibold px-5 py-2.5 rounded-full transition"
      >
        Create your first service
      </button>
    </div>

    <!-- Services Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="service in services" :key="service.id"
        class="group bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-xl overflow-hidden shadow-sm hover:border-clay/40 transition flex flex-col justify-between"
      >
        <div class="p-6">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs bg-mist/60 dark:bg-white/5 text-ink/65 dark:text-white/60 px-2.5 py-1 rounded-full">
              {{ categoryName(service.category_id) }}
            </span>
            <span
              :class="[
                'text-xs font-semibold px-2 py-0.5 rounded-full',
                service.service_status === 'active'
                  ? 'bg-green-600/10 text-green-700 dark:text-green-400 border border-green-600/20'
                  : 'bg-ink/10 text-ink/60 dark:bg-white/10 dark:text-white/60 border border-ink/10'
              ]"
            >
              {{ service.service_status === 'active' ? 'Active' : 'Inactive' }}
            </span>
          </div>

          <h3 class="font-display text-xl font-semibold text-ink dark:text-[#F0EDE6] mb-2 group-hover:text-clay transition leading-snug">
            {{ service.title }}
          </h3>
          <p class="text-sm text-ink/60 dark:text-white/60 line-clamp-3 mb-4">
            {{ service.description }}
          </p>
        </div>

        <div class="px-6 py-4 bg-canvas/30 dark:bg-[#1C2026] border-t border-mist dark:border-white/5 flex items-center justify-between">
          <div>
            <p class="text-[10px] text-ink/40 dark:text-white/40 uppercase tracking-wider font-semibold">Rate</p>
            <p class="font-display font-semibold text-clay text-lg leading-tight">{{ priceLabel(service) }}</p>
            <p v-if="service.duration" class="text-[11px] text-ink/40 dark:text-white/40 mt-0.5">
              Est. time: {{ service.duration }} mins
            </p>
          </div>
          <div class="flex items-center gap-1.5">
            <button
              @click="openEditModal(service)"
              class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-mist/50 dark:hover:bg-white/5 border border-transparent hover:border-mist dark:hover:border-white/10 text-ink/60 dark:text-white/60 transition"
              title="Edit service"
            >
              ✏️
            </button>
            <button
              @click="confirmDelete(service)"
              class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-clay/10 text-clay border border-transparent hover:border-clay/20 transition"
              title="Delete service"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Portfolio / Visual Past Work ── -->
    <div v-if="!loading" class="mt-14 pt-10 border-t border-mist dark:border-white/10">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <p class="text-sm font-medium text-clay uppercase tracking-wide mb-1">Show your work</p>
          <h2 class="font-display text-2xl font-semibold text-ink dark:text-[#F0EDE6]">Portfolio & Past Work</h2>
          <p class="text-sm text-ink/60 dark:text-white/60 mt-1">
            Upload photos of completed jobs. These appear on your public profile for customers to see.
          </p>
        </div>
        <button
          @click="openPortfolioModal"
          class="shrink-0 inline-flex items-center gap-2 border border-clay text-clay hover:bg-clay/10 font-semibold px-5 py-2.5 rounded-full transition"
        >
          + Add work sample
        </button>
      </div>

      <div v-if="!portfolio.length" class="border border-dashed border-mist dark:border-white/15 rounded-xl p-12 text-center">
        <div class="w-14 h-14 mx-auto rounded-full bg-clay/10 flex items-center justify-center text-clay text-2xl mb-3">🖼️</div>
        <p class="font-display text-lg text-ink dark:text-[#F0EDE6] mb-1">No portfolio items yet</p>
        <p class="text-sm text-ink/50 dark:text-white/50">Add photos of past work to win more customer trust.</p>
      </div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div
          v-for="item in portfolio" :key="item.id"
          class="group bg-white dark:bg-mist-dark border border-mist dark:border-white/10 rounded-xl overflow-hidden shadow-sm"
        >
          <div class="relative">
            <img v-if="item.image_url" :src="item.image_url" :alt="item.title" class="w-full h-44 object-cover" />
            <button
              @click="deletePortfolioItem(item)"
              :disabled="portfolioDeletingId === item.id"
              class="absolute top-2 right-2 w-8 h-8 rounded-lg bg-black/50 hover:bg-clay text-white flex items-center justify-center text-sm backdrop-blur-sm transition disabled:opacity-50"
              title="Remove"
            >
              🗑️
            </button>
          </div>
          <div class="p-4">
            <h3 class="font-display font-semibold text-sm text-ink dark:text-[#F0EDE6] mb-1">{{ item.title }}</h3>
            <p v-if="item.description" class="text-xs text-ink/55 dark:text-white/55 line-clamp-2">{{ item.description }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Portfolio Upload Modal ── -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div v-if="portfolioModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="fixed inset-0 bg-ink/50 dark:bg-black/70 backdrop-blur-md" @click="portfolioModalOpen = false"></div>
        <div class="relative w-full max-w-lg bg-white dark:bg-mist-dark border border-mist dark:border-white/15 rounded-2xl shadow-2xl overflow-hidden z-10">
          <div class="p-6 border-b border-mist dark:border-white/10 flex items-center justify-between">
            <h2 class="font-display text-2xl font-semibold text-ink dark:text-[#F0EDE6]">Add work sample</h2>
            <button @click="portfolioModalOpen = false" class="text-ink/40 dark:text-white/40 hover:text-ink dark:hover:text-white text-lg">✕</button>
          </div>

          <form @submit.prevent="handleSavePortfolio" class="p-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">
                Title <span class="text-clay">*</span>
              </label>
              <input
                v-model="portfolioForm.title"
                type="text"
                required
                placeholder="e.g. Kitchen rewiring — Bole"
                class="w-full rounded-lg border border-mist dark:border-white/15 bg-transparent px-4 py-2.5 text-ink dark:text-[#F0EDE6] placeholder:text-ink/30 dark:placeholder:text-white/30 outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">
                Description <span class="text-ink/40 dark:text-white/40 text-xs">(optional)</span>
              </label>
              <textarea
                v-model="portfolioForm.description"
                rows="3"
                placeholder="What was the job, and what did you deliver?"
                class="w-full rounded-lg border border-mist dark:border-white/15 bg-transparent px-4 py-2.5 text-ink dark:text-[#F0EDE6] placeholder:text-ink/30 dark:placeholder:text-white/30 outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition resize-none"
              ></textarea>
            </div>

            <div>
              <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">
                Photo <span class="text-clay">*</span>
              </label>
              <div v-if="portfolioForm.preview" class="mb-2">
                <img :src="portfolioForm.preview" alt="Preview" class="w-full h-40 object-cover rounded-lg border border-mist dark:border-white/10" />
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                @change="selectPortfolioImage"
                class="block w-full text-xs text-ink/60 dark:text-white/60 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-xs file:font-bold file:text-teal-700 hover:file:bg-teal-100 dark:file:bg-teal-950/50 dark:file:text-teal-300"
              />
              <p class="text-[11px] text-ink/40 dark:text-white/40 mt-1">JPG, PNG or WebP, up to 5 MB.</p>
            </div>

            <p v-if="portfolioError" class="text-clay text-sm bg-clay/5 border border-clay/20 rounded-lg px-4 py-2.5">
              {{ portfolioError }}
            </p>

            <div class="flex gap-3 pt-4 border-t border-mist dark:border-white/10">
              <button
                type="button"
                @click="portfolioModalOpen = false"
                class="flex-1 border border-mist dark:border-white/15 text-ink/70 dark:text-white/70 font-semibold py-2.5 rounded-full hover:border-clay/40 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="portfolioSaving"
                class="flex-1 bg-clay hover:bg-clay/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-full transition"
              >
                {{ portfolioSaving ? 'Uploading…' : 'Upload' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>

    <!-- ── Add/Edit Modal (Glassmorphic Slide-over/Dialog) ── -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div v-if="modalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div class="fixed inset-0 bg-ink/50 dark:bg-black/70 backdrop-blur-md" @click="modalOpen = false"></div>

        <!-- Content -->
        <div class="relative w-full max-w-lg bg-white dark:bg-mist-dark border border-mist dark:border-white/15 rounded-2xl shadow-2xl overflow-hidden z-10">
          <div class="p-6 border-b border-mist dark:border-white/10 flex items-center justify-between">
            <h2 class="font-display text-2xl font-semibold text-ink dark:text-[#F0EDE6]">
              {{ modalType === 'add' ? 'Add Service' : 'Edit Service' }}
            </h2>
            <button @click="modalOpen = false" class="text-ink/40 dark:text-white/40 hover:text-ink dark:hover:text-white text-lg">✕</button>
          </div>

          <form @submit.prevent="handleSaveService" class="p-6 space-y-4">
            <!-- Title -->
            <div>
              <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">
                Service title <span class="text-clay">*</span>
              </label>
              <input
                v-model="form.title"
                type="text"
                required
                placeholder="e.g. Professional House Painting"
                class="w-full rounded-lg border border-mist dark:border-white/15 bg-transparent px-4 py-2.5 text-ink dark:text-[#F0EDE6] placeholder:text-ink/30 dark:placeholder:text-white/30 outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition"
              />
            </div>

            <!-- Category -->
            <div>
              <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">
                Category <span class="text-clay">*</span>
              </label>
              <select
                v-model="form.category_id"
                required
                class="w-full rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-canvas-dark px-4 py-2.5 text-ink dark:text-[#F0EDE6] outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition appearance-none"
              >
                <option value="" disabled>Select a category…</option>
                <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                  {{ cat.name }}
                </option>
              </select>
            </div>

            <!-- Description -->
            <div>
              <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">
                Description <span class="text-clay">*</span>
              </label>
              <textarea
                v-model="form.description"
                required
                rows="4"
                placeholder="Describe your service, process, and materials included..."
                class="w-full rounded-lg border border-mist dark:border-white/15 bg-transparent px-4 py-2.5 text-ink dark:text-[#F0EDE6] placeholder:text-ink/30 dark:placeholder:text-white/30 outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition resize-none"
              ></textarea>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <!-- Price Type -->
              <div>
                <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">Price type</label>
                <select
                  v-model="form.price_type"
                  class="w-full rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-canvas-dark px-4 py-2.5 text-ink dark:text-[#F0EDE6] outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition"
                >
                  <option value="fixed">Fixed Price</option>
                  <option value="hourly">Hourly Rate</option>
                </select>
              </div>

              <!-- Price -->
              <div>
                <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">
                  Price (ETB) <span class="text-clay">*</span>
                </label>
                <input
                  v-model="form.price"
                  type="number"
                  required
                  min="0"
                  placeholder="0.00"
                  class="w-full rounded-lg border border-mist dark:border-white/15 bg-transparent px-4 py-2.5 text-ink dark:text-[#F0EDE6] outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition"
                />
              </div>
            </div>

            <!-- Duration & Status -->
            <div class="grid grid-cols-2 gap-4">
              <!-- Duration -->
              <div>
                <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">
                  Duration <span class="text-ink/40 dark:text-white/40 text-xs">(minutes, optional)</span>
                </label>
                <input
                  v-model="form.duration"
                  type="number"
                  min="1"
                  placeholder="e.g. 60"
                  class="w-full rounded-lg border border-mist dark:border-white/15 bg-transparent px-4 py-2.5 text-ink dark:text-[#F0EDE6] outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition"
                />
              </div>

              <!-- Service Status (Only for edit) -->
              <div v-if="modalType === 'edit'">
                <label class="block text-sm font-medium text-ink dark:text-[#F0EDE6] mb-1.5">Status</label>
                <select
                  v-model="form.service_status"
                  class="w-full rounded-lg border border-mist dark:border-white/15 bg-white dark:bg-canvas-dark px-4 py-2.5 text-ink dark:text-[#F0EDE6] outline-none focus:ring-2 focus:ring-clay/40 focus:border-clay transition"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <p v-if="error" class="text-clay text-sm bg-clay/5 border border-clay/20 rounded-lg px-4 py-2.5">
              {{ error }}
            </p>

            <div class="flex gap-3 pt-4 border-t border-mist dark:border-white/10">
              <button
                type="button"
                @click="modalOpen = false"
                class="flex-1 border border-mist dark:border-white/15 text-ink/70 dark:text-white/70 font-semibold py-2.5 rounded-full hover:border-clay/40 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="actionLoading"
                class="flex-1 bg-clay hover:bg-clay/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-full transition"
              >
                {{ actionLoading ? 'Saving…' : 'Save Service' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>

    <!-- ── Delete Confirmation Modal ── -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div v-if="deleteModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div class="fixed inset-0 bg-ink/50 dark:bg-black/70 backdrop-blur-md" @click="deleteModalOpen = false"></div>

        <!-- Content -->
        <div class="relative w-full max-w-sm bg-white dark:bg-mist-dark border border-mist dark:border-white/15 rounded-2xl shadow-2xl p-6 text-center z-10">
          <div class="w-12 h-12 rounded-full bg-clay/10 flex items-center justify-center text-clay text-xl mx-auto mb-4">⚠️</div>
          <h2 class="font-display text-xl font-semibold text-ink dark:text-[#F0EDE6] mb-2">Delete Service?</h2>
          <p class="text-sm text-ink/50 dark:text-white/50 mb-6">
            Are you sure you want to delete <span class="font-semibold text-ink dark:text-white">"{{ serviceToDelete?.title }}"</span>? This action cannot be undone.
          </p>

          <div class="flex gap-3">
            <button
              @click="deleteModalOpen = false"
              class="flex-1 border border-mist dark:border-white/15 text-ink/70 dark:text-white/70 font-semibold py-2.5 rounded-full hover:border-clay/40 transition text-sm"
            >
              Cancel
            </button>
            <button
              @click="handleDeleteService"
              :disabled="actionLoading"
              class="flex-1 bg-clay hover:bg-clay/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-full transition text-sm"
            >
              {{ actionLoading ? 'Deleting…' : 'Yes, Delete' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
