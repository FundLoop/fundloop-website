import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function CookiesPage() {
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
        <h1 className="text-3xl md:text-4xl font-bold mb-4">Cookie Policy</h1>
        <p className="text-slate-600 dark:text-slate-300 text-sm mb-8">Last updated: April 1, 2023</p>

        <div className="prose prose-slate dark:prose-invert max-w-none">
          <h2>1. Introduction</h2>
          <p>
            This Cookie Policy explains how FundLoop ("we," "our," or "us") uses cookies and similar technologies on our
            website, services, and applications (collectively, the "Services").
          </p>
          <p>
            By using the Services, you consent to the use of cookies and similar technologies in accordance with this
            Cookie Policy.
          </p>

          <h2>2. What Are Cookies?</h2>
          <p>
            Cookies are small text files that are stored on your device (computer, tablet, or mobile phone) when you
            visit a website. They are widely used to make websites work more efficiently, provide a better user
            experience, and give website owners information about how users interact with their sites.
          </p>
          <p>
            Cookies may be set by the website you are visiting (first-party cookies) or by other websites that provide
            content on the page you are viewing (third-party cookies).
          </p>

          <h2>3. Types of Cookies We Use</h2>
          <p>We use the following types of cookies on our Services:</p>

          <h3>3.1 Essential Cookies</h3>
          <p>
            These cookies are necessary for the Services to function properly. They enable core functionality such as
            security, network management, and account access. You cannot opt out of these cookies.
          </p>

          <h3>3.2 Performance Cookies</h3>
          <p>
            These cookies collect information about how you use the Services, such as which pages you visit most often
            and if you encounter any errors. This information helps us improve the performance of the Services and
            enhance your user experience.
          </p>

          <h3>3.3 Functionality Cookies</h3>
          <p>
            These cookies allow the Services to remember choices you make (such as your username, language, or region)
            and provide enhanced, personalized features. They may also be used to provide services you have requested,
            such as watching a video or commenting on a blog.
          </p>

          <h3>3.4 Targeting/Advertising Cookies</h3>
          <p>
            These cookies are used to deliver advertisements that are more relevant to you and your interests. They are
            also used to limit the number of times you see an advertisement and to help measure the effectiveness of
            advertising campaigns.
          </p>

          <h2>4. Similar Technologies</h2>
          <p>In addition to cookies, we may use other similar technologies on our Services, including:</p>

          <h3>4.1 Web Beacons</h3>
          <p>
            Web beacons (also known as clear gifs, pixel tags, or web bugs) are tiny graphics with a unique identifier
            that are used to track the online movements of web users or to access cookies. Unlike cookies, which are
            stored on your device, web beacons are embedded invisibly on web pages.
          </p>

          <h3>4.2 Local Storage</h3>
          <p>
            Local storage, such as HTML5 localStorage and indexedDB, is a way to store data on your device that is
            similar to cookies but can store larger amounts of data and is more secure.
          </p>

          <h2>5. How to Manage Cookies</h2>
          <p>
            Most web browsers allow you to control cookies through their settings. You can typically find these settings
            in the "Options" or "Preferences" menu of your browser. You can also use the "Help" feature in your browser
            for more information.
          </p>
          <p>
            Please note that if you choose to block or delete cookies, you may not be able to access certain areas or
            features of our Services, and some functionality may be impaired.
          </p>
          <p>Here are links to instructions for managing cookies in common browsers:</p>
          <ul>
            <li>
              <a
                href="https://support.google.com/chrome/answer/95647"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Google Chrome
              </a>
            </li>
            <li>
              <a
                href="https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Mozilla Firefox
              </a>
            </li>
            <li>
              <a
                href="https://support.apple.com/guide/safari/manage-cookies-and-website-data-sfri11471/mac"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Safari
              </a>
            </li>
            <li>
              <a
                href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Microsoft Edge
              </a>
            </li>
          </ul>

          <h2>6. Changes to This Cookie Policy</h2>
          <p>
            We may update this Cookie Policy from time to time. The updated version will be indicated by an updated
            "Last updated" date, and the updated version will be effective as soon as it is accessible. We encourage you
            to review this Cookie Policy frequently to stay informed about how we are using cookies.
          </p>

          <h2>7. Contact Us</h2>
          <p>If you have any questions about this Cookie Policy, please contact us at:</p>
          <p>
            Email:{" "}
            <a href="mailto:privacy@fundloop.org" className="text-emerald-600 dark:text-emerald-400 hover:underline">
              privacy@fundloop.org
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
