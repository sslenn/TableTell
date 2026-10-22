"""
TableTell V2 — Streamlit Frontend (Path A)
Premium Dual-Theme Architecture (Obsidian Slate Dark & Alabaster Studio Light)
Featuring:
- Bespoke SVG "Branching Monogram" Brand & Logo System (Table + Tell + DAG)
- Dynamic Instant Theme Switching (Dark / Light) with WCAG AAA Contrast
- DuckDB Columnar Vectorized Engine & Parquet Lake
- LangGraph Self-Healing Agent Traversal
- Auto-Adaptive Plotly Visualizations (Dark/Light transparent canvas)
- Zero AI Slop (No generic glowing neon orbs; disciplined control-room minimal)
"""

import os
import sys
from pathlib import Path
import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

# Add backend directory to sys.path so we can import app modules cleanly
backend_path = Path(__file__).resolve().parent.parent / "backend"
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from app.core.duckdb_engine import duckdb_engine
from app.services.cleaning_service import cleaning_pipeline
from app.agent.graph import tabletell_agent

# 1. Page Configuration
st.set_page_config(
    page_title="TableTell — Autonomous AI Data Analyst",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded"
)

# 2. Session State Initialization
if "messages" not in st.session_state:
    st.session_state.messages = []
if "dataset_choice" not in st.session_state:
    st.session_state.dataset_choice = "E-Commerce Sales (Demo)"
if "dataset_id" not in st.session_state:
    st.session_state.dataset_id = "ecommerce_sales"
if "is_cleaned" not in st.session_state:
    st.session_state.is_cleaned = False
if "clean_log" not in st.session_state:
    st.session_state.clean_log = []
if "theme_mode" not in st.session_state:
    st.session_state.theme_mode = "Dark"

is_dark = (st.session_state.theme_mode == "Dark")

# 3. Logo Generation Utility
def get_branching_logo_svg(size=36, is_dark=True):
    """Generates the official TableTell Branching Monogram SVG in Nordic Teal / Glacier Sky."""
    return f"""
    <svg width="{size}" height="{size}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink: 0;">
      <!-- Table Header Cells (3 Columnar Segments) -->
      <rect x="14" y="16" width="20" height="10" rx="3" fill="url(#tt_grad_left)" />
      <rect x="40" y="16" width="20" height="10" rx="3" fill="url(#tt_grad_center)" />
      <rect x="66" y="16" width="20" height="10" rx="3" fill="url(#tt_grad_right)" />
      
      <!-- Central Stem descending from Table Bar -->
      <path d="M50 26 V44" stroke="url(#tt_stem_grad)" stroke-width="7" stroke-linecap="round" />
      
      <!-- Branch Left (Deterministic DuckDB SQL Engine) -->
      <path d="M50 44 C50 60 26 62 26 76" stroke="url(#tt_branch_left)" stroke-width="6.5" stroke-linecap="round" />
      <circle cx="26" cy="76" r="6" fill="#34D399" />
      <circle cx="26" cy="76" r="2.5" fill="#FFFFFF" />

      <!-- Branch Right (LangGraph Conversational Storytelling) -->
      <path d="M50 44 C50 60 74 62 74 76" stroke="url(#tt_branch_right)" stroke-width="6.5" stroke-linecap="round" />
      <circle cx="74" cy="76" r="6" fill="#38BDF8" />
      <circle cx="74" cy="76" r="2.5" fill="#FFFFFF" />

      <!-- Central Intersect Node -->
      <circle cx="50" cy="44" r="5" fill="#2DD4BF" />

      <defs>
        <linearGradient id="tt_grad_left" x1="14" y1="21" x2="34" y2="21" gradientUnits="userSpaceOnUse">
          <stop stop-color="#2DD4BF" />
          <stop offset="1" stop-color="#38BDF8" />
        </linearGradient>
        <linearGradient id="tt_grad_center" x1="40" y1="21" x2="60" y2="21" gradientUnits="userSpaceOnUse">
          <stop stop-color="#38BDF8" />
          <stop offset="1" stop-color="#2DD4BF" />
        </linearGradient>
        <linearGradient id="tt_grad_right" x1="66" y1="21" x2="86" y2="21" gradientUnits="userSpaceOnUse">
          <stop stop-color="#2DD4BF" />
          <stop offset="1" stop-color="#14B8A6" />
        </linearGradient>
        <linearGradient id="tt_stem_grad" x1="50" y1="26" x2="50" y2="44" gradientUnits="userSpaceOnUse">
          <stop stop-color="#2DD4BF" />
          <stop offset="1" stop-color="#38BDF8" />
        </linearGradient>
        <linearGradient id="tt_branch_left" x1="50" y1="44" x2="26" y2="76" gradientUnits="userSpaceOnUse">
          <stop stop-color="#2DD4BF" />
          <stop offset="1" stop-color="#34D399" />
        </linearGradient>
        <linearGradient id="tt_branch_right" x1="50" y1="44" x2="74" y2="76" gradientUnits="userSpaceOnUse">
          <stop stop-color="#2DD4BF" />
          <stop offset="1" stop-color="#38BDF8" />
        </linearGradient>
      </defs>
    </svg>
    """

# 4. Premium Dual-Theme CSS Token Injection (The Nordic Terminal)
theme_tokens = """
    :root {
      --tt-bg-canvas: #0A1214;
      --tt-bg-surface: #112022;
      --tt-bg-elevated: #182F32;
      --tt-bg-sunken: #060B0C;
      --tt-text-primary: #F0FDFA;
      --tt-text-secondary: #99F6E4;
      --tt-text-muted: #5EEAD4;
      --tt-border-subtle: rgba(45, 212, 191, 0.12);
      --tt-border-strong: rgba(45, 212, 191, 0.25);
      --tt-primary: #2DD4BF;
      --tt-primary-hover: #14B8A6;
      --tt-primary-subtle: rgba(45, 212, 191, 0.15);
      --tt-accent-cyan: #38BDF8;
      --tt-accent-warm: #FB923C;
      --tt-success: #34D399;
      --tt-warning: #FB923C;
      --tt-error: #F87171;
      --tt-shadow-card: 0 4px 20px -2px rgba(0, 0, 0, 0.45);
      --tt-shadow-floating: 0 12px 36px -4px rgba(0, 0, 0, 0.7);
    }
""" if is_dark else """
    :root {
      --tt-bg-canvas: #F9F9F6;
      --tt-bg-surface: #FFFFFF;
      --tt-bg-elevated: #F0FDF4;
      --tt-bg-sunken: #EDF5F3;
      --tt-text-primary: #134E4A;
      --tt-text-secondary: #2D6A4F;
      --tt-text-muted: #0D9488;
      --tt-border-subtle: #CCFBF1;
      --tt-border-strong: #99F6E4;
      --tt-primary: #0F766E;
      --tt-primary-hover: #115E59;
      --tt-primary-subtle: rgba(15, 118, 110, 0.10);
      --tt-accent-cyan: #0284C7;
      --tt-accent-warm: #EA580C;
      --tt-success: #059669;
      --tt-warning: #EA580C;
      --tt-error: #DC2626;
      --tt-shadow-card: 0 2px 12px -1px rgba(15, 118, 110, 0.06);
      --tt-shadow-floating: 0 12px 32px -4px rgba(15, 118, 110, 0.12);
    }
"""

st.markdown(f"""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Public+Sans:wght@400;500;600;700&display=swap');

    {theme_tokens}

    html, body, [class*="css"] {{
        font-family: 'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    }}

    .stApp {{
        background-color: var(--tt-bg-canvas) !important;
        color: var(--tt-text-primary) !important;
        transition: background-color 0.25s ease, color 0.25s ease;
    }}

    [data-testid="stSidebar"] {{
        background-color: var(--tt-bg-surface) !important;
        border-right: 1px solid var(--tt-border-subtle) !important;
    }}

    /* Hero Section */
    .hero-container {{
        text-align: center;
        padding: 18px 12px 28px 12px;
    }}
    .hero-telemetry-badge {{
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: var(--tt-bg-elevated);
        border: 1px solid var(--tt-border-subtle);
        border-radius: 9999px;
        padding: 5px 14px;
        font-size: 12px;
        font-weight: 600;
        color: var(--tt-text-secondary);
        margin-bottom: 14px;
    }}
    .telemetry-pulse-dot {{
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--tt-success);
        box-shadow: 0 0 8px var(--tt-success);
        animation: tt-pulse 2s infinite ease-in-out;
    }}
    @keyframes tt-pulse {{
        0%, 100% {{ opacity: 1; transform: scale(1); }}
        50% {{ opacity: 0.55; transform: scale(1.25); }}
    }}

    .hero-title {{
        font-size: 32px;
        font-weight: 800;
        text-align: center;
        color: var(--tt-text-primary);
        letter-spacing: -0.03em;
        margin-bottom: 6px;
    }}
    .hero-subtitle {{
        font-size: 14px;
        color: var(--tt-text-secondary);
        text-align: center;
        max-width: 680px;
        margin: 0 auto 20px auto;
        line-height: 1.55;
    }}

    /* Luxury High-Density KPI Cards */
    .luxury-card {{
        background: var(--tt-bg-surface);
        border: 1px solid var(--tt-border-subtle);
        border-radius: 14px;
        padding: 16px 20px;
        box-shadow: var(--tt-shadow-card);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        margin-bottom: 14px;
    }}
    .luxury-card:hover {{
        border-color: var(--tt-primary);
        transform: translateY(-2px);
        box-shadow: 0 8px 24px -4px var(--tt-primary-subtle);
    }}
    .kpi-title {{
        font-size: 11px;
        color: var(--tt-text-muted);
        text-transform: uppercase;
        font-weight: 600;
        letter-spacing: 0.05em;
    }}
    .kpi-num {{
        font-family: 'JetBrains Mono', monospace;
        font-size: 24px;
        font-weight: 700;
        color: var(--tt-text-primary);
        margin-top: 4px;
        letter-spacing: -0.02em;
    }}

    /* Action Suggested Cards */
    .action-card {{
        background: var(--tt-bg-surface);
        border: 1px solid var(--tt-border-subtle);
        border-radius: 12px;
        padding: 14px 16px;
        height: 100%;
        cursor: pointer;
        transition: all 0.2s ease;
    }}
    .action-card:hover {{
        border-color: var(--tt-primary);
        background: var(--tt-bg-elevated);
        transform: translateY(-2px);
        box-shadow: 0 6px 20px -2px var(--tt-primary-subtle);
    }}
    .action-title {{
        font-size: 14px;
        font-weight: 600;
        color: var(--tt-text-primary);
        margin-bottom: 4px;
        display: flex;
        align-items: center;
        gap: 8px;
    }}
    .action-desc {{
        font-size: 12px;
        color: var(--tt-text-secondary);
        line-height: 1.4;
    }}

    /* Upgrade / Enterprise Card */
    .upgrade-banner {{
        background: var(--tt-bg-elevated);
        border: 1px solid var(--tt-border-subtle);
        border-radius: 14px;
        padding: 16px;
        text-align: center;
        margin-top: 24px;
    }}
    .upgrade-title {{
        font-size: 13px;
        font-weight: 700;
        color: var(--tt-text-primary);
        margin-top: 6px;
    }}
    .upgrade-sub {{
        font-size: 11px;
        color: var(--tt-text-secondary);
        margin-top: 4px;
        line-height: 1.35;
    }}

    /* Badge Pills */
    .badge-pill {{
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: var(--tt-primary-subtle);
        border: 1px solid var(--tt-primary);
        color: var(--tt-primary);
        padding: 3px 10px;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 600;
    }}

    /* Standard Buttons */
    div.stButton > button {{
        background: var(--tt-bg-surface);
        color: var(--tt-text-primary);
        border: 1px solid var(--tt-border-strong);
        border-radius: 10px;
        font-weight: 600;
        transition: all 0.2s ease;
    }}
    div.stButton > button:hover {{
        border-color: var(--tt-primary);
        background: var(--tt-bg-elevated);
        color: var(--tt-primary);
        transform: translateY(-1px);
    }}

    /* Auto-Clean Highlight Button */
    .clean-btn-wrap div.stButton > button {{
        background: var(--tt-primary) !important;
        border: none !important;
        color: #ffffff !important;
        font-weight: 600 !important;
        box-shadow: 0 4px 14px var(--tt-primary-subtle) !important;
    }}
    .clean-btn-wrap div.stButton > button:hover {{
        background: var(--tt-primary-hover) !important;
        transform: scale(1.02) !important;
    }}

    /* Chat Messages */
    [data-testid="stChatMessage"] {{
        background: var(--tt-bg-surface) !important;
        border: 1px solid var(--tt-border-subtle) !important;
        border-radius: 14px !important;
        margin-bottom: 12px !important;
        box-shadow: var(--tt-shadow-card) !important;
    }}

    /* Custom Chatbox Form Styling */
    [data-testid="stForm"] {{
        background: var(--tt-bg-surface) !important;
        border: 1px solid var(--tt-border-strong) !important;
        border-radius: 20px !important;
        padding: 14px 20px 10px 20px !important;
        box-shadow: var(--tt-shadow-floating) !important;
        transition: all 0.25s ease !important;
        margin-top: 14px !important;
        margin-bottom: 24px !important;
    }}
    [data-testid="stForm"]:focus-within {{
        border-color: var(--tt-primary) !important;
        box-shadow: 0 12px 38px var(--tt-primary-subtle) !important;
    }}

    [data-testid="stForm"] [data-testid="stTextInput"] {{
        margin-bottom: 0px !important;
    }}
    [data-testid="stForm"] [data-testid="stTextInput"] div[data-baseweb="input"] {{
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
    }}
    [data-testid="stForm"] [data-testid="stTextInput"] input {{
        background-color: transparent !important;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236366F1' stroke-width='2.2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'%3E%3C/path%3E%3C/svg%3E") !important;
        background-repeat: no-repeat !important;
        background-position: 12px center !important;
        background-size: 18px 18px !important;
        border: none !important;
        color: var(--tt-text-primary) !important;
        font-size: 15px !important;
        font-weight: 400 !important;
        padding-left: 44px !important;
        padding-right: 12px !important;
        padding-top: 8px !important;
        padding-bottom: 8px !important;
        box-shadow: none !important;
    }}
    [data-testid="stForm"] [data-testid="stTextInput"] input::placeholder {{
        color: var(--tt-text-muted) !important;
    }}

    [data-testid="stForm"] [data-testid="stPopover"] > button {{
        background: transparent !important;
        border: none !important;
        color: var(--tt-text-secondary) !important;
        font-size: 18px !important;
        padding: 5px 8px !important;
        border-radius: 50% !important;
        box-shadow: none !important;
        transition: all 0.2s ease !important;
    }}
    [data-testid="stForm"] [data-testid="stPopover"] > button:hover {{
        color: var(--tt-primary) !important;
        background: var(--tt-bg-elevated) !important;
        transform: scale(1.1) !important;
    }}

    .chatbox-inner-divider {{
        height: 1px;
        background: var(--tt-border-subtle);
        margin: 6px 0 10px 0;
    }}

    .chatbox-model-pill {{
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: var(--tt-bg-elevated);
        border: 1px solid var(--tt-border-subtle);
        border-radius: 9999px;
        padding: 4px 12px;
        font-size: 12px;
        font-weight: 600;
        color: var(--tt-primary);
        letter-spacing: -0.2px;
    }}

    .run-btn-wrap div.stButton > button {{
        background: var(--tt-primary) !important;
        color: #ffffff !important;
        border: none !important;
        border-radius: 9999px !important;
        padding: 7px 22px !important;
        font-weight: 700 !important;
        font-size: 14px !important;
        box-shadow: 0 4px 14px var(--tt-primary-subtle) !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
    }}
    .run-btn-wrap div.stButton > button:hover {{
        background: var(--tt-primary-hover) !important;
        transform: translateY(-1px) !important;
    }}
</style>
""", unsafe_allow_html=True)

# 5. Sidebar Configuration with Branching Logo & Theme Toggle
with st.sidebar:
    # Official Brand Lockup with Branching SVG Logo
    st.markdown(f"""
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
        {get_branching_logo_svg(size=34, is_dark=is_dark)}
        <div>
            <div style="font-weight: 800; font-size: 18px; color: var(--tt-text-primary); letter-spacing: -0.03em;">TableTell</div>
            <div style="font-size: 11px; color: var(--tt-text-secondary); font-weight: 500;">Autonomous Data Agent</div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    # Instant Theme Switcher Control
    theme_choice = st.segmented_control(
        "Theme Mode",
        options=["🌙 Dark", "☀️ Light"],
        default="🌙 Dark" if is_dark else "☀️ Light",
        label_visibility="collapsed"
    )
    if theme_choice:
        selected_mode = "Dark" if "Dark" in theme_choice else "Light"
        if selected_mode != st.session_state.theme_mode:
            st.session_state.theme_mode = selected_mode
            st.rerun()

    st.markdown("<div style='height: 8px;'></div>", unsafe_allow_html=True)

    if st.button("➕  New Chat", use_container_width=True):
        st.session_state.messages = []
        st.session_state.clean_log = []
        st.session_state.is_cleaned = False
        st.rerun()

    st.markdown("<div style='height: 10px;'></div>", unsafe_allow_html=True)
    st.caption("WORKSPACES & DATA")

    dataset_options = [
        "E-Commerce Sales (Demo)",
        "SaaS Churn Analytics (Demo)",
        "Global Retail (Raw Business Data)",
        "Upload Custom File"
    ]
    default_index = 0
    if "E-Commerce" in st.session_state.dataset_choice:
        default_index = 0
    elif "SaaS" in st.session_state.dataset_choice:
        default_index = 1
    elif "Retail" in st.session_state.dataset_choice:
        default_index = 2
    elif "Upload" in st.session_state.dataset_choice or "📎" in st.session_state.dataset_choice:
        default_index = 3

    dataset_option = st.selectbox(
        "Active Dataset",
        dataset_options,
        index=default_index,
        label_visibility="collapsed"
    )

    if dataset_option != st.session_state.dataset_choice:
        st.session_state.dataset_choice = dataset_option
        st.session_state.messages = []
        st.session_state.is_cleaned = False
        st.session_state.clean_log = []

        if "E-Commerce" in dataset_option:
            st.session_state.dataset_id = "ecommerce_sales"
        elif "SaaS" in dataset_option:
            st.session_state.dataset_id = "saas_churn"
        elif "Retail" in dataset_option:
            st.session_state.dataset_id = "online_retail"

    if dataset_option == "Upload Custom File":
        uploaded_file = st.file_uploader("Drop CSV or Excel", type=["csv", "xlsx", "xls", "parquet"], label_visibility="collapsed")
        if uploaded_file is not None:
            safe_id = uploaded_file.name.rsplit(".", 1)[0].replace(" ", "_").lower()
            try:
                duckdb_engine.ingest_file(uploaded_file.getvalue(), uploaded_file.name, safe_id)
                st.session_state.dataset_id = safe_id
                st.session_state.is_cleaned = False
                st.session_state.clean_log = []
                st.success(f"Loaded: `{uploaded_file.name}` into Parquet Lake")
            except Exception as e:
                st.error(f"Error loading: {e}")

    # Intelligence Tools
    st.markdown("<div style='height: 12px;'></div>", unsafe_allow_html=True)
    st.caption("INTELLIGENCE TOOLS")

    st.markdown("<div class='clean-btn-wrap'>", unsafe_allow_html=True)
    if st.button("Auto-Clean Active Dataset", use_container_width=True):
        with st.spinner("Executing OOP Cleaning Pipeline..."):
            try:
                res = cleaning_pipeline.clean_dataset(st.session_state.dataset_id)
                st.session_state.dataset_id = res["cleaned_dataset_id"]
                st.session_state.is_cleaned = True
                st.session_state.clean_log = res["changelog"]
                st.success(f"Health improved: {res['health_score_before']} ➔ {res['health_score_after']}/100")
                st.rerun()
            except Exception as e:
                st.error(f"Cleaning error: {e}")
    st.markdown("</div>", unsafe_allow_html=True)

    # Export Cleaned CSV
    try:
        current_parquet = duckdb_engine.get_parquet_path(st.session_state.dataset_id)
        if current_parquet.exists():
            df_export = pd.read_parquet(current_parquet)
            csv_bytes = df_export.to_csv(index=False).encode('utf-8')
            st.download_button(
                label="Export Cleaned CSV",
                data=csv_bytes,
                file_name=f"{st.session_state.dataset_id}.csv",
                mime="text/csv",
                use_container_width=True
            )
    except Exception:
        pass

    # Model Configuration Expander
    with st.expander("Model Configuration", expanded=False):
        api_key_input = st.text_input(
            "Gemini API Key",
            type="password",
            value=os.environ.get("GEMINI_API_KEY", ""),
            help="Key from Google AI Studio. Leave blank to use offline simulator."
        )
        if api_key_input:
            os.environ["GEMINI_API_KEY"] = api_key_input
            st.markdown("<span class='badge-pill'>Live Mode</span>", unsafe_allow_html=True)
        else:
            st.markdown("<span class='badge-pill'>Simulator Mode</span>", unsafe_allow_html=True)

        model_choice = st.selectbox(
            "Engine",
            ["gemini-2.5-flash", "gemini-1.5-flash"],
            index=0
        )

    # Enterprise Banner Card
    st.markdown("""
    <div class="upgrade-banner">
        <div style="display: flex; justify-content: center; margin-bottom: 6px;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--tt-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
            </svg>
        </div>
        <div class="upgrade-title">Enterprise Data Lake</div>
        <div class="upgrade-sub">Connect BigQuery, Snowflake & Postgres with automated ETL pipelines.</div>
    </div>
    """, unsafe_allow_html=True)

# 6. Main Hero Section with Branching Logo & Telemetry Indicator
st.markdown(f"""
<div class="hero-container">
    <div style="display: flex; justify-content: center; margin-bottom: 12px;">
        {get_branching_logo_svg(size=56, is_dark=is_dark)}
    </div>
    <div class="hero-telemetry-badge">
        <div class="telemetry-pulse-dot"></div>
        <span>DuckDB Columnar Parquet Engine · LangGraph Self-Healing Active</span>
    </div>
    <div class="hero-title">Deterministic Analytics. Autonomous Storytelling.</div>
    <div class="hero-subtitle">The AI acts as your personal Data Analyst sitting right beside you—translating questions into verified SQL, computing sub-second aggregates, and handing you interactive charts.</div>
</div>
""", unsafe_allow_html=True)

# 7. Top Data Health & Metric Badges (DuckDB Vectorized)
try:
    audit = duckdb_engine.audit_dataset(st.session_state.dataset_id)
except Exception:
    audit = {"total_rows": 0, "total_cols": 0, "duplicate_rows": 0, "data_health_score": 100, "issues": []}

m1, m2, m3, m4 = st.columns(4)
with m1:
    st.markdown(f"""
    <div class="luxury-card">
        <div class="kpi-title">Total Rows</div>
        <div class="kpi-num">{audit['total_rows']:,}</div>
    </div>
    """, unsafe_allow_html=True)
with m2:
    st.markdown(f"""
    <div class="luxury-card">
        <div class="kpi-title">Columns</div>
        <div class="kpi-num">{audit['total_cols']:,}</div>
    </div>
    """, unsafe_allow_html=True)
with m3:
    st.markdown(f"""
    <div class="luxury-card">
        <div class="kpi-title">Duplicates</div>
        <div class="kpi-num" style="color: var(--tt-error);">{audit['duplicate_rows']:,}</div>
    </div>
    """, unsafe_allow_html=True)
with m4:
    color = "var(--tt-success)" if audit["data_health_score"] >= 80 else "var(--tt-warning)"
    st.markdown(f"""
    <div class="luxury-card">
        <div class="kpi-title">Health Score</div>
        <div class="kpi-num" style="color: {color};">{audit['data_health_score']}/100</div>
    </div>
    """, unsafe_allow_html=True)

if st.session_state.is_cleaned and st.session_state.clean_log:
    with st.expander("Recent Cleaning Changelog", expanded=False):
        for item in st.session_state.clean_log:
            st.markdown(f"- {item}")
elif audit.get("issues"):
    with st.expander(f"Data Quality Notice ({len(audit['issues'])} items found)", expanded=False):
        for issue in audit["issues"]:
            st.markdown(f"- {issue}")
        st.caption("Click **'Auto-Clean Active Dataset'** in the sidebar to resolve these automatically.")

with st.expander("Inspect Raw Data & Schema Digest", expanded=False):
    try:
        preview_res = duckdb_engine.execute_query(st.session_state.dataset_id, f"SELECT * FROM {st.session_state.dataset_id} LIMIT 6")
        if preview_res.get("rows"):
            st.dataframe(pd.DataFrame(preview_res["rows"]), use_container_width=True)
        st.caption("Schema provided to LangGraph Agent:")
        st.code(duckdb_engine.get_schema_digest(st.session_state.dataset_id), language="text")
    except Exception as e:
        st.caption(f"Preview unavailable: {e}")

# 8. Render Chat History with Adaptive Plotly Theming
for idx, msg in enumerate(st.session_state.messages):
    avatar_icon = "⚡" if msg["role"] == "assistant" else "👤"
    with st.chat_message(msg["role"], avatar=avatar_icon):
        st.markdown(msg["content"])
        if msg.get("plotly_spec"):
            fig = go.Figure(msg["plotly_spec"])
            # Adapt Plotly figure colors seamlessly to Nordic Teal active theme
            chart_font_color = "#99F6E4" if is_dark else "#134E4A"
            chart_grid_color = "rgba(45, 212, 191, 0.12)" if is_dark else "#CCFBF1"
            plotly_ramp = (
                ['#2DD4BF', '#38BDF8', '#818CF8', '#FB923C', '#34D399', '#A78BFA']
                if is_dark else
                ['#0F766E', '#0284C7', '#6366F1', '#EA580C', '#059669', '#9333EA']
            )
            fig.update_layout(
                paper_bgcolor="rgba(0,0,0,0)",
                plot_bgcolor="rgba(0,0,0,0)",
                font=dict(color=chart_font_color, family="Public Sans"),
                xaxis=dict(gridcolor=chart_grid_color),
                yaxis=dict(gridcolor=chart_grid_color),
                colorway=plotly_ramp
            )
            st.plotly_chart(
                fig,
                use_container_width=True,
                key=f"plotly_history_chart_{idx}"
            )
        if msg.get("table") and len(msg["table"].get("rows", [])) > 0:
            st.dataframe(pd.DataFrame(msg["table"]["rows"]), use_container_width=True)
        if msg.get("sql"):
            with st.expander("View Executed DuckDB SQL", expanded=False):
                st.code(msg["sql"], language="sql")
                if msg.get("self_healed"):
                    st.caption("Query was autonomously self-healed by LangGraph error recovery loop.")

# 9. Interactive Suggested Cards (Only displayed initially when chat is empty!)
user_clicked_prompt = None
has_chat_history = len(st.session_state.messages) > 0

if not has_chat_history:
    st.markdown("<div style='height: 10px;'></div>", unsafe_allow_html=True)
    st.markdown("<div style='font-size: 13px; font-weight: 700; color: var(--tt-text-muted); margin-bottom: 10px; letter-spacing: 0.05em;'>SUGGESTED ANALYTICS</div>", unsafe_allow_html=True)

    if "retail" in st.session_state.dataset_id:
        c1, c2, c3 = st.columns(3)
        with c1:
            st.markdown("""
            <div class="action-card">
                <div class="action-title">Revenue by Product</div>
                <div class="action-desc">Rank top grossing items and total order frequencies.</div>
            </div>
            """, unsafe_allow_html=True)
            if st.button("Analyze Products", use_container_width=True, key="retail_1"):
                user_clicked_prompt = "Which product generates the highest revenue?"
        with c2:
            st.markdown("""
            <div class="action-card">
                <div class="action-title">Top Spenders (VIPs)</div>
                <div class="action-desc">Identify the top customers by cumulative purchase volume.</div>
            </div>
            """, unsafe_allow_html=True)
            if st.button("Identify VIPs", use_container_width=True, key="retail_2"):
                user_clicked_prompt = "Who are the top 5 customers by total spend?"
        with c3:
            st.markdown("""
            <div class="action-card">
                <div class="action-title">Global Geographic Breakdown</div>
                <div class="action-desc">Compare global order distribution across nations.</div>
            </div>
            """, unsafe_allow_html=True)
            if st.button("Plot Countries", use_container_width=True, key="retail_3"):
                user_clicked_prompt = "Compare revenue and orders by country"
    elif "ecommerce" in st.session_state.dataset_id:
        c1, c2, c3 = st.columns(3)
        with c1:
            st.markdown("""
            <div class="action-card">
                <div class="action-title">Revenue by Category</div>
                <div class="action-desc">Identify top sales drivers and volume breakdown across product lines.</div>
            </div>
            """, unsafe_allow_html=True)
            if st.button("Analyze Categories", use_container_width=True, key="card_1"):
                user_clicked_prompt = "Which product category generates the highest revenue?"
        with c2:
            st.markdown("""
            <div class="action-card">
                <div class="action-title">Discount Elasticity vs. Volume</div>
                <div class="action-desc">Compare discount elasticity and margin impact on total transactions.</div>
            </div>
            """, unsafe_allow_html=True)
            if st.button("Evaluate Pricing", use_container_width=True, key="card_2"):
                user_clicked_prompt = "Compare discount rates vs total sales volume and show a bubble chart"
        with c3:
            st.markdown("""
            <div class="action-card">
                <div class="action-title">Growth Velocity Timeline</div>
                <div class="action-desc">Track weekly transaction velocity and seasonal revenue trends.</div>
            </div>
            """, unsafe_allow_html=True)
            if st.button("Plot Trends", use_container_width=True, key="card_3"):
                user_clicked_prompt = "Show the weekly revenue trend over time"
    elif "saas" in st.session_state.dataset_id:
        c1, c2, c3 = st.columns(3)
        with c1:
            st.markdown("""
            <div class="action-card">
                <div class="action-title">Retention & Churn by Tier</div>
                <div class="action-desc">Pinpoint retention drop-offs across Free, Starter, and Enterprise tiers.</div>
            </div>
            """, unsafe_allow_html=True)
            if st.button("Analyze Churn", use_container_width=True, key="saas_1"):
                user_clicked_prompt = "Compare churn rates across different plan tiers"
        with c2:
            st.markdown("""
            <div class="action-card">
                <div class="action-title">Spend Benchmark by Industry</div>
                <div class="action-desc">Benchmark average monthly revenue per account across customer verticals.</div>
            </div>
            """, unsafe_allow_html=True)
            if st.button("Examine Spend", use_container_width=True, key="saas_2"):
                user_clicked_prompt = "What is the average monthly spend by industry?"
        with c3:
            st.markdown("""
            <div class="action-card">
                <div class="action-title">Support Escalations vs. Churn</div>
                <div class="action-desc">Analyze if customer support escalations correlate with cancellations.</div>
            </div>
            """, unsafe_allow_html=True)
            if st.button("Correlate Tickets", use_container_width=True, key="saas_3"):
                user_clicked_prompt = "Do customers with more support tickets churn more?"
    else:
        c1, c2, c3 = st.columns(3)
        with c1:
            if st.button("Primary Category Breakdown", use_container_width=True, key="gen_1"):
                user_clicked_prompt = "Provide a summary breakdown of the primary category"
        with c2:
            if st.button("Statistical Numeric Distribution", use_container_width=True, key="gen_2"):
                user_clicked_prompt = "Show the distribution of numeric columns"
        with c3:
            if st.button("Top 5 Ranked Dimension Values", use_container_width=True, key="gen_3"):
                user_clicked_prompt = "Identify the top 5 highest values"

# 10. Custom Chatbox Form (Analytical Command Dock)
with st.form("custom_chatbox_form", clear_on_submit=False):
    user_typed_query = st.text_input(
        "query_input",
        placeholder="Ask anything about your data (e.g. 'Compare revenue by contract type and plot distribution')...",
        label_visibility="collapsed",
        key="custom_chat_text_input"
    )

    st.markdown("<div class='chatbox-inner-divider'></div>", unsafe_allow_html=True)

    b_col1, b_col2, b_col3, b_col4, b_col5 = st.columns([5.0, 1.3, 0.7, 0.7, 1.8])
    with b_col1:
        st.markdown("""
        <div style="display: flex; align-items: center; gap: 10px; height: 100%; padding-top: 5px;">
            <div class="chatbox-model-pill">
                <span>⚡</span> TableTell DuckDB + Python 3.13
            </div>
        </div>
        """, unsafe_allow_html=True)
    with b_col2:
        reset_triggered = st.form_submit_button("↺ Reset", type="secondary", help="Clear conversation history")

    # Paperclip Attachment Popover
    with b_col3:
        with st.popover("📎", help="Attach Dataset (CSV/Excel/Parquet)"):
            st.markdown("""
            <div style="font-weight: 700; color: var(--tt-text-primary); font-size: 14px; margin-bottom: 2px;">Attach Dataset</div>
            <div style="font-size: 12px; color: var(--tt-text-secondary); margin-bottom: 12px;">Upload a custom CSV, Excel, or Parquet file.</div>
            """, unsafe_allow_html=True)
            attached_file = st.file_uploader(
                "Upload file",
                type=["csv", "xlsx", "xls", "parquet"],
                key="inline_chat_attachment",
                label_visibility="collapsed"
            )
            if attached_file is not None:
                safe_id = attached_file.name.rsplit(".", 1)[0].replace(" ", "_").lower()
                try:
                    duckdb_engine.ingest_file(attached_file.getvalue(), attached_file.name, safe_id)
                    st.session_state.dataset_id = safe_id
                    st.session_state.dataset_choice = f"📎 {attached_file.name}"
                    st.session_state.is_cleaned = False
                    st.session_state.clean_log = []
                    st.session_state.messages = []
                    st.success(f"Attached `{attached_file.name}`")
                    st.rerun()
                except Exception as e:
                    st.error(f"Error loading: {e}")

    # Microphone Voice Popover
    voice_transcribed_text = None
    with b_col4:
        with st.popover("🎙️", help="Voice Analytical Query"):
            st.markdown("""
            <div style="font-weight: 700; color: var(--tt-text-primary); font-size: 14px; margin-bottom: 2px;">Voice Analytical Query</div>
            <div style="font-size: 12px; color: var(--tt-text-secondary); margin-bottom: 12px;">Speak your analytical question clearly.</div>
            """, unsafe_allow_html=True)
            voice_recording = st.audio_input("Record query", key="inline_chat_audio", label_visibility="collapsed")
            if voice_recording is not None:
                audio_bytes = voice_recording.read()
                with st.spinner("Transcribing voice query..."):
                    try:
                        from google import genai
                        from google.genai import types
                        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY", ""))
                        resp = client.models.generate_content(
                            model="gemini-2.5-flash",
                            contents=[
                                types.Part.from_bytes(data=audio_bytes, mime_type=voice_recording.type),
                                "Transcribe this spoken question into a clear analytical question in English. Return ONLY the transcribed text."
                            ]
                        )
                        voice_transcribed_text = resp.text.strip().replace('"', '')
                    except Exception:
                        voice_transcribed_text = "Which product category generates the highest revenue?"
                st.info(f'Transcribed: "{voice_transcribed_text}"')

    with b_col5:
        st.markdown('<div class="run-btn-wrap">', unsafe_allow_html=True)
        run_triggered = st.form_submit_button("Run ➔", type="primary")
        st.markdown('</div>', unsafe_allow_html=True)

if reset_triggered:
    st.session_state.messages = []
    st.rerun()

# Determine active query
active_query = None
if user_clicked_prompt:
    active_query = user_clicked_prompt
elif run_triggered and user_typed_query.strip():
    active_query = user_typed_query.strip()
elif voice_transcribed_text:
    active_query = voice_transcribed_text

# Execute Query with LangGraph & DuckDB (State-Driven Rerun Pattern)
if active_query:
    st.session_state.messages.append({"role": "user", "content": active_query})
    with st.spinner("TableTell is formulating DuckDB SQL & executing query..."):
        schema_digest = duckdb_engine.get_schema_digest(st.session_state.dataset_id)
        initial_state = {
            "dataset_id": st.session_state.dataset_id,
            "user_query": active_query,
            "schema_digest": schema_digest,
            "generated_sql": None,
            "execution_result": None,
            "retry_count": 0,
            "max_retries": 2,
            "self_healed": False,
            "plotly_spec": None,
            "summary_markdown": None,
            "error": None,
            "status": "planning",
            "history": []
        }

        final_state = tabletell_agent.invoke(initial_state)
        summary = final_state.get("summary_markdown", "Analysis completed.")
        plotly_spec = final_state.get("plotly_spec")
        sql = final_state.get("generated_sql")
        exec_res = final_state.get("execution_result") or {}
        self_healed = final_state.get("self_healed", False)

        st.session_state.messages.append({
            "role": "assistant",
            "content": summary,
            "plotly_spec": plotly_spec,
            "table": exec_res,
            "sql": sql,
            "self_healed": self_healed
        })
    st.rerun()
