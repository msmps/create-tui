#!/bin/bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to get the latest version of a package using bun
get_latest_version() {
    local package_name="$1"
    local result
    local version

    if ! result=$(bun info "$package_name" --json 2>/dev/null); then
        return 1
    fi

    if ! version=$(jq -er '.version | select(type == "string" and length > 0)' <<< "$result" 2>/dev/null); then
        return 1
    fi

    printf '%s\n' "$version"
}

# Function to update @opentui/* dependencies in a package.json file
update_opentui_deps() {
    local package_json="$1"
    local template_name="$2"
    
    print_status "Updating @opentui/* dependencies in $template_name..."
    
    if [[ ! -f "$package_json" ]]; then
        print_error "package.json not found at $package_json"
        return 1
    fi
    
    # Get current @opentui/* dependencies
    local opentui_deps
    if ! opentui_deps=$(jq -r '.dependencies // {} | to_entries[] | select(.key | startswith("@opentui/")) | .key' "$package_json"); then
        print_error "Failed to parse $package_json"
        return 1
    fi

    if [[ -z "$opentui_deps" ]]; then
        print_warning "No @opentui/* dependencies found in $template_name"
        return 10
    fi
    
    # Update each @opentui/* dependency. OpenTUI framework packages pin
    # @opentui/core exactly, so defer updates if a staggered release exposes
    # different latest versions during the publish window.
    local has_updates=false
    local expected_version=""
    while IFS= read -r dep; do
        if [[ -z "$dep" ]]; then
            continue
        fi

        print_status "  Checking latest version for $dep..."
        local latest_version
        if ! latest_version=$(get_latest_version "$dep"); then
            print_error "  Failed to get latest version for $dep"
            return 1
        fi

        if [[ -z "$expected_version" ]]; then
            expected_version="$latest_version"
        elif [[ "$latest_version" != "$expected_version" ]]; then
            print_error "  OpenTUI release is incomplete: expected $expected_version but $dep latest is $latest_version"
            return 1
        fi

        local current_version
        if ! current_version=$(jq -er --arg dep "$dep" '.dependencies[$dep] | select(type == "string" and length > 0)' "$package_json"); then
            print_error "  Failed to read $dep from $package_json"
            return 1
        fi
        local new_version="^$latest_version"

        if [[ "$current_version" == "$new_version" ]]; then
            print_status "  $dep is already up to date ($current_version)"
            continue
        fi

        print_status "  Updating $dep from $current_version to $new_version"
        if ! jq --arg dep "$dep" --arg version "$new_version" \
            '.dependencies[$dep] = $version' \
            "$package_json" > "${package_json}.tmp"; then
            rm -f "${package_json}.tmp"
            print_error "  Failed to update $package_json"
            return 1
        fi
        mv "${package_json}.tmp" "$package_json"
        has_updates=true
    done <<< "$opentui_deps"

    if [[ "$has_updates" == "true" ]]; then
        return 0
    fi

    return 10
}

# Regenerate the lockfile and verify the updated template.
update_lockfile() {
    local template_dir="$1"
    local template_name="$2"
    
    print_status "Updating lockfile for $template_name..."
    
    if [[ ! -d "$template_dir" ]]; then
        print_error "Template directory not found: $template_dir"
        return 1
    fi
    
    if (
        cd "$template_dir"
        bun install --lockfile-only
        bun install --frozen-lockfile
        bun run typecheck
    ); then
        print_success "  Lockfile updated and template verified for $template_name"
    else
        print_error "  Failed to update lockfile for $template_name"
        return 1
    fi
}

# Main function
main() {
    print_status "Starting @opentui/* dependency update process..."
    
    # Check if we're in the right directory
    if [[ ! -d "packages/templates" ]]; then
        print_error "This script must be run from the project root directory"
        print_error "Expected to find packages/templates directory"
        exit 1
    fi
    
    # Check if required tools are available
    if ! command -v jq &> /dev/null; then
        print_error "jq is required but not installed. Please install jq."
        exit 1
    fi
    
    if ! command -v bun &> /dev/null; then
        print_error "bun is required but not installed. Please install bun."
        exit 1
    fi
    

    
    # Store the original directory
    local original_dir
    original_dir=$(pwd)
    
    # Find all template directories
    local templates_dir="packages/templates"
    local updated_count=0
    local failed_count=0
    
    # Loop through each template directory
    for template_path in "$templates_dir"/*; do
        if [[ -d "$template_path" && -f "$template_path/package.json" ]]; then
            local template_name
            template_name=$(basename "$template_path")
            
            # Skip the main templates package.json
            if [[ "$template_name" == "templates" ]]; then
                continue
            fi
            
            print_status "Processing template: $template_name"
            
            # Update @opentui/* dependencies. Status 10 means that every
            # dependency was checked successfully and no changes are needed.
            local update_status=0
            if update_opentui_deps "$template_path/package.json" "$template_name"; then
                if update_lockfile "$template_path" "$template_name"; then
                    updated_count=$((updated_count + 1))
                    print_success "Successfully updated $template_name"
                else
                    failed_count=$((failed_count + 1))
                    print_error "Failed to update lockfile for $template_name"
                fi
            else
                update_status=$?
                if [[ $update_status -eq 10 ]]; then
                    print_success "$template_name is already up to date"
                else
                    failed_count=$((failed_count + 1))
                    print_error "Failed to check updates for $template_name"
                fi
            fi

            cd "$original_dir"
            echo
        fi
    done
    
    # Summary
    print_status "Update process completed!"
    print_success "Successfully updated: $updated_count templates"
    
    if [[ $failed_count -gt 0 ]]; then
        print_error "Failed to update: $failed_count templates"
        exit 1
    else
        print_success "All templates updated successfully!"
    fi
}

# Run main function
main "$@"
