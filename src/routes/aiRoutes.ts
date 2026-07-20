import { Router } from 'express';
import multer from 'multer';
import { chatAgent, customizePlan, getChats, saveChat, deleteChat } from '../controllers/aiController';
import { requireAuth } from '../middleware/authMiddleware';
// Configure multer to use memory storage since we only need the buffer
const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

router.post('/chat', upload.single('file'), chatAgent);
router.post('/customize', customizePlan);

// Chat history routes
router.get('/chats', requireAuth, getChats);
router.post('/chats', requireAuth, saveChat);
router.delete('/chats/:id', requireAuth, deleteChat);

export default router;
