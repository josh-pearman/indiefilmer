-- RedefineTables: BudgetLineItem.bucket onDelete Cascade
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BudgetLineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "bucketId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "plannedAmount" REAL,
    "actualAmount" REAL NOT NULL DEFAULT 0,
    "date" DATETIME,
    "notes" TEXT,
    "receiptPath" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BudgetLineItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BudgetLineItem_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "BudgetBucket" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BudgetLineItem" ("actualAmount", "bucketId", "createdAt", "date", "description", "id", "isDeleted", "notes", "plannedAmount", "projectId", "receiptPath", "sourceId", "sourceType", "updatedAt") SELECT "actualAmount", "bucketId", "createdAt", "date", "description", "id", "isDeleted", "notes", "plannedAmount", "projectId", "receiptPath", "sourceId", "sourceType", "updatedAt" FROM "BudgetLineItem";
DROP TABLE "BudgetLineItem";
ALTER TABLE "new_BudgetLineItem" RENAME TO "BudgetLineItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
