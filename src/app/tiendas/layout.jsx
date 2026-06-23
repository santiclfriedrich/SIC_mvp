import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";

export default async function TiendasLayout({ children }) {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/login");
  if (session.user.role !== "TIENDAS" && session.user.role !== "ADMIN") {
    redirect("/");
  }

  return children;
}
