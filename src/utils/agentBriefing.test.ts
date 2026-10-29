import { describe, expect, it } from 'vitest';
import { AGENT_TOKEN_PLACEHOLDER, buildAgentBriefing } from '@/utils/agentBriefing';
import { AGENT_TOOL_GUIDE } from '@/shared/agentTools';

const MCP_URL = 'https://expenses.example/api/mcp';

describe('buildAgentBriefing', () => {
  it('carries everything an agent needs to connect on its own', () => {
    const briefing = buildAgentBriefing({ mcpUrl: MCP_URL, token: 'mxk_abc' });

    expect(briefing).toContain(MCP_URL);
    expect(briefing).toContain('Authorization: Bearer mxk_abc');
    for (const tool of AGENT_TOOL_GUIDE) {
      expect(briefing).toContain(`- ${tool.name}: `);
    }
  });

  it('asks for confirmation before deleting', () => {
    const briefing = buildAgentBriefing({ mcpUrl: MCP_URL, token: null });

    expect(briefing).toMatch(/Before deleting.*explicit yes/);
  });

  it('holds a placeholder until a token has been issued', () => {
    const briefing = buildAgentBriefing({ mcpUrl: MCP_URL, token: null });

    expect(briefing).toContain(`Bearer ${AGENT_TOKEN_PLACEHOLDER}`);
  });
});
