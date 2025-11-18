# AI Pilot Integration - Context-Aware Assistant

## Overview

The AI Pilot is a context-aware assistant integrated into Persona, Workflow, and Project screens that helps users create and update specifications with surgical precision. It uses specialized prompts to avoid massive rewrites and maintains control over what changes are applied.

## Key Features

### 1. **Specialized Prompt System**

Instead of one generic prompt that does everything, we now have:

- **Operation-Specific Prompts**: Different prompts for `create`, `update`, `refine`, and `general` operations
- **Entity-Specific Prompts**: Specialized prompts for `persona`, `workflow`, and `project` entities
- **Context-Aware**: Prompts include the current spec when updating, ensuring targeted changes

#### Prompt Types

**CREATE Prompts**: Generate new entities from scratch
- Persona Create: Focus on mission, inputs, workflow, success criteria
- Workflow Create: Focus on steps, execution patterns, persona orchestration
- Project Create: Interview-style requirements gathering with epics/stories/acceptance criteria

**UPDATE Prompts**: Make targeted modifications
- **Critical Rules**:
  - PRESERVE existing content
  - NO complete rewrites
  - Only change what's explicitly requested
  - Ask for clarification if unclear
- Focus on surgical changes to specific fields

**REFINE Prompts**: Improve quality without changing intent
- Clarify vague descriptions
- Add missing details
- Improve wording
- Fix inconsistencies
- Preserve core identity

### 2. **AI Pilot Component**

Location: `frontend/src/components/AIPilot.tsx`

A reusable component with:
- **Chat Interface**: Natural language conversation
- **Operation Mode Selection**: Choose create/update/refine
- **Focus Area**: Specify which part to modify (optional)
- **Diff Viewing**: Compare existing vs proposed changes
- **Accept/Apply Options**: 
  - "Accept & Apply": Update the spec in place
  - "Copy to Editor": Copy to editor for manual review

### 3. **Integration Points**

#### PersonasPage
- Toggle AI Pilot with button in header
- Side panel (400px) appears on right
- Auto-detects operation mode based on selected persona
- Updates persona spec when accepted

#### WorkflowsPage
- Same toggle pattern as Personas
- Side panel layout
- Workflow-specific prompts and context

#### ProjectDetailPage
- Toggle button at top
- Sticky side panel (400px) on larger screens
- Project-specific prompts
- Can update epics, stories, and acceptance criteria

### 4. **Backend Architecture**

#### New Files Created

**`src/server/services/assistantPrompts.ts`**
- Centralized prompt management
- `buildContextualPrompt()`: Main function to get appropriate prompt
- Specialized prompt builders for each operation/entity combination
- Each prompt includes:
  - Operation-specific instructions
  - Schema reference
  - Examples (when applicable)
  - Current spec (for updates)
  - Focus area guidance

**New Route: `/api/assistant/chat-contextual`**
- POST endpoint for context-aware chat
- Required fields:
  - `message`: User's message
  - `operation`: 'create' | 'update' | 'refine' | 'general'
  - `entityType`: 'persona' | 'workflow' | 'project' | 'general'
- Optional fields:
  - `currentSpec`: Existing spec to update
  - `focusArea`: Specific area to focus on
  - `conversationId`: For maintaining conversation history

**New Service Function: `chatWithContextualAssistant()`**
- Uses `buildContextualPrompt()` to get appropriate prompt
- Handles JSON spec extraction
- Returns structured response with suggested spec

### 5. **Preventing Massive Rewrites**

The key to avoiding massive rewrites is in the prompt engineering:

#### UPDATE Prompt Pattern (Example: Persona)

```
YOUR GOAL:
Make TARGETED, SURGICAL changes to the existing persona. Preserve all existing content 
unless explicitly asked to change it.

CRITICAL RULES:
1. PRESERVE EXISTING CONTENT - Only change what's explicitly requested
2. NO COMPLETE REWRITES - Make minimal, focused changes
3. MAINTAIN STRUCTURE - Keep existing fields and organization
4. ASK FOR CLARIFICATION - If the change request is ambiguous, ask specific questions
5. SHOW WHAT CHANGED - Clearly indicate what you modified

CURRENT PERSONA SPECIFICATION:
{...current spec JSON...}

APPROACH:
1. Read the current specification carefully
2. Identify exactly what needs to change
3. Ask clarifying questions if the request is vague
4. Make ONLY the requested changes
5. Return the updated spec with preserved existing content

EXAMPLES OF GOOD UPDATES:
- "Update mission to include X" → Only change specification.mission
- "Add a workflow step for Y" → Add one step to specification.workflow

EXAMPLES OF BAD UPDATES:
- Rewriting the entire specification
- Changing fields that weren't mentioned
- Removing existing content without being asked
```

### 6. **User Experience Flow**

#### For Updating an Existing Persona:
1. User opens PersonasPage and selects a persona
2. User clicks "Show AI Pilot" button
3. AI Pilot opens with:
   - Mode: "Update Existing" (auto-selected)
   - Optional focus area field
   - Current spec loaded as context
4. User types: "Update the mission to include code review best practices"
5. AI responds with targeted change proposal
6. User sees diff view with proposed changes
7. User can:
   - "Accept & Apply": Updates spec immediately
   - "Copy to Editor": Copies to editor for manual review
   - Continue conversation for further refinements

#### For Creating a New Persona:
1. User clicks "New Persona" or AI Pilot with no selection
2. Mode: "Create New" (auto-selected)
3. User describes what they want
4. AI asks clarifying questions
5. User provides details
6. AI generates complete spec
7. User reviews and accepts/applies

### 7. **Diff Viewing**

The AI Pilot component includes a diff view that shows:
- Proposed specification in JSON format
- Scrollable container (max 400px height)
- Actions:
  - Hide: Collapse the diff view
  - Copy to Editor: Copy spec to main editor
  - Accept & Apply: Apply changes immediately

### 8. **Conversation Management**

- Each AI Pilot session maintains its own conversation
- Conversations are preserved across page refreshes
- History allows the AI to understand context
- Users can have different conversations for different entities

## File Structure

```
src/
├── server/
│   ├── services/
│   │   ├── assistantPrompts.ts (NEW - Specialized prompts)
│   │   └── assistantService.ts (UPDATED - Added chatWithContextualAssistant)
│   └── routes/
│       └── assistant.ts (UPDATED - Added /chat-contextual endpoint)
└── frontend/
    ├── components/
    │   └── AIPilot.tsx (NEW - Reusable AI Pilot component)
    └── pages/
        ├── PersonasPage.tsx (UPDATED - Integrated AI Pilot)
        ├── WorkflowsPage.tsx (UPDATED - Integrated AI Pilot)
        └── ProjectDetailPage.tsx (UPDATED - Integrated AI Pilot)
```

## API Reference

### POST /api/assistant/chat-contextual

**Request Body:**
```json
{
  "message": "Update the mission to include code review",
  "operation": "update",
  "entityType": "persona",
  "currentSpec": { "id": "...", "name": "...", ... },
  "focusArea": "mission", // optional
  "conversationId": "..." // optional
}
```

**Response:**
```json
{
  "data": {
    "message": "I'll update the mission...",
    "suggestedSpec": {
      "type": "persona",
      "spec": { "id": "...", "name": "...", ... }
    },
    "status": "ready_to_save",
    "conversationId": "..."
  }
}
```

## Benefits

1. **Precision**: Specialized prompts ensure targeted changes
2. **Control**: Users see diffs and can accept/reject changes
3. **Consistency**: Same experience across all entity types
4. **Flexibility**: Multiple operation modes for different use cases
5. **Safety**: No accidental massive rewrites
6. **Efficiency**: Quick iterations with focused changes

## UX Considerations

- **Toggle Pattern**: Easy to show/hide without losing context
- **Side Panel**: Doesn't interfere with main content
- **Sticky Positioning**: AI Pilot stays visible while scrolling (on larger screens)
- **Operation Auto-Detection**: Smart defaults based on context
- **Diff View**: Clear visualization of changes before accepting

## Future Enhancements

Potential improvements:
1. **Visual Diff**: Side-by-side comparison with highlighting
2. **Undo/Redo**: Revert accepted changes
3. **Change History**: Track all AI-suggested modifications
4. **Batch Operations**: Update multiple entities at once
5. **Templates**: Save common update patterns
6. **Validation**: Real-time schema validation in AI Pilot
7. **Export**: Save conversation for documentation

## Testing

To test the integration:

1. **Test Persona Updates**:
   - Go to Personas page
   - Select an existing persona
   - Click "Show AI Pilot"
   - Try: "Add a constraint about response time"
   - Verify only constraints field is updated

2. **Test Workflow Creation**:
   - Go to Workflows page
   - Click "New Workflow"
   - Click "Show AI Pilot"
   - Describe a workflow
   - Verify AI creates proper workflow structure

3. **Test Project Updates**:
   - Go to Projects page
   - Open a project
   - Click "Show AI Pilot"
   - Try: "Add an epic for user authentication"
   - Verify only one epic is added

## Troubleshooting

**Issue**: AI still doing complete rewrites
- **Solution**: Check that `operation` is set to `update` (not `create`)
- **Solution**: Ensure `currentSpec` is being passed to the API

**Issue**: Diff view not showing
- **Solution**: Verify JSON parsing is working in `extractSpecFromMessage`
- **Solution**: Check console for errors

**Issue**: Changes not applying to editor
- **Solution**: Verify `onSpecUpdate` or `onSpecApply` callbacks are wired correctly

## Conclusion

The AI Pilot integration provides a powerful, controlled way to work with AI-generated content. By using specialized prompts and showing diffs, users maintain full control while benefiting from AI assistance. The system is designed to be extensible, allowing for future enhancements without major architectural changes.

