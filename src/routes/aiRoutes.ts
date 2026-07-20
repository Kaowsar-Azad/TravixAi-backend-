import { Router } from 'express';
import multer from 'multer';
import { chatAgent, customizePlan } from '../controllers/aiController';

// Configure multer to use memory storage since we only need the buffer
const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

router.post('/chat', upload.single('file'), chatAgent);
router.post('/customize', customizePlan);

export default router;
