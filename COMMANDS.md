# Custom Claude Commands

This document provides examples and usage instructions for custom slash commands available in the Wavelet project.

## `/debate-worksheet` - Multi-Agent Content Evaluation

**Purpose**: Orchestrate structured debates between educational agents to evaluate worksheet content from multiple perspectives.

**Usage Examples**:
```
/debate-worksheet "variables and basic math operations"
/debate-worksheet "introduction to loops with turtle graphics" 
/debate-worksheet "string manipulation for creative writing"
```

**Output Location**: 
- Creates detailed meeting notes in `meetings/MEETING_N.md`
- Involves 4 agents (`step`, `zoom`, `teac`, `helm`) across 3 rounds of evaluation
- Provides final go/no-go recommendation with rationale

**When to Use**:
- Before creating new worksheet content
- When evaluating proposed changes to existing worksheets
- To get comprehensive educational perspective on content ideas

**Details**: See [`.claude/commands/debate-worksheet.md`](.claude/commands/debate-worksheet.md) for complete process documentation.

---

*Note: This command leverages the multi-agent system defined in [`AGENTS.md`](AGENTS.md).*