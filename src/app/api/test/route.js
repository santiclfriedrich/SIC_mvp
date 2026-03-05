import { redis } from "@/lib/cache/redis";

export async function GET() {

  await redis.set("test", "hola redis", { ex: 60 });

  const value = await redis.get("test");

  return Response.json({
    success: true,
    value
  });

}