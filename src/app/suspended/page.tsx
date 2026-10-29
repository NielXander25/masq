import { EmojiIcon, StatusCard } from "@/components/status-card";

export default function SuspendedPage() {
  return (
    <StatusCard
      icon={<EmojiIcon>⛔️</EmojiIcon>}
      title="Account suspended"
      subtitle="This account can't use masqq. If you think this is a mistake, contact support."
      home={false}
    />
  );
}
