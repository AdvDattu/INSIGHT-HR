import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, spacing } from "@/src/theme/colors";

type ToastKind = "success" | "error" | "info";

type ToastItem = { id: number; message: string; kind: ToastKind };

type ToastContextType = {
  show: (message: string, kind?: ToastKind) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const idRef = useRef(0);

  const show = useCallback(
    (message: string, kind: ToastKind = "info") => {
      idRef.current += 1;
      const id = idRef.current;
      setToast({ id, message, kind });
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start(() => {
          setToast((curr) => (curr?.id === id ? null : curr));
        });
      }, 2400);
    },
    [opacity],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.wrap,
            { top: insets.top + 12, opacity },
          ]}
        >
          <View
            style={[
              styles.toast,
              toast.kind === "success" && styles.success,
              toast.kind === "error" && styles.error,
              toast.kind === "info" && styles.info,
            ]}
            testID="toast"
          >
            <Text style={styles.text} numberOfLines={3}>
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9999,
  },
  toast: {
    maxWidth: "90%",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  text: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  success: { backgroundColor: "#0A0A0A", borderColor: colors.success },
  error: { backgroundColor: "#0A0A0A", borderColor: colors.destructive },
  info: { backgroundColor: "#0A0A0A", borderColor: colors.border },
});
