"""
Unit tests for distribution profiling, modality detection, and dataset topology.
"""

import unittest
import numpy as np
import pandas as pd
from app.profiling.distribution import compute_column_distribution, compute_dataset_distribution_topology


class TestDistributionProfiling(unittest.TestCase):
    def test_normal_distribution(self):
        np.random.seed(42)
        normal_data = pd.Series(np.random.normal(loc=100.0, scale=15.0, size=1000))
        dist = compute_column_distribution(normal_data, "test_normal", 1000)

        self.assertIsNotNone(dist)
        self.assertEqual(dist.distribution_type, "normal")
        self.assertGreaterEqual(dist.confidence, 0.70)
        self.assertTrue(dist.is_symmetric)
        self.assertGreater(len(dist.bins), 5)
        self.assertIsNotNone(dist.box_plot)

    def test_right_skewed_distribution_with_outliers(self):
        np.random.seed(42)
        skewed_data = pd.Series(np.random.exponential(scale=20.0, size=800))
        dist = compute_column_distribution(skewed_data, "test_skewed", 800)

        self.assertIsNotNone(dist)
        self.assertEqual(dist.distribution_type, "right_skewed")
        self.assertGreater(dist.skewness, 0.5)
        self.assertIn("log-transformation", dist.business_recommendation.lower())
        self.assertGreater(dist.box_plot.max, dist.box_plot.q75)

    def test_zero_inflated_distribution(self):
        # 60% zeros, 40% positive values
        zeros = [0.0] * 600
        positives = list(np.random.uniform(10.0, 100.0, size=400))
        zero_data = pd.Series(zeros + positives)
        dist = compute_column_distribution(zero_data, "test_zeros", 1000)

        self.assertIsNotNone(dist)
        self.assertEqual(dist.distribution_type, "zero_inflated")
        self.assertIn("two-part", dist.business_recommendation.lower())

    def test_uniform_distribution(self):
        np.random.seed(42)
        uniform_data = pd.Series(np.random.uniform(10.0, 50.0, size=1000))
        dist = compute_column_distribution(uniform_data, "test_uniform", 1000)

        self.assertIsNotNone(dist)
        self.assertIn(dist.distribution_type, ["uniform", "normal"])
        self.assertTrue(dist.is_symmetric)

    def test_dataset_topology_aggregation(self):
        columns = [
            {
                "column_name": "sales",
                "semantic_type": "numeric",
                "has_outliers": True,
                "distribution": {"distribution_type": "right_skewed"}
            },
            {
                "column_name": "customer_age",
                "semantic_type": "numeric",
                "has_outliers": False,
                "distribution": {"distribution_type": "normal"}
            },
            {
                "column_name": "category",
                "semantic_type": "categorical",
                "has_outliers": False,
                "distribution": None
            }
        ]
        topology = compute_dataset_distribution_topology(columns)

        self.assertEqual(topology.total_analyzed, 2)
        self.assertEqual(topology.skewed_count, 1)
        self.assertEqual(topology.normal_count, 1)
        self.assertEqual(topology.categorical_count, 1)
        self.assertTrue(len(topology.key_findings) > 0)


if __name__ == "__main__":
    unittest.main()
