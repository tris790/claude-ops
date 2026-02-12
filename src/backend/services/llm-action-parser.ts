export interface LLMAction {
    type: 'apply_fix';
    instruction: string;
}

export interface ParsedComment {
    isLLMAction: boolean;
    action?: LLMAction;
    displayContent: string;
}

const LLM_COMMAND_REGEX = /^\/ai\s+(.+)$/s;

export function parseCommentForLLMAction(content: string): ParsedComment {
    const match = content.match(LLM_COMMAND_REGEX);

    if (match) {
        const instruction = match[1].trim();
        return {
            isLLMAction: true,
            action: {
                type: 'apply_fix',
                instruction
            },
            displayContent: instruction
        };
    }

    return {
        isLLMAction: false,
        displayContent: content
    };
}

export function isLLMActionComment(content: string): boolean {
    return LLM_COMMAND_REGEX.test(content);
}
