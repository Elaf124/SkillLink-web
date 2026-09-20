/**
 * POST /api/ai-chat
 *
 * Receives a user message, optional Bearer token, user city, and role.
 * - For Customers: Fetches live provider & service data, recommends top providers.
 * - For Providers: Fetches live open job posts, recommends top jobs to bid on.
 */

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
  const apiKey = config.geminiApiKey

  const body = await readBody<RequestBody>(event)
  const userMessage = (body.message ?? '').trim()
  const isProviderRole = body.role === 'provider'

  if (!userMessage) {
    return {
      reply: isProviderRole
        ? 'Please type a message so I can help you find open jobs to bid on!'
        : 'Please type a message so I can help you find the best provider!',
      providers: [],
      jobs: []
    }
  }

  const backendBase = config.public.apiBase
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body.token) headers['Authorization'] = `Bearer ${body.token}`

  if (isProviderRole) {
    // -------------------------------------------------------------
    // PROVIDER SIDE: Fetch open jobs & recommend client job posts
    // -------------------------------------------------------------
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
      console.error('[ai-chat] failed to fetch jobs from backend:', err)
    }

    function generateProviderLocalFallback(): { reply: string; jobs: any[] } {
      const q = userMessage.toLowerCase()

      const faq: Array<{ match: RegExp; reply: string }> = [
        { match: /fee|commission|percentage|cut/, reply: `SkillLink charges a **10% platform fee** on completed bookings. You keep 90% of the job budget in your wallet.` },
        { match: /withdraw|payout|wallet|telebirr|cbe/, reply: `You can withdraw your earned wallet balance directly via **Telebirr, CBE Birr, or your Bank Account** from your Wallet page.` },
        { match: /how (does|do).*(work|offer|bid)/, reply: `To get hired on SkillLink:\n1. Browse open job posts under **/jobs**.\n2. Submit a custom offer (price, timeline, message).\n3. When the customer accepts your offer, funds enter escrow and you start work!` },
      ]
      for (const f of faq) {
        if (f.match.test(q)) return { reply: f.reply, jobs: [] }
      }

      const scored = rawJobs.map(j => {
        let score = 0
        const text = `${j.title} ${j.description} ${j.category?.name || ''}`.toLowerCase()
        const words = q.split(/\s+/).filter(w => w.length > 2)
        for (const w of words) {
          if (text.includes(w)) score += 3
        }
        score += Number(j.budget ?? 0) * 0.001
        return { j, score }
      })

      scored.sort((a, b) => b.score - a.score)
      const top = scored.slice(0, 4).map(s => s.j)

      if (!top.length) {
        return {
          reply: `I couldn't find active open jobs matching "${userMessage}". You can browse all current open client requests under [Find Open Jobs](/jobs).`,
          jobs: []
        }
      }

      let reply = `Here are open client jobs matching your criteria:\n\n`
      for (const j of top) {
        reply += `**${j.title}** — *${j.category?.name || 'General'}*\n`
        reply += `💰 Budget: **${Number(j.budget).toLocaleString()} ETB** | 📍 Location: ${j.location || 'Addis Ababa'}\n`
        reply += `👉 View job & send offer: /jobs/${j.id}\n\n`
      }
      reply += `💡 *Tip: Highlighting your relevant experience when submitting an offer increases your chance of acceptance!*`

      return { reply, jobs: top }
    }

    if (!apiKey) return generateProviderLocalFallback()

    const providerSystemPrompt = `You are SkillLink AI, a helpful assistant for service providers on SkillLink (Ethiopia's service marketplace).

Your main goals for providers:
1. Answer questions about how provider offers, escrow payments, 10% platform fee, wallets, and payouts work.
2. RECOMMEND OPEN JOBS when the provider asks for work, opportunities, or specific job categories.

RULES:
- NEVER recommend other service providers to a provider!
- Keep replies concise (under 250 words) and encouraging.
- When recommending jobs, pick 2–4 open jobs from the live data below and format each as:
  **[Job Title]** — *[Category]*
  💰 Budget: **[budget] ETB** | 📍 Location: [location]
  👉 View job & send offer: /jobs/[id]
- NEVER invent job IDs or titles. Only use real jobs from the live data below.

${body.userCity ? `The provider is in: ${body.userCity}` : ''}

LIVE OPEN JOBS DATA:
${jobsContext || 'No open jobs available.'}
`

    const priorTurns: GeminiContent[] = (body.history ?? [])
      .filter(t => t && typeof t.text === 'string' && t.text.trim())
      .slice(-8)
      .map(t => ({ role: t.role === 'model' ? 'model' : 'user', parts: [{ text: t.text }] }))

    const modelsToTry = [
      'gemini-flash-latest',
      'gemini-3.7-flash',
      'gemini-3.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-pro-latest'
    ]

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
            generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
          },
        })

        const reply = geminiRes?.candidates?.[0]?.content?.parts?.[0]?.text
        if (reply) {
          const mentionedJobs = rawJobs.filter(j => reply.includes(`/jobs/${j.id}`)).slice(0, 5)
          return { reply, jobs: mentionedJobs, providers: [] }
        }
      } catch (err: any) {
        console.warn(`[ai-chat-provider] model ${model} failed, trying next...`)
      }
    }

    return generateProviderLocalFallback()
  } else {
    // -------------------------------------------------------------
    // CUSTOMER SIDE: Fetch live provider & service data
    // -------------------------------------------------------------
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
      console.error('[ai-chat] failed to fetch providers from backend:', err)
    }

    function generateLocalFallback(): { reply: string; providers: any[] } {
      const q = userMessage.toLowerCase()

      const faq: Array<{ match: RegExp; reply: string }> = [
        { match: /escrow|held|release|safe|protect|refund/, reply: `On SkillLink, payment is **escrow-protected**: the customer pays after the work is marked complete, the funds are held by the platform, and they are released to the provider only once the customer confirms the job is done. A 10% platform fee is deducted, so the provider receives 90%.` },
        { match: /\bfee|commission|charge|how much.*(cost|charge)|percentage/, reply: `SkillLink charges a **10% platform fee** on completed bookings. The provider receives the remaining 90% in their wallet, which they can withdraw via Telebirr, CBE Birr, or a bank account.` },
        { match: /how (does|do).*(work|it)|get started|new here|what is skilllink/, reply: `Two ways to hire on SkillLink:\n1. **Book a service** directly from a provider's profile at a set price.\n2. **Post a job** at /jobs/post, describe what you need, and verified providers send you offers to compare.\nEither way, payment is held in escrow and released only when you confirm the work is done.` },
        { match: /pay|telebirr|cbe|chapa|payment method/, reply: `Payments are made through **Telebirr, CBE Birr, or Chapa**. You pay once the work is complete; the amount is held in escrow and released to the provider after you confirm.` },
        { match: /verif|trust|legit|scam/, reply: `Every provider on SkillLink is **identity- and document-verified** by the admin team before they can take bookings. You can also see verified reviews from past customers on each provider's profile.` },
      ]
      for (const f of faq) {
        if (f.match.test(q)) return { reply: f.reply, providers: [] }
      }

      const scored = rawProviders.map(p => {
        let score = 0
        const combinedText = `${p.name} ${p.title} ${p.bio} ${p.services.map((s: any) => s.title + ' ' + s.category).join(' ')}`.toLowerCase()
        const words = q.split(/\s+/).filter(w => w.length > 2)
        for (const w of words) {
          if (combinedText.includes(w)) score += 3
        }
        score += Number(p.rating) * 2
        score += Math.min(p.completed_jobs, 20) * 0.2
        return { p, score }
      })

      scored.sort((a, b) => b.score - a.score)
      const top = scored.slice(0, 3).map(s => s.p)

      if (!top.length) {
        return {
          reply: `I couldn't find specific providers matching "${userMessage}". You can explore all verified providers in the [Browse Services](/browse) catalog or [Post an Open Job](/jobs/post) to receive custom bids.`,
          providers: []
        }
      }

      let reply = `Here are the top verified providers on SkillLink for your request:\n\n`
      for (const p of top) {
        const primarySvc = p.services[0]
        const priceText = primarySvc ? `${Number(primarySvc.price).toLocaleString()} ETB${primarySvc.price_type === 'hourly' ? '/hr' : ''}` : 'Competitive rates'
        reply += `**${p.name}** — ${p.title || 'Verified Specialist'}\n`
        reply += `⭐ ${p.rating} • ${p.completed_jobs} jobs completed • 📍 ${p.city}\n`
        if (primarySvc) reply += `Services: ${primarySvc.title} (${priceText})\n`
        reply += `👉 View profile: /providers/${p.id}\n\n`
      }
      reply += `💡 *Tip: You can start an in-app chat with any provider before booking to negotiate scope and pricing!*`

      return { reply, providers: top }
    }

    if (!apiKey) return generateLocalFallback()

    const customerSystemPrompt = `You are SkillLink AI, a friendly, professional assistant for SkillLink — Ethiopia's freelance & service marketplace.

You do two things:
1. ANSWER QUESTIONS about how SkillLink works — booking, custom job posts & bidding, escrow-protected payments (funds are released to the provider only after the customer confirms the work), the 10% platform fee, provider verification, reviews, Telebirr/CBE/Chapa payment options, wallets and payouts. Answer these directly and concisely; do NOT list providers unless asked.
2. RECOMMEND PROVIDERS when the user is looking for someone to do a job.

GUIDELINES:
- Use the conversation so far for context.
- Be concise and warm. Under 300 words.
- When recommending, pick 2–4 verified providers that best match the request and format each as:
  **[Provider Name]** — [their title/specialty]
  ⭐ [rating] • [jobs] jobs completed • [city]
  Services: [up to 2 relevant services with price in ETB]
  👉 View profile: /providers/[id]
- NEVER invent provider IDs or names. Only use providers present in the live data below.

${body.userCity ? `The customer is in: ${body.userCity}` : ''}

LIVE PROVIDER DATA:
${providerContext || 'No providers loaded.'}
`

    const priorTurns: GeminiContent[] = (body.history ?? [])
      .filter(t => t && typeof t.text === 'string' && t.text.trim())
      .slice(-8)
      .map(t => ({ role: t.role === 'model' ? 'model' : 'user', parts: [{ text: t.text }] }))

    const modelsToTry = [
      'gemini-flash-latest',
      'gemini-3.7-flash',
      'gemini-3.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-pro-latest'
    ]

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
            generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
          },
        })

        const reply = geminiRes?.candidates?.[0]?.content?.parts?.[0]?.text
        if (reply) {
          const mentionedIds = rawProviders.filter(p => reply.includes(`/providers/${p.id}`)).slice(0, 5)
          return { reply, providers: mentionedIds, jobs: [] }
        }
      } catch (err: any) {
        console.warn(`[ai-chat] model ${model} failed, trying next...`)
      }
    }

    return generateLocalFallback()
  }
})
