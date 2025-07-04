import api from './api';

import { Message } from '../hooks/useChat';

export const sendMessage = async (messages: Message[]): Promise<string> => {
  const response = await api.post('/api/chat', { messages });
  console.log(response);
  return response.data;
};

