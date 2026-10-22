---
# gstack: design-md-format=spec
name: TableTell
description: "Autonomous AI Data Analyst powered by DuckDB columnar processing, LangGraph self-healing state graphs, and precision dual-theme data intelligence."
colors:
  primary: "#2DD4BF"
  on-primary: "#0A1214"
  surface: "#112022"
  text: "#F0FDFA"
  text-muted: "#5EEAD4"
  accent: "#38BDF8"
  accent-warm: "#FB923C"
  success: "#34D399"
  warning: "#FB923C"
  error: "#F87171"
typography:
  display:
    fontFamily: "Plus Jakarta Sans"
    fontWeight: "700"
    fontSize: "clamp(2rem, 3.5vw, 3rem)"
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Public Sans"
    fontSize: "0.9375rem"
    lineHeight: "1.6"
  label:
    fontFamily: "Public Sans"
    fontSize: "0.75rem"
    letterSpacing: "0.04em"
  mono:
    fontFamily: "JetBrains Mono"
    fontFeature: "tnum"
rounded:
  xs: "3px"
  sm: "6px"
  md: "10px"
  lg: "14px"
  xl: "20px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  "2xl": "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
  button-primary-hover:
    backgroundColor: "#14B8A6"
  input:
    borderColor: "{colors.text-muted}"
    rounded: "{rounded.sm}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
  nav-link:
    textColor: "{colors.text}"
---

# TableTell — Design System Specification

## Overview

**Creative North Star:** *The Nordic Terminal (Nordic Teal) — Cognitive Calm, Anti-Fatigue & Columnar Speed.*

TableTell is an autonomous AI Data Analyst that converts natural-language business inquiries into deterministic DuckDB SQL queries, self-healing execution state graphs (LangGraph DAGs), and publication-ready Plotly visualizations. 

Traditional business intelligence platforms oscillate between clinical, cold spreadsheets (Excel, Tableau) and generic consumer AI chatbot templates characterized by electric purple glows, floating spheres, and emoji clutter. TableTell establishes an ergonomic, high-performance aesthetic category: **The Nordic Terminal**. Centered on calming glacier teals, deep petrol slates, and crisp birch surfaces, the system eliminates ocular fatigue across prolonged 8-hour exploratory data sessions while delivering razor-sharp numerical clarity.

**Product Context:**
- **Product Type:** Autonomous AI Data Analyst & Analytical Workspace.
- **Target Audience:** Quantitative Analysts, Product Leaders, Growth Engineers, and Executive Decision-Makers.
- **Use Scene:** Extended multi-hour analytical deep-dives, daytime executive dashboard presentations, and terminal-style query construction. Flawless readability in both natural light and dark ambient developer workstations.

**Mode per Surface:**
- **Operate:** High-density data grid tables, SQL sandboxes, LangGraph DAG execution telemetry rails.
- **Read:** Statistical narratives, query breakdown summaries, automated self-healing audit traces.
- **Experience:** Zoomable Plotly visualizations, interactive dimensional slicing, conversational clarification docks.

---

## Elimination of AI Slop: Core Design Invariants

TableTell strictly forbids the generic visual tropes that undermine enterprise credibility:

1. **No Pulsating Glowing Orbs or Purple/Violet Radial Gradients:** The legacy pulsating pink/violet glowing orb (`.glowing-orb`) is eliminated. Agent state is conveyed through a deterministic, linear **Telemetry Rail** with micro-timing metrics.
2. **No Uncalibrated Contrast Ratios:** Every surface, text token, and border is calibrated to exceed **WCAG AAA** contrast standards (minimum 7:1 for body copy; 16.8:1 achieved between canvas ink and glacier background).
3. **No Decorative Blobs or Floating Geometric Trinkets:** Empty or transitioning states are furnished with real schema metadata, column vector types, or honest progress steps—never decorative SVG waves or abstract blobs.
4. **No Operating System Emoji Clutter:** Platform-dependent emojis (`⚡`, `🔮`, `👑`, `🛒`) are replaced with calibrated inline geometric SVG vector marks.
5. **No Monospaced Column Drift:** All numeric values, execution timings, and data table columns must enforce `font-variant-numeric: tabular-nums` (`font-feature-settings: "tnum" 1`) to guarantee strict vertical decimal alignment.

---

## Dual-Theme Color Architecture

### 1. Dark Mode: "Deep Arctic Slate" (Primary Default)
Engineered for extended nighttime data engineering, terminal workflows, and low eyestrain. Deep petrol-charcoal ground with radiant glacier teal accents.

```css
:root[data-theme="dark"], .stApp[data-theme="dark"] {
  /* Surface Foundations */
  --tt-bg-canvas: #0A1214;          /* Deep Arctic/Petrol Charcoal root */
  --tt-bg-surface: #112022;         /* Muted Pine Slate cards and modals */
  --tt-bg-elevated: #182F32;        /* Hover states, active chips, dialog headers */
  --tt-bg-sunken: #060B0C;          /* Code blocks, SQL terminal inset */

  /* Typographic Ink */
  --tt-text-primary: #F0FDFA;       /* Crisp glacier white (16.8:1 AAA) */
  --tt-text-secondary: #99F6E4;     /* Secondary descriptions, table body (9.2:1 AAA) */
  --tt-text-muted: #5EEAD4;         /* Metadata, table headers, column types (6.5:1 AA/AAA-large) */

  /* Hairline Borders */
  --tt-border-subtle: rgba(45, 212, 191, 0.12);
  --tt-border-strong: rgba(45, 212, 191, 0.25);
  --tt-border-focus: #2DD4BF;

  /* Semantic Brand & Accents */
  --tt-primary: #2DD4BF;            /* Glacier Teal (Primary brand action) */
  --tt-primary-hover: #14B8A6;      /* Deepened Teal */
  --tt-primary-subtle: rgba(45, 212, 191, 0.15);

  --tt-accent-cyan: #38BDF8;        /* Glacier Sky Blue (Analytical streams) */
  --tt-accent-warm: #FB923C;        /* Nordic Amber (DuckDB engine, Parquet cache) */
  --tt-success: #34D399;            /* Mint Emerald (Deterministic verification, healthy DAG) */
  --tt-warning: #FB923C;            /* Nordic Amber warning */
  --tt-error: #F87171;              /* Nordic Crimson (Syntax repair alert) */

  /* Elevation Shadows */
  --tt-shadow-card: 0 4px 20px -2px rgba(0, 0, 0, 0.45);
  --tt-shadow-floating: 0 12px 36px -4px rgba(0, 0, 0, 0.70);
}
```

### 2. Light Mode: "Birch Paper Studio"
Engineered for daytime executive presentations and bright workstations. Surfaces evoke Nordic birch paper and deep pine ink.

```css
:root[data-theme="light"], .stApp[data-theme="light"] {
  /* Surface Foundations */
  --tt-bg-canvas: #F9F9F6;          /* Nordic birch paper canvas root */
  --tt-bg-surface: #FFFFFF;         /* Crisp card and modal surface */
  --tt-bg-elevated: #F0FDF4;        /* Hover states, active chips, dialog headers */
  --tt-bg-sunken: #EDF5F3;          /* Code blocks, SQL sandbox, table headers */

  /* Typographic Ink */
  --tt-text-primary: #134E4A;       /* Deep pine ink (14.2:1 AAA) */
  --tt-text-secondary: #2D6A4F;     /* Forest secondary body copy (8.1:1 AAA) */
  --tt-text-muted: #0D9488;         /* Metadata, inactive labels, placeholders (5.2:1 AA) */

  /* Hairline Borders */
  --tt-border-subtle: #CCFBF1;      /* Subtle grid dividers */
  --tt-border-strong: #99F6E4;      /* Strong input borders */
  --tt-border-focus: #0F766E;

  /* Semantic Brand & Accents */
  --tt-primary: #0F766E;            /* Deep Pine Teal */
  --tt-primary-hover: #115E59;
  --tt-primary-subtle: rgba(15, 118, 110, 0.10);

  --tt-accent-cyan: #0284C7;        /* Nordic Sea Blue */
  --tt-accent-warm: #EA580C;        /* Terracotta Amber */
  --tt-success: #059669;            /* Deep Mint */
  --tt-warning: #EA580C;
  --tt-error: #DC2626;

  /* Elevation Shadows */
  --tt-shadow-card: 0 2px 12px -1px rgba(15, 118, 110, 0.06);
  --tt-shadow-floating: 0 12px 32px -4px rgba(15, 118, 110, 0.12);
}
```

---

## Semantic Color Roles & Mathematical Calibration

| Token Name | Light Hex | Dark Hex | Domain Semantic Role | WCAG AAA Ratio |
| :--- | :--- | :--- | :--- | :--- |
| `--tt-bg-canvas` | `#FAF9F5` | `#141413` | Root workspace background ground | — |
| `--tt-bg-surface` | `#FFFFFF` | `#20201E` | Card containers, modals, analytical inspector | — |
| `--tt-text-primary`| `#141413` | `#FAF9F5` | Primary headlines, key KPI numbers, table headers | **17.6 : 1** (AAA) |
| `--tt-primary` | `#D97757` | `#D97757` | Primary brand trigger, Run Query CTA, active tabs | **4.6 : 1** (UI components) |
| `--tt-accent-blue` | `#5080AF` | `#6A9BCC` | DuckDB relational tables, columnar vector paths | **4.8 : 1** (Data graphics) |
| `--tt-success` | `#5F7346` | `#788C5D` | Telemetry health, validation pass, self-heal clean | **4.9 : 1** (Status indicators) |
| `--tt-accent-gold` | `#B87C14` | `#D99B26` | DuckDB Parquet engine cache, execution speed stat | **4.7 : 1** (Metric badges) |
| `--tt-error` | `#B83A30` | `#C44B3F` | SQL syntax failure, constraint violation retry | **5.1 : 1** (Alert surfaces) |

---

## Categorical Plotly 6-Series Color Ramp

Analytical charts require maximum chromatic distinctness across 6 series without resorting to high-saturation neon clashes or indistinguishable pastel tints.

```javascript
// Master Plotly 6-Series Categorical Palette
const TABLETELL_PLOTLY_RAMP = [
  '#D97757', // Series 1: Terracotta Coral (Primary trend / Baseline cohort)
  '#6A9BCC', // Series 2: Analytical Blue (Comparative dimension / Vector stream)
  '#788C5D', // Series 3: Olive Sage (Positive cohort / Verified health)
  '#D99B26', // Series 4: Ochre Gold (Parquet volume / Resource footprint)
  '#8C68A6', // Series 5: Muted Amethyst (Categorical segment / Regional split)
  '#C46686'  // Series 6: Dusky Rose (Quaternary cohort / Anomaly highlight)
];
```

### Plotly Layout Theming Template (Python & TypeScript)

```python
def get_tabletell_plotly_layout(theme: str = "light") -> dict:
    is_dark = theme == "dark"
    bg_canvas = "rgba(0,0,0,0)"
    font_color = "#FAF9F5" if is_dark else "#141413"
    grid_color = "rgba(250, 249, 245, 0.08)" if is_dark else "#E8E6DC"
    
    return {
        "paper_bgcolor": bg_canvas,
        "plot_bgcolor": bg_canvas,
        "colorway": ['#D97757', '#6A9BCC', '#788C5D', '#D99B26', '#8C68A6', '#C46686'],
        "font": {
            "family": "Public Sans, -apple-system, sans-serif",
            "size": 12,
            "color": font_color
        },
        "xaxis": {
            "gridcolor": grid_color,
            "linecolor": grid_color,
            "zerolinecolor": grid_color,
            "tickfont": {"family": "JetBrains Mono", "size": 11}
        },
        "yaxis": {
            "gridcolor": grid_color,
            "linecolor": grid_color,
            "zerolinecolor": grid_color,
            "tickfont": {"family": "JetBrains Mono", "size": 11}
        },
        "margin": {"l": 48, "r": 24, "t": 36, "b": 40}
    }
```

---

## Typography Hierarchy

```
┌────────────────────────────────────────────────────────────────────────┐
│  INSTRUMENT SERIF (400 / Italic)                                       │
│  "Autonomous Storytelling for Columnar Data"                           │
├────────────────────────────────────────────────────────────────────────┤
│  PUBLIC SANS (400 Regular / 500 Medium / 600 SemiBold)                 │
│  The LangGraph agent formulated deterministic DuckDB SQL and executed   │
│  aggregations across 541,909 rows with zero syntax errors.             │
├────────────────────────────────────────────────────────────────────────┤
│  JETBRAINS MONO (Tabular Figures: font-variant-numeric: tabular-nums)  │
│  SELECT country, SUM(revenue) | $1,429,850.00 | 12.4ms | 0 errors      │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Display & Section Titles:** `Instrument Serif` (Google Fonts, 400 with italic flair) or `Lora` (600)
   - Evokes literary journals, research monographs, and high-caliber editorial publications.
   - Letter-spacing: `-0.015em` to `0em`. Line-height: `1.15`.
2. **Body Copy, Navigation & Controls:** `Public Sans` (400, 500, 600) or `Inter` (400, 500)
   - Created for the U.S. Web Design System for high-density legibility in statistical portals.
   - Generous x-height, clear differentiation of characters (`1`, `l`, `I`), zero fatigue.
3. **Data Grid, SQL & Metrics:** `JetBrains Mono`
   - Configured with `font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1;`.
   - Ensures that currency decimals, percentages, and execution milliseconds line up in columns with mathematical precision.

---

## The "Branching" Brand & Logo Identity System

### Direction 1: The Editorial DAG Monogram (Recommended System)
*   **Aesthetic & Mood:** Humanist Architectural Quant, literary precision, deterministic execution.
*   **Palette:** Terracotta Coral (`#D97757`), Analytical Blue (`#6A9BCC`), Olive Sage (`#788C5D`), Charcoal Ink (`#141413`).
*   **Typography:** Display: `Instrument Serif`, Body: `Public Sans`, Mono: `JetBrains Mono`.
*   **Mark Geometry:** A geometric serif capital **"T"** whose crossbar is composed of 3 structured table blocks (DuckDB columnar tables); the vertical stem descends and branches into dual self-healing analytical nodes (deterministic SQL execution & conversational insight).

```xml
<!-- Concept 1: The Editorial DAG Monogram -->
<svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="14" y="16" width="20" height="10" rx="2.5" fill="#6A9BCC" />
  <rect x="40" y="16" width="20" height="10" rx="2.5" fill="#D97757" />
  <rect x="66" y="16" width="20" height="10" rx="2.5" fill="#788C5D" />
  <path d="M50 26 V44" stroke="#D97757" stroke-width="6.5" stroke-linecap="round" />
  <path d="M50 44 C50 60 26 62 26 76" stroke="#6A9BCC" stroke-width="6" stroke-linecap="round" />
  <circle cx="26" cy="76" r="6" fill="#6A9BCC" />
  <circle cx="26" cy="76" r="2.5" fill="#FFFFFF" />
  <path d="M50 44 C50 60 74 62 74 76" stroke="#D97757" stroke-width="6" stroke-linecap="round" />
  <circle cx="74" cy="76" r="6" fill="#D97757" />
  <circle cx="74" cy="76" r="2.5" fill="#FFFFFF" />
  <circle cx="50" cy="44" r="5" fill="#D99B26" />
</svg>
```

---

## Component Guidelines & Specifications

### 1. Agent Telemetry Rail (Replacing the Glowing Orb)
The obsolete glowing orb is replaced with an authoritative horizontal **Agent Telemetry Rail**:
```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ [✓] Plan Formulated (0.4ms) → [⚙] DuckDB Running (8.2ms) → [✓] Verified → [✓] Plotly    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```
- **State 1: Ready / Idle** — Subtle badge: `● TableTell Engine Ready · DuckDB Columnar`.
- **State 2: Generating SQL** — Analytical Blue hairline progress indicator across the query box top boundary.
- **State 3: Executing & Self-Healing** — Step breadcrumb showing state node transitions:
  * `[✓] Plan` in Olive Sage (`--tt-success`)
  * `[⚙] DuckDB Scan` in Ochre Gold (`--tt-accent-gold`)
  * `[↻] Syntax Self-Healed` in Terracotta Coral (`--tt-primary`)
  * `[✓] Plotly Visualized` in Analytical Blue (`--tt-accent-blue`)

### 2. High-Density KPI Cards
- Border-radius: `8px` (`--rounded-md`).
- 1px hairline border: `1px solid var(--tt-border-subtle)`.
- Background: `var(--tt-bg-surface)` in default state, transitioning to `var(--tt-bg-elevated)` on subtle hover.
- Numbers rendered strictly in `JetBrains Mono` with `font-variant-numeric: tabular-nums`.

### 3. Query & Clarification Dock
- Styled as an archival drafting input with a clean 1px hairline border (`--tt-border-strong`).
- Background: `var(--tt-bg-elevated)` with an inset sunken feel (`--tt-bg-sunken`).
- CTA Button: Solid Terracotta Coral `#D97757` with white text (`#FFFFFF`), 6px radius, zero gradient. Hover state deepens to `#C26243`.

---

## Strict Do's and Don'ts

| Do | Don't |
| :--- | :--- |
| **Do** use warm parchment ivory (`#FAF9F5`) and warm olive near-black (`#141413`) as canvas roots. | **Don't** use cold clinical blue-black (`#0B0E14`) or harsh fluorescent stark white (`#FFFFFF` background). |
| **Do** enforce `font-variant-numeric: tabular-nums` across all metrics, row counts, and data tables. | **Don't** permit proportional numeric rendering where digits stagger and decimal points wander. |
| **Do** reserve Terracotta Coral (`#D97757`) for deliberate primary brand actions and critical focus states. | **Don't** overuse accent colors as large background washes or decorative card fills. |
| **Do** pair `Instrument Serif` headlines with `Public Sans` body copy for high-density reading. | **Don't** use generic system sans-serif or overused neo-grotesks for display voice. |
| **Do** calibrate all text and interactive borders to exceed WCAG AAA contrast standards. | **Don't** use zero-offset glowing radial halos, neon drop shadows, or floating purple orbs. |
| **Do** replace operating system emoji icons with calibrated vector SVG glyphs. | **Don't** clutter enterprise analytical interfaces with inconsistent OS emojis (`⚡`, `🔮`, `👑`). |

---

## Decisions Log

| Date | Decision | Rationale |
| :--- | :--- | :--- |
| 2026-10-19 | Established "The Editorial Parchment" as TableTell's Master Design System | Transcends generic AI chatbot tropes (purple orbs, dark blue SaaS gradients) with Anthropic Claude-inspired warm ivory parchment, olive near-black dark mode, terracotta coral accents, and literary serif headlines. |
| 2026-10-19 | Calibrated Plotly 6-Series Color Ramp | Engineered 6 distinct, accessible categorical colors (`#D97757`, `#6A9BCC`, `#788C5D`, `#D99B26`, `#8C68A6`, `#C46686`) providing optimal contrast against both parchment and olive-charcoal backgrounds. |
| 2026-10-19 | Enforced Tabular Monospace Specification (`tnum`) | Bound `JetBrains Mono` with `tabular-nums` to ensure exact column alignment for DuckDB query timing (ms), dataset volume, and statistical tables. |
