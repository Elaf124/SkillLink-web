/**
 * server/utils/aiEngine.ts
 *
 * Comprehensive Domain-Trained AI Knowledge Base & Semantic Engine for SkillLink Ethiopia.
 * Covers in-depth market pricing in ETB, step-by-step payment guides (Telebirr, CBE Birr, Chapa),
 * milestone workflows, provider onboarding, withdrawal rules, dispute mediation, and strict trade matching.
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
    customerAnswer: `👋 **Selam! I am SkillLink AI**, your 24/7 personal assistant for Ethiopia's premier freelance and service marketplace.

Here is what I can do for you:
• **Find Verified Providers**: Tell me what service you need (e.g., *"Find a plumber in Addis"*, *"Looking for a graphic designer"*).
• **Market Pricing in ETB**: Ask *"How much does plumbing cost?"* or *"What are standard developer rates?"*.
• **Payment & Escrow Protection**: Learn how your money is 100% protected with Telebirr, CBE Birr, or Chapa.
• **Post an Open Job**: Need custom bids? I will guide you to [Post an Open Job](/jobs/post).
• **Platform Guidance**: Ask about fees, cancellations, safety, or provider verification.

What would you like help with today?`,
    providerAnswer: `👋 **Selam! I am SkillLink AI**, your assistant to help grow your service business in Ethiopia.

Here is what I can help you with:
• **Find Open Client Jobs**: Ask me for jobs in your skill (e.g., *"Show me web development jobs"*, *"High budget jobs"*).
• **Bidding & Winning Proposals**: Learn how to write winning offers and set project milestones.
• **Wallet & Withdrawals**: Learn how to cash out your earnings via Telebirr, CBE Birr, or Bank.
• **Pricing & Rates**: Check market standards for your trade in ETB.
• **Account & Verification**: Learn how to get your verified badge with your Kebele ID.

What are you looking to do today?`,
  },

  // ── 2. Market Pricing Guide in Ethiopia (ETB) ─────────────────────────────
  {
    id: 'pricing_market_guide',
    title: 'Market Pricing Guide in ETB',
    patterns: [
      /\b(average|standard|typical|market)\s+(price|prices|rate|rates|cost|costs)\b/i,
      /how\s+much\s+(does|do|should)\s+(plumbing|electrician|cleaning|developer|designer|carpenter|tutor|mechanic)\s+cost/i,
      /price\s+(range|guide|list|rates)/i,
      /standard\s+rates/i,
    ],
    customerAnswer: `📊 **Standard Service Market Rates in Addis Ababa (ETB)**:

Here is the realistic market pricing breakdown for verified services on SkillLink:

| Service Category | Typical Rate (ETB) | Pricing Model |
| :--- | :--- | :--- |
| **Plumbing** (leak, tap, toilet repair) | 400 – 1,500 ETB | Fixed per job or ~400 ETB/hr |
| **Electrical** (breaker diagnostics, wiring) | 500 – 3,500 ETB | Fixed or ~500 ETB/hr |
| **House Cleaning** (1–3 bedroom deep clean) | 1,200 – 3,500 ETB | Fixed per session |
| **Web & App Development** | 15,000 – 60,000+ ETB | Milestone / Project basis |
| **Graphic Design & Logos** | 2,500 – 10,000 ETB | Fixed package |
| **Carpentry & Furniture** (wardrobes, cabinets) | 8,000 – 25,000 ETB | Fixed custom build |
| **Academic Tutoring** (Grade 11/12, Math, SAT) | 300 – 600 ETB / hour | Hourly |
| **Auto Mechanic Diagnostics & Brakes** | 600 – 2,500 ETB | Fixed labor cost |

💡 *Tip: You can discuss and negotiate the exact price in [Direct Messages](/messages) before accepting an offer!*`,
    providerAnswer: `📊 **Recommended Pricing Standards for Providers (ETB)**:

Setting competitive, transparent rates increases your acceptance rate by over 60%:
• **Hourly Trades**: Plumbers (~450 ETB/hr), Electricians (~500 ETB/hr), Tutors (~350–500 ETB/hr).
• **Fixed Packages**: House cleaning (1,500–2,500 ETB), Logo design (4,000–8,000 ETB), Custom websites (18,000–45,000 ETB).
• **10% Platform Fee**: Remember that SkillLink charges a flat 10% on completed bookings (e.g. for a 5,000 ETB job, you receive 4,500 ETB in your wallet).`,
  },

  // ── 3. Step-by-Step Payment Methods Guide ──────────────────────────────────
  {
    id: 'payment_methods_detailed',
    title: 'Payment Methods & How to Pay',
    patterns: [
      /\b(telebirr|cbe|cbe\s*birr|chapa|bank\s*transfer|how\s+to\s+pay|payment\s+methods)\b/i,
      /can\s+i\s+pay\s+with/i,
      /step\s+by\s+step\s+pay/i,
    ],
    customerAnswer: `💳 **Accepted Payment Methods & Step-by-Step Guide**:

SkillLink supports Ethiopia's trusted payment gateways:

1. **Telebirr**:
   • Select Telebirr at checkout.
   • Enter your registered 09... phone number.
   • You will receive a USSD push notification on your mobile phone or can scan the SuperApp QR code.
   • Enter your Telebirr 4-digit PIN to confirm. Escrow is credited instantly!
2. **CBE Birr & Commercial Bank of Ethiopia (CBE)**:
   • Pay directly via CBE Mobile Banking or CBE Birr USSD (*847#).
   • Instant confirmation locks your funds in escrow safely.
3. **Chapa Gateway**:
   • Accepts local Ethiopian debit/ATM cards (Awash, Dashen, Nib, Zemen, etc.) and international Visa/Mastercard cards.

⚠️ **Safety Rule**: Never pay providers directly in cash or off-platform. Cash payments forfeit 100% of your escrow and fraud protection.`,
    providerAnswer: `💳 **Withdrawing Your Payouts**:

Once a customer confirms job completion:
• Funds appear instantly in your **Available Wallet Balance**.
• Payouts can be transferred to **Telebirr** (within minutes), **CBE Birr**, or your **Commercial Bank account** (same day).
• Add or edit your account numbers under [Payout Methods](/payouts).`,
  },

  // ── 4. Escrow & Safety Protection ─────────────────────────────────────────
  {
    id: 'escrow_security',
    title: 'Escrow Protection & Payment Security',
    patterns: [
      /\b(escrow|safe|safety|scam|scams|fraud|protect|protection|secure|security|guarantee)\b/i,
      /is\s+my\s+money\s+safe/i,
      /what\s+if\s+(i\s+get\s+scammed|provider\s+steals|they\s+don'?t\s+do\s+the\s+job)/i,
    ],
    customerAnswer: `🛡️ **100% Escrow Protection on SkillLink**:

Your money is completely safe throughout every booking:
• **Funds Locked in Trust**: When you accept an offer, your payment goes into an escrow vault. The provider CANNOT access it yet.
• **Paid ONLY Upon Your Approval**: Funds are released to the provider only when you click "Confirm & Complete".
• **Dispute Protection**: If a provider does not show up, abandons the job, or does poor work, you can open a dispute. Our admin team will inspect the case and issue a full or partial refund.
• **Zero Financial Risk**: You never pay upfront for unverified work.`,
    providerAnswer: `🛡️ **Payment Security for Providers**:

• **Guaranteed Escrow**: You never start work without proof of client funding. The client's budget is locked in escrow before you begin.
• **No Stolen Work**: As long as you submit deliverables through SkillLink chat and milestones, our admin team guarantees your payout even if a client becomes unresponsive.`,
  },

  // ── 5. Platform Fees & Commission ─────────────────────────────────────────
  {
    id: 'platform_fees',
    title: 'Platform Fees & Pricing Structure',
    patterns: [
      /\b(fee|fees|commission|percentage|cut|charge|charges|cost|costs|pricing)\b/i,
      /how\s+much\s+(does\s+it\s+cost|do\s+you\s+charge|is\s+the\s+fee)/i,
      /10\s*%/i,
    ],
    customerAnswer: `💰 **Pricing Structure for Customers**:
• **100% Free**: It costs zero ETB to search providers, chat, or post jobs.
• **No Hidden Markups**: You pay only the agreed contract price shown on the provider's quote.
• **Escrow is Free**: Platform escrow protection is included at no extra charge.`,
    providerAnswer: `💰 **Platform Fee for Providers**:
• SkillLink charges a flat **10% platform fee** deducted automatically when a client approves completed work.
• **You keep 90%**: On a **10,000 ETB** job, you receive **9,000 ETB** in your wallet.
• SkillLink's 10% fee covers escrow infrastructure, payment gateway processing, verified badges, and client dispute resolution.
• There are no monthly subscriptions or fees to submit offers!`,
  },

  // ── 6. Fixed Price vs Hourly Rates ────────────────────────────────────────
  {
    id: 'pricing_models',
    title: 'Fixed Price vs. Hourly Rates',
    patterns: [
      /\b(fixed|hourly|milestone|milestones|price\s+type)\b/i,
      /difference\s+between\s+(fixed|hourly)/i,
      /should\s+i\s+choose\s+fixed\s+or\s+hourly/i,
    ],
    customerAnswer: `⏱️ **Fixed Price vs. Hourly Rates**:

• **Fixed Price (Recommended for defined projects)**:
  - Best for: Painting a room, fixing a leaking pipe, cleaning an apartment, designing a logo.
  - You agree on the total price upfront in ETB. You know the exact cost before starting.
• **Hourly Rate (Recommended for open-ended work)**:
  - Best for: Tutoring, software consultation, extensive electrical troubleshooting.
  - The provider logs hours, and payment is calculated based on approved time logged.`,
    providerAnswer: `⏱️ **Setting Your Pricing Model**:

You can offer both Fixed and Hourly services under your profile:
• Set fixed prices for standard catalog services (e.g. *"OBD2 Car Diagnostic — 600 ETB"*).
• Set hourly rates for consultative services (e.g. *"Senior Math Tutoring — 400 ETB/hr"*).`,
  },

  // ── 7. How to Post a Job & Receive Bids ────────────────────────────────────
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

If you want multiple providers to bid with competitive offers:
1. Go to **[Post an Open Job](/jobs/post)**.
2. Enter a clear title (e.g., *"Emergency bathroom pipe leak repair in Bole"*).
3. Select your **Category** (e.g. *Home Services > Plumber*) and **Location / Subcity**.
4. Set your budget in **ETB** (e.g. 1,500 ETB) and desired completion date.
5. Click **Publish Job**! Verified providers will be notified immediately and submit custom proposals with their price and timeline.`,
    providerAnswer: `💼 **Finding & Bidding on Jobs**:

Clients post new projects across Addis Ababa daily. You can review all active jobs and submit proposals here:
👉 **[Browse Open Jobs](/jobs)**

Tips for winning proposals:
• Submit offers quickly when a job is posted.
• Outline your relevant experience and similar projects in your proposal message.
• Offer a fair, competitive rate in ETB.`,
  },

  // ── 8. Bidding & Proposals for Providers ──────────────────────────────────
  {
    id: 'provider_bidding',
    title: 'Bidding & Submitting Winning Proposals',
    patterns: [
      /how\s+(to|do\s+i)\s+(bid|send\s+offer|make\s+offer|submit\s+offer|submit\s+proposal|win\s+jobs)/i,
      /\b(bid|bidding|proposal|proposals)\b/i,
    ],
    customerAnswer: `💼 **Reviewing Provider Bids**:

When you post an open job, verified providers submit custom proposals with their price, completion days, and portfolio. You can review their profiles, check past ratings, and chat with them in [Messages](/messages) before accepting!`,
    providerAnswer: `🎯 **How to Bid & Win Jobs on SkillLink**:

1. **Browse Open Jobs**: Head to **[Find Open Jobs](/jobs)** to view active client requests.
2. **Review Scope**: Click on a job to check the requirements, location, and client budget.
3. **Submit Your Custom Offer**:
   • Enter your **Price (ETB)** and **Estimated Days** to complete.
   • Write a professional cover pitch explaining why you are the best fit.
4. **Negotiate in Chat**: The client can message you directly on SkillLink to clarify details.
5. **Start Work After Escrow Funding**: Once the client accepts your offer, the payment is locked in escrow and you can start!`,
  },

  // ── 9. Provider Onboarding & Verification ─────────────────────────────────
  {
    id: 'provider_verification',
    title: 'Provider Registration & Verification (Kebele ID)',
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
• **Identity Document**: Providers must submit their valid Kebele ID, Ethiopian National ID (Fayda), or Passport.
• **Skill & Credential Check**: Relevant trade certifications or professional references are examined.
• Look for the **Verified Badge** on provider profiles to hire with complete confidence.`,
    providerAnswer: `🚀 **How to Become a Verified Provider**:

1. Register an account and select the **Service Provider** role.
2. Complete your profile under [Provider Profile](/profile): add your professional title, hourly/fixed services, and past work portfolio.
3. Submit verification documents under **Verification**: upload a clear photo of your **Kebele ID, Ethiopian Passport, or Business License**.
4. Our administration team typically reviews and verifies documents within **24 to 48 hours**. Once approved, your profile receives the Verified badge and you can start taking bookings!`,
  },

  // ── 10. Cancellations, Refunds & Disputes ─────────────────────────────────
  {
    id: 'cancellation_refunds',
    title: 'Cancellations, Refunds & Disputes',
    patterns: [
      /\b(cancel|cancellation|refund|refunds|money\s+back|dispute|disputes)\b/i,
      /what\s+if\s+(provider\s+doesn'?t\s+show|work\s+is\s+bad|job\s+is\s+not\s+done)/i,
      /how\s+do\s+i\s+cancel/i,
    ],
    customerAnswer: `🔄 **Cancellation & Refund Policy**:

• **Before Work Starts**: If you or the provider cancel before work has started, your escrow deposit is **100% refunded** immediately back to your wallet or original payment account.
• **During Work / Quality Issues**: If a provider fails to perform the work or provides unsatisfactory results, do **NOT** click "Confirm Complete".
• **Open a Dispute**: Click "Open Dispute" on your [Bookings Page](/bookings), or contact [Support](/support). Our support team will inspect the chat and deliverables to issue a full or partial refund within 24 hours.`,
    providerAnswer: `🔄 **Cancellations & Dispute Guidelines for Providers**:

• Always communicate through SkillLink's in-app chat so there is a documented record of agreements and deliverables.
• If a client requests work outside the contract without additional payment, contact [Support](/support) for mediation.
• Escrowed funds are protected and can only be refunded upon mutual agreement or official admin arbitration.`,
  },

  // ── 11. Provider Wallet & Withdrawals ─────────────────────────────────────
  {
    id: 'wallet_withdrawals',
    title: 'Wallet Earnings & Withdrawals',
    patterns: [
      /\b(withdraw|withdrawal|wallet|payout|payouts|cash\s*out|take\s+out\s+money)\b/i,
      /how\s+(do\s+i|to)\s+get\s+my\s+money/i,
      /when\s+do\s+i\s+get\s+paid/i,
      /minimum\s+withdrawal/i,
    ],
    customerAnswer: `💼 **Customer Invoices & Billing**:
You can track all your payments, invoices, and active escrow deposits securely under your [Bookings](/bookings) dashboard.`,
    providerAnswer: `💵 **Withdrawing Your Earnings**:

1. Go to your **[Wallet Dashboard](/wallet)**.
2. Once a client confirms job completion, your earnings (90% of contract value) are credited instantly to your **Available Balance**.
3. Click **Withdraw Funds**, enter the amount (minimum withdrawal is **50 ETB**), and select your payout method:
   • **Telebirr**: Fast mobile wallet payout (usually 15–30 minutes).
   • **CBE Birr**: Direct mobile bank transfer.
   • **Bank Account**: Commercial Bank of Ethiopia (CBE), Awash, or Dashen bank transfer.
4. There is 0 withdrawal fee charged by SkillLink!`,
  },

  // ── 12. In-App Chat & Direct Messaging ───────────────────────────────────
  {
    id: 'messaging_chat',
    title: 'In-App Direct Chat & Negotiation',
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

  // ── 13. Categories & Available Services ──────────────────────────────────
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

Explore all verified providers under **[Browse All Services](/browse)**!`,
    providerAnswer: `🛠️ **Popular Categories on SkillLink**:

Active client demand across:
• Home Improvement (Plumbing, Electrical, Carpentry, Painting)
• Software & Web Development
• Graphic Design & Creative Media
• Cleaning & Janitorial
• Moving & Transport
• Private Tutoring

Browse open jobs in your field under **[Find Open Jobs](/jobs)**!`,
  },

  // ── 14. Locations & Regional Coverage ─────────────────────────────────────
  {
    id: 'locations_coverage',
    title: 'Locations & Regional Coverage',
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

  // ── 15. Customer Support & Assistance ─────────────────────────────────────
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
      return KNOWLEDGE_BASE.find(k => k.id === 'payment_methods_detailed') || null
    }
    if (cleanMsg.includes('price') || cleanMsg.includes('rate') || cleanMsg.includes('cost')) {
      return KNOWLEDGE_BASE.find(k => k.id === 'pricing_market_guide') || null
    }
    if (cleanMsg.includes('escrow') || cleanMsg.includes('safe') || cleanMsg.includes('scam')) {
      return KNOWLEDGE_BASE.find(k => k.id === 'escrow_security') || null
    }
    if (cleanMsg.includes('fee') || cleanMsg.includes('commission')) {
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
