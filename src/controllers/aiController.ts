import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { ChatSession } from '../models/ChatSession';
import { geminiService } from '../services/geminiService';
import { db } from '../config/db';
import { ObjectId } from 'mongodb';

export const chatAgent = async (req: Request, res: Response): Promise<any> => {
  try {
    let { message, history } = req.body;
    
    // When using FormData, history might come as a JSON string
    if (typeof history === 'string') {
      try {
        history = JSON.parse(history);
      } catch (e) {
        history = [];
      }
    }

    if (!message && !req.file) {
      return res.status(400).json({ error: 'Message or file is required' });
    }

    let fileData = undefined;
    if (req.file) {
      fileData = {
        mimeType: req.file.mimetype,
        data: req.file.buffer.toString("base64")
      };
    }

    const finalMessage = message || "Please analyze the attached file.";
    const aiResponse = await geminiService.chatWithAgent(history || [], finalMessage, fileData);
    
    return res.json({ 
      success: true, 
      response: aiResponse 
    });
  } catch (error: any) {
    console.error('Error in chatAgent:', error);
    return res.status(500).json({ error: 'Failed to process AI chat request', details: error.message });
  }
};

export const customizePlan = async (req: Request, res: Response): Promise<any> => {
  try {
    const { basePlanId, budget, days, nights, preferences } = req.body;
    
    if (!basePlanId) {
      return res.status(400).json({ error: 'Base plan ID is required' });
    }
    
    // Fetch the base plan
    const basePlan = await db.collection('travel_plans').findOne({ _id: new ObjectId(basePlanId) });
    if (!basePlan) {
      return res.status(404).json({ error: 'Base plan not found' });
    }

    const basePlanStr = `
Title: ${basePlan.title}
Short Description: ${basePlan.shortDescription}
Full Description: ${basePlan.fullDescription}
Budget: ${basePlan.price}
Duration: ${basePlan.duration}
`;

    // Combine structured constraints into a single preference string for the AI
    const formattedPreferences = `
    - Target Budget: ${budget ? `${budget} BDT` : 'Keep similar to base plan'}
    - Target Duration: ${days && nights ? `${days} Days, ${nights} Nights` : 'Keep same as base plan'}
    - Additional Requests: ${preferences || 'None'}
    
    Please ensure the output strictly follows the target duration (e.g. exactly ${days || 'base'} days) and fits within the target budget.
    `;

    // Generate the customized plan text via AI
    const customizedMarkdown = await geminiService.customizePlan(basePlanStr, formattedPreferences);
    
    // Create a new customized travel plan in the database
    // We append "(Customized)" to the title to distinguish it.
    // Ensure we keep the correct structure for the frontend Explore pages.
    const newPlan = {
      title: `${basePlan.title} (Customized for you)`,
      shortDescription: `AI Customized Plan based on your preferences: ${preferences ? preferences.substring(0, 50) : 'Customized'}...`,
      fullDescription: customizedMarkdown,
      price: budget ? `${budget} BDT` : basePlan.price,
      duration: (days && nights) ? `${days} Days, ${nights} Nights` : basePlan.duration,
      imageUrl: basePlan.imageUrl, // keep same image
      images: basePlan.images, // preserve the entire images array
      agentEmail: basePlan.agentEmail,
      userId: basePlan.userId, // keep the original agent as the owner
      isCustomized: true, // flag
      basePlanId: basePlan.basePlanId ? basePlan.basePlanId : basePlan._id,
      createdAt: new Date(),
    };

    const result = await db.collection('travel_plans').insertOne(newPlan);
    
    return res.status(201).json({ 
      success: true, 
      message: 'Customized plan generated successfully',
      newPlanId: result.insertedId 
    });

  } catch (error: any) {
    console.error('Error in customizePlan:', error);
    return res.status(500).json({ error: 'Failed to customize travel plan', details: error.message });
  }
};

export const getChats = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const chats = await db.collection('ai_chats').find({ userId }).sort({ updatedAt: -1 }).toArray();
    return res.json({ success: true, chats });
  } catch (error: any) {
    console.error('Error fetching chats:', error);
    return res.status(500).json({ error: 'Failed to fetch chats' });
  }
};

export const saveChat = async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, sessionId, title, messages } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });
    if (!sessionId) return res.status(400).json({ error: 'Session ID is required' });

    const updateData = {
      userId,
      sessionId,
      title: title || 'New Chat',
      messages: messages || [],
      updatedAt: Date.now(),
    };

    const result = await db.collection('ai_chats').updateOne(
      { sessionId, userId },
      { $set: updateData, $setOnInsert: { createdAt: Date.now() } },
      { upsert: true }
    );

    return res.json({ success: true, message: 'Chat saved successfully' });
  } catch (error: any) {
    console.error('Error saving chat:', error);
    return res.status(500).json({ error: 'Failed to save chat' });
  }
};

export const deleteChat = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params; // this is the sessionId
    const userId = req.body.userId;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const result = await db.collection('ai_chats').deleteOne({ sessionId: id, userId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    return res.json({ success: true, message: 'Chat deleted' });
  } catch (error: any) {
    console.error('Error deleting chat:', error);
    return res.status(500).json({ error: 'Failed to delete chat' });
  }
};
