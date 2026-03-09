import { MeetingRoom } from '@/components/meetings/MeetingRoom';
import { MeetingRulesGuard } from '@/components/meetings/MeetingRulesGuard';

export default function MeetingRoomPage() {
  return (
    <MeetingRulesGuard>
      <MeetingRoom />
    </MeetingRulesGuard>
  );
}