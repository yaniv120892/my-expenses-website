import type { Dictionary, Messages } from '@yaniv120892/my-ui';

const en = {
  'household.title': 'Share household',
  'household.intro':
    'Everyone in your household sees and works on the same transactions, imports and schedules.',
  'household.loadFailed': 'Failed to load your household',
  'household.role.OWNER': 'Owner',
  'household.role.EDITOR': 'Editor',
  'household.role.VIEWER': 'Viewer',
  'household.roleHint.EDITOR': 'Can view and change everything',
  'household.roleHint.VIEWER': 'Can view, but not change anything',
  'household.you': 'you',
  'household.members': 'Members',
  'household.memberRole': 'Role of {name}',
  'household.remove': 'Remove',
  'household.removeConfirm':
    "Remove {name} from your household? They are signed out everywhere, lose access to this household's data, and any agent or API access they set up stops working. They keep their login and start again with an empty household of their own.",
  'household.removeFailed': 'Failed to remove the member',
  'household.roleChangeFailed': 'Failed to change the role',
  'household.invite.title': 'Invite someone',
  'household.invite.role': 'They join as',
  'household.invite.create': 'Create invite link',
  'household.invite.createFailed': 'Failed to create the invite',
  'household.invite.link': 'Invite link',
  'household.invite.linkHint':
    'Send this link to the person you are inviting. It works once and expires on {date}.',
  'household.invite.pending': 'Pending invites',
  'household.invite.expires': 'Expires {date}',
  'household.invite.revoke': 'Revoke invite',
  'household.invite.revokeConfirm':
    'Revoke this invite? The link stops working, and no one can join with it.',
  'household.invite.copyLink': 'Copy link',
  'household.invite.revokeFailed': 'Failed to revoke the invite',
  'household.memberOf': "You are a member of {owner}'s household, as {role}.",
  'household.leave': 'Leave household',
  'household.leaveConfirm':
    'Leave this household? You lose access to its data, and any agent or API access you set up stops working. You start again with an empty household of your own.',
  'household.leaveFailed': 'Failed to leave the household',
  'household.error.INVITE_INVALID':
    'This invite link is not valid. It may have expired or been used.',
  'household.error.INVITE_TAKEN':
    'Someone else used this invite a moment ago. Ask for a new invite link.',
  'household.error.INVITE_NOT_FOUND': 'This invite is no longer pending.',
  'household.error.HOUSEHOLD_IN_USE':
    'You already have data or other members in your own household, so you cannot join another one.',
  'household.error.NOT_HOUSEHOLD_OWNER':
    'Only the owner of this household can manage its members and invites.',
  'household.error.OWNER_CANNOT_LEAVE': 'As the owner, you cannot leave this household.',
  'household.error.OWNER_OWN_MEMBERSHIP': 'As the owner, you cannot change your own membership.',
  'household.error.MEMBER_NOT_FOUND': 'This person is no longer a member of the household.',

  'join.title': 'Join a household',
  'join.checking': 'Checking the invite…',
  'join.invalid': 'This invite link is not valid. It may have expired or been used.',
  'join.missingCode': 'This link has no invite code. Ask for a new invite link.',
  'join.offer': "Join {owner}'s household as {role}.",
  'join.submit': 'Join',
  'join.submitting': 'Joining…',
  'join.failed': 'Failed to join the household',
  'join.alreadyMember': "You are already a member of {owner}'s household.",
  'join.householdInUse':
    'You already have data or other members in your own household, so you cannot join another one.',
  'join.toDashboard': 'Go to the dashboard',
} satisfies Messages;

export const householdMessages: Dictionary<typeof en> = {
  en,
  he: {
    'household.title': 'שיתוף משק בית',
    'household.intro': 'כל חברי משק הבית רואים ועובדים על אותן עסקאות, ייבואים ותשלומים קבועים.',
    'household.loadFailed': 'טעינת משק הבית נכשלה',
    'household.role.OWNER': 'בעלים',
    'household.role.EDITOR': 'עורך',
    'household.role.VIEWER': 'צופה',
    'household.roleHint.EDITOR': 'יכול לצפות ולשנות הכול',
    'household.roleHint.VIEWER': 'יכול לצפות, אבל לא לשנות',
    'household.you': 'את/ה',
    'household.members': 'חברים',
    'household.memberRole': 'התפקיד של {name}',
    'household.remove': 'הסרה',
    'household.removeConfirm':
      'להסיר את {name} ממשק הבית? הם ינותקו מכל המכשירים, הגישה שלהם לנתוני משק הבית תיחסם, וכל גישה של סוכן או API שהגדירו תפסיק לעבוד. החשבון שלהם נשאר, והם יתחילו מחדש עם משק בית ריק משלהם.',
    'household.removeFailed': 'הסרת החבר נכשלה',
    'household.roleChangeFailed': 'שינוי התפקיד נכשל',
    'household.invite.title': 'הזמנת חבר',
    'household.invite.role': 'מצטרף/ת בתור',
    'household.invite.create': 'יצירת קישור הזמנה',
    'household.invite.createFailed': 'יצירת ההזמנה נכשלה',
    'household.invite.link': 'קישור הזמנה',
    'household.invite.linkHint':
      'שלחו את הקישור לאדם שאתם מזמינים. הוא עובד פעם אחת ותוקפו עד {date}.',
    'household.invite.pending': 'הזמנות ממתינות',
    'household.invite.expires': 'בתוקף עד {date}',
    'household.invite.revoke': 'ביטול ההזמנה',
    'household.invite.revokeConfirm':
      'לבטל את ההזמנה? הקישור יפסיק לעבוד, ואי אפשר יהיה להצטרף דרכו.',
    'household.invite.copyLink': 'העתקת קישור',
    'household.invite.revokeFailed': 'ביטול ההזמנה נכשל',
    'household.memberOf': 'את/ה חבר/ה במשק הבית של {owner}, בתור {role}.',
    'household.leave': 'עזיבת משק הבית',
    'household.leaveConfirm':
      'לעזוב את משק הבית? הגישה לנתונים שלו תיחסם, וכל גישה של סוכן או API שהגדרתם תפסיק לעבוד. תתחילו מחדש עם משק בית ריק משלכם.',
    'household.leaveFailed': 'עזיבת משק הבית נכשלה',
    'household.error.INVITE_INVALID':
      'קישור ההזמנה אינו תקף. ייתכן שפג תוקפו או שכבר נעשה בו שימוש.',
    'household.error.INVITE_TAKEN': 'מישהו אחר השתמש בהזמנה הזו לפני רגע. בקשו קישור הזמנה חדש.',
    'household.error.INVITE_NOT_FOUND': 'ההזמנה הזו כבר אינה ממתינה.',
    'household.error.HOUSEHOLD_IN_USE':
      'במשק הבית שלכם כבר יש נתונים או חברים נוספים, ולכן אי אפשר להצטרף למשק בית אחר.',
    'household.error.NOT_HOUSEHOLD_OWNER': 'רק הבעלים של משק הבית יכולים לנהל את החברים וההזמנות.',
    'household.error.OWNER_CANNOT_LEAVE': 'כבעלים, אי אפשר לעזוב את משק הבית.',
    'household.error.OWNER_OWN_MEMBERSHIP': 'כבעלים, אי אפשר לשנות את החברות שלך במשק הבית.',
    'household.error.MEMBER_NOT_FOUND': 'האדם הזה כבר אינו חבר במשק הבית.',

    'join.title': 'הצטרפות למשק בית',
    'join.checking': 'בודקים את ההזמנה…',
    'join.invalid': 'קישור ההזמנה אינו תקף. ייתכן שפג תוקפו או שכבר נעשה בו שימוש.',
    'join.missingCode': 'בקישור הזה אין קוד הזמנה. בקשו קישור הזמנה חדש.',
    'join.offer': 'הצטרפות למשק הבית של {owner} בתור {role}.',
    'join.submit': 'הצטרפות',
    'join.submitting': 'מצטרפים…',
    'join.failed': 'ההצטרפות למשק הבית נכשלה',
    'join.alreadyMember': 'את/ה כבר חבר/ה במשק הבית של {owner}.',
    'join.householdInUse':
      'במשק הבית שלכם כבר יש נתונים או חברים נוספים, ולכן אי אפשר להצטרף למשק בית אחר.',
    'join.toDashboard': 'למסך הראשי',
  },
};
