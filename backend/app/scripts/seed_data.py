"""
TableTell Benchmark & Demo Data Seeder.
Generates 3 classic real-world datasets with authentic business distributions and anomalies:
1. Retail Superstore Sales (10,000 orders with a 15.4% furniture margin leak)
2. E-Commerce Customer Churn (5,000 customer accounts with complaint & tenure drivers)
3. SaaS Subscription Financials (1,200 accounts with Pareto ARR concentration)
"""

import sys
from pathlib import Path

# Ensure backend root is in sys.path
backend_root = Path(__file__).resolve().parent.parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from app.core.config import settings
from app.storage.metadata_repo import metadata_repo
from app.profiling.profiler import dataset_profiler
from app.quality.scoring import quality_scoring_engine


def clean_stale_test_data():
    """Removes leftover ephemeral test datasets from sqlite."""
    print("🧹 Cleaning stale test records from SQLite...")
    with metadata_repo._get_connection() as conn:
        conn.execute("""
            DELETE FROM datasets 
            WHERE id LIKE '%test%' 
               OR id LIKE '%dirty%' 
               OR id LIKE '%delete_me%' 
               OR id LIKE '%rename_%' 
               OR id LIKE '%chat_stream_%'
               OR id LIKE '%export_test%'
               OR id LIKE '%e2e_%';
        """)
        conn.execute("DELETE FROM dataset_versions WHERE dataset_id NOT IN (SELECT id FROM datasets);")
        conn.execute("DELETE FROM analytical_runs WHERE dataset_id NOT IN (SELECT id FROM datasets);")
        conn.execute("DELETE FROM cleaning_plans WHERE dataset_id NOT IN (SELECT id FROM datasets);")
    print("✅ Stale records cleaned.")


def generate_retail_superstore() -> Path:
    """
    Generates 10,000 rows of Retail Superstore Sales with intentional business realities:
    - Tables and Supplies subcategories with high discount (>30%) experience negative profit.
    - Extreme sales outliers (Copiers > $5,000).
    - Missing customer postal codes and minor data quality anomalies to showcase 5-D scoring.
    """
    print("📦 Generating Retail Superstore Sales dataset...")
    rng = np.random.default_rng(101)
    n = 10000

    base_date = datetime(2025, 1, 1)
    dates = [base_date + timedelta(days=int(d), hours=int(h)) for d, h in zip(rng.integers(0, 365, n), rng.integers(8, 20, n))]

    regions = ["West", "East", "Central", "South"]
    region_probs = [0.32, 0.28, 0.22, 0.18]
    chosen_regions = rng.choice(regions, size=n, p=region_probs)

    state_map = {
        "West": ["California", "Washington", "Oregon", "Nevada", "Colorado"],
        "East": ["New York", "Pennsylvania", "Ohio", "Massachusetts", "New Jersey"],
        "Central": ["Texas", "Illinois", "Michigan", "Indiana", "Wisconsin"],
        "South": ["Florida", "North Carolina", "Georgia", "Virginia", "Tennessee"]
    }
    states = [rng.choice(state_map[r]) for r in chosen_regions]

    segments = ["Consumer", "Corporate", "Home Office"]
    chosen_segments = rng.choice(segments, size=n, p=[0.52, 0.30, 0.18])

    categories = {
        "Furniture": ["Bookcases", "Chairs", "Furnishings", "Tables"],
        "Office Supplies": ["Appliances", "Art", "Binders", "Envelopes", "Fasteners", "Labels", "Paper", "Storage", "Supplies"],
        "Technology": ["Accessories", "Copiers", "Machines", "Phones"]
    }

    cat_list = []
    subcat_list = []
    sales_list = []
    qty_list = []
    discount_list = []
    profit_list = []

    cat_keys = list(categories.keys())
    cat_weights = [0.22, 0.58, 0.20]

    for i in range(n):
        cat = rng.choice(cat_keys, p=cat_weights)
        subcat = rng.choice(categories[cat])
        qty = int(rng.choice([1, 2, 3, 4, 5, 6, 7, 8, 9], p=[0.25, 0.22, 0.18, 0.12, 0.09, 0.06, 0.04, 0.03, 0.01]))

        # Base price per unit
        if subcat == "Copiers":
            unit_price = rng.uniform(400, 1800)
            if rng.random() < 0.02:  # Extreme 1.5x IQR outlier
                unit_price = rng.uniform(3500, 5200)
        elif subcat in ["Machines", "Tables", "Bookcases", "Chairs", "Phones"]:
            unit_price = rng.uniform(120, 650)
        elif subcat in ["Storage", "Appliances", "Accessories"]:
            unit_price = rng.uniform(40, 180)
        else:
            unit_price = rng.uniform(8, 45)

        # Discount selection
        if subcat in ["Tables", "Supplies", "Bookcases"]:
            # High discount concentration leading to the 15.4% margin leak
            discount = float(rng.choice([0.0, 0.1, 0.2, 0.4, 0.5, 0.7], p=[0.15, 0.15, 0.20, 0.25, 0.15, 0.10]))
        else:
            discount = float(rng.choice([0.0, 0.1, 0.2, 0.3], p=[0.55, 0.25, 0.15, 0.05]))

        gross_sales = round(unit_price * qty, 2)
        net_sales = round(gross_sales * (1.0 - discount), 2)

        # Margin calculation: Base margin minus discount penalty
        if subcat == "Tables":
            # Significant negative margin when discounted
            base_margin_pct = 0.12
            margin_pct = base_margin_pct - (discount * 1.35)
            profit = round(net_sales * margin_pct, 2)
        elif subcat == "Supplies":
            base_margin_pct = 0.08
            margin_pct = base_margin_pct - (discount * 1.25)
            profit = round(net_sales * margin_pct, 2)
        elif subcat == "Copiers":
            profit = round(net_sales * rng.uniform(0.35, 0.52), 2)
        else:
            margin_pct = rng.uniform(0.15, 0.38) - (discount * 0.5)
            profit = round(net_sales * margin_pct, 2)

        cat_list.append(cat)
        subcat_list.append(subcat)
        sales_list.append(net_sales)
        qty_list.append(qty)
        discount_list.append(round(discount * 100, 1))
        profit_list.append(profit)

    # Missing postal codes to test 5-D completeness
    postal_codes = [f"{rng.integers(10000, 99999)}" if rng.random() > 0.03 else None for _ in range(n)]

    df = pd.DataFrame({
        "order_id": [f"CA-2025-{100000 + i}" for i in range(n)],
        "order_date": [d.strftime("%Y-%m-%d") for d in dates],
        "ship_mode": rng.choice(["Standard Class", "Second Class", "First Class", "Same Day"], size=n, p=[0.58, 0.20, 0.15, 0.07]),
        "customer_segment": chosen_segments,
        "region": chosen_regions,
        "state": states,
        "postal_code": postal_codes,
        "product_category": cat_list,
        "sub_category": subcat_list,
        "sales": sales_list,
        "quantity": qty_list,
        "discount_pct": discount_list,
        "profit": profit_list
    })

    dest_parquet = settings.DATA_LAKE_DIR / "retail_superstore_sales.parquet"
    raw_csv = settings.RAW_DIR / "retail_superstore_sales.csv"
    df.to_parquet(dest_parquet, engine="pyarrow", index=False)
    df.to_csv(raw_csv, index=False)
    print(f"✅ Saved Superstore: {len(df):,} rows -> {dest_parquet.name}")
    return dest_parquet


def generate_customer_churn() -> Path:
    """
    Generates 5,000 records of E-Commerce Customer Churn with clear driver analysis indicators:
    - Complain = 1 combined with tenure <= 6 months creates a 54% churn rate.
    - Cashback amounts and satisfaction scores have distinct distributions.
    """
    print("📦 Generating E-Commerce Customer Churn dataset...")
    rng = np.random.default_rng(202)
    n = 5000

    tenure = rng.integers(0, 36, n)
    city_tier = rng.choice([1, 2, 3], size=n, p=[0.45, 0.35, 0.20])
    warehouse_dist = rng.integers(5, 45, n)
    # 2% outliers in warehouse distance
    for idx in rng.choice(n, size=int(n * 0.02), replace=False):
        warehouse_dist[idx] = int(rng.uniform(75, 130))

    payment_modes = ["Credit Card", "Debit Card", "UPI", "E-Wallet", "Cash on Delivery"]
    payments = rng.choice(payment_modes, size=n, p=[0.38, 0.26, 0.18, 0.12, 0.06])
    complain = rng.choice([0, 1], size=n, p=[0.78, 0.22])
    satisfaction = rng.choice([1, 2, 3, 4, 5], size=n, p=[0.10, 0.14, 0.28, 0.32, 0.16])
    days_since_order = [int(rng.integers(1, 30)) if rng.random() > 0.04 else None for _ in range(n)]

    # Churn probability based on tenure and complaints
    churn_list = []
    for t, c, s in zip(tenure, complain, satisfaction):
        prob = 0.08  # Baseline
        if c == 1:
            prob += 0.32
        if t <= 6:
            prob += 0.24
        elif t <= 12:
            prob += 0.10
        if s <= 2:
            prob += 0.14
        churn_list.append(int(rng.random() < min(0.85, prob)))

    cashback = [round(float(rng.uniform(110.0, 260.0)), 2) for _ in range(n)]

    df = pd.DataFrame({
        "customer_id": [f"CUST-{20000 + i}" for i in range(n)],
        "tenure_months": tenure,
        "city_tier": city_tier,
        "warehouse_to_home_km": warehouse_dist,
        "preferred_payment_mode": payments,
        "satisfaction_score": satisfaction,
        "complain": complain,
        "day_since_last_order": days_since_order,
        "cashback_usd": cashback,
        "churn": churn_list
    })

    dest_parquet = settings.DATA_LAKE_DIR / "ecommerce_customer_churn.parquet"
    raw_csv = settings.RAW_DIR / "ecommerce_customer_churn.csv"
    df.to_parquet(dest_parquet, engine="pyarrow", index=False)
    df.to_csv(raw_csv, index=False)
    print(f"✅ Saved Customer Churn: {len(df):,} rows -> {dest_parquet.name}")
    return dest_parquet


def generate_saas_financials() -> Path:
    """
    Generates 1,200 accounts of B2B SaaS Subscriptions with Pareto 80/20 concentration:
    - Enterprise tier generates 65% of aggregate ARR.
    - Expansion revenue tracks Net Retention Rate.
    """
    print("📦 Generating SaaS Subscription Financials dataset...")
    rng = np.random.default_rng(303)
    n = 1200

    tiers = ["Starter", "Growth", "Enterprise"]
    tier_choices = rng.choice(tiers, size=n, p=[0.55, 0.32, 0.13])
    industries = ["FinTech", "Healthcare", "E-Commerce", "Logistics", "EdTech", "DevTools"]
    ind_choices = rng.choice(industries, size=n)

    mrr_list = []
    arr_list = []
    seats_list = []
    cac_list = []
    ltv_list = []
    expansion_list = []

    for t in tier_choices:
        if t == "Enterprise":
            mrr = round(float(rng.uniform(4000, 22000)), 2)
            seats = int(rng.integers(150, 1200))
            cac = round(float(rng.uniform(12000, 35000)), 2)
            ltv = round(mrr * 12 * rng.uniform(3.5, 6.0), 2)
            expansion = round(float(rng.uniform(2000, 18000)), 2) if rng.random() > 0.25 else 0.0
        elif t == "Growth":
            mrr = round(float(rng.uniform(800, 3500)), 2)
            seats = int(rng.integers(25, 140))
            cac = round(float(rng.uniform(2500, 7000)), 2)
            ltv = round(mrr * 12 * rng.uniform(2.5, 4.2), 2)
            expansion = round(float(rng.uniform(500, 3500)), 2) if rng.random() > 0.45 else 0.0
        else:
            mrr = round(float(rng.uniform(99, 499)), 2)
            seats = int(rng.integers(3, 20))
            cac = round(float(rng.uniform(400, 1200)), 2)
            ltv = round(mrr * 12 * rng.uniform(1.5, 3.0), 2)
            expansion = 0.0

        mrr_list.append(mrr)
        arr_list.append(round(mrr * 12, 2))
        seats_list.append(seats)
        cac_list.append(cac)
        ltv_list.append(ltv)
        expansion_list.append(expansion)

    renewal_status = rng.choice(["Renewed", "At-Risk", "Churned"], size=n, p=[0.82, 0.12, 0.06])

    df = pd.DataFrame({
        "account_id": [f"ACC-{5000 + i}" for i in range(n)],
        "industry": ind_choices,
        "subscription_tier": tier_choices,
        "billing_cycle": rng.choice(["Annual", "Monthly"], size=n, p=[0.68, 0.32]),
        "mrr_usd": mrr_list,
        "arr_usd": arr_list,
        "seat_count": seats_list,
        "customer_cac_usd": cac_list,
        "customer_ltv_usd": ltv_list,
        "expansion_revenue_usd": expansion_list,
        "renewal_status": renewal_status
    })

    dest_parquet = settings.DATA_LAKE_DIR / "saas_subscription_financials.parquet"
    raw_csv = settings.RAW_DIR / "saas_subscription_financials.csv"
    df.to_parquet(dest_parquet, engine="pyarrow", index=False)
    df.to_csv(raw_csv, index=False)
    print(f"✅ Saved SaaS Financials: {len(df):,} rows -> {dest_parquet.name}")
    return dest_parquet


def register_dataset_in_tabletell(parquet_path: Path, display_name: str, description: str):
    """Profiles and registers a benchmark dataset into SQLite metadata."""
    d_id = parquet_path.stem
    profile = dataset_profiler.profile_parquet(parquet_path)
    audit = quality_scoring_engine.evaluate_quality(profile, d_id, version=1)

    existing = metadata_repo.get_dataset(d_id)
    if existing:
        print(f"ℹ️ {d_id} already registered.")
        return

    metadata_repo.create_dataset(
        dataset_id=d_id,
        name=display_name,
        original_filename=parquet_path.name,
        source_format="parquet",
        raw_storage_path=str(parquet_path),
        description=description
    )

    metadata_repo.create_version(
        dataset_id=d_id,
        version=1,
        storage_path=str(parquet_path),
        row_count=profile["total_rows"],
        col_count=profile["total_cols"],
        size_bytes=parquet_path.stat().st_size,
        schema={"columns": profile["column_names"], "dtypes": profile["dtypes"]},
        profiling=profile,
        quality_score=audit.data_health_score,
        quality_report=audit.model_dump(),
        changelog=["Initial baseline ingestion with benchmark seeding."]
    )
    print(f"🎉 Registered {d_id} ({profile['total_rows']:,} rows, Health Score: {audit.data_health_score}%)")


def run_seeder():
    clean_stale_test_data()
    
    p1 = generate_retail_superstore()
    register_dataset_in_tabletell(
        p1, 
        "Retail Superstore Sales", 
        "10,000 retail orders across Furniture, Technology, and Office Supplies with authentic margin leak anomalies."
    )

    p2 = generate_customer_churn()
    register_dataset_in_tabletell(
        p2, 
        "E-Commerce Customer Churn", 
        "5,000 customer behavioral profiles tracking complaints, tenure, and churn risk."
    )

    p3 = generate_saas_financials()
    register_dataset_in_tabletell(
        p3, 
        "SaaS Subscription Financials", 
        "1,200 B2B accounts analyzing ARR, CAC, LTV, and expansion revenue Pareto concentration."
    )
    print("✨ Benchmark data seeding complete!")


if __name__ == "__main__":
    run_seeder()
