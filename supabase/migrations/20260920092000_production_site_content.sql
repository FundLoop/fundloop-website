-- Public site content for environments that never run supabase/seed.sql.
-- FundLoop Dev is the only copy of the blog, support articles and team roles, so a freshly
-- migrated database (FundLoop Prod) would render those pages empty. Author references are
-- dropped; timestamps other than published_at fall back to column defaults.
-- Idempotent: ON CONFLICT DO NOTHING, existing rows are never overwritten.

-- blog_posts.author_id is a legacy column: NOT NULL, defaulting to user id 1, referencing
-- users(id). No application code reads it, and pinning content to a per-environment user id
-- makes the blog impossible to seed elsewhere. Allow authorless posts.
ALTER TABLE public.blog_posts ALTER COLUMN author_id DROP DEFAULT;
ALTER TABLE public.blog_posts ALTER COLUMN author_id DROP NOT NULL;

INSERT INTO public.team_roles (id, title, description, required_skills, location, tags) VALUES (1, 'Chief Technology Officer (CTO)', 'Leads the technical vision of FundLoop, overseeing architecture, infrastructure, and engineering leadership. Defines the roadmap and ensures scalability, security, and maintainability.', ARRAY['TypeScript', 'PostgreSQL', 'Next.js', 'Supabase', 'Distributed Systems', 'Security']::text[], 'Remote', ARRAY['leadership', 'engineering', 'core']::text[])
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.team_roles (id, title, description, required_skills, location, tags) VALUES (2, 'Head of Product', 'Responsible for defining product vision, gathering requirements, prioritizing features, and ensuring user feedback drives continuous iteration. Works closely with design and engineering.', ARRAY['Agile', 'Figma', 'User Research', 'Product Management', 'Data Analysis']::text[], 'Remote', ARRAY['product', 'strategy']::text[])
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.team_roles (id, title, description, required_skills, location, tags) VALUES (3, 'Lead Smart Contract Engineer', 'Designs, writes, and audits core smart contracts, particularly for fund management, staking, and identity. Ensures secure, upgradeable architecture.', ARRAY['Solidity', 'Hardhat', 'EVM', 'ERC20/ERC721/ERC1155', 'Auditing']::text[], 'Remote', ARRAY['engineering', 'blockchain', 'smart-contracts']::text[])
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.team_roles (id, title, description, required_skills, location, tags) VALUES (4, 'Full Stack Engineer', 'Builds user-facing and backend features, integrates smart contracts, and supports the application’s evolution.', ARRAY['Next.js', 'TailwindCSS', 'TypeScript', 'Supabase', 'tRPC', 'Prisma']::text[], 'Remote', ARRAY['engineering', 'frontend', 'backend']::text[])
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.team_roles (id, title, description, required_skills, location, tags) VALUES (5, 'DevOps & Security Engineer', 'Manages CI/CD pipelines, infrastructure (Vercel, Supabase, GCP), monitoring, and data security protocols.', ARRAY['CI/CD', 'Docker', 'Vercel', 'Supabase', 'Cloudflare', 'OAuth', 'RLS']::text[], 'Remote', ARRAY['engineering', 'devops', 'security']::text[])
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.team_roles (id, title, description, required_skills, location, tags) VALUES (6, 'Protocol Designer', 'Defines economic and governance mechanisms, including incentives, reputation, UBI, and payout formulas.', ARRAY['Game Theory', 'Mechanism Design', 'Crypto-economics', 'Math Modeling']::text[], 'Remote', ARRAY['governance', 'economics', 'protocol']::text[])
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.team_roles (id, title, description, required_skills, location, tags) VALUES (7, 'Community Manager', 'Builds and nurtures FundLoop’s early adopter community. Manages Discord/Telegram, events, and onboarding guides.', ARRAY['Community Building', 'Social Media', 'Writing', 'Public Speaking']::text[], 'Remote', ARRAY['community', 'support', 'growth']::text[])
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.team_roles (id, title, description, required_skills, location, tags) VALUES (8, 'Head of Partnerships', 'Owns relationships with funders, DAOs, NGOs, and other public goods ecosystems. Develops win-win partnership models.', ARRAY['Partnerships', 'Negotiation', 'Ecosystem Strategy', 'Web3 Landscape']::text[], 'Remote', ARRAY['business', 'growth', 'strategy']::text[])
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.team_roles (id, title, description, required_skills, location, tags) VALUES (9, 'UI/UX Designer', 'Designs intuitive, accessible, and beautiful interfaces for the FundLoop app. Translates complex flows into simple visuals.', ARRAY['Figma', 'User Flows', 'Accessibility', 'Responsive Design']::text[], 'Remote', ARRAY['design', 'product', 'ux']::text[])
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.team_roles (id, title, description, required_skills, location, tags) VALUES (10, 'Growth & Marketing Lead', 'Leads go-to-market strategy, brand positioning, social campaigns, SEO/SEM, and user acquisition.', ARRAY['Growth Marketing', 'Content Strategy', 'Analytics', 'SEO', 'Twitter/X']::text[], 'Remote', ARRAY['marketing', 'growth', 'comms']::text[])
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.team_roles (id, title, description, required_skills, location, tags) VALUES (11, 'Ecosystem Researcher', 'Surfaces opportunities and competitive intelligence. Tracks innovations in public goods, crypto, and adjacent ecosystems.', ARRAY['Research', 'Writing', 'Data Analysis', 'Web3 Landscape']::text[], 'Remote', ARRAY['research', 'strategy', 'intel']::text[])
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.team_roles (id, title, description, required_skills, location, tags) VALUES (12, 'Technical Writer & Docs Lead', 'Owns and maintains all user and developer documentation, SDK walkthroughs, and onboarding content.', ARRAY['Markdown', 'Docsify', 'GitBook', 'APIs', 'Communication']::text[], 'Remote', ARRAY['writing', 'developer-relations', 'docs']::text[])
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.team_roles (id, title, description, required_skills, location, tags) VALUES (13, 'Customer Success Lead', 'Ensures our users (creators, donors, contributors) have a seamless onboarding and support experience.', ARRAY['Support', 'CRM', 'Onboarding Design', 'Problem Solving']::text[], 'Remote', ARRAY['support', 'community', 'growth']::text[])
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.team_roles (id, title, description, required_skills, location, tags) VALUES (14, 'Operations Manager', 'Manages the internal processes, compliance, finances, OKRs, and daily rhythm of the organization.', ARRAY['Operations', 'Project Management', 'Compliance', 'Finance']::text[], 'Remote', ARRAY['ops', 'strategy', 'admin']::text[])
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.blog_posts (id, title, subtitle, slug, excerpt, content, picture, category, is_support, sort_order_within_category, published_at, author_id) VALUES (1, 'Introducing FundLoop: A New Economic Model for Digital Communities', 'Built for humans, powered by projects, designed for a future beyond work', 'introducing-fundloop', 'FundLoop reimagines how we value participation in the digital world. In an age of AI, it’s a system that rewards real people, supports mission-driven projects, and keeps the loop of mutual prosperity flowing.', 'The digital world is changing fast. AI is getting smarter, bots are everywhere, and the line between user and product is blurrier than ever. But what if we flipped the model? What if people got paid—not just platforms?

**Enter FundLoop.**

## Good for People

FundLoop pays verified humans for being active, conscious participants in aligned apps. It’s not a job, it’s not a hustle—it’s a new form of income for showing up with purpose in a system that sees your value.

## Good for Projects and Founders

Projects pledge 1% of their revenue to FundLoop and gain access to a growing pool of real, engaged users. It solves the cold start problem, reduces dependency on extractive growth tactics, and shows the world what you stand for.

## Good for the Ecosystem—and the Future

FundLoop keeps the loop alive. Value flows from projects to people and back again, funding public goods and sustaining the digital commons. In a world increasingly run by machines, it keeps humans in the loop—and rewards them for it.

---

**This isn’t just another protocol. It’s a new economy for digital life. And it starts with you.**', 'https://kyxtqnfnksvcaugxwzuj.supabase.co/storage/v1/object/public/blog-pics//blogpic.jpg', NULL, false, NULL, '2025-03-24 05:45:03.955026+00', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.blog_posts (id, title, subtitle, slug, excerpt, content, picture, category, is_support, sort_order_within_category, published_at, author_id) VALUES (2, 'Why Projects Are Joining the 1% Pledge Movement', 'A simple commitment that powers a regenerative future', 'why-projects-joining-pledge', 'The 1% Pledge is more than a contribution—it''s a signal. Projects that join FundLoop aren’t just building apps; they’re building the foundation of a fairer digital economy.', 'Across the digital landscape, a quiet movement is gaining momentum. Projects big and small are committing 1% of their revenue to FundLoop—a shared economic loop that funds citizen salaries and supports public goods.

Why are they doing it?

Because they see what’s coming.

## It’s Not Just a Contribution—It’s a Commitment

The 1% pledge says: *we care about the people who use our tools*. It turns passive users into active citizens, and app engagement into shared prosperity.

## It Solves the Cold Start Problem

FundLoop helps you attract early users by compensating them for showing up. Instead of throwing money at ads, you build with people who are aligned, curious, and ready to explore.

## It Aligns You with a Movement

The 1% badge shows your values. It says you''re part of something bigger—an economy where giving back isn’t an afterthought, it’s built into the model.

## It’s the Future of Funding

Public goods need fuel. FundLoop channels recurring micro-contributions into lasting impact. And your project gets to help shape the flow.

---

**Join the 1% Pledge. Not just because it works—but because it matters.**', 'https://kyxtqnfnksvcaugxwzuj.supabase.co/storage/v1/object/public/blog-pics//blogpic.jpg', NULL, false, NULL, '2025-03-31 05:45:03.955026+00', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.blog_posts (id, title, subtitle, slug, excerpt, content, picture, category, is_support, sort_order_within_category, published_at, author_id) VALUES (3, 'The Math Behind FundLoop''s Citizen Salaries', 'How your participation turns into monthly income and shared prosperity', 'math-behind-citizen-salaries', 'FundLoop distributes value fairly and transparently. Whether you''re a user or a project, here’s how citizen salaries are calculated—and how your choices shape what you give or receive.', 'In FundLoop, value flows in a continuous cycle between projects and people. Each month, participating projects contribute 1% of their revenue. These funds are then distributed as **citizen salaries** to active, verified users. But how does that distribution actually work?

Let’s break it down—for both users and projects.

## For Users: What You Get and Why

Your monthly citizen salary depends on two things:
- How many FundLoop projects you actively use
- How well you''ve validated your identity through Cubid

The more projects you engage with—and the more verified you are—the more you''re eligible to receive. But even light participation in a single project can unlock value. You don’t have to be everywhere, just active and human.

## For Projects: What You Control and What You Influence

As a project, you decide which users are contributing value to your platform. Each month, you can:
- Nominate users
- Assign each a **participation fraction** between 0 and 1
- Set aside a portion of your 1% contribution for them

This creates a direct line between your project’s success and the value returned to your most important community members.

But FundLoop doesn’t stop there. It ensures all contributions feed into a larger ecosystem. Here’s how that works.

## The Two-Pass System: How FundLoop Distributes Value

Each month, FundLoop runs a two-step distribution process to fairly allocate the 1% contributions from all projects.

### **First Pass: Project-Based Distribution**

Each project starts by distributing its contribution to the users it nominated:
- Users are assigned a **fractional weight** (between 0 and 1) based on their participation
- The project’s total contribution is divided accordingly
- To be eligible, a user must meet a **minimum level of identity verification** via Cubid

If a user is nominated by multiple projects, they **only receive the highest value** among those offers in the first pass. Any overlapping amounts they would have received from other projects are **returned to the communal pool** for redistribution.

This means:
- Every user gets at least what one project assigned to them
- Projects are guaranteed that their contributions benefit their chosen users
- Duplicates don’t lead to users being overpaid

### **Second Pass: Ecosystem-Based Redistribution**

The remaining communal pool is then distributed to all eligible users—not based on fractions, but on network engagement.

Each user earns a share of the pool based on:
- The **number of FundLoop projects** they participated in during the month
- Weighted using a square root function (so 3 projects isn’t 3x better than 1, but still counts more)

This second pass encourages users to explore and support more apps—without penalizing those who only use one. It also creates a **gentle incentive curve**: deeper participation = more reward, but without centralizing value in power users.

## Why This Matters

This two-layered approach ensures:
- **Reliability**: Projects can reward their users directly and predictably
- **Fairness**: No one gets double-paid for overlapping activity
- **Regeneration**: Extra funds go back into the system to reward community engagement
- **Balance**: Power users are rewarded, but not disproportionately

## Closing Thoughts

Citizen salaries are more than payouts—they’re how FundLoop aligns incentives, sustains ecosystems, and makes digital participation meaningful. The math behind the system isn’t designed to extract—it’s designed to include, reward, and regenerate.

Whether you''re a project contributing or a person participating, you''re helping build an economy where value flows both ways—and keeps growing.
', 'https://kyxtqnfnksvcaugxwzuj.supabase.co/storage/v1/object/public/blog-pics//blogpic.jpg', NULL, false, NULL, '2025-04-04 05:45:03.955026+00', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.blog_posts (id, title, subtitle, slug, excerpt, content, picture, category, is_support, sort_order_within_category, published_at, author_id) VALUES (4, 'Building a Network State: Lessons from Month One', NULL, 'building-network-state-lessons', 'Reflections on the challenges and successes from our first month of building the FundLoop network state.', 'Full content of the blog post goes here...', 'https://kyxtqnfnksvcaugxwzuj.supabase.co/storage/v1/object/public/blog-pics//building-network-state-lessons.png', NULL, false, NULL, '2025-03-07 05:45:03.955026+00', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.blog_posts (id, title, subtitle, slug, excerpt, content, picture, category, is_support, sort_order_within_category, published_at, author_id) VALUES (5, 'How to Maximize Your Contributions to the FundLoop Ecosystem', 'A strategic guide for projects to grow with purpose, build loyalty, and sustain impact', 'maximize-contributions-fundloop', 'Making your 1% contribution is just the start. Here’s how your project can turn it into long-term user growth, stronger rewards for your community, and greater alignment with the FundLoop ecosystem.', 'Joining FundLoop with a 1% revenue pledge unlocks a powerful loop of mutual benefit—but how you follow through can dramatically impact the results. This guide helps projects get the most out of their participation by focusing on sustained engagement, user validation, and ecosystem alignment.

## 1. Encourage Cross-App Participation

FundLoop doesn’t reward users just for logging into your app. To earn their citizen salary, users must engage with **multiple** participating apps each month. That means you should:

- Recommend a few value-aligned apps to your users.
- Consider forming mutual referral partnerships with them.
- Embed or link to other FundLoop projects directly in your user flows.

The more your users engage across the ecosystem, the more likely they are to return consistently—and the more they’ll earn, building trust and satisfaction with your brand.

## 2. Be Consistent, Not Just Loud

Monthly “drives” to onboard users can be effective, but inconsistent activity creates confusion. If users don’t see reliable payouts, they may disengage.

- Maintain a steady monthly rhythm of contributions.
- Notify your users when they’ve helped “earn the loop” that month.
- Consider using a banner or dashboard widget to remind them of their status.

Trust comes from **repetition**. If users know they can count on you, they’ll stick around.

## 3. Help Users Get Validated

Only **validated** users are eligible for UBI payouts. The more validated a user is, the more they can earn. Encourage your users to:

- Complete full identity verification through **Cubid**.
- Link additional credentials to raise their score (e.g., Gitcoin Passport, phone, socials).
- Use your support channels to answer questions and audit their validation status.

You can even offer small in-app incentives to help them complete the process.

## 4. Track and Tune Participation Fractions

As a project, you can assign each user a **participation fraction** between 0 and 1 based on their level of engagement. This controls how much of your 1% allocation they’re eligible to receive.

- Assign `1` to your most engaged users.
- Use partial values for lighter participation.
- Update these scores monthly, and let users know what they can do to increase them.

This not only optimizes your funds—it **guides user behavior** in transparent and motivating ways.

## 5. Focus on Repeat, Human-Centered Actions

FundLoop isn’t about gaming metrics—it’s about supporting real people doing meaningful things.

- Design your UX around light, regular participation (e.g., a weekly check-in, a share, a micro-task).
- Highlight human interactions or thoughtful contributions, not just raw clicks.
- Create rituals: monthly activities, seasonal drives, user shoutouts, community calls.

These human moments are what the loop values most.

## 6. Build Long-Term Loyalty

You''re not just part of a funding mechanism—you’re part of a new economy. Users who see you as a reliable, purpose-aligned project are more likely to:

- Stick around for months
- Promote you to others
- Treat your product with care and respect

Treat FundLoop not as a marketing tool, but as an **alignment engine**—one that rewards you for investing in people.

---

**Final Tip:** The 1% is the entry price—but how you show up determines your real impact.

Build with care. Be consistent. Help your users grow. And the loop will return the favor.', 'https://kyxtqnfnksvcaugxwzuj.supabase.co/storage/v1/object/public/blog-pics//blogpic.jpg', NULL, false, NULL, '2025-02-24 05:45:03.955026+00', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.blog_posts (id, title, subtitle, slug, excerpt, content, picture, category, is_support, sort_order_within_category, published_at, author_id) VALUES (7, 'How FundLoop Benefits Projects and Organizations', 'Solving the cold start problem while growing with purpose', 'how-fundloop-benefits-projects', 'FundLoop helps projects gain users, demonstrate values, and access aligned funding. By contributing just 1% of their revenue, organizations unlock a shared ecosystem of users, trust, and long-term growth.', 'Most digital projects face the same challenge: it’s hard to attract users without funding, and hard to get funding without users. FundLoop breaks this cycle by connecting projects to an engaged pool of verified users who are paid to explore and interact with aligned apps.

## Built-In User Acquisition

When your project joins FundLoop and commits 1% of its revenue, your users become eligible for monthly citizen salary payouts—**as long as they’re active**. This means people are financially incentivized to try, use, and stay engaged with your app.

Instead of spending on ads or giveaways, you grow by participating in a mutual support network.

## Grow with Purpose

Joining FundLoop shows that your project is committed to more than profit. You’re part of a movement that values fairness, transparency, and shared prosperity. This attracts not only users, but also contributors, collaborators, and funders who are looking for value-aligned initiatives.

Projects that build in public and contribute to the loop gain trust and long-term credibility.

## Tap Into a Broader Ecosystem

Beyond users, FundLoop also connects you to shared services like marketing, grant writing, community support, and governance infrastructure. You don’t have to go it alone—there’s a network of peers and contributors working toward similar goals.

And once you’ve made a few monthly contributions, your project becomes eligible for internal grants and public goods funding, boosting your treasury without giving up equity.

## Transparency That Builds Trust

All contributions are visible. All user payouts are accountable. FundLoop promotes open economics where supporters can see that your project gives back. This kind of transparency helps differentiate you in a crowded market.

**Joining FundLoop isn’t just good—it’s good business.**', 'https://kyxtqnfnksvcaugxwzuj.supabase.co/storage/v1/object/public/blog-pics//blogpic.jpg', NULL, false, NULL, '2025-04-11 14:44:04.292737+00', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.blog_posts (id, title, subtitle, slug, excerpt, content, picture, category, is_support, sort_order_within_category, published_at, author_id) VALUES (9, 'How FundLoop Benefits People', 'A new way to earn in the age of automation and attention', 'how-fundloop-benefits-people', 'FundLoop offers people a path to financial stability by paying them for being active, verified users of aligned apps. It turns digital engagement into income and builds a future where participation is rewarded.', 'In a world where jobs are disappearing and platforms profit from unpaid users, FundLoop flips the script. It introduces a universal citizen salary funded by projects that commit just 1% of their revenue to a shared pool. This salary is paid to verified humans who regularly engage with apps in the ecosystem.

## Get Paid for Being Human

FundLoop rewards what the economy often ignores—your time, your attention, and your participation. If you''re a real person who uses aligned apps and meets a basic level of monthly activity, you receive a payout. No resumes. No interviews. Just proof of personhood and proof of engagement.

This provides a steady income stream in an era when automation, outsourcing, and platform monopolies are hollowing out traditional work.

## Economic Security in a Post-Work World

Whether you''re a student, gig worker, freelancer, or just someone who wants to support ethical projects, FundLoop offers a base layer of income—one that doesn’t depend on employment status. It’s designed to work alongside whatever else you’re doing, reducing stress and increasing freedom.

As more projects join and contribute, the citizen salary pool grows. Your voice, presence, and participation gain value over time.

## Participate in a Values-Aligned Economy

Every project in FundLoop has pledged a portion of their revenue to support people like you. These are not exploitative platforms trying to monetize your data—they’re regenerative ventures committed to shared prosperity.

You don’t just consume apps. You help power a new economic model by using them.

## More Than Money

FundLoop also invites you into a supportive community where your contributions are seen, your actions matter, and your feedback shapes the future. This is more than UBI—it’s universal belonging and influence in a digital world that often treats humans as numbers.

**Your time is valuable. FundLoop makes sure it’s recognized.**', 'https://kyxtqnfnksvcaugxwzuj.supabase.co/storage/v1/object/public/blog-pics//blogpic.jpg', NULL, false, NULL, '2025-04-11 14:45:30.418654+00', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.blog_posts (id, title, subtitle, slug, excerpt, content, picture, category, is_support, sort_order_within_category, published_at, author_id) VALUES (10, 'How FundLoop Benefits the World', 'Reimagining value, equity, and participation in the digital economy', 'how-fundloop-benefits-the-world', 'FundLoop introduces a new model for shared prosperity by aligning incentives between digital projects and active users. Through a simple 1% revenue pledge, FundLoop funds citizen salaries, sustains public goods, and builds a regenerative economic future.', 'We live in a time of extraordinary technological progress—but also growing inequality, job displacement, and social fragmentation. Traditional systems fail to reward meaningful digital participation or fund the public goods we all rely on. FundLoop offers a simple, powerful alternative: build a regenerative economy where value flows in a loop between projects and people.

## The 1% Commitment That Changes Everything

At the heart of FundLoop is a radical yet intuitive idea: projects pledge just 1% of their revenue to a shared pool. These funds are used to pay monthly citizen salaries to verified, active users—people who engage with and support projects within the ecosystem.

This creates a flywheel:
- More projects join → More funds available
- More users engage → Projects grow
- Projects grow → More revenue enters the loop

It’s a virtuous cycle, built for long-term sustainability.

## Compensating Participation in the AI Age

As AI and automation continue to reshape the workforce, many people are left wondering: how will I earn a living? FundLoop responds with a clear answer—**you get paid for being a verified, engaged human.** Not for your data. Not for your attention. But for your active, conscious participation in a network that values your time and choices.

This is a direct response to the declining reliability of traditional jobs and the growing gap between contribution and compensation.

## Strengthening Public Goods

FundLoop doesn’t just pay users—it also allocates funding to the builders and maintainers of open-source tools, digital infrastructure, and shared services. These are the unsung heroes of our digital world, and FundLoop ensures they’re sustainably supported.

Instead of relying on sporadic grants or burnout-driven volunteerism, contributors receive steady support based on transparent, community-aligned funding policies.

## A Global Platform for Local Resilience

FundLoop is designed to scale across geographies and industries. Whether you''re building a local co-op, a global app, or a decentralized protocol, you can plug into the loop. Each project retains its independence but benefits from shared infrastructure, visibility, and access to an aligned user base.

Over time, this creates a resilient network of regenerative economies—locally rooted, globally connected.

## Why It Works

FundLoop works because it aligns incentives:
- Projects want users → They contribute to the loop
- Users want income → They engage with projects
- Public goods need funding → The loop sustains them

It’s not about charity. It’s about mutual value and long-term coordination.

## Join the Loop

FundLoop isn’t just an economic system. It’s a movement—one that invites everyone to participate, contribute, and share in the rewards of a more equitable digital future.

Let’s stop waiting for systems to change. Let’s build one that works—for all of us.
', 'https://kyxtqnfnksvcaugxwzuj.supabase.co/storage/v1/object/public/blog-pics//blogpic.jpg', NULL, false, NULL, '2025-04-11 14:46:10.011789+00', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.blog_posts (id, title, subtitle, slug, excerpt, content, picture, category, is_support, sort_order_within_category, published_at, author_id) VALUES (11, 'How FundLoop Benefits the Allo Network', 'Allo Protocol and GitCoin lead the charge, and now FundLoop is the new kid on the block', 'how-fundloop-benefits-allo', 'Where do the collected funds go? How are they distributed? How can we make sure they’re allocated fairly, efficiently, and transparently?

This is where Allo Protocol comes in. Read this to learn more about it.', 'FundLoop is a regenerative funding network that brings projects and users into a shared economic loop. 

## A New Era of Capital Allocation

At its core, FundLoop is about aligning incentives—projects commit 1% of their revenue to the ecosystem, and in return, their users become eligible for a monthly citizen salary, funded by these contributions. It’s a simple but powerful idea: pay people for being active, verified humans who engage with aligned apps.

But where do these funds go? How are they distributed? How can we make sure they’re allocated fairly, efficiently, and transparently?

This is where **Allo** comes in.

## What is Allo?

“Allo” is short for capital allocation—an umbrella that includes Gitcoin, Gitcoin Grants, Gitcoin Passport, the Allo Protocol, and now the latest incarnation: **Allo Capital**. These tools have become a vital backbone for allocating funds to builders, communities, and ecosystems. Whether it''s quadratic funding rounds, conviction voting, or builder-based reputation systems, Allo provides the infrastructure needed to route money where it matters most.

## Why FundLoop + Allo Is a Natural Fit

FundLoop and Allo are built for the same world: one where value is created by communities, where public goods matter, and where capital flows are designed to support collective prosperity.

Here’s how FundLoop integrates with Allo:

- **Proof-of-Activity Allocation**: FundLoop uses zk-based attestations to measure monthly engagement across participating projects. These activity scores become the input for allocating citizen salaries—and Allo Protocol is the perfect place to define and execute those allocation mechanisms.

- **Conviction Voting for Rule Updates**: The parameters that govern FundLoop (such as weights for projects, participation thresholds, or user segmentation rules) are not fixed. We’ll use **Allo governance spaces** to let the community vote on these using conviction-based governance tools.

- **Funding Pools with Purpose**: FundLoop can spin up specialized funding pools within the Allo ecosystem. For example: a Builders Pool for infrastructure contributors, a Local Loop for Toronto-based projects, or a Youth UBI Fund targeting under-25 verified users. These pools use Allo’s open coordination and routing mechanisms.

- **Sybil Resistance with Gitcoin Passport**: FundLoop integrates **Cubid** for local and multi-channel identity, but also complements this with Gitcoin Passport. The stronger the proof-of-personhood, the more eligible the user becomes for UBI or project-specific bonuses.

- **Public Matching & Grant Rounds**: In the future, FundLoop may participate in Allo Capital rounds by submitting its treasury pools for matching funds—effectively boosting citizen salary payouts when aligned with Allo’s priorities.

## Why It Matters

Together, FundLoop and Allo form a complete cycle:

- **Projects** generate value and contribute revenue.  
- **Users** create value by engaging meaningfully across the ecosystem.  
- **FundLoop** collects contributions and calculates eligible activity.  
- **Allo** routes those funds with transparency and community governance.  

This integration ensures that value doesn’t just flow—it flows wisely, guided by open data, collective intent, and protocol-native infrastructure.

## Final Thoughts

We believe capital allocation is too important to leave to chance or central authority. FundLoop’s integration with Allo is our way of ensuring that every dollar, token, or stablecoin contributed to the loop gets to where it’s most deserved.

Together, we’re not just funding public goods—we’re redefining who gets paid, why, and how.

**Join the Loop. Coordinate with Allo. Build the Future.**
', 'https://kyxtqnfnksvcaugxwzuj.supabase.co/storage/v1/object/public/blog-pics//blogpic.jpg', NULL, false, NULL, '2025-04-11 14:50:10.738484+00', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.blog_posts (id, title, subtitle, slug, excerpt, content, picture, category, is_support, sort_order_within_category, published_at, author_id) VALUES (12, 'FundLoop''s Theory of Change', 'FundLoop creates a regenerative economy by creating a self-sustaining loop of shared prosperity, strategic growth, and public goods funding', 'fundloop-theory-of-change', 'FundLoop’s theory of change emphasizes diagnosing structural challenges, guiding aligned behavior through clear policies, and enabling coherent, visible action—turning passive ecosystems into active, regenerative networks that reward participation and sustain public goods.', 'FundLoop is a regenerative finance ecosystem operating as **Regens in a degen world**—we recognize market volatility and speculative behaviors, and we build structures that thrive within it. The old maxim “build it and they will come” fails in our rapidly shifting landscape; FundLoop actively **orchestrates engagement**, ensuring both projects and users benefit, rather than relying on passive attraction.

Drawing from Richard Rumelt’s _Good Strategy/Bad Strategy_, FundLoop emphasizes **diagnosis**, **guiding policy**, and **coherent action** to navigate complex challenges. Inspired by _Working Out Loud_, we prioritize **visibility**, **generosity**, and **purposeful discovery**, fostering open collaboration and continuous feedback.

### Inputs
- **1% Revenue Pledge** from each member project, including future grants and equity inflows citeturn0file0
- **Technical Infrastructure**: contribution tracking, identity verification, and payment systems
- **Community & Governance**: core contributors, community managers, and shared service teams

### Activities
- **Strategic Onboarding**: diagnose project fit, guide alignment with FundLoop values, and commit to 1% revenue flows
- **User Validation & Engagement**: employ proof-of-personhood tools, set clear participation thresholds tied to UBI rewards
- **Targeted Distributions**: allocate funds not only as UBI but to public goods, venture capital for EverFund, and shared services
- **Working Out Loud Practices**: make progress and processes visible; encourage storytelling and knowledge sharing across the ecosystem

### Outputs
- **Projects Onboarded** with public 1% commitments
- **Total Funds Collected** in the FundLoop pool
- **UBI Payments Executed** for active users
- **Grants & Investments** deployed to public goods and new ventures
- **Shared Services Delivered** (marketing, grant writing, community building)

### Short‑ to Medium‑Term Outcomes
1. **Enhanced Engagement:** Structured incentives replace passive "build it" assumptions—users and projects co-evolve.
2. **Coherent Growth:** Clear strategic diagnosis prevents scattershot efforts; projects align on guiding policies and coherent action plans.
3. **Visible Progress:** Sharing learnings openly attracts collaborators and amplifies network effects.
4. **Stabilized Public Goods:** Reliable funding sustains open-source work and communal infrastructure.

### Long‑Term Impact
- **Virtuous Flywheel:** Stronger project revenues feed larger FundLoop pools, boosting UBI and public goods funding, which in turn attracts even more participants.
- **Regenerative Economic State:** A self‑sustaining digital nation of mutual aid and shared prosperity, demonstrating a new model for economic cooperation.
- **Strategic Resilience:** By diagnosing challenges, setting coherent policies, and making work visible, FundLoop adapts to shifting degen dynamics while anchoring on regenerative principles.
---


', 'https://kyxtqnfnksvcaugxwzuj.supabase.co/storage/v1/object/public/blog-pics//blogpic.jpg', NULL, false, NULL, '2025-04-17 18:45:30.888972+00', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.blog_posts (id, title, subtitle, slug, excerpt, content, picture, category, is_support, sort_order_within_category, published_at, author_id) VALUES (13, 'Introduction to FundLoop', 'Learn about the core concepts and vision behind FundLoop', 'introduction-to-fundloop', 'FundLoop is a revolutionary network state that creates a sustainable economic ecosystem through mutual aid and shared prosperity. This guide will help you understand the core principles and how the ecosystem functions.', 'FundLoop is a regenerative economic ecosystem designed to reward human participation and support digital public goods. It connects projects and users in a mutually beneficial loop: projects pledge 1% of their revenue, and verified users receive a monthly citizen salary based on their engagement across the ecosystem.

## Core Principles

FundLoop operates on the following foundational ideas:

- **Shared Prosperity**: Everyone benefits when projects succeed and users participate.
- **Regenerative Finance**: Value flows in a loop, continuously funding both people and public goods.
- **Proof of Personhood**: Only verified humans can earn, ensuring fairness and Sybil resistance.
- **Engagement Over Extraction**: FundLoop values participation, not attention or data exploitation.

## What Makes It Different

Traditional digital economies rely on extractive models—ads, data harvesting, speculative tokenomics. FundLoop is different. It’s opt-in, contribution-based, and designed to thrive in a future of AI and automation by putting verified humans at the center of value creation.

Projects don’t pay for eyeballs—they contribute to a system that brings them real, repeat users. Users don’t just consume—they receive compensation for showing up with intention and consistency.

## How the Loop Works

1. **Projects Join**: They commit 1% of revenue and optionally nominate engaged users each month.
2. **Users Participate**: They engage with two or more FundLoop-integrated apps and verify their identity.
3. **Value Is Distributed**: FundLoop calculates payouts based on project-specific nominations and broader ecosystem engagement.
4. **Everyone Benefits**: Projects grow through aligned users, and people gain economic security just by participating in valuable digital spaces.

## Long-Term Vision

FundLoop isn’t just an app or a funding tool—it’s a new model for digital cooperation. The goal is to build a global, self-sustaining network state where economic value is shared, not hoarded.

Through collaboration, transparency, and human-centered design, FundLoop aims to become the infrastructure layer for regenerative public goods in the AI age.

To learn more about the mechanics, see [How FundLoop Works](/docs/how-fundloop-works) or explore our guides for [projects](/docs/project-onboarding) and [users](/docs/user-guide).', 'https://kyxtqnfnksvcaugxwzuj.supabase.co/storage/v1/object/public/blog-pics//blogpic.jpg', 'Getting Started', true, 1, '2025-06-06 16:57:46.177508+00', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.blog_posts (id, title, subtitle, slug, excerpt, content, picture, category, is_support, sort_order_within_category, published_at, author_id) VALUES (14, 'How FundLoop Works', 'Understand the mechanics of the 1% pledge and citizen salary', 'how-fundloop-works', 'Learn how projects contribute 1% of their revenue to fund the citizen salary program, and how users can participate and benefit from the ecosystem.', 'FundLoop creates a regenerative economic loop by connecting projects that contribute a portion of their revenue with users who receive compensation for being active, verified participants. This section explains how the flow of value works, who is involved, and how distributions are calculated.

## The 1% Pledge

Projects that join FundLoop commit to contributing **1% of their revenue** each month to the ecosystem. This can include:

- Product revenue  
- Grant funding  
- Token inflows or treasury activity  

These contributions are reported monthly and fund two main outputs:  
- **Citizen salaries** for verified active users  
- **Public goods** and shared services across the ecosystem

## Citizen Salary Distribution

Each month, FundLoop distributes contributed funds through a two-pass system:

1. **Project Allocation Pass**  
   - Each project nominates users and assigns them fractional values (from 0 to 1) based on their level of engagement.  
   - The user receives the highest assigned amount from any one project they are nominated by.  
   - Any overlapping contributions are returned to a **communal pool**.

2. **Ecosystem Allocation Pass**  
   - Remaining funds in the communal pool are distributed equally to all eligible users, using a **square root multiplier** based on how many different projects they engaged with during the month.  
   - Only users who are **validated through Cubid** and have engaged with at least two projects are eligible.

This structure rewards both deep and broad engagement, while ensuring no double-counting of value across projects.

## User Validation and Eligibility

Only verified humans are eligible for citizen salaries. Validation is handled via **Cubid**, which allows users to link credentials like:

- Phone or email  
- Social accounts (e.g., GitHub, Twitter)  
- Gitcoin Passport or wallet-based credentials  

Users must meet a **minimum validation threshold** and demonstrate ongoing activity to qualify for payouts.

## Benefits for Projects

Projects benefit by:

- Gaining access to a pool of real, verified users  
- Incentivizing consistent usage through direct payouts  
- Demonstrating alignment with a broader regenerative economy  
- Building trust through transparent contribution and nomination patterns

## Summary

FundLoop works by turning small recurring contributions into a sustainable funding system for human participation and public infrastructure. The more consistently projects contribute and users engage, the more the loop grows—and the more value it generates for everyone involved.

For more on how to get started, see the [Project Onboarding](/docs/project-onboarding) and [User Guide](/docs/user-guide) documentation.', 'https://kyxtqnfnksvcaugxwzuj.supabase.co/storage/v1/object/public/blog-pics//blogpic.jpg', 'Getting Started', true, 2, '2025-06-06 17:00:50.541512+00', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.blog_posts (id, title, subtitle, slug, excerpt, content, picture, category, is_support, sort_order_within_category, published_at, author_id) VALUES (16, 'Getting Started', 'Step-by-step guide to joining the FundLoop ecosystem', 'getting-started', 'Follow this guide to create your account, set up your profile, and start participating in the FundLoop ecosystem as either a project or a user.', 'This guide walks you through the initial steps for joining FundLoop, whether you''re a project or an individual user. FundLoop is an economic coordination platform where projects contribute 1% of their revenue and users receive a citizen salary in return for verified participation across the ecosystem.

## For Users

To start receiving a citizen salary:

1. **Create an Account**  
   Sign up using your email, phone, or connected wallet. Your identity will be managed through Cubid to ensure proof-of-personhood.

2. **Complete Your Profile**  
   Add a nickname and profile image. These are required for participation in most FundLoop-enabled apps.

3. **Get Validated**  
   Connect identity credentials through Cubid to begin earning. Higher validation leads to greater eligibility for salary payouts.

4. **Participate in Projects**  
   Use any FundLoop-enabled app. You must be active in multiple projects to qualify for payouts from the communal pool.

5. **Track Your Rewards**  
   Your activity, validation score, and salary eligibility can be tracked from your FundLoop dashboard.

## For Projects

To start contributing and benefiting from FundLoop:

1. **Register Your Project**  
   Create a project profile with your name, logo, short bio, and website link.

2. **Pledge 1%**  
   Commit to contributing 1% of your monthly revenue or equivalent in-kind value to the FundLoop pool.

3. **Nominate Users**  
   Identify your active users and assign fractional values to determine their share of your monthly contribution.

4. **Integrate with the Ecosystem**  
   Optionally, connect to FundLoop’s API to automate user syncing, revenue reporting, and contribution confirmations.

5. **Monitor Impact**  
   View dashboards showing your contribution history, user allocations, and impact across the ecosystem.

## What’s Next

Once you’ve completed the steps above, explore more advanced features such as governance participation, performance tracking, and ecosystem collaborations. FundLoop is designed to reward consistency and alignment—stay engaged and you’ll see increasing benefits over time.', 'https://kyxtqnfnksvcaugxwzuj.supabase.co/storage/v1/object/public/blog-pics//blogpic.jpg', 'Getting Started', true, 3, '2025-06-06 17:02:13.00051+00', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.blog_posts (id, title, subtitle, slug, excerpt, content, picture, category, is_support, sort_order_within_category, published_at, author_id) VALUES (17, 'Project Onboarding', 'Guide for projects joining the FundLoop ecosystem', 'project-onboarding', 'Learn how to register your project, set up your profile, and integrate with the FundLoop ecosystem to start contributing and benefiting.', 'This guide explains how to onboard your project into the FundLoop ecosystem. By committing to the 1% pledge, you gain access to a growing network of verified users, shared services, and a regenerative funding loop that rewards participation and impact.

## Step 1: Create Your Project Profile

Start by submitting basic details about your project:

- Project name and logo  
- Website or landing page URL  
- Short description and mission statement  
- Primary contact person or account

Once submitted, your project profile will be reviewed and added to the public FundLoop directory.

## Step 2: Commit to the 1% Pledge

By joining FundLoop, your project agrees to contribute **1% of monthly revenue** (or equivalent value from grants or token inflows) into the shared FundLoop pool. This pool funds:

- Citizen salaries for active, verified users  
- Public goods  
- Shared services across the ecosystem  

This pledge is flexible in structure but must be recorded transparently each month.

## Step 3: Nominate Active Users

You can assign a share of your monthly contribution to specific users who actively contribute to your project. For each user, you may:

- Nominate them for a payout  
- Assign a fractional value (0 to 1) reflecting their engagement level  

Only users who meet a minimum verification standard via Cubid are eligible to receive funds.

## Step 4: Stay Consistent

Consistency is key to building trust and retaining engaged users. Projects are encouraged to:

- Make regular monthly contributions  
- Maintain a visible pattern of user support  
- Avoid large gaps between activity spikes (e.g. funding drives) and dry months  

A reliable flow of value helps ensure long-term user loyalty.

## Step 5: Collaborate with the Ecosystem

Projects benefit most when they:

- Recommend other FundLoop apps to their users  
- Join multi-project referral loops  
- Help users complete identity validation  
- Participate in governance and feedback loops  

By contributing consistently and encouraging cross-project usage, you strengthen both your community and the wider ecosystem.

## Next Steps

Once you’ve completed onboarding, we recommend exploring the [Integration Guide](/docs/integration-guide) to automate your reporting and user syncing, and the [Governance Documentation](/docs/governance) to participate in decision-making about thresholds, weights, and future rules.', 'https://kyxtqnfnksvcaugxwzuj.supabase.co/storage/v1/object/public/blog-pics//blogpic.jpg', 'For Projects', true, NULL, '2025-06-06 17:04:21.153684+00', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.blog_posts (id, title, subtitle, slug, excerpt, content, picture, category, is_support, sort_order_within_category, published_at, author_id) VALUES (18, 'Integration Guide', 'Technical documentation for integrating with FundLoop', 'integration-guide', 'Technical guide for developers to integrate their projects with FundLoop''s API for user syncing, contribution tracking, and more.', 'Integrating your project with FundLoop allows you to automate key processes such as user syncing, contribution tracking, and validation status updates. This guide outlines how to use FundLoop’s API and optional SDKs to streamline your participation in the ecosystem.

## API Authentication

All requests to the FundLoop API require authentication using a project-specific API key. You can generate this key from your FundLoop project dashboard under **Settings → API Access**.

Include the key as a `Bearer` token in the `Authorization` header for all requests.

## User Syncing

To ensure accurate attribution, projects should regularly sync a list of active users. Each record should include:

- A unique user identifier (such as an email, wallet address, or Cubid user ID)  
- A participation score (0 to 1) reflecting the user''s engagement  
- An optional comment or reason for the score  

### Endpoint: `POST /api/v1/project-users`

Example payload:

```json
{
  "users": [
    {
      "id": "user-abc123",
      "score": 1,
      "comment": "Submitted 3 PRs this month"
    },
    {
      "id": "user-xyz456",
      "score": 0.4,
      "comment": "Participated in one community call"
    }
  ]
}', 'https://kyxtqnfnksvcaugxwzuj.supabase.co/storage/v1/object/public/blog-pics//blogpic.jpg', 'For Projects', true, NULL, '2025-06-06 17:05:28.701436+00', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.blog_posts (id, title, subtitle, slug, excerpt, content, picture, category, is_support, sort_order_within_category, published_at, author_id) VALUES (20, 'User Guide', 'Complete guide for users in the FundLoop ecosystem', 'user-guide', 'Learn how to create your profile, connect with projects, and start receiving citizen salary payments as an active member of the ecosystem.', 'As a user in the FundLoop ecosystem, you can earn a monthly citizen salary simply by being an active, verified human across participating apps. This guide walks you through how to get started, stay eligible, and increase your rewards over time.

## Step 1: Create Your Account

You can sign up using your email, phone number, or wallet. Your identity will be secured and managed through our integration with Cubid, a privacy-preserving proof-of-personhood system.

Once registered, you’ll receive a unique user ID and access to your FundLoop dashboard.

## Step 2: Complete Your Profile

To activate your participation:

- Upload a profile image  
- Choose a nickname  
- Set your communication preferences  

These basics are required to be discoverable by projects and to receive salary payments.

## Step 3: Get Validated

Only validated users are eligible for salary payouts. To increase your validation level:

- Connect phone, email, and wallet accounts through Cubid  
- Add bonus credentials such as GitHub, Twitter, or Gitcoin Passport  
- Reach Tier 2 or higher to qualify for monthly payouts

Higher validation = higher earning potential.

## Step 4: Use Participating Apps

You must actively use at least **two** FundLoop-integrated apps in a given month to qualify for ecosystem-wide payouts. Activities can include:

- Logging in and using features  
- Joining events or calls  
- Making contributions or sharing feedback  

Your actions don’t need to be technical—just human and engaged.

## Step 5: Track Your Rewards

Your dashboard will show:

- Projects you’ve interacted with  
- Validation level and status  
- Current eligibility for citizen salary  
- Estimated monthly payout (once projects report their data)

Payouts are calculated at the beginning of each month based on the prior month’s activity.

## Tips to Maximize Your Benefits

- Participate regularly across different projects  
- Maintain your Cubid validation status  
- Favor projects that consistently contribute to FundLoop  
- Ask projects to nominate you based on your involvement  
- Encourage friends to join—the loop grows with people

## Staying In the Loop

FundLoop works best when users check in regularly. We recommend reviewing your dashboard at least once per month and staying active in at least two apps to keep earning.

Have questions? Join the community Discord or reach out to `support@fundloop.org`.', 'https://kyxtqnfnksvcaugxwzuj.supabase.co/storage/v1/object/public/blog-pics//blogpic.jpg', 'For Users', true, NULL, '2025-06-06 17:06:47.750296+00', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.blog_posts (id, title, subtitle, slug, excerpt, content, picture, category, is_support, sort_order_within_category, published_at, author_id) VALUES (21, 'Contribution Guide', 'How to actively contribute to the FundLoop ecosystem', 'contribution-guide', 'Discover ways to contribute your skills and expertise to help grow the FundLoop ecosystem and maximize your benefits.', 'Beyond just earning citizen salary, you can play an active role in strengthening the FundLoop ecosystem. This guide outlines how to contribute meaningfully, increase your impact, and maximize the long-term benefits of your participation.

## 1. Engage with FundLoop-Enabled Apps

Your most direct contribution is to use the apps and tools built by projects that have joined FundLoop. Meaningful engagement includes:

- Using app features regularly  
- Attending community events or calls  
- Providing feedback or support to the project  
- Sharing the project with others in your network

The more projects you engage with in a given month, the greater your potential share of the ecosystem-wide rewards.

## 2. Complete and Maintain Your Cubid Validation

FundLoop only rewards verified humans. To qualify for payouts:

- Register your identity through Cubid  
- Connect key credentials (email, phone, wallet, etc.)  
- Reach and maintain Tier 2 validation or higher

Projects can see your verification status and may prioritize you for nominations if you are fully validated.

## 3. Ask Projects to Nominate You

Projects that participate in FundLoop can assign you a fraction (between 0 and 1) of their monthly contribution based on your level of engagement.

- Make yourself visible to the project team  
- Be helpful and responsive in their community  
- Let them know you’re an active user eligible for nomination

This is one of the most direct ways to increase your earnings.

## 4. Participate Consistently

FundLoop rewards consistency over one-time effort. To stay eligible for payouts:

- Engage with at least two different FundLoop apps each month  
- Maintain basic validation with Cubid  
- Check your dashboard to monitor activity and progress

If your engagement drops or you stop validating, your eligibility will decrease.

## 5. Help the Ecosystem Grow

You can also contribute by:

- Referring others to join FundLoop  
- Reporting bugs, submitting ideas, or contributing to open-source code  
- Helping other users get verified and participate  
- Advocating for the 1% pledge among aligned projects

Every contribution strengthens the loop—and improves outcomes for everyone.

## Summary

Your actions—big or small—shape the health of FundLoop. The more aligned and human your contributions are, the more value you help circulate across the system. Over time, your consistent participation builds both personal benefit and collective prosperity.

For technical contributors, you may also want to check out our [Developer Integration Guide](/docs/integration-guide).', 'https://kyxtqnfnksvcaugxwzuj.supabase.co/storage/v1/object/public/blog-pics//blogpic.jpg', 'For Users', true, NULL, '2025-06-06 17:07:47.169386+00', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.blog_posts (id, title, subtitle, slug, excerpt, content, picture, category, is_support, sort_order_within_category, published_at, author_id) VALUES (22, 'API Reference', 'Complete reference for the FundLoop API', 'api-reference', 'Comprehensive documentation of all API endpoints, request parameters, and response formats for integrating with the FundLoop ecosystem.', 'This section provides a complete reference to the FundLoop API, including all available endpoints, request formats, authentication requirements, and response schemas. These APIs enable projects to automate user syncing, revenue reporting, and validation queries.

## Base URL

All API requests are served over HTTPS.  
**Base URL:** `https://api.fundloop.org/v1`

## Authentication

Each project must authenticate using a unique API key. This key can be generated from the project dashboard.

Include the key in the `Authorization` header of all requests:

```

Authorization: Bearer YOUR\_API\_KEY

````

## Endpoints

### `POST /project-users`

Submit or update your monthly list of active users.

#### Request Body

```json
{
  "users": [
    {
      "id": "user-abc123",
      "score": 1,
      "comment": "Submitted several bug reports"
    },
    {
      "id": "user-xyz456",
      "score": 0.5,
      "comment": "Joined two community calls"
    }
  ]
}
````

* `id`: The user’s unique identifier (Cubid user ID or other authorized ID)
* `score`: Participation fraction between 0 and 1
* `comment`: Optional, for internal tracking

---

### `POST /contributions`

Report your monthly revenue and calculate your contribution to the FundLoop pool.

#### Request Body

```json
{
  "month": "2025-07",
  "revenue_usd": 12800,
  "contribution_usd": 128
}
```

* `month`: ISO date string representing the reporting period
* `revenue_usd`: Gross revenue for that month in USD
* `contribution_usd`: Your 1% pledge (or equivalent value)

---

### `GET /user-validation/{user_id}`

Fetch Cubid validation status for a specific user.

#### Response Format

```json
{
  "user_id": "user-abc123",
  "tier": 2,
  "valid": true,
  "last_verified": "2025-06-28T13:32:00Z"
}
```

* `tier`: Validation tier (0 = unverified, 1 = basic, 2+ = fully validated)
* `valid`: Boolean flag indicating active validation
* `last_verified`: Timestamp of the most recent verification

---

## Rate Limiting

Standard rate limits apply:

* 100 requests per minute
* Contact support for elevated access

## Error Codes

* `401 Unauthorized`: Invalid or missing API key
* `422 Unprocessable Entity`: Validation error in submitted data
* `500 Internal Server Error`: Unexpected error, try again later

## Support

For questions, contact `dev@fundloop.org` or join the #api-support channel in Discord. For SDK integration, see the [SDK Documentation](/docs/sdk-documentation).

```', 'https://kyxtqnfnksvcaugxwzuj.supabase.co/storage/v1/object/public/blog-pics//blogpic.jpg', 'API Reference', true, NULL, '2025-06-06 17:08:44.766997+00', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.blog_posts (id, title, subtitle, slug, excerpt, content, picture, category, is_support, sort_order_within_category, published_at, author_id) VALUES (23, 'SDK Documentation', 'Documentation for the FundLoop SDK', 'sdk-documentation', 'Learn how to use the FundLoop SDK to easily integrate your project with the ecosystem using our client libraries for various programming languages.', 'The FundLoop SDK provides an easy-to-use interface for integrating your project with the FundLoop API. It includes client libraries in multiple languages to simplify tasks like user syncing, revenue reporting, and validation checks.

## Available SDKs

FundLoop provides official SDKs in:

- **TypeScript / Node.js**  
- **Python** *(in beta)*  
- More language support coming soon

Each SDK is versioned and available on GitHub and major package managers (e.g., npm, PyPI).

## Installation

### TypeScript / Node.js

```bash
npm install @fundloop/sdk
````

### Python (Beta)

```bash
pip install fundloop-sdk
```

## Basic Usage

### Initialization

```ts
import { FundLoopClient } from ''@fundloop/sdk''

const client = new FundLoopClient({
  apiKey: process.env.FUNDLOOP_API_KEY
})
```

### Submit Users

```ts
await client.submitUsers([
  { id: ''user-abc123'', score: 1, comment: ''Top contributor'' },
  { id: ''user-xyz456'', score: 0.3 }
])
```

### Report Revenue

```ts
await client.reportContribution({
  month: ''2025-07'',
  revenue_usd: 18000,
  contribution_usd: 180
})
```

### Check Validation

```ts
const validation = await client.getValidation(''user-abc123'')
console.log(validation.tier, validation.valid)
```

## Error Handling

All methods return `Promise` objects and throw exceptions for:

* Invalid input formats
* Missing credentials
* API errors or rate limits

You can use `try/catch` or `client.onError()` hooks to handle failures gracefully.

## Best Practices

* Use environment variables to manage your API key
* Schedule monthly syncs using cron or task queues
* Cache validation responses to reduce API calls
* Combine SDK calls with your internal user tracking systems

## Resources

* [GitHub Repository](https://github.com/fundloop/sdk)
* [API Reference](/docs/api-reference)
* [Project Onboarding Guide](/docs/project-onboarding)

## Support

Need help? Join our developer Discord channel or email us at `dev@fundloop.org`.

```', 'https://kyxtqnfnksvcaugxwzuj.supabase.co/storage/v1/object/public/blog-pics//blogpic.jpg', 'API Reference', true, NULL, '2025-06-06 17:09:40.492824+00', NULL)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  v_table text;
  v_sequence text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['team_roles', 'blog_posts'] LOOP
    v_sequence := pg_get_serial_sequence(format('public.%I', v_table), 'id');
    IF v_sequence IS NOT NULL THEN
      EXECUTE format('SELECT setval(%L, GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.%I), (SELECT last_value FROM %s)), true)', v_sequence, v_table, v_sequence);
    END IF;
  END LOOP;
END $$;
