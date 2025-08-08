import { createClient } from "@/lib/supabase/server";

export type QueueStatus = "queued" | "running" | "succeeded" | "failed";

export type CreateOrGetQueueJobResult = {
  id: string;
  status: QueueStatus;
  resultSlug?: string | null;
  wasCreated: boolean;
};

export async function createOrGetQueueJob(params: {
  sourceSlug: string;
  targetSlug: string;
}): Promise<CreateOrGetQueueJobResult> {
  const supabase = await createClient();

  // First, check for existing job to avoid duplicate work
  const { data: existing } = await supabase
    .from("creation_queue")
    .select("id, status, result_slug")
    .eq("source_slug", params.sourceSlug)
    .eq("target_slug", params.targetSlug)
    .maybeSingle();

  if (existing) {
    return {
      id: existing.id as string,
      status: existing.status as QueueStatus,
      resultSlug: (existing as any).result_slug as string | null,
      wasCreated: false,
    };
  }

  // Create a new job row
  const { data: inserted, error: insertError } = await supabase
    .from("creation_queue")
    .insert({
      source_slug: params.sourceSlug,
      target_slug: params.targetSlug,
      status: "queued",
    })
    .select("id, status")
    .single();

  if (insertError || !inserted) {
    throw new Error(`Failed to insert queue job: ${insertError?.message}`);
  }

  return {
    id: inserted.id as string,
    status: inserted.status as QueueStatus,
    resultSlug: null,
    wasCreated: true,
  };
}

export async function updateQueueStatus(
  queueId: string,
  status: QueueStatus,
  extras?: {
    resultSlug?: string;
    errorMessage?: string;
    started?: boolean;
    finished?: boolean;
  }
): Promise<void> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = { status };
  if (extras?.resultSlug) patch.result_slug = extras.resultSlug;
  if (extras?.errorMessage) patch.error_message = extras.errorMessage;
  if (extras?.started) patch.started_at = new Date().toISOString();
  if (extras?.finished) patch.finished_at = new Date().toISOString();

  const { error } = await supabase
    .from("creation_queue")
    .update(patch)
    .eq("id", queueId);

  if (error) {
    console.error("Failed to update queue status", queueId, error);
  }
}

export async function appendCreationLog(params: {
  queueId: string;
  level?: "info" | "warn" | "error";
  phase?: string;
  toolName?: string;
  message?: string;
  argsSnip?: string;
  resultSnip?: string;
  meta?: Record<string, unknown>;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("creation_logs").insert({
    queue_id: params.queueId,
    level: params.level || "info",
    phase: params.phase,
    tool_name: params.toolName,
    message: params.message,
    args_snip: params.argsSnip,
    result_snip: params.resultSnip,
    meta: params.meta || null,
  });

  if (error) {
    console.error("Failed to append creation log", params.queueId, error);
  }
}
