export function claudeMessageResponse({
  content,
  stopReason = 'end_turn',
}: {
  content: unknown[];
  stopReason?: string;
}): Response {
  return Response.json({
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5-5',
    content,
    stop_reason: stopReason,
    stop_details: stopReason === 'refusal' ? { type: 'refusal', category: 'cyber' } : null,
    usage: { input_tokens: 120, output_tokens: 8 },
  });
}
