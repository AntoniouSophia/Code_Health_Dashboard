-- --------------------------------------------------------
-- Διακομιστής:                  127.0.0.1
-- Έκδοση διακομιστή:            10.4.32-MariaDB - mariadb.org binary distribution
-- Λειτ. σύστημα διακομιστή:     Win64
-- HeidiSQL Έκδοση:              12.8.0.6908
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Dumping database structure for analyzed_projects
CREATE DATABASE IF NOT EXISTS `analyzed_projects` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */;
USE `analyzed_projects`;

-- Dumping structure for πίνακας analyzed_projects.analysis_runs
CREATE TABLE IF NOT EXISTS `analysis_runs` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `run_date` datetime NOT NULL DEFAULT current_timestamp(),
  `commit_sha` varchar(80) DEFAULT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'completed',
  `error_message` text DEFAULT NULL,
  `duration_seconds` decimal(12,2) DEFAULT NULL,
  `sonar_ncloc` int(10) unsigned DEFAULT NULL,
  `sonar_technical_debt_minutes` int(10) unsigned DEFAULT NULL,
  `sonar_technical_debt_days` decimal(12,4) DEFAULT NULL,
  `sonar_td_ratio` decimal(10,4) DEFAULT NULL,
  `sonar_complexity` int(10) unsigned DEFAULT NULL,
  `sonar_cognitive_complexity` int(10) unsigned DEFAULT NULL,
  `sonar_code_smells` int(10) unsigned DEFAULT NULL,
  `sonar_bugs` int(10) unsigned DEFAULT NULL,
  `sonar_duplicated_lines` int(10) unsigned DEFAULT NULL,
  `sonar_duplicated_lines_density` decimal(10,4) DEFAULT NULL,
  `sonar_files` int(10) unsigned DEFAULT NULL,
  `sonar_classes` int(10) unsigned DEFAULT NULL,
  `sonar_functions` int(10) unsigned DEFAULT NULL,
  `kloc` decimal(12,3) DEFAULT NULL,
  `allincode_reported_loc` int(10) unsigned DEFAULT NULL,
  `allincode_cumulative_debt` decimal(18,6) DEFAULT NULL,
  `allincode_interest_rate_avg` decimal(18,6) DEFAULT NULL,
  `allincode_refactorings` int(10) unsigned DEFAULT NULL,
  `total_merged_items` int(10) unsigned DEFAULT NULL,
  `source_items` int(10) unsigned DEFAULT NULL,
  `test_items` int(10) unsigned DEFAULT NULL,
  `items_with_git_data` int(10) unsigned DEFAULT NULL,
  `items_with_sonar_data` int(10) unsigned DEFAULT NULL,
  `items_with_allincode_data` int(10) unsigned DEFAULT NULL,
  `items_with_high_td_data` int(10) unsigned DEFAULT NULL,
  `path_matches_exact` int(11) NOT NULL DEFAULT 0,
  `path_matches_unique_suffix` int(11) NOT NULL DEFAULT 0,
  `path_matches_unmatched` int(11) NOT NULL DEFAULT 0,
  `total_high_risk_items` int(10) unsigned DEFAULT NULL,
  `total_high_td_items` int(10) unsigned DEFAULT NULL,
  `source_high_td_items` int(10) unsigned DEFAULT NULL,
  `source_high_td_ratio` decimal(10,4) DEFAULT NULL,
  `average_high_td_probability` decimal(10,4) DEFAULT NULL,
  `max_high_td_probability` decimal(10,4) DEFAULT NULL,
  `top_high_td_probability_average` decimal(10,4) DEFAULT NULL,
  `high_td_probability_focus_count` int(10) unsigned DEFAULT NULL,
  `complexity_per_kloc` decimal(12,4) DEFAULT NULL,
  `cognitive_complexity_per_kloc` decimal(12,4) DEFAULT NULL,
  `code_smells_per_kloc` decimal(12,4) DEFAULT NULL,
  `bugs_per_kloc` decimal(12,4) DEFAULT NULL,
  `technical_debt_project_risk` decimal(6,2) DEFAULT NULL,
  `complexity_project_risk` decimal(6,2) DEFAULT NULL,
  `quality_project_risk` decimal(6,2) DEFAULT NULL,
  `duplication_project_risk` decimal(6,2) DEFAULT NULL,
  `hotspot_project_risk` decimal(6,2) DEFAULT NULL,
  `structural_project_risk` decimal(6,2) DEFAULT NULL,
  `high_td_project_risk` decimal(6,2) DEFAULT NULL,
  `overall_project_risk` decimal(6,2) DEFAULT NULL,
  `global_health_score` decimal(6,2) DEFAULT NULL,
  `average_top_hotspot_score` decimal(6,2) DEFAULT NULL,
  `average_top_structural_risk_score` decimal(6,2) DEFAULT NULL,
  `project_risk_files_count` int(10) unsigned DEFAULT NULL,
  `refactoring_candidate_items` int(10) unsigned DEFAULT NULL,
  `project_risk_scope_items` int(10) unsigned DEFAULT NULL,
  `project_file_risk_normalization` varchar(64) DEFAULT NULL,
  `calibration_reference_version` int(11) DEFAULT NULL,
  `calibration_reference_files` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `high_td_endpoint_available` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_analysis_runs_project_date` (`project_id`,`run_date`),
  KEY `idx_analysis_runs_project_id` (`project_id`),
  CONSTRAINT `fk_analysis_runs_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for πίνακας analyzed_projects.merged_file_metrics
CREATE TABLE IF NOT EXISTS `merged_file_metrics` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `analysis_run_id` int(10) unsigned NOT NULL,
  `path` varchar(1024) NOT NULL,
  `path_match_method` varchar(32) DEFAULT NULL,
  `allincode_source_path` varchar(1024) DEFAULT NULL,
  `is_test_file` tinyint(1) NOT NULL DEFAULT 0,
  `has_git_data` tinyint(1) NOT NULL DEFAULT 0,
  `has_sonar_data` tinyint(1) NOT NULL DEFAULT 0,
  `has_allincode_data` tinyint(1) NOT NULL DEFAULT 0,
  `has_high_td_data` tinyint(1) NOT NULL DEFAULT 0,
  `is_current_analyzable` tinyint(1) NOT NULL DEFAULT 0,
  `is_git_only` tinyint(1) NOT NULL DEFAULT 0,
  `is_code_file` tinyint(1) NOT NULL DEFAULT 0,
  `is_refactoring_candidate` tinyint(1) NOT NULL DEFAULT 0,
  `commit_count` int(10) unsigned DEFAULT NULL,
  `churn` int(10) unsigned DEFAULT NULL,
  `authors_count` int(10) unsigned DEFAULT NULL,
  `lines_added` int(10) unsigned DEFAULT NULL,
  `lines_deleted` int(10) unsigned DEFAULT NULL,
  `sonar_ncloc` int(10) unsigned DEFAULT NULL,
  `sonar_complexity` int(10) unsigned DEFAULT NULL,
  `sonar_cognitive_complexity` int(10) unsigned DEFAULT NULL,
  `sonar_debt_minutes` int(10) unsigned DEFAULT NULL,
  `sonar_code_smells` int(10) unsigned DEFAULT NULL,
  `sonar_bugs` int(10) unsigned DEFAULT NULL,
  `sonar_duplicated_lines` int(10) unsigned DEFAULT NULL,
  `sonar_duplicated_lines_density` decimal(10,4) DEFAULT NULL,
  `allincode_loc` int(10) unsigned DEFAULT NULL,
  `allincode_total_debt` decimal(18,6) DEFAULT NULL,
  `allincode_debt` decimal(18,6) DEFAULT NULL,
  `allincode_interest_rate` decimal(18,6) DEFAULT NULL,
  `allincode_complexity` decimal(12,4) DEFAULT NULL,
  `wmc` int(10) unsigned DEFAULT NULL,
  `rfc` int(10) unsigned DEFAULT NULL,
  `lcom` int(10) unsigned DEFAULT NULL,
  `mpc` int(10) unsigned DEFAULT NULL,
  `cbo` int(10) unsigned DEFAULT NULL,
  `dac` int(10) unsigned DEFAULT NULL,
  `nom` int(10) unsigned DEFAULT NULL,
  `high_td` tinyint(1) NOT NULL DEFAULT 0,
  `high_td_probability` decimal(10,4) DEFAULT NULL,
  `high_td_class_name` varchar(512) DEFAULT NULL,
  `normalization_method` varchar(30) DEFAULT NULL,
  `normalization_percentile` decimal(5,4) DEFAULT NULL,
  `git_activity_score` decimal(6,2) DEFAULT NULL,
  `complexity_score` decimal(6,2) DEFAULT NULL,
  `hotspot_score` decimal(6,2) DEFAULT NULL,
  `hotspot_risk_level` varchar(20) DEFAULT NULL,
  `structural_risk_score` decimal(6,2) DEFAULT NULL,
  `structural_risk_level` varchar(20) DEFAULT NULL,
  `quality_risk_score` decimal(6,2) DEFAULT NULL,
  `quality_risk_level` varchar(20) DEFAULT NULL,
  `high_td_risk_score` decimal(6,2) DEFAULT NULL,
  `high_td_risk_level` varchar(20) DEFAULT NULL,
  `refactoring_priority_score` decimal(6,2) DEFAULT NULL,
  `refactoring_priority_level` varchar(20) DEFAULT NULL,
  `max_component_score` decimal(6,2) DEFAULT NULL,
  `final_risk_level` varchar(20) DEFAULT NULL,
  `non_compensatory_override_applied` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_file_metrics_run` (`analysis_run_id`),
  KEY `idx_file_metrics_run_path` (`analysis_run_id`,`path`(255)),
  KEY `idx_file_metrics_hotspot` (`analysis_run_id`,`hotspot_score`),
  KEY `idx_file_metrics_structural` (`analysis_run_id`,`structural_risk_score`),
  KEY `idx_file_metrics_refactoring` (`analysis_run_id`,`refactoring_priority_score`),
  KEY `idx_file_metrics_high_td` (`analysis_run_id`,`high_td_risk_score`),
  CONSTRAINT `fk_file_metrics_analysis_run` FOREIGN KEY (`analysis_run_id`) REFERENCES `analysis_runs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12302 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for πίνακας analyzed_projects.projects
CREATE TABLE IF NOT EXISTS `projects` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `repo_url` varchar(500) NOT NULL,
  `owner` varchar(255) NOT NULL,
  `repo_name` varchar(255) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `last_analyzed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_projects_repo_url` (`repo_url`),
  KEY `idx_projects_owner_repo` (`owner`,`repo_name`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for πίνακας analyzed_projects.project_trend_history
CREATE TABLE IF NOT EXISTS `project_trend_history` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `run_date` datetime NOT NULL,
  `commit_sha` varchar(80) DEFAULT NULL,
  `sonar_technical_debt_days` decimal(12,4) DEFAULT NULL,
  `allincode_cost` decimal(18,6) DEFAULT NULL,
  `global_health_score` decimal(6,2) DEFAULT NULL,
  `overall_project_risk` decimal(6,2) DEFAULT NULL,
  `sonar_code_smells` int(10) unsigned DEFAULT NULL,
  `sonar_bugs` int(10) unsigned DEFAULT NULL,
  `sonar_complexity` int(10) unsigned DEFAULT NULL,
  `sonar_duplicated_lines_density` decimal(10,4) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_trend_project_date` (`project_id`,`run_date`),
  CONSTRAINT `fk_project_trend_history_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
