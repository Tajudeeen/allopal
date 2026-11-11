import { z } from "zod/v3";

/**
 * Strict schema for AI proposed spending mandates.
 * All amounts MUST be positive integers in cents.
 */
export const MandateProposalSchema = z.object({
  name: z.string().min(2, "Mandate name must be at least 2 characters").max(100),
  weeklyLimit: z
    .number()
    .int("Weekly limit must be an integer in cents")
    .positive("Weekly limit must be strictly positive")
    .max(1_000_000, "Weekly limit exceeds maximum allowed threshold ($10,000.00)"),
  durationDays: z
    .number()
    .int("Duration in days must be an integer")
    .min(1, "Duration must be at least 1 day")
    .max(365, "Duration cannot exceed 365 days"),
  allowedCategories: z
    .array(z.string().min(1))
    .min(1, "Must allow at least one category"),
  allowedMerchants: z
    .array(z.string().min(1))
    .min(1, "Must allow at least one merchant"),
});

export type MandateProposal = z.infer<typeof MandateProposalSchema>;

export interface AIInterpretationResult {
  proposal: MandateProposal | null;
  rawResponse?: string;
  error?: string;
  requiresHumanApproval: true;
}
