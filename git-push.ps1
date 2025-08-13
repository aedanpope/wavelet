# GitHub Push Helper Script (PowerShell Version)
# This script helps with common Git operations for pushing to GitHub

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Blue"
$White = "White"

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor $Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $Red
}

function Write-Header {
    param([string]$Title)
    Write-Host "=== $Title ===" -ForegroundColor $Blue
}

# Function to check if we're in a git repository
function Test-GitRepository {
    try {
        git rev-parse --git-dir | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

# Function to check git status
function Show-GitStatus {
    Write-Header "Checking Git Status"
    git status --short
    Write-Host ""
}

# Function to add files
function Add-GitFiles {
    Write-Header "Adding Files"
    Write-Host "Choose what to add:"
    Write-Host "1) Add all files"
    Write-Host "2) Add specific files"
    Write-Host "3) Add only modified files"
    Write-Host "4) Skip adding (files already staged)"
    
    $choice = Read-Host "Enter your choice (1-4)"
    
    switch ($choice) {
        "1" {
            git add .
            Write-Status "Added all files"
        }
        "2" {
            $files = Read-Host "Enter file paths (space-separated)"
            git add $files
            Write-Status "Added specified files"
        }
        "3" {
            git add -u
            Write-Status "Added modified files"
        }
        "4" {
            Write-Status "Skipping add operation"
        }
        default {
            Write-Error "Invalid choice. Adding all files."
            git add .
        }
    }
    Write-Host ""
}

# Function to commit changes
function Commit-GitChanges {
    Write-Header "Committing Changes"
    
    # Check if there are staged changes
    $staged = git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
        Write-Warning "No staged changes to commit."
        return
    }
    
    Write-Host "Choose commit type:"
    Write-Host "1) feat: New feature"
    Write-Host "2) fix: Bug fix"
    Write-Host "3) docs: Documentation changes"
    Write-Host "4) style: Code style changes"
    Write-Host "5) refactor: Code refactoring"
    Write-Host "6) test: Adding tests"
    Write-Host "7) chore: Maintenance tasks"
    Write-Host "8) Custom commit message"
    
    $commitType = Read-Host "Enter your choice (1-8)"
    
    $prefix = switch ($commitType) {
        "1" { "feat" }
        "2" { "fix" }
        "3" { "docs" }
        "4" { "style" }
        "5" { "refactor" }
        "6" { "test" }
        "7" { "chore" }
        "8" { "" }
        default { "feat" }
    }
    
    if ($commitType -eq "8") {
        $commitMsg = Read-Host "Enter your commit message"
    }
    else {
        $commitDesc = Read-Host "Enter commit description"
        $commitMsg = "$prefix`: $commitDesc"
    }
    
    git commit -m "$commitMsg"
    Write-Status "Committed with message: $commitMsg"
    Write-Host ""
}

# Function to push to GitHub
function Push-ToGitHub {
    Write-Header "Pushing to GitHub"
    
    # Get current branch
    $currentBranch = git branch --show-current
    Write-Status "Current branch: $currentBranch"
    
    # Check if remote exists
    try {
        git remote get-url origin | Out-Null
    }
    catch {
        Write-Error "No remote 'origin' found. Please add your GitHub repository as origin."
        Write-Host "Example: git remote add origin https://github.com/username/repository.git"
        exit 1
    }
    
    Write-Host "Choose push option:"
    Write-Host "1) Push to current branch"
    Write-Host "2) Push to specific branch"
    Write-Host "3) Push and set upstream"
    Write-Host "4) Force push (use with caution!)"
    
    $pushChoice = Read-Host "Enter your choice (1-4)"
    
    switch ($pushChoice) {
        "1" {
            git push origin $currentBranch
        }
        "2" {
            $branchName = Read-Host "Enter branch name"
            git push origin $branchName
        }
        "3" {
            git push -u origin $currentBranch
            Write-Status "Set upstream for branch: $currentBranch"
        }
        "4" {
            Write-Warning "Force pushing will overwrite remote changes!"
            $confirm = Read-Host "Are you sure? (y/N)"
            if ($confirm -eq "y" -or $confirm -eq "Y") {
                git push --force origin $currentBranch
            }
            else {
                Write-Status "Force push cancelled."
                return
            }
        }
        default {
            Write-Error "Invalid choice. Pushing to current branch."
            git push origin $currentBranch
        }
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Status "Successfully pushed to GitHub!"
    }
    else {
        Write-Error "Push failed. Check your network connection and repository permissions."
    }
    Write-Host ""
}

# Function to show recent commits
function Show-RecentCommits {
    Write-Header "Recent Commits"
    git log --oneline -10
    Write-Host ""
}

# Function to show remote information
function Show-RemoteInfo {
    Write-Header "Remote Information"
    Write-Host "Remote URLs:"
    git remote -v
    Write-Host ""
    Write-Host "Current branch: $(git branch --show-current)"
    try {
        $upstream = git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>$null
        Write-Host "Upstream branch: $upstream"
    }
    catch {
        Write-Host "Upstream branch: Not set"
    }
    Write-Host ""
}

# Main menu
function Show-MainMenu {
    while ($true) {
        Write-Header "GitHub Push Helper"
        Write-Host "1) Check git status"
        Write-Host "2) Add files"
        Write-Host "3) Commit changes"
        Write-Host "4) Push to GitHub"
        Write-Host "5) Complete workflow (add + commit + push)"
        Write-Host "6) Show recent commits"
        Write-Host "7) Show remote information"
        Write-Host "8) Exit"
        
        $choice = Read-Host "Enter your choice (1-8)"
        
        switch ($choice) {
            "1" { Show-GitStatus }
            "2" { Add-GitFiles }
            "3" { Commit-GitChanges }
            "4" { Push-ToGitHub }
            "5" {
                Write-Header "Complete Workflow"
                Add-GitFiles
                Commit-GitChanges
                Push-ToGitHub
            }
            "6" { Show-RecentCommits }
            "7" { Show-RemoteInfo }
            "8" {
                Write-Status "Goodbye!"
                exit 0
            }
            default {
                Write-Error "Invalid choice. Please try again."
            }
        }
        
        Read-Host "Press Enter to continue..."
        Clear-Host
    }
}

# Script execution
function Main {
    Write-Header "GitHub Push Helper Script"
    Write-Status "Starting GitHub push helper..."
    
    # Check if we're in a git repository
    if (-not (Test-GitRepository)) {
        Write-Error "Not in a git repository. Please run this script from a git repository."
        exit 1
    }
    
    # Check if git is available
    try {
        git --version | Out-Null
    }
    catch {
        Write-Error "Git is not installed or not in PATH."
        exit 1
    }
    
    # Show initial status
    Show-GitStatus
    
    # Start main menu
    Show-MainMenu
}

# Run the script
Main
