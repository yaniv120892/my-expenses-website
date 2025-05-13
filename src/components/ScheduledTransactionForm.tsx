"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  MenuItem,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from "@mui/material";
import {
  Category,
  ScheduledTransaction,
  CreateScheduledTransactionInput,
  ScheduleType,
  TransactionType,
} from "../types";
import { getCategories } from "../services/transactions";

interface Props {
  open: boolean;
  onCloseAction: () => void;
  onSubmitAction: (data: CreateScheduledTransactionInput) => Promise<void>;
  initialData?: ScheduledTransaction | null;
}

const defaultForm: Omit<
  CreateScheduledTransactionInput,
  "categoryId" | "type" | "scheduleType"
> = {
  description: "",
  value: 0,
};

const scheduleTypes: ScheduleType[] = ["DAILY", "WEEKLY", "MONTHLY"];
const transactionTypes: TransactionType[] = ["EXPENSE", "INCOME"];

export default function ScheduledTransactionForm({
  open,
  onCloseAction,
  onSubmitAction,
  initialData,
}: Props) {
  const [form, setForm] = useState<CreateScheduledTransactionInput>({
    ...defaultForm,
    categoryId: "",
    type: "EXPENSE",
    scheduleType: "MONTHLY",
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [k: string]: string }>({});

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (initialData) {
      setForm({
        description: initialData.description,
        value: initialData.value,
        categoryId: initialData.categoryId,
        type: initialData.type,
        scheduleType: initialData.scheduleType,
        interval: initialData.interval,
        dayOfWeek: initialData.dayOfWeek,
        dayOfMonth: initialData.dayOfMonth,
      });
    } else {
      setForm({
        ...defaultForm,
        categoryId: "",
        type: "EXPENSE",
        scheduleType: "MONTHLY",
      });
    }
    setErrors({});
  }, [initialData, open]);

  const getScheduleSummary = () => {
    const interval =
      form.interval && form.interval > 1 ? `every ${form.interval} ` : "every ";
    if (form.scheduleType === "DAILY") {
      return `Runs ${interval.trim()}day${
        form.interval && form.interval > 1 ? "s" : ""
      }.`;
    }
    if (form.scheduleType === "WEEKLY") {
      if (!form.dayOfWeek) return "Choose a day of week.";
      const weekInterval =
        form.interval && form.interval > 1
          ? `every ${form.interval} weeks`
          : "every week";
      const days = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      return `Runs ${weekInterval} on ${days[(form.dayOfWeek - 1) % 7]}.`;
    }
    if (form.scheduleType === "MONTHLY") {
      if (!form.dayOfMonth) return "Choose a day of month.";
      const monthInterval =
        form.interval && form.interval > 1
          ? `every ${form.interval} months`
          : "every month";
      return `Runs ${monthInterval} on day ${form.dayOfMonth}.`;
    }
    return "";
  };

  const validate = () => {
    const errs: { [k: string]: string } = {};
    if (!form.description) errs.description = "Description is required";
    if (!form.value || form.value <= 0)
      errs.value = "Value must be greater than 0";
    if (!form.type) errs.type = "Type is required";
    if (!form.categoryId) errs.categoryId = "Category is required";
    if (!form.scheduleType) errs.scheduleType = "Schedule type is required";
    if (form.scheduleType === "WEEKLY" && !form.dayOfWeek)
      errs.dayOfWeek = "Day of week is required";
    if (form.scheduleType === "MONTHLY" && !form.dayOfMonth)
      errs.dayOfMonth = "Day of month is required";
    if (form.scheduleType === "MONTHLY" && form.dayOfWeek)
      errs.dayOfWeek = "Day of week is not valid for monthly schedule";
    if (
      form.scheduleType === "DAILY" &&
      (form.dayOfWeek || form.dayOfMonth || form.monthOfYear)
    ) {
      if (form.dayOfWeek)
        errs.dayOfWeek = "Day of week is not valid for daily schedule";
      if (form.dayOfMonth)
        errs.dayOfMonth = "Day of month is not valid for daily schedule";
      if (form.monthOfYear)
        errs.monthOfYear = "Month of year is not valid for daily schedule";
    }
    if (
      form.scheduleType === "WEEKLY" &&
      (form.dayOfMonth || form.monthOfYear)
    ) {
      if (form.dayOfMonth)
        errs.dayOfMonth = "Day of month is not valid for weekly schedule";
      if (form.monthOfYear)
        errs.monthOfYear = "Month of year is not valid for weekly schedule";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({
      ...form,
      [e.target.name]:
        e.target.value === "" ? undefined : Number(e.target.value),
    });
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await onSubmitAction(form);
      onCloseAction();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onCloseAction}
      fullWidth
      disableEscapeKeyDown={loading}
    >
      <DialogTitle style={{ fontWeight: 700, color: "var(--primary)" }}>
        {initialData
          ? "Edit Scheduled Transaction"
          : "New Scheduled Transaction"}
      </DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} mt={1}>
          <Box mb={1} color="var(--primary)">
            {getScheduleSummary()}
          </Box>
          <TextField
            label="Description"
            name="description"
            value={form.description}
            onChange={handleChange}
            error={!!errors.description}
            helperText={errors.description}
            fullWidth
          />
          <TextField
            label="Value"
            name="value"
            type="number"
            value={form.value}
            onChange={handleNumberChange}
            error={!!errors.value}
            helperText={errors.value}
            fullWidth
          />
          <TextField
            select
            label="Category"
            name="categoryId"
            value={form.categoryId}
            onChange={handleChange}
            error={!!errors.categoryId}
            helperText={errors.categoryId}
            fullWidth
          >
            <MenuItem value="">
              <em>Choose category</em>
            </MenuItem>
            {categories.map((cat) => (
              <MenuItem key={cat.id} value={cat.id}>
                {cat.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Type"
            name="type"
            value={form.type}
            onChange={handleChange}
            error={!!errors.type}
            helperText={errors.type}
            fullWidth
          >
            {transactionTypes.map((type) => (
              <MenuItem key={type} value={type}>
                {type.charAt(0) + type.slice(1).toLowerCase()}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Schedule Type"
            name="scheduleType"
            value={form.scheduleType}
            onChange={handleChange}
            error={!!errors.scheduleType}
            helperText={errors.scheduleType}
            fullWidth
          >
            {scheduleTypes.map((type) => (
              <MenuItem key={type} value={type}>
                {type.charAt(0) + type.slice(1).toLowerCase()}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Interval"
            name="interval"
            type="number"
            value={form.interval ?? ""}
            onChange={handleNumberChange}
            fullWidth
          />
          {form.scheduleType === "WEEKLY" && (
            <TextField
              select
              label="Day of Week"
              name="dayOfWeek"
              value={form.dayOfWeek ?? ""}
              onChange={handleNumberChange}
              error={!!errors.dayOfWeek}
              helperText={errors.dayOfWeek}
              fullWidth
            >
              <MenuItem value="">
                <em>Choose day</em>
              </MenuItem>
              <MenuItem value={1}>Sunday</MenuItem>
              <MenuItem value={2}>Monday</MenuItem>
              <MenuItem value={3}>Tuesday</MenuItem>
              <MenuItem value={4}>Wednesday</MenuItem>
              <MenuItem value={5}>Thursday</MenuItem>
              <MenuItem value={6}>Friday</MenuItem>
              <MenuItem value={7}>Saturday</MenuItem>
            </TextField>
          )}
          {form.scheduleType === "MONTHLY" && (
            <TextField
              label="Day of Month"
              name="dayOfMonth"
              type="number"
              value={form.dayOfMonth ?? ""}
              onChange={handleNumberChange}
              error={!!errors.dayOfMonth}
              helperText={errors.dayOfMonth}
              fullWidth
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions style={{ padding: "1.5rem" }}>
        <button
          className="button-secondary"
          style={{ minWidth: 100 }}
          onClick={onCloseAction}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          className="button-primary"
          style={{ minWidth: 120 }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <CircularProgress size={20} style={{ color: "#fff" }} />
          ) : initialData ? (
            "Update"
          ) : (
            "Create"
          )}
        </button>
      </DialogActions>
    </Dialog>
  );
}
