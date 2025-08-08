import { QueueProgress } from "@/components/queue-progress";

interface QueuePageProps {
  params: Promise<{ id: string }>;
}

export default async function QueuePage({ params }: QueuePageProps) {
  const { id } = await params;
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        <QueueProgress queueId={id} />
      </div>
    </div>
  );
}
