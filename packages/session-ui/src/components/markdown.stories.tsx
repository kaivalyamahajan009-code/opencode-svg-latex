// @ts-nocheck
import { createSignal, onCleanup, onMount } from "solid-js"
import * as mod from "./markdown"
import { create } from "@opencode-ai/ui/storybook/scaffold"
import { markdown } from "@opencode-ai/ui/storybook/fixtures"

const flowchart = [
  '<svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg">',
  "  <title>Debug loop flowchart</title>",
  "  <style>",
  "    text { font: 500 15px system-ui, sans-serif; text-anchor: middle; dominant-baseline: middle; }",
  "    .sub { font-size: 12px; font-weight: 400; }",
  "    .label { font-size: 13px; fill: #c9c7c0; }",
  "  </style>",
  "  <defs>",
  '    <marker id="gray" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#8a8984"/></marker>',
  '    <marker id="green" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#34d399"/></marker>',
  '    <marker id="orange" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#f97316"/></marker>',
  "  </defs>",
  '  <rect x="250" y="20" width="140" height="44" rx="8" fill="#45443f" stroke="#6b6a64"/>',
  '  <text x="320" y="42" fill="#e8e6df">Start</text>',
  '  <line x1="320" y1="64" x2="320" y2="104" stroke="#8a8984" stroke-width="1.5" marker-end="url(#gray)"/>',
  '  <rect x="215" y="106" width="210" height="60" rx="8" fill="#0b4a8b" stroke="#3b82f6"/>',
  '  <text x="320" y="128" fill="#e6f0ff">Is it working?</text>',
  '  <text class="sub" x="320" y="150" fill="#9cc3ff">Check the result</text>',
  '  <polyline points="215,136 110,136 110,222" fill="none" stroke="#34d399" stroke-width="1.5" marker-end="url(#green)"/>',
  '  <text class="label" x="150" y="122">Yes</text>',
  '  <rect x="40" y="224" width="140" height="48" rx="8" fill="#064e3b" stroke="#10b981"/>',
  '  <text x="110" y="248" fill="#a7f3d0">Ship it</text>',
  '  <polyline points="425,136 530,136 530,222" fill="none" stroke="#f97316" stroke-width="1.5" marker-end="url(#orange)"/>',
  '  <text class="label" x="490" y="122">No</text>',
  '  <rect x="460" y="224" width="140" height="48" rx="8" fill="#7c2d12" stroke="#f97316"/>',
  '  <text x="530" y="248" fill="#fed7aa">Debug</text>',
  '  <line x1="508" y1="224" x2="428" y2="158" stroke="#f97316" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#orange)"/>',
  "</svg>",
].join("\n")

const diagram = [
  "Here is the loop most debugging sessions follow:",
  "",
  "```svg",
  flowchart,
  "```",
  "",
  "The dashed line is the debug loop feeding back into the check.",
].join("\n")

function StreamingMarkdown() {
  const [size, setSize] = createSignal(0)
  onMount(() => {
    const timer = setInterval(() => {
      setSize((current) => {
        const next = Math.min(diagram.length, current + 10)
        if (next === diagram.length) clearInterval(timer)
        return next
      })
    }, 70)
    onCleanup(() => clearInterval(timer))
  })
  return <mod.Markdown text={diagram.slice(0, size())} streaming={size() < diagram.length} cacheKey="svg-stream" />
}

const docs = `### Overview
Render sanitized Markdown with code blocks, inline code, and safe links.

Pair with \`Code\` for standalone code views.

### API
- Required: \`text\` Markdown string.
- Uses the Marked context provider for parsing and sanitization.

### Variants and states
- Code blocks include copy buttons when rendered.

### Behavior
- Sanitizes HTML and auto-converts inline URL code to links.
- Adds copy buttons to code blocks.

### Accessibility
- Copy buttons include aria-labels from i18n.
- TODO: confirm link target behavior in sanitized output.

### Theming/tokens
- Uses \`data-component="markdown"\` and related slots for styling.

`

const story = create({
  title: "UI/Markdown",
  mod,
  args: {
    text: markdown,
  },
})

export default {
  title: "UI/Markdown",
  id: "components-markdown",
  component: story.meta.component,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: docs,
      },
    },
  },
}

export const Basic = story.Basic

/** A fenced ```svg block renders as an isolated inline diagram with a copy action. */
export const Diagram = { args: { text: diagram } }

/** While the fence is open the diagram shows the opencode loader and its <title>. */
export const StreamingDiagram = { render: () => <StreamingMarkdown /> }

/** Source that is not well-formed SVG falls back to the code with a notice. */
export const InvalidDiagram = {
  args: { text: 'Broken output:\n\n```svg\n<svg viewBox="0 0 10 10"><rect width="10"\n```\n' },
}

/** Scripts, event handlers and remote references are stripped before rendering. */
export const UntrustedDiagram = {
  args: {
    text: [
      "```svg",
      '<svg viewBox="0 0 200 60" onload="alert(1)">',
      "  <script>alert(2)</script>",
      '  <image href="https://example.com/track.png" width="10" height="10"/>',
      '  <a href="javascript:alert(3)"><rect width="200" height="60" rx="8" fill="#1f6feb"/></a>',
      '  <text x="100" y="35" fill="#fff" text-anchor="middle" font-family="sans-serif">safe &amp; sound</text>',
      "</svg>",
      "```",
    ].join("\n"),
  },
}
