-- CreateTable: Project
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT 'Untitled Project',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable: ProjectMember
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'collaborator',
    "allowedSections" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: ProjectSettings
CREATE TABLE "ProjectSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "totalBudget" REAL NOT NULL DEFAULT 10000,
    "projectName" TEXT NOT NULL DEFAULT 'Untitled Project',
    "currencySymbol" TEXT NOT NULL DEFAULT '$',
    "craftyPerPerson" REAL NOT NULL DEFAULT 5,
    "lunchPerPerson" REAL NOT NULL DEFAULT 12,
    "dinnerPerPerson" REAL NOT NULL DEFAULT 12,
    "craftyEnabledByDefault" INTEGER NOT NULL DEFAULT 1,
    "lunchEnabledByDefault" INTEGER NOT NULL DEFAULT 1,
    "dinnerEnabledByDefault" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProjectSettings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProjectMember_userId_projectId_key" ON "ProjectMember"("userId", "projectId");
CREATE UNIQUE INDEX "ProjectSettings_projectId_key" ON "ProjectSettings"("projectId");

-- AlterTable: add projectId (nullable) to all data models
ALTER TABLE "ScriptVersion" ADD COLUMN "projectId" TEXT;
ALTER TABLE "CastMember" ADD COLUMN "projectId" TEXT;
ALTER TABLE "CrewMember" ADD COLUMN "projectId" TEXT;
ALTER TABLE "Scene" ADD COLUMN "projectId" TEXT;
ALTER TABLE "Location" ADD COLUMN "projectId" TEXT;
ALTER TABLE "ShootDay" ADD COLUMN "projectId" TEXT;
ALTER TABLE "GearModel" ADD COLUMN "projectId" TEXT;
ALTER TABLE "BudgetBucket" ADD COLUMN "projectId" TEXT;
ALTER TABLE "BudgetLineItem" ADD COLUMN "projectId" TEXT;
ALTER TABLE "Note" ADD COLUMN "projectId" TEXT;
ALTER TABLE "Task" ADD COLUMN "projectId" TEXT;
ALTER TABLE "Decision" ADD COLUMN "projectId" TEXT;
ALTER TABLE "VaultFile" ADD COLUMN "projectId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "projectId" TEXT;
