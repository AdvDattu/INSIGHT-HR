import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Button,
  Card,
  EmptyState,
  Loader,
  StatusPill,
} from "@/src/components/UI";
import { Picker } from "@/src/components/Picker";
import { DateField } from "@/src/components/DateField";
import { useAuth } from "@/src/store/auth";
import { useToast } from "@/src/components/Toast";
import { ERPNext, ERPNextApiError } from "@/src/services/erpnext";
import { colors, radius, spacing } from "@/src/theme/colors";
import { LeaveApplication, LeaveAllocation } from "@/src/types/erpnext";

type TabKey = "balance" | "apply" | "history";

const TABS: { key: TabKey; label: string }[] = [
  { key: "balance", label: "Balance" },
  { key: "apply", label: "Apply" },
  { key: "history", label: "History" },
];

function statusTone(
  status?: string,
): "success" | "warning" | "destructive" | "neutral" {
  const s = (status || "").toLowerCase();
  if (s === "approved") return "success";
  if (s === "rejected") return "destructive";
  if (s === "open" || s === "submitted" || s === "pending") return "warning";
  return "neutral";
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function LeaveScreen() {
  const insets = useSafeAreaInsets();
  const { credentials, employee } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState<TabKey>("balance");

  // Balance
  const [allocations, setAllocations] = useState<LeaveAllocation[]>([]);
  const [balanceLoading, setBalanceLoading] = useState(true);

  // History
  const [history, setHistory] = useState<LeaveApplication[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Apply form
  const [leaveTypes, setLeaveTypes] = useState<{ label: string; value: string }[]>(
    [],
  );
  const [leaveTypesLoading, setLeaveTypesLoading] = useState(true);
  const [formType, setFormType] = useState<string | null>(null);
  const [formFrom, setFormFrom] = useState<string>(todayIso());
  const [formTo, setFormTo] = useState<string>(todayIso());
  const [formReason, setFormReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);

  const loadBalance = useCallback(async () => {
    if (!credentials || !employee) return;
    try {
      setBalanceLoading(true);
      const list = await ERPNext.getLeaveAllocations(credentials, employee.name);
      setAllocations(list);
    } catch (e: any) {
      const msg =
        e instanceof ERPNextApiError ? e.message : "Failed to load balances";
      toast.show(msg, "error");
    } finally {
      setBalanceLoading(false);
    }
  }, [credentials, employee, toast]);

  const loadHistory = useCallback(async () => {
    if (!credentials || !employee) return;
    try {
      setHistoryLoading(true);
      const list = await ERPNext.getLeaveApplications(
        credentials,
        employee.name,
      );
      setHistory(list);
    } catch (e: any) {
      const msg =
        e instanceof ERPNextApiError ? e.message : "Failed to load history";
      toast.show(msg, "error");
    } finally {
      setHistoryLoading(false);
    }
  }, [credentials, employee, toast]);

  const loadTypes = useCallback(async () => {
    if (!credentials) return;
    try {
      setLeaveTypesLoading(true);
      const list = await ERPNext.getLeaveTypes(credentials);
      setLeaveTypes(list.map((t) => ({ label: t.name, value: t.name })));
    } catch {
      // non-fatal; user may still type
    } finally {
      setLeaveTypesLoading(false);
    }
  }, [credentials]);

  useEffect(() => {
    loadBalance();
    loadHistory();
    loadTypes();
  }, [loadBalance, loadHistory, loadTypes]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadBalance(), loadHistory(), loadTypes()]);
    setRefreshing(false);
  };

  const onSubmit = async () => {
    if (!credentials || !employee) return;
    setFormError(null);
    if (!formType) {
      setFormError("Please select a leave type");
      return;
    }
    if (!formFrom || !formTo) {
      setFormError("Please pick both From and To dates");
      return;
    }
    if (formFrom > formTo) {
      setFormError("From date cannot be after To date");
      return;
    }
    setSubmitting(true);
    try {
      await ERPNext.applyLeave(credentials, {
        employee: employee.name,
        leave_type: formType,
        from_date: formFrom,
        to_date: formTo,
        reason: formReason.trim(),
      });
      toast.show("Leave application submitted!", "success");
      setFormReason("");
      setFormType(null);
      setFormFrom(todayIso());
      setFormTo(todayIso());
      // Refresh history and switch
      await loadHistory();
      await loadBalance();
      setTab("history");
    } catch (e: any) {
      const msg =
        e instanceof ERPNextApiError
          ? e.message
          : "Failed to submit leave application";
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const groupedAllocations = useMemo(() => {
    // aggregate by leave_type in case multiple allocation cycles exist
    const map = new Map<
      string,
      { leave_type: string; total: number; unused: number }
    >();
    allocations.forEach((a) => {
      const prev = map.get(a.leave_type) || {
        leave_type: a.leave_type,
        total: 0,
        unused: 0,
      };
      prev.total += Number(a.total_leaves_allocated || 0);
      prev.unused += Number(a.unused_leaves || 0);
      map.set(a.leave_type, prev);
    });
    return Array.from(map.values());
  }, [allocations]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 12 },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.kicker}>Leave Management</Text>
              <Text style={styles.title}>Time off</Text>
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  testID={`leave-tab-${t.key}`}
                  activeOpacity={0.9}
                  style={[styles.tabBtn, active && styles.tabBtnActive]}
                  onPress={() => setTab(t.key)}
                >
                  <Text
                    style={[
                      styles.tabLabel,
                      active && styles.tabLabelActive,
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Balance */}
          {tab === "balance" && (
            <View testID="leave-balance-view">
              {balanceLoading ? (
                <Loader label="Loading balances..." />
              ) : groupedAllocations.length === 0 ? (
                <EmptyState
                  title="No leave allocations"
                  subtitle="Your HR team hasn't allocated any leaves to you yet."
                  testID="empty-balance"
                />
              ) : (
                <View style={{ gap: 12 }}>
                  {groupedAllocations.map((a) => {
                    const used = Math.max(0, a.total - a.unused);
                    const pct =
                      a.total > 0
                        ? Math.min(100, Math.max(0, (used / a.total) * 100))
                        : 0;
                    return (
                      <Card key={a.leave_type} testID={`balance-${a.leave_type}`}>
                        <View style={styles.balanceRow}>
                          <Text style={styles.balanceType}>{a.leave_type}</Text>
                          <Text style={styles.balanceCount}>
                            <Text style={styles.balanceBig}>{a.unused}</Text>
                            <Text style={styles.balanceTotal}> / {a.total}</Text>
                          </Text>
                        </View>
                        <Text style={styles.balanceCaption}>
                          {used} used · {a.unused} remaining
                        </Text>
                        <View style={styles.barBg}>
                          <View
                            style={[
                              styles.barFill,
                              { width: `${pct}%` },
                            ]}
                          />
                        </View>
                      </Card>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* Apply */}
          {tab === "apply" && (
            <View testID="leave-apply-view">
              <Card>
                <Picker
                  testID="leave-type-picker"
                  label="Leave Type"
                  value={formType}
                  placeholder={
                    leaveTypesLoading ? "Loading types..." : "Select leave type"
                  }
                  options={leaveTypes}
                  onChange={(v) => setFormType(v)}
                  disabled={leaveTypesLoading}
                />
                <DateField
                  testID="leave-from-date"
                  label="From Date"
                  value={formFrom}
                  onChange={setFormFrom}
                />
                <DateField
                  testID="leave-to-date"
                  label="To Date"
                  value={formTo}
                  onChange={setFormTo}
                  minimumDate={formFrom ? new Date(formFrom) : undefined}
                />
                <Text style={styles.inputLabel}>Reason</Text>
                <TextInput
                  testID="leave-reason-input"
                  value={formReason}
                  onChangeText={setFormReason}
                  placeholder="Brief reason for your leave..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={4}
                  style={styles.textarea}
                />

                {formError ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{formError}</Text>
                  </View>
                ) : null}

                <View style={{ marginTop: 12 }}>
                  <Button
                    testID="leave-apply-submit"
                    label="Submit Application"
                    onPress={onSubmit}
                    loading={submitting}
                    size="lg"
                    fullWidth
                  />
                </View>
              </Card>
            </View>
          )}

          {/* History */}
          {tab === "history" && (
            <View testID="leave-history-view">
              {historyLoading ? (
                <Loader label="Loading history..." />
              ) : history.length === 0 ? (
                <EmptyState
                  title="No leave applications"
                  subtitle="Once you apply for leave, your requests will appear here."
                  testID="empty-history"
                />
              ) : (
                <View style={{ gap: 12 }}>
                  {history.map((h) => (
                    <Card key={h.name} testID={`leave-history-${h.name}`}>
                      <View style={styles.historyHeader}>
                        <Text style={styles.historyType}>{h.leave_type}</Text>
                        <StatusPill
                          label={h.status || "Open"}
                          tone={statusTone(h.status)}
                        />
                      </View>
                      <Text style={styles.historyDates}>
                        {h.from_date} → {h.to_date}
                      </Text>
                      {!!h.total_leave_days && (
                        <Text style={styles.historyMeta}>
                          {h.total_leave_days} day
                          {Number(h.total_leave_days) === 1 ? "" : "s"}
                        </Text>
                      )}
                      {!!h.description && (
                        <Text
                          numberOfLines={2}
                          style={styles.historyReason}
                        >
                          “{h.description}”
                        </Text>
                      )}
                    </Card>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  headerRow: {
    marginBottom: spacing.lg,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.inputBg,
    padding: 4,
    borderRadius: radius.full,
    marginBottom: spacing.lg,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: radius.full,
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  tabLabelActive: {
    color: colors.primaryForeground,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  balanceType: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  balanceCount: {
    fontSize: 14,
  },
  balanceBig: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  balanceTotal: {
    fontSize: 14,
    color: colors.textMuted,
  },
  balanceCaption: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 12,
  },
  barBg: {
    height: 6,
    backgroundColor: colors.borderLight,
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: 6,
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.textSecondary,
    marginBottom: 6,
  },
  textarea: {
    minHeight: 100,
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
    textAlignVertical: "top",
  },
  errorBox: {
    backgroundColor: colors.destructiveBg,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 12,
  },
  errorText: {
    color: "#991B1B",
    fontSize: 13,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  historyType: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  historyDates: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  historyMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  historyReason: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 6,
    fontStyle: "italic",
  },
});
