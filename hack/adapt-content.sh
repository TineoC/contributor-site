#!/usr/bin/env bash
# Copyright 2019 The Kubernetes Authors.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# adapt-content.sh - Processes Hugo module content for the contributor site.
#
# Hugo modules pin upstream content versions but mount files as-is.
# Upstream repos use GitHub-style markdown that needs adaptation:
#   1. Rename README.md -> _index.md for Hugo section pages
#   2. Strip first H1 (Hugo renders {{ .Title }} as <h1>)
#   3. Insert Hugo frontmatter where missing
#   4. Rewrite relative links for the Hugo site structure
#
# Usage: hack/adapt-content.sh
#   Must be run after 'hugo mod download' so the module cache is populated.

set -o errexit
set -o nounset
set -o pipefail

readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly CONTENT_DIR="${REPO_ROOT}/content/en"
readonly DEBUG=${DEBUG:-"false"}
readonly HEADER_TMPLT="---\ntitle: __TITLE__\n---\n"

VERBOSE=""
if [ "${DEBUG}" != false ]; then
  VERBOSE='-v'
fi

if command -v ggrep >/dev/null; then
  GREP="ggrep"
else
  GREP="grep"
fi

if command -v gsed >/dev/null; then
  SED="gsed"
else
  SED="sed"
fi

# Module mount mappings: source path in repo -> destination under content/en
# Matches the old external-sources/kubernetes/community CSV format.
declare -a SOURCES
declare -a DESTS
SOURCES=(
  "contributors/guide"
  "communication"
  "mentoring"
  "committee-code-of-conduct"
  "github-management"
  "sig-list.md"
  "values.md"
  "code-of-conduct.md"
)
DESTS=(
  "/docs/guide"
  "/docs/comms"
  "/community"
  "/community/committee-code-of-conduct"
  "/resources/github-management"
  "/sig-list.md"
  "/community/values.md"
  "/includes/code-of-conduct.md"
)

# CNCF Foundation content (code-of-conduct)
CNCF_SOURCES=("code-of-conduct.md")
CNCF_DESTS=("/includes/cncf-code-of-conduct.md")

# find_md_files - Returns all markdown files within a directory
find_md_files() {
  find "$1" -type f -name '*.md' -print0 | sort -z
}

# strip_first_h1 - Remove the first body H1 (and preceding <!-- omit in toc -->)
strip_first_h1() {
  local file="$1"
  local tmpfile="${file}.tmp"
  local fm_count=0
  local stripped=false

  while IFS= read -r line; do
    if [[ "$line" == "---" ]]; then
      fm_count=$((fm_count + 1))
      echo "$line" >> "$tmpfile"
      continue
    fi
    if [[ "$fm_count" -le 1 ]]; then
      echo "$line" >> "$tmpfile"
      continue
    fi
    if ! $stripped; then
      if [[ -z "$line" ]]; then
        echo "$line" >> "$tmpfile"
        continue
      fi
      if [[ "$line" =~ ^\<\!\-\-[[:space:]]*omit[[:space:]]+in[[:space:]]+toc[[:space:]]*\-\-\>$ ]]; then
        continue
      fi
      if [[ "$line" =~ ^#[[:space:]] ]]; then
        stripped=true
        continue
      fi
      stripped=true
    fi
    echo "$line" >> "$tmpfile"
  done < "$file"

  mv "$tmpfile" "$file"
}

# insert_header - Inserts Hugo frontmatter if missing
insert_header() {
  local file="$1"
  local dest_path="$2"
  local title
  local filename

  filename="$(basename "$file")"
  if [[ "${filename,,}" == 'readme.md' || "${filename,,}" == '_index.md' ]]; then
    # shellcheck disable=SC2001
    title="$(echo "$dest_path" | $SED -r 's|/[^/]*$||; s|.*/||')"
  else
    title="${filename%.md}"
  fi
  title="$(echo "${title//[-|_]/ }" | $SED -r 's/\<./\U&/g')"
  # shellcheck disable=SC2001
  $SED -i "1i$(echo "$HEADER_TMPLT" | $SED "s/__TITLE__/$title/g")" "$file"
  echo "Header inserted into: $file" 1>&2
}

# process_file - Apply all transformations to a single file
process_file() {
  local file="$1"
  local dest_path="$2"
  local mod_dir="$3"

  # Insert header if missing
  if [[ $(head -n 1 "$file") != "---" ]]; then
    insert_header "$file" "$dest_path"
  fi

  # Strip first H1
  strip_first_h1 "$file"

  # Rename README.md to _index.md
  local dir
  dir="$(dirname "$file")"
  local base
  base="$(basename "$file")"
  if [[ "${base,,}" == "readme.md" ]]; then
    local new="${dir}/_index.md"
    if [[ "$file" != "$new" ]]; then
      mv "$file" "$new"
      echo "Renamed: $file -> $new" 1>&2
    fi
  fi
}

# resolve_module - Find the module directory in the Go module cache
resolve_module() {
  local mod_path="$1"
  go list -m -f '{{.Dir}}' "$mod_path" 2>/dev/null || {
    echo "Module $mod_path not found in cache. Run 'hugo mod download' first." 1>&2
    return 1
  }
}

main() {
  local mod_dir
  mod_dir="$(resolve_module "k8s.io/community")"
  if [[ -z "$mod_dir" ]]; then
    exit 1
  fi

  echo "Processing content from $mod_dir" 1>&2

  local temp_dir="${REPO_ROOT}/_tmp/adapted-content"
  rm -rf "$temp_dir"
  mkdir -p "$temp_dir"

  for ((i=0; i<${#SOURCES[@]}; i++)); do
    local src="${SOURCES[$i]}"
    local dst="${DESTS[$i]}"
    local src_path="${mod_dir}/${src}"
    local dst_path="${temp_dir}${dst}"

    echo "  ${src} -> ${dst}" 1>&2

    if [[ -d "$src_path" ]]; then
      mkdir -p "$dst_path"
      while IFS= read -r -d $'\0' file; do
        local rel="${file#${src_path}/}"
        local target="${dst_path}/${rel}"
        mkdir -p "$(dirname "$target")"
        cp "$file" "$target"
      done < <(find_md_files "$src_path")
    elif [[ -f "$src_path" ]]; then
      mkdir -p "$(dirname "$dst_path")"
      cp "$src_path" "$dst_path"
    else
      echo "  WARNING: Source not found: ${src_path}" 1>&2
      continue
    fi

    # Process all files in the destination
    if [[ -d "$dst_path" ]]; then
      while IFS= read -r -d $'\0' file; do
        local rel="${file#${temp_dir}}"
        process_file "$file" "$rel" "$mod_dir"
      done < <(find_md_files "$dst_path")
    elif [[ -f "$dst_path" ]]; then
      process_file "$dst_path" "${dst}" "$mod_dir"
    fi
  done

  # Process CNCF foundation content
  local cncf_mod_dir
  cncf_mod_dir="$(resolve_module "github.com/cncf/foundation")"
  if [[ -n "$cncf_mod_dir" ]]; then
    echo "Processing content from $cncf_mod_dir" 1>&2
    for ((i=0; i<${#CNCF_SOURCES[@]}; i++)); do
      local src="${CNCF_SOURCES[$i]}"
      local dst="${CNCF_DESTS[$i]}"
      local src_path="${cncf_mod_dir}/${src}"
      local dst_path="${temp_dir}${dst}"
      echo "  ${src} -> ${dst}" 1>&2
      if [[ -f "$src_path" ]]; then
        mkdir -p "$(dirname "$dst_path")"
        cp "$src_path" "$dst_path"
        process_file "$dst_path" "${dst}" "$cncf_mod_dir"
      else
        echo "  WARNING: Source not found: ${src_path}" 1>&2
      fi
    done
  fi

  # Copy processed content to the real content directory
  echo "Syncing adapted content to ${CONTENT_DIR}..." 1>&2
  rsync -a ${VERBOSE} "${temp_dir}/" "${CONTENT_DIR}/"

  rm -rf "$temp_dir"
  echo "Content adaptation complete." 1>&2
}

main "$@"
