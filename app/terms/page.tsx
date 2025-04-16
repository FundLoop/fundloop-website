import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex items-center gap-2 mb-8">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Home</span>
          </Link>
        </Button>
      </div>

      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">Terms of Service</h1>
        <p className="text-slate-600 dark:text-slate-300 text-sm mb-8">Last updated: April 1, 2023</p>

        <div className="prose prose-slate dark:prose-invert max-w-none">
          <h2>1. Introduction</h2>
          <p>
            Welcome to FundLoop ("we," "our," or "us"). These Terms of Service ("Terms") govern your access to and use
            of the FundLoop website, services, and applications (collectively, the "Services").
          </p>
          <p>
            By accessing or using the Services, you agree to be bound by these Terms. If you do not agree to these
            Terms, you may not access or use the Services.
          </p>

          <h2>2. Eligibility</h2>
          <p>
            You must be at least 18 years old to use the Services. By using the Services, you represent and warrant that
            you are at least 18 years old and have the legal capacity to enter into these Terms.
          </p>

          <h2>3. Account Registration</h2>
          <p>
            To access certain features of the Services, you may need to register for an account. You agree to provide
            accurate, current, and complete information during the registration process and to update such information
            to keep it accurate, current, and complete.
          </p>
          <p>
            You are responsible for safeguarding your account credentials and for all activities that occur under your
            account. You agree to notify us immediately of any unauthorized use of your account.
          </p>

          <h2>4. The 1% Pledge (For Projects)</h2>
          <p>
            Projects that join FundLoop agree to contribute 1% of their revenue to the FundLoop ecosystem. This
            contribution is used to fund the citizen salary program, which distributes funds equally to all active users
            within the ecosystem.
          </p>
          <p>
            By registering as a project, you agree to make this contribution in accordance with the payment terms
            specified during registration. Failure to make the agreed-upon contributions may result in the termination
            of your participation in the ecosystem.
          </p>

          <h2>5. Citizen Salary (For Users)</h2>
          <p>
            Users who join FundLoop may be eligible to receive a citizen salary, which is funded by the 1% contributions
            from projects. Eligibility for the citizen salary is based on active participation in the ecosystem, as
            determined by our participation metrics.
          </p>
          <p>
            The amount of the citizen salary may vary based on the total funds collected and the number of active users.
            We do not guarantee any specific amount or frequency of payments.
          </p>

          <h2>6. User Conduct</h2>
          <p>You agree not to use the Services to:</p>
          <ul>
            <li>Violate any applicable law or regulation</li>
            <li>Infringe the rights of any third party</li>
            <li>Harass, abuse, or harm another person</li>
            <li>Send spam or other unsolicited messages</li>
            <li>Interfere with the proper functioning of the Services</li>
            <li>Attempt to gain unauthorized access to the Services or related systems</li>
          </ul>

          <h2>7. Intellectual Property</h2>
          <p>
            The Services and all content and materials included on the Services, including text, graphics, logos,
            images, and software, are the property of FundLoop or its licensors and are protected by copyright,
            trademark, and other intellectual property laws.
          </p>
          <p>
            We grant you a limited, non-exclusive, non-transferable, and revocable license to access and use the
            Services for their intended purposes, subject to these Terms.
          </p>

          <h2>8. Privacy</h2>
          <p>
            Our Privacy Policy, available at{" "}
            <Link href="/privacy" className="text-emerald-600 dark:text-emerald-400 hover:underline">
              fundloop.org/privacy
            </Link>
            , describes how we collect, use, and share information about you when you use the Services. By using the
            Services, you agree to the collection, use, and sharing of your information as described in the Privacy
            Policy.
          </p>

          <h2>9. Termination</h2>
          <p>
            We may terminate or suspend your access to the Services at any time, with or without cause, and with or
            without notice. Upon termination, your right to use the Services will immediately cease.
          </p>

          <h2>10. Disclaimer of Warranties</h2>
          <p>
            THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR
            IMPLIED, INCLUDING, BUT NOT LIMITED TO, IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
            PURPOSE, AND NON-INFRINGEMENT.
          </p>

          <h2>11. Limitation of Liability</h2>
          <p>
            IN NO EVENT WILL FUNDLOOP, ITS AFFILIATES, OR THEIR LICENSORS, SERVICE PROVIDERS, EMPLOYEES, AGENTS,
            OFFICERS, OR DIRECTORS BE LIABLE FOR DAMAGES OF ANY KIND, UNDER ANY LEGAL THEORY, ARISING OUT OF OR IN
            CONNECTION WITH YOUR USE, OR INABILITY TO USE, THE SERVICES, INCLUDING ANY DIRECT, INDIRECT, SPECIAL,
            INCIDENTAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES.
          </p>

          <h2>12. Changes to Terms</h2>
          <p>
            We may revise these Terms at any time by updating this page. Your continued use of the Services after any
            such changes constitutes your acceptance of the new Terms.
          </p>

          <h2>13. Governing Law</h2>
          <p>
            These Terms and your use of the Services shall be governed by and construed in accordance with the laws of
            the jurisdiction in which FundLoop is established, without regard to its conflict of law provisions.
          </p>

          <h2>14. Contact Information</h2>
          <p>
            If you have any questions about these Terms, please contact us at{" "}
            <a href="mailto:legal@fundloop.org" className="text-emerald-600 dark:text-emerald-400 hover:underline">
              legal@fundloop.org
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
