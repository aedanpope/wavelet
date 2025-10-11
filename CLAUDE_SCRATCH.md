
## ⚠️ MANDATORY TASK PLANNING REQUIREMENT ⚠️

**BEFORE STARTING ANY FIX, ENHANCEMENT, OR DEVELOPMENT TASK, CLAUDE MUST:**

1. **Create a task plan file** named `tasks/TASK_N.md` where N is an incrementing number (starting from 0). Run `ls tasks` first to see what to use for N.
2. **Propose a detailed plan** that includes:
   - Problem analysis and root cause identification (for fixes) OR feature requirements and user value (for new capabilities)
   - Step-by-step implementation approach
   - Files that will be modified or created
   - Testing strategy
   - Potential risks or considerations
3. **Review the plan with the `arch` agent** to ensure strategic design alignment.
4. Update the TASK_N document to incorporate the feedback from `arch`, and append revision notes at the bottom of the doc with the feedback from `arch` & a log of the corresponding changes made.
4. **Wait for user approval** before proceeding with implementation

**TASK FILE COMPLETENESS REQUIREMENTS:**

Each TASK_N.md must enable a fresh agent session to implement without additional research:

1. **Complete Context**
   - **For fixes**: Current broken/suboptimal behavior with specific examples, user impact, root cause analysis with key code locations (file:line)
   - **For features**: User requirements, business/educational value, acceptance criteria, integration with existing workflows

2. **Implementation Scope**
   - Key files and functions that need modification
   - New components/files that need creation
   - Configuration or data structure changes
   - Integration points with existing systems

3. **Testing Strategy**
   - New unit test cases to be written (with TDD where appropriate)
   - Existing tests that need updates
   - Integration/end-to-end test requirements
   - User acceptance criteria for manual testing

4. **Success Criteria & Risks**
   - Clear definition of "done"
   - Potential side effects and mitigation strategies
   - Rollback considerations

The doc should be written in such a way that a new agent session with /clear could read the doc and pick up the task.

### Task File Naming Convention
- First task: `TASK_0.md`
- Second task: `TASK_1.md` 
- And so on...

**This ensures clear communication and prevents unnecessary work on incorrect approaches.**

## Critical Workflow Reminders

**⚠️ STOP BEFORE IMPLEMENTING**: If you are starting ANY implementation, enhancement, bug fix, or development task WITHOUT first creating a TASK_N.md file, STOP IMMEDIATELY and create the required task plan file first. This is MANDATORY per the project guidelines above.