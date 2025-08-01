import type { NextApiRequest, NextApiResponse } from 'next';
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { tavily } from '@tavily/core';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { teamA, teamB } = req.body;
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    if (!teamA || !teamB) return res.status(400).json({ error: 'Please provide two team names.' });

    const supabase = createPagesServerClient({ req, res });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const { data: profile, error: profileError } = await supabase.from('profiles').select('coins_remaining').eq('id', session.user.id).single();
        if (profileError || !profile) throw new Error('Could not fetch your user profile.');
        if (profile.coins_remaining <= 0) return res.status(403).json({ error: 'No coins remaining.' });

        const { error: updateError } = await supabase.from('profiles').update({ coins_remaining: profile.coins_remaining - 1 }).eq('id', session.user.id);
        if (updateError) throw new Error('Could not update coin count.');

        const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY! });
        const searchContext = await tavilyClient.search(`Detailed stats, recent form, H2H, and injury news for the soccer match between ${teamA} and ${teamB}`, { maxResults: 10 });
        const compiledStats = searchContext.results.map(r => r.content).join('\n\n---\n\n');

        // --- THE MOST EXPLICIT PROMPT YET ---
        const chatCompletion = await groq.chat.completions.create({
            messages: [{
                role: 'user',
                content: `You are a data formatting machine. Your only job is to return a single, raw JSON object based on the provided data.

                Data for the match between ${teamA} and ${teamB}:
                ---
                ${compiledStats}
                ---

                You MUST return a JSON object with exactly 8 keys. Each key's value must be another object containing specific keys as shown in this example.

                THIS IS THE EXACT STRUCTURE YOU MUST FOLLOW:
                {
                  "fullTimeWinner": { "prediction": "string", "probability": "string (e.g., '55%')" },
                  "halfTimeWinner": { "prediction": "string", "probability": "string (e.g., '40%')" },
                  "overUnderGoals": { "prediction": "string (e.g., 'Over 2.5 Goals')", "probability": "string (e.g., '60%')" },
                  "correctScoreSuggestion": { "prediction": "string (e.g., '2-1')", "probability": "string (e.g., '15%')" },
                  "bothTeamsToScore": { "prediction": "string (Yes or No)", "probability": "string (e.g., '70%')" },
                  "doubleChance": { "prediction": "string (e.g., '${teamA} or Draw')", "probability": "string (e.g., '80%')" },
                  "handicapResult": { "prediction": "string (e.g., '${teamA} (-1)')", "reasoning": "string (Briefly explain why)" },
                  "keyInsights": { "prediction": "string (e.g., 'A specific player to score')", "reasoning": "string (Briefly explain the main insight)" }
                }

                Do not include any other text, explanations, or markdown formatting like \`\`\`json. Just the raw JSON object.`
            }],
            model: 'llama3-8b-8192',
        });

        const responseText = chatCompletion.choices[0]?.message?.content;
        if (!responseText) throw new Error("The AI returned an empty response.");

        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Could not find JSON in the AI response.");

        const predictionJson = JSON.parse(jsonMatch[0]);
        res.status(200).json(predictionJson);

    } catch (error: any) {
        console.error("API Error:", error);
        res.status(500).json({ error: "An error occurred during prediction.", details: error.message });
    }
}