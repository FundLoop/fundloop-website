import Hero from "@/components/hero"
import Benefits from "@/components/benefits"
import ProjectSignup from "@/components/project-signup"
import UserSignup from "@/components/user-signup"
import AlignedProjects from "@/components/aligned-projects"
import AlignedUsers from "@/components/aligned-users"
import Analytics from "@/components/analytics"
import SupportWidget from "@/components/support-widget"
import BlogPreview from "@/components/blog-preview"
import NewsletterSignup from "@/components/newsletter-signup"

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <Hero />
      <Benefits id="benefits" />
      <div className="container mx-auto px-4 py-12 md:py-24 grid gap-12 md:gap-24">
        <div className="grid md:grid-cols-2 gap-8">
          <ProjectSignup />
          <UserSignup />
        </div>
        <AlignedProjects />
        <AlignedUsers />
        <Analytics />
        <BlogPreview />
        <SupportWidget />
      </div>
      <NewsletterSignup />
    </div>
  )
}
