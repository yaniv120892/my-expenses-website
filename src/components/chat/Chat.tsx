import React, { useState, useRef, useEffect } from 'react';
import { Box, Fab, Dialog, DialogTitle, DialogContent, TextField, IconButton, Paper, Typography, CircularProgress, Tooltip, tooltipClasses } from '@mui/material';
import { Send as SendIcon, Chat as ChatIcon } from '@mui/icons-material';
import { useChat } from '../../hooks/useChat';
import { styled, keyframes } from '@mui/material/styles';

const TOOLTIP_SEEN_KEY = 'chatTooltipSeen';

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(156, 39, 176, 0.7); }
  70% { box-shadow: 0 0 0 10px rgba(156, 39, 176, 0); }
  100% { box-shadow: 0 0 0 0 rgba(156, 39, 176, 0); }
`;


import { forwardRef } from 'react';
import type { TooltipProps } from '@mui/material/Tooltip';

const AnimatedTooltip = styled(forwardRef<HTMLDivElement, TooltipProps>(
  function AnimatedTooltip(props, ref) {
    const { className, ...other } = props;
    return <Tooltip ref={ref} {...other} classes={{ popper: className }} />;
  }
))(({  }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    backgroundColor: '#8e24aa',
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    padding: '12px 20px',
    borderRadius: 8,
    boxShadow: '0 2px 12px 0 rgba(156,39,176,0.3)',
    animation: `${pulse} 1.5s infinite cubic-bezier(0.66, 0, 0, 1)`
  },
  [`& .${tooltipClasses.arrow}`]: {
    color: '#8e24aa',
  },
}));

const Chat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined' && !localStorage.getItem(TOOLTIP_SEEN_KEY)) {
      setShowTooltip(true);
    }
  }, []);
  const [inputValue, setInputValue] = useState('');
  const { messages, handleSendMessage, isLoading } = useChat();
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleOpen = () => {
    setIsOpen(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOOLTIP_SEEN_KEY, 'true');
    }
    setShowTooltip(false);
  };

  const handleClose = () => setIsOpen(false);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleSendMessage(inputValue);
    setInputValue('');
  };

  if (!isMounted) {
    return null;
  }

  return (
    <>
      <AnimatedTooltip
        title={<span>✨ <b>New!</b> Try our AI Assistant</span>}
        open={showTooltip}
        arrow
        placement="left"
        disableFocusListener
        disableHoverListener
        disableTouchListener
      >
        <Fab
          color="secondary"
          aria-label="chat"
          onClick={handleOpen}
          sx={{
            position: "fixed",
            bottom: 96,
            right: 32,
            display: "flex",
            flexDirection: "row",
            gap: 2,
            zIndex: 2000,
          }}
        >
          <ChatIcon />
        </Fab>
      </AnimatedTooltip>
      <Dialog
        open={isOpen}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'var(--card-bg)',
            color: 'var(--text-color)',
            border: '1px solid var(--text-secondary)',
          },
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid var(--text-secondary)' }}>
          Chat with your Financial Assistant
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', height: '60vh', p: 1, backgroundColor: 'var(--background)' }}>
          <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column' }}>
            {messages.map((msg, index) => (
              <Paper
                key={index}
                elevation={0}
                sx={{
                  p: 1.5,
                  mb: 1,
                  maxWidth: '80%',
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  color: msg.sender === 'user' ? 'white' : 'var(--text-color)',
                  backgroundColor: msg.sender === 'user' ? 'var(--secondary)' : 'var(--card-bg)',
                  border: msg.sender === 'user' ? 'none' : '1px solid var(--text-secondary)',
                }}
              >
                <Typography variant="body1">{msg.text}</Typography>
              </Paper>
            ))}
            {isLoading && <CircularProgress size={24} sx={{ alignSelf: 'center', color: 'var(--secondary)' }} />}
            <div ref={messagesEndRef} />
          </Box>
          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', alignItems: 'center', p: 1, borderTop: '1px solid var(--text-secondary)' }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Ask about your transactions..."
              value={inputValue}
              onChange={handleInputChange}
              disabled={isLoading}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: 'var(--text-color)',
                  '& fieldset': {
                    borderColor: 'var(--text-secondary)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'var(--secondary)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'var(--secondary)',
                  },
                },
                input: {
                  color: 'var(--text-color)',
                },
              }}
              InputLabelProps={{
                style: { color: 'var(--text-secondary)' },
              }}
            />
            <IconButton type="submit" color="primary" disabled={isLoading} sx={{ color: 'var(--secondary)' }}>
              <SendIcon />
            </IconButton>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Chat;
