// /api/auth/signin 전용 라우트 (standalone 빌드에서 catch-all [...nextauth] 404 방지)
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
