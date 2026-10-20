import type { SpendingReport } from "./report";
export type AnalyticsResponse = SpendingReport & {
  availability: {
    ai: boolean;
    paypal: boolean;
    sandbox: boolean;
    webhook: boolean;
  };
};
export interface AnalystAnswer {
  answer: string;
  evidenceIds: string[];
  generatedAt: string;
  isReadOnly: true;
}
