import argparse
import json
import os
import re
from datetime import datetime
from scoring import calculate_file_scores, calculate_project_scores


TEST_PATH_MARKERS = [
    "/src/test/",
    "/test/",
    "/tests/",
    "/__tests__/",
    "/spec/",
    "/specs/"
]


def to_number(value, default=0):
    if value is None or value == "":
        return default

    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def to_int(value, default=0):
    try:
        return int(to_number(value, default))
    except (TypeError, ValueError):
        return default


def normalize_probability(value):
    number = to_number(value)

    if number > 1 and number <= 100:
        number = number / 100

    return number


def get_high_td_probability(item):
    if not isinstance(item, dict):
        return 0

    # AllinCode High-TD endpoint returns this field.
    return normalize_probability(item.get("high_td_proba"))


def normalize_path(path):
    if path is None:
        return None

    path = str(path).strip()

    if not path:
        return None

    path = path.replace("\\", "/")

    # Remove Windows drive prefix if it ever appears, e.g. C:/project/src/A.java
    path = re.sub(r"^[A-Za-z]:/", "", path)

    while path.startswith("./"):
        path = path[2:]

    path = path.lstrip("/")
    path = re.sub(r"/+", "/", path)

    return path if path else None


def is_test_file(path):
    normalized = "/" + str(path or "").lower()

    return any(marker in normalized for marker in TEST_PATH_MARKERS)


def get_nested_value(item, path):
    current = item

    for key in path.split("."):
        if not isinstance(current, dict):
            return None

        current = current.get(key)

        if current is None:
            return None

    return current


def get_value(item, paths, default=None):
    if not isinstance(item, dict):
        return default

    for path in paths:
        value = get_nested_value(item, path)

        if value is not None and value != "":
            return value

    return default


def as_list(value):
    if value is None:
        return []

    if isinstance(value, list):
        return value

    if isinstance(value, dict):
        for key in ["files", "data", "results", "components", "items"]:
            if isinstance(value.get(key), list):
                return value.get(key)

        if isinstance(value.get("project"), dict):
            project = value["project"]

            for key in ["files", "data", "results", "components", "items"]:
                if isinstance(project.get(key), list):
                    return project.get(key)

    return []


def get_project_payload(value):
    if not isinstance(value, dict):
        return {}

    if isinstance(value.get("project"), dict):
        return value["project"]

    return value


def get_path_from_item(item):
    if not isinstance(item, dict):
        return None

    path = get_value(
        item,
        [
            "path",
            "class_path",
            "file",
            "file_path",
            "component.path",
            "component.name"
        ]
    )

    if path:
        return normalize_path(path)


    key = item.get("key")

    if isinstance(key, str) and ":" in key:
        possible_path = key.split(":", 1)[1]

        if "/" in possible_path or "\\" in possible_path:
            return normalize_path(possible_path)

    fallback = get_value(item, ["name", "class_name"])

    return normalize_path(fallback)


def create_base_record(path):
    return {
        "path": path,
        "is_test_file": is_test_file(path),

        "has_git_data": False,
        "has_sonar_data": False,
        "has_allincode_data": False,
        "has_high_td_data": False,

        # Git
        "commit_count": 0,
        "churn": 0,
        "authors_count": 0,
        "lines_added": 0,
        "lines_deleted": 0,

        # SonarQube
        "sonar_ncloc": 0,
        "sonar_complexity": 0,
        "sonar_cognitive_complexity": 0,
        "sonar_debt_minutes": 0,
        "sonar_code_smells": 0,
        "sonar_bugs": 0,
        "sonar_duplicated_lines": 0,
        "sonar_duplicated_lines_density": 0,

        # AllinCode
        "allincode_loc": 0,
        "allincode_total_debt": 0,
        "allincode_debt": 0,
        "allincode_interest_rate": 0,
        "allincode_complexity": 0,
        "wmc": 0,
        "rfc": 0,
        "lcom": 0,
        "mpc": 0,
        "cbo": 0,
        "dac": 0,
        "nom": 0,

        # High-TD risk
        "high_td": 0,
        "high_td_probability": 0,
        "high_td_class_name": None
    }


def ensure_record(merged, path):
    if path not in merged:
        merged[path] = create_base_record(path)

    return merged[path]


def merge_git_files(merged, git_files):
    for item in git_files:
        path = get_path_from_item(item)

        if not path:
            continue

        record = ensure_record(merged, path)

        record["has_git_data"] = True
        record["commit_count"] = max(
            record["commit_count"],
            to_int(item.get("commit_count"))
        )
        record["churn"] = max(
            record["churn"],
            to_int(item.get("churn"))
        )
        record["authors_count"] = max(
            record["authors_count"],
            to_int(item.get("authors_count"))
        )
        record["lines_added"] = max(
            record["lines_added"],
            to_int(item.get("lines_added"))
        )
        record["lines_deleted"] = max(
            record["lines_deleted"],
            to_int(item.get("lines_deleted"))
        )


def merge_sonar_files(merged, sonar_files):
    for item in sonar_files:
        path = get_path_from_item(item)

        if not path:
            continue

        record = ensure_record(merged, path)

        record["has_sonar_data"] = True
        record["sonar_ncloc"] = max(
            record["sonar_ncloc"],
            to_int(get_value(item, ["ncloc"]))
        )
        record["sonar_complexity"] = max(
            record["sonar_complexity"],
            to_number(get_value(item, ["complexity"]))
        )
        record["sonar_cognitive_complexity"] = max(
            record["sonar_cognitive_complexity"],
            to_number(get_value(item, ["cognitive_complexity"]))
        )
        record["sonar_debt_minutes"] = max(
            record["sonar_debt_minutes"],
            to_number(
                get_value(
                    item,
                    [
                        "technical_debt_minutes",
                        "sqale_index"
                    ]
                )
            )
        )
        record["sonar_code_smells"] = max(
            record["sonar_code_smells"],
            to_int(get_value(item, ["code_smells"]))
        )
        record["sonar_bugs"] = max(
            record["sonar_bugs"],
            to_int(get_value(item, ["bugs"]))
        )
        record["sonar_duplicated_lines"] = max(
            record["sonar_duplicated_lines"],
            to_int(get_value(item, ["duplicated_lines"]))
        )
        record["sonar_duplicated_lines_density"] = max(
            record["sonar_duplicated_lines_density"],
            to_number(get_value(item, ["duplicated_lines_density"]))
        )


def merge_allincode_files(merged, allincode_files):
    for item in allincode_files:
        path = get_path_from_item(item)

        if not path:
            continue

        record = ensure_record(merged, path)

        record["has_allincode_data"] = True

        # If multiple class records map to the same file, debt values are summed.
        record["allincode_total_debt"] += to_number(
            get_value(item, ["totalDebt", "total_debt"])
        )
        record["allincode_debt"] += to_number(
            get_value(item, ["debt"])
        )
        record["allincode_interest_rate"] = max(
            record["allincode_interest_rate"],
            to_number(
                get_value(item, ["interestRate", "interest_rate"])
            )
        )

        record["allincode_loc"] = max(
            record["allincode_loc"],
            to_int(
                get_value(
                    item,
                    [
                        "linesOfCode",
                        "loc",
                        "fileMetrics.loc",
                        "file_metrics.loc",
                        "metrics.loc"
                    ]
                )
            )
        )

        record["allincode_complexity"] = max(
            record["allincode_complexity"],
            to_number(
                get_value(
                    item,
                    [
                        "complexity",
                        "fileMetrics.complexity",
                        "file_metrics.complexity",
                        "metrics.complexity"
                    ]
                )
            )
        )

        for metric in [
            "wmc",
            "rfc",
            "lcom",
            "mpc",
            "cbo",
            "dac",
            "nom"
        ]:
            record[metric] = max(
                record[metric],
                to_number(
                    get_value(
                        item,
                        [
                            metric,
                            f"fileMetrics.{metric}",
                            f"file_metrics.{metric}",
                            f"metrics.{metric}"
                        ]
                    )
                )
            )


def merge_high_td_items(merged, high_td_items):
    for item in high_td_items:
        path = get_path_from_item(item)

        if not path:
            continue

        record = ensure_record(merged, path)

        record["has_high_td_data"] = True
        record["high_td"] = max(
            record["high_td"],
            to_int(get_value(item, ["high_td"]))
        )

        record["high_td_probability"] = max(
            record["high_td_probability"],
            get_high_td_probability(item)
        )

        class_name = get_value(item, ["class_name"])

        if class_name:
            record["high_td_class_name"] = class_name

        # High-TD endpoint also contains structural metrics.
        for metric in ["wmc", "rfc", "lcom", "cbo"]:
            record[metric] = max(
                record[metric],
                to_number(get_value(item, [metric]))
            )

        record["allincode_loc"] = max(
            record["allincode_loc"],
            to_int(get_value(item, ["loc"]))
        )


def build_summary(data, merged_list, high_risk_items, high_td_items):
    source_items = [item for item in merged_list if not item["is_test_file"]]
    test_items = [item for item in merged_list if item["is_test_file"]]

    high_td_probabilities = [
        get_high_td_probability(item)
        for item in high_td_items
    ]

    high_td_probabilities = [
        value for value in high_td_probabilities if value > 0
    ]

    source_high_td_items = [
        item for item in high_td_items
        if not is_test_file(get_path_from_item(item))
    ]

    return {
        "repository": data.get("repository"),
        "generated_at": datetime.now().isoformat(),

        "total_merged_items": len(merged_list),
        "source_items": len(source_items),
        "test_items": len(test_items),

        "items_with_git_data": sum(
            1 for item in merged_list if item["has_git_data"]
        ),
        "items_with_sonar_data": sum(
            1 for item in merged_list if item["has_sonar_data"]
        ),
        "items_with_allincode_data": sum(
            1 for item in merged_list if item["has_allincode_data"]
        ),
        "items_with_high_td_data": sum(
            1 for item in merged_list if item["has_high_td_data"]
        ),

        "total_high_risk_items": len(high_risk_items),
        "total_high_td_items": len(high_td_items),
        "source_high_td_items": len(source_high_td_items),

        "average_high_td_probability": (
            sum(high_td_probabilities) / len(high_td_probabilities)
            if high_td_probabilities
            else 0
        ),
        "max_high_td_probability": (
            max(high_td_probabilities)
            if high_td_probabilities
            else 0
        )
    }


def build_project_metrics(data, merged_list, high_risk_items, high_td_items, summary):
    sonar_project = get_project_payload(data.get("sonar_project"))
    allincode_project = get_project_payload(data.get("allincode_project"))

    sonar_technical_debt_minutes = to_number(
        get_value(
            sonar_project,
            [
                "technical_debt_minutes",
                "sqale_index"
            ]
        )
    )

    sonar_technical_debt_days = to_number(
        get_value(
            sonar_project,
            [
                "technical_debt_days"
            ]
        )
    )

    if sonar_technical_debt_days == 0 and sonar_technical_debt_minutes > 0:
        sonar_technical_debt_days = sonar_technical_debt_minutes / 480

    return {
        "repository": data.get("repository"),
        "owner": data.get("owner"),
        "name": data.get("name"),
        "generated_at": summary.get("generated_at"),

        # SonarQube project-level metrics
        "sonar_ncloc": to_int(get_value(sonar_project, ["ncloc"])),
        "sonar_technical_debt_minutes": sonar_technical_debt_minutes,
        "sonar_technical_debt_days": sonar_technical_debt_days,
        "sonar_td_ratio": to_number(
            get_value(
                sonar_project,
                [
                    "sqale_debt_ratio",
                    "technical_debt_ratio"
                ]
            )
        ),
        "sonar_complexity": to_number(
            get_value(sonar_project, ["complexity"])
        ),
        "sonar_cognitive_complexity": to_number(
            get_value(sonar_project, ["cognitive_complexity"])
        ),
        "sonar_code_smells": to_int(
            get_value(sonar_project, ["code_smells"])
        ),
        "sonar_bugs": to_int(
            get_value(sonar_project, ["bugs"])
        ),
        "sonar_duplicated_lines": to_int(
            get_value(sonar_project, ["duplicated_lines"])
        ),
        "sonar_duplicated_lines_density": to_number(
            get_value(sonar_project, ["duplicated_lines_density"])
        ),
        "sonar_files": to_int(
            get_value(sonar_project, ["files"])
        ),
        "sonar_classes": to_int(
            get_value(sonar_project, ["classes"])
        ),
        "sonar_functions": to_int(
            get_value(sonar_project, ["functions"])
        ),

        # AllinCode project-level metrics
        "allincode_loc": to_int(
            get_value(
                allincode_project,
                [
                    "linesOfCode",
                    "loc"
                ]
            )
        ),
        "allincode_cumulative_debt": to_number(
            get_value(
                allincode_project,
                [
                    "cumulativeDebt",
                    "cumulative_debt"
                ]
            )
        ),
        "allincode_interest_rate_avg": to_number(
            get_value(
                allincode_project,
                [
                    "interestRateAvg",
                    "interest_rate_avg"
                ]
            )
        ),
        "allincode_refactorings": to_int(
            get_value(
                allincode_project,
                [
                    "refactorings"
                ]
            )
        ),

        # Merge coverage counts
        "total_merged_items": summary.get("total_merged_items", 0),
        "source_items": summary.get("source_items", 0),
        "test_items": summary.get("test_items", 0),

        "items_with_git_data": summary.get("items_with_git_data", 0),
        "items_with_sonar_data": summary.get("items_with_sonar_data", 0),
        "items_with_allincode_data": summary.get("items_with_allincode_data", 0),
        "items_with_high_td_data": summary.get("items_with_high_td_data", 0),

        # High-TD project-level metrics
        "total_high_risk_items": summary.get("total_high_risk_items", 0),
        "total_high_td_items": summary.get("total_high_td_items", 0),
        "source_high_td_items": summary.get("source_high_td_items", 0),
        "average_high_td_probability": summary.get(
            "average_high_td_probability",
            0
        ),
        "max_high_td_probability": summary.get(
            "max_high_td_probability",
            0
        ),

      
        "global_health_score": None
    }


def run_pipeline(data):
    sonar_files = as_list(data.get("sonar_files"))
    git_files = as_list(data.get("git_files"))
    allincode_files = as_list(data.get("allincode_files"))
    high_risk_items = as_list(data.get("allincode_high_risk"))
    high_td_items = as_list(data.get("allincode_high_td"))

    merged = {}

    merge_git_files(merged, git_files)
    merge_sonar_files(merged, sonar_files)
    merge_allincode_files(merged, allincode_files)
    merge_high_td_items(merged, high_td_items)

    merged_list = list(merged.values())
    merged_list = calculate_file_scores(merged_list)

    merged_list.sort(
        key=lambda item: (
            item["is_test_file"],
            item["path"]
        )
    )

    summary = build_summary(
        data,
        merged_list,
        high_risk_items,
        high_td_items
    )

    project_metrics = build_project_metrics(
        data,
        merged_list,
        high_risk_items,
        high_td_items,
        summary
    )
    
    project_metrics["high_td_endpoint_available"] = bool(
    data.get("allincode_high_td_available", False)
)
    project_metrics = calculate_project_scores(project_metrics, merged_list)

    return {
        "summary": summary,
        "project_metrics": project_metrics,
        "merged_file_metrics": merged_list
    }


def main():
    parser = argparse.ArgumentParser(
        description="Merge SonarQube, Git, AllinCode and High-TD metrics."
    )

    parser.add_argument(
        "--input",
        required=True,
        help="Input raw JSON file path"
    )

    parser.add_argument(
        "--out",
        required=True,
        help="Output merged JSON file path"
    )

    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as file:
        data = json.load(file)

    result = run_pipeline(data)

    output_dir = os.path.dirname(args.out)

    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    with open(args.out, "w", encoding="utf-8") as file:
        json.dump(result, file, indent=2, ensure_ascii=False)

    print("Analytics merge completed.")
    print(f"Merged items: {result['summary']['total_merged_items']}")
    print(f"Source items: {result['summary']['source_items']}")
    print(f"Test items: {result['summary']['test_items']}")
    print("Project metrics created.")


if __name__ == "__main__":
    main()