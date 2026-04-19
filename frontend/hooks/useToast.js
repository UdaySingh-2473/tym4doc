import { useState, useCallback } from "react";

export default function useToast() {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, isError = false) => {
    setToast({ msg, type: isError ? "err" : "ok" });
    setTimeout(() => setToast(null), 3500);
  }, []);

  return { toast, showToast };
}
