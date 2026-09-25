import { describe, expect, test } from "bun:test"
import { isSvgLanguage, normalizeSvgSource, svgTitle } from "./markdown-svg-source"

describe("markdown svg", () => {
  test("recognises svg fences regardless of case or padding", () => {
    expect(isSvgLanguage("svg")).toBe(true)
    expect(isSvgLanguage(" SVG ")).toBe(true)
    expect(isSvgLanguage("xml")).toBe(false)
    expect(isSvgLanguage(undefined)).toBe(false)
  })

  test("reads the title while the rest of the diagram is still streaming", () => {
    expect(svgTitle('<svg viewBox="0 0 10 10"><title>Double slit &amp; screen</title><rect')).toBe(
      "Double slit & screen",
    )
    expect(svgTitle('<svg viewBox="0 0 10 10"><title>Unfinished')).toBeUndefined()
    expect(svgTitle("<svg><title>  spaced\n  out </title></svg>")).toBe("spaced out")
  })

  test("adds the namespaces a standalone svg document needs", () => {
    expect(normalizeSvgSource('<svg viewBox="0 0 1 1"></svg>')).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>',
    )
    expect(normalizeSvgSource('<svg xmlns="http://www.w3.org/2000/svg"><use xlink:href="#a"/></svg>')).toBe(
      '<svg xmlns:xlink="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg"><use xlink:href="#a"/></svg>',
    )
  })

  test("leaves an already valid document untouched", () => {
    const source = '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>'
    expect(normalizeSvgSource(source)).toBe(source)
  })

  test("rewrites html entities that xml does not define", () => {
    expect(normalizeSvgSource('<svg xmlns="x"><text>a&nbsp;&rarr;&mdash;b &amp; &Omega;</text></svg>')).toBe(
      '<svg xmlns="x"><text>a&#160;&#8594;&#8212;b &amp; &Omega;</text></svg>',
    )
  })
})
