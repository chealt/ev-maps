#!/usr/bin/env bash
# Prints the next issue the "AI: implement issues" workflow works on, without
# AI: open issues with no assignee and no linked pull request (GitHub's
# search does that), minus parents with open sub-issues, by Priority
# (Urgent, High, Medium, Low, then none) and oldest first. Nothing if none.
#
# Usage: scripts/pick-issue.sh [owner/repo]
set -euo pipefail
repo="${1:-${GITHUB_REPOSITORY:-chealt/ev-maps}}"

gh api -X GET search/issues \
  -f q="repo:$repo is:issue is:open no:assignee -linked:pr" -f per_page=100 \
  --jq '[.items[]
      | select((.sub_issues_summary.total // 0) == (.sub_issues_summary.completed // 0))
      | ([.issue_field_values[]? | select(.issue_field_name == "Priority")
          | .single_select_option.name] | first) as $priority
      | {number, rank: ((["Urgent", "High", "Medium", "Low"] | index($priority)) // 4)}]
    | sort_by(.rank, .number) | first | .number // empty'
