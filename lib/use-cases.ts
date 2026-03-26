export type UseCaseSlug =
  | "fairdrops"
  | "proof-of-humanity"
  | "community-engagement"
  | "give-back"
  | "viral-growth"

export type UseCase = {
  slug: UseCaseSlug
  label: string
  shortLabel: string
  href: string
  description: string
  eyebrow: string
  hero: string
  body: string[]
  reasons: string[]
  outcomes: string[]
}

export const useCases: UseCase[] = [
  {
    slug: "fairdrops",
    label: "fAirdrops",
    shortLabel: "fAirdrops",
    href: "/use-cases/fairdrops",
    description: "Projects can share equity or profit more fairly, based on real contribution and participation.",
    eyebrow: "Revenue, equity, and upside distribution",
    hero:
      "Use FundLoop to turn contribution data into fairer distributions instead of defaulting to flat airdrops or insider-heavy allocations.",
    body: [
      "fAirdrops let a project distribute equity, revenue share, or upside according to real participation. Rather than treating every wallet the same, FundLoop gives teams a way to weight distribution based on actual activity.",
      "That means a project can reward contributors, testers, early adopters, or high-signal participants with logic that is transparent enough to explain and structured enough to audit.",
      "The result is a distribution model that feels earned, not arbitrary. It is better for trust, better for alignment, and much harder to game than a simple claim page.",
    ],
    reasons: [
      "Flat airdrops often over-reward low-signal wallets and under-reward real contributors.",
      "Projects need a distribution story they can defend to their community.",
      "Identity-aware aggregation gives teams a path from raw activity data to fairer outcomes.",
    ],
    outcomes: [
      "Reward actual contributors instead of wallets that arrived late.",
      "Tie distributions to measurable activity across one or more projects.",
      "Create an auditable path from dataset to payout logic.",
    ],
  },
  {
    slug: "proof-of-humanity",
    label: "Proof of Humanity",
    shortLabel: "Proof of Humanity",
    href: "/use-cases/proof-of-humanity",
    description:
      "Bot-proof your project by leveraging FundLoop and Cubid for shared ecosystem insight into who is human versus bot.",
    eyebrow: "Shared ecosystem anti-bot intelligence",
    hero:
      "Leverage FundLoop and the underlying Cubid network to access collective ecosystem insight about who is likely human and who is likely bot.",
    body: [
      "Proof of Humanity here is not about routing payments differently. It is about using FundLoop's identity-aware infrastructure, together with Cubid, to benefit from what the broader ecosystem already knows about suspicious and trustworthy behavior.",
      "Instead of evaluating each account in isolation, projects can make better decisions because the signal comes from participation patterns across multiple applications, not just from one local dataset.",
      "That gives teams a stronger foundation for gating rewards, campaigns, and experiments with confidence that they are engaging real people rather than coordinated bot farms.",
    ],
    reasons: [
      "Single-app anti-bot logic is easy to game when attackers can start fresh in each product.",
      "Cross-ecosystem identity insight raises the cost of sybil behavior.",
      "Projects need stronger human-versus-bot confidence before incentives go live.",
    ],
    outcomes: [
      "Reduce bot farming pressure on incentives and campaigns.",
      "Benefit from shared ecosystem intelligence instead of only local heuristics.",
      "Make human-confidence decisions with better signal than a single app can provide alone.",
    ],
  },
  {
    slug: "community-engagement",
    label: "Community Engagement",
    shortLabel: "Community Engagement",
    href: "/use-cases/community-engagement",
    description: "Activate your user base with incentives that reward meaningful participation across your ecosystem.",
    eyebrow: "Participation programs that reward real engagement",
    hero:
      "Move beyond vanity metrics and reward the users who consistently show up, contribute, and deepen the health of your community.",
    body: [
      "FundLoop helps projects run participation programs that are grounded in actual user activity. Instead of measuring success by impressions or one-off clicks, teams can focus on repeated, meaningful engagement.",
      "That could mean rewarding learners, contributors, organizers, testers, or power users depending on how your community works and what kinds of behavior you want to reinforce.",
      "Done well, this creates a healthier loop: users understand what matters, teams can measure progress, and the community feels that contributions are noticed.",
    ],
    reasons: [
      "Communities lose energy when recognition and rewards feel random.",
      "Teams need a cleaner way to translate activity into recurring incentives.",
      "Monthly aggregation gives projects a consistent cadence for reviewing community health.",
    ],
    outcomes: [
      "Measure engagement monthly at the user level.",
      "Reward depth and consistency instead of one-off clicks.",
      "Give communities a clearer reason to come back.",
    ],
  },
  {
    slug: "give-back",
    label: "Give Back",
    shortLabel: "Give Back",
    href: "/use-cases/give-back",
    description: "Support citizen salary or universal basic income style distributions tied to real engagement.",
    eyebrow: "Citizen salary and shared upside",
    hero:
      "Dedicate part of your project's upside to the people who make the ecosystem work through citizen salary or universal-basic-income style distributions.",
    body: [
      "Give Back is the clearest expression of FundLoop's broader economic model. Projects contribute some of the value they create, and that value flows back to the users whose participation keeps the network healthy.",
      "This is not just philanthropy. It is a structural way to align project success with community well-being, so the people generating activity and network effects can share in the upside.",
      "For projects that care about fairness, sustainability, or economic inclusion, this turns those values into an operational distribution model.",
    ],
    reasons: [
      "Projects often want to give back, but lack a fair mechanism for doing it.",
      "Recurring community distributions can reinforce trust and belonging.",
      "Shared upside models align ecosystem growth with user well-being.",
    ],
    outcomes: [
      "Route value back to active users instead of extracting from them.",
      "Experiment with recurring community distributions.",
      "Align project growth with community well-being.",
    ],
  },
  {
    slug: "viral-growth",
    label: "Viral Growth",
    shortLabel: "Viral Growth",
    href: "/use-cases/viral-growth",
    description: "Turn aligned projects and users into a discovery loop that compounds awareness, referrals, and retention.",
    eyebrow: "Network effects with better incentives",
    hero:
      "Create a growth loop where rewarded participation increases discovery, retention, and word of mouth across the wider ecosystem.",
    body: [
      "Viral Growth in FundLoop is not just a referral mechanic. It is a system where users have a reason to explore aligned projects because meaningful participation can lead to future upside.",
      "That changes how discovery works. Instead of every project buying attention separately, projects benefit from the energy of the wider network and the curiosity of users who are already active elsewhere in the ecosystem.",
      "The effect compounds when projects are aligned: more participation improves more datasets, which improves more distributions, which gives users another reason to stay involved.",
    ],
    reasons: [
      "Isolated growth channels are expensive and decay quickly.",
      "Aligned incentives can turn exploration into a recurring habit.",
      "Projects benefit when user momentum carries across the ecosystem.",
    ],
    outcomes: [
      "Turn active users into repeat advocates.",
      "Make ecosystem discovery feel rewarding, not forced.",
      "Compound growth across multiple aligned projects.",
    ],
  },
]

export const useCaseLinks = useCases.map(({ slug, label, shortLabel, href, description }) => ({
  slug,
  label,
  shortLabel,
  href,
  description,
}))

export function getUseCaseBySlug(slug: string) {
  return useCases.find((useCase) => useCase.slug === slug)
}
