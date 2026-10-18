import { expect, test } from "bun:test"
import { createMarkdownParser } from "./marked-parser"

const parser = createMarkdownParser((code, language) => `<pre data-language="${language}">${code}</pre>`)

// KaTeX round-trips the original TeX into <annotation encoding="application/x-tex">, so it
// has to be stripped before asserting that no raw TeX leaked into the visible transcript.
function visible(html: string) {
  return html.replace(/<annotation[^>]*>[\s\S]*?<\/annotation>/g, "")
}

test("renders links with application attributes", async () => {
  expect(await parser.parse("[OpenCode](https://opencode.ai)")).toBe(
    '<p><a href="https://opencode.ai" class="external-link" target="_blank" rel="noopener noreferrer">OpenCode</a></p>\n',
  )
})

test("renders inline and block math", async () => {
  expect(await parser.parse("\\(x^2\\)")).toContain('<span class="katex">')
  expect(await parser.parse("$$\nx^2\n$$\n")).toContain('<span class="katex-display">')
})

test("renders dollar-delimited inline math from the Fourier response", async () => {
  const html = await parser.parse(
    "Also, for integer $n$: the impulses at $0,\\pm2\\pi,\\pm4\\pi,\\ldots$ lie in $[-\\pi,\\pi]$.",
  )
  expect(html.match(/class="katex"/g)).toHaveLength(3)
  expect(visible(html)).not.toContain("$")
  expect(visible(html)).not.toContain("\\pm")
})

test("keeps currency, escaped dollars, and code out of inline math", async () => {
  for (const text of ["Pay $5 and $10.", "Pay $5.00 or $10.00.", "a $ spaced $ b", "\\$x\\$", "`$x$`"]) {
    expect(await parser.parse(text)).not.toContain("katex")
  }
  const html = await parser.parse("Use $x_i + y_j$ and $\\text{cost: \\$5}$.")
  expect(html.match(/class="katex"/g)).toHaveLength(2)
  expect(html).not.toContain("katex-error")
})

test("starts display math after prose before setext headings and lists can split it", async () => {
  for (const delimiters of [
    ["\\[", "\\]"],
    ["$$", "$$"],
  ]) {
    const html = await parser.parse(
      `Because \\(u[n]=u_e[n]+u_o[n]\\),\n${delimiters[0]}\nU(e^{j\\Omega})\n=\n\\underbrace{\\frac12+\n\\frac{1+e^{-j\\Omega}}{2(1-e^{-j\\Omega})}}_{\\text{combine these fractions}}\n+\\pi\\sum_p\\delta(\\Omega-2\\pi p).\n${delimiters[1]}\n\nAfter`,
    )
    expect(html.match(/class="katex-display"/g)).toHaveLength(1)
    expect(html).not.toContain("<h1>")
    expect(html).not.toContain("<ul>")
    expect(html).not.toContain("katex-error")
    expect(visible(html)).not.toContain("\\underbrace")
    expect(html).toContain("After")
  }
})

test("preserves ordinary setext headings next to display math", async () => {
  const html = await parser.parse("Heading\n=======\n\nBefore\n\\[\nx\n=\ny\n\\]\n\nAfter\n-----")
  expect(html).toContain("<h1>Heading</h1>")
  expect(html).toContain("<h2>After</h2>")
  expect(html.match(/class="katex-display"/g)).toHaveLength(1)
})

test("renders bracket-delimited display math", async () => {
  expect(await parser.parse("\\[x^2\\]")).toContain('<span class="katex-display">')
  expect(await parser.parse("\\[\nx^2\n\\]\n")).toContain('<span class="katex-display">')
})

test("renders display math that models emit mid-sentence", async () => {
  const html = await parser.parse("Each term contains \\[u\\left(t-k+\\frac12\\right)\\] and stops there.")
  expect(html).toContain('<span class="katex-display">')
  expect(visible(html)).not.toContain("\\left")
  expect(visible(html)).not.toContain("\\frac12")
  expect(visible(html)).not.toContain("[")
  expect(html).toContain("and stops there.")
})

test("keeps control sequences from closing a math span early", async () => {
  const html = await parser.parse("\\[\\left[a\\right] + \\left(b\\right)\\]")
  expect(html).toContain('<span class="katex-display">')
  expect(visible(html)).not.toContain("\\right")
  // A single annotation holding the whole expression proves it was not split at `\right]`.
  expect(html).toContain(">\\left[a\\right] + \\left(b\\right)</annotation>")
})

test("renders inline math that wraps across a source line", async () => {
  const html = await parser.parse("value \\(a +\nb\\) end")
  expect(html).toContain('<span class="katex">')
  expect(visible(html)).not.toContain("\\(")
})

test("renders single-line display math", async () => {
  expect(await parser.parse("$$x^2$$")).toContain('<span class="katex-display">')
})

test("leaves escaped brackets alone when they are not math", async () => {
  expect(await parser.parse("a \\[ b")).not.toContain("katex")
  expect(await parser.parse("first \\[\n\nsecond\\] third")).not.toContain("katex")
})

test("does not treat escaped brackets inside inline code as math", async () => {
  const html = await parser.parse("use `\\[x\\]` here")
  expect(html).not.toContain("katex")
  expect(html).toContain("<code>")
})

test("marks svg fences for diagram rendering instead of highlighting them", async () => {
  let highlighted = false
  const marked = createMarkdownParser(() => {
    highlighted = true
    return "<pre></pre>"
  })
  const html = await marked.parse('```svg\n<svg viewBox="0 0 1 1"><text>a & b</text></svg>\n```\n')
  expect(html).toBe(
    '<pre data-markdown-svg=""><code class="language-svg">&lt;svg viewBox=&quot;0 0 1 1&quot;&gt;&lt;text&gt;a &amp; b&lt;/text&gt;&lt;/svg&gt;</code></pre>\n',
  )
  expect(highlighted).toBe(false)
})

test("uses the configured code highlighter", async () => {
  expect(await parser.parse("```ts\nconst value = 1\n```\n")).toBe('<pre data-language="ts">const value = 1</pre>\n')
})
