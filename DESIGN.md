---
name: Velofire API Client
colors:
  surface: '#10131a'
  surface-dim: '#10131a'
  surface-bright: '#363941'
  surface-container-lowest: '#0b0e15'
  surface-container-low: '#191b23'
  surface-container: '#1d2027'
  surface-container-high: '#272a31'
  surface-container-highest: '#32353c'
  on-surface: '#e1e2ec'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#e1e2ec'
  inverse-on-surface: '#2e3038'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#c8c6c5'
  on-secondary: '#313030'
  secondary-container: '#4a4949'
  on-secondary-container: '#bab8b7'
  tertiary: '#ffb786'
  on-tertiary: '#502400'
  tertiary-container: '#df7412'
  on-tertiary-container: '#461f00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474646'
  tertiary-fixed: '#ffdcc6'
  tertiary-fixed-dim: '#ffb786'
  on-tertiary-fixed: '#311400'
  on-tertiary-fixed-variant: '#723600'
  background: '#10131a'
  on-background: '#e1e2ec'
  surface-variant: '#32353c'
typography:
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-xs:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  gutter: 1px
---

## Brand & Style
The design system is engineered for high-performance developer workflows, prioritizing utility, speed, and focus. The aesthetic is **Minimalist-Modern** with a "native desktop" feel, drawing inspiration from high-productivity tools like VSCode and Linear. 

The UI is intentionally compact to facilitate high information density without visual clutter. It utilizes a sophisticated dark-mode-first approach, emphasizing structural clarity through crisp borders and intentional monochromatic layering rather than heavy shadows or decorative gradients. The emotional response is one of precision, reliability, and technical mastery.

## Colors
The palette is built on a "Graphite" foundation to reduce eye strain during long sessions.
- **Surface Layering**: The primary background (#0D0D0D) serves as the base, while secondary panels like sidebars and inspectors use a slightly lighter shade (#141414) to create depth.
- **Accents**: The deep blue accent is reserved for primary actions, active tab indicators, and keyboard focus states.
- **Borders**: All structural divisions use a consistent low-contrast border (#262626).
- **Syntax**: A custom-tuned palette for code blocks and JSON responses provides high legibility with a professional, muted tone.

## Typography
The typography system is designed for a desktop environment where precision is paramount. 
- **Scale**: We utilize a compact 13px base size for body text and code to maximize on-screen content.
- **Monospace Integration**: JetBrains Mono is used for all code editors, JSON responses, and technical input fields (URLs, Header keys).
- **Hierarchy**: Use `Inter` for UI labels and navigation. `label-xs` should be used for metadata and status indicators, often in All Caps with slight tracking.

## Layout & Spacing
This design system employs a **Fixed-Fluid Hybrid** model typical of professional IDEs. 
- **Panels**: The layout is divided into three main zones: Sidebar (fixed width, 240px-280px), Main Editor (fluid), and Inspector (fixed/collapsible).
- **Grid**: Use a 4px base unit. Components should maintain tight margins (8px to 12px) to ensure density.
- **Split-Panes**: Vertical and horizontal splitters must use a 1px border (`border_color`) and a 4px "invisible" hit area for resizing.

## Elevation & Depth
Elevation is achieved primarily through **Tonal Layering** and 1px borders rather than heavy shadows.
- **Level 0 (Base)**: Main editor area (#0D0D0D).
- **Level 1 (Surface)**: Sidebars, footers, and header bars (#141414).
- **Level 2 (Floating)**: Command palettes, dropdown menus, and tooltips. These use a slightly lighter background (#1C1C1C) and a subtle 8px blur shadow with 40% opacity to distinguish them from the background grid.
- **Focus**: Active elements (focused inputs) should receive a 1px solid blue accent border to indicate keyboard readiness.

## Shapes
Shapes are disciplined and functional. 
- **Standard Radius**: 6px for buttons, inputs, and small containers.
- **Large Radius**: 8px for cards and floating modals (Command Palette).
- **Sharp Corners**: Use 0px radius for tab segments and panel edges that touch the application frame to maintain the "integrated" desktop feel.

## Components
- **Buttons**: Primary buttons use the accent color with white text. Secondary buttons are ghost-style with a 1px border. Default state is 13px text.
- **Tabs**: "Seamless" style. Active tabs feature a subtle bottom border or a slightly lighter background. No rounded top corners unless separated from the content area.
- **Input Fields**: Monospace font by default for technical data. Darker background (#080808) with a 1px border. Focus state is a high-contrast blue outline.
- **Command Palette**: Centered floating modal. High density, no icons unless necessary for type distinction. Uses 8px rounding and `code-md` for suggestions.
- **Chips**: Small, 11px text, used for HTTP methods (GET: green, POST: blue, etc.) and status codes.
- **Lists**: Zero-padding on the left/right in sidebars. Hover state uses a subtle background highlight (#1A1A1A).