import { userHandler } from '@/server/commandHandlers/userHandler';
import { transactionHandler } from '@/server/commandHandlers/transactionHandler';
import { insightsHandler } from '@/server/commandHandlers/insightHandler';
import { categoryHandler } from '@/server/commandHandlers/categoryHandler';

class CommandHandler {
  async executeCommand(command: string, chatId: string, args: string[]) {
    switch (command) {
      case '/start':
        return userHandler.handleStart(chatId);
      case '/help':
        return userHandler.handleHelp(chatId);
      case '/reset':
        await userHandler.handleReset(chatId);
        return userHandler.handleHelp(chatId);
      case '/list':
        await transactionHandler.handleList(
          chatId,
          this.extractUserIdFromCommand(args),
        );
        return userHandler.handleHelp(chatId);
      case '/create':
        return transactionHandler.handleCreate(chatId);
      case '/summary':
        await transactionHandler.handleSummary(
          chatId,
          this.extractUserIdFromCommand(args),
        );
        return userHandler.handleHelp(chatId);
      case '/search':
        await transactionHandler.handleSearch(
          chatId,
          this.extractUserIdFromCommand(args),
          args.slice(2).join(' '),
        );
        return userHandler.handleHelp(chatId);
      case '/insights':
        await insightsHandler.handleInsights(
          chatId,
          this.extractUserIdFromCommand(args),
        );
        return userHandler.handleHelp(chatId);
      case '/categories':
        await categoryHandler.handleList(chatId);
        return userHandler.handleHelp(chatId);
      default:
        return userHandler.handleUserState(chatId, command);
    }
  }

  private extractUserIdFromCommand(args: string[]) {
    if (args.length <= 1) {
      return null;
    }

    return args[1];
  }
}

export const commandHandler = new CommandHandler();
