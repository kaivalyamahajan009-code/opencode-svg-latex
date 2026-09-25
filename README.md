# opencode: inline SVG diagrams and LaTeX fixes

Changes to the [opencode](https://github.com/anomalyco/opencode) desktop app's chat transcript:

- **Inline SVG diagrams.** Fenced ` ```svg ` blocks in assistant replies render as diagrams instead of code.
- **Loading animation.** While a diagram is still streaming, a card shows opencode's grid progress indicator next to the diagram's `<title>`.
- **LaTeX fixes.** `\[ … \]` display math renders (even mid-sentence), `\( … \)` can wrap across lines, `$$ … $$` works on one line, and display math is no longer split into list items while a reply streams.

This repository contains only the changed files, not a runnable copy of opencode.

## Applying the changes

The patch was made against opencode commit `f5ce4f8` (desktop version 1.18.31).

```sh
git clone https://github.com/anomalyco/opencode.git
cd opencode
git checkout f5ce4f8
git am /path/to/opencode-svg-latex.patch
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
| `opencode-svg-latex.patch` | The whole change as a single `git am` patch |

## Security

Diagrams are displayed through `<img>` with a `data:` URL, so scripts never run and remote resources are never fetched. `<script>`, `foreignObject`, event handlers and non-local links are also removed from the source before rendering. Invalid SVG is shown as code with an "Unable to load image." notice.

## License

MIT, same as opencode. See [LICENSE](LICENSE).
