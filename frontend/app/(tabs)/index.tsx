import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Card, StatusPill } from "@/src/components/UI";
import { useAuth } from "@/src/store/auth";
import { useToast } from "@/src/components/Toast";
import { ERPNext, ERPNextApiError } from "@/src/services/erpnext";
import { colors, radius, spacing } from "@/src/theme/colors";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function fmtServerTime(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function greeting(d: Date) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { credentials, employee } = useAuth();
  const toast = useToast();

  const [now, setNow] = useState(new Date());
  const [status, setStatus] = useState<"IN" | "OUT" | null>(null);
  const [lastTime, setLastTime] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [submitting, setSubmitting] = useState<"IN" | "OUT" | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // tick clock every second
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadStatus = useCallback(async () => {
    if (!credentials || !employee) return;
    try {
      setStatusLoading(true);
      const latest = await ERPNext.getLatestCheckin(credentials, employee.name);
      if (latest) {
        setStatus(latest.log_type);
        setLastTime(latest.time);
      } else {
        setStatus("OUT");
        setLastTime(null);
      }
    } catch (e: any) {
      const msg = e instanceof ERPNextApiError ? e.message : "Failed to load status";
      toast.show(msg, "error");
    } finally {
      setStatusLoading(false);
    }
  }, [credentials, employee, toast]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const onCheck = async (type: "IN" | "OUT") => {
    if (!credentials || !employee) return;
    if (submitting) return;
    setSubmitting(type);
    try {
      const time = fmtServerTime(new Date());
      await ERPNext.createCheckin(credentials, employee.name, type, time);
      setStatus(type);
      setLastTime(time);
      toast.show(
        type === "IN"
          ? "Checked in successfully!"
          : "Checked out successfully!",
        "success",
      );
    } catch (e: any) {
      const msg =
        e instanceof ERPNextApiError ? e.message : "Failed to log attendance";
      toast.show(msg, "error");
    } finally {
      setSubmitting(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStatus();
    setRefreshing(false);
  };

  const firstName = useMemo(
    () => (employee?.employee_name || "").split(" ")[0] || "There",
    [employee],
  );

  const initials = useMemo(() => {
    const name = employee?.employee_name || "";
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "E";
  }, [employee]);

  const isCheckedIn = status === "IN";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12 },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greeting(now)}</Text>
            <Text style={styles.name} numberOfLines={1}>
              {firstName}.
            </Text>
            {!!employee?.designation && (
              <Text style={styles.designation} numberOfLines={1}>
                {employee.designation}
                {employee.department ? ` · ${employee.department}` : ""}
              </Text>
            )}
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>

        {/* Attendance hero card */}
        <Card style={styles.heroCard} testID="attendance-card">
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Today's status</Text>
            {statusLoading ? (
              <ActivityIndicator color={colors.textMuted} size="small" />
            ) : (
              <StatusPill
                label={isCheckedIn ? "Checked In" : "Checked Out"}
                tone={isCheckedIn ? "success" : "neutral"}
                testID="attendance-status-pill"
              />
            )}
          </View>

          <View style={styles.clockRow}>
            <Text style={styles.time}>
              {pad(now.getHours())}
              <Text style={styles.colon}>:</Text>
              {pad(now.getMinutes())}
              <Text style={styles.seconds}>:{pad(now.getSeconds())}</Text>
            </Text>
            <Text style={styles.date}>
              {now.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </Text>
          </View>

          {lastTime ? (
            <Text style={styles.lastLog}>
              Last log: {status === "IN" ? "Checked in" : "Checked out"} at{" "}
              {new Date(lastTime.replace(" ", "T")).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          ) : (
            <Text style={styles.lastLog}>No check-ins recorded yet today.</Text>
          )}

          <View style={styles.actionsRow}>
            <TouchableOpacity
              testID="check-in-button"
              activeOpacity={0.85}
              onPress={() => onCheck("IN")}
              disabled={submitting !== null || isCheckedIn}
              style={[
                styles.actionBtn,
                isCheckedIn
                  ? styles.actionBtnDisabled
                  : styles.actionBtnPrimary,
              ]}
            >
              {submitting === "IN" ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <>
                  <Ionicons
                    name="log-in-outline"
                    size={20}
                    color={isCheckedIn ? colors.textMuted : colors.primaryForeground}
                  />
                  <Text
                    style={[
                      styles.actionLabel,
                      isCheckedIn
                        ? { color: colors.textMuted }
                        : { color: colors.primaryForeground },
                    ]}
                  >
                    Check In
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              testID="check-out-button"
              activeOpacity={0.85}
              onPress={() => onCheck("OUT")}
              disabled={submitting !== null || !isCheckedIn}
              style={[
                styles.actionBtn,
                !isCheckedIn
                  ? styles.actionBtnDisabledSecondary
                  : styles.actionBtnSecondary,
              ]}
            >
              {submitting === "OUT" ? (
                <ActivityIndicator color={colors.textPrimary} />
              ) : (
                <>
                  <Ionicons
                    name="log-out-outline"
                    size={20}
                    color={!isCheckedIn ? colors.textMuted : colors.textPrimary}
                  />
                  <Text
                    style={[
                      styles.actionLabel,
                      !isCheckedIn
                        ? { color: colors.textMuted }
                        : { color: colors.textPrimary },
                    ]}
                  >
                    Check Out
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Card>

        {/* Quick info */}
        <View style={styles.bentoRow}>
          <Card style={styles.bentoItem}>
            <Ionicons
              name="briefcase-outline"
              size={20}
              color={colors.textSecondary}
            />
            <Text style={styles.bentoLabel}>Employee ID</Text>
            <Text style={styles.bentoValue} numberOfLines={1}>
              {employee?.name || "—"}
            </Text>
          </Card>
          <Card style={styles.bentoItem}>
            <Ionicons
              name="business-outline"
              size={20}
              color={colors.textSecondary}
            />
            <Text style={styles.bentoLabel}>Department</Text>
            <Text style={styles.bentoValue} numberOfLines={1}>
              {employee?.department || "—"}
            </Text>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  greeting: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 2,
  },
  name: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  designation: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.primaryForeground,
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 0.5,
  },
  heroCard: {
    padding: spacing.xl,
    marginBottom: spacing.base,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  clockRow: {
    marginBottom: spacing.base,
  },
  time: {
    fontSize: 56,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -2,
    lineHeight: 60,
  },
  colon: { color: colors.textMuted, fontWeight: "300" },
  seconds: { fontSize: 28, color: colors.textMuted, fontWeight: "600" },
  date: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  lastLog: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  actionsRow: {
    flexDirection: "row",
  },
  actionBtn: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    paddingHorizontal: 12,
  },
  actionBtnPrimary: {
    backgroundColor: colors.primary,
    marginRight: 8,
  },
  actionBtnDisabled: {
    backgroundColor: colors.borderLight,
    marginRight: 8,
  },
  actionBtnSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginLeft: 8,
  },
  actionBtnDisabledSecondary: {
    backgroundColor: colors.borderLight,
    marginLeft: 8,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 8,
  },
  bentoRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  bentoItem: {
    flex: 1,
    padding: spacing.base,
  },
  bentoLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.textMuted,
    marginTop: 8,
    marginBottom: 4,
  },
  bentoValue: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
});
