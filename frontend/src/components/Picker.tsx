import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing } from "@/src/theme/colors";

type PickerProps = {
  label?: string;
  placeholder?: string;
  value?: string | null;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
  testID?: string;
  disabled?: boolean;
};

export function Picker({
  label,
  placeholder = "Select an option",
  value,
  options,
  onChange,
  testID,
  disabled,
}: PickerProps) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <View style={{ marginBottom: spacing.base }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity
        testID={testID}
        activeOpacity={0.8}
        onPress={() => !disabled && setOpen(true)}
        style={[styles.trigger, disabled && { opacity: 0.6 }]}
      >
        <Text
          style={[
            styles.triggerText,
            !selected && { color: colors.textMuted },
          ]}
          numberOfLines={1}
        >
          {selected?.label || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
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
          <Text style={styles.sheetTitle}>{label || "Select"}</Text>
          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.row}
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
                testID={`picker-option-${item.value}`}
              >
                <Text style={styles.rowText}>{item.label}</Text>
                {item.value === value && (
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No options available</Text>
            }
          />
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
  triggerText: { color: colors.textPrimary, fontSize: 15, flex: 1, marginRight: 8 },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    maxHeight: "70%",
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
  row: {
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowText: { fontSize: 16, color: colors.textPrimary },
  sep: { height: 1, backgroundColor: colors.borderLight },
  emptyText: {
    paddingVertical: 24,
    textAlign: "center",
    color: colors.textMuted,
  },
});
