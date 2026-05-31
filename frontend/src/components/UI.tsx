import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";

import { colors, radius, spacing } from "@/src/theme/colors";

// =========================================================================
// Button
// =========================================================================
type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "destructive" | "ghost";
  size?: "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  icon?: React.ReactNode;
  style?: ViewStyle;
  fullWidth?: boolean;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  testID,
  icon,
  style,
  fullWidth,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      style={[
        btnStyles.base,
        size === "lg" ? btnStyles.lg : btnStyles.md,
        variant === "primary" && btnStyles.primary,
        variant === "secondary" && btnStyles.secondary,
        variant === "destructive" && btnStyles.destructive,
        variant === "ghost" && btnStyles.ghost,
        fullWidth && { alignSelf: "stretch" },
        isDisabled && { opacity: 0.55 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === "secondary" || variant === "ghost"
              ? colors.textPrimary
              : colors.primaryForeground
          }
        />
      ) : (
        <View style={btnStyles.content}>
          {icon ? <View style={{ marginRight: 8 }}>{icon}</View> : null}
          <Text
            style={[
              btnStyles.label,
              size === "lg" && { fontSize: 16 },
              variant === "primary" && { color: colors.primaryForeground },
              variant === "secondary" && { color: colors.textPrimary },
              variant === "destructive" && { color: colors.primaryForeground },
              variant === "ghost" && { color: colors.textPrimary },
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const btnStyles = StyleSheet.create({
  base: {
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  content: { flexDirection: "row", alignItems: "center" },
  md: { paddingVertical: 12, paddingHorizontal: 20, minHeight: 48 },
  lg: { paddingVertical: 16, paddingHorizontal: 24, minHeight: 56 },
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  destructive: { backgroundColor: colors.destructive },
  ghost: { backgroundColor: "transparent" },
  label: { fontSize: 15, fontWeight: "600", letterSpacing: 0.1 },
});

// =========================================================================
// Input
// =========================================================================
type InputProps = TextInputProps & {
  label?: string;
  hint?: string;
  errorText?: string;
};

export function Input({ label, hint, errorText, style, ...rest }: InputProps) {
  return (
    <View style={{ marginBottom: spacing.base }}>
      {label ? <Text style={inputStyles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        {...rest}
        style={[
          inputStyles.input,
          !!errorText && { borderColor: colors.destructive },
          style,
        ]}
      />
      {!!hint && !errorText && <Text style={inputStyles.hint}>{hint}</Text>}
      {!!errorText && <Text style={inputStyles.error}>{errorText}</Text>}
    </View>
  );
}

const inputStyles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    minHeight: 52,
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.textPrimary,
  },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 6 },
  error: { color: colors.destructive, fontSize: 12, marginTop: 6 },
});

// =========================================================================
// Card
// =========================================================================
export function Card({
  children,
  style,
  testID,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}) {
  return (
    <View testID={testID} style={[cardStyles.card, style]}>
      {children}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
});

// =========================================================================
// Section header
// =========================================================================
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={sectionStyles.label}>{children}</Text>;
}

const sectionStyles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.textMuted,
    marginBottom: 12,
  },
});

// =========================================================================
// Status pill
// =========================================================================
export function StatusPill({
  label,
  tone,
  testID,
}: {
  label: string;
  tone: "success" | "warning" | "destructive" | "info" | "neutral";
  testID?: string;
}) {
  const toneStyles: Record<typeof tone, ViewStyle> = {
    success: { backgroundColor: colors.successBg },
    warning: { backgroundColor: colors.warningBg },
    destructive: { backgroundColor: colors.destructiveBg },
    info: { backgroundColor: colors.infoBg },
    neutral: { backgroundColor: colors.borderLight },
  };
  const textTones: Record<typeof tone, string> = {
    success: "#15803D",
    warning: "#B45309",
    destructive: "#B91C1C",
    info: "#1D4ED8",
    neutral: colors.textSecondary,
  };
  return (
    <View testID={testID} style={[pillStyles.pill, toneStyles[tone]]}>
      <Text style={[pillStyles.text, { color: textTones[tone] }]}>
        {label}
      </Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    alignSelf: "flex-start",
  },
  text: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
});

// =========================================================================
// Empty state
// =========================================================================
export function EmptyState({
  title,
  subtitle,
  testID,
}: {
  title: string;
  subtitle?: string;
  testID?: string;
}) {
  return (
    <View testID={testID} style={emptyStyles.container}>
      <View style={emptyStyles.dot} />
      <Text style={emptyStyles.title}>{title}</Text>
      {!!subtitle && <Text style={emptyStyles.sub}>{subtitle}</Text>}
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.borderLight,
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  sub: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    paddingHorizontal: 32,
  },
});

// =========================================================================
// Loader
// =========================================================================
export function Loader({ label }: { label?: string }) {
  return (
    <View style={loaderStyles.wrap}>
      <ActivityIndicator color={colors.primary} />
      {label ? <Text style={loaderStyles.label}>{label}</Text> : null}
    </View>
  );
}

const loaderStyles = StyleSheet.create({
  wrap: { paddingVertical: 32, alignItems: "center" },
  label: { marginTop: 12, color: colors.textSecondary, fontSize: 13 },
});
