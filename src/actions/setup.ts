"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { z } from "zod";
import { passwordSchema } from "@/lib/validators";

const setupSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    username: z.string().min(1, "Username is required").regex(/^[a-z0-9_-]+$/i, "Username can only use letters, numbers, _ and -"),
    password: passwordSchema,
    confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

export type SetupState = { error?: string };

export async function checkSetupAllowed(): Promise<boolean> {
  const count = await prisma.user.count();
  return count === 0;
}

export async function createFirstUser(
  _prevState: SetupState,
  formData: FormData
): Promise<SetupState> {
  const allowed = await checkSetupAllowed();
  if (!allowed) {
    redirect("/login");
  }

  const parsed = setupSchema.safeParse({
    name: formData.get("name"),
    username: (formData.get("username") as string)?.trim().toLowerCase(),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword")
  });

  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "Invalid input";
    return { error: msg };
  }

  const { name, username, password } = parsed.data;

  const existing = await prisma.user.findFirst({ where: { username } });
  if (existing) {
    return { error: "Username is already taken." };
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      name,
      username,
      passwordHash,
      approved: true,
      siteRole: "superadmin"
    }
  });

  await setSessionCookie(user.id);
  redirect("/");
}
