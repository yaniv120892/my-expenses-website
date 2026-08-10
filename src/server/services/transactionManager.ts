import { TransactionType } from '@/shared/types/transaction';
import transactionService from '@/server/services/transactionService';
import logger from '@/server/logging/logger';
import { formatTransaction } from '@/server/utils/transactionUtils';
import prisma from '@/server/db/client';
import { deleteValue, getValue, setValue } from '@/server/redis';

export enum UserStatus {
  AWAITING_TYPE = 'AWAITING_TYPE',
  AWAITING_AMOUNT = 'AWAITING_AMOUNT',
  AWAITING_DESCRIPTION = 'AWAITING_DESCRIPTION',
  AWAITING_DATE = 'AWAITING_DATE',
  TRANSACTION_COMPLETE = 'TRANSACTION_COMPLETE',
  FAILURE = 'FAILURE',
}

type InProcessTransaction = {
  type?: TransactionType;
  value?: number;
  description?: string;
};

type UserState = {
  inProcessTransaction: InProcessTransaction;
  status: UserStatus;
};

type StateResponse = { message: string; nextStep: UserStatus };

const STATE_TTL_SECONDS = 1800;

const NOT_LINKED_MESSAGE =
  '❌ Your Telegram account is not linked to a user yet.\nPlease link it in the app settings first.';

function stateKey(chatId: string) {
  return `tg:conv:${chatId}`;
}

class TransactionManager {
  public async handleUserState(
    chatId: string,
    text: string,
  ): Promise<StateResponse> {
    logger.debug({ chatId, text }, 'Handling user state');
    const sanitizedText = text.replace('/', '').trim().toLowerCase();
    const currentState = await getValue<UserState>(stateKey(chatId));

    if (!currentState) {
      const userId = await this.resolveUserId(chatId);
      if (!userId) {
        return { message: NOT_LINKED_MESSAGE, nextStep: UserStatus.FAILURE };
      }
      await this.saveState(chatId, {
        inProcessTransaction: {},
        status: UserStatus.AWAITING_TYPE,
      });
      return {
        message: `Please select the transaction type
          1. /expense - to record an expense.
          2. /income - to record an income.`,
        nextStep: UserStatus.AWAITING_TYPE,
      };
    }

    const { inProcessTransaction, status } = currentState;
    let response;

    switch (status) {
      case UserStatus.AWAITING_TYPE: {
        response = await this.awaitingType(
          chatId,
          sanitizedText,
          inProcessTransaction,
        );
        break;
      }
      case UserStatus.AWAITING_AMOUNT: {
        response = await this.awaitingAmount(
          chatId,
          sanitizedText,
          inProcessTransaction,
        );
        break;
      }
      case UserStatus.AWAITING_DESCRIPTION: {
        response = await this.awaitingDescription(
          chatId,
          sanitizedText,
          inProcessTransaction,
        );
        break;
      }
      case UserStatus.AWAITING_DATE: {
        response = await this.awaitingDate(
          chatId,
          sanitizedText,
          inProcessTransaction,
        );
        break;
      }
      default: {
        response = { message: 'Invalid state', nextStep: UserStatus.FAILURE };
        break;
      }
    }

    logger.debug({ chatId }, 'User state handled');
    return response;
  }

  public async resetUserState(chatId: string): Promise<void> {
    await deleteValue(stateKey(chatId));
  }

  private async saveState(chatId: string, state: UserState): Promise<void> {
    await setValue(stateKey(chatId), state, STATE_TTL_SECONDS);
  }

  // The bot prompts for DD/MM/YYYY; new Date() would read it as MM/DD/YYYY.
  private parseDdMmYyyy(text: string): Date | null {
    const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) {
      return null;
    }
    const [, day, month, year] = match.map(Number);
    const date = new Date(year, month - 1, day);
    const valid =
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day;
    return valid ? date : null;
  }

  private async resolveUserId(chatId: string): Promise<string | null> {
    // chatId may be stored as a string or a number, so both forms are queried
    // instead of scanning every provider row.
    const numericChatId = Number(chatId);
    const match = await prisma.userNotificationProvider.findFirst({
      where: {
        provider: 'TELEGRAM',
        enabled: true,
        OR: [
          { data: { path: ['chatId'], equals: chatId } },
          ...(Number.isNaN(numericChatId)
            ? []
            : [{ data: { path: ['chatId'], equals: numericChatId } }]),
        ],
      },
    });
    return match?.userId ?? null;
  }

  private async awaitingType(
    chatId: string,
    sanitizedText: string,
    inProcessTransaction: InProcessTransaction,
  ): Promise<StateResponse> {
    if (sanitizedText === 'expense' || sanitizedText === 'income') {
      inProcessTransaction.type =
        sanitizedText.toUpperCase() as TransactionType;
      await this.saveState(chatId, {
        inProcessTransaction,
        status: UserStatus.AWAITING_AMOUNT,
      });
      return {
        message: 'Enter a valid number greater than 0.',
        nextStep: UserStatus.AWAITING_AMOUNT,
      };
    }

    return {
      message: `Invalid transaction type.
      Please select the transaction type
        1. /expense - to record an expense.
        2. /income - to record an income.`,
      nextStep: UserStatus.AWAITING_TYPE,
    };
  }

  private async awaitingAmount(
    chatId: string,
    sanitizedText: string,
    inProcessTransaction: InProcessTransaction,
  ): Promise<StateResponse> {
    if (!isNaN(Number(sanitizedText)) && Number(sanitizedText) > 0) {
      inProcessTransaction.value = Number(sanitizedText);
      await this.saveState(chatId, {
        inProcessTransaction,
        status: UserStatus.AWAITING_DESCRIPTION,
      });
      return {
        message: 'Enter the description:',
        nextStep: UserStatus.AWAITING_DESCRIPTION,
      };
    }

    return {
      message: `Invalid amount.
      Enter a valid number greater than 0.`,
      nextStep: UserStatus.AWAITING_AMOUNT,
    };
  }

  private async awaitingDescription(
    chatId: string,
    sanitizedText: string,
    inProcessTransaction: InProcessTransaction,
  ): Promise<StateResponse> {
    inProcessTransaction.description = sanitizedText;
    await this.saveState(chatId, {
      inProcessTransaction,
      status: UserStatus.AWAITING_DATE,
    });
    return {
      message: `Please specify the date for the transaction (DD/MM/YYYY).
        select /now for the current date.`,
      nextStep: UserStatus.AWAITING_DATE,
    };
  }

  private async awaitingDate(
    chatId: string,
    sanitizedText: string,
    inProcessTransaction: InProcessTransaction,
  ): Promise<StateResponse> {
    const userId = await this.resolveUserId(chatId);
    if (!userId) {
      await this.resetUserState(chatId);
      return { message: NOT_LINKED_MESSAGE, nextStep: UserStatus.FAILURE };
    }

    const date = ['now', 'today'].includes(sanitizedText)
      ? new Date()
      : this.parseDdMmYyyy(sanitizedText);
    if (!date) {
      return {
        message:
          'Invalid date. Please use DD/MM/YYYY, or /now for the current date.',
        nextStep: UserStatus.AWAITING_DATE,
      };
    }

    const createdResult = await transactionService.createTransaction({
      type: inProcessTransaction.type as TransactionType,
      value: inProcessTransaction.value as number,
      description: inProcessTransaction.description as string,
      categoryId: null,
      date,
      userId,
    });

    const transaction = await transactionService.getTransactionItem(
      createdResult.id,
      userId,
    );

    if (!transaction) {
      return {
        message: 'Transaction created, but failed to retrieve details.',
        nextStep: UserStatus.TRANSACTION_COMPLETE,
      };
    }

    const transactionMessage = `✅ *Transaction Created Successfully!* ✅
    📉 ${formatTransaction(transaction)}`;

    await this.resetUserState(chatId);
    return {
      message: transactionMessage,
      nextStep: UserStatus.TRANSACTION_COMPLETE,
    };
  }
}

export const transactionManager = new TransactionManager();
