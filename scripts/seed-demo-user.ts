import crypto from "crypto";

import { prisma } from "../src/shared/lib/prisma";
import { UserRole } from "@prisma/client";

/**
 * Seeds a fixed local demo account so you can log in without going through
 * sign-up, email verification, or any external OAuth provider (Google, etc.).
 *
 * The password hash mirrors the BetterAuth custom hash configured in
 * src/features/auth/lib/better-auth.ts -> hashStringWithSalt(secret + password).
 *
 * Run with:  pnpm db:seed-demo
 */
const DEMO_EMAIL = "demo@workout.local";
const DEMO_PASSWORD = "123123123";
const ADMIN_EMAIL = "admin@workout.local";

const hashStringWithSalt = (string: string, salt: string) => {
  return crypto.createHash("sha256").update(salt + string).digest("hex");
};

async function upsertUser(email: string, role: UserRole) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is not set in the environment.");
  }

  const passwordHash = hashStringWithSalt(DEMO_PASSWORD, secret);
  const userId = crypto.randomBytes(16).toString("hex");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.account.updateMany({
      where: { userId: existing.id, providerId: "credential" },
      data: { password: passwordHash },
    });
    console.log(`✓ Demo user already exists: ${email} (password refreshed)`);
    return;
  }

  const firstName = role === UserRole.admin ? "Admin" : "Demo";
  const lastName = "Local";

  await prisma.user.create({
    data: {
      id: userId,
      email,
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      emailVerified: true,
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      accounts: {
        create: {
          id: crypto.randomBytes(16).toString("hex"),
          accountId: userId,
          providerId: "credential",
          password: passwordHash,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    },
  });

  console.log(`✓ Created demo user: ${email} / ${DEMO_PASSWORD} (${role})`);
}

async function main() {
  console.log("Seeding local demo accounts...");
  await upsertUser(DEMO_EMAIL, UserRole.user);
  await upsertUser(ADMIN_EMAIL, UserRole.admin);
  console.log("\nDone. Login with:");
  console.log(`  email:    ${DEMO_EMAIL}  (or ${ADMIN_EMAIL})`);
  console.log(`  password: ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("Failed to seed demo user:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
