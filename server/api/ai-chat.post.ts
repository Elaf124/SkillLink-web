/**
 * POST /api/ai-chat
 *
 * Domain-trained AI Assistant for SkillLink Ethiopia.
 * - Customer Role: Answers marketplace questions & accurately recommends matched verified providers.
 * - Provider Role: Answers provider-specific questions & accurately recommends matching open jobs.
 * - Dual Engine: Powered by Google Gemini (when key configured) with instant fallback
 *   to the local trained domain knowledge engine.
 */

import {
  findBestFaqMatch,
  isProviderSearchQuery,
  isJobSearchQuery,
  scoreAndFilterProviders,
  scoreAndFilterJobs,
  KNOWLEDGE_BASE,
} from '../utils/aiEngine'

interface RequestBody {
  message: string
  token?: string | null
  userCity?: string | null
  role?: string | null
  history?: Array<{ role: 'user' | 'model'; text: string }>
}

interface GeminiPart { text: string }
interface GeminiContent { role: 'user' | 'model'; parts: GeminiPart[] }
interface GeminiResponse {
  candidates?: Array<{ content: { parts: GeminiPart[] } }>
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const rawApiKey = (config.geminiApiKey || process.env.GEMINI_API_KEY || '').trim()
  // Valid Google AI Studio Gemini API keys begin with AIzaSy...
  const isValidGeminiKey = rawApiKey.startsWith('AIzaSy')
  const apiKey = isValidGeminiKey ? rawApiKey : null

  const body = await readBody<RequestBody>(event)
  const userMessage = (body.message ?? '').trim()
  const isProviderRole = body.role === 'provider'

  if (!userMessage) {
    return {
      reply: isProviderRole
        ? '👋 Selam! How can I help you find work or manage your provider account today?'
        : '👋 Selam! Tell me what service you need or ask any question about SkillLink.',
      providers: [],
      jobs: []
    }
  }

  const backendBase = config.public.apiBase || 'https://skilllink-8wzw.onrender.com/api'
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body.token) headers['Authorization'] = `Bearer ${body.token}`

  // ─────────────────────────────────────────────────────────────
  // 1. FAST DOMAIN FAQ & INTENT RESOLUTION
  // ─────────────────────────────────────────────────────────────
  // If the question is a direct specific platform question (escrow, fee, cancellation,
  // registration, payment, how it works, etc.) and NOT a search for a provider/job,
  // answer immediately with the best specialized answer!
  const faqMatch = findBestFaqMatch(userMessage, isProviderRole)
  const isExplicitSearch = isProviderRole
    ? isJobSearchQuery(userMessage)
    : isProviderSearchQuery(userMessage)

  // If it's a clear FAQ match and not a search, provide the specialized answer immediately
  if (faqMatch && !isExplicitSearch) {
    const answer = isProviderRole
      ? (faqMatch.providerAnswer || faqMatch.customerAnswer)
      : faqMatch.customerAnswer

    return {
      reply: answer,
      providers: [],
      jobs: []
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. PROVIDER ROLE LOGIC
  // ─────────────────────────────────────────────────────────────
  if (isProviderRole) {
    let rawJobs: any[] = []
    let jobsContext = ''

    try {
      const [res1, res2] = await Promise.allSettled([
        $fetch<any>(`${backendBase}/jobs?page=1`, { headers }),
        $fetch<any>(`${backendBase}/jobs?page=2`, { headers }),
      ])
      const list1 = res1.status === 'fulfilled' ? (res1.value?.data ?? res1.value ?? []) : []
      const list2 = res2.status === 'fulfilled' ? (res2.value?.data ?? res2.value ?? []) : []
      rawJobs = [...(Array.isArray(list1) ? list1 : []), ...(Array.isArray(list2) ? list2 : [])]
        .filter((j: any) => j.status === 'open')

      jobsContext = rawJobs.map((j: any) =>
        `[Job #${j.id}] ${j.title} | Category: ${j.category?.name || 'General'} | Budget: ${Number(j.budget ?? 0).toLocaleString()} ETB | Location: ${j.location || 'Addis Ababa'}\nDescription: ${j.description || ''}`
      ).join('\n\n')
    } catch (err) {
      console.warn('[ai-chat] failed to fetch jobs from backend:', err)
    }

    // Local Trained Fallback for Provider
    function generateProviderSmartFallback() {
      // Check FAQ again
      if (faqMatch) {
        return {
          reply: faqMatch.providerAnswer || faqMatch.customerAnswer,
          jobs: []
        }
      }

      const matchedJobs = scoreAndFilterJobs(userMessage, rawJobs, body.userCity)

      if (matchedJobs.length > 0) {
        let reply = `Here are active open client jobs matching your criteria:\n\n`
        for (const j of matchedJobs) {
          reply += `**${j.title}** — *${j.category?.name || 'General'}*\n`
          reply += `💰 Budget: **${Number(j.budget).toLocaleString()} ETB** | 📍 Location: ${j.location || 'Addis Ababa'}\n`
          reply += `👉 View job & send offer: /jobs/${j.id}\n\n`
        }
        reply += `💡 *Tip: Highlighting your specific experience and timeline when submitting an offer increases your chance of winning!*`
        return { reply, jobs: matchedJobs }
      }

      // If user was looking for a job but none matched
      if (isExplicitSearch) {
        return {
          reply: `I couldn't find active open jobs specifically matching "${userMessage}".\n\nNew client jobs are posted daily! You can browse all current opportunities under **[Find Open Jobs](/jobs)** or set alerts for your category.`,
          jobs: []
        }
      }

      // General helpful provider response
      return {
        reply: `I am here to help you succeed on SkillLink! You can:\n• Ask for open client jobs (e.g. *"Show me web development jobs"*, *"High budget jobs"*)\n• Learn about [Fees & Escrow Protection](/faq)\n• Check your earnings under **[Wallet](/wallet)**\n• Update your services & portfolio in **[Profile Settings](/profile)**`,
        jobs: []
      }
    }

    // If no valid Gemini API key, use the local trained engine
    if (!apiKey) {
      const result = generateProviderSmartFallback()
      return { reply: result.reply, jobs: result.jobs, providers: [] }
    }

    // Try Google Gemini with official endpoints
    const modelsToTry = [
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro'
    ]

    const providerSystemPrompt = `You are SkillLink AI, an expert assistant for service providers on SkillLink (Ethiopia's service marketplace).
Knowledge Base Context:
- Platform fee: Exactly 10% on completed jobs. Providers keep 90% in wallet.
- Escrow: Client deposits budget into escrow before work begins; funds are released to provider upon client approval.
- Payouts: Providers withdraw via Telebirr, CBE Birr, or Bank Account from /wallet.
- Proposals: Providers browse /jobs and submit custom offers (price, days, pitch).
- NEVER recommend other providers to a provider!
- When recommending jobs, pick 2-4 jobs ONLY from the live data below.
- Format jobs as:
  **[Job Title]** — *[Category]*
  💰 Budget: **[budget] ETB** | 📍 Location: [location]
  👉 View job & send offer: /jobs/[id]
- If no jobs match, state that clearly and link to /jobs. Never invent jobs.
- Keep answers under 250 words.

${body.userCity ? `Provider City: ${body.userCity}` : ''}

LIVE OPEN JOBS:
${jobsContext || 'No open jobs available.'}
`

    const priorTurns: GeminiContent[] = (body.history ?? [])
      .filter(t => t && typeof t.text === 'string' && t.text.trim())
      .slice(-6)
      .map(t => ({ role: t.role === 'model' ? 'model' : 'user', parts: [{ text: t.text }] }))

    for (const model of modelsToTry) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
        const geminiRes = await $fetch<GeminiResponse>(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: {
            system_instruction: { parts: [{ text: providerSystemPrompt }] },
            contents: [
              ...priorTurns,
              { role: 'user', parts: [{ text: userMessage }] },
            ],
            generationConfig: { temperature: 0.5, maxOutputTokens: 600 },
          },
        })

        const reply = geminiRes?.candidates?.[0]?.content?.parts?.[0]?.text
        if (reply) {
          const mentionedJobs = rawJobs.filter(j => reply.includes(`/jobs/${j.id}`)).slice(0, 4)
          return { reply, jobs: mentionedJobs, providers: [] }
        }
      } catch (err: any) {
        console.warn(`[ai-chat-provider] model ${model} failed, trying next...`)
      }
    }

    // Fallback if Gemini fails
    const result = generateProviderSmartFallback()
    return { reply: result.reply, jobs: result.jobs, providers: [] }

  } else {
    // ─────────────────────────────────────────────────────────────
    // 3. CUSTOMER ROLE LOGIC
    // ─────────────────────────────────────────────────────────────
    let rawProviders: any[] = []
    let providerContext = ''

    try {
      const [page1, page2, page3] = await Promise.allSettled([
        $fetch<any>(`${backendBase}/services?page=1`, { headers }),
        $fetch<any>(`${backendBase}/services?page=2`, { headers }),
        $fetch<any>(`${backendBase}/services?page=3`, { headers }),
      ])

      const allServices: any[] = []
      for (const p of [page1, page2, page3]) {
        if (p.status === 'fulfilled') allServices.push(...(p.value?.data ?? []))
      }

      const providerMap = new Map<number, any>()
      for (const svc of allServices) {
        const pid = svc.provider?.id
        if (!pid) continue
        if (!providerMap.has(pid)) {
          providerMap.set(pid, {
            id: pid,
            name: `${svc.provider?.user?.first_name ?? ''} ${svc.provider?.user?.last_name ?? ''}`.trim(),
            title: svc.provider?.professional_title ?? '',
            rating: Number(svc.provider?.average_rating ?? 5.0).toFixed(1),
            completed_jobs: svc.provider?.completed_jobs ?? 0,
            city: svc.provider?.user?.city ?? 'Addis Ababa',
            bio: svc.provider?.bio ?? '',
            services: [],
          })
        }
        providerMap.get(pid).services.push({
          id: svc.id,
          title: svc.title,
          price: svc.price,
          price_type: svc.price_type,
          category: svc.category?.name ?? '',
        })
      }

      rawProviders = Array.from(providerMap.values())

      providerContext = rawProviders.map(p => {
        const svcList = p.services.slice(0, 3).map((s: any) =>
          `    • ${s.title} — ${Number(s.price).toLocaleString()} ETB${s.price_type === 'hourly' ? '/hr' : ''} (${s.category})`
        ).join('\n')
        return `[Provider #${p.id}] ${p.name} | ${p.title} | ⭐${p.rating} | ${p.completed_jobs} jobs | City: ${p.city || 'Addis Ababa'}\n${svcList}`
      }).join('\n\n')

    } catch (err) {
      console.warn('[ai-chat] failed to fetch providers from backend:', err)
    }

    // Local Trained Fallback for Customers
    function generateCustomerSmartFallback() {
      // Check FAQ first
      if (faqMatch) {
        return {
          reply: faqMatch.customerAnswer,
          providers: []
        }
      }

      // If user is searching for a provider/service
      const matchedProviders = scoreAndFilterProviders(userMessage, rawProviders, body.userCity)

      if (matchedProviders.length > 0) {
        let reply = `Here are the top verified providers matching your request:\n\n`
        for (const p of matchedProviders) {
          const primarySvc = p.services[0]
          const priceText = primarySvc
            ? `${Number(primarySvc.price).toLocaleString()} ETB${primarySvc.price_type === 'hourly' ? '/hr' : ''}`
            : 'Competitive rates'
          reply += `**${p.name}** — ${p.title || 'Verified Specialist'}\n`
          reply += `⭐ ${p.rating} • ${p.completed_jobs} jobs completed • 📍 ${p.city}\n`
          if (primarySvc) reply += `Services: ${primarySvc.title} (${priceText})\n`
          reply += `👉 View profile & chat: /providers/${p.id}\n\n`
        }
        reply += `💡 *Tip: You can start an in-app chat with any provider before booking to negotiate scope and pricing!*`
        return { reply, providers: matchedProviders }
      }

      // If user specifically asked for a trade but no provider matched
      if (isExplicitSearch) {
        return {
          reply: `I currently don't see verified providers specifically registered for "${userMessage}" in your immediate area.\n\n💡 **Recommended Action**: You can **[Post an Open Job](/jobs/post)** detailing your project and budget. Verified professionals will be notified and can submit custom offers directly to you!`,
          providers: []
        }
      }

      // General intelligent assistant response
      return {
        reply: `👋 I can help you with anything on SkillLink:\n\n` +
          `• **Find Professionals**: Tell me what you need (e.g. *"Find a plumber"*, *"Looking for a graphic designer"*, *"Electrician in Addis"*).\n` +
          `• **Custom Project**: [Post an Open Job](/jobs/post) to receive quotes.\n` +
          `• **Payment & Escrow**: Ask *"How does payment work?"* or *"Is escrow safe?"*.\n` +
          `• **Categories**: Ask *"What services do you offer?"* to see all available categories.\n\n` +
          `How can I assist you right now?`,
        providers: []
      }
    }

    // If no valid Gemini API key, return the local smart engine response
    if (!apiKey) {
      const result = generateCustomerSmartFallback()
      return { reply: result.reply, providers: result.providers, jobs: [] }
    }

    // Try Google Gemini with official endpoints
    const modelsToTry = [
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro'
    ]

    const customerSystemPrompt = `You are SkillLink AI, the official assistant for SkillLink (Ethiopia's leading freelance & service marketplace).
Guidelines:
1. ANSWER QUESTIONS directly and concisely (under 250 words).
   - Escrow: Customer deposits money before work; funds are held in escrow and released ONLY when customer confirms satisfaction.
   - Fees: Free for customers; 10% platform fee for providers upon completion.
   - Payment methods: Telebirr, CBE Birr, Chapa, Bank transfer.
   - Never recommend providers when the user is just asking a how-to or platform question!
2. RECOMMEND PROVIDERS only when the user is looking for a service or provider.
   - Pick 2-4 providers from the LIVE PROVIDER DATA below who ACTUALLY match the request.
   - Format:
     **[Provider Name]** — [their title]
     ⭐ [rating] • [jobs] jobs completed • [city]
     Services: [relevant service name and price in ETB]
     👉 View profile & chat: /providers/[id]
   - If NO providers match the requested skill, tell the user honestly that none are listed yet and recommend posting an open job at /jobs/post. Never make up names or IDs.

${body.userCity ? `Customer Location: ${body.userCity}` : ''}

LIVE PROVIDER DATA:
${providerContext || 'No providers loaded.'}
`

    const priorTurns: GeminiContent[] = (body.history ?? [])
      .filter(t => t && typeof t.text === 'string' && t.text.trim())
      .slice(-6)
      .map(t => ({ role: t.role === 'model' ? 'model' : 'user', parts: [{ text: t.text }] }))

    for (const model of modelsToTry) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
        const geminiRes = await $fetch<GeminiResponse>(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: {
            system_instruction: { parts: [{ text: customerSystemPrompt }] },
            contents: [
              ...priorTurns,
              { role: 'user', parts: [{ text: userMessage }] },
            ],
            generationConfig: { temperature: 0.5, maxOutputTokens: 600 },
          },
        })

        const reply = geminiRes?.candidates?.[0]?.content?.parts?.[0]?.text
        if (reply) {
          const mentionedIds = rawProviders.filter(p => reply.includes(`/providers/${p.id}`)).slice(0, 4)
          return { reply, providers: mentionedIds, jobs: [] }
        }
      } catch (err: any) {
        console.warn(`[ai-chat] model ${model} failed, trying next...`)
      }
    }

    // Fallback if Gemini fails
    const result = generateCustomerSmartFallback()
    return { reply: result.reply, providers: result.providers, jobs: [] }
  }
})
