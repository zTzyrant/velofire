# Design Guide

## Tujuan

Panduan ini merangkum `DESIGN.md` menjadi aturan implementasi UI. Gunakan file ini sebelum membuat komponen, layout, theme, atau styling.

## Brand

Nama produk: Velofire API Client.

Karakter visual:

- Minimalist-modern.
- Native desktop feel.
- Compact.
- High information density.
- Precise.
- Reliable.
- Technical.

UI harus terasa seperti developer tool produktif, bukan landing page atau aplikasi mobile yang diperbesar.

## Warna

Gunakan dark-mode-first graphite palette.

Token utama dari `DESIGN.md`:

- `background`: `#10131a`
- `surface`: `#10131a`
- `surface-container-lowest`: `#0b0e15`
- `surface-container-low`: `#191b23`
- `surface-container`: `#1d2027`
- `surface-container-high`: `#272a31`
- `surface-container-highest`: `#32353c`
- `on-surface`: `#e1e2ec`
- `on-surface-variant`: `#c2c6d6`
- `outline`: `#8c909f`
- `outline-variant`: `#424754`
- `primary`: `#adc6ff`
- `primary-container`: `#4d8eff`
- `tertiary`: `#ffb786`
- `error`: `#ffb4ab`

Catatan desain:

- Surface layering lebih penting daripada shadow.
- Accent biru hanya untuk primary action, active indicator, dan focus state.
- Border struktural harus rendah kontras dan konsisten.
- Hindari decorative gradients.
- Hindari UI yang didominasi satu warna accent.

## Typography

Font UI:

- `Inter`

Font teknis:

- `JetBrains Mono`

Token:

- `headline-sm`: 16px, 600, line-height 24px.
- `body-md`: 13px, 400, line-height 20px.
- `body-sm`: 12px, 400, line-height 18px.
- `code-md`: 13px, 400, line-height 20px.
- `code-sm`: 12px, 400, line-height 18px.
- `label-xs`: 11px, 500, line-height 16px, letter spacing 0.02em.

Aturan:

- Base UI size 13px.
- Gunakan monospace untuk URL, header key/value, JSON, raw body, XML, script, dan response.
- Gunakan `label-xs` untuk metadata, status kecil, tab metadata, dan label all caps.
- Jangan memakai hero-scale typography di area tool.

## Layout

Model layout: fixed-fluid hybrid seperti IDE.

Zona utama:

- Sidebar kiri: fixed width 240px sampai 280px.
- Main editor: fluid.
- Inspector atau panel tambahan: fixed/collapsible jika diperlukan.
- Response viewer: biasanya split horizontal di bawah request editor.

Layout konseptual:

```txt
Topbar
Sidebar | Request Tabs
Sidebar | Request Editor
Sidebar | Response Viewer
```

Aturan spacing:

- Base unit 4px.
- Margin komponen umum 8px sampai 12px.
- Gunakan gutter 1px untuk border antar panel.
- Splitter visual 1px dengan hit area tidak terlihat 4px.
- Panel edge yang menyentuh frame aplikasi boleh sharp atau radius 0.

## Elevation

Gunakan tonal layering dan border 1px.

- Level 0: main editor/base.
- Level 1: sidebar, footer, header bar.
- Level 2: dropdown, tooltip, command palette.

Floating UI boleh memakai shadow halus, tetapi jangan berat. Fokus keyboard harus terlihat lewat 1px solid blue accent border.

## Radius

- `sm`: 2px.
- Default: 4px.
- `md`: 6px.
- `lg`: 8px.
- `xl`: 12px.

Aturan:

- Buttons, inputs, dan small containers: 6px.
- Cards dan floating modals: maksimal 8px.
- Tabs dan panel edge terintegrasi: 0px bila menempel frame.

## Komponen

## Frontend Styling Stack

Implementasi desktop saat ini memakai SolidJS, Tailwind CSS v4, dan shadcn-style local primitives di `apps/desktop/src/components/ui`.

Aturan:

- Prioritaskan utility class Tailwind di komponen untuk spacing, layout, typography, border, dan state sederhana.
- Gunakan `styles.css` untuk design tokens, CSS variables, app-level layout, native Tauri window region, scrollbar, split-pane behavior, dan interaksi yang sulit dibaca jika ditulis sebagai utility panjang.
- Komponen reusable harus mengambil primitive lokal seperti `Button`, `Dialog`, `Dropdown`, `ContextMenu`, `Select`, dan `Tabs` dari `components/ui`.
- Jangan mengganti palette tanpa perubahan eksplisit di `DESIGN.md`.
- Jangan menambah CSS framework lain untuk MVP.

Buttons:

- Primary memakai accent color.
- Secondary memakai ghost style atau 1px border.
- Teks 13px.
- Gunakan icon untuk action umum jika icon library tersedia.

Tabs:

- Seamless style.
- Active tab memakai bottom border atau background sedikit lebih terang.
- Hindari rounded top corners jika tab menyatu dengan panel.

Inputs:

- Monospace by default untuk technical data.
- Background lebih gelap dari panel.
- Border 1px.
- Focus state memakai blue accent outline.

Command Palette:

- Floating modal di tengah.
- Padat.
- Radius 8px.
- Gunakan `code-md` untuk suggestion teknis.
- Icon hanya jika membantu membedakan tipe item.

Chips:

- 11px.
- Untuk HTTP method dan status code.
- Method color harus bermakna tetapi tetap muted.

Lists:

- Padding kiri/kanan minimal.
- Hover state halus.
- Selected state jelas tetapi tidak terlalu terang.
- Reorder list di sidebar memakai pointer-based drag/drop agar stabil di Tauri WebView. Jangan kembali ke native HTML5 `draggable` untuk reorder request kecuali ada alasan teknis yang terukur.

## UX Rules

- Jangan membuat landing page sebagai layar utama aplikasi.
- Layar pertama harus usable API client.
- Jangan gunakan card bertumpuk untuk panel utama.
- Jangan menambahkan teks instruksional yang menjelaskan fitur dasar di dalam UI.
- Pastikan teks tidak overlap pada viewport desktop dan mobile.
- Gunakan dimensi stabil untuk toolbar, tabs, split pane, list row, dan chips agar layout tidak bergeser.
