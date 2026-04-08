-- DropTable (if it exists)
DROP TABLE IF EXISTS "Decision";

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'collaborator',
    "allowedSections" TEXT NOT NULL DEFAULT '[]',
    "expiresAt" DATETIME NOT NULL,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LocationFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "locationId" TEXT NOT NULL,
    "venueId" TEXT,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LocationFile_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LocationFile_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "LocationVenue" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LocationVenue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "locationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "address" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "providerType" TEXT,
    "providerLink" TEXT,
    "estimatedCostPerDay" REAL,
    "numberOfDays" REAL,
    "fees" REAL,
    "costNotes" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LocationVenue_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CateringDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "date" DATETIME,
    "label" TEXT NOT NULL,
    "locationName" TEXT,
    "headcount" INTEGER NOT NULL DEFAULT 0,
    "shootDayId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CateringDay_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CateringDay_shootDayId_fkey" FOREIGN KEY ("shootDayId") REFERENCES "ShootDay" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CateringDayMeal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cateringDayId" TEXT NOT NULL,
    "mealType" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "vendor" TEXT,
    "estimatedCost" REAL,
    "actualCost" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CateringDayMeal_cateringDayId_fkey" FOREIGN KEY ("cateringDayId") REFERENCES "CateringDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "changeNote" TEXT,
    "performedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AuditLog" ("action", "after", "before", "changeNote", "createdAt", "entityId", "entityType", "id", "performedBy", "projectId") SELECT "action", "after", "before", "changeNote", "createdAt", "entityId", "entityType", "id", "performedBy", "projectId" FROM "AuditLog";
DROP TABLE "AuditLog";
ALTER TABLE "new_AuditLog" RENAME TO "AuditLog";
CREATE TABLE "new_BudgetBucket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "plannedAmount" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BudgetBucket_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BudgetBucket" ("createdAt", "id", "name", "plannedAmount", "projectId", "updatedAt") SELECT "createdAt", "id", "name", "plannedAmount", "projectId", "updatedAt" FROM "BudgetBucket";
DROP TABLE "BudgetBucket";
ALTER TABLE "new_BudgetBucket" RENAME TO "BudgetBucket";
CREATE TABLE "new_CastMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "roleName" TEXT,
    "actorName" TEXT,
    "castingLink" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TBD',
    "phone" TEXT,
    "email" TEXT,
    "includePhoneOnCallSheet" BOOLEAN NOT NULL DEFAULT false,
    "includeEmailOnCallSheet" BOOLEAN NOT NULL DEFAULT false,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "emergencyContactRelation" TEXT,
    "dietaryRestrictions" TEXT,
    "intakeToken" TEXT,
    "intakeTokenExpiresAt" DATETIME,
    "notes" TEXT,
    "rate" REAL,
    "days" REAL,
    "flatFee" REAL,
    "plannedAmount" REAL,
    "budgetBucket" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CastMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CastMember" ("actorName", "budgetBucket", "castingLink", "createdAt", "days", "dietaryRestrictions", "email", "emergencyContactName", "emergencyContactPhone", "emergencyContactRelation", "flatFee", "id", "includeEmailOnCallSheet", "includePhoneOnCallSheet", "intakeTokenExpiresAt", "isDeleted", "name", "notes", "phone", "projectId", "rate", "roleName", "status", "updatedAt") SELECT "actorName", "budgetBucket", "castingLink", "createdAt", "days", "dietaryRestrictions", "email", "emergencyContactName", "emergencyContactPhone", "emergencyContactRelation", "flatFee", "id", "includeEmailOnCallSheet", "includePhoneOnCallSheet", "intakeTokenExpiresAt", "isDeleted", "name", "notes", "phone", "projectId", "rate", "roleName", "status", "updatedAt" FROM "CastMember";
DROP TABLE "CastMember";
ALTER TABLE "new_CastMember" RENAME TO "CastMember";
CREATE UNIQUE INDEX "CastMember_intakeToken_key" ON "CastMember"("intakeToken");
CREATE TABLE "new_CrewMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "includePhoneOnCallSheet" BOOLEAN NOT NULL DEFAULT false,
    "includeEmailOnCallSheet" BOOLEAN NOT NULL DEFAULT false,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "emergencyContactRelation" TEXT,
    "dietaryRestrictions" TEXT,
    "intakeToken" TEXT,
    "intakeTokenExpiresAt" DATETIME,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TBD',
    "rate" REAL,
    "days" REAL,
    "flatFee" REAL,
    "plannedAmount" REAL,
    "budgetBucket" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CrewMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CrewMember" ("budgetBucket", "createdAt", "days", "dietaryRestrictions", "email", "emergencyContactName", "emergencyContactPhone", "emergencyContactRelation", "flatFee", "id", "includeEmailOnCallSheet", "includePhoneOnCallSheet", "intakeTokenExpiresAt", "isDeleted", "name", "notes", "phone", "position", "projectId", "rate", "status", "updatedAt") SELECT "budgetBucket", "createdAt", "days", "dietaryRestrictions", "email", "emergencyContactName", "emergencyContactPhone", "emergencyContactRelation", "flatFee", "id", "includeEmailOnCallSheet", "includePhoneOnCallSheet", "intakeTokenExpiresAt", "isDeleted", "name", "notes", "phone", "position", "projectId", "rate", "status", "updatedAt" FROM "CrewMember";
DROP TABLE "CrewMember";
ALTER TABLE "new_CrewMember" RENAME TO "CrewMember";
CREATE UNIQUE INDEX "CrewMember_intakeToken_key" ON "CrewMember"("intakeToken");
CREATE TABLE "new_GearModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "plannedAmount" REAL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GearModel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GearModel" ("createdAt", "id", "isActive", "isDeleted", "name", "projectId", "sortOrder", "updatedAt") SELECT "createdAt", "id", "isActive", "isDeleted", "name", "projectId", "sortOrder", "updatedAt" FROM "GearModel";
DROP TABLE "GearModel";
ALTER TABLE "new_GearModel" RENAME TO "GearModel";
CREATE TABLE "new_Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "providerType" TEXT,
    "providerLink" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Shortlist',
    "estimatedCostPerDay" REAL,
    "numberOfDays" REAL,
    "fees" REAL,
    "costNotes" TEXT,
    "plannedAmount" REAL,
    "budgetBucket" TEXT,
    "selectedVenueId" TEXT,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Location_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Location_selectedVenueId_fkey" FOREIGN KEY ("selectedVenueId") REFERENCES "LocationVenue" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Location" ("address", "budgetBucket", "costNotes", "createdAt", "estimatedCostPerDay", "fees", "id", "isDeleted", "latitude", "longitude", "name", "notes", "numberOfDays", "projectId", "providerLink", "providerType", "status", "updatedAt") SELECT "address", "budgetBucket", "costNotes", "createdAt", "estimatedCostPerDay", "fees", "id", "isDeleted", "latitude", "longitude", "name", "notes", "numberOfDays", "projectId", "providerLink", "providerType", "status", "updatedAt" FROM "Location";
DROP TABLE "Location";
ALTER TABLE "new_Location" RENAME TO "Location";
CREATE UNIQUE INDEX "Location_selectedVenueId_key" ON "Location"("selectedVenueId");
CREATE TABLE "new_LoginCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_LoginCode" ("code", "createdAt", "email", "expiresAt", "id", "used") SELECT "code", "createdAt", "email", "expiresAt", "id", "used" FROM "LoginCode";
DROP TABLE "LoginCode";
ALTER TABLE "new_LoginCode" RENAME TO "LoginCode";
CREATE TABLE "new_Note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "body" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Note_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Note" ("body", "category", "createdAt", "createdBy", "id", "isDeleted", "projectId", "title", "updatedAt") SELECT "body", "category", "createdAt", "createdBy", "id", "isDeleted", "projectId", "title", "updatedAt" FROM "Note";
DROP TABLE "Note";
ALTER TABLE "new_Note" RENAME TO "Note";
CREATE TABLE "new_ProjectSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "totalBudget" REAL NOT NULL DEFAULT 10000,
    "projectName" TEXT NOT NULL DEFAULT 'Untitled Project',
    "currencySymbol" TEXT NOT NULL DEFAULT '$',
    "craftyPerPerson" REAL NOT NULL DEFAULT 5,
    "lunchPerPerson" REAL NOT NULL DEFAULT 12,
    "dinnerPerPerson" REAL NOT NULL DEFAULT 12,
    "craftyEnabledByDefault" BOOLEAN NOT NULL DEFAULT true,
    "lunchEnabledByDefault" BOOLEAN NOT NULL DEFAULT true,
    "dinnerEnabledByDefault" BOOLEAN NOT NULL DEFAULT false,
    "intakeEmailSubject" TEXT,
    "intakeEmailBody" TEXT,
    CONSTRAINT "ProjectSettings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProjectSettings" ("craftyEnabledByDefault", "craftyPerPerson", "currencySymbol", "dinnerEnabledByDefault", "dinnerPerPerson", "id", "lunchEnabledByDefault", "lunchPerPerson", "projectId", "projectName", "totalBudget") SELECT "craftyEnabledByDefault", "craftyPerPerson", "currencySymbol", "dinnerEnabledByDefault", "dinnerPerPerson", "id", "lunchEnabledByDefault", "lunchPerPerson", "projectId", "projectName", "totalBudget" FROM "ProjectSettings";
DROP TABLE "ProjectSettings";
ALTER TABLE "new_ProjectSettings" RENAME TO "ProjectSettings";
CREATE UNIQUE INDEX "ProjectSettings_projectId_key" ON "ProjectSettings"("projectId");
CREATE TABLE "new_Scene" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "sceneNumber" TEXT NOT NULL,
    "title" TEXT,
    "intExt" TEXT,
    "dayNight" TEXT,
    "pageCount" REAL,
    "synopsis" TEXT,
    "shotlistPath" TEXT,
    "locationId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Scene_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Scene_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Scene" ("createdAt", "dayNight", "id", "intExt", "isDeleted", "locationId", "pageCount", "projectId", "sceneNumber", "shotlistPath", "synopsis", "title", "updatedAt") SELECT "createdAt", "dayNight", "id", "intExt", "isDeleted", "locationId", "pageCount", "projectId", "sceneNumber", "shotlistPath", "synopsis", "title", "updatedAt" FROM "Scene";
DROP TABLE "Scene";
ALTER TABLE "new_Scene" RENAME TO "Scene";
CREATE TABLE "new_ScriptVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "versionName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT,
    "pageCount" INTEGER,
    "notes" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "uploadedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScriptVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ScriptVersion" ("createdAt", "fileName", "filePath", "id", "isCurrent", "isDeleted", "notes", "pageCount", "projectId", "updatedAt", "uploadedBy", "versionName") SELECT "createdAt", "fileName", "filePath", "id", "isCurrent", "isDeleted", "notes", "pageCount", "projectId", "updatedAt", "uploadedBy", "versionName" FROM "ScriptVersion";
DROP TABLE "ScriptVersion";
ALTER TABLE "new_ScriptVersion" RENAME TO "ScriptVersion";
CREATE TABLE "new_ShootDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "date" DATETIME NOT NULL,
    "callTime" TEXT,
    "locationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Planned',
    "meals" REAL,
    "transport" REAL,
    "misc" REAL,
    "budgetBucket" TEXT,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShootDay_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShootDay_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ShootDay" ("budgetBucket", "callTime", "createdAt", "date", "id", "isDeleted", "locationId", "meals", "misc", "notes", "projectId", "status", "transport", "updatedAt") SELECT "budgetBucket", "callTime", "createdAt", "date", "id", "isDeleted", "locationId", "meals", "misc", "notes", "projectId", "status", "transport", "updatedAt" FROM "ShootDay";
DROP TABLE "ShootDay";
ALTER TABLE "new_ShootDay" RENAME TO "ShootDay";
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "owner" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Todo',
    "priority" TEXT NOT NULL DEFAULT 'none',
    "category" TEXT,
    "position" REAL NOT NULL DEFAULT 0,
    "dueDate" DATETIME,
    "notes" TEXT,
    "sourceNoteId" TEXT,
    "sourceEntityType" TEXT,
    "sourceEntityId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("createdAt", "dueDate", "id", "isDeleted", "notes", "owner", "projectId", "sourceEntityId", "sourceEntityType", "sourceNoteId", "status", "title", "updatedAt") SELECT "createdAt", "dueDate", "id", "isDeleted", "notes", "owner", "projectId", "sourceEntityId", "sourceEntityType", "sourceNoteId", "status", "title", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "username" TEXT,
    "passwordHash" TEXT,
    "name" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "siteRole" TEXT NOT NULL DEFAULT 'user',
    "colorTheme" TEXT NOT NULL DEFAULT 'light',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("approved", "colorTheme", "createdAt", "email", "id", "name", "passwordHash", "siteRole", "updatedAt", "username") SELECT "approved", "colorTheme", "createdAt", "email", "id", "name", "passwordHash", "siteRole", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE TABLE "new_VaultFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Other',
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VaultFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_VaultFile" ("category", "createdAt", "fileName", "filePath", "id", "isDeleted", "notes", "projectId", "updatedAt") SELECT "category", "createdAt", "fileName", "filePath", "id", "isDeleted", "notes", "projectId", "updatedAt" FROM "VaultFile";
DROP TABLE "VaultFile";
ALTER TABLE "new_VaultFile" RENAME TO "VaultFile";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Invite_token_key" ON "Invite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "CateringDay_shootDayId_key" ON "CateringDay"("shootDayId");

-- CreateIndex
CREATE UNIQUE INDEX "CateringDayMeal_cateringDayId_mealType_key" ON "CateringDayMeal"("cateringDayId", "mealType");

