import type { Dictionary, Messages } from '@yaniv120892/my-ui';

const en = {
  'settings.title': 'Settings',
  'settings.loadFailed': 'Failed to load settings',
  'settings.saveFailed': 'Failed to save settings',
  'settings.saved': 'Settings saved successfully',
  'settings.copyLabel': 'Copy {label}',

  'settings.appearance.title': 'Appearance',
  'settings.appearance.mode': 'Theme mode',
  'settings.appearance.light': 'Light',
  'settings.appearance.system': 'System',
  'settings.appearance.dark': 'Dark',

  'settings.account.title': 'Account',
  'settings.account.email': 'Email',

  'settings.notifications.title': 'Notifications',
  'settings.notifications.createTransaction':
    'Notify on new transaction creation',
  'settings.notifications.dailySummary': 'Daily summary notification',
  'settings.notifications.subscriptionAudit': 'Monthly subscription audit',
  'settings.notifications.monthlyReport': 'Monthly report by email',
  'settings.notifications.sendNow': 'Send now',
  'settings.notifications.sendNowHint':
    '"Send now" emails you last month\'s report immediately, so you can check it works without waiting for the 1st.',
  'settings.notifications.testReportFailed': 'Failed to send the test report',
  'settings.notifications.testReportSent':
    '{month} report sent to {recipient}.',
  'settings.notifications.testReportSentEmpty':
    '{month} report sent to {recipient}. That month had no transactions, so the scheduled monthly email would have skipped it.',
  'settings.notifications.testReportNotBuilt':
    'Could not build the report for your account.',

  'settings.telegram.title': 'Telegram',
  'settings.telegram.linked': 'Linked',
  'settings.telegram.notLinked': 'Not linked',
  'settings.telegram.test': 'Test',
  'settings.telegram.testSent': 'Test message sent successfully',
  'settings.telegram.testFailed': 'Failed to test Telegram connection',
  'settings.telegram.link': 'Link Telegram',
  'settings.telegram.relink': 'Link a different chat',
  'settings.telegram.unlink': 'Unlink',
  'settings.telegram.unlinked': 'Telegram unlinked',
  'settings.telegram.unlinkFailed': 'Failed to unlink Telegram',
  'settings.telegram.createCodeFailed': 'Failed to create a link code',
  'settings.telegram.done': 'Done',
  'settings.telegram.codeExpired':
    'This code has expired. Create a new one to link a chat.',
  'settings.telegram.instructions':
    'Send this message to the My Expenses bot from the chat that should receive notifications. The code works once and expires in {minutes} minutes.',
  'settings.telegram.command': 'Telegram link command',
  'settings.telegram.open': 'Open in Telegram',
  'settings.telegram.waiting': 'Waiting for the bot to receive it…',

  'settings.agent.title': 'Personal agent',
  'settings.agent.intro':
    'Connect your personal agent to My Expenses so it can record expenses and income, fix and delete them, and answer questions about your spending — for example from a Telegram voice message. The agent gets its own access, which you can revoke here at any time, and it lasts a year.',
  'settings.agent.name': 'Agent name',
  'settings.agent.create': 'Give the agent access',
  'settings.agent.createFailed': 'Failed to create the access',
  'settings.agent.copyTokenNow':
    "Copy the token now — it won't be shown again. It is already included in the message to the agent below.",
  'settings.agent.token': 'Token',
  'settings.agent.mcpUrl': 'MCP URL',
  'settings.agent.briefingTitle': 'Message to the agent',
  'settings.agent.briefingHint':
    'Send the agent this message as is. It is in English because agents follow English instructions most precisely.',
  'settings.agent.briefing': 'Briefing',
  'settings.agent.examplesTitle': 'Example requests',
  'settings.agent.exampleQuote': '“{request}”',
  'settings.agent.example.coffee': 'Log an 18 shekel expense for coffee',
  'settings.agent.example.netflix': 'I paid 25 dollars for Netflix',
  'settings.agent.example.food': 'How much did I spend on food this month?',
  'settings.agent.example.compare':
    "Compare this month's spending with last month",
  'settings.agent.example.recurring': 'What are my recurring charges?',
  'settings.agent.example.delete': "Delete yesterday's taxi expense",
  'settings.agent.revokeFailed': 'Failed to remove the access',
  'settings.agent.loadFailed': 'Failed to load the accesses',
  'settings.agent.activeTitle': 'Active accesses',
  'settings.agent.remove': 'Remove access',
  'settings.agent.removeFor': 'Remove access for {name}',
  'settings.agent.lastUsed': 'Last used {date}',
  'settings.agent.neverUsed': 'Not used yet',
  'settings.agent.expired': 'Expired',
  'settings.agent.validUntil': 'Valid until {date}',
  'settings.agent.revokeTitle': 'Remove the access of “{name}”?',
  'settings.agent.revokeConsequence':
    'The agent will stop reaching My Expenses immediately. This cannot be undone.',

  'settings.tokens.title': 'API tokens',
  'settings.tokens.intro':
    'A token lets a script such as {command} call the API without a browser session. It can do only what its scopes allow, lasts a year, and can be revoked here at any time.',
  'settings.tokens.name': 'Token name',
  'settings.tokens.namePlaceholder': 'e.g. MacBook statements script',
  'settings.tokens.create': 'Create',
  'settings.tokens.scope.IMPORTS': 'Imports',
  'settings.tokens.scope.IMPORTS.description':
    'Upload statements, preview and approve imports',
  'settings.tokens.scope.AGENT': 'Personal agent',
  'settings.tokens.scope.AGENT.description':
    'Read, add, edit and delete transactions over MCP',
  'settings.tokens.scopeOption': '{label} — {description}',
  'settings.tokens.copyNow':
    'Copy this token now — it will not be shown again.',
  'settings.tokens.createFailed': 'Failed to create the token',
  'settings.tokens.revokeFailed': 'Failed to revoke the token',
  'settings.tokens.loadFailed': 'Failed to load API tokens',
  'settings.tokens.column.name': 'Name',
  'settings.tokens.column.scopes': 'Scopes',
  'settings.tokens.column.created': 'Created',
  'settings.tokens.column.lastUsed': 'Last used',
  'settings.tokens.column.expires': 'Expires',
  'settings.tokens.never': 'Never',
  'settings.tokens.expired': 'Expired',
  'settings.tokens.revoke': 'Revoke',
  'settings.tokens.revokeFor': 'Revoke {name}',
  'settings.tokens.revokeTitle': 'Revoke “{name}”?',
  'settings.tokens.revokeConsequence':
    'Any script using this token stops working immediately. This cannot be undone.',

  'settings.rules.title': 'Auto-approve rules',
  'settings.rules.add': 'Add rule',
  'settings.rules.empty':
    'No auto-approve rules yet. Create one to automatically approve matching imported transactions.',
  'settings.rules.column.pattern': 'Pattern',
  'settings.rules.column.active': 'Active',
  'settings.rules.column.actions': 'Actions',
  'settings.rules.editTitle': 'Edit rule',
  'settings.rules.createTitle': 'Create auto-approve rule',
  'settings.rules.pattern': 'Description pattern',
  'settings.rules.patternPlaceholder':
    'e.g. "Wolt" matches "Wolt delivery", "WOLT*123"',
  'settings.rules.update': 'Update',
  'settings.rules.create': 'Create',
  'settings.rules.editFor': 'Edit the rule for {pattern}',
  'settings.rules.deleteFor': 'Delete the rule for {pattern}',
  'settings.rules.toggleFor': 'Turn the rule for {pattern} on or off',
} satisfies Messages;

export const settingsMessages: Dictionary<typeof en> = {
  en,
  he: {
    'settings.title': 'הגדרות',
    'settings.loadFailed': 'טעינת ההגדרות נכשלה',
    'settings.saveFailed': 'שמירת ההגדרות נכשלה',
    'settings.saved': 'ההגדרות נשמרו',
    'settings.copyLabel': 'העתקת {label}',

    'settings.appearance.title': 'מראה',
    'settings.appearance.mode': 'ערכת צבעים',
    'settings.appearance.light': 'בהיר',
    'settings.appearance.system': 'לפי המערכת',
    'settings.appearance.dark': 'כהה',

    'settings.account.title': 'חשבון',
    'settings.account.email': 'אימייל',

    'settings.notifications.title': 'התראות',
    'settings.notifications.createTransaction': 'התראה על כל תנועה חדשה',
    'settings.notifications.dailySummary': 'סיכום יומי',
    'settings.notifications.subscriptionAudit': 'בדיקה חודשית של המינויים',
    'settings.notifications.monthlyReport': 'דוח חודשי במייל',
    'settings.notifications.sendNow': 'שליחה עכשיו',
    'settings.notifications.sendNowHint':
      '"שליחה עכשיו" שולחת לכם מיד את הדוח של החודש הקודם, כדי לבדוק שהכול עובד בלי לחכות לראשון לחודש.',
    'settings.notifications.testReportFailed': 'שליחת דוח הבדיקה נכשלה',
    'settings.notifications.testReportSent':
      'הדוח של {month} נשלח אל {recipient}.',
    'settings.notifications.testReportSentEmpty':
      'הדוח של {month} נשלח אל {recipient}. לא היו תנועות בחודש הזה, ולכן המייל החודשי המתוזמן היה מדלג עליו.',
    'settings.notifications.testReportNotBuilt':
      'לא הצלחנו להפיק את הדוח לחשבון שלך.',

    'settings.telegram.title': 'טלגרם',
    'settings.telegram.linked': 'מחובר',
    'settings.telegram.notLinked': 'לא מחובר',
    'settings.telegram.test': 'בדיקה',
    'settings.telegram.testSent': 'הודעת הבדיקה נשלחה',
    'settings.telegram.testFailed': 'בדיקת החיבור לטלגרם נכשלה',
    'settings.telegram.link': 'חיבור טלגרם',
    'settings.telegram.relink': 'חיבור לצ׳אט אחר',
    'settings.telegram.unlink': 'ניתוק',
    'settings.telegram.unlinked': 'טלגרם נותק',
    'settings.telegram.unlinkFailed': 'ניתוק טלגרם נכשל',
    'settings.telegram.createCodeFailed': 'יצירת קוד החיבור נכשלה',
    'settings.telegram.done': 'סיום',
    'settings.telegram.codeExpired': 'תוקף הקוד פג. צרו קוד חדש כדי לחבר צ׳אט.',
    'settings.telegram.instructions':
      'שלחו את ההודעה הזו לבוט של ההוצאות שלי מהצ׳אט שאמור לקבל את ההתראות. הקוד עובד פעם אחת ופג תוקפו בעוד {minutes} דקות.',
    'settings.telegram.command': 'פקודת החיבור לטלגרם',
    'settings.telegram.open': 'פתיחה בטלגרם',
    'settings.telegram.waiting': 'ממתין שהבוט יקבל את ההודעה…',

    'settings.agent.title': 'סוכן אישי',
    'settings.agent.intro':
      'חברו את הסוכן האישי שלכם ל-My Expenses, כדי שיוכל לרשום הוצאות והכנסות, לתקן ולמחוק אותן ולענות על שאלות על ההוצאות — למשל מהודעה קולית בטלגרם. הסוכן מקבל גישה משלו, שאפשר לבטל כאן בכל רגע, והיא תקפה לשנה.',
    'settings.agent.name': 'שם הסוכן',
    'settings.agent.create': 'יצירת גישה לסוכן',
    'settings.agent.createFailed': 'יצירת הגישה נכשלה',
    'settings.agent.copyTokenNow':
      'העתיקו את הטוקן עכשיו — הוא לא יוצג שוב. הוא כבר משולב בהודעה לסוכן שלמטה.',
    'settings.agent.token': 'טוקן',
    'settings.agent.mcpUrl': 'כתובת MCP',
    'settings.agent.briefingTitle': 'ההודעה לסוכן',
    'settings.agent.briefingHint':
      'שלחו לסוכן את ההודעה הזו כמו שהיא. היא באנגלית כי סוכנים עוקבים אחרי הוראות באנגלית בצורה הכי מדויקת.',
    'settings.agent.briefing': 'הודעה לסוכן',
    'settings.agent.examplesTitle': 'דוגמאות לבקשות',
    'settings.agent.exampleQuote': '״{request}״',
    'settings.agent.example.coffee': 'תרשום הוצאה של 18 ש״ח על קפה',
    'settings.agent.example.netflix': 'שילמתי 25 דולר על נטפליקס',
    'settings.agent.example.food': 'כמה הוצאתי על אוכל החודש?',
    'settings.agent.example.compare': 'תשווה את ההוצאות של החודש לחודש שעבר',
    'settings.agent.example.recurring': 'מה החיובים הקבועים שלי?',
    'settings.agent.example.delete': 'תמחק את ההוצאה על המונית מאתמול',
    'settings.agent.revokeFailed': 'ביטול הגישה נכשל',
    'settings.agent.loadFailed': 'טעינת הגישות נכשלה',
    'settings.agent.activeTitle': 'גישות פעילות',
    'settings.agent.remove': 'ביטול הגישה',
    'settings.agent.removeFor': 'ביטול הגישה של {name}',
    'settings.agent.lastUsed': 'שימוש אחרון {date}',
    'settings.agent.neverUsed': 'עדיין לא בשימוש',
    'settings.agent.expired': 'פג תוקף',
    'settings.agent.validUntil': 'בתוקף עד {date}',
    'settings.agent.revokeTitle': 'לבטל את הגישה של ״{name}״?',
    'settings.agent.revokeConsequence':
      'הסוכן יפסיק לגשת ל-My Expenses מיד. אי אפשר לבטל את הפעולה.',

    'settings.tokens.title': 'טוקנים ל-API',
    'settings.tokens.intro':
      'טוקן מאפשר לסקריפט, כמו {command}, לקרוא ל-API בלי חיבור מהדפדפן. הוא יכול לעשות רק מה שההרשאות שלו מתירות, תקף לשנה, ואפשר לבטל אותו כאן בכל רגע.',
    'settings.tokens.name': 'שם הטוקן',
    'settings.tokens.namePlaceholder': 'למשל: סקריפט הפירוטים במחשב הנייד',
    'settings.tokens.create': 'יצירה',
    'settings.tokens.scope.IMPORTS': 'ייבוא',
    'settings.tokens.scope.IMPORTS.description':
      'העלאת פירוטי חיובים, תצוגה מקדימה ואישור של ייבוא',
    'settings.tokens.scope.AGENT': 'סוכן אישי',
    'settings.tokens.scope.AGENT.description':
      'קריאה, הוספה, עריכה ומחיקה של תנועות דרך MCP',
    'settings.tokens.scopeOption': '{label} — {description}',
    'settings.tokens.copyNow': 'העתיקו את הטוקן עכשיו — הוא לא יוצג שוב.',
    'settings.tokens.createFailed': 'יצירת הטוקן נכשלה',
    'settings.tokens.revokeFailed': 'ביטול הטוקן נכשל',
    'settings.tokens.loadFailed': 'טעינת הטוקנים נכשלה',
    'settings.tokens.column.name': 'שם',
    'settings.tokens.column.scopes': 'הרשאות',
    'settings.tokens.column.created': 'נוצר',
    'settings.tokens.column.lastUsed': 'שימוש אחרון',
    'settings.tokens.column.expires': 'תוקף',
    'settings.tokens.never': 'אף פעם',
    'settings.tokens.expired': 'פג תוקף',
    'settings.tokens.revoke': 'ביטול',
    'settings.tokens.revokeFor': 'ביטול {name}',
    'settings.tokens.revokeTitle': 'לבטל את ״{name}״?',
    'settings.tokens.revokeConsequence':
      'כל סקריפט שמשתמש בטוקן הזה יפסיק לעבוד מיד. אי אפשר לבטל את הפעולה.',

    'settings.rules.title': 'כללי אישור אוטומטי',
    'settings.rules.add': 'הוספת כלל',
    'settings.rules.empty':
      'עדיין אין כללי אישור אוטומטי. צרו כלל כדי לאשר אוטומטית תנועות מיובאות שמתאימות לו.',
    'settings.rules.column.pattern': 'תבנית',
    'settings.rules.column.active': 'פעיל',
    'settings.rules.column.actions': 'פעולות',
    'settings.rules.editTitle': 'עריכת כלל',
    'settings.rules.createTitle': 'כלל אישור אוטומטי חדש',
    'settings.rules.pattern': 'תבנית תיאור',
    'settings.rules.patternPlaceholder':
      'למשל "Wolt" יתאים ל-"Wolt delivery" ול-"WOLT*123"',
    'settings.rules.update': 'עדכון',
    'settings.rules.create': 'יצירה',
    'settings.rules.editFor': 'עריכת הכלל עבור {pattern}',
    'settings.rules.deleteFor': 'מחיקת הכלל עבור {pattern}',
    'settings.rules.toggleFor': 'הפעלה או השבתה של הכלל עבור {pattern}',
  },
};
