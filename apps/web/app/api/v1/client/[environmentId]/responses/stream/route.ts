import { getServerSession } from "next-auth";
import { v7 as uuidv7 } from "uuid";
import { hasUserEnvironmentAccess } from "@/lib/environment/auth";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { responseEventBus } from "@/modules/response-notification/lib/response-event-bus";
import { TResponseEvent } from "@/modules/response-notification/lib/types";

const HEARTBEAT_INTERVAL_MS = 30_000;

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ environmentId: string }> }
): Promise<Response> {
  const { environmentId } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const hasAccess = await hasUserEnvironmentAccess(session.user.id, environmentId);
  if (!hasAccess) {
    return new Response("Forbidden", { status: 403 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (eventType: string, data: unknown, id?: string) => {
        try {
          const eventId = id ?? uuidv7();
          const payload = `id: ${eventId}\n` + `event: ${eventType}\n` + `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Connection closed, ignore
        }
      };

      send("connected", { environmentId, timestamp: new Date().toISOString() });

      const unsubscribe = responseEventBus.subscribe(environmentId, (event: TResponseEvent) => {
        send(
          "response",
          {
            id: event.id,
            surveyId: event.surveyId,
            surveyName: event.surveyName,
            event: event.event,
            responseId: event.response.id,
            responseData: event.response.data,
            finished: event.response.finished,
            createdAt: event.response.createdAt,
          },
          event.id
        );
      });

      const heartbeatTimer = setInterval(() => {
        send("heartbeat", { timestamp: new Date().toISOString() });
      }, HEARTBEAT_INTERVAL_MS);

      request.signal.addEventListener("abort", () => {
        unsubscribe();
        clearInterval(heartbeatTimer);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
