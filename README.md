# opencode: inline SVG diagrams and LaTeX fixes

Changes to the [opencode](https://github.com/anomalyco/opencode) desktop app's chat transcript:

- **Inline SVG diagrams.** Fenced ` ```svg ` blocks in assistant replies render as diagrams instead of code.
- **Loading animation.** While a diagram is still streaming, a card shows opencode's grid progress indicator next to the diagram's `<title>`.
- **LaTeX fixes.** `$ … $` inline math renders with safeguards for currency, escaped dollars, and code. `\[ … \]` display math renders (even mid-sentence), `\( … \)` can wrap across lines, and `$$ … $$` works on one line. Display equations immediately after prose stay intact even when an equation contains a standalone `=` or list-like lines, and complete streamed math is protected from Markdown repair that mistakes TeX subscripts for emphasis.

This repository contains only the changed files, not a runnable copy of opencode.

## Applying the changes

The original patch was made against opencode commit `f5ce4f8` (desktop version 1.18.31). Apply the follow-up LaTeX patch after it:

```sh
git clone https://github.com/anomalyco/opencode.git
cd opencode
git checkout f5ce4f8
git am /path/to/opencode-svg-latex.patch
git am /path/to/0001-fix-app-correct-inline-and-streamed-latex-rendering.patch
```

On newer opencode versions the patch may need small conflict fixes. The files under `packages/` show the final version of every changed file at the same paths as in opencode.

## What's in here

| File | Purpose |
| --- | --- |
| `packages/session-ui/src/components/markdown-svg.tsx` | Diagram widget: loading card, rendered image, error fallback, copy button |
| `packages/session-ui/src/components/markdown-svg-source.ts` | Validates, repairs, sanitizes and sizes SVG source |
| `packages/session-ui/src/components/markdown.tsx` | Routes ` ```svg ` blocks to the widget, for both streamed and finished messages |
| `packages/session-ui/src/components/markdown.css` | Styles for the diagram and loading card |
| `packages/session-ui/src/components/markdown-stream.ts` | Streaming block splitter now respects display-math blocks |
| `packages/ui/src/context/marked-parser.tsx` | LaTeX delimiter tokenizers and the ` ```svg ` marker |
| `packages/opencode/src/session/system.ts`, `prompt.ts` | Tells the model it may answer with ` ```svg ` when running in the desktop app |
| `*.test.ts`, `markdown.stories.tsx` | Tests and Storybook demos (rendered, streaming, broken and hostile diagrams) |
| `opencode-svg-latex.patch` | The original SVG and LaTeX changes as a `git am` patch |
| `0001-fix-app-correct-inline-and-streamed-latex-rendering.patch` | Follow-up inline-dollar, display-boundary, and streaming-repair fixes |

## LaTeX regression verification

The follow-up fixes were verified in the full OpenCode workspace with 59 targeted Markdown tests and type checking in both `packages/ui` and `packages/session-ui`. Regressions cover the recovered Fourier-response examples, character-by-character streaming followed by completion, ordinary setext headings, currency, escaped dollars, and inline code.

This repository is a source-and-patch bundle. Applying the patches does not update an already-running desktop binary; rebuild and relaunch the desktop app to use the changes.

## Security

Diagrams are displayed through `<img>` with a `data:` URL, so scripts never run and remote resources are never fetched. `<script>`, `foreignObject`, event handlers and non-local links are also removed from the source before rendering. Invalid SVG is shown as code with an "Unable to load image." notice.

## License

MIT, same as opencode. See [LICENSE](LICENSE).
