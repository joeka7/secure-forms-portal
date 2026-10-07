"use client";

import { createContext, useContext } from "react";

/**
 * How the shared form components render:
 * - "fill": editable controls (Fill form);
 * - "preview": the questions and structure with empty, disabled controls (Preview);
 * - "review": a stored submission's answers as read-only text (View submission).
 */
export type FormMode = "fill" | "preview" | "review";

export const FormModeContext = createContext<FormMode>("fill");

export const useFormMode = () => useContext(FormModeContext);
