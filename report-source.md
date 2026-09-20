# Methodology for SkillLink Web Platform

**Audience:** Project report assessor

**Date:** 8 September 2026

## Scope

This methodology describes how I designed, developed, integrated, and tested the SkillLink web platform. It covers the Nuxt frontend, Laravel API, MySQL database, role-specific workflows, file storage, and the simulated payment and escrow process. It does not claim that SkillLink processes real payments; Telebirr, CBE Birr, and Chapa flows remain simulations in this project version.

## Development approach

I used an iterative development approach. I divided the system into small functional increments, beginning with identity and profiles, then marketplace workflows, booking and payment states, communication, and administration. After each increment, I connected the user interface to the API, checked its database behaviour, and corrected navigation, validation, and presentation issues before proceeding. This reflects Scrum's emphasis on inspection and adaptation rather than treating development as a single fixed sequence. [Scrum Guide](https://scrumguides.org/scrum-guide.html)

## Requirements analysis and workflow modelling

I identified four main roles: customer, provider, support administrator, and finance administrator. For each role, I mapped the actions the person needed to perform and the information they needed to see. These workflows covered registration, provider verification, service publishing, job posting, offers, bookings, payment, escrow release, reviews, messages, favourites, notifications, disputes, payout methods, and administration.

## System design

The platform was designed as a separated frontend and backend application. Nuxt and Vue provide the browser interface, while Laravel exposes REST API endpoints and MySQL stores persistent data. Route middleware protects role-specific frontend pages, and Laravel middleware protects API endpoints. Nuxt documents route middleware as code that runs before navigation, which supports the protected-page design used in the project. [Nuxt route middleware documentation](https://nuxt.com/docs/4.x/directory-structure/app/middleware)

## Database and backend development

I used Laravel migrations to define the database structure and Eloquent models to represent entity relationships. These relationships connect users to customer or provider profiles, providers to skills, availability and portfolios, customers to jobs and favourites, and bookings to offers, reviews, payments, milestones, time logs, disputes, messages, and notifications.

Laravel controllers and API routes were created for creating, reading, updating, and deleting data. Input validation was applied before records were stored. Protected operations require authentication and the correct role. Files such as portfolio images, job attachments, and verification documents are uploaded to server storage and their paths are saved in the database.

## Frontend development

I developed the frontend with Nuxt, Vue, and Tailwind CSS. The pages were organized around role-specific dashboards and reusable components. The user interface communicates with Laravel through API requests and displays loading, success, empty, and error states. Nuxt provides built-in data-fetching utilities and client-side request patterns that support this frontend-to-API connection. [Nuxt data fetching documentation](https://nuxt.com/docs/4.x/getting-started/data-fetching)

I also applied responsive layouts so the application can be used on desktop and smaller screens. Navigation, role restrictions, dashboard panels, provider listings, account settings, portfolio management, messages, notifications, finance pages, and support pages were reviewed and refined during implementation.

## Payment and escrow simulation

The payment workflow is implemented as a simulation. A customer chooses a simulated payment method, confirms a payment, and the system records a payment state. The amount is then represented as held in escrow until the booking or approved milestone is completed. A provider payout is also simulated after release. No customer wallet balance or real Telebirr, CBE Birr, or Chapa transaction is used in this version.

The simulation follows the intended production control flow: create a pending payment, confirm it, hold it in escrow, and release or refund it based on booking outcomes. A future real gateway integration would need the backend to verify payment callbacks or webhooks before updating the payment status. Chapa's official documentation similarly states that a backend should verify the final transaction state rather than trusting the frontend callback alone. [Chapa payment integration documentation](https://developer.chapa.co/integrations/accept-payments)

## Testing and quality assurance

I used a combination of manual and technical testing. I tested form validation, API route responses, role access restrictions, relationship persistence, file upload paths, navigation, dashboard actions, and end-to-end workflows such as job posting, offers, bookings, payment simulation, and escrow release. I also ran PHP syntax checks on Laravel controllers and production builds on the Nuxt frontend.

Security testing focused on authentication, authorization, protected routes, role access, input validation, and business workflow rules. These categories are consistent with the OWASP Web Security Testing Guide, which includes identity, authentication, authorization, input validation, business logic, client-side, and API testing. [OWASP Web Security Testing Guide](https://wstg.owasp.org/latest/2-Introduction/)

## Limitations

The current payment and withdrawal processes are simulated, so no real money is transferred. Live gateway integration would require merchant onboarding, gateway credentials, secure callback or webhook verification, reconciliation, and production security review. The project therefore demonstrates the expected data flow and user experience without presenting the simulation as a live financial service.

## Sources consulted

- The Scrum Guide, Ken Schwaber and Jeff Sutherland, November 2020. https://scrumguides.org/scrum-guide.html
- Nuxt route middleware documentation, Nuxt. https://nuxt.com/docs/4.x/directory-structure/app/middleware
- Nuxt data fetching documentation, Nuxt. https://nuxt.com/docs/4.x/getting-started/data-fetching
- Chapa payment integration documentation, Chapa. https://developer.chapa.co/integrations/accept-payments
- OWASP Web Security Testing Guide, OWASP Foundation. https://wstg.owasp.org/latest/2-Introduction/
