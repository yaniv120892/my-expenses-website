import api from './api';

export const sendMessage = async (message: string): Promise<string> => {
  const response = await api.post('/api/chat', { message });
  console.log(response);
  return response.data;
};

