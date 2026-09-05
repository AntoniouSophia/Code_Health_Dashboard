from math import ceil, sqrt


# High-TD project settings


HIGH_TD_RATIO_THRESHOLD = 0.20

# Percentage of the strongest flagged probabilities used
# for the project-level High-TD probability component.
HIGH_TD_PROBABILITY_FOCUS_RATIO = 0.20

# When at least three flagged files exist, use at least three.
HIGH_TD_PROBABILITY_MIN_FILES = 3

# Basic helpers


def safe_number(value, default=0.0):
    """
    Safely converts values to float.
    """
    if value is None:
        return default

    if isinstance(value, bool):
        return 1.0 if value else 0.0

    if isinstance(value, (int, float)):
        if value != value:  # NaN check
            return default
        return float(value)

    if isinstance(value, str):
        cleaned = value.strip()
        cleaned = cleaned.replace("%", "")
        cleaned = cleaned.replace("€", "")
        cleaned = cleaned.replace("$", "")
        cleaned = cleaned.replace("days", "")
        cleaned = cleaned.replace("day", "")
        cleaned = cleaned.replace(" ", "")

        # Handles both:
        # 1,32
        # 40,708.99
        # 40.708,99
        if "," in cleaned and "." in cleaned:
            if cleaned.find(",") < cleaned.find("."):
                cleaned = cleaned.replace(",", "")
            else:
                cleaned = cleaned.replace(".", "").replace(",", ".")
        elif "," in cleaned:
            cleaned = cleaned.replace(",", ".")

        try:
            return float(cleaned)
        except ValueError:
            return default

    return default


def safe_bool(value):
    if isinstance(value, bool):
        return value

    if isinstance(value, str):
        return value.strip().lower() in ["true", "1", "yes", "y"]

    return bool(value)


def clamp(value, minimum=0.0, maximum=100.0):
    value = safe_number(value)
    return max(minimum, min(maximum, value))


def round_score(value, decimals=2):
    return round(clamp(value), decimals)


def round_optional_score(value, decimals=2):
    if value is None:
        return None

    return round_score(value, decimals)


def percentile(values, p=0.95):
    """
    Returns the p-th percentile using linear interpolation.
    """
    clean_values = [
        safe_number(value)
        for value in values
        if safe_number(value) > 0
    ]

    if not clean_values:
        return 0.0

    clean_values.sort()

    if len(clean_values) == 1:
        return clean_values[0]

    # Here p is a probability, e.g. 0.95, so we clamp it to 0..1.
    p = max(0.0, min(1.0, safe_number(p, 0.95)))

    index = (len(clean_values) - 1) * p
    lower_index = int(index)
    upper_index = min(lower_index + 1, len(clean_values) - 1)
    weight = index - lower_index

    lower_value = clean_values[lower_index]
    upper_value = clean_values[upper_index]

    return lower_value * (1 - weight) + upper_value * weight


def normalize(value, reference_value):
    """
    Normalizes a metric to 0..1.

    In the current methodology, file-level scores use P95 as the reference value.
    Values above P95 are capped to 1.
    """
    value = safe_number(value)
    reference_value = safe_number(reference_value)

    if value <= 0 or reference_value <= 0:
        return 0.0

    return max(0.0, min(1.0, value / reference_value))


def normalize_by_p95(value, p95_value):
    """
    Explicit alias for percentile normalization.

    normalized_value = min(value / P95_value, 1)
    """
    return normalize(value, p95_value)


def normalize_probability(value):
    """
    Keeps High-TD probability in the internal 0..1 scale.

    """
    probability = safe_number(value)

    if probability > 1 and probability <= 100:
        probability = probability / 100

    return max(0.0, min(1.0, probability))
def calculate_top_probability_average(
    probabilities,
    flagged_count,
    focus_ratio=HIGH_TD_PROBABILITY_FOCUS_RATIO,
    minimum_count=HIGH_TD_PROBABILITY_MIN_FILES
):
    """
    Calculates the average of the highest percentage of High-TD
    probabilities.

    """
    if flagged_count <= 0 or not probabilities:
        return 0.0, 0

    valid_probabilities = sorted(
        [
            normalize_probability(probability)
            for probability in probabilities
            if probability is not None
        ],
        reverse=True
    )

    if not valid_probabilities:
        return 0.0, 0

    requested_count = min(
        flagged_count,
        max(
            minimum_count,
            ceil(focus_ratio * flagged_count)
        )
    )

    selected_probabilities = valid_probabilities[:requested_count]
    actual_count = len(selected_probabilities)

    if actual_count == 0:
        return 0.0, 0

    selected_average = (
        sum(selected_probabilities) / actual_count
    )

    return selected_average, actual_count


def risk_level(score):
    score = safe_number(score)

    if score >= 80:
        return "Critical"
    if score >= 60:
        return "High"
    if score >= 40:
        return "Medium"
    return "Low"


def optional_risk_level(score):
    if score is None:
        return None

    return risk_level(score)


RISK_LEVEL_RANK = {
    "Not flagged": -1,
    "Low": 0,
    "Medium": 1,
    "High": 2,
    "Critical": 3,
}


def max_risk_level(*levels):
    """
    Returns the most severe risk level.
    """
    if not levels:
        return "Low"

    return max(
        levels,
        key=lambda level: RISK_LEVEL_RANK.get(level, 0)
    )


def high_td_level(score, has_prediction):
    if not has_prediction or score is None:
        return None

    return risk_level(score)



# Item helpers


def is_test_item(item):
    return safe_bool(item.get("is_test_file"))


def get_source_items(items):
    return [item for item in items if not is_test_item(item)]


def max_metric(items, key):
    """
    Kept for compatibility/debugging.
   
    """
    values = [safe_number(item.get(key)) for item in items]
    values = [value for value in values if value > 0]

    if not values:
        return 0.0

    return max(values)


def percentile_metric(items, key, p=0.95):
    values = [safe_number(item.get(key)) for item in items]
    return percentile(values, p)


def build_p95_values(items, keys, p=0.95):
    """
    Builds one P95 reference value per metric.
    """
    return {
        key: percentile_metric(items, key, p)
        for key in keys
    }


def prefer_primary_references(primary, fallback, keys):
    """
    Uses the common scoring population as the primary normalization reference.

  
    """
    result = {}

    for key in keys:
        primary_value = safe_number(primary.get(key))
        fallback_value = safe_number(fallback.get(key))

        result[key] = (
            primary_value
            if primary_value > 0
            else fallback_value
        )

    return result


def has_high_td_prediction(item):

    probability = item.get("high_td_probability")
    class_name = str(item.get("high_td_class_name") or "").strip()

    return (
        safe_bool(item.get("has_high_td_data"))
        or safe_number(item.get("high_td")) > 0
        or safe_number(probability) > 0
        or bool(class_name)
    )


def is_high_td_flagged(item):
    """
    Returns the predicted High-TD class.

    """
    if item.get("high_td") is not None:
        return safe_bool(item.get("high_td"))

    probability = item.get("high_td_probability")

    if probability is None:
        return False

    return normalize_probability(probability) >= 0.50




def has_current_analysis_data(item):
    """
    Returns True when the item exists in at least one current analysis source.

    """
    return (
        safe_bool(item.get("has_sonar_data"))
        or safe_bool(item.get("has_allincode_data"))
        or safe_bool(item.get("has_high_td_data"))
    )


def normalize_path(path):
    """
    Normalizes file paths so that filters work the same on Windows/Linux paths.
    """
    return str(path or "").replace("\\", "/")


def is_code_file(path):
    """
    Returns True for files that are refactoring candidates.

    """
    path = normalize_path(path).lower()

    code_extensions = (
        ".java",
        ".py",
        ".js",
        ".jsx",
        ".ts",
        ".tsx",
        ".cs",
        ".cpp",
        ".cc",
        ".cxx",
        ".c",
        ".h",
        ".hpp",
        ".php",
        ".rb",
        ".go",
        ".kt",
        ".kts",
        ".scala",
        ".swift",
        ".rs",
    )

    return path.endswith(code_extensions)


def is_excluded_scoring_path(path):
    """
    Returns True for generated, build or dependency artifacts.
    """
    lower_path = normalize_path(path).lower()

    excluded_fragments = (
        "/target/",
        "/build/",
        "/dist/",
        "/node_modules/",
        "/vendor/",
        "/generated/",
        "/.git/",
    )

    return any(
        fragment in lower_path
        for fragment in excluded_fragments
    )


def is_base_scoring_item(item):
    """
    Common basic eligibility for file-level scoring.
    """
    path = item.get("path")

    return (
        not is_test_item(item)
        and has_current_analysis_data(item)
        and is_code_file(path)
        and not is_excluded_scoring_path(path)
    )


def eligible_for_git_activity(item):
    return (
        is_base_scoring_item(item)
        and safe_bool(item.get("has_git_data"))
    )


def eligible_for_sonar_scores(item):
    return (
        is_base_scoring_item(item)
        and safe_bool(item.get("has_sonar_data"))
    )


def eligible_for_structural_score(item):
    return (
        is_base_scoring_item(item)
        and safe_bool(item.get("has_allincode_data"))
    )


def eligible_for_hotspot_score(item):
    return (
        is_base_scoring_item(item)
        and safe_bool(item.get("has_git_data"))
        and safe_bool(item.get("has_sonar_data"))
    )


def is_common_scoring_item(item):
    """
    Core population used by every calculation that combines Git, SonarQube
    and AllinCode dimensions.
    """
    return (
        is_base_scoring_item(item)
        and safe_bool(item.get("has_git_data"))
        and safe_bool(item.get("has_sonar_data"))
        and safe_bool(item.get("has_allincode_data"))
    )


def is_refactoring_candidate(item):
    """
    Refactoring candidates are exactly the common scoring population.

    guarantees that every candidate has Git, SonarQube and AllinCode
    coverage and prevents missing source data from being interpreted as zero.
    """
    return is_common_scoring_item(item)


def visible_focus_count(total_items, percentage=0.15, minimum=10, maximum=50):
    """
    Used for dashboard charts/lists.

    """
    total_items = int(total_items)

    if total_items <= 0:
        return 0

    if total_items <= 30:
        return total_items

    count = ceil(total_items * percentage)
    count = max(minimum, count)
    count = min(maximum, count)

    return count


def project_risk_focus_count(
    total_items,
    percentage=0.30,
    minimum=5
):
    """
    Returns the number of files used for project-level
    Hotspot Risk and Structural Risk.

    """
    total_items = int(total_items)

    if total_items <= 0:
        return 0

    if total_items <= minimum:
        return total_items

    count = ceil(total_items * percentage)
    count = max(minimum, count)

    return min(total_items, count)

def average_top_score(items, key):
    """
    Returns the average of the top 30% of available values.

    Missing scores are excluded rather than converted to zero.
    """
    if not items:
        return None

    scored_items = [
        item
        for item in items
        if item.get(key) is not None
    ]

    if not scored_items:
        return None

    count = project_risk_focus_count(len(scored_items))

    sorted_items = sorted(
        scored_items,
        key=lambda item: safe_number(item.get(key)),
        reverse=True
    )

    selected = sorted_items[:count]
    values = [safe_number(item.get(key)) for item in selected]

    if not values:
        return None

    return sum(values) / len(values)



# File-level scoring helpers


def calculate_git_activity_score(item, p95_values):
    normalized_commit_count = normalize_by_p95(
        item.get("commit_count"),
        p95_values.get("commit_count")
    )

    normalized_churn = normalize_by_p95(
        item.get("churn"),
        p95_values.get("churn")
    )

    normalized_authors_count = normalize_by_p95(
        item.get("authors_count"),
        p95_values.get("authors_count")
    )

    return (
        0.55 * normalized_commit_count +
        0.35 * normalized_churn +
        0.10 * normalized_authors_count
    ) * 100


def calculate_complexity_score(item, p95_values):
    normalized_sonar_complexity = normalize_by_p95(
        item.get("sonar_complexity"),
        p95_values.get("sonar_complexity")
    )

    normalized_sonar_cognitive_complexity = normalize_by_p95(
        item.get("sonar_cognitive_complexity"),
        p95_values.get("sonar_cognitive_complexity")
    )

    return (
        0.60 * normalized_sonar_complexity +
        0.40 * normalized_sonar_cognitive_complexity
    ) * 100


def calculate_hotspot_score(git_activity_score, complexity_score):
    """
    Calculates hotspot score 

    """
    if git_activity_score is None or complexity_score is None:
        return None

    activity = clamp(git_activity_score)
    complexity = clamp(complexity_score)

    return sqrt(activity * complexity)


def calculate_structural_risk_score(item, p95_values):
    normalized_wmc = normalize_by_p95(item.get("wmc"), p95_values.get("wmc"))
    normalized_rfc = normalize_by_p95(item.get("rfc"), p95_values.get("rfc"))
    normalized_lcom = normalize_by_p95(item.get("lcom"), p95_values.get("lcom"))
    normalized_mpc = normalize_by_p95(item.get("mpc"), p95_values.get("mpc"))
    normalized_cbo = normalize_by_p95(item.get("cbo"), p95_values.get("cbo"))

    return (
        0.25 * normalized_wmc +
        0.25 * normalized_rfc +
        0.20 * normalized_lcom +
        0.15 * normalized_mpc +
        0.15 * normalized_cbo
    ) * 100


def calculate_quality_risk_score(item, p95_values):
    normalized_code_smells = normalize_by_p95(
        item.get("sonar_code_smells"),
        p95_values.get("sonar_code_smells")
    )

    normalized_bugs = normalize_by_p95(
        item.get("sonar_bugs"),
        p95_values.get("sonar_bugs")
    )

    return (
        0.60 * normalized_code_smells +
        0.40 * normalized_bugs
    ) * 100


def calculate_high_td_risk_score(item):
    high_td_probability = normalize_probability(
        item.get("high_td_probability")
    )

    return high_td_probability * 100


def calculate_refactoring_priority_score(item):
    """
    Calculates refactoring priority for the common scoring population.

    """
    if not is_common_scoring_item(item):
        return None

    weighted_components = [
        (item.get("git_activity_score"), 0.24),
        (item.get("complexity_score"), 0.16),
        (item.get("structural_risk_score"), 0.30),
        (item.get("quality_risk_score"), 0.20),
    ]

    if item.get("high_td_risk_score") is not None:
        weighted_components.append(
            (item.get("high_td_risk_score"), 0.10)
        )

    available_weight = sum(
        weight
        for value, weight in weighted_components
        if value is not None
    )

    if available_weight <= 0:
        return None

    weighted_sum = sum(
        safe_number(value) * weight
        for value, weight in weighted_components
        if value is not None
    )

    return clamp(weighted_sum / available_weight)


def calculate_final_risk_level(item):
    """
    Non-compensatory override rule for eligible refactoring candidates.

    """
    priority_score = item.get("refactoring_priority_score")

    if priority_score is None:
        return None

    priority_level = risk_level(priority_score)

    component_scores = [
        item.get("complexity_score"),
        item.get("structural_risk_score"),
        item.get("quality_risk_score"),
        item.get("high_td_risk_score"),
    ]

    available_scores = [
        safe_number(value)
        for value in component_scores
        if value is not None
    ]

    if not available_scores:
        return priority_level

    component_level = risk_level(max(available_scores))

    return max_risk_level(priority_level, component_level)


# File-level scoring


def calculate_file_scores(merged_file_metrics):
    """
    Adds file-level scores.


    """
    if not isinstance(merged_file_metrics, list):
        return []

    items = merged_file_metrics

    # availability and eligibility flags 
    for item in items:
        item["is_current_analyzable"] = has_current_analysis_data(item)
        item["is_git_only"] = (
            safe_bool(item.get("has_git_data"))
            and not item["is_current_analyzable"]
        )
        item["is_code_file"] = is_code_file(item.get("path"))
        item["is_refactoring_candidate"] = is_refactoring_candidate(item)
        item["is_common_scoring_file"] = is_common_scoring_item(item)

    git_items = [
        item for item in items
        if eligible_for_git_activity(item)
    ]

    sonar_items = [
        item for item in items
        if eligible_for_sonar_scores(item)
    ]

    allincode_items = [
        item for item in items
        if eligible_for_structural_score(item)
    ]

    common_items = [
        item for item in items
        if is_common_scoring_item(item)
    ]

    git_keys = [
        "commit_count",
        "churn",
        "authors_count",
    ]

    sonar_keys = [
        "sonar_complexity",
        "sonar_cognitive_complexity",
        "sonar_code_smells",
        "sonar_bugs",
    ]

    allincode_keys = [
        "wmc",
        "rfc",
        "lcom",
        "mpc",
        "cbo",
    ]

    all_reference_keys = git_keys + sonar_keys + allincode_keys

    common_p95_values = build_p95_values(
        common_items,
        all_reference_keys,
        p=0.95
    )

    git_fallback_p95 = build_p95_values(
        git_items,
        git_keys,
        p=0.95
    )

    sonar_fallback_p95 = build_p95_values(
        sonar_items,
        sonar_keys,
        p=0.95
    )

    allincode_fallback_p95 = build_p95_values(
        allincode_items,
        allincode_keys,
        p=0.95
    )

    git_p95_values = prefer_primary_references(
        common_p95_values,
        git_fallback_p95,
        git_keys
    )

    sonar_p95_values = prefer_primary_references(
        common_p95_values,
        sonar_fallback_p95,
        sonar_keys
    )

    allincode_p95_values = prefer_primary_references(
        common_p95_values,
        allincode_fallback_p95,
        allincode_keys
    )

    for item in items:

        # Source-specific component scores

        git_activity_score = (
            calculate_git_activity_score(item, git_p95_values)
            if eligible_for_git_activity(item)
            else None
        )

        complexity_score = (
            calculate_complexity_score(item, sonar_p95_values)
            if eligible_for_sonar_scores(item)
            else None
        )

        quality_risk_score = (
            calculate_quality_risk_score(item, sonar_p95_values)
            if eligible_for_sonar_scores(item)
            else None
        )

        structural_risk_score = (
            calculate_structural_risk_score(item, allincode_p95_values)
            if eligible_for_structural_score(item)
            else None
        )

        hotspot_score = (
            calculate_hotspot_score(
                git_activity_score,
                complexity_score
            )
            if eligible_for_hotspot_score(item)
            else None
        )

        has_prediction = has_high_td_prediction(item)

        high_td_risk_score = (
            calculate_high_td_risk_score(item)
            if has_prediction
            else None
        )

        # Store rounded component scores before calculating refactoring priority.
        item["git_activity_score"] = round_optional_score(git_activity_score)
        item["complexity_score"] = round_optional_score(complexity_score)

        item["hotspot_score"] = round_optional_score(hotspot_score)
        item["hotspot_risk_level"] = optional_risk_level(hotspot_score)

        item["structural_risk_score"] = round_optional_score(
            structural_risk_score
        )
        item["structural_risk_level"] = optional_risk_level(
            structural_risk_score
        )

        item["quality_risk_score"] = round_optional_score(
            quality_risk_score
        )
        item["quality_risk_level"] = optional_risk_level(
            quality_risk_score
        )

        item["high_td_risk_score"] = round_optional_score(
            high_td_risk_score
        )
        item["high_td_risk_level"] = high_td_level(
            high_td_risk_score,
            has_prediction
        )

       
        # Refactoring priority
       
        if is_common_scoring_item(item):
            refactoring_priority_score = calculate_refactoring_priority_score(item)

            item["refactoring_priority_score"] = round_optional_score(
                refactoring_priority_score
            )
            item["refactoring_priority_level"] = optional_risk_level(
                refactoring_priority_score
            )

            component_scores = [
                item.get("complexity_score"),
                item.get("structural_risk_score"),
                item.get("quality_risk_score"),
                item.get("high_td_risk_score"),
            ]

            available_component_scores = [
                safe_number(value)
                for value in component_scores
                if value is not None
            ]

            item["max_component_score"] = (
                round_score(max(available_component_scores))
                if available_component_scores
                else None
            )

            item["final_risk_level"] = calculate_final_risk_level(item)
        else:
            item["refactoring_priority_score"] = None
            item["refactoring_priority_level"] = None
            item["max_component_score"] = None
            item["final_risk_level"] = None

    return items



# Project-level scoring


def per_kloc(value, kloc):
    value = safe_number(value)

    if kloc <= 0:
        return 0.0

    return value / kloc


# Default SonarQube maintainability-rating 
TECHNICAL_DEBT_RISK_POINTS = (
    (0.0, 0.0),
    (5.0, 20.0),
    (10.0, 40.0),
    (20.0, 60.0),
    (50.0, 80.0),
    (100.0, 100.0),
)


def calculate_technical_debt_project_risk(sonar_td_ratio):
    """
    Maps SonarQube technical debt ratio to the common 0..100 risk scale.
    """
    ratio = max(0.0, safe_number(sonar_td_ratio))

    for index in range(len(TECHNICAL_DEBT_RISK_POINTS) - 1):
        lower_ratio, lower_risk = TECHNICAL_DEBT_RISK_POINTS[index]
        upper_ratio, upper_risk = TECHNICAL_DEBT_RISK_POINTS[index + 1]

        if ratio <= upper_ratio:
            interval = upper_ratio - lower_ratio

            if interval <= 0:
                return clamp(lower_risk)

            position = (ratio - lower_ratio) / interval
            risk = lower_risk + position * (upper_risk - lower_risk)

            return clamp(risk)

    return 100.0


def calculate_project_scores(project_metrics, merged_file_metrics):
    """
    Adds project-level risks and global_health_score.
    """
    if project_metrics is None:
        project_metrics = {}

    if not isinstance(merged_file_metrics, list):
        merged_file_metrics = []

    source_items = get_source_items(merged_file_metrics)

    common_scoring_items = [
        item
        for item in source_items
        if is_common_scoring_item(item)
    ]

    project_risk_items = common_scoring_items

    ncloc = safe_number(project_metrics.get("sonar_ncloc"))
    kloc = ncloc / 1000 if ncloc > 0 else 0.0

  
    # Technical debt project risk
  
    # Sonar TD ratio is expressed in percentage points.

    # The full maintainability-rating scale A-E is mapped piecewise to 0..100.
    sonar_td_ratio = safe_number(project_metrics.get("sonar_td_ratio"))

    technical_debt_project_risk = (
        calculate_technical_debt_project_risk(sonar_td_ratio)
    )

    # Complexity project risk

    sonar_complexity = safe_number(project_metrics.get("sonar_complexity"))
    sonar_cognitive_complexity = safe_number(
        project_metrics.get("sonar_cognitive_complexity")
    )

    complexity_per_kloc = per_kloc(sonar_complexity, kloc)
    cognitive_complexity_per_kloc = per_kloc(
        sonar_cognitive_complexity,
        kloc
    )

    # Calibrated saturation thresholds:
 
    complexity_density_risk = clamp(
        (complexity_per_kloc / 180.0) * 100
    )

    cognitive_complexity_density_risk = clamp(
        (cognitive_complexity_per_kloc / 120.0) * 100
    )

    complexity_project_risk = (
        0.60 * complexity_density_risk +
        0.40 * cognitive_complexity_density_risk
    )

    # Quality project risk

    sonar_code_smells = safe_number(project_metrics.get("sonar_code_smells"))
    sonar_bugs = safe_number(project_metrics.get("sonar_bugs"))

    code_smells_per_kloc = per_kloc(sonar_code_smells, kloc)
    bugs_per_kloc = per_kloc(sonar_bugs, kloc)

    code_smells_risk = clamp(
        (code_smells_per_kloc / 50.0) * 100
    )

    bugs_risk = clamp(
        (bugs_per_kloc / 5.0) * 100
    )

    quality_project_risk = (
        0.60 * code_smells_risk +
        0.40 * bugs_risk
    )


    # Duplication project risk

    duplicated_lines_density = safe_number(
        project_metrics.get("sonar_duplicated_lines_density")
    )

    # 15% duplication density is treated as maximum duplication risk.
    duplication_project_risk = clamp(
        (duplicated_lines_density / 15.0) * 100
    )

    # File-based project risks

  
    hotspot_project_risk = average_top_score(
        project_risk_items,
        "hotspot_score"
    )

    structural_project_risk = average_top_score(
        project_risk_items,
        "structural_risk_score"
    )

    source_items_count = len(project_risk_items)
    project_risk_files_count = project_risk_focus_count(source_items_count)


    # High-TD project risk


    high_td_endpoint_available = safe_bool(
        project_metrics.get("high_td_endpoint_available")
    )

    high_td_flagged_items = [
        item
        for item in project_risk_items
        if has_high_td_prediction(item) and is_high_td_flagged(item)
    ]

    source_high_td_items = len(high_td_flagged_items)

    source_high_td_ratio = (
        source_high_td_items / source_items_count
        if high_td_endpoint_available and source_items_count > 0
        else None
    )

    high_td_probabilities = [
        probability
        for probability in (
            normalize_probability(item.get("high_td_probability"))
            for item in high_td_flagged_items
        )
        if probability > 0
    ]

    if not high_td_endpoint_available or source_items_count == 0:
        average_high_td_probability = None
        max_high_td_probability = None

        top_high_td_probability_average = None
        high_td_probability_focus_count = None
        high_td_probability_risk = None
        high_td_ratio_risk = None

        high_td_project_risk = None

    elif source_high_td_items == 0:
        average_high_td_probability = 0.0
        max_high_td_probability = 0.0

        top_high_td_probability_average = 0.0
        high_td_probability_focus_count = 0
        high_td_probability_risk = 0.0
        high_td_ratio_risk = 0.0

        high_td_project_risk = 0.0

    else:
        average_high_td_probability = (
            sum(high_td_probabilities) / len(high_td_probabilities)
            if high_td_probabilities
            else 0.0
        )

        max_high_td_probability = (
            max(high_td_probabilities)
            if high_td_probabilities
            else 0.0
        )

        (
            top_high_td_probability_average,
            high_td_probability_focus_count
        ) = calculate_top_probability_average(
            probabilities=high_td_probabilities,
            flagged_count=source_high_td_items
        )

        high_td_ratio_risk = clamp(
            (
                source_high_td_ratio
                / HIGH_TD_RATIO_THRESHOLD
            ) * 100
        )

        high_td_probability_risk = clamp(
            top_high_td_probability_average * 100
        )

        high_td_project_risk = (
            0.60 * high_td_ratio_risk
            + 0.40 * high_td_probability_risk
        )

   
    high_td_prediction_items_count = source_high_td_items
    high_td_coverage_ratio = None

 
    # Overall project risk
  
    weighted_components = [
        (technical_debt_project_risk, 0.20),
        (complexity_project_risk, 0.20),
        (quality_project_risk, 0.15),
        (duplication_project_risk, 0.10),
        (hotspot_project_risk, 0.15),
        (structural_project_risk, 0.10),
        (high_td_project_risk, 0.10),
    ]

    available_components = [
        (value, weight)
        for value, weight in weighted_components
        if value is not None
    ]

    available_weight = sum(
        weight
        for _, weight in available_components
    )

    if available_weight > 0:
        overall_project_risk = sum(
            safe_number(value) * weight
            for value, weight in available_components
        ) / available_weight

        global_health_score = 100 - overall_project_risk
    else:
        overall_project_risk = None
        global_health_score = None

    
    # Store project-level values
   
    project_metrics["kloc"] = round(kloc, 3)

    project_metrics["complexity_per_kloc"] = round(complexity_per_kloc, 2)
    project_metrics["cognitive_complexity_per_kloc"] = round(
        cognitive_complexity_per_kloc,
        2
    )
    project_metrics["code_smells_per_kloc"] = round(code_smells_per_kloc, 2)
    project_metrics["bugs_per_kloc"] = round(bugs_per_kloc, 2)

    project_metrics["technical_debt_project_risk"] = round_score(
        technical_debt_project_risk
    )
    project_metrics["complexity_project_risk"] = round_score(
        complexity_project_risk
    )
    project_metrics["quality_project_risk"] = round_score(
        quality_project_risk
    )
    project_metrics["duplication_project_risk"] = round_score(
        duplication_project_risk
    )
    project_metrics["hotspot_project_risk"] = round_optional_score(
        hotspot_project_risk
    )
    project_metrics["structural_project_risk"] = round_optional_score(
        structural_project_risk
    )
    project_metrics["high_td_project_risk"] = round_optional_score(
        high_td_project_risk
    )

    project_metrics["overall_project_risk"] = round_optional_score(
        overall_project_risk
    )
    project_metrics["global_health_score"] = round_optional_score(
        global_health_score
    )

    project_metrics["project_risk_files_count"] = project_risk_files_count
    project_metrics["refactoring_candidate_items"] = len(common_scoring_items)
    project_metrics["project_risk_scope_items"] = len(project_risk_items)
    project_metrics["common_scoring_items"] = len(common_scoring_items)

    project_metrics["high_td_prediction_items"] = high_td_prediction_items_count
    project_metrics["high_td_coverage_ratio"] = (
        round(high_td_coverage_ratio, 4)
        if high_td_coverage_ratio is not None
        else None
    )
    project_metrics["high_td_endpoint_available"] = high_td_endpoint_available
    project_metrics["source_high_td_ratio"] = (
        round(source_high_td_ratio, 4)
        if source_high_td_ratio is not None
        else None
    )
    project_metrics["source_high_td_items"] = source_high_td_items
    project_metrics["average_high_td_probability"] = (
        round(average_high_td_probability, 4)
        if average_high_td_probability is not None
        else None
    )
    project_metrics["max_high_td_probability"] = (
        round(max_high_td_probability, 4)
        if max_high_td_probability is not None
        else None
    )
    
    project_metrics["top_high_td_probability_average"] = (
        round(top_high_td_probability_average, 4)
        if top_high_td_probability_average is not None
        else None
    )

    project_metrics["high_td_probability_focus_count"] = (
        int(high_td_probability_focus_count)
        if high_td_probability_focus_count is not None
        else None
    )

    project_metrics["average_top_hotspot_score"] = round_optional_score(
        hotspot_project_risk
    )
    project_metrics["average_top_structural_risk_score"] = round_optional_score(
        structural_project_risk
    )

    return project_metrics



# Temporal evolution helper


def calculate_temporal_evolution(history_runs):
    """
    Helper for Temporal Evolution dual-axis line chart.

    """

    if not isinstance(history_runs, list):
        return []

    runs = sorted(
        history_runs,
        key=lambda run: str(run.get("run_date", ""))
    )

    normalized_runs = []

    for run in runs:
        allincode_cost = safe_number(
            run.get("allincode_cost")
            or run.get("allincode_cumulative_debt")
            or run.get("allincode_monetary_cost")
        )

        normalized_run = {
            **run,
            "sonar_technical_debt_days": safe_number(
                run.get("sonar_technical_debt_days")
            ),
            "sonar_td_ratio": safe_number(
                run.get("sonar_td_ratio")
            ),
            "allincode_cost": allincode_cost,
            "allincode_refactorings": safe_number(
                run.get("allincode_refactorings")
            ),
        }

        # Remove old index fields if they exist from older stored runs.
        normalized_run.pop("sonar_debt_trend_index", None)
        normalized_run.pop("allincode_cost_trend_index", None)

        normalized_runs.append(normalized_run)

    return normalized_runs


def calculate_temporal_indices(history_runs):
    """
    Backward-compatible wrapper.

    """
    return calculate_temporal_evolution(history_runs)



# Optional evaluation / experiment helpers


def pearson_correlation(x_values, y_values):
    """
    Pearson correlation for checking possible metric overlap.
    """
    pairs = []

    for x_value, y_value in zip(x_values, y_values):
        pairs.append((safe_number(x_value), safe_number(y_value)))

    if len(pairs) < 2:
        return 0.0

    xs = [pair[0] for pair in pairs]
    ys = [pair[1] for pair in pairs]

    mean_x = sum(xs) / len(xs)
    mean_y = sum(ys) / len(ys)

    numerator = 0.0
    denominator_x = 0.0
    denominator_y = 0.0

    for x, y in pairs:
        dx = x - mean_x
        dy = y - mean_y

        numerator += dx * dy
        denominator_x += dx * dx
        denominator_y += dy * dy

    denominator = (denominator_x * denominator_y) ** 0.5

    if denominator <= 0:
        return 0.0

    return numerator / denominator


def rank_values_descending(values):
    indexed_values = [
        {
            "index": index,
            "value": safe_number(value),
        }
        for index, value in enumerate(values)
    ]

    indexed_values.sort(
        key=lambda item: item["value"],
        reverse=True
    )

    ranks = [0] * len(indexed_values)

    for position, item in enumerate(indexed_values, start=1):
        ranks[item["index"]] = position

    return ranks


def spearman_correlation(values_a, values_b):
    """
    Spearman rank correlation for comparing two rankings/scores.
    """
    if not values_a or not values_b:
        return 0.0

    n = min(len(values_a), len(values_b))

    if n < 2:
        return 0.0

    ranks_a = rank_values_descending(values_a[:n])
    ranks_b = rank_values_descending(values_b[:n])

    return pearson_correlation(ranks_a, ranks_b)


def calculate_complexity_structural_correlation(items):
    """
    Checks possible overlap between complexity_score and structural_risk_score.
    """
    if not isinstance(items, list):
        return 0.0

    pairs = [
        (
            safe_number(item.get("complexity_score")),
            safe_number(item.get("structural_risk_score")),
        )
        for item in items
        if item.get("complexity_score") is not None
        and item.get("structural_risk_score") is not None
    ]

    if len(pairs) < 2:
        return 0.0

    complexity_scores = [pair[0] for pair in pairs]
    structural_scores = [pair[1] for pair in pairs]

    return pearson_correlation(complexity_scores, structural_scores)


def calculate_refactoring_priority_with_weights(item, weights):
    """
    Generic weighted priority score for sensitivity analysis.

    """
    weighted_sum = 0.0
    available_weight = 0.0

    for key, weight in weights.items():
        value = item.get(key)

        if value is None:
            continue

        numeric_weight = safe_number(weight)

        if numeric_weight <= 0:
            continue

        weighted_sum += safe_number(value) * numeric_weight
        available_weight += numeric_weight

    if available_weight <= 0:
        return 0.0

    return clamp(weighted_sum / available_weight)


def run_weight_sensitivity_analysis(items, base_weights=None, delta=0.20):
    """
    Lightweight sensitivity analysis for the refactoring-priority ranking.

    """
    if not isinstance(items, list) or not items:
        return []

    eligible_items = [
        item
        for item in items
        if item.get("refactoring_priority_score") is not None
    ]

    if not eligible_items:
        return []

    if base_weights is None:
        base_weights = {
            "git_activity_score": 0.24,
            "complexity_score": 0.16,
            "structural_risk_score": 0.30,
            "quality_risk_score": 0.20,
            "high_td_risk_score": 0.10,
        }

    baseline_scores = [
        calculate_refactoring_priority_with_weights(item, base_weights)
        for item in eligible_items
    ]

    results = []

    for key in base_weights:
        for direction, multiplier in [("minus", 1 - delta), ("plus", 1 + delta)]:
            changed_weights = dict(base_weights)
            changed_weights[key] = safe_number(changed_weights[key]) * multiplier

            changed_scores = [
                calculate_refactoring_priority_with_weights(item, changed_weights)
                for item in eligible_items
            ]

            correlation = spearman_correlation(
                baseline_scores,
                changed_scores
            )

            results.append({
                "changed_weight": key,
                "direction": direction,
                "delta": delta,
                "spearman_correlation": round(correlation, 4),
            })

    return results
