/**
 * POST /api/ai-job-assistant
 * 
 * Provides AI assistance for drafting and refining job postings on SkillLink.
 * Modes:
 * - 'generate': Given a brief idea / prompt, drafts title, category recommendation, description, suggested budget type & amount.
 * - 'improve': Enhances/polishes the existing description into a structured, clear job scope.
 */

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const apiKey = config.geminiApiKey

  const body = await readBody<{
    mode: 'generate' | 'improve'
    prompt?: string
    title?: string
    description?: string
    category?: string
  }>(event)

  const mode = body.mode || 'improve'

  if (apiKey) {
    try {
      let promptText = ''
      if (mode === 'generate') {
        promptText = `You are an expert hiring assistant for SkillLink, an Ethiopian freelance and local services platform.
The user has this rough job idea: "${body.prompt || body.title || ''}"

Please generate a professional job posting in JSON format with exactly these keys:
{
  "title": "A concise, clear job title (5-10 words)",
  "description": "A well-structured description including requirements, scope of work, expected deliverables, and location requirements in Ethiopia (Addis Ababa, Bole, remote, etc.). 3-4 paragraphs or bullet points.",
  "suggested_budget_type": "fixed" or "hourly",
  "suggested_budget": 1500
}
Return ONLY valid JSON without markdown wrapping.`
      } else {
        promptText = `You are an expert copywriter for SkillLink, a services platform in Ethiopia.
Improve and expand the following job description to be clear, professional, well-structured, and attractive to skilled Ethiopian freelancers/tradespeople:

Job Title: ${body.title || 'Service Request'}
Current Description:
"${body.description || ''}"

Return the polished description text directly (with clear bullet points and deliverables). Keep it natural and concise.`
      }

      const response = await $fetch<any>(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 800,
          }
        }
      })

      const replyText = response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      if (replyText) {
        if (mode === 'generate') {
          try {
            const cleanJson = replyText.replace(/```json\s*|```/g, '').trim()
            const parsed = JSON.parse(cleanJson)
            return { success: true, ...parsed }
          } catch {
            return {
              success: true,
              title: body.prompt ? `Professional ${body.prompt}` : 'Service Request',
              description: replyText,
              suggested_budget_type: 'fixed',
              suggested_budget: 1500,
            }
          }
        } else {
          return { success: true, improved_description: replyText }
        }
      }
    } catch (err: any) {
      console.warn('Gemini API call failed, using intelligent local template fallback', err?.message)
    }
  }

  // Intelligent Local Fallback if Gemini key is missing or offline
  if (mode === 'generate') {
    const raw = body.prompt || body.title || 'general task'
    return {
      success: true,
      title: `Looking for skilled professional for ${raw}`,
      description: `We are looking for an experienced and reliable professional to assist with ${raw}.\n\nScope of Work:\n• Initial inspection and requirements assessment\n• High-quality execution using standard tools and best practices\n• Testing and delivery within agreed timeframe\n\nRequirements:\n• Proven experience and portfolio\n• Punctual and professional communication\n• Location: Addis Ababa or remote as agreed`,
      suggested_budget_type: 'fixed',
      suggested_budget: 2000,
    }
  } else {
    const original = body.description || ''
    const polished = `${original.trim()}\n\nKey Deliverables & Standards:\n• Timely delivery and clear milestone updates\n• Quality assurance and handover upon customer satisfaction\n• Open to reasonable revisions`
    return {
      success: true,
      improved_description: polished
    }
  }
})
