#!/bin/bash
set -e

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
    result=$(bun info "$package_name" --json 2>/dev/null)
    if [[ $? -eq 0 && -n "$result" ]]; then
        # Extract the version from the JSON response
        echo "$result" | jq -r '.version // empty' 2>/dev/null || echo ""
    else
        echo ""
    fi
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
    opentui_deps=$(jq -r '.dependencies // {} | to_entries[] | select(.key | startswith("@opentui/")) | .key' "$package_json" 2>/dev/null || echo "")
    
    if [[ -z "$opentui_deps" ]]; then
        print_warning "No @opentui/* dependencies found in $template_name"
        return 0
    fi
    
    # Update each @opentui/* dependency
    local has_updates=false
    while IFS= read -r dep; do
        if [[ -n "$dep" ]]; then
            print_status "  Checking latest version for $dep..."
            local latest_version
            latest_version=$(get_latest_version "$dep")
            
            if [[ -n "$latest_version" ]]; then
                # Get current version from package.json
                local current_version
                current_version=$(jq -r --arg dep "$dep" '.dependencies[$dep] // empty' "$package_json" 2>/dev/null)
                local new_version="^$latest_version"
                
                if [[ "$current_version" != "$new_version" ]]; then
                    print_status "  Updating $dep from $current_version to $new_version"
                    # Use jq to update the dependency version
                    jq --arg dep "$dep" --arg version "$new_version" \
                       '.dependencies[$dep] = $version' \
                       "$package_json" > "${package_json}.tmp" && mv "${package_json}.tmp" "$package_json"
                    has_updates=true
                else
                    print_status "  $dep is already up to date ($current_version)"
                fi
            else
                print_error "  Failed to get latest version for $dep"
            fi
        fi
    done <<< "$opentui_deps"
    
    # Return whether updates were made
    if [[ "$has_updates" == "true" ]]; then
        return 0
    else
        return 1
    fi
}

# Function to run bun install --lockfile-only in a directory
update_lockfile() {
    local template_dir="$1"
    local template_name="$2"
    
    print_status "Updating lockfile for $template_name..."
    
    if [[ ! -d "$template_dir" ]]; then
        print_error "Template directory not found: $template_dir"
        return 1
    fi
    
    cd "$template_dir"
    
    if bun install --lockfile-only; then
        print_success "  Lockfile updated successfully for $template_name"
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
            
            # Update @opentui/* dependencies
            if update_opentui_deps "$template_path/package.json" "$template_name"; then
                # Dependencies were updated, so update lockfile
                if update_lockfile "$template_path" "$template_name"; then
                    updated_count=$((updated_count + 1))
                    print_success "Successfully updated $template_name"
                else
                    failed_count=$((failed_count + 1))
                    print_error "Failed to update lockfile for $template_name"
                fi
            else
                # No updates were needed or there was an error
                # Check if there were any @opentui/* dependencies at all
                local opentui_deps
                opentui_deps=$(jq -r '.dependencies // {} | to_entries[] | select(.key | startswith("@opentui/")) | .key' "$template_path/package.json" 2>/dev/null || echo "")
                
                if [[ -n "$opentui_deps" ]]; then
                    print_success "$template_name is already up to date"
                else
                    print_warning "No @opentui/* dependencies found in $template_name"
                fi
            fi
            
            # Return to original directory
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
