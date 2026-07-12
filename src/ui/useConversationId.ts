import { useEffect, useState } from 'react';
import { getConversationId, watchConversationId } from '@/src/lib/conversation';

export function useConversationId(): string | null {
  const [id, setId] = useState<string | null>(() => getConversationId());

  useEffect(() => watchConversationId(setId), []);

  return id;
}
