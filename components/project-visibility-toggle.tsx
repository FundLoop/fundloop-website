"use client"

import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { Eye, EyeOff } from "lucide-react"
import { updateWithTracking } from "@/lib/db-utils"

interface ProjectVisibilityToggleProps {
  projectId: number
  isPublic: boolean
  onVisibilityChange?: (isPublic: boolean) => void
}

export function ProjectVisibilityToggle({ projectId, isPublic, onVisibilityChange }: ProjectVisibilityToggleProps) {
  const [isChecked, setIsChecked] = useState(isPublic)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleToggle = async (checked: boolean) => {
    setIsUpdating(true)

    try {
      // Use the updateWithTracking utility function
      const { error } = await updateWithTracking("projects", projectId, { is_public: checked })

      if (error) throw error

      setIsChecked(checked)

      toast({
        title: checked ? "Project is now public" : "Project is now private",
        description: checked
          ? "The project is visible to everyone."
          : "The project is only visible to organization members.",
      })

      if (onVisibilityChange) {
        onVisibilityChange(checked)
      }
    } catch (error) {
      console.error("Error updating project visibility:", error)
      toast({
        title: "Error",
        description: "Failed to update project visibility. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="flex items-center justify-between space-x-2">
      <div className="flex items-center space-x-2">
        {isChecked ? <Eye className="h-4 w-4 text-slate-500" /> : <EyeOff className="h-4 w-4 text-slate-500" />}
        <Label htmlFor="project-visibility" className="text-sm">
          {isChecked ? "Public project" : "Private project"}
        </Label>
      </div>
      <Switch
        id="project-visibility"
        checked={isChecked}
        onCheckedChange={handleToggle}
        disabled={isUpdating}
        aria-label="Toggle project visibility"
      />
    </div>
  )
}
