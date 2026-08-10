import { AssistantView } from '@/shared/types/chat';
import logger from '@/server/logging/logger';

export const VIEW_SINK_CONTEXT_KEY = 'assistantViewSink';

/**
 * Collects the structured views a turn's tools produce.
 *
 * Views travel this way rather than in the tool's return value because a tool
 * result is fed straight back to the model. Returning a hundred transaction
 * rows would put the whole table in the prompt and invite the model to retype
 * it — which is exactly the wall of text this replaces. The sink keeps the rows
 * out of the model's context and out of the persisted memory thread; the model
 * still gets the `summary` string, so it can talk about the figures without
 * reproducing them.
 */
export class AssistantViewSink {
  private pending: AssistantView[] = [];

  public record(view: AssistantView): void {
    this.pending.push(view);
  }

  /** Returns everything recorded since the last drain, and clears it. */
  public drain(): AssistantView[] {
    return this.pending.splice(0, this.pending.length);
  }
}

interface ToolContext {
  requestContext?: { get: (key: string) => unknown };
}

/**
 * Records a view if a sink is present.
 *
 * Never throws: the view is a presentation detail, and losing it must not fail
 * the tool call that produced the answer. A missing sink is normal — tools also
 * run from tests and from any caller that does not stream.
 */
export function recordAssistantView(
  context: ToolContext,
  view: AssistantView,
): void {
  try {
    const sink = context.requestContext?.get(VIEW_SINK_CONTEXT_KEY);

    if (sink instanceof AssistantViewSink) {
      sink.record(view);
    }
  } catch (err) {
    logger.warn({ err, kind: view.kind }, 'Failed to record assistant view');
  }
}
