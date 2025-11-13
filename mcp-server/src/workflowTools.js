import { z } from 'zod';
import { CONTROL_PLANE_URL, requireToken } from './config.js';
async function loadWorkflowsFromControlPlane() {
    const response = await fetch(new URL('/api/workflows', CONTROL_PLANE_URL).toString(), {
        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${requireToken()}`
        }
    });
    if (!response.ok) {
        console.warn(`Failed to load workflows from control plane: ${response.status}`);
        return [];
    }
    const body = (await response.json());
    const workflows = [];
    for (const summary of body.data) {
        const workflowResponse = await fetch(new URL(`/api/workflows/${summary.id}`, CONTROL_PLANE_URL).toString(), {
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${requireToken()}`
            }
        });
        if (workflowResponse.ok) {
            const workflowBody = (await workflowResponse.json());
            workflows.push(workflowBody.data);
        }
    }
    return workflows;
}
const workflowToolShape = {
    input: z.record(z.string(), z.any()).optional().describe('Optional context or input for the workflow')
};
function buildWorkflowExecutionGuide(workflow, personas) {
    const sortedSteps = workflow.steps.sort((a, b) => a.order - b.order);
    const metadata = workflow.metadata || {};
    const description = metadata.description || '';
    const executionSpec = workflow.execution_spec;
    let guide = `# Workflow: ${workflow.name}\n\n`;
    if (description) {
        guide += `${description}\n\n`;
    }
    guide += `## Overview\n\n`;
    // Use execution_spec description if available, otherwise generate generic overview
    if (executionSpec?.description) {
        guide += `${executionSpec.description}\n\n`;
    }
    else {
        guide += `This workflow orchestrates ${sortedSteps.length} personas to accomplish the goal. `;
        guide += `Each persona has a specific role and communicates through structured handoffs.\n\n`;
    }
    guide += `## Execution Flow\n\n`;
    // If execution_spec provides guidance, use it; otherwise provide default sequential guidance
    if (executionSpec?.execution_guidance) {
        guide += `${executionSpec.execution_guidance}\n\n`;
    }
    else if (executionSpec?.description) {
        guide += `${executionSpec.description}\n\n`;
    }
    else {
        guide += `Execute these steps **in order**. Each step must complete before moving to the next.\n\n`;
    }
    // Add cycle details if specified
    if (executionSpec?.cycle_details) {
        const cycle = executionSpec.cycle_details;
        guide += `### Refinement Cycle\n\n`;
        guide += `This workflow includes a refinement cycle involving: ${cycle.cycle_steps.join(', ')}.\n\n`;
        guide += `- **Exit Condition**: ${cycle.exit_condition}\n`;
        guide += `- **Max Iterations**: ${cycle.max_iterations || 10}\n\n`;
        guide += `Continue the cycle until the exit condition is met or max iterations reached.\n\n`;
    }
    // Add parallel execution details if specified
    if (executionSpec?.parallel_details) {
        const parallel = executionSpec.parallel_details;
        guide += `### Parallel Execution\n\n`;
        guide += `The following steps can execute in parallel: ${parallel.parallel_steps.join(', ')}.\n`;
        guide += `- **Merge Strategy**: ${parallel.merge_strategy || 'all'} (${parallel.merge_strategy === 'all' ? 'wait for all' : parallel.merge_strategy === 'any' ? 'first success' : 'consensus'})\n\n`;
        if (parallel.description) {
            guide += `${parallel.description}\n\n`;
        }
    }
    // Add conditional branches if specified
    if (executionSpec?.conditional_branches && executionSpec.conditional_branches.length > 0) {
        guide += `### Conditional Branching\n\n`;
        executionSpec.conditional_branches.forEach((branch) => {
            guide += `- **If** ${branch.condition} **then** go to step: ${branch.target_step}`;
            if (branch.description) {
                guide += ` (${branch.description})`;
            }
            guide += `\n`;
        });
        guide += `\n`;
    }
    // Build a map for quick step lookup by ID
    const stepMap = new Map();
    sortedSteps.forEach((s) => stepMap.set(s.id, s));
    guide += `## Workflow Steps\n\n`;
    guide += `The workflow consists of the following steps. Refer to the execution specification above for how these steps interact.\n\n`;
    // List all steps with their personas - no programmatic flow inference
    for (const step of sortedSteps) {
        const persona = personas.get(step.persona_id);
        guide += `### Step ${step.order}: ${step.id}\n\n`;
        if (persona) {
            const spec = persona.specification;
            const mission = spec.mission;
            const inputs = spec.inputs;
            const handoffExpectations = spec.handoff_expectations;
            guide += `**Persona**: ${persona.name} (\`${step.persona_id}\`)\n\n`;
            if (mission) {
                guide += `**Purpose**: ${mission}\n\n`;
            }
            guide += `**Tool to Call**: \`persona.${step.persona_id}.get_specification\`\n\n`;
            if (spec.workflow && Array.isArray(spec.workflow)) {
                guide += `**What This Step Does**:\n`;
                const workflowSteps = spec.workflow;
                workflowSteps.forEach((ws, idx) => {
                    guide += `${idx + 1}. ${ws}\n`;
                });
                guide += `\n`;
            }
            if (inputs && inputs.length > 0) {
                guide += `**Expected Inputs**:\n`;
                inputs.forEach((input) => {
                    guide += `- ${input}\n`;
                });
                guide += `\n`;
            }
            if (handoffExpectations && handoffExpectations.length > 0) {
                guide += `**Output/Handoff**:\n`;
                handoffExpectations.forEach((expectation) => {
                    guide += `- ${expectation}\n`;
                });
                guide += `\n`;
            }
            if (step.condition) {
                guide += `**Step Condition**: ${step.condition}\n\n`;
                guide += `⚠️ **Note**: This step only executes if the condition is met. Evaluate the condition before proceeding.\n\n`;
            }
        }
        else {
            guide += `**Persona**: ${step.persona_id} (specification not found)\n\n`;
            guide += `**Tool to Call**: \`persona.${step.persona_id}.get_specification\`\n\n`;
        }
        guide += `---\n\n`;
    }
    guide += `## How to Execute This Workflow\n\n`;
    guide += `Follow the execution specification described above. The key principles are:\n\n`;
    guide += `1. **Get Persona Specification**: For each step, call \`persona.{persona_id}.get_specification\` with the current context/input.\n`;
    guide += `   - This returns detailed instructions on what the persona does and how to work as that persona.\n`;
    guide += `   - Example: \`persona.${sortedSteps[0]?.persona_id || 'persona_id'}.get_specification(context: "your input here")\`\n\n`;
    guide += `2. **Execute the Persona's Role**: Follow the specification instructions to complete the step.\n`;
    guide += `   - Use the persona's workflow steps, success criteria, and constraints as guidance.\n`;
    guide += `   - Work as if you ARE that persona, following their mission and approach.\n\n`;
    guide += `3. **Collect Handoff Data**: Gather the output according to the persona's handoff_expectations.\n`;
    guide += `   - Structure the output as specified (e.g., JSON object, structured text, etc.).\n`;
    guide += `   - Include all required fields mentioned in handoff_expectations.\n\n`;
    guide += `4. **Follow Execution Specification**: Use the execution specification (described above) to determine:\n`;
    guide += `   - Which step to execute next\n`;
    guide += `   - Whether to enter cycles, execute steps in parallel, or follow conditional branches\n`;
    guide += `   - When to exit cycles based on exit conditions\n`;
    guide += `   - How to merge parallel results\n\n`;
    guide += `5. **Map Data Between Steps**: Transform handoff data from one step to match the expected inputs of the next step.\n\n`;
    guide += `6. **Final Output**: When the workflow completes (per execution specification), return the final result.\n\n`;
    if (metadata.success_criteria) {
        guide += `## Success Criteria\n\n`;
        guide += `${metadata.success_criteria}\n\n`;
    }
    if (metadata.estimated_duration) {
        guide += `## Estimated Duration\n\n`;
        guide += `${metadata.estimated_duration}\n\n`;
    }
    guide += `## Important Notes\n\n`;
    guide += `- Each persona tool (\`persona.{id}.get_specification\`) returns detailed instructions for that persona's role.\n`;
    guide += `- Always call the persona tool before executing a step to get the latest specification.\n`;
    guide += `- Pass structured data between steps - use the handoff expectations from each step.\n`;
    guide += `- Follow the execution specification above to determine flow, cycles, parallel execution, and conditions.\n`;
    guide += `- The execution specification is the source of truth for how the workflow executes - interpret it intelligently.\n`;
    return guide;
}
export async function registerWorkflowTools(server, personas) {
    const definitions = await loadWorkflowsFromControlPlane();
    // Create a map for quick persona lookup
    const personaMap = new Map();
    personas.forEach((p) => personaMap.set(p.id, p));
    for (const workflow of definitions) {
        const toolName = `workflow.${workflow.id}`;
        const description = `Get the complete workflow definition and execution guide for: ${workflow.name}. This includes detailed instructions on what each persona does, how they communicate, execution order, and data flow.`;
        server.registerTool(toolName, {
            title: workflow.name,
            description,
            inputSchema: workflowToolShape,
            annotations: {
                workflowId: workflow.id
            }
        }, async ({ input } = {}) => {
            // Build comprehensive workflow execution guide
            const executionGuide = buildWorkflowExecutionGuide(workflow, personaMap);
            // Also provide structured data for programmatic access
            const sortedSteps = workflow.steps.sort((a, b) => a.order - b.order);
            const stepDetails = sortedSteps.map((step) => {
                const persona = personaMap.get(step.persona_id);
                const spec = persona?.specification;
                return {
                    step_id: step.id,
                    order: step.order,
                    persona_id: step.persona_id,
                    persona_name: persona?.name || step.persona_id,
                    persona_tool: `persona.${step.persona_id}.get_specification`,
                    mission: spec?.mission,
                    inputs: spec?.inputs,
                    handoff_expectations: spec?.handoff_expectations,
                    condition: step.condition
                };
            });
            return {
                content: [
                    {
                        type: 'text',
                        text: executionGuide
                    }
                ],
                structuredContent: {
                    workflow_id: workflow.id,
                    workflow_name: workflow.name,
                    description: workflow.metadata?.description,
                    steps: stepDetails,
                    execution_order: sortedSteps.map((s) => s.id),
                    metadata: workflow.metadata || {}
                }
            };
        });
    }
}
