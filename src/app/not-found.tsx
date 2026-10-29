import { EmojiIcon, StatusCard } from "@/components/status-card";

export default function NotFound() {
  return <StatusCard icon={<EmojiIcon>🔍</EmojiIcon>} title="Not found" subtitle="This link doesn't lead anywhere." />;
}
