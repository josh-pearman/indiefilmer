-- AlterTable: User - rework for new auth (displayName -> name, add email, passwordHash, approved, siteRole, updatedAt; username nullable)
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "username" TEXT,
    "passwordHash" TEXT,
    "name" TEXT,
    "approved" INTEGER NOT NULL DEFAULT 0,
    "siteRole" TEXT NOT NULL DEFAULT 'user',
    "colorTheme" TEXT NOT NULL DEFAULT 'light',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_User" ("id", "username", "name", "colorTheme", "createdAt", "updatedAt", "approved", "siteRole")
SELECT "id", "username", "displayName", "colorTheme", "createdAt", "createdAt", 0, 'user' FROM "User";

DROP TABLE "User";

ALTER TABLE "new_User" RENAME TO "User";

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateTable: LoginCode
CREATE TABLE "LoginCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
