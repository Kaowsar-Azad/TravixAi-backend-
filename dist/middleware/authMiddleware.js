import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";
export const requireAuth = async (req, res, next) => {
    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });
        if (!session || !session.user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        req.user = session.user;
        req.session = session.session;
        next();
    }
    catch (error) {
        console.error("Auth middleware error:", error);
        res.status(500).json({ error: "Internal server error during authentication" });
    }
};
export const requireRole = (roles) => {
    return async (req, res, next) => {
        // Ensure requireAuth ran first
        if (!req.user) {
            await requireAuth(req, res, () => { });
            if (res.headersSent)
                return;
        }
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403).json({ error: "Access denied. Insufficient permissions." });
            return;
        }
        next();
    };
};
