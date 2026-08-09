'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  IconButton,
  Paper,
  Typography,
  CircularProgress,
} from '@mui/material';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useChat } from '../../hooks/useChat';
import { useIsCompact } from '../../hooks/useBreakpoints';

const Chat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const {
    messages,
    handleSendMessage,
    isLoading,
    isAwaitingFirstToken,
    cancel,
  } = useChat();
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const fullScreen = useIsCompact();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Keyed on the message count, not the array: streaming replaces the array on
  // every token, and a smooth scroll restarted per token cancels itself
  // hundreds of times over one reply.
  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const handleOpen = () => {
    setIsOpen(true);
  };

  // Closing the dialog stops the in-flight run rather than leaving the agent
  // and its tool calls going server-side.
  const handleClose = () => {
    cancel();
    setIsOpen(false);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleSendMessage(inputValue);
    setInputValue('');
  };

  return (
    <>
      {!isOpen && (
        <Fab
          color="primary"
          aria-label="Open chat"
          onClick={handleOpen}
          sx={{
            position: 'fixed',
            bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
            right: 24,
            zIndex: (t) => t.zIndex.speedDial,
          }}
        >
          <ChatBubbleOutlineRoundedIcon />
        </Fab>
      )}
      <Dialog
        open={isOpen}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        fullScreen={fullScreen}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: 1,
            borderColor: 'divider',
            py: 1.5,
          }}
        >
          Financial Assistant
          <IconButton
            onClick={handleClose}
            aria-label="Close chat"
            size="small"
            edge="end"
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            height: { xs: '100%', sm: '60vh' },
            p: 0,
            bgcolor: 'background.default',
          }}
        >
          <Box
            sx={{
              flexGrow: 1,
              overflowY: 'auto',
              p: 2,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {messages
              // While waiting on the first token the streaming bubble is still
              // empty; the spinner below stands in for it.
              .filter((msg) => msg.text.length > 0 || msg.sender === 'user')
              .map((msg, index) => (
                <Paper
                  key={index}
                  elevation={0}
                  data-testid="chat-message"
                  data-sender={msg.sender}
                  sx={{
                    p: 1.5,
                    mb: 1,
                    maxWidth: '80%',
                    alignSelf:
                      msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    color:
                      msg.sender === 'user'
                        ? 'primary.contrastText'
                        : 'text.primary',
                    bgcolor:
                      msg.sender === 'user'
                        ? 'primary.main'
                        : 'background.paper',
                    border: msg.sender === 'user' ? 'none' : 1,
                    borderColor: 'divider',
                    borderRadius: 2.5,
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {msg.text}
                  </Typography>
                </Paper>
              ))}
            {isAwaitingFirstToken && (
              <CircularProgress size={24} sx={{ alignSelf: 'center', my: 1 }} />
            )}
            <div ref={messagesEndRef} />
          </Box>
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: 1.5,
              borderTop: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              pb: {
                xs: 'calc(12px + env(safe-area-inset-bottom, 0px))',
                sm: 1.5,
              },
            }}
          >
            <TextField
              fullWidth
              placeholder="Ask about your transactions..."
              value={inputValue}
              onChange={handleInputChange}
              disabled={isLoading}
            />
            <IconButton
              type="submit"
              color="primary"
              disabled={isLoading || !inputValue.trim()}
              aria-label="Send message"
            >
              <SendRoundedIcon />
            </IconButton>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Chat;
