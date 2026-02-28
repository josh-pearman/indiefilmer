-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "colorTheme" TEXT NOT NULL DEFAULT 'warm',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ScriptVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT,
    "pageCount" INTEGER,
    "notes" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "uploadedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CastMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "roleName" TEXT,
    "actorName" TEXT,
    "castingLink" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TBD',
    "phone" TEXT,
    "email" TEXT,
    "includePhoneOnCallSheet" BOOLEAN NOT NULL DEFAULT true,
    "includeEmailOnCallSheet" BOOLEAN NOT NULL DEFAULT true,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "emergencyContactRelation" TEXT,
    "dietaryRestrictions" TEXT,
    "notes" TEXT,
    "rate" REAL,
    "days" REAL,
    "flatFee" REAL,
    "budgetBucket" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CrewMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "includePhoneOnCallSheet" BOOLEAN NOT NULL DEFAULT true,
    "includeEmailOnCallSheet" BOOLEAN NOT NULL DEFAULT true,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "emergencyContactRelation" TEXT,
    "dietaryRestrictions" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TBD',
    "rate" REAL,
    "days" REAL,
    "flatFee" REAL,
    "budgetBucket" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Scene" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "Scene_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SceneTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sceneId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    CONSTRAINT "SceneTag_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SceneCast" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sceneId" TEXT NOT NULL,
    "castMemberId" TEXT NOT NULL,
    CONSTRAINT "SceneCast_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SceneCast_castMemberId_fkey" FOREIGN KEY ("castMemberId") REFERENCES "CastMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "budgetBucket" TEXT,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ShootDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "ShootDay_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShootDayMeal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shootDayId" TEXT NOT NULL,
    "mealType" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "vendor" TEXT,
    "estimatedCost" REAL,
    "actualCost" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShootDayMeal_shootDayId_fkey" FOREIGN KEY ("shootDayId") REFERENCES "ShootDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShootDayScene" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shootDayId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ShootDayScene_shootDayId_fkey" FOREIGN KEY ("shootDayId") REFERENCES "ShootDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShootDayScene_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShootDayCrew" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shootDayId" TEXT NOT NULL,
    "crewMemberId" TEXT NOT NULL,
    CONSTRAINT "ShootDayCrew_shootDayId_fkey" FOREIGN KEY ("shootDayId") REFERENCES "ShootDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShootDayCrew_crewMemberId_fkey" FOREIGN KEY ("crewMemberId") REFERENCES "CrewMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GearModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GearItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gearModelId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'Other',
    "costAmount" REAL NOT NULL DEFAULT 0,
    "costType" TEXT NOT NULL DEFAULT 'per_day',
    "supplier" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GearItem_gearModelId_fkey" FOREIGN KEY ("gearModelId") REFERENCES "GearModel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GearItemDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gearItemId" TEXT NOT NULL,
    "shootDayId" TEXT NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "GearItemDay_gearItemId_fkey" FOREIGN KEY ("gearItemId") REFERENCES "GearItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GearItemDay_shootDayId_fkey" FOREIGN KEY ("shootDayId") REFERENCES "ShootDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BudgetBucket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "plannedAmount" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BudgetLineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "BudgetLineItem_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "BudgetBucket" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BudgetSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "totalBudget" REAL NOT NULL DEFAULT 10000,
    "projectName" TEXT NOT NULL DEFAULT 'Untitled Project',
    "currencySymbol" TEXT NOT NULL DEFAULT '$',
    "craftyPerPerson" REAL NOT NULL DEFAULT 5,
    "lunchPerPerson" REAL NOT NULL DEFAULT 12,
    "dinnerPerPerson" REAL NOT NULL DEFAULT 12,
    "craftyEnabledByDefault" BOOLEAN NOT NULL DEFAULT true,
    "lunchEnabledByDefault" BOOLEAN NOT NULL DEFAULT true,
    "dinnerEnabledByDefault" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "body" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NoteFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "noteId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NoteFile_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NoteLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "noteId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NoteLink_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "owner" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Todo',
    "dueDate" DATETIME,
    "notes" TEXT,
    "sourceNoteId" TEXT,
    "sourceEntityType" TEXT,
    "sourceEntityId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TaskFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskFile_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskLink_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "tradeoffs" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VaultFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Other',
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CallSheet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shootDayId" TEXT NOT NULL,
    "generalCallTime" TEXT,
    "announcements" TEXT,
    "weatherSummary" TEXT,
    "sunrise" TEXT,
    "sunset" TEXT,
    "nearestHospital" TEXT,
    "emergencyContact" TEXT,
    "personalCallTimes" TEXT,
    "mapImageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CallSheet_shootDayId_fkey" FOREIGN KEY ("shootDayId") REFERENCES "ShootDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CallSheetCrew" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "callSheetId" TEXT NOT NULL,
    "crewId" TEXT NOT NULL,
    "callTime" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CallSheetCrew_callSheetId_fkey" FOREIGN KEY ("callSheetId") REFERENCES "CallSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CallSheetCrew_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "CrewMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "changeNote" TEXT,
    "performedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "ShootDayMeal_shootDayId_mealType_key" ON "ShootDayMeal"("shootDayId", "mealType");

-- CreateIndex
CREATE UNIQUE INDEX "ShootDayScene_shootDayId_sceneId_key" ON "ShootDayScene"("shootDayId", "sceneId");

-- CreateIndex
CREATE UNIQUE INDEX "ShootDayCrew_shootDayId_crewMemberId_key" ON "ShootDayCrew"("shootDayId", "crewMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "GearItemDay_gearItemId_shootDayId_key" ON "GearItemDay"("gearItemId", "shootDayId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetBucket_name_key" ON "BudgetBucket"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CallSheet_shootDayId_key" ON "CallSheet"("shootDayId");

-- CreateIndex
CREATE UNIQUE INDEX "CallSheetCrew_callSheetId_crewId_key" ON "CallSheetCrew"("callSheetId", "crewId");

┌─────────────────────────────────────────────────────────┐
│  Update available 5.22.0 -> 7.6.0                       │
│                                                         │
│  This is a major update - please follow the guide at    │
│  https://pris.ly/d/major-version-upgrade                │
│                                                         │
│  Run the following to update                            │
│    npm i --save-dev prisma@latest                       │
│    npm i @prisma/client@latest                          │
└─────────────────────────────────────────────────────────┘
