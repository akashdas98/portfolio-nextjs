---
name: visual-design
description: >
  Use when implementing or substantially modifying stylized visual treatments,
  decorative systems, hero compositions, backgrounds, illustrations,
  animations, or other appearance-led frontend work.
---

# Visual Design

Use this skill for work where visual character and composition matter beyond
ordinary UI correctness.

The goal is not merely to produce valid CSS or a polished component.
The rendered result must feel deliberately composed.

## 1. Inspect before designing

Before making substantial visual changes:

1. Run the application.
2. Inspect the existing page in the browser.
3. Capture or inspect representative desktop and mobile views.
4. Understand:
   - typography
   - hierarchy
   - whitespace
   - existing visual language
   - content focal points
   - responsive behavior
5. Preserve established design decisions unless the task explicitly replaces them.

Do not infer the final appearance from source code alone.

## 2. Treat stylized visuals as composition

Decorative visuals are not wallpaper.

Consider:

- focal areas
- visual weight
- negative space
- directional flow
- foreground/background separation
- density
- rhythm
- asymmetry versus balance
- interaction with typography
- where the eye enters and leaves the composition

Compose around the content rather than uniformly filling available space.

The primary content must remain visually dominant unless explicitly instructed
otherwise.

## 3. Build a visual grammar first

For procedural or repeated artwork, define a small coherent grammar before
implementation.

Examples:

- allowed shapes
- line weights
- corner styles
- spacing ranges
- orientation rules
- node types
- density rules
- repetition rules
- exceptions
- layering
- motion behavior

Prefer a small number of strongly related motifs over many arbitrary decorative
elements.

Repeated elements should appear to belong to the same designed system.

## 4. Prefer authored structure over random decoration

Randomness is acceptable only when constrained by deliberate composition rules.

Avoid:

- uniform random scattering
- generic particles
- arbitrary glowing dots
- meaningless tech lines
- excessive gradients
- decorative noise with no relationship to the concept
- default "futuristic / cyberpunk / AI startup" aesthetics

When procedural generation is used, constrain it using composition zones,
density maps, deterministic seeds, exclusion regions, or explicit anchor points.

Important compositions should remain stable between page loads unless variation
is itself part of the intended design.

## 5. Choose the appropriate medium

Use the simplest rendering method that preserves the intended result.

Prefer:

### CSS

For:

- simple geometry
- gradients
- texture
- straightforward decorative layers

### SVG

For:

- authored line art
- diagrams
- paths
- circuit-like systems
- geometric illustration
- scalable decorative compositions
- path animation

SVG is generally preferred when the artwork has meaningful geometry.

### Canvas

For:

- large numbers of dynamic elements
- procedural animation
- simulations
- continuously changing systems

### WebGL

Only when the visual concept materially benefits from depth, shaders, large
particle systems, or GPU rendering.

Do not introduce Canvas/WebGL merely because the visual is complex.

## 6. Protect content readability

Decorative systems must accommodate content rather than merely sit beneath it.

Create exclusion or low-density zones around:

- primary headlines
- important supporting copy
- primary CTAs
- navigation
- critical interactive controls

Where decoration approaches text, control:

- opacity
- contrast
- density
- line weight
- motion
- blur/glow

Do not solve every conflict by putting an opaque rectangle behind the content.

## 7. Responsive design means recomposition

Do not merely scale desktop artwork down for mobile.

At narrow viewports:

- reduce decorative density
- remove secondary motifs
- reposition focal elements
- shorten or reroute paths
- simplify animation
- preserve the visual idea with fewer elements

Mobile should feel intentionally composed rather than cropped.

## 8. Animation must belong to the concept

Motion should reveal or reinforce the visual system.

Good examples:

- signals moving through circuitry
- paths drawing themselves
- mechanical elements reacting
- subtle state changes
- meaningful parallax
- restrained response to pointer or scroll position

Avoid animation added only to make the page "feel alive."

Prefer a few legible motions over constant ambient activity.

Respect `prefers-reduced-motion`.

## 9. Implement in layers

For substantial stylized work:

1. Establish static composition.
2. Inspect it in-browser.
3. Fix hierarchy and density.
4. Add responsive behavior.
5. Inspect desktop and mobile again.
6. Add motion last.
7. Check performance.
8. Perform final visual review.

Do not begin with animation before the static composition works.

## 10. Perform visual iteration

After implementation, inspect the rendered result rather than assuming the code
produced the intended design.

At minimum review:

- normal desktop viewport
- narrower desktop / laptop viewport
- representative mobile viewport

Evaluate:

- Does the eye go to the intended place first?
- Is one side unintentionally heavier?
- Is decoration competing with content?
- Are there awkward empty areas?
- Are repeated motifs obviously procedural?
- Does the concept read immediately?
- Does anything look like generic generated UI decoration?
- Does mobile retain the same visual identity?
- Is motion distracting when observed for several seconds?

If the answer to any of these is unsatisfactory, revise and inspect again.

## 11. Preserve performance

Decorative visuals must not compromise the page.

Be especially careful with:

- continuous React state updates
- huge DOM/SVG element counts
- expensive blur filters
- large animated shadows
- layout-triggering animation
- unnecessary rerenders
- Canvas work on the main thread
- oversized raster assets

Prefer transforms and opacity for animation where practical.

## 12. Visual task briefs are authoritative

A task may provide specific art direction such as:

- composition
- references
- motifs
- prohibited aesthetics
- geometry rules
- animation language
- responsive behavior

Treat those instructions as the visual specification for that task.

Do not replace a distinctive visual direction with a safer generic interpretation
merely because it is easier to implement.

When implementation details are unspecified, choose techniques that preserve the
visual concept rather than simplifying the concept to fit the technique.
