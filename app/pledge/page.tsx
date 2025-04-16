import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "The FundLoop Pledge | FundLoop",
  description: "The official FundLoop Pledge for participating projects",
}

export default function PledgePage() {
  return (
    <div className="container max-w-3xl py-12">
      <h1 className="text-4xl font-bold mb-8">The FundLoop Pledge</h1>

      <div className="prose dark:prose-invert max-w-none">
        <p className="text-xl mb-6">By joining FundLoop, projects commit to the following pledge:</p>

        <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800 mb-8">
          <p className="italic text-lg">
            "We pledge to anonymously sync our users and contribute 1% of our revenue to the FundLoop ecosystem, which
            will be distributed as citizen salary to active participants. We believe in building a more equitable
            digital economy where value is shared with all who contribute to its success."
          </p>
        </div>

        <h2 className="text-2xl font-bold mt-8 mb-4">What This Means</h2>

        <h3 className="text-xl font-semibold mt-6 mb-2">1. User Synchronization</h3>
        <p>
          Projects agree to securely and anonymously share basic user activity data with the FundLoop network. This
          allows the ecosystem to track participation across multiple projects while preserving user privacy. No
          personally identifiable information is shared without explicit user consent.
        </p>

        <h3 className="text-xl font-semibold mt-6 mb-2">2. Revenue Contribution</h3>
        <p>
          Projects commit to contributing 1% of their revenue to the FundLoop ecosystem fund. This contribution is
          calculated on a monthly basis and is used to fund the citizen salary program.
        </p>

        <h3 className="text-xl font-semibold mt-6 mb-2">3. Citizen Salary Distribution</h3>
        <p>
          The collected funds are distributed equally among all active participants in the ecosystem. Activity is
          measured by meaningful participation across FundLoop projects, creating a virtuous cycle that rewards engaged
          users and incentivizes project growth.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4">Benefits to Projects</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Access to a growing network of engaged users</li>
          <li>Increased user retention through ecosystem-wide incentives</li>
          <li>Cross-promotion opportunities with other aligned projects</li>
          <li>Participation in building a more equitable digital economy</li>
          <li>Enhanced brand reputation through commitment to shared prosperity</li>
        </ul>

        <h2 className="text-2xl font-bold mt-8 mb-4">Verification and Compliance</h2>
        <p>
          FundLoop provides tools and APIs to help projects implement the necessary tracking and contribution
          mechanisms. Projects undergo a simple verification process to ensure compliance with the pledge terms.
        </p>

        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-lg border border-emerald-200 dark:border-emerald-800 mt-8">
          <h3 className="text-xl font-semibold mb-2">Ready to Join?</h3>
          <p className="mb-4">
            By signing the FundLoop Pledge, you're joining a movement to create a more equitable digital economy where
            prosperity is shared among all participants.
          </p>
          <a
            href="/#project-signup"
            className="inline-block px-6 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white font-medium rounded-md"
          >
            Register Your Project
          </a>
        </div>
      </div>
    </div>
  )
}
