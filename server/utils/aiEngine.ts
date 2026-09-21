/**
 * server/utils/aiEngine.ts
 *
 * Domain-trained AI Knowledge Base & Semantic Engine for SkillLink.
 * Handles intent detection, specific question answering, and strict relevance matching
 * for providers and jobs.
 */

export interface KnowledgeTopic {
  id: string
  title: string
  patterns: RegExp[]
  customerAnswer: string
  providerAnswer?: string
  links?: Array<{ text: string; url: string }>
}

export const KNOWLEDGE_BASE: KnowledgeTopic[] = [
  // ── 1. Greetings & Bot Identity ───────────────────────────────────────────
  {
    id: 'greeting',
    title: 'Greeting & Introduction',
    patterns: [
      /^(hi|hello|hey|selam|salaam|greetings|morning|afternoon|evening|good\s+day)\b/i,
      /^(howdy|yo|sup|what'?s\s+up)\b/i,
      /^(who\s+are\s+you|what\s+is\s+your\s+name|what\s+can\s+you\s+do|introduce\s+yourself)/i,
    ],
    customerAnswer: `👋 **Selam! I am SkillLink AI**, your 24/7 assistant for Ethiopia's premier freelance and service marketplace.

Here is how I can assist you today:
• **Find Top Providers**: Tell me what service you need (e.g., *"Find a plumber in Addis"*, *"Looking for a graphic designer"*).
• **Escrow & Payments**: Learn how your payments are protected with Telebirr, CBE Birr, or Chapa.
• **Post an Open Job**: Need custom bids? I can guide you on [Posting an Open Job](/jobs/post).
• **Platform Guidance**: Ask about fees, cancellations, safety, or provider verification.

What would you like help with today?`,
    providerAnswer: `👋 **Selam! I am SkillLink AI**, your personal assistant on SkillLink.

I am here to help you grow your service business:
• **Find Open Jobs**: Ask me for jobs in your skill (e.g., *"Show me web development jobs"*, *"High budget jobs"*).
• **Bidding & Offers**: Learn how to write winning proposals to clients.
• **Wallet & Payouts**: Check how to withdraw your earnings via Telebirr, CBE Birr, or Bank.
• **Fees & Rules**: Learn about the 10% platform fee and escrow protection.

What are you looking to do today?`,
  },

  // ── 2. Support & Help (Placed before chat to prevent pattern overlap) ─────
  {
    id: 'support_contact',
    title: 'Contacting Support',
    patterns: [
      /\b(support|customer\s+service|admin|help\s+desk|report\s+problem)\b/i,
      /how\s+to\s+contact\s+(support|skilllink|help|admin)/i,
      /contact\s+support/i,
    ],
    customerAnswer: `🤝 **SkillLink Customer Support**:

We are always here to assist you:
• **Support Center**: Visit **[Support & Help](/support)** to submit an inquiry, report an issue, or view FAQs.
• **Direct Email**: Reach our support team at \`support@skilllink.et\`.
• **Live Assistance**: Ask me anything right here anytime 24/7!`,
    providerAnswer: `🤝 **Provider Support**:

Need assistance with account verification, job mediation, or payout inquiries?
• Visit the **[Support Center](/support)** to submit a ticket to our admin team.
• Email our support specialists directly at \`support@skilllink.et\`.`,
  },

  // ── 3. How SkillLink Works ────────────────────────────────────────────────
  {
    id: 'how_it_works',
    title: 'How SkillLink Works',
    patterns: [
      /how\s+(does|do)\s+(skilllink|this|it)\s+work/i,
      /how\s+to\s+hire/i,
      /how\s+can\s+i\s+use\s+skilllink/i,
      /getting\s+started/i,
      /what\s+is\s+skilllink/i,
    ],
    customerAnswer: `**SkillLink** makes hiring trusted, verified professionals in Ethiopia safe and simple:

1. **Find or Request**:
   • [Browse Services](/browse) to hire verified providers directly at fixed or hourly rates.
   • Or [Post an Open Job](/jobs/post) and receive competitive bids from multiple providers.
2. **Chat & Agree**: Message providers directly in real-time to discuss project scope and timeline before making any commitment.
3. **Escrow Protected Payment**: When you accept a quote, funds are safely deposited into **Escrow**. The provider does *not* receive the money yet.
4. **Approve & Release**: Once the work is delivered and you are 100% satisfied, you confirm completion to release payment to the provider.`,
    providerAnswer: `**How SkillLink works for Service Providers**:

1. **Complete Profile & Verification**: Set up your professional bio, skills, and upload verification ID under [Profile Settings](/profile).
2. **Find Work**: Browse open client requests under [Find Open Jobs](/jobs) and submit competitive offers with your price and timeline.
3. **Escrow Guarantee**: When a customer accepts your offer, the project budget is secured in escrow before you begin work, guaranteeing you will be paid.
4. **Deliver & Get Paid**: Deliver the service, have the client approve completion, and receive **90%** of the job budget instantly in your [Wallet](/wallet).`,
  },

  // ── 4. Escrow & Security ──────────────────────────────────────────────────
  {
    id: 'escrow_security',
    title: 'Escrow Protection & Payment Security',
    patterns: [
      /\b(escrow|safe|safety|scam|scams|fraud|protect|protection|secure|security|guarantee)\b/i,
      /is\s+my\s+money\s+safe/i,
      /what\s+if\s+(i\s+get\s+scammed|provider\s+steals|they\s+don'?t\s+do\s+the\s+job)/i,
    ],
    customerAnswer: `🛡️ **100% Escrow Protection on SkillLink**:

Your payments are completely protected against fraud:
• **Funds are Held in Trust**: When you book a service or accept a proposal, your payment is placed in a secure platform escrow vault.
• **Providers are Paid ONLY on Approval**: The provider cannot touch the money until you verify that the work has been completed satisfactorily.
• **Dispute Resolution**: If a provider fails to show up or delivers incomplete work, you can raise a dispute, and our admin team will review and issue a refund.
• **Never Pay Direct Cash**: Always keep transactions on SkillLink to remain protected by our escrow guarantee.`,
    providerAnswer: `🛡️ **Payment Security for Providers**:

• **Guaranteed Payment**: When a client hires you on SkillLink, their payment is locked in Escrow before you begin working. You never have to worry about unpaid invoices.
• **Clear Milestones**: Deliver your work through the platform and mark it complete.
• **Dispute Support**: If a client unjustly refuses to release payment for delivered work, our admin support team steps in to inspect evidence and release your funds.`,
  },

  // ── 5. Platform Fees & Commission ─────────────────────────────────────────
  {
    id: 'platform_fees',
    title: 'Platform Fees & Pricing',
    patterns: [
      /\b(fee|fees|commission|percentage|cut|charge|charges|cost|costs|pricing)\b/i,
      /how\s+much\s+(does\s+it\s+cost|do\s+you\s+charge|is\s+the\s+fee)/i,
      /10\s*%/i,
    ],
    customerAnswer: `💰 **Pricing for Customers**:
• **100% Free to Search & Post**: It costs nothing to browse providers, chat, or post open job requests.
• **Transparent Pricing**: You pay only the agreed service rate or accepted bid amount. No hidden subscription fees!
• **Payment Gateway**: Standard local processing (Telebirr/CBE/Chapa) may apply nominal transaction fees depending on your chosen bank.`,
    providerAnswer: `💰 **Platform Fee for Providers**:
• SkillLink charges a flat **10% platform fee** on successfully completed jobs.
• You keep **90%** of your total contract value directly in your wallet balance.
• **Example**: On a **5,000 ETB** job, you earn **4,500 ETB** net, and SkillLink retains 500 ETB for escrow protection, platform hosting, and payment infrastructure.
• There are no monthly fees or charges to submit bids!`,
  },

  // ── 6. Payment Methods ────────────────────────────────────────────────────
  {
    id: 'payment_methods',
    title: 'Supported Payment Methods',
    patterns: [
      /\b(telebirr|cbe|cbe\s*birr|chapa|payment\s+method|how\s+to\s+pay|cash)\b/i,
      /can\s+i\s+pay\s+with/i,
      /what\s+payment\s+methods/i,
      /bank\s+transfer/i,
    ],
    customerAnswer: `💳 **Accepted Payment Methods on SkillLink**:

We support Ethiopia's most popular and convenient payment options:
• **Telebirr**: Fast mobile checkout with direct confirmation.
• **CBE Birr & Commercial Bank of Ethiopia (CBE)**: Seamless bank transfer and mobile wallet.
• **Chapa Gateway**: Accepts local debit cards, Awash Bank, Dashen Bank, and international cards.

⚠️ **Important**: For your safety, never pay providers cash in person or off-platform. Off-platform payments void your escrow protection.`,
    providerAnswer: `💳 **Receiving Your Earnings**:

You can withdraw your wallet balance using:
• **Telebirr**: Instant mobile wallet payout.
• **CBE Birr**: Direct mobile bank transfer.
• **Direct Bank Account**: Transfer directly to your Ethiopian commercial bank account.

Configure your payout details anytime under [Payout Methods](/payouts) or in your [Wallet](/wallet).`,
  },

  // ── 7. How to Post a Job ──────────────────────────────────────────────────
  {
    id: 'post_a_job',
    title: 'How to Post a Job',
    patterns: [
      /how\s+to\s+post\s+(a\s+)?job/i,
      /post\s+(a\s+)?job/i,
      /create\s+(a\s+)?job/i,
      /post\s+(a\s+)?project/i,
      /custom\s+quote/i,
    ],
    customerAnswer: `📝 **How to Post an Open Job on SkillLink**:

If you have a custom project or want multiple providers to bid with competitive prices:
1. Navigate to **[Post an Open Job](/jobs/post)**.
2. Enter a descriptive title (e.g., *"Fix leaking bathroom pipe in Bole"*).
3. Select the appropriate **Category** and your **Location / Subcity**.
4. Set your budget in **ETB** (fixed price or hourly) and expected deadline.
5. Publish your job! Verified providers in that field will receive alerts and submit custom proposals for you to compare.`,
    providerAnswer: `💼 **Finding & Bidding on Jobs**:

Clients post new project requests every day. You can review all active jobs and submit proposals here:
👉 **[Browse Open Jobs](/jobs)**

Tips for winning jobs:
• Filter by your category and city.
• Read the client's description carefully.
• Submit a polite, detailed offer stating your price and completion time.`,
  },

  // ── 8. Bidding & Proposals for Providers ──────────────────────────────────
  {
    id: 'provider_bidding',
    title: 'Bidding & Submitting Offers',
    patterns: [
      /how\s+(to|do\s+i)\s+(bid|send\s+offer|make\s+offer|submit\s+offer|submit\s+proposal|win\s+jobs)/i,
      /\b(bid|bidding|proposal|proposals)\b/i,
    ],
    customerAnswer: `💼 **Comparing Bids on SkillLink**:

When you post an open job, verified providers submit custom proposals with their price, completion days, and message. You can review their profiles, check past reviews, and chat with them before accepting an offer!`,
    providerAnswer: `🎯 **How to Bid & Win Jobs on SkillLink**:

1. **Browse Open Jobs**: Head to **[Find Open Jobs](/jobs)** to view client project requests.
2. **Review Requirements**: Click on a job to read the full scope, budget, and location.
3. **Submit Your Offer**:
   • Enter your **Price (ETB)** and **Estimated Days** to complete.
   • Write a persuasive cover message highlighting your relevant experience and similar past projects.
4. **Negotiate in Chat**: If the client is interested, they can message you directly on SkillLink to finalize details.
5. **Start Work When Escrow is Funded**: Once the client accepts your offer, the payment is secured in escrow and you can begin!`,
  },

  // ── 9. How to Become a Provider & Verification ────────────────────────────
  {
    id: 'provider_verification',
    title: 'Provider Registration & Verification',
    patterns: [
      /how\s+to\s+become\s+a\s+provider/i,
      /join\s+as\s+(a\s+)?provider/i,
      /sell\s+my\s+service/i,
      /how\s+to\s+get\s+verified/i,
      /verification\s+(process|documents|badge|id)/i,
      /upload\s+id/i,
      /kebele\s+id/i,
    ],
    customerAnswer: `✅ **Provider Verification Standards on SkillLink**:

Every verified provider on SkillLink undergoes admin review:
• **Identity Verification**: Providers must submit their valid Kebele ID, National ID, or Passport.
• **Skill & Credential Check**: Relevant trade certifications or professional references are checked.
• Look for the **Verified Badge** on provider profiles to hire with confidence.`,
    providerAnswer: `🚀 **How to Become a Verified Provider**:

1. Register an account and select the **Service Provider** role.
2. Complete your profile under [Provider Profile](/profile): add your professional title, hourly or fixed services, and past work portfolio.
3. Submit verification documents under **Verification**: upload a clear photo of your **Kebele ID, Passport, or Business License**.
4. Our administration team typically reviews and verifies documents within **24 to 48 hours**. Once approved, your profile receives the Verified badge and you can start taking bookings!`,
  },

  // ── 10. Cancellations & Refunds ───────────────────────────────────────────
  {
    id: 'cancellation_refunds',
    title: 'Cancellations, Refunds & Disputes',
    patterns: [
      /\b(cancel|cancellation|refund|refunds|money\s+back|dispute|disputes)\b/i,
      /what\s+if\s+(provider\s+doesn'?t\s+show|work\s+is\s+bad|job\s+is\s+not\s+done)/i,
      /how\s+do\s+i\s+cancel/i,
    ],
    customerAnswer: `🔄 **Cancellation & Refund Policy**:

• **Before Work Starts**: If you or the provider cancel before any work has commenced, your escrow deposit is **100% refunded** back to your wallet or payment account.
• **During Work / Quality Issues**: If a provider fails to perform the work or provides unsatisfactory results, do **NOT** mark the job as complete.
• **Open a Dispute**: Click "Report Issue" or "Open Dispute" on your [Bookings Page](/bookings), or reach out to [Support](/support). Our support team will inspect the conversation and work evidence to issue a fair refund.`,
    providerAnswer: `🔄 **Cancellations & Dispute Guidelines for Providers**:

• Always communicate through SkillLink's in-app chat so there is clear record of agreements, deliverables, and timeline.
• If a client becomes unresponsive or requests work outside the agreed contract, you can contact [Support](/support) for mediation.
• Escrowed funds are protected and can only be cancelled after mutual agreement or admin review.`,
  },

  // ── 11. Provider Wallet & Withdrawals ─────────────────────────────────────
  {
    id: 'wallet_withdrawals',
    title: 'Wallet Earnings & Payouts',
    patterns: [
      /\b(withdraw|withdrawal|wallet|payout|payouts|cash\s*out|take\s+out\s+money)\b/i,
      /how\s+(do\s+i|to)\s+get\s+my\s+money/i,
      /when\s+do\s+i\s+get\s+paid/i,
    ],
    customerAnswer: `💼 **Customer Billing**:
You can track all your payments, invoices, and active escrow deposits securely under your [Bookings](/bookings) dashboard.`,
    providerAnswer: `💵 **Withdrawing Your Earnings**:

1. Go to your **[Wallet Dashboard](/wallet)**.
2. Once a client confirms job completion, your earnings (90% of contract price) are credited instantly to your **Available Balance**.
3. Click **Withdraw Funds**, enter the amount, and select your payout method (Telebirr, CBE Birr, or Commercial Bank account).
4. Withdrawal requests are processed quickly, usually within minutes to 24 hours depending on the banking network.`,
  },

  // ── 12. Reviews & Ratings ────────────────────────────────────────────────
  {
    id: 'reviews_ratings',
    title: 'Reviews & Feedback System',
    patterns: [
      /\b(review|reviews|rating|ratings|star|stars|feedback|testimonial)\b/i,
      /can\s+i\s+leave\s+a\s+review/i,
      /how\s+do\s+reviews\s+work/i,
    ],
    customerAnswer: `⭐ **Verified Reviews on SkillLink**:

• Only clients who have completed and paid for a booking through SkillLink can rate a provider.
• Once your job is completed, you will be prompted to leave a 1 to 5-star rating and written review.
• This ensures 100% authentic, tamper-proof reviews that reflect real client experiences.`,
    providerAnswer: `⭐ **Building Your Reputation**:

• Maintaining high ratings (4.5+ stars) and positive feedback boosts your visibility in search results.
• Every completed booking allows your client to leave a verified review.
• Always deliver high-quality work and communicate professionally to earn 5-star reviews!`,
  },

  // ── 13. In-App Chat & Direct Messaging ───────────────────────────────────
  {
    id: 'messaging_chat',
    title: 'In-App Direct Chat',
    patterns: [
      /\b(chat|message|messages|messaging|inbox)\b/i,
      /can\s+i\s+(talk\s+to|message)\s+(the\s+)?provider/i,
      /phone\s+number|call\s+provider/i,
    ],
    customerAnswer: `💬 **Direct In-App Messaging**:

• You can start a live chat with any provider directly from their profile before booking!
• Open your active conversations anytime under **[Messages](/messages)**.
• Use chat to discuss exact requirements, ask for previous examples, negotiate prices, and schedule dates.`,
    providerAnswer: `💬 **Client Messaging**:

• Check and reply to potential client inquiries promptly in your **[Messages Inbox](/messages)**.
• Fast response times significantly increase your chances of being hired.
• You can send custom proposals and negotiate terms right within the chat conversation!`,
  },

  // ── 14. Categories & Available Services ──────────────────────────────────
  {
    id: 'categories_overview',
    title: 'Categories & Services Offered',
    patterns: [
      /what\s+(services|categories|skills|trades|jobs)\s+(do\s+you\s+have|are\s+available|do\s+you\s+offer)/i,
      /list\s+of\s+categories/i,
      /what\s+can\s+i\s+hire/i,
    ],
    customerAnswer: `🛠️ **Top Service Categories on SkillLink**:

• **Home Services**: Plumbers, Electricians, Carpenters, Painters
• **Technology & IT**: Web Developers, Mobile App Developers, IT & Computer Repair
• **Design & Creative**: Graphic Designers, UI/UX Designers, Video Editors, Illustrators
• **Cleaning & Maintenance**: House Cleaners, Deep Cleaning, Office Cleaning, Laundry
• **Education & Tutoring**: Academic Tutors, Language Instructors, Music Teachers
• **Automotive**: Car Mechanics, Auto Electricians, Car Wash
• **Events & Media**: Event Planners, Photographers, Videographers, Decorators
• **Moving & Delivery**: Moving Services, Couriers, Delivery Personnel

You can explore all available providers under **[Browse All Services](/browse)**!`,
    providerAnswer: `🛠️ **Popular Categories on SkillLink**:

We have active client demand across:
• Home Improvement (Plumbing, Electrical, Carpentry, Painting)
• Software & Web Development
• Graphic Design & Creative Media
• Cleaning & Janitorial
• Moving & Transport
• Private Tutoring

Browse open jobs in your field under **[Find Open Jobs](/jobs)**!`,
  },

  // ── 15. Locations & Regional Coverage ─────────────────────────────────────
  {
    id: 'locations_coverage',
    title: 'Locations & Coverage',
    patterns: [
      /\b(location|locations|city|cities|area|areas)\b/i,
      /where\s+(are\s+you|is\s+skilllink|located|based|do\s+you\s+operate)/i,
      /\b(addis\s*ababa|bole|cmc|piassa|mexico|sarbet|kazanchis|ayat|gerji)\b/i,
      /\b(hawassa|bahir\s*dar|adama|dire\s*dawa|gondar|mekelle)\b/i,
    ],
    customerAnswer: `📍 **SkillLink Service Coverage**:

• **Addis Ababa**: Full coverage across all subcities including Bole, CMC, Kazanchis, Piassa, Mexico, Sarbet, Ayat, Yeka, and Kolfe.
• **Major Cities**: Growing network in Hawassa, Bahir Dar, Adama, Dire Dawa, and Gondar.
• **Remote / Online Services**: Software development, graphic design, tutoring, translation, and digital marketing are available nationwide and globally!`,
    providerAnswer: `📍 **Service Locations**:

You can accept local on-site jobs within your city (Addis Ababa, Hawassa, Adama, Bahir Dar, etc.) as well as remote digital projects that can be done from anywhere! Update your city in [Profile Settings](/profile).`,
  },
]

// ── Stopwords to prevent generic conversational words from skewing matches ──
export const STOPWORDS = new Set([
  'find', 'need', 'want', 'look', 'looking', 'hire', 'get', 'give', 'best', 'top',
  'good', 'please', 'help', 'service', 'services', 'provider', 'providers', 'worker',
  'workers', 'near', 'addis', 'ethiopia', 'show', 'tell', 'some', 'anyone', 'available',
  'for', 'and', 'the', 'with', 'from', 'that', 'this', 'have', 'about', 'into', 'what',
  'where', 'when', 'which', 'who', 'how', 'can', 'you', 'our', 'not', 'but', 'out', 'all',
  'any', 'now', 'one', 'two', 'via', 'per', 'very', 'much', 'more', 'also', 'just', 'there'
])

// ── Service & Category Synonym Dictionary ──────────────────────────────────
export const CATEGORY_SYNONYMS: Record<string, string[]> = {
  plumber: ['plumber', 'plumbing', 'pipe', 'pipes', 'leak', 'leaking', 'tap', 'faucet', 'toilet', 'drain', 'drainage', 'sink', 'water pipe'],
  electrician: ['electrician', 'electrical', 'wiring', 'fuse', 'breaker', 'socket', 'switch', 'generator'],
  carpenter: ['carpenter', 'carpentry', 'woodwork', 'furniture', 'cabinet', 'wardrobe', 'shelf', 'shelves'],
  painter: ['painter', 'painting', 'wall paint', 'house paint', 'repaint'],
  cleaner: ['cleaner', 'cleaning', 'housekeeper', 'maid', 'mop', 'janitor', 'janitorial', 'deep clean', 'laundry'],
  developer: ['software developer', 'web developer', 'developer', 'programmer', 'coding', 'website', 'frontend', 'backend', 'full stack', 'mobile app', 'web app', 'react', 'vue', 'node', 'laravel', 'python'],
  designer: ['designer', 'graphic designer', 'graphic design', 'graphics', 'logo', 'ui', 'ux', 'figma', 'photoshop', 'illustrator', 'banner', 'branding'],
  tutor: ['tutor', 'tutoring', 'teacher', 'math tutor', 'physics tutor', 'english tutor', 'language lessons', 'exam prep'],
  mechanic: ['mechanic', 'car repair', 'auto repair', 'car engine', 'brake repair', 'tire change'],
  carwash: ['car wash', 'auto wash', 'vehicle cleaning'],
  eventplanner: ['event planner', 'event planning', 'event decorator', 'event decoration', 'wedding planner', 'party planner', 'catering'],
  driver: ['delivery worker', 'moving service', 'courier', 'cargo transport'],
  photographer: ['photographer', 'videographer', 'drone operator', 'photoshoot', 'video editing'],
  beautician: ['hairdresser', 'barber', 'makeup artist', 'nail technician'],
}

/**
 * Normalizes query string to lowercase tokens excluding common stopwords
 */
export function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w))
}

/**
 * Checks if a search term matches within a text block with exact boundary awareness
 */
export function matchesTerm(text: string, term: string): boolean {
  if (term.includes(' ')) {
    return text.includes(term)
  }
  const regex = new RegExp(`\\b${term}\\b`, 'i')
  return regex.test(text)
}

/**
 * Matches user message against domain knowledge base
 */
export function findBestFaqMatch(message: string, isProvider: boolean): KnowledgeTopic | null {
  const cleanMsg = message.trim().toLowerCase()

  for (const topic of KNOWLEDGE_BASE) {
    for (const pattern of topic.patterns) {
      if (pattern.test(cleanMsg)) {
        return topic
      }
    }
  }

  // Secondary match: check if key questions are contained
  if (cleanMsg.includes('how does') || cleanMsg.includes('how to') || cleanMsg.includes('can i') || cleanMsg.includes('what is') || cleanMsg.includes('tell me about')) {
    if (cleanMsg.includes('pay') || cleanMsg.includes('telebirr') || cleanMsg.includes('cbe')) {
      return KNOWLEDGE_BASE.find(k => k.id === 'payment_methods') || null
    }
    if (cleanMsg.includes('escrow') || cleanMsg.includes('safe') || cleanMsg.includes('scam')) {
      return KNOWLEDGE_BASE.find(k => k.id === 'escrow_security') || null
    }
    if (cleanMsg.includes('fee') || cleanMsg.includes('commission') || cleanMsg.includes('cost')) {
      return KNOWLEDGE_BASE.find(k => k.id === 'platform_fees') || null
    }
    if (cleanMsg.includes('cancel') || cleanMsg.includes('refund')) {
      return KNOWLEDGE_BASE.find(k => k.id === 'cancellation_refunds') || null
    }
    if (cleanMsg.includes('bid') || cleanMsg.includes('offer') || cleanMsg.includes('proposal')) {
      return KNOWLEDGE_BASE.find(k => k.id === 'provider_bidding') || null
    }
    if (cleanMsg.includes('verify') || cleanMsg.includes('verification') || cleanMsg.includes('become')) {
      return KNOWLEDGE_BASE.find(k => k.id === 'provider_verification') || null
    }
    if (cleanMsg.includes('support') || cleanMsg.includes('contact') || cleanMsg.includes('help')) {
      return KNOWLEDGE_BASE.find(k => k.id === 'support_contact') || null
    }
    if (cleanMsg.includes('chat') || cleanMsg.includes('message')) {
      return KNOWLEDGE_BASE.find(k => k.id === 'messaging_chat') || null
    }
    if (cleanMsg.includes('review') || cleanMsg.includes('rating')) {
      return KNOWLEDGE_BASE.find(k => k.id === 'reviews_ratings') || null
    }
  }

  return null
}

/**
 * Determines if query specifically asks for provider recommendation
 */
export function isProviderSearchQuery(message: string): boolean {
  const q = message.toLowerCase()
  const searchTriggers = [
    /\b(find|search|look\s*for|need|want|recommend|hire|get\s*me|give\s*me)\b/i,
    /\b(who\s+is|who\s+are|best|top|verified)\s+(provider|providers|worker|freelancer)/i,
    /\b(plumber|electrician|carpenter|painter|cleaner|developer|programmer|designer|tutor|mechanic|photographer|cook|barber|tailor)\b/i,
  ]
  return searchTriggers.some(t => t.test(q))
}

/**
 * Determines if a provider is searching for jobs
 */
export function isJobSearchQuery(message: string): boolean {
  const q = message.toLowerCase()
  const jobTriggers = [
    /\b(show\s+me\s+jobs|find\s+work|latest\s+jobs|high\s+budget|open\s+jobs)\b/i,
    /\b(jobs\s+in|work\s+in|projects\s+for)\b/i,
  ]
  return jobTriggers.some(t => t.test(q))
}

/**
 * Accurately scores and filters providers based on the user's specific request.
 * CRITICAL: Only returns providers who ACTUALLY match the query keywords or requested skill!
 */
export function scoreAndFilterProviders(query: string, rawProviders: any[], userCity?: string | null): any[] {
  const q = query.toLowerCase()
  const queryWords = extractKeywords(q)

  // Expand query words with synonyms
  const expandedQuery = new Set<string>(queryWords)
  for (const [key, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
    if (synonyms.some(s => q.includes(s)) || q.includes(key)) {
      expandedQuery.add(key)
      synonyms.forEach(s => expandedQuery.add(s))
    }
  }

  const scored: Array<{ provider: any; relevanceScore: number }> = []

  for (const p of rawProviders) {
    let relevanceScore = 0

    const name = (p.name || '').toLowerCase()
    const title = (p.title || '').toLowerCase()
    const bio = (p.bio || '').toLowerCase()
    const city = (p.city || '').toLowerCase()
    const servicesText = (p.services || [])
      .map((s: any) => `${s.title} ${s.category}`)
      .join(' ')
      .toLowerCase()

    // Title match: highest weight (+10)
    for (const term of expandedQuery) {
      if (matchesTerm(title, term)) relevanceScore += 10
      if (matchesTerm(servicesText, term)) relevanceScore += 8
      if (matchesTerm(name, term)) relevanceScore += 5
    }

    // Boost if user specifies city and provider is in that city
    if (userCity && matchesTerm(city, userCity.toLowerCase())) {
      relevanceScore += 2
    }

    // Require high confidence threshold (must match title, services, or multiple keywords)
    if (relevanceScore >= 8) {
      const qualityBoost = Number(p.rating || 5) * 0.5 + Math.min(Number(p.completed_jobs || 0), 20) * 0.1
      scored.push({ provider: p, relevanceScore: relevanceScore + qualityBoost })
    }
  }

  scored.sort((a, b) => b.relevanceScore - a.relevanceScore)
  return scored.slice(0, 4).map(s => s.provider)
}

/**
 * Accurately scores and filters open jobs for providers
 */
export function scoreAndFilterJobs(query: string, rawJobs: any[], userCity?: string | null): any[] {
  const q = query.toLowerCase()
  const queryWords = extractKeywords(q)

  const wantsHighBudget = /high\s+budget|expensive|well\s+paid|best\s+paying/i.test(q)
  const wantsLatest = /latest|new|recent|fresh/i.test(q)

  // Expand with synonyms
  const expandedQuery = new Set<string>(queryWords)
  for (const [key, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
    if (synonyms.some(s => q.includes(s)) || q.includes(key)) {
      expandedQuery.add(key)
      synonyms.forEach(s => expandedQuery.add(s))
    }
  }

  const scored: Array<{ job: any; score: number }> = []

  for (const j of rawJobs) {
    let score = 0
    const title = (j.title || '').toLowerCase()
    const desc = (j.description || '').toLowerCase()
    const cat = (j.category?.name || '').toLowerCase()
    const location = (j.location || '').toLowerCase()
    const budget = Number(j.budget || 0)

    for (const term of expandedQuery) {
      if (matchesTerm(title, term)) score += 10
      if (matchesTerm(cat, term)) score += 8
    }

    if (wantsHighBudget) {
      score += Math.min(budget * 0.002, 20)
    }

    if (wantsLatest) {
      score += 5
    }

    // Only include if relevant or if asking for general/latest/high budget jobs
    const isGeneralJobRequest = wantsHighBudget || wantsLatest || /open\s+jobs|browse|work/i.test(q)
    if (score >= 8 || (isGeneralJobRequest && budget > 0)) {
      scored.push({ job: j, score })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, 4).map(s => s.job)
}
