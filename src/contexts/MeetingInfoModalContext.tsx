import { createContext, useContext, useState, ReactNode } from 'react';
import { MeetingInfoModal } from '@/components/MeetingInfoModal';

interface MeetingInfoModalContextType {
  showMeetingInfo: (meetingId: string, meetingCode: string) => void;
}

const MeetingInfoModalContext = createContext<MeetingInfoModalContextType | null>(null);

export function useMeetingInfoModal() {
  const context = useContext(MeetingInfoModalContext);
  if (!context) {
    throw new Error('useMeetingInfoModal must be used within MeetingInfoModalProvider');
  }
  return context;
}

export function MeetingInfoModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [meetingId, setMeetingId] = useState('');
  const [meetingCode, setMeetingCode] = useState('');

  const showMeetingInfo = (id: string, code: string) => {
    setMeetingId(id);
    setMeetingCode(code);
    setOpen(true);
  };

  return (
    <MeetingInfoModalContext.Provider value={{ showMeetingInfo }}>
      {children}
      <MeetingInfoModal
        open={open}
        onClose={() => setOpen(false)}
        meetingId={meetingId}
        meetingCode={meetingCode}
      />
    </MeetingInfoModalContext.Provider>
  );
}
