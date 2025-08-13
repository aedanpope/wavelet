# GitHub Push Helper Scripts

This repository contains two helper scripts to streamline your Git workflow when pushing to GitHub:

- `git-push.sh` - Bash script for Linux/macOS
- `git-push.ps1` - PowerShell script for Windows

## Features

Both scripts provide the same functionality:

- ✅ **Interactive menu system** for easy navigation
- ✅ **Git status checking** to see what files have changed
- ✅ **Flexible file adding** (all files, specific files, or modified files only)
- ✅ **Conventional commit messages** with predefined prefixes (feat, fix, docs, etc.)
- ✅ **Multiple push options** (current branch, specific branch, set upstream, force push)
- ✅ **Complete workflow** option that runs add + commit + push in sequence
- ✅ **Recent commits viewer** to see your commit history
- ✅ **Remote information** to check your repository configuration
- ✅ **Error handling** with helpful error messages
- ✅ **Colored output** for better readability

## Prerequisites

- Git installed and configured
- A Git repository with a remote origin pointing to GitHub
- For Windows: PowerShell 5.0 or later

## Usage

### Windows (PowerShell)

1. Open PowerShell in your Git repository
2. Run the script:
   ```powershell
   .\git-push.ps1
   ```

### Linux/macOS (Bash)

1. Open terminal in your Git repository
2. Make the script executable (if not already):
   ```bash
   chmod +x git-push.sh
   ```
3. Run the script:
   ```bash
   ./git-push.sh
   ```

## Menu Options

1. **Check git status** - Shows modified, staged, and untracked files
2. **Add files** - Choose what files to stage for commit
3. **Commit changes** - Create a commit with conventional commit messages
4. **Push to GitHub** - Push your commits to the remote repository
5. **Complete workflow** - Run add + commit + push in one go
6. **Show recent commits** - Display the last 10 commits
7. **Show remote information** - Check your repository configuration
8. **Exit** - Close the script

## Conventional Commit Types

The script supports these commit message prefixes:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## Examples

### Quick Workflow
1. Run the script
2. Choose option 5 (Complete workflow)
3. Select what files to add
4. Choose commit type and enter description
5. Choose push option
6. Done! 🎉

### Step-by-Step
1. Run the script
2. Choose option 1 to check status
3. Choose option 2 to add files
4. Choose option 3 to commit
5. Choose option 4 to push
6. Choose option 8 to exit

## Troubleshooting

### "Not in a git repository"
- Make sure you're running the script from a directory that contains a `.git` folder
- Run `git init` if you haven't initialized the repository yet

### "No remote 'origin' found"
- Add your GitHub repository as origin:
  ```bash
  git remote add origin https://github.com/username/repository.git
  ```

### "Git is not installed"
- Install Git from https://git-scm.com/
- Make sure Git is in your system PATH

### Permission denied (Linux/macOS)
- Make the script executable:
  ```bash
  chmod +x git-push.sh
  ```

## Customization

You can modify the scripts to:
- Add more commit types
- Change the default branch
- Add additional Git operations
- Customize the color scheme
- Add more validation checks

## Contributing

Feel free to submit issues or pull requests to improve these scripts!

## License

This project is open source and available under the MIT License.
