import { Router } from "express";

export function healthController(): Router {
  const router = Router();
  router.get("/", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });
  return router;
}
