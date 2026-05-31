import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Card, EmptyState, Loader } from "@/src/components/UI";
import { useAuth } from "@/src/store/auth";
import { useToast } from "@/src/components/Toast";
import { ERPNext, ERPNextApiError } from "@/src/services/erpnext";
import { colors, radius, spacing } from "@/src/theme/colors";
import {
  SalarySlipDetail,
  SalarySlipSummary,
  SalaryComponent,
} from "@/src/types/erpnext";

function formatMoney(amount?: number): string {
  if (amount == null || isNaN(Number(amount))) return "—";
  const n = Number(amount);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function monthLabel(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function PayslipsScreen() {
  const insets = useSafeAreaInsets();
  const { credentials, employee } = useAuth();
  const toast = useToast();

  const [list, setList] = useState<SalarySlipSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selected, setSelected] = useState<SalarySlipDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!credentials || !employee) return;
    try {
      setLoading(true);
      const data = await ERPNext.getSalarySlips(credentials, employee.name);
      setList(data);
    } catch (e: any) {
      const msg =
        e instanceof ERPNextApiError ? e.message : "Failed to load payslips";
      toast.show(msg, "error");
    } finally {
      setLoading(false);
    }
  }, [credentials, employee, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openDetail = async (item: SalarySlipSummary) => {
    if (!credentials) return;
    setSelected({ ...item });
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await ERPNext.getSalarySlipDetail(credentials, item.name);
      setSelected(detail);
    } catch (e: any) {
      const msg =
        e instanceof ERPNextApiError ? e.message : "Failed to load details";
      setDetailError(msg);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setDetailError(null);
  };

  const totalEarnings = useMemo(() => {
    return (selected?.earnings || []).reduce(
      (s: number, e: SalaryComponent) => s + Number(e.amount || 0),
      0,
    );
  }, [selected]);
  const totalDeductions = useMemo(() => {
    return (selected?.deductions || []).reduce(
      (s: number, e: SalaryComponent) => s + Number(e.amount || 0),
      0,
    );
  }, [selected]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.headerRow}>
          <Text style={styles.kicker}>Salary</Text>
          <Text style={styles.title}>Payslips</Text>
        </View>

        {loading ? (
          <Loader label="Loading payslips..." />
        ) : list.length === 0 ? (
          <EmptyState
            title="No payslips yet"
            subtitle="Submitted salary slips will appear here once payroll is processed."
            testID="empty-payslips"
          />
        ) : (
          <View style={{ gap: 12 }}>
            {list.map((item) => (
              <TouchableOpacity
                key={item.name}
                testID="payslip-item"
                activeOpacity={0.85}
                onPress={() => openDetail(item)}
              >
                <Card>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.month}>
                        {monthLabel(item.start_date)}
                      </Text>
                      <Text style={styles.range}>
                        {item.start_date} → {item.end_date}
                      </Text>
                      <Text style={styles.slipId}>{item.name}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.netLabel}>Net Pay</Text>
                      <Text style={styles.netPay}>
                        {formatMoney(item.net_pay)}
                      </Text>
                      <View style={styles.detailLink}>
                        <Text style={styles.detailText}>View Details</Text>
                        <Ionicons
                          name="chevron-forward"
                          size={14}
                          color={colors.textSecondary}
                        />
                      </View>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Detail Modal */}
      <Modal
        visible={selected !== null}
        transparent
        animationType="slide"
        onRequestClose={closeDetail}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={closeDetail}
        />
        <View
          style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
          testID="payslip-detail-modal"
        >
          <View style={styles.handle} />
          {selected ? (
            <>
              <View style={styles.sheetHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>
                    {monthLabel(selected.start_date)}
                  </Text>
                  <Text style={styles.sheetSub}>{selected.name}</Text>
                </View>
                <TouchableOpacity onPress={closeDetail} testID="close-detail">
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {detailLoading ? (
                <View style={{ paddingVertical: 32 }}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : detailError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{detailError}</Text>
                </View>
              ) : (
                <ScrollView
                  contentContainerStyle={{ paddingBottom: 12 }}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.summaryGrid}>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Gross</Text>
                      <Text style={styles.summaryValue}>
                        {formatMoney(selected.gross_pay)}
                      </Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Deductions</Text>
                      <Text style={styles.summaryValue}>
                        {formatMoney(selected.total_deduction)}
                      </Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Net Pay</Text>
                      <Text
                        style={[
                          styles.summaryValue,
                          { color: colors.success },
                        ]}
                      >
                        {formatMoney(selected.net_pay)}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.groupLabel}>Earnings</Text>
                  {(selected.earnings || []).length === 0 ? (
                    <Text style={styles.muted}>No earnings recorded.</Text>
                  ) : (
                    (selected.earnings || []).map((e, idx) => (
                      <View key={`e-${idx}`} style={styles.lineItem}>
                        <Text style={styles.lineLabel}>
                          {e.salary_component}
                        </Text>
                        <Text style={styles.lineValue}>
                          {formatMoney(e.amount)}
                        </Text>
                      </View>
                    ))
                  )}
                  {(selected.earnings || []).length > 0 && (
                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>Total Earnings</Text>
                      <Text style={styles.totalValue}>
                        {formatMoney(totalEarnings)}
                      </Text>
                    </View>
                  )}

                  <Text style={styles.groupLabel}>Deductions</Text>
                  {(selected.deductions || []).length === 0 ? (
                    <Text style={styles.muted}>No deductions recorded.</Text>
                  ) : (
                    (selected.deductions || []).map((d, idx) => (
                      <View key={`d-${idx}`} style={styles.lineItem}>
                        <Text style={styles.lineLabel}>
                          {d.salary_component}
                        </Text>
                        <Text style={styles.lineValue}>
                          {formatMoney(d.amount)}
                        </Text>
                      </View>
                    ))
                  )}
                  {(selected.deductions || []).length > 0 && (
                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>Total Deductions</Text>
                      <Text style={styles.totalValue}>
                        {formatMoney(totalDeductions)}
                      </Text>
                    </View>
                  )}

                  <View style={styles.netRow}>
                    <Text style={styles.netRowLabel}>Net Pay</Text>
                    <Text style={styles.netRowValue}>
                      {formatMoney(selected.net_pay)}
                    </Text>
                  </View>
                </ScrollView>
              )}
            </>
          ) : null}
        </View>
      </Modal>
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
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  month: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  range: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  slipId: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  netLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.textMuted,
    marginBottom: 2,
  },
  netPay: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  detailLink: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  detailText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
    marginRight: 2,
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: 12, // Minimized padding to maximize width
    paddingTop: 12,
    maxHeight: "85%",
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18, // Reduced font size slightly
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  sheetSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  summaryGrid: {
    flexDirection: "row",
    backgroundColor: colors.inputBg,
    borderRadius: radius.lg,
    padding: 10, // Minimized inner padding
    marginBottom: spacing.base,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.textMuted,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 13, // Reduced to prevent cramping
    fontWeight: "700",
    color: colors.textPrimary,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.textMuted,
    marginTop: spacing.base,
    marginBottom: 8,
  },
  muted: {
    fontSize: 13,
    color: colors.textMuted,
    paddingVertical: 8,
  },
  lineItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6, // Tighter vertical padding
    borderBottomColor: colors.borderLight,
    borderBottomWidth: 1,
  },
  lineLabel: {
    fontSize: 12, // Reduced text size
    color: colors.textPrimary,
    flex: 1,
    marginRight: 12,
  },
  lineValue: {
    fontSize: 12, // Reduced text size
    fontWeight: "600",
    color: colors.textPrimary,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 12, // Reduced font size
    fontWeight: "700",
    color: colors.textSecondary,
  },
  totalValue: {
    fontSize: 13, // Reduced font size
    fontWeight: "800",
    color: colors.textPrimary,
  },
  netRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: spacing.base,
  },
  netRowLabel: {
    color: colors.primaryForeground,
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 0.3,
  },
  netRowValue: {
    color: colors.primaryForeground,
    fontWeight: "800",
    fontSize: 20,
  },
  errorBox: {
    backgroundColor: colors.destructiveBg,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    color: "#991B1B",
    fontSize: 13,
  },
});
