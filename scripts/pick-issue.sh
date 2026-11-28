#!/usr/bin/env bash
# Prints the next issue the "AI: implement issues" workflow works on, without
# AI: open issues with no assignee and no linked pull request (GitHub's
# search does that), minus parents with open sub-issues, by Priority
# (Urgent, High, Medium, Low, then none) and oldest first. Nothing if none.
#
# A sub-issue without a Priority of its own takes its parent's, so a parent's
# sub-issues are picked up at the parent's priority (the parent itself waits
# for them, and may be assigned).
#
# Usage: scripts/pick-issue.sh [owner/repo]
set -euo pipefail
repo="${1:-${GITHUB_REPOSITORY:-chealt/ev-maps}}"

priority='[.issue_field_values[]? | select(.issue_field_name == "Priority")
  | .single_select_option.name] | first'

# Every open issue's own Priority, by number, for the sub-issues' parents.
priorities="$(gh api -X GET search/issues \
  -f q="repo:$repo is:issue is:open" -f per_page=100 \
  --jq "[.items[] | {key: (.number | tostring), value: ($priority)}] | from_entries")"

gh api -X GET search/issues \
  -f q="repo:$repo is:issue is:open no:assignee -linked:pr" -f per_page=100 \
  | jq -r --argjson priorities "$priorities" '[.items[]
      | select((.sub_issues_summary.total // 0) == (.sub_issues_summary.completed // 0))
      | (('"$priority"') // $priorities[(.parent_issue_url // "" | split("/") | last // "")]) as $priority
      | {number, rank: ((["Urgent", "High", "Medium", "Low"] | index($priority)) // 4)}]
    | sort_by(.rank, .number) | first | .number // empty'
