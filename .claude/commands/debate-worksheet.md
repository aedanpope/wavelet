---
argument-hint: [topic/worksheet] 
description: Orchestrate 3-round multi-agent debate to evaluate worksheet content, with meeting notes captured in meetings/MEETING_N.md
model: opus
---

# Multi-Agent Worksheet Content Debate: **$1**

## Setup Phase

1. **Create Meeting Notes**: First, run `ls meetings` to determine the next meeting number N, then create `meetings/MEETING_N.md` with:
   - Topic: $1
   - Date and participants (step, zoom, teac, helm)
   - Agenda: 3 rounds of evaluation

2. **Context Preparation**: All agents must first review the established worksheet design principles in `WORKSHEETS.md` before beginning evaluation, particularly:
   - **30/30/30 difficulty distribution** (~20 problems: Easy/Medium/Hard)
   - **Self-contained learning** (comprehensive within single worksheet)
   - **Three problem types**: Observation → Modification → Creation
   - **Rapid concept introduction** prioritizing engagement over perfection

## 3-Round Debate Process

Execute **3 rounds** of parallel agent consultations. Use multiple Task tool calls in a single message for parallel execution.

### Round 1: Initial Reactions
**Parallel Task Invocations** (use 4 Task tools simultaneously):
- **step**: "First review WORKSHEETS.md design principles, then evaluate: $1. As a struggling student, what are your immediate concerns or support needs? What would worry you about this content? Consider the established 30/30/30 difficulty distribution and self-contained learning approach."
- **zoom**: "First review WORKSHEETS.md design principles, then evaluate: $1. As an advanced learner, what engagement and challenge opportunities do you see? What excites or concerns you? Consider how this fits the three problem types (Observation → Modification → Creation)."  
- **teac**: "First review WORKSHEETS.md design principles, then evaluate: $1. From your classroom teaching experience, what are your initial thoughts and practical concerns? Consider the self-contained learning philosophy and rapid concept introduction approach."
- **helm**: "First review WORKSHEETS.md design principles, then evaluate: $1. From a strategic product perspective, how does this align with our vision for transformative programming education? Consider whether changes should work within the established worksheet framework."

**Document in meeting notes**: Capture each agent's initial reactions and key concerns.

### Round 2: Deep Analysis  
**Parallel Task Invocations** (building on Round 1 insights):
- **step**: "Based on the initial feedback from all agents, provide your deeper analysis on this evaluation: $1"
- **zoom**: "Building on the Round 1 discussion, share your detailed perspective on this evaluation: $1"
- **teac**: "Considering the initial agent feedback, give your deeper analysis of this evaluation: $1"  
- **helm**: "Drawing from the Round 1 insights, provide your strategic deep-dive on this evaluation: $1"

**Document in meeting notes**: Record detailed analysis and emerging themes.

### Round 3: Synthesis and Recommendations
**Parallel Task Invocations** (building toward decisions):
- **step**: "Given all the discussion so far, what are your final recommendations for this evaluation: $1"
- **zoom**: "Based on the full debate, what's your final perspective and recommendations for this evaluation: $1"
- **teac**: "Considering all the agent input, what's your final assessment of this evaluation: $1"
- **helm**: "Drawing from the complete discussion, what's your strategic recommendation for this evaluation: $1"

**Document in meeting notes**: Final positions and recommendations.

## Meeting Notes Template

Update `meetings/MEETING_N.md` after each round:

```markdown
# Meeting N: Worksheet Debate - [TOPIC]
**Date**: [DATE]  
**Participants**: step, zoom, teac, helm  
**Topic**: [TOPIC]

## Round 1: Initial Reactions
### step (Struggling Student)
[Response summary]

### zoom (Advanced Student)  
[Response summary]

### teac (Primary Teacher)
[Response summary]

### helm (Product Leader)
[Response summary]

## Round 2: Deep Analysis
[Continue same format]

## Round 3: Synthesis
[Continue same format]

## Final Consensus
- **Agreements**: [Areas of consensus]
- **Conflicts**: [Disagreements between agents]
- **Decision**: [Go/No-Go recommendation]
- **Action Items**: [Next steps]
```

## Execution Summary

After all 3 rounds, provide a brief summary of:
- Key consensus points across agents
- Major disagreements and trade-offs  
- Final recommendation with rationale
- Reference to the detailed meeting notes file