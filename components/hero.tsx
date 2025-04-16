"use client"

import { useState } from "react"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/modal"
import ProjectSignupFlow from "@/components/project-signup-flow"
import UserSignupFlow from "@/components/user-signup-flow"

export default function Hero() {
  const [projectModalOpen, setProjectModalOpen] = useState(false)
  const [userModalOpen, setUserModalOpen] = useState(false)

  return (
    <>
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 dark:from-emerald-500/10 dark:to-cyan-500/10" />
        <div className="container relative mx-auto px-4 py-24 md:py-32 flex flex-col items-center text-center">
          <div className="inline-block rounded-lg bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 text-sm font-medium text-emerald-800 dark:text-emerald-300 mb-6">
            Introducing FundLoop
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-cyan-600 dark:from-emerald-400 dark:to-cyan-400">
            A Network State for Mutual Prosperity
          </h1>
          <p className="max-w-[800px] text-slate-600 dark:text-slate-300 text-lg md:text-xl mb-8">
            Join a revolutionary ecosystem where projects pledge 1% of revenue to fund a universal citizen salary for
            all active members, creating a self-sustaining cycle of growth and shared prosperity.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              size="lg"
              className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700"
              onClick={() => setProjectModalOpen(true)}
            >
              Join as a Project <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="outline" size="lg" onClick={() => setUserModalOpen(true)}>
              Join as a User <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          +{" "}
          <p className="text-red-500 text-sm mt-4">
            + Pardon the mess while we get this site up and running. Dummy data only for no. Sign up to the newsletter at the bottom to get notified for early access. Or try clicking around. If it works it workd. If it doesn't it doesen't. But don't complain, help us fix it instead. Come chat here: https://t.me/+hXetzEyPGXQ0OGJh. +{" "}
          </p>
        </div>
      </div>

      {/* Project Signup Modal */}
      <Modal title="Join as a Project" isOpen={projectModalOpen} onClose={() => setProjectModalOpen(false)} size="lg">
        <ProjectSignupFlow onClose={() => setProjectModalOpen(false)} />
      </Modal>

      {/* User Signup Modal */}
      <Modal title="Join as a User" isOpen={userModalOpen} onClose={() => setUserModalOpen(false)} size="lg">
        <UserSignupFlow onClose={() => setUserModalOpen(false)} />
      </Modal>
    </>
  )
}
