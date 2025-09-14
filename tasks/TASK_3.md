# TASK_3: Create Multi-Agent Worksheet Debate Slash Command

## Problem Analysis

**Current State**: We have defined four educational agent personas (`step`, `zoom`, `teac`, `helm`) but no mechanism to orchestrate multi-perspective evaluations of worksheet content.

**User Value**: A slash command that enables structured debates between educational agents would provide comprehensive evaluation of worksheet content from multiple perspectives (struggling students, advanced students, teachers, product leadership) before implementation.

**Root Cause**: Missing tooling to leverage multiple agent perspectives in content decision-making process.

## Requirements

### Primary Requirements
- Create `/debate-worksheet` slash command that orchestrates multi-agent discussions
- Support arguments for worksheet topics or specific problems
- Invoke all four educational agents (`step`, `zoom`, `teac`, `helm`) in structured sequence
- Generate consolidated feedback report with recommendations

### Acceptance Criteria
- Command accepts worksheet topic as argument
- Each agent provides perspective based on their defined focus areas
- Output includes structured summary with actionable insights
- Command integrates with existing Claude Code subagent system

## Implementation Plan

### Step 1: Research Claude Code Slash Command Structure
- Investigate existing slash command patterns in the codebase
- Understand subagent invocation mechanisms
- Determine file structure and configuration requirements

### Step 2: Create Base Command Structure  
- Create slash command file with proper naming and structure
- Define argument parsing for worksheet topics
- Set up basic command scaffolding

### Step 3: Implement Agent Orchestration
- Configure subagent invocations for each educational persona
- Define structured prompt templates for each agent's evaluation
- Implement sequential agent execution with context passing

### Step 4: Build Debate Framework
- Create structured format for each agent's input
- Design consolidation logic to combine multiple perspectives
- Generate actionable summary and recommendations

### Step 5: Testing and Refinement
- Test command with sample worksheet topics
- Validate agent responses align with defined personas
- Refine output formatting for usability

## Files to Modify/Create

### New Files
- `.claude/commands/debate-worksheet.js` (or similar structure based on research)
- Supporting configuration files as needed for subagent definitions

### Potential Modifications
- Claude Code configuration files if needed for subagent registration
- Documentation updates in AGENTS.md to reference the command

## Testing Strategy

### Unit Testing
- Test command argument parsing
- Validate each agent invocation works independently
- Test error handling for malformed inputs

### Integration Testing  
- End-to-end test of full debate workflow
- Test with various worksheet topic types
- Validate output format and completeness

### User Acceptance Testing
- Test command with real worksheet scenarios
- Validate usefulness of generated recommendations
- Confirm command integrates smoothly with existing workflow

## Success Criteria

**Definition of Done:**
- `/debate-worksheet` command successfully invokes all four agents
- Each agent provides relevant feedback based on their persona
- Consolidated output provides actionable insights for worksheet development
- Command documented and ready for use in content development workflow

## Potential Risks & Mitigation

**Risk**: Claude Code subagent API may differ from documentation
- **Mitigation**: Start with research phase to understand actual implementation patterns

**Risk**: Agent responses may be inconsistent or off-topic  
- **Mitigation**: Use structured prompts with clear evaluation criteria for each persona

**Risk**: Output may be too verbose or difficult to process
- **Mitigation**: Implement clear formatting and summary sections in final output

## Rollback Considerations

- Command implementation is additive and shouldn't affect existing functionality
- Can be disabled/removed without impacting core Wavelet application
- No database or persistent storage changes required

---

## Arch Agent Review Feedback

**Date**: 2025-09-14
**Reviewer**: arch agent

### Critical Technical Gaps Identified

1. **Fundamental Implementation Gap**: Task assumes Claude Code supports slash commands without evidence. No `.claude/commands/` directory exists in codebase.

2. **Agent Orchestration Architecture Problem**: Plan proposes sequential agent execution without investigating how to programmatically invoke subagents or handle context passing.

3. **File Structure Assumptions**: Assumes `.claude/commands/debate-worksheet.js` format without confirming JavaScript is correct or understanding command registration.

### Required Research Phase (Must Complete First)

**Phase 1: Technical Feasibility**
1. Research Claude Code's actual extension model and subagent invocation patterns
2. Confirm slash command support or identify alternative implementation approaches
3. Document actual file structure requirements for Claude Code extensions

**Phase 2: Agent Infrastructure**
1. Create actual agent definition files: `.claude/agents/step.md`, `zoom.md`, `teac.md`, `helm.md`
2. Define comprehensive prompts for each educational perspective
3. Test individual agent invocation manually

### Missing Implementation Details

- **Agent Prompt Templates**: Need full evaluation frameworks for each persona
- **Output Format Specification**: Exact structure for consolidated reports
- **Fallback Strategy**: Manual workflow design if programmatic orchestration isn't supported
- **Context Persistence Strategy**: How to handle context between agent sessions

### Revised Risk Assessment

**Primary Risk**: Slash commands may not be supported at all
**Mitigation**: Research alternative UI integration approaches

**Agent Creation Risk**: May need to manually create agent files first  
**Mitigation**: Complete agent infrastructure setup before orchestration

**Context Persistence Risk**: Agent sessions may not preserve context
**Mitigation**: Design self-contained evaluation frameworks

### Recommendations Applied

1. **Research First**: Must validate technical feasibility before implementation
2. **Agent-First Approach**: Create individual agents before orchestration
3. **Fallback Planning**: Design manual workflow as primary approach
4. **Educational Focus**: Prioritize agent perspective value over automation complexity

**Status**: Task requires significant technical research and planning refinement before implementation can begin.

---

## Implementation Progress & User Feedback

**Date**: 2025-09-14
**Status**: Successfully completed with user guidance and feedback

### Key Implementation Decisions Made

1. **Technical Research Results**:
   - Confirmed Claude Code supports agents via `.claude/agents/` directory
   - Found slash commands are supported via `.claude/commands/` directory
   - No automated orchestration needed - manual parallel task invocation works well

2. **Agent Creation**: Created 4 educational agents with comprehensive personas:
   - `step` - Struggling student (needs support, step-by-step guidance)
   - `zoom` - Advanced student (needs challenge, creative applications)
   - `teac` - Primary teacher (classroom implementation, curriculum alignment)
   - `helm` - Product leader (strategic vision, market differentiation)

3. **Slash Command Implementation**: Created `/debate-worksheet` with 3-round structure

### User Feedback Patterns & Guidance Style

**Design Preferences**:
- Prefers iterative refinement over perfect-first-attempt
- Values practical functionality over complex automation
- Likes structured documentation with cross-references
- Wants concise documentation that links to detailed implementation

**Specific Feedback Examples**:

1. **Agent Naming**: 
   - User wanted 4-letter names like 'arch'
   - Collaborative brainstorming approach - I provided options, user selected
   - Final choices: `step`, `zoom`, `teac`, `helm`

2. **Command Structure Refinement**:
   - **User feedback**: "lets re-jig the debate command a bit - I want to do, say, 3 go-rounds of the different perspectives - they can happen in parallel"
   - **User feedback**: "take 'meeting notes' in a doc under 'meetings/MEETING_N.md'"
   - Shows preference for parallel execution and structured documentation

3. **Documentation Approach**:
   - **User feedback**: "we can include less detail of the example output structure... instead that can mostly lean on the link to the actual command file"
   - Indicates preference for lean overview docs with detailed implementation elsewhere

4. **Command Prompt Refinement**:
   - **User concern**: "Not sure this will flow properly into the $1 usage in the command file" 
   - **User feedback**: "I liked the part where round 2 also said to build from the feedback in round 1"
   - **User feedback**: "for round 2 we don't need to be so specific with what we want each agent to look at, they can use their general perspective"
   - Shows attention to natural language flow and agent autonomy

### User Working Style Observations

- **Collaborative approach**: Engages in back-and-forth refinement
- **Practical focus**: Concerned with real-world usability over theoretical perfection  
- **Documentation standards**: Wants structured, cross-linked documentation
- **Quality feedback**: Provides specific, actionable improvement suggestions
- **Trust and delegate**: Once direction is clear, allows implementation autonomy

### Key Success Factors for Future Tasks

1. **Start with research and validation** before assuming implementation approaches
2. **Create structured documentation** with clear cross-references
3. **Iterate based on feedback** rather than trying to get everything perfect initially
4. **Focus on practical usability** and natural user experience
5. **Maintain flexibility** for user refinement and adjustment
6. **Document decision rationale** for future reference

**Final Outcome**: Fully functional multi-agent debate system with:
- 4 educational agent personas
- `/debate-worksheet` slash command
- 3-round parallel evaluation process
- Structured meeting notes in `meetings/MEETING_N.md`
- Comprehensive documentation in `AGENTS.md` and `COMMANDS.md`