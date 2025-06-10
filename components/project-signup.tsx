"use client"

import { useState } from "react"
import { Modal } from "@/components/modal"
import ProjectSignupStep1 from "@/components/project-signup-step1"
import ProjectSignupFlow from "@/components/project-signup-flow"

export default function ProjectSignup() {
  const [projectData, setProjectData] = useState<{
    id: number
    slug: string
    name: string
    website: string
    description: string
  } | null>(null)
  const [openFlow, setOpenFlow] = useState(false)

  const handleSuccess = (data: {
    id: number
    slug: string
    name: string
    website: string
    description: string
  }) => {
    setProjectData(data)
    setOpenFlow(true)
  }

  return (
    <>
      <ProjectSignupStep1 onSuccess={handleSuccess} />
      <Modal
        title="Continue Project Signup"
        isOpen={openFlow}
        onClose={() => setOpenFlow(false)}
        size="lg"
      >
        <ProjectSignupFlow
          onClose={() => setOpenFlow(false)}
          initialStep={2}
          initialProject={projectData || undefined}
        />
      </Modal>
    </>
  )
}
