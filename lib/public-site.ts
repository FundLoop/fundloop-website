export type PublicPrimaryLinkId = "founders" | "participation" | "projects" | "documentation" | "blog" | "support"
export type PublicExploreLinkId = "projects" | "users" | "analytics" | "about"
export type ResourceLinkId = "participation" | "pricing" | "documentation" | "faq" | "support" | "api"

export const publicPrimaryLinks = [
  {
    id: "founders",
    href: "/founders",
    label: "Founders",
  },
  {
    id: "participation",
    href: "/participation",
    label: "Participation",
  },
  {
    id: "projects",
    href: "/projects",
    label: "Projects",
  },
  {
    id: "documentation",
    href: "/documentation",
    label: "Documentation",
  },
  {
    id: "blog",
    href: "/blog",
    label: "Blog",
  },
  {
    id: "support",
    href: "/support",
    label: "Support",
  },
] as const

export const publicExploreLinks = [
  {
    id: "projects",
    label: "Projects",
    href: "/projects",
    description: "Browse aligned projects already participating in the FundLoop network.",
  },
  {
    id: "users",
    label: "Users",
    href: "/users",
    description: "Meet the people shaping the ecosystem through real participation.",
  },
  {
    id: "analytics",
    label: "Analytics",
    href: "/analytics",
    description: "See how contribution, activity, and value circulation show up across the network.",
  },
  {
    id: "about",
    label: "About FundLoop",
    href: "/about",
    description: "Understand the mission, the 1% pledge, and the long-term economic thesis.",
  },
] as const

export const resourceLinks = [
  {
    id: "participation",
    href: "/participation",
    label: "Participation",
    description: "How people join projects, build signal, manage proof, and receive rewards through FundLoop.",
  },
  {
    id: "pricing",
    href: "/pricing",
    label: "Pricing",
    description: "How FundLoop stays free for users and how projects are asked to support the loop.",
  },
  {
    id: "documentation",
    href: "/documentation",
    label: "Documentation",
    description: "Guides, implementation notes, and support articles for using the platform.",
  },
  {
    id: "faq",
    href: "/faq",
    label: "FAQ",
    description: "Clear answers for founders, community members, and honest bots.",
  },
  {
    id: "support",
    href: "/support",
    label: "Support",
    description: "Get help when onboarding, profiles, payments, or project setup need a hand.",
  },
  {
    id: "api",
    href: "/api",
    label: "API",
    description: "A developer-facing preview of the integration surface FundLoop is growing toward.",
  },
] as const

export const ecosystemSites = [
  {
    name: "ChainCrew",
    url: "https://chaincrew.xyz",
    desc: "Team up in Crews to manage memberships, events, and community treasuries.",
  },
  {
    name: "ClearPass",
    url: "https://clearpass.app",
    desc: "KYC verification with NFC-enabled passports and driver's licenses.",
  },
  {
    name: "Cubid",
    url: "https://cubid.me",
    desc: "Privacy-preserving identity infrastructure with proofs and stamps.",
  },
  {
    name: "EquityFlow",
    url: "https://equityflow.xyz",
    desc: "Tools for equity and commitment-sharing among founders and teams.",
  },
  {
    name: "Firebelly",
    url: "https://firebelly.xyz",
    desc: "Innovation studio supporting regenerative and Web3 ventures.",
  },
  {
    name: "FundLoop",
    url: "https://fundloop.org",
    desc: "Collaborative incubator and funding network for early-stage projects.",
  },
  {
    name: "FreeForm",
    url: "https://usefreeform.com",
    desc: "A next-gen form builder with voting, branching, and identity options.",
  },
  {
    name: "GreenPill Canada",
    url: "https://greenpill.ca",
    desc: "Building local regenerative economies across Canada.",
  },
  {
    name: "GreenPill Toronto",
    url: "https://greenpill.to",
    desc: "Toronto's node of the global GreenPill network.",
  },
  {
    name: "I Am Human",
    url: "https://www.i-am-human.app/",
    desc: "Developer infrastructure for sybil resistance.",
  },
  {
    name: "Procent Foundation",
    url: "https://procentfoundation.com",
    desc: "A nonprofit supporting public goods and open innovation.",
  },
  {
    name: "Safe2Meet",
    url: "https://safe2meet.me",
    desc: "Safer in-person meetups for real estate, classifieds, and dating.",
  },
  {
    name: "Solar Village",
    url: "https://solarvillage.xyz",
    desc: "Carbon credits for off-grid solar projects in Africa.",
  },
  {
    name: "SmarTrust",
    url: "https://smartrust.me",
    desc: "AI-powered escrow and arbitration for freelancers, agencies, and B2B work.",
  },
  {
    name: "SnapVote",
    url: "https://snapvote.org",
    desc: "Fast, trustworthy decision-making and polls for communities.",
  },
  {
    name: "SpareChange",
    url: "https://sparechange.tips",
    desc: "Tip anyone with QR codes and digital micro-payments.",
  },
  {
    name: "TCOIN",
    url: "https://tcoin.me",
    desc: "Toronto's local community currency pegged to transit tokens.",
  },
  {
    name: "UBI Finder",
    url: "https://ubifinder.org",
    desc: "A global directory of Universal Basic Income projects.",
  },
] as const
