import type { Dictionary, Messages } from '@yaniv120892/my-ui';

const en = {
  'chat.open': 'Open chat',
  'chat.title': 'Financial Assistant',
  'chat.close': 'Close chat',
  'chat.placeholder': 'Ask about your transactions...',
  'chat.inputLabel': 'Message the assistant',
  'chat.send': 'Send message',
  'chat.emptyState':
    'Ask about your spending — I can summarize, compare periods, and spot trends.',
  'chat.prompt.lastMonth': 'How much did I spend last month?',
  'chat.prompt.topCategories':
    'What are my top spending categories this month?',
  'chat.prompt.compareMonths': 'Compare this month to last month',
  'chat.prompt.largest': 'Show my largest transactions this month',
  'chat.error.emptyReply':
    "Sorry, I wasn't able to produce an answer. Please try again.",
  'chat.error.failed': 'Sorry, I encountered an error: {error}',
  'chat.error.unknown': 'An unknown error occurred',
} satisfies Messages;

export const chatMessages: Dictionary<typeof en> = {
  en,
  he: {
    'chat.open': 'פתיחת הצ׳אט',
    'chat.title': 'העוזר הפיננסי',
    'chat.close': 'סגירת הצ׳אט',
    'chat.placeholder': 'שאלו על התנועות שלכם...',
    'chat.inputLabel': 'הודעה לעוזר',
    'chat.send': 'שליחת ההודעה',
    'chat.emptyState':
      'שאלו אותי על ההוצאות שלכם — אני יכול לסכם, להשוות בין תקופות ולזהות מגמות.',
    'chat.prompt.lastMonth': 'כמה הוצאתי בחודש שעבר?',
    'chat.prompt.topCategories': 'על מה הוצאתי הכי הרבה החודש?',
    'chat.prompt.compareMonths': 'תשווה את החודש הזה לחודש שעבר',
    'chat.prompt.largest': 'מה ההוצאות הגדולות שלי החודש?',
    'chat.error.emptyReply': 'מצטער, לא הצלחתי לנסח תשובה. נסו שוב.',
    'chat.error.failed': 'מצטער, משהו השתבש: {error}',
    'chat.error.unknown': 'אירעה שגיאה לא ידועה',
  },
};
