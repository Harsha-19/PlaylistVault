---
version: alpha
name: Spotify Dark
description: A high-contrast, music-first dark interface with bright green accents and rounded utility controls.
colors:
  primary: "#1ed760"
  secondary: "#ffffff"
  tertiary: "#7c7c7c"
  neutral: "#121212"
  surface: "#242424"
  on-surface: "#b3b3b3"
  error: "#ff4d4f"
  border: "#374151"
  overlay: "#000000"
typography:
  headline-display:
    fontFamily: SpotifyMixUITitle
    fontSize: 24px
    fontWeight: 400
    lineHeight: 29px
    letterSpacing: 0px
  headline-lg:
    fontFamily: SpotifyMixUITitle
    fontSize: 22px
    fontWeight: 400
    lineHeight: 26px
    letterSpacing: 0px
  headline-md:
    fontFamily: SpotifyMixUI
    fontSize: 20px
    fontWeight: 400
    lineHeight: 24px
    letterSpacing: 0px
  headline-sm:
    fontFamily: SpotifyMixUI
    fontSize: 18px
    fontWeight: 400
    lineHeight: 22px
    letterSpacing: 0px
  body-lg:
    fontFamily: SpotifyMixUI
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
    letterSpacing: 0px
  body-md:
    fontFamily: SpotifyMixUI
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
    letterSpacing: 0px
  body-sm:
    fontFamily: SpotifyMixUI
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
    letterSpacing: 0px
  label-lg:
    fontFamily: SpotifyMixUI
    fontSize: 16px
    fontWeight: 700
    lineHeight: 20px
    letterSpacing: 0px
  label-md:
    fontFamily: SpotifyMixUI
    fontSize: 14px
    fontWeight: 700
    lineHeight: 18px
    letterSpacing: 0px
  label-sm:
    fontFamily: SpotifyMixUI
    fontSize: 12px
    fontWeight: 700
    lineHeight: 16px
    letterSpacing: 0px
  caption-md:
    fontFamily: SpotifyMixUI
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
    letterSpacing: 0px
  utility-sm:
    fontFamily: SpotifyMixUI
    fontSize: 16px
    fontWeight: 400
    lineHeight: 16px
    letterSpacing: 0px
rounded:
  none: 0px
  sm: 4px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px
spacing:
  xs: 6px
  sm: 16px
  md: 28px
  lg: 48px
  xl: 172px
components:
  button-primary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.overlay}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "8px 32px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.overlay}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "8px 32px"
    height: "48px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.secondary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "8px 32px"
    height: "48px"
  button-secondary-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "8px 32px"
    height: "48px"
  button-tertiary:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-lg}"
    rounded: "{rounded.none}"
    padding: "0px"
    height: "auto"
  card:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    padding: "16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.full}"
    padding: "8px 16px"
    height: "48px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "6px 12px"
  sidebar-panel:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    padding: "16px"
  footer-banner:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.secondary}"
    typography: "{typography.body-lg}"
    rounded: "{rounded.none}"
    padding: "16px"
---

# Spotify Dark

## Overview
Spotify’s interface feels modern, energetic, and utility-first, designed for users who want fast access to music discovery and playback without visual clutter. The dark backdrop creates a cinematic, content-forward stage where album art and artist photography carry most of the emotion. Interaction is confident and familiar: bright white controls, subtle gray metadata, and a vivid green accent keep the experience unmistakably Spotify.

## Colors
- **Primary (#1ed760):** The signature green accent used sparingly for emphasis, success, and brand energy. It should feel active and unmistakable, never as a heavy background color.
- **Secondary (#ffffff):** Crisp white used for key actions, important headings, and high-contrast foreground elements like primary buttons and selected UI text.
- **Tertiary (#7c7c7c):** A muted mid-gray for borders, secondary UI chrome, and understated dividers. It helps controls stay visible without competing with content.
- **Neutral (#121212):** The foundational near-black page color. This is the dominant canvas for panels, sidebars, and the overall dark theme.
- **Surface (#242424):** A slightly lifted dark gray for interactive surfaces such as inputs, chips, and small panels. It creates separation without breaking the low-light mood.
- **On-surface (#b3b3b3):** The main body copy and metadata color. It is intentionally softer than white so lists, captions, and helper text recede appropriately.
- **Error (#ff4d4f):** Reserved for destructive states and validation messages only. It should remain rare and high-signal.
- **Border (#374151):** A dark structural border tone for card edges and inset separation when needed.
- **Overlay (#000000):** Pure black used for the strongest contrast in text and icon treatment on bright controls.

## Typography
The system uses Spotify’s custom sans families: SpotifyMixUI for most UI text and SpotifyMixUITitle for the strongest headings. Headline styles are light-weight, clean, and compact, with no visible uppercase treatment or tracking tricks; the hierarchy comes from size and spacing rather than decorative styling. Body text stays at 16px or below with generous readability, while labels and buttons rely on 700 weight to create clarity inside small, rounded controls.

Use `headline-display`, `headline-lg`, `headline-md`, and `headline-sm` for section titles and content headers. Use `body-lg`, `body-md`, and `body-sm` for metadata, descriptions, and utility text. Use `label-lg`, `label-md`, and `label-sm` for buttons, chips, and navigation actions where stronger weight improves scanability.

## Layout
The layout is a wide, desktop-first, fixed-structure composition with a left navigation rail, a large content canvas, and persistent top-level utility areas. Spacing follows a loose rhythm based on 6px, 16px, 28px, and 48px increments, with large breathing room between content rows and tighter spacing inside cards and controls. Sections are separated more by vertical whitespace and content grouping than by heavy rules or boxes.

Panels and cards use modest internal padding, typically around 16px, while major content modules keep edge-to-edge album grids with consistent gutters. The left sidebar feels dense but controlled, while the main feed remains spacious enough for visual browsing. The bottom promotional banner spans the full width as a persistent call-to-action strip.

## Elevation & Depth
This interface is intentionally flat, with almost no dramatic shadowing. Depth is created through tonal contrast, border accents, and image-driven hierarchy rather than through layered surfaces. When elevation is needed, it is subtle: small shadows, faint outlines, and slightly lighter surfaces distinguish controls from the dark background.

Cards and inputs often rely on contrast instead of depth, with the `card` and `input` styles using dark fills and restrained borders. The result feels modern, calm, and efficient rather than tactile or glossy.

## Shapes
The shape language is soft and approachable, with a strong preference for pill forms on action controls. Major buttons, chips, and search-related elements use `rounded.full` to create friendly, immediately recognizable interactive targets. Content cards are only mildly rounded with `rounded.sm`, keeping album art and panels crisp and grid-aligned.

This balance makes the product feel both playful and efficient: controls are inviting, but the content containers stay disciplined.

## Components
Buttons are highly consistent and easy to parse. The primary button (`button-primary`) is white with black text, bold label styling, full pill rounding, and 8px vertical by 32px horizontal padding. Secondary buttons (`button-secondary`) are transparent with white text and a subtle gray border, preserving contrast on the dark background. Tertiary actions (`button-tertiary`) should remain text-only and understated, using no border or fill. Hover states can shift toward stronger contrast or a soft surface tint, but should never become bulky or colorful.

Cards use `card` styling: dark background, 8px radius, 16px padding, and restrained border treatment. They should feel like containers for browsing lists, playlist prompts, and content modules rather than like elevated UI surfaces. Keep internal text muted with `on-surface`, and let album art provide the visual richness.

Inputs should use a rounded pill shape with a dark surface fill and light text. They should be compact, horizontally generous, and minimal in chrome, with focus states handled through contrast and border emphasis rather than large shadows. The search bar is the model interaction: simple, readable, and centered on quick task completion.

Chips and small filters should use `chip` styling: pill-shaped, surface-colored, and typographically compact. Sidebar panels should follow `sidebar-panel` to preserve the dark rail aesthetic while maintaining readability. Promotional strips or app-install banners should use `footer-banner` with strong brand color, bright text, and no rounding to stand apart from the rest of the interface.

## Do's and Don'ts
- Do keep the interface dark, with large areas of `neutral` background and minimal visual noise.
- Do use `primary` green sparingly for emphasis so it feels special and brand-defining.
- Do favor bold white text for actionable items and softened gray for metadata and secondary copy.
- Do keep corners either fully pill-shaped or lightly rounded; avoid inconsistent radius values.
- Do rely on whitespace and content grouping for hierarchy instead of heavy shadows or glossy effects.
- Don't introduce bright gradients, neon outlines, or decorative color overlays that compete with album art.
- Don't make buttons square, oversized, or heavily shadowed; the control language should stay compact and friendly.
- Don't use uppercase-heavy typography or tight tracking as a default; Spotify’s tone is clean, not shouty.