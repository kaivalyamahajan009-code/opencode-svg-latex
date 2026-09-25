const SVG_NS = "http://www.w3.org/2000/svg"
const XLINK_NS = "http://www.w3.org/1999/xlink"
const MAX_SOURCE_LENGTH = 1_000_000

// Elements that can execute code or embed foreign documents. The diagram is rendered through
// <img>, which already refuses to run them, but the source is also what users copy.
const BLOCKED_ELEMENTS = new Set(["script", "foreignobject", "iframe", "object", "embed", "audio", "video"])

// HTML named entities models routinely emit. They are not defined in XML, so a single `&nbsp;`
// would otherwise make the whole diagram fail to parse.
const HTML_ENTITIES: Record<string, string> = {
  nbsp: "#160",
  ndash: "#8211",
  mdash: "#8212",
  hellip: "#8230",
  times: "#215",
  divide: "#247",
  deg: "#176",
  middot: "#183",
  bull: "#8226",
  larr: "#8592",
  uarr: "#8593",
  rarr: "#8594",
  darr: "#8595",
  harr: "#8596",
  plusmn: "#177",
  le: "#8804",
  ge: "#8805",
  ne: "#8800",
  micro: "#181",
  copy: "#169",
}

export function isSvgLanguage(language: string | undefined) {
  return language?.trim().toLowerCase() === "svg"
}

function decodeText(text: string) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
}

/** The first `<title>`, readable as soon as it has streamed in, so the loader can say what is being drawn. */
export function svgTitle(source: string) {
  const text = source
    .match(/<title\b[^>]*>([^<]{1,200})<\/title>/i)?.[1]
    ?.replace(/\s+/g, " ")
    .trim()
  if (!text) return undefined
  return decodeText(text)
}

/** String-level repairs so typical model output parses as a standalone SVG document. */
export function normalizeSvgSource(source: string) {
  const text = source.trim().replace(/&([a-z]+);/gi, (entity, name: string) => {
    const code = HTML_ENTITIES[name.toLowerCase()]
    return code ? `&${code};` : entity
  })
  const open = text.match(/<svg\b[^>]*>/i)
  if (!open || open.index === undefined) return text
  let tag = open[0]
  if (!/\sxmlns\s*=/.test(tag)) tag = tag.replace(/^<svg\b/i, `<svg xmlns="${SVG_NS}"`)
  if (/\bxlink:/.test(text) && !/\sxmlns:xlink\s*=/.test(tag))
    tag = tag.replace(/^<svg\b/i, `<svg xmlns:xlink="${XLINK_NS}"`)
  return text.slice(0, open.index) + tag + text.slice(open.index + open[0].length)
}

function safeHref(value: string) {
  const href = value.trim()
  return href.startsWith("#") || /^data:image\/(?:png|jpe?g|gif|webp);/i.test(href)
}

function length(value: string | null) {
  const match = value?.match(/^\s*(\d+(?:\.\d+)?)\s*(?:px)?\s*$/)
  if (!match) return undefined
  const result = Number(match[1])
  return result > 0 ? result : undefined
}

export type PreparedSvg = {
  url: string
  width?: number
  height?: number
  title?: string
}

/**
 * Validates, strips and sizes an SVG so it can be shown through `<img>`. An image context never
 * runs scripts or fetches remote resources, and keeps the diagram's `<style>` and ids from
 * leaking into (or colliding with) the rest of the transcript.
 */
export function prepareSvg(source: string, color?: string): PreparedSvg | undefined {
  if (!source.trim() || source.length > MAX_SOURCE_LENGTH) return undefined
  if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") return undefined

  const doc = new DOMParser().parseFromString(normalizeSvgSource(source), "image/svg+xml")
  const root = doc.documentElement
  if (!root || root.namespaceURI !== SVG_NS || root.localName !== "svg") return undefined
  if (doc.getElementsByTagNameNS("*", "parsererror").length > 0) return undefined

  for (const element of [root, ...Array.from(root.querySelectorAll("*"))]) {
    if (BLOCKED_ELEMENTS.has(element.localName.toLowerCase())) {
      element.remove()
      continue
    }
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      if (name.startsWith("on")) element.removeAttributeNode(attribute)
      else if ((name === "href" || name === "xlink:href") && !safeHref(attribute.value))
        element.removeAttributeNode(attribute)
    }
  }

  // <img> needs an absolute size; percentage or missing dimensions fall back to the viewBox.
  const [, , boxWidth = 0, boxHeight = 0, ...rest] = (root.getAttribute("viewBox") ?? "")
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  const validBox = rest.length === 0 && boxWidth > 0 && boxHeight > 0
  const viewWidth = validBox ? boxWidth : undefined
  const viewHeight = validBox ? boxHeight : undefined
  const width = length(root.getAttribute("width")) ?? viewWidth
  const height = length(root.getAttribute("height")) ?? viewHeight
  if (width && length(root.getAttribute("width")) === undefined) root.setAttribute("width", String(width))
  if (height && length(root.getAttribute("height")) === undefined) root.setAttribute("height", String(height))

  // Lets `currentColor` follow the transcript's text color even though the image is isolated.
  if (color && !root.hasAttribute("color")) root.setAttribute("color", color)

  const title = root.querySelector("title")?.textContent?.replace(/\s+/g, " ").trim() || undefined
  const markup = new XMLSerializer().serializeToString(root)
  return { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`, width, height, title }
}
