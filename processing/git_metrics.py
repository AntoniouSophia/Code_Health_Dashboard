import argparse
import json
import os
from collections import defaultdict
from datetime import datetime

from pydriller import Repository


SOURCE_EXTENSIONS = {
    ".java",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".py",
    ".c",
    ".cpp",
    ".h",
    ".hpp",
    ".cs",
    ".go",
    ".rb",
    ".php",
    ".kt",
    ".kts",
    ".scala"
}


TEST_PATH_MARKERS = [
    "/src/test/",
    "/test/",
    "/tests/",
    "/__tests__/",
    "/spec/",
    "/specs/"
]


def normalize_path(path):
    if not path:
        return None

    path = path.replace("\\", "/")

    if path.startswith("./"):
        path = path[2:]

    return path


def is_source_file(path):
 
    _, ext = os.path.splitext(path.lower())
    return ext in SOURCE_EXTENSIONS


def is_test_file(path):
    
    normalized = "/" + path.lower()

    return any(marker in normalized for marker in TEST_PATH_MARKERS)


def should_include_file(path, only_source=False, exclude_tests=False):
   

    if exclude_tests and is_test_file(path):
        return False

    if only_source and not is_source_file(path):
        return False

    return True


def analyze_git_repository(repo_path, only_source=False, exclude_tests=False):
    if not os.path.exists(repo_path):
        raise FileNotFoundError(f"Repository path does not exist: {repo_path}")

    file_stats = defaultdict(lambda: {
        "commit_count": 0,
        "authors": set(),
        "lines_added": 0,
        "lines_deleted": 0,
        "last_modified": None
    })

    print(f"Reading Git history from: {repo_path}")
    print(f"Only source files: {only_source}")
    print(f"Exclude test files: {exclude_tests}")

    for commit in Repository(repo_path).traverse_commits():
        commit_date = commit.author_date.isoformat()
        author_name = commit.author.name if commit.author else "Unknown"

        for modified_file in commit.modified_files:
            path = modified_file.new_path or modified_file.old_path
            path = normalize_path(path)

            if not path:
                continue

            if not should_include_file(
                path,
                only_source=only_source,
                exclude_tests=exclude_tests
            ):
                continue

            stats = file_stats[path]

            stats["commit_count"] += 1
            stats["authors"].add(author_name)
            stats["lines_added"] += modified_file.added_lines or 0
            stats["lines_deleted"] += modified_file.deleted_lines or 0

            if stats["last_modified"] is None or commit_date > stats["last_modified"]:
                stats["last_modified"] = commit_date

    files = []

    for path, stats in file_stats.items():
        lines_added = stats["lines_added"]
        lines_deleted = stats["lines_deleted"]

        files.append({
            "path": path,
            "commit_count": stats["commit_count"],
            "authors_count": len(stats["authors"]),
            "lines_added": lines_added,
            "lines_deleted": lines_deleted,
            "churn": lines_added + lines_deleted,
            "last_modified": stats["last_modified"]
        })

    files.sort(key=lambda item: item["commit_count"], reverse=True)

    return {
        "repository": repo_path,
        "generated_at": datetime.now().isoformat(),
        "filters": {
            "only_source": only_source,
            "exclude_tests": exclude_tests
        },
        "total_files": len(files),
        "files": files
    }


def main():
    parser = argparse.ArgumentParser(description="Extract Git metrics per file.")

    parser.add_argument(
        "--repo",
        required=True,
        help="Path to the local Git repository"
    )

    parser.add_argument(
        "--out",
        required=True,
        help="Output JSON file path"
    )

    parser.add_argument(
        "--only-source",
        action="store_true",
        help="Include only source code files"
    )

    parser.add_argument(
        "--exclude-tests",
        action="store_true",
        help="Exclude test files"
    )

    args = parser.parse_args()

    result = analyze_git_repository(
        args.repo,
        only_source=args.only_source,
        exclude_tests=args.exclude_tests
    )

    output_dir = os.path.dirname(args.out)

    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    with open(args.out, "w", encoding="utf-8") as file:
        json.dump(result, file, indent=2, ensure_ascii=False)

    print(f"Git metrics exported to: {args.out}")
    print(f"Total files analyzed: {result['total_files']}")

    print("Top 5 hotspot candidates:")

    for file in result["files"][:5]:
        print(
            f"- {file['path']} | "
            f"commits: {file['commit_count']} | "
            f"churn: {file['churn']} | "
            f"authors: {file['authors_count']}"
        )


if __name__ == "__main__":
    main()