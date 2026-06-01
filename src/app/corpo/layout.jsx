import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";

export default async function CorpoLayout({ children }) {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/login");
  if (session.user.role !== "CORPO" && session.user.role !== "ADMIN") {
    redirect("/");
  }

  return children;
}
