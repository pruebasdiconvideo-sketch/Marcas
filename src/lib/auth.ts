/**
 * Configuración NextAuth.js para el CLIENTE dashboard.
 * El cliente NO accede a BD - usa credenciales fijas por variables de entorno
 * o por defecto admin/admin123 (solo para acceso al dashboard visual).
 *
 * Las marcaciones, equipos y datos biométricos viven en el SERVIDOR (puerto 3001).
 */
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const CLIENT_USERNAME = process.env.CLIENT_USERNAME || "admin";
const CLIENT_PASSWORD = process.env.CLIENT_PASSWORD || "admin123";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credenciales",
      credentials: {
        username: { label: "Usuario", type: "text", placeholder: "admin" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }
        if (
          credentials.username === CLIENT_USERNAME &&
          credentials.password === CLIENT_PASSWORD
        ) {
          return {
            id: "1",
            name: "Operador Dashboard",
            email: CLIENT_USERNAME,
            role: "admin",
          } as any;
        }
        return null;
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.username = (user as any).email ?? (user as any).name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).username = token.username;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET ?? "biometrico-dicon-secret-dev-key-2026",
};
