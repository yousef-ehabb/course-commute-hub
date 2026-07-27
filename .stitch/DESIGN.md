---
name: Rakeb Administrative Interface
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434653'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737685'
  outline-variant: '#c3c6d6'
  surface-tint: '#2156ca'
  primary: '#00328a'
  on-primary: '#ffffff'
  primary-container: '#0047bb'
  on-primary-container: '#afc1ff'
  inverse-primary: '#b3c5ff'
  secondary: '#52606d'
  on-secondary: '#ffffff'
  secondary-container: '#d6e4f4'
  on-secondary-container: '#586673'
  tertiary: '#12367b'
  on-tertiary: '#ffffff'
  tertiary-container: '#2f4e93'
  on-tertiary-container: '#adc2ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b3c5ff'
  on-primary-fixed: '#00174a'
  on-primary-fixed-variant: '#003ea6'
  secondary-fixed: '#d6e4f4'
  secondary-fixed-dim: '#bac8d7'
  on-secondary-fixed: '#0f1d28'
  on-secondary-fixed-variant: '#3b4855'
  tertiary-fixed: '#dae2ff'
  tertiary-fixed-dim: '#b1c5ff'
  on-tertiary-fixed: '#001847'
  on-tertiary-fixed-variant: '#244488'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-md:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base-unit: 4px
  margin-mobile: 1rem
  margin-desktop: 2rem
  gutter: 1rem
  stack-sm: 0.5rem
  stack-md: 1rem
  stack-lg: 1.5rem
---

## Brand & Style

The design system is built for efficiency, reliability, and clarity. It serves an administrative audience managing complex logistics, requiring a high degree of trust and functional precision. The aesthetic is **Corporate Modern**, blending the structured reliability of enterprise software with the approachability of a contemporary mobile-first product.

The interface prioritizes reduced cognitive load through generous whitespace and a "content-first" hierarchy. It avoids unnecessary decoration, focusing instead on data legibility and actionable insights. The emotional response should be one of "controlled momentum"—the feeling that logistics are being handled with professional ease.

## Colors

The palette is anchored by a professional **Deep Blue (#0047BB)**, signifying authority and dependability. This is complemented by a **Light Blue Accent (#E1EFFF)** used for high-frequency interactive zones and subtle highlights.

- **Primary:** Used for key actions, active states, and brand identifiers.
- **Secondary (Accents):** Utilized for backgrounds of active menu items, tag containers, and soft button states.
- **Neutral Surface:** Backgrounds use a very soft cool gray (#F8FAFC) to differentiate from the pure white (#FFFFFF) used for elevated cards.
- **High-Contrast Text:** Primary content uses a dark slate (#0F172A) to ensure maximum readability under various lighting conditions.

## Typography

The design system utilizes **Hanken Grotesk**, a sharp, contemporary sans-serif that balances technical precision with high legibility. 

The hierarchy is strictly enforced to guide the administrator’s eye through data-heavy screens. Large headlines are slightly condensed with negative letter-spacing for a modern feel, while body text remains open and airy. On mobile, the scale shifts slightly to prevent text wrapping issues in tight columns, ensuring that transit logs and driver names remain readable at a glance.

## Layout & Spacing

This design system uses a **Fluid-Fixed Hybrid** model. On mobile devices, it follows a strict 4-column layout with 16px side margins. On desktop, content is contained within a 12-column grid with a maximum width of 1440px to prevent eye fatigue.

The spacing rhythm is based on a **4px baseline grid**. 
- **Mobile First:** All interactive elements (buttons, inputs) maintain a minimum height of 48px to ensure easy one-handed thumb interaction. 
- **The "Thumb Zone":** Primary navigation and critical action buttons are placed in the lower two-thirds of the screen on mobile views.
- **Vertical Rhythm:** A consistent 16px (stack-md) gap is used between cards to create a clear "chunking" of information.

## Elevation & Depth

Visual hierarchy is established through **Tonal Layering** and **Ambient Shadows**.

1.  **Level 0 (Floor):** Background color (#F8FAFC), used for the main canvas.
2.  **Level 1 (Cards):** Pure white (#FFFFFF) with a soft, diffused shadow. Shadow spec: `0px 4px 12px rgba(15, 23, 42, 0.05)`. This level houses the main content.
3.  **Level 2 (Modals/Overlays):** Elevated with a more pronounced shadow to indicate temporary focus. Shadow spec: `0px 12px 32px rgba(15, 23, 42, 0.12)`.

No heavy borders are used; instead, depth is created by the contrast between the white card surfaces and the subtle gray background.

## Shapes

The shape language is defined by **High Radius** corners. Following the requirement for a 16px+ base, the standard card and container roundedness is set to 1rem (16px).

- **Standard (16px):** Used for cards, modal containers, and large sections.
- **Large (24px):** Used for primary landing hero sections or bottom sheets.
- **Buttons (8px):** Slightly tighter radius to maintain a professional, crisp feel for functional components.
- **Interactive Chips:** Fully rounded (pill) to distinguish them from actionable buttons.

## Components

### Buttons
- **Primary:** Solid Deep Blue with white text. 48px height for mobile.
- **Secondary:** Light Blue surface with Deep Blue text. Used for less urgent actions.
- **Ghost:** No background, Deep Blue text. Used for tertiary navigation.

### Cards
Cards are the primary container. They must have a 16px padding and 16px border-radius. In a mobile view, cards span the full width of the grid minus the 16px margins.

### Input Fields
Inputs use a 1px border (#E2E8F0) and an 8px radius. On focus, the border transitions to Primary Blue with a 2px stroke. Labels are always visible above the field in `label-md` style.

### Transit Status Chips
Used for "On Time," "Delayed," or "Completed." These use high-saturation text on a 10% opacity version of the status color (e.g., Green for on time, Red for delayed) with a pill-shaped radius.

### List Items
Driver and route lists use a 72px minimum height per row to ensure touch targets are sufficient. Each item is separated by a thin 1px hairline divider (#F1F5F9).
