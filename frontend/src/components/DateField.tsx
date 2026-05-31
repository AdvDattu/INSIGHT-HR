import React, { useState } from "react";
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";

import { colors, radius, spacing } from "@/src/theme/colors";
import { Button } from "./UI";

type DateFieldProps = {
  label?: string;
  value: string; // YYYY-MM-DD
  onChange: (val: string) => void;
  testID?: string;
  minimumDate?: Date;
  maximumDate?: Date;
};

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIsoDate(val: string): Date {
  if (!val) return new Date();
  const parts = val.split("-").map((n) => parseInt(n, 10));
  if (parts.length !== 3 || parts.some((n) => isNaN(n))) return new Date();
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatDisplay(val: string): string {
  if (!val) return "";
  const d = parseIsoDate(val);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function DateField({
  label,
  value,
  onChange,
  testID,
  minimumDate,
  maximumDate,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(parseIsoDate(value));
  const insets = useSafeAreaInsets();

  // Web fallback: use native HTML date input
  if (Platform.OS === "web") {
    return (
      <View style={{ marginBottom: spacing.base }}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <View style={styles.trigger}>
          {/* eslint-disable-next-line react-native/no-inline-styles */}
          <TextInput
            testID={testID}
            value={value}
            onChangeText={onChange}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textMuted}
            // @ts-expect-error react-native-web supports type prop on TextInput
            type="date"
            style={styles.webInput}
          />
          <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
        </View>
      </View>
    );
  }

  const openPicker = () => {
    setTempDate(parseIsoDate(value || toIsoDate(new Date())));
    setOpen(true);
  };

  return (
    <View style={{ marginBottom: spacing.base }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={openPicker}
        style={styles.trigger}
        testID={testID}
      >
        <Text
          style={[
            styles.triggerText,
            !value && { color: colors.textMuted },
          ]}
        >
          {value ? formatDisplay(value) : "Select date"}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{label || "Select Date"}</Text>
          <DateTimePicker
            value={tempDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "calendar"}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={(_, d) => {
              if (d) setTempDate(d);
              if (Platform.OS === "android") {
                if (d) {
                  onChange(toIsoDate(d));
                }
                setOpen(false);
              }
            }}
          />
          {Platform.OS === "ios" && (
            <View style={styles.actions}>
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => setOpen(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                label="Confirm"
                onPress={() => {
                  onChange(toIsoDate(tempDate));
                  setOpen(false);
                }}
                style={{ flex: 1, marginLeft: 8 }}
              />
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.textSecondary,
    marginBottom: 6,
  },
  trigger: {
    minHeight: 52,
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  triggerText: { color: colors.textPrimary, fontSize: 15, flex: 1 },
  webInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: "transparent",
    borderWidth: 0,
    outlineStyle: "none" as any,
  },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 12,
  },
  actions: {
    flexDirection: "row",
    paddingTop: 12,
  },
});
