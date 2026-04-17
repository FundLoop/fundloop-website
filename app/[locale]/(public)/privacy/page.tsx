import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function PrivacyPage() {
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
        <h1 className="text-3xl md:text-4xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-slate-600 dark:text-slate-300 text-sm mb-8">Last updated: April 1, 2023</p>

        <div className="prose prose-slate dark:prose-invert max-w-none">
          <h2>1. Introduction</h2>
          <p>
            At FundLoop ("we," "our," or "us"), we respect your privacy and are committed to protecting your personal
            information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when
            you use our website, services, and applications (collectively, the "Services").
          </p>
          <p>
            Please read this Privacy Policy carefully. By accessing or using the Services, you acknowledge that you have
            read, understood, and agree to be bound by this Privacy Policy.
          </p>

          <h2>2. Information We Collect</h2>
          <p>We collect several types of information from and about users of our Services:</p>
          <h3>2.1 Personal Information</h3>
          <p>
            Personal information is information that identifies you as an individual. We may collect the following
            personal information:
          </p>
          <ul>
            <li>Name</li>
            <li>Email address</li>
            <li>Wallet address</li>
            <li>Demographic information (age, gender, location)</li>
            <li>Occupation</li>
            <li>Skills and interests</li>
          </ul>

          <h3>2.2 Project Information</h3>
          <p>If you register as a project, we may collect:</p>
          <ul>
            <li>Project name</li>
            <li>Website</li>
            <li>Description</li>
            <li>Contact information</li>
            <li>Logo</li>
            <li>Categories</li>
            <li>Payment information</li>
          </ul>

          <h3>2.3 Usage Information</h3>
          <p>We may automatically collect certain information about your use of the Services, including:</p>
          <ul>
            <li>IP address</li>
            <li>Browser type</li>
            <li>Device information</li>
            <li>Operating system</li>
            <li>Pages visited</li>
            <li>Time and date of visits</li>
            <li>Referring website</li>
            <li>Other statistics</li>
          </ul>

          <h2>3. How We Use Your Information</h2>
          <p>We may use the information we collect for various purposes, including:</p>
          <ul>
            <li>Providing, maintaining, and improving the Services</li>
            <li>Processing transactions and sending related information</li>
            <li>Sending administrative messages, such as updates, security alerts, and support messages</li>
            <li>Responding to your comments, questions, and requests</li>
            <li>Facilitating the citizen salary program</li>
            <li>Connecting users with relevant projects</li>
            <li>Analyzing usage patterns and trends</li>
            <li>Personalizing your experience</li>
            <li>Protecting the security and integrity of the Services</li>
            <li>Complying with legal obligations</li>
          </ul>

          <h2>4. How We Share Your Information</h2>
          <p>We may share your information in the following circumstances:</p>
          <h3>4.1 With Projects</h3>
          <p>
            If you are a user, we may share anonymized participation data with projects in the ecosystem. This helps
            projects understand user engagement and improve their services.
          </p>

          <h3>4.2 With Service Providers</h3>
          <p>
            We may share your information with third-party service providers who perform services on our behalf, such as
            payment processing, data analysis, email delivery, hosting, and customer service.
          </p>

          <h3>4.3 For Legal Reasons</h3>
          <p>
            We may disclose your information if required to do so by law or in response to valid requests by public
            authorities (e.g., a court or government agency).
          </p>

          <h3>4.4 Business Transfers</h3>
          <p>
            If we are involved in a merger, acquisition, or sale of all or a portion of our assets, your information may
            be transferred as part of that transaction.
          </p>

          <h3>4.5 With Your Consent</h3>
          <p>We may share your information with third parties when you have given us your consent to do so.</p>

          <h2>5. Data Security</h2>
          <p>
            We implement appropriate technical and organizational measures to protect your information from unauthorized
            access, disclosure, alteration, and destruction. However, no method of transmission over the Internet or
            electronic storage is 100% secure, and we cannot guarantee absolute security.
          </p>

          <h2>6. Your Rights and Choices</h2>
          <p>Depending on your location, you may have certain rights regarding your personal information, including:</p>
          <ul>
            <li>Accessing your personal information</li>
            <li>Correcting inaccurate or incomplete information</li>
            <li>Deleting your personal information</li>
            <li>Restricting or objecting to the processing of your information</li>
            <li>Data portability</li>
            <li>Withdrawing consent</li>
          </ul>
          <p>
            To exercise these rights, please contact us using the information provided in the "Contact Us" section
            below.
          </p>

          <h2>7. Cookies and Similar Technologies</h2>
          <p>
            We use cookies and similar technologies to collect information about your browsing activities and to
            distinguish you from other users of the Services. This helps us provide you with a good experience when you
            use the Services and allows us to improve the Services.
          </p>
          <p>
            For more information about cookies and how to control them, please see our{" "}
            <Link href="/cookies" className="text-emerald-600 dark:text-emerald-400 hover:underline">
              Cookie Policy
            </Link>
            .
          </p>

          <h2>8. Children's Privacy</h2>
          <p>
            The Services are not intended for children under the age of 18. We do not knowingly collect personal
            information from children under 18. If you are a parent or guardian and believe that your child has provided
            us with personal information, please contact us, and we will delete such information from our systems.
          </p>

          <h2>9. International Data Transfers</h2>
          <p>
            Your information may be transferred to, and processed in, countries other than the country in which you
            reside. These countries may have data protection laws that are different from the laws of your country.
          </p>
          <p>
            By using the Services, you consent to the transfer of your information to countries outside your country of
            residence, including the United States, where different data protection standards may apply.
          </p>

          <h2>10. Changes to This Privacy Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. The updated version will be indicated by an updated
            "Last updated" date, and the updated version will be effective as soon as it is accessible. We encourage you
            to review this Privacy Policy frequently to stay informed about how we are protecting your information.
          </p>

          <h2>11. Contact Us</h2>
          <p>If you have any questions about this Privacy Policy or our privacy practices, please contact us at:</p>
          <p>
            Email:{" "}
            <a href="mailto:privacy@fundloop.org" className="text-emerald-600 dark:text-emerald-400 hover:underline">
              privacy@fundloop.org
            </a>
          </p>
          <p>Postal Address: FundLoop Privacy Office, 123 Main Street, Anytown, AN 12345</p>
        </div>
      </div>
    </div>
  )
}
