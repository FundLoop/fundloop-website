export type PublicPrimaryLinkId = "founders" | "participation" | "projects" | "documentation" | "blog" | "support"
export type ResourceLinkId =
  | "participation"
  | "founders"
  | "documentation"
  | "reports"
  | "faq"
  | "support"
  | "integrations"
  | "mcp"

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

export const resourceLinks = [
  {
    id: "participation",
    href: "/participation",
    label: "Participation",
    description: "How people join projects, build signal, manage proof, and receive rewards through FundLoop.",
  },
  {
    id: "founders",
    href: "/founders",
    label: "Founder path",
    description: "What founders commit to, how support works, and what teams manage once they join FundLoop.",
  },
  {
    id: "documentation",
    href: "/documentation",
    label: "Documentation",
    description: "Guides, implementation notes, and support articles for using the platform.",
  },
  {
    id: "reports",
    href: "/reports",
    label: "Reports",
    description: "Understand what FundLoop publishes publicly about monthly cycles, verified contributions, and future transparency.",
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
    id: "integrations",
    href: "/documentation#protocol-and-integrations",
    label: "Integrations",
    description: "See the product, protocol, and integration surface FundLoop is documenting for developers, partners, and agents.",
  },
  {
    id: "mcp",
    href: "/mcp",
    label: "MCP Server",
    description: "Connect authenticated agents to FundLoop workflow tools, resources, prompts, and deployment guidance.",
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
