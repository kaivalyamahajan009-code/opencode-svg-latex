import { createMemo, createSignal, onMount, Show, type Accessor, type Setter } from "solid-js"
import { render } from "solid-js/web"
import { Spinner } from "@opencode-ai/ui/spinner"
import { TextShimmer } from "@opencode-ai/ui/text-shimmer"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import { SessionProgressIndicatorV2 } from "../v2/components/session-progress-indicator-v2"
import { prepareSvg, svgTitle } from "./markdown-svg-source"

export type SvgLabels = {
  copy: string
  copied: string
  loading: string
  error: string
  alt: string
}

export type SvgProps = {
  source: string
  complete: boolean
  labels: SvgLabels
}

function MarkdownSvg(props: { state: Accessor<SvgProps> }) {
  let frame: HTMLDivElement | undefined
  const [color, setColor] = createSignal<string>()
  const [copied, setCopied] = createSignal(false)
  const newLayout = typeof document !== "undefined" && document.body.hasAttribute("data-new-layout")
  const source = createMemo(() => props.state().source)
  const complete = createMemo(() => props.state().complete)
  const labels = () => props.state().labels
  const title = createMemo(() => svgTitle(source()))
  const prepared = createMemo(() => {
    const value = color()
    if (!complete() || value === undefined) return undefined
    return prepareSvg(source(), value)
  })
  let reset: ReturnType<typeof setTimeout> | undefined

  // The host is attached right after render(), so resolve the inherited colour on the next tick.
  onMount(() => queueMicrotask(() => setColor((frame && getComputedStyle(frame).color) || "#888888")))

  const copy = async () => {
    const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard
    if (!clipboard) return
    await clipboard.writeText(source())
    setCopied(true)
    if (reset) clearTimeout(reset)
    reset = setTimeout(() => setCopied(false), 2000)
  }

  const copyButton = () => {
    const label = () => (copied() ? labels().copied : labels().copy)
    return (
      <div data-slot="markdown-svg-copy" data-copied={copied() ? "true" : undefined}>
        <TooltipV2 placement="top" value={label()}>
          <IconButtonV2
            type="button"
            size="normal"
            variant="ghost-muted"
            aria-label={label()}
            onClick={() => void copy()}
            icon={<IconV2 name={copied() ? "check" : "outline-copy"} />}
          />
        </TooltipV2>
      </div>
    )
  }

  return (
    <div ref={frame} data-slot="markdown-svg-frame">
      <Show
        when={complete()}
        fallback={
          <div data-slot="markdown-svg-loading" role="status" aria-live="polite">
            <span data-slot="markdown-svg-spinner">
              <Show when={newLayout} fallback={<Spinner />}>
                <SessionProgressIndicatorV2 />
              </Show>
            </span>
            <TextShimmer text={title() ?? labels().loading} />
          </div>
        }
      >
        <Show when={color() !== undefined}>
          <Show
            when={prepared()}
            fallback={
              <div data-slot="markdown-svg-error">
                <div data-slot="markdown-svg-error-message">{labels().error}</div>
                <pre class="shiki OpenCode">
                  <code>{source()}</code>
                </pre>
                {copyButton()}
              </div>
            }
          >
            {(svg) => (
              <figure data-slot="markdown-svg-figure">
                <img
                  data-slot="markdown-svg-image"
                  src={svg().url}
                  alt={svg().title ?? title() ?? labels().alt}
                  width={svg().width}
                  height={svg().height}
                  draggable={false}
                />
                {copyButton()}
              </figure>
            )}
          </Show>
        </Show>
      </Show>
    </div>
  )
}

type SvgHostState = {
  set: Setter<SvgProps>
  dispose: () => void
}

const svgHosts = new WeakMap<HTMLElement, SvgHostState>()

export function createSvgHost() {
  const host = document.createElement("div")
  host.setAttribute("data-component", "markdown-svg")
  return host
}

export function isSvgHost(node: Node): node is HTMLElement {
  return node instanceof HTMLElement && node.getAttribute("data-component") === "markdown-svg"
}

/** Mounts the diagram into `host` on first call and updates it in place afterwards. */
export function updateSvgHost(host: HTMLElement, props: SvgProps) {
  const existing = svgHosts.get(host)
  if (existing) {
    existing.set(props)
    return
  }
  const state: Partial<SvgHostState> = {}
  state.dispose = render(() => {
    const [value, set] = createSignal(props)
    state.set = set
    return <MarkdownSvg state={value} />
  }, host)
  svgHosts.set(host, state as SvgHostState)
}

export function disposeSvgHosts(root: Element) {
  const hosts = [
    ...(isSvgHost(root) ? [root] : []),
    ...Array.from(root.querySelectorAll('[data-component="markdown-svg"]')).filter(isSvgHost),
  ]
  for (const host of hosts) {
    svgHosts.get(host)?.dispose()
    svgHosts.delete(host)
  }
}
