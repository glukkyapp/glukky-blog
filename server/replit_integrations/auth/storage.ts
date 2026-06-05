import { users, type User } from "@shared/models/auth";
import { db } from "../../db";
import { eq } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(email: string, hashedPassword: string): Promise<User>;
  getUserByAppleId(appleId: string): Promise<User | undefined>;
  createAppleUser(appleId: string, email?: string): Promise<User>;
  storeAppleRefreshToken(userId: string, refreshToken: string): Promise<void>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(email: string, hashedPassword: string): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({ email, password: hashedPassword })
      .returning();
    return user;
  }

  async getUserByAppleId(appleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.appleId, appleId));
    return user;
  }

  async createAppleUser(appleId: string, email?: string): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({ appleId, email: email ?? null, password: null })
      .returning();
    return user;
  }

  async storeAppleRefreshToken(userId: string, refreshToken: string): Promise<void> {
    await db.update(users).set({ appleRefreshToken: refreshToken }).where(eq(users.id, userId));
  }
}

export const authStorage = new AuthStorage();
