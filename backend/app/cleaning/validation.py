"""
Post-transformation validation to prevent catastrophic data loss.
"""

import pandas as pd
from app.core.exceptions import CleaningPlanError


def validate_transformed_data(df_before: pd.DataFrame, df_after: pd.DataFrame):
    """
    Validates that transformation did not result in empty dataset or accidental column deletion.
    """
    if df_after.empty and not df_before.empty:
        raise CleaningPlanError("Transformation resulted in an empty dataset. Aborting cleaning operation.")

    if len(df_after.columns) == 0:
        raise CleaningPlanError("Transformation resulted in zero columns. Aborting cleaning operation.")

    # Max allowed row reduction guard: cannot drop > 95% of rows in a single clean run
    if len(df_before) > 0:
        retention_ratio = len(df_after) / len(df_before)
        if retention_ratio < 0.05:
            raise CleaningPlanError(
                f"Transformation dropped {round((1 - retention_ratio) * 100, 1)}% of rows. Operation aborted for data safety."
            )
