import katex from "katex"
import { Marked, type MarkedExtension, type Tokens } from "marked"
import markedShiki from "marked-shiki"

export function createMarkdownParser(highlight: (code: string, language: string) => string | Promise<string>) {
  return new Marked(
    {
      renderer: {
        link({ href, title, text }) {
          const titleAttr = title ? ` title="${title}"` : ""
          return `<a href="${href}"${titleAttr} class="external-link" target="_blank" rel="noopener noreferrer">${text}</a>`
        },
      },
    },
    katexExtension,
    markedShiki({
      highlight: (code, language) =>
        language.toLowerCase() === "svg" ? svgCodeBlock(code) : highlight(code, language),
    }),
  )
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

// ```svg fences are marked for the transcript to render as a diagram. Anything that does not
// know about the marker still shows an ordinary (unhighlighted) code block.
function svgCodeBlock(code: string) {
  return `<pre data-markdown-svg=""><code class="language-svg">${escapeHtml(code)}</code></pre>`
}

// A math body is any run that does not contain the closing delimiter. The `\\[\s\S]`
// branch consumes a control sequence whole, so `\left(`, `\right]` and `\\` cannot close
// the span early, while the lazy quantifier still stops at the first real delimiter.
const inlineParenRegex = /^\\\(((?:\\[\s\S]|[^\\])+?)\\\)/
const inlineBracketRegex = /^\\\[((?:\\[\s\S]|[^\\])+?)\\\]/
const inlineDollarRegex = /^\$(?![\s$])((?:\\[\s\S]|[^\\$])+?)\$(?![\d$])/
const blockBracketRegex = /^[ \t]*\\\[((?:\\[\s\S]|[^\\])+?)\\\][ \t]*(?:\n+|$)/
const blockDollarRegex = /^[ \t]*\$\$([\s\S]+?)\$\$[ \t]*(?:\n+|$)/

// Math never spans a blank line. Bailing out keeps an unmatched `\[` from swallowing the
// rest of the document while a response is still streaming in.
function mathToken(type: string, displayMode: boolean, match: RegExpMatchArray | null) {
  if (!match) return undefined
  const text = match[1].trim()
  if (!text || /\n[ \t]*\n/.test(match[1])) return undefined
  return { type, raw: match[0], text, displayMode }
}

function startAt(src: string, delimiter: string) {
  const index = src.indexOf(delimiter)
  if (index === -1) return undefined
  return index
}

function mathBlockStart(src: string) {
  for (const match of src.matchAll(/^[ \t]*(?:\\\[|\$\$)/gm)) {
    const rest = src.slice(match.index)
    if (mathToken("", true, rest.match(blockBracketRegex) ?? rest.match(blockDollarRegex))) return match.index
  }
  return undefined
}

const blockMathExtensions = [
  {
    name: "blockKatexBracket",
    level: "block" as const,
    start: mathBlockStart,
    tokenizer(src: string) {
      return mathToken("blockKatexBracket", true, src.match(blockBracketRegex))
    },
    renderer: renderKatexToken,
  },
  {
    name: "blockKatex",
    level: "block" as const,
    tokenizer(src: string) {
      return mathToken("blockKatex", true, src.match(blockDollarRegex))
    },
    renderer: renderKatexToken,
  },
]

/**
 * Block-level math tokenizers on their own. Anything that splits markdown into blocks
 * (e.g. the streaming projector) must use these, otherwise lines inside a display-math
 * block that start with `+`, `-` or `1.` get lexed as lists and the block is torn apart.
 */
export const mathBlockExtension: MarkedExtension = {
  extensions: blockMathExtensions,
  tokenizer: {
    lheading(src) {
      // Marked checks setext headings before extension start hints. An '=' inside math
      // must not turn all the preceding prose and the opening delimiter into a heading.
      const heading = this.rules.block.lheading.exec(src)
      if (!heading) return false
      const start = mathBlockStart(src)
      if (start !== undefined && start < heading[0].length) return undefined
      return false
    },
  },
}

const katexExtension: MarkedExtension = {
  ...mathBlockExtension,
  extensions: [
    ...blockMathExtensions,
    {
      name: "inlineKatexDollar",
      level: "inline",
      start(src) {
        return startAt(src, "$")
      },
      tokenizer(src) {
        const match = src.match(inlineDollarRegex)
        // Whitespace at either boundary and a closing dollar followed by a digit are
        // currency/prose, while escaped dollars inside a math body remain valid TeX.
        if (match && /\s$/.test(match[1])) return undefined
        return mathToken("inlineKatexDollar", false, match)
      },
      renderer: renderKatexToken,
    },
    {
      name: "inlineKatex",
      level: "inline",
      start(src) {
        return startAt(src, "\\(")
      },
      tokenizer(src) {
        return mathToken("inlineKatex", false, src.match(inlineParenRegex))
      },
      renderer: renderKatexToken,
    },
    {
      // `\[ ... \]` is display math, but models routinely emit it mid-sentence, so it has
      // to be tokenized inline as well. Without this marked's escape rule turns the
      // delimiters into literal brackets and leaks the raw TeX into the transcript.
      name: "inlineKatexBracket",
      level: "inline",
      start(src) {
        return startAt(src, "\\[")
      },
      tokenizer(src) {
        return mathToken("inlineKatexBracket", true, src.match(inlineBracketRegex))
      },
      renderer: renderKatexToken,
    },
  ],
}

function renderKatexToken(token: Tokens.Generic) {
  return katex.renderToString(typeof token.text === "string" ? token.text : "", {
    displayMode: token.displayMode === true,
    throwOnError: false,
  })
}
