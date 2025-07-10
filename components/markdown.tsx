import React from "react"

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function renderMarkdown(md: string): string {
  const lines = md.split(/\n/)
  let html = ""
  let inList = false

  const closeList = () => {
    if (inList) {
      html += "</ul>"
      inList = false
    }
  }

  for (const line of lines) {
    if (line.startsWith("- ")) {
      if (!inList) {
        html += "<ul>"
        inList = true
      }
      html += `<li>${escapeHtml(line.slice(2))}</li>`
      continue
    }

    closeList()

    if (line.startsWith("### ")) {
      html += `<h3>${escapeHtml(line.slice(4))}</h3>`
    } else if (line.startsWith("## ")) {
      html += `<h2>${escapeHtml(line.slice(3))}</h2>`
    } else if (line.startsWith("# ")) {
      html += `<h1>${escapeHtml(line.slice(2))}</h1>`
    } else if (line.trim() === "") {
      html += ""
    } else {
      let text = escapeHtml(line)
      text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      text = text.replace(/\*(.*?)\*/g, "<em>$1</em>")
      text = text.replace(/`([^`]+)`/g, "<code>$1</code>")
      html += `<p>${text}</p>`
    }
  }

  closeList()
  return html
}

export default function Markdown({ content }: { content: string }) {
  const html = React.useMemo(() => renderMarkdown(content), [content])
  return (
    <div
      className="prose dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
