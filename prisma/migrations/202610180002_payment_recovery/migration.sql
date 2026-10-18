-- CreateTable
CREATE TABLE "DemoSession" (
    "tokenHash" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WebhookReceipt" (
    "eventId" TEXT NOT NULL PRIMARY KEY,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Mandate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'demo',
    "weeklyLimit" INTEGER NOT NULL,
    "spentAmount" INTEGER NOT NULL DEFAULT 0,
    "validFrom" DATETIME NOT NULL,
    "validUntil" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "allowedCategories" TEXT NOT NULL,
    "allowedMerchants" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Mandate" ("allowedCategories", "allowedMerchants", "createdAt", "id", "name", "spentAmount", "status", "updatedAt", "validFrom", "validUntil", "weeklyLimit") SELECT "allowedCategories", "allowedMerchants", "createdAt", "id", "name", "spentAmount", "status", "updatedAt", "validFrom", "validUntil", "weeklyLimit" FROM "Mandate";
DROP TABLE "Mandate";
ALTER TABLE "new_Mandate" RENAME TO "Mandate";
CREATE INDEX "Mandate_status_idx" ON "Mandate"("status");
CREATE INDEX "Mandate_workspaceId_idx" ON "Mandate"("workspaceId");
CREATE TABLE "new_PayPalTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT,
    "captureId" TEXT,
    "mandateId" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'http://localhost:3000',
    "returnToken" TEXT NOT NULL,
    "approvalUrl" TEXT,
    "providerCalled" BOOLEAN NOT NULL DEFAULT false,
    "payerApproved" BOOLEAN NOT NULL DEFAULT false,
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "captureStarted" BOOLEAN NOT NULL DEFAULT false,
    "reservationReleased" BOOLEAN NOT NULL DEFAULT false,
    "leaseUntil" DATETIME,
    "expiresAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorCode" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "rawResponse" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayPalTransaction_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PayPalTransaction_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- Legacy orders keep their accounting. Pending legacy approval URLs lack the new session/state binding,
-- so hold them for operator review rather than allowing a stale callback or silently releasing money.
INSERT INTO "new_PayPalTransaction" ("amount", "captureId", "createdAt", "currency", "decisionId", "id", "mandateId", "orderId", "rawResponse", "status", "returnToken", "updatedAt", "providerCalled", "captureStarted", "reservationReleased", "errorCode")
SELECT "amount", "captureId", "createdAt", "currency", "decisionId", "id", "mandateId", "orderId", "rawResponse",
 CASE WHEN "status" = 'CREATED' THEN 'REVIEW_REQUIRED' ELSE "status" END,
 lower(hex(randomblob(32))), "createdAt", true, "status" = 'COMPLETED', "status" = 'FAILED',
 CASE WHEN "status" = 'CREATED' THEN 'LEGACY_ORDER_REQUIRES_REVIEW' ELSE NULL END
FROM "PayPalTransaction";
DROP TABLE "PayPalTransaction";
ALTER TABLE "new_PayPalTransaction" RENAME TO "PayPalTransaction";
CREATE UNIQUE INDEX "PayPalTransaction_orderId_key" ON "PayPalTransaction"("orderId");
CREATE UNIQUE INDEX "PayPalTransaction_captureId_key" ON "PayPalTransaction"("captureId");
CREATE UNIQUE INDEX "PayPalTransaction_decisionId_key" ON "PayPalTransaction"("decisionId");
CREATE INDEX "PayPalTransaction_mandateId_idx" ON "PayPalTransaction"("mandateId");
CREATE INDEX "PayPalTransaction_orderId_idx" ON "PayPalTransaction"("orderId");
CREATE TABLE "new_IdempotencyRecord" (
    "workspaceId" TEXT NOT NULL DEFAULT 'demo',
    "transactionId" TEXT,
    "taskHash" TEXT,
    "httpStatus" INTEGER NOT NULL DEFAULT 200,
    "key" TEXT NOT NULL PRIMARY KEY,
    "mandateId" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "responseBody" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_IdempotencyRecord" ("cartId", "createdAt", "key", "mandateId", "responseBody", "status", "updatedAt") SELECT "cartId", "createdAt", "key", "mandateId", "responseBody", "status", "updatedAt" FROM "IdempotencyRecord";
DROP TABLE "IdempotencyRecord";
ALTER TABLE "new_IdempotencyRecord" RENAME TO "IdempotencyRecord";
CREATE INDEX "IdempotencyRecord_key_idx" ON "IdempotencyRecord"("key");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "DemoSession_workspaceId_key" ON "DemoSession"("workspaceId");

-- CreateIndex
CREATE INDEX "DemoSession_expiresAt_idx" ON "DemoSession"("expiresAt");

