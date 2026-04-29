#!/usr/bin/env python3
"""Compute the Cloudflare Pages preview URL for a branch.

Cloudflare Pages assigns each branch a deterministic alias derived from its
name: lowercase, non-alphanumerics replaced with `-`, truncated to 28 chars,
and any trailing `-` stripped. Use this to share preview URLs without waiting
for a deployment to land or guessing at character counts.

The 28-char limit routinely truncates mid-word (e.g.
`claude/course-structure-design-xU7wk` -> `claude-course-structure-desi`),
which is exactly the case humans get wrong when eyeballing. Always run this
script -- never hand-compute the alias.

Usage:
    python3 scripts/cloudflare-alias.py                    # uses current git branch
    python3 scripts/cloudflare-alias.py <branch-name>      # explicit branch
"""

import re
import subprocess
import sys

PROJECT_SLUG = "wavelet-e8x"
MAX_ALIAS_LEN = 28


def cloudflare_alias(branch: str) -> str:
    """Return the Cloudflare Pages alias slug for a git branch name."""
    sanitized = re.sub(r"[^a-z0-9]+", "-", branch.lower())
    truncated = sanitized[:MAX_ALIAS_LEN]
    return truncated.rstrip("-")


def cloudflare_preview_url(branch: str) -> str:
    """Return the full Cloudflare Pages preview URL for a git branch name."""
    return f"https://{cloudflare_alias(branch)}.{PROJECT_SLUG}.pages.dev"


def current_branch() -> str:
    return subprocess.check_output(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"], text=True
    ).strip()


if __name__ == "__main__":
    branch = sys.argv[1] if len(sys.argv) > 1 else current_branch()
    print(cloudflare_preview_url(branch))
