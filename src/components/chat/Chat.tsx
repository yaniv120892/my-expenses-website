import React, { useState, useRef, useEffect } from "react";
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
  Button,
  Stack,
} from "@mui/material";
import {
  Send as SendIcon,
  Chat as ChatIcon,
  CheckCircle as CheckCircleIcon,
} from "@mui/icons-material";
import { Message, useChat } from "../../hooks/useChat";
import { AgentPendingAction } from "@/types/agent";

const Chat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const {
    messages,
    handleSendMessage,
    handleConfirmPendingAction,
    isLoading,
    isConfirming,
  } = useChat();
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => setIsOpen(false);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleSendMessage(inputValue);
    setInputValue("");
  };

  const renderPendingAction = (pendingAction: AgentPendingAction) => {
    const payload = pendingAction.payload;
    const isConfirmed = pendingAction.status === "CONFIRMED";

    return (
      <Paper
        elevation={0}
        sx={{
          mt: 1.5,
          p: 1.5,
          border: "1px solid var(--text-secondary)",
          backgroundColor: "var(--background)",
        }}
      >
        <Stack spacing={0.75}>
          <Typography variant="subtitle2">
            {payload.description}
          </Typography>
          <Typography variant="body2" color="var(--text-secondary)">
            {formatCurrency(payload.value)} · {payload.type} · {payload.date}
          </Typography>
          <Typography variant="caption" color="var(--text-secondary)">
            Category ID: {payload.categoryId}
          </Typography>
          {isConfirmed ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={<CheckCircleIcon />}
              disabled
            >
              Confirmed
            </Button>
          ) : (
            <Button
              size="small"
              variant="contained"
              onClick={() => handleConfirmPendingAction(pendingAction.id)}
              disabled={isConfirming}
              startIcon={<CheckCircleIcon />}
            >
              Confirm
            </Button>
          )}
        </Stack>
      </Paper>
    );
  };

  const renderMessage = (msg: Message, index: number) => (
    <Paper
      key={index}
      elevation={0}
      sx={{
        p: 1.5,
        mb: 1,
        maxWidth: "80%",
        alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
        color: msg.sender === "user" ? "white" : "var(--text-color)",
        backgroundColor:
          msg.sender === "user" ? "var(--secondary)" : "var(--card-bg)",
        border:
          msg.sender === "user"
            ? "none"
            : "1px solid var(--text-secondary)",
      }}
    >
      <Typography variant="body1">{msg.text}</Typography>
      {msg.pendingAction && renderPendingAction(msg.pendingAction)}
    </Paper>
  );

  return (
    <>
      {!isOpen && (
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
      )}
      <Dialog
        open={isOpen}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: "var(--card-bg)",
            color: "var(--text-color)",
            border: "1px solid var(--text-secondary)",
          },
        }}
      >
        <DialogTitle sx={{ borderBottom: "1px solid var(--text-secondary)" }}>
          Chat with your Financial Assistant
        </DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            height: "60vh",
            p: 1,
            backgroundColor: "var(--background)",
          }}
        >
          <Box
            sx={{
              flexGrow: 1,
              overflowY: "auto",
              p: 2,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {messages.map((msg, index) => renderMessage(msg, index))}
            {isLoading && (
              <CircularProgress
                size={24}
                sx={{ alignSelf: "center", color: "var(--secondary)" }}
              />
            )}
            <div ref={messagesEndRef} />
          </Box>
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
              display: "flex",
              alignItems: "center",
              p: 1,
              borderTop: "1px solid var(--text-secondary)",
            }}
          >
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Ask about your transactions..."
              value={inputValue}
              onChange={handleInputChange}
              disabled={isLoading}
              sx={{
                "& .MuiOutlinedInput-root": {
                  color: "var(--text-color)",
                  backgroundColor: "var(--background)",
                  "& fieldset": {
                    borderColor: "var(--text-secondary)",
                  },
                  "&:hover fieldset": {
                    borderColor: "var(--secondary)",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "var(--secondary)",
                  },
                },
                input: {
                  color: "var(--text-color)",
                  backgroundColor: "var(--background)",
                },
              }}
              InputLabelProps={{
                style: { color: "var(--text-secondary)" },
              }}
            />
            <IconButton
              type="submit"
              color="primary"
              disabled={isLoading}
              sx={{ color: "var(--secondary)" }}
            >
              <SendIcon />
            </IconButton>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
  }).format(value);
}

export default Chat;
