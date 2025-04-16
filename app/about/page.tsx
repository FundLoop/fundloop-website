import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, ArrowRight, Users, Building2, Globe2 } from "lucide-react"

export default function AboutPage() {
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
        <h1 className="text-3xl md:text-4xl font-bold mb-4">About FundLoop</h1>
        <p className="text-slate-600 dark:text-slate-300 text-lg mb-8">
          FundLoop is a revolutionary network state that creates a sustainable economic ecosystem through mutual aid and
          shared prosperity.
        </p>

        <div className="relative w-full h-64 md:h-80 rounded-xl overflow-hidden mb-8">
          <Image src="/placeholder.svg?height=400&width=800" alt="FundLoop Community" fill className="object-cover" />
        </div>

        <div className="space-y-8 mb-12">
          <section>
            <h2 className="text-2xl font-bold mb-4">Our Mission</h2>
            <p className="text-slate-600 dark:text-slate-300 mb-4">
              FundLoop's mission is to create a self-sustaining digital nation with shared prosperity, demonstrating a
              new model for economic cooperation in the digital age.
            </p>
            <p className="text-slate-600 dark:text-slate-300">
              We believe that by connecting projects and users in a mutually beneficial ecosystem, we can create a more
              equitable distribution of resources and opportunities for all participants.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-6 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center">
                    <div className="bg-emerald-100 dark:bg-emerald-900/30 p-3 rounded-full mb-4">
                      <Building2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="font-bold mb-2">Projects Pledge 1%</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Projects join FundLoop by pledging to contribute 1% of their revenue to the ecosystem.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center">
                    <div className="bg-cyan-100 dark:bg-cyan-900/30 p-3 rounded-full mb-4">
                      <Users className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <h3 className="font-bold mb-2">Users Participate</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Users join the ecosystem and actively participate in aligned projects.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center">
                    <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full mb-4">
                      <Globe2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="font-bold mb-2">Citizen Salary</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Active users receive a monthly citizen salary funded by project contributions.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              This creates a virtuous cycle: as more projects join, more funds are available for citizen salaries,
              attracting more users to the ecosystem, which in turn benefits the projects through increased engagement
              and growth.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Our Vision</h2>
            <p className="text-slate-600 dark:text-slate-300 mb-4">
              We envision a future where network states like FundLoop demonstrate new models of economic cooperation and
              governance, creating more equitable and sustainable systems for all participants.
            </p>
            <p className="text-slate-600 dark:text-slate-300">
              By aligning incentives between projects and users, we're building a community that values contribution,
              participation, and mutual support—creating prosperity that's shared by all.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Join the Movement</h2>
            <p className="text-slate-600 dark:text-slate-300 mb-6">
              Whether you're a project looking to grow your user base while making a positive impact, or an individual
              seeking to participate in a new economic model, FundLoop welcomes you to join our community.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                asChild
                className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700"
              >
                <Link href="/#project-signup">
                  Join as a Project <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/#user-signup">
                  Join as a User <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </section>
        </div>

        <section className="border-t pt-8">
          <h2 className="text-2xl font-bold mb-4">Our Team</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex flex-col items-center text-center">
              <div className="relative w-24 h-24 rounded-full overflow-hidden mb-4">
                <Image src="/placeholder.svg?height=100&width=100" alt="Team Member" fill className="object-cover" />
              </div>
              <h3 className="font-bold">Alex Rivera</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">Founder & CEO</p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="relative w-24 h-24 rounded-full overflow-hidden mb-4">
                <Image src="/placeholder.svg?height=100&width=100" alt="Team Member" fill className="object-cover" />
              </div>
              <h3 className="font-bold">Jamie Chen</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">CTO</p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="relative w-24 h-24 rounded-full overflow-hidden mb-4">
                <Image src="/placeholder.svg?height=100&width=100" alt="Team Member" fill className="object-cover" />
              </div>
              <h3 className="font-bold">Sam Washington</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">Community Lead</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
